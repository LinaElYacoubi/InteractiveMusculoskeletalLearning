// Local MediaPipe inference in a module worker. Two roles:
//   live:     body pose (lite or full) + hands + face, every frame, VIDEO mode
//   analysis: heavy body model on a crop around the person, IMAGE mode, with a person silhouette mask
// Frames are closed after inference. Nothing leaves this computer.
import {FilesetResolver, PoseLandmarker, HandLandmarker, FaceLandmarker} from '../../vendor/mediapipe/vision_bundle.mjs';

const asset = name => new URL(`../../vendor/mediapipe/${name}`, import.meta.url).href;
const FACE_POINTS = [1, 10, 33, 152, 234, 263, 454, 61, 291, 13, 14]; // keep in step with body-state.js
let files = null, moduleFactory = null, role = 'live', options = {model: 'full', hands: true, face: true, delegate: 'auto'};
const tasks = {pose: null, hands: null, face: null}, delegates = {};

async function create(name, Task, settings) {
  const order = options.delegate === 'cpu' ? ['CPU'] : ['GPU', 'CPU'];
  let failure;
  for (const delegate of order) {
    // MediaPipe clears self.ModuleFactory after building each task, and the cached ES-module loader never sets it again,
    // so restore it before every task that shares this worker (body, hands, face).
    self.ModuleFactory = moduleFactory;
    try {
      const task = await Task.createFromOptions(files, {...settings, baseOptions: {...settings.baseOptions, delegate}});
      delegates[name] = delegate; return task;
    } catch (error) { failure = error; }
  }
  throw failure;
}
const poseSettings = () => role === 'analysis'
  ? {baseOptions: {modelAssetPath: asset('pose_landmarker_heavy.task')}, runningMode: 'IMAGE', numPoses: 1, minPoseDetectionConfidence: 0.4, minPosePresenceConfidence: 0.4, outputSegmentationMasks: true}
  : {baseOptions: {modelAssetPath: asset(`pose_landmarker_${options.model === 'lite' ? 'lite' : 'full'}.task`)}, runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5, outputSegmentationMasks: false};
const handSettings = () => ({baseOptions: {modelAssetPath: asset('hand_landmarker.task')}, runningMode: 'VIDEO', numHands: 2,
  minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5});
const faceSettings = () => ({baseOptions: {modelAssetPath: asset('face_landmarker.task')}, runningMode: 'VIDEO', numFaces: 1,
  minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: false});

async function ensureTasks() {
  if (!files) {
    files = await FilesetResolver.forVisionTasks(new URL('../../vendor/mediapipe/wasm', import.meta.url).href, true);
    moduleFactory = (await import(files.wasmLoaderPath)).default;
  }
  if (!tasks.pose) tasks.pose = await create('pose', PoseLandmarker, poseSettings());
  if (role !== 'live') return;
  if (options.hands && !tasks.hands) tasks.hands = await create('hands', HandLandmarker, handSettings());
  if (options.face && !tasks.face) tasks.face = await create('face', FaceLandmarker, faceSettings());
}
/** A GPU task that fails at run time is rebuilt once on the CPU. */
async function recover(name, error) {
  if (delegates[name] !== 'GPU') throw error;
  tasks[name]?.close(); tasks[name] = null;
  const saved = options.delegate; options.delegate = 'cpu';
  try { tasks[name] = await create(name, {pose: PoseLandmarker, hands: HandLandmarker, face: FaceLandmarker}[name], {pose: poseSettings, hands: handSettings, face: faceSettings}[name]()); }
  finally { options.delegate = saved; }
  self.postMessage({type: 'delegate', delegates: {...delegates}});
}
async function run(name, call) {
  try { return call(); }
  catch (error) { await recover(name, error); return call(); }
}

function downsampleMask(mask, maxSide = 112) {
  const width = mask.width, height = mask.height, values = mask.getAsFloat32Array();
  const scale = Math.min(1, maxSide / Math.max(width, height)), w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(width - 1, Math.floor((x + 0.5) / scale)), sy = Math.min(height - 1, Math.floor((y + 0.5) / scale));
    data[y * w + x] = Math.round(Math.max(0, Math.min(1, values[sy * width + sx])) * 255);
  }
  return {width: w, height: h, data};
}

async function liveFrame(data) {
  const times = {}, out = {type: 'pose', timestamp: data.timestamp, width: data.width, height: data.height, landmarks: [], worldLandmarks: [], hands: [], face: null};
  let start = performance.now();
  const pose = await run('pose', () => tasks.pose.detectForVideo(data.bitmap, data.timestamp));
  out.landmarks = pose.landmarks[0] || []; out.worldLandmarks = pose.worldLandmarks[0] || [];
  times.pose = performance.now() - start;
  if (options.hands && tasks.hands) {
    start = performance.now();
    const hands = await run('hands', () => tasks.hands.detectForVideo(data.bitmap, data.timestamp));
    const labels = hands.handedness || hands.handednesses || [];
    out.hands = (hands.landmarks || []).map((landmarks, i) => ({landmarks, worldLandmarks: hands.worldLandmarks?.[i] || [],
      handedness: labels[i]?.[0]?.categoryName || '', score: labels[i]?.[0]?.score ?? 0}));
    times.hands = performance.now() - start;
  }
  if (options.face && tasks.face) {
    start = performance.now();
    const face = await run('face', () => tasks.face.detectForVideo(data.bitmap, data.timestamp));
    const mesh = face.faceLandmarks?.[0];
    if (mesh?.length > 454) {
      const blend = {}; for (const c of face.faceBlendshapes?.[0]?.categories || []) if (c.categoryName === 'jawOpen' || c.categoryName === 'mouthClose') blend[c.categoryName] = c.score;
      out.face = {points: FACE_POINTS.map(i => ({x: mesh[i].x, y: mesh[i].y, z: mesh[i].z})), blendshapes: blend};
    }
    times.face = performance.now() - start;
  }
  out.times = times; out.elapsed = Object.values(times).reduce((a, b) => a + b, 0);
  return out;
}

async function analysisFrame(data) {
  const start = performance.now(), roi = data.roi;
  const result = await run('pose', () => tasks.pose.detect(data.bitmap));
  const local = result.landmarks?.[0] || [];
  const out = {type: 'analysis', timestamp: data.timestamp, roi, worldLandmarks: result.worldLandmarks?.[0] || [],
    landmarks: local.map(p => ({...p, x: roi.x + p.x * roi.w, y: roi.y + p.y * roi.h})), mask: null};
  const mask = result.segmentationMasks?.[0];
  if (mask) { out.mask = downsampleMask(mask); mask.close?.(); }
  out.elapsed = performance.now() - start;
  return out;
}

self.onmessage = async ({data}) => {
  if (data.type === 'prepare') {
    try {
      role = data.role || 'live'; Object.assign(options, data.options || {});
      await ensureTasks();
      self.postMessage({type: 'ready', role, delegates: {...delegates}});
    } catch (error) { self.postMessage({type: 'error', message: error.message}); }
  }
  if (data.type === 'configure') {
    Object.assign(options, data.options || {});
    try { await ensureTasks(); self.postMessage({type: 'configured', delegates: {...delegates}}); }
    catch (error) { self.postMessage({type: 'error', message: error.message}); }
  }
  if (data.type === 'frame' || data.type === 'analyze') {
    try { self.postMessage(data.type === 'frame' ? await liveFrame(data) : await analysisFrame(data)); }
    catch (error) { self.postMessage({type: 'error', message: error.message, timestamp: data.timestamp}); }
    finally { data.bitmap.close(); }
  }
  if (data.type === 'close') { for (const task of Object.values(tasks)) task?.close(); self.close(); }
};
