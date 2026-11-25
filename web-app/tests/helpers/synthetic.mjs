// Synthetic "person": a posed copy of the real rig rendered into MediaPipe-shaped output, so the tracker can be
// tested against ground truth, including known tracker failure modes.
import {readFile} from 'node:fs/promises';
import {Object3D, Bone, Vector3, Quaternion} from '../../public/vendor/three/three.module.js';
import {SWAP33} from '../../public/src/motion/pose-math.js';

let cached;
async function glbJson() {
  if (!cached) {
    const file = await readFile(new URL('../../public/assets/INNOVA-Musculoskeletal-Rig.glb', import.meta.url));
    cached = JSON.parse(file.toString('utf8', 20, 20 + file.readUInt32LE(12)));
  }
  return cached;
}

/** A viewer-shaped object around the real GLB skeleton (no meshes). */
export async function loadRig() {
  const data = await glbJson(), joints = new Set(data.skins[0].joints);
  const objects = data.nodes.map((node, index) => {
    const o = joints.has(index) ? new Bone() : new Object3D(); o.name = node.name || String(index);
    if (node.translation) o.position.fromArray(node.translation); if (node.rotation) o.quaternion.fromArray(node.rotation); if (node.scale) o.scale.fromArray(node.scale);
    return o;
  });
  data.nodes.forEach((node, index) => { for (const c of node.children || []) objects[index].add(objects[c]); });
  const model = new Object3D(); for (const i of data.scenes[data.scene || 0].nodes) model.add(objects[i]); model.updateMatrixWorld(true);
  const bones = new Map(), rest = new Map();
  for (const i of joints) { const b = objects[i]; bones.set(b.name, b); rest.set(b.name, {position: b.position.clone(), quaternion: b.quaternion.clone(), scale: b.scale.clone(), world: b.getWorldQuaternion(new Quaternion())}); }
  const viewer = {bones, rest, model, resetPose() { for (const [n, b] of bones) { const r = rest.get(n); b.position.copy(r.position); b.quaternion.copy(r.quaternion); b.scale.copy(r.scale); } model.updateMatrixWorld(true); }};
  return viewer;
}
export function addJaw(viewer) {
  const head = viewer.bones.get('head'), jaw = new Bone(); jaw.name = 'jaw'; jaw.position.set(0, 0.03, 0.02); head.add(jaw); viewer.model.updateMatrixWorld(true);
  viewer.bones.set('jaw', jaw);
  viewer.rest.set('jaw', {position: jaw.position.clone(), quaternion: jaw.quaternion.clone(), scale: jaw.scale.clone(), world: jaw.getWorldQuaternion(new Quaternion())});
  return jaw;
}

const BODY = {11: 'upper_arm.L', 12: 'upper_arm.R', 13: 'forearm.L', 14: 'forearm.R', 15: 'hand.L', 16: 'hand.R', 17: 'finger5.proximal.L', 18: 'finger5.proximal.R',
  19: 'finger2.proximal.L', 20: 'finger2.proximal.R', 21: 'finger1.proximal.L', 22: 'finger1.proximal.R', 23: 'thigh.L', 24: 'thigh.R', 25: 'shin.L', 26: 'shin.R', 27: 'foot.L', 28: 'foot.R'};
const FACE_LOCAL = [[0, 0.06, 0.11], [0, 0.16, 0.09], [-0.045, 0.1, 0.075], [0, -0.04, 0.085], [-0.07, 0.06, 0.04], [0.045, 0.1, 0.075], [0.07, 0.06, 0.04],
  [-0.025, 0.0, 0.09], [0.025, 0.0, 0.09], [0, 0.01, 0.1], [0, -0.01, 0.1]];
const HEAD_LOCAL = {0: [0, 0.06, 0.11], 1: [0.015, 0.1, 0.085], 2: [0.032, 0.1, 0.08], 3: [0.047, 0.1, 0.075], 4: [-0.015, 0.1, 0.085], 5: [-0.032, 0.1, 0.08],
  6: [-0.047, 0.1, 0.075], 7: [0.075, 0.08, 0], 8: [-0.075, 0.08, 0], 9: [0.025, 0.03, 0.09], 10: [-0.025, 0.03, 0.09]};
const HAND_POINTS = s => [['hand', 0], ['thumbBase', 0], ['finger1.proximal', 0], ['finger1.distal', 0], ['finger1.distal', 0.026],
  ['finger2.proximal', 0], ['finger2.middle', 0], ['finger2.distal', 0], ['finger2.distal', 0.02], ['finger3.proximal', 0], ['finger3.middle', 0], ['finger3.distal', 0], ['finger3.distal', 0.021],
  ['finger4.proximal', 0], ['finger4.middle', 0], ['finger4.distal', 0], ['finger4.distal', 0.02], ['finger5.proximal', 0], ['finger5.middle', 0], ['finger5.distal', 0], ['finger5.distal', 0.018]].map(([n, len]) => [n === 'hand' || n === 'thumbBase' ? n : `${n}.${s}`, len]);

export const position = (viewer, name) => viewer.bones.get(name).getWorldPosition(new Vector3());
export const direction = (viewer, name) => new Vector3(0, 1, 0).applyQuaternion(viewer.bones.get(name).getWorldQuaternion(new Quaternion()));
const tailOf = (viewer, name, len) => position(viewer, name).add(direction(viewer, name).multiplyScalar(len));

/** Feet landmarks ride on the foot bone with the offsets they have at rest. */
function footOffsets(viewer) {
  if (viewer.__feet) return viewer.__feet;
  viewer.resetPose(); const out = {};
  for (const s of ['L', 'R']) {
    const foot = viewer.bones.get(`foot.${s}`), a = position(viewer, `foot.${s}`), t = position(viewer, `toe2.proximal.${s}`);
    const heel = new Vector3(a.x, t.y, a.z - 0.055), toe = t.clone().add(new Vector3(t.x - a.x, 0, t.z - a.z).normalize().multiplyScalar(0.045));
    out[s] = {heel: foot.worldToLocal(heel.clone()), toe: foot.worldToLocal(toe.clone())};
  }
  viewer.__feet = out; return out;
}

/**
 * Render the posed rig as a tracker frame.
 * options: yaw (truth, for emulating the back-view label bug), backFacingBug, faceVisible, hands, jawOpen, vis (overrides), timestamp
 */
export function capture(viewer, options = {}) {
  const {vw = 1280, vh = 720, scale = 300, backFacingBug = true, hands = true, jawOpen = 0, timestamp = 0, visibility = {}} = options;
  viewer.model.updateMatrixWorld(true);
  const feet = footOffsets(viewer); viewer.model.updateMatrixWorld(true);
  const A = new Array(33);
  for (const [i, name] of Object.entries(BODY)) A[i] = position(viewer, name);
  for (const [s, heel, toe] of [['L', 29, 31], ['R', 30, 32]]) { const foot = viewer.bones.get(`foot.${s}`); A[heel] = foot.localToWorld(feet[s].heel.clone()); A[toe] = foot.localToWorld(feet[s].toe.clone()); }
  const head = viewer.bones.get('head');
  for (const [i, local] of Object.entries(HEAD_LOCAL)) A[i] = head.localToWorld(new Vector3(...local));
  const hip = A[23].clone().add(A[24]).multiplyScalar(0.5);
  const yaw = options.yaw ?? 0, wrapped = Math.atan2(Math.sin(yaw), Math.cos(yaw)), away = Math.abs(wrapped) > Math.PI / 2;
  const rel = A.map(p => p.clone().sub(hip));
  const toImage = p => ({x: 0.5 + p.x * scale / vw, y: 0.55 - p.y * scale / vh});
  let order = [...Array(33).keys()], flipZ = false;
  if (backFacingBug && away) { order = SWAP33; flipZ = true; } // tracker reads a back view as a front view
  const faceAway = Math.abs(wrapped) > 1.6;
  const world = [], landmarks = [];
  for (let i = 0; i < 33; i++) {
    const p = rel[order[i]];
    let v = visibility[i] ?? 1;
    if (faceAway && i <= 10) v = Math.min(v, 0.2);
    world.push({x: p.x, y: -p.y, z: flipZ ? p.z : -p.z, visibility: v, presence: 1});
    const im = toImage(p);
    landmarks.push({x: im.x, y: im.y, z: 0, visibility: v, presence: 1});
  }
  const frame = {worldLandmarks: world, landmarks, width: vw, height: vh, timestamp, hands: [], face: null};
  const faceVisible = options.faceVisible ?? Math.abs(wrapped) < 1.2;
  if (faceVisible) {
    const points = FACE_LOCAL.map(local => { const p = head.localToWorld(new Vector3(...local)).sub(hip); const im = toImage(p); return {x: im.x, y: im.y, z: -p.z * scale / vw}; });
    frame.face = {points, blendshapes: {jawOpen}};
  }
  if (hands) {
    for (const s of ['L', 'R']) {
      const pts = HAND_POINTS(s).map(([name, len]) => {
        if (name === 'hand') return position(viewer, `hand.${s}`);
        if (name === 'thumbBase') return position(viewer, `hand.${s}`).lerp(position(viewer, `finger1.proximal.${s}`), 0.45);
        return len ? tailOf(viewer, name, len) : position(viewer, name);
      });
      const wrist = pts[0];
      frame.hands.push({handedness: s === 'L' ? 'Left' : 'Right', score: 0.97, // raw frames: the label names the real hand
        worldLandmarks: pts.map(p => { const d = p.clone().sub(wrist); return {x: d.x, y: -d.y, z: -d.z}; }),
        landmarks: pts.map(p => { const im = toImage(p.clone().sub(hip)); return {x: im.x, y: im.y, z: 0}; })});
    }
  }
  return frame;
}

/** Yaw of a bone relative to its rest orientation (0 = facing +Z). */
export function yawOf(viewer, name) {
  const b = viewer.bones.get(name), r = viewer.rest.get(name);
  const d = b.getWorldQuaternion(new Quaternion()).multiply(r.world.clone().invert());
  const f = new Vector3(0, 0, 1).applyQuaternion(d);
  return Math.atan2(f.x, f.z);
}
export const angleDeg = (a, b) => a.angleTo(b) * 180 / Math.PI;
export const wrapDeg = a => { const r = Math.atan2(Math.sin(a), Math.cos(a)); return r * 180 / Math.PI; };
export function rotateWorld(viewer, name, axis, angle) {
  const bone = viewer.bones.get(name), world = bone.getWorldQuaternion(new Quaternion());
  const target = new Quaternion().setFromAxisAngle(axis, angle).multiply(world);
  const parent = bone.parent.getWorldQuaternion(new Quaternion());
  bone.quaternion.copy(parent.invert().multiply(target)); viewer.model.updateMatrixWorld(true);
}
