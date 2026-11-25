// Turns raw tracker output into a clean, continuous body estimate in avatar space (+X avatar left, +Y up, +Z forward).
// Ported from the Ranma VTuber ingest stage and extended with:
//   - spin handling (front/back depth ambiguity and left/right label swaps resolved by continuity + face cues)
//   - depth recovery from calibrated bone lengths (arms reaching toward the camera)
//   - prediction for hidden or out-of-frame limbs, easing into the person's own relaxed pose
//   - knee/elbow inference when clothing or the body hides them (dresses, long coats, crossed arms)
//   - overlap analysis hooks (per-frame hypothesis choice + corrections from the heavy-model pass)
import {Quaternion, Vector3} from '../../vendor/three/three.module.js';
import {OneEuro, VectorFilter, approach} from './filters.js';
import {AXIS, basisQ, clamp, seg, mid, lerpDir, horizontal, yawFromLateral, wrapAngle, angleBetween, deltaQ, normalizeOr} from './frames.js';
import {SWAP33, BONE_PAIRS} from './pose-math.js';
import {GROUPS, SWAPS, assessOverlap, cloneObservation, swapPairs, fitProjection, project, maskSampler, chooseCandidate, relativeVector, applyRelative, dist2} from './overlap.js';
import {HandAssigner, handToAvatar} from './hands.js';

/** The worker sends this subset of the 478 face-mesh points, in this order. */
export const FACE_POINTS = [1, 10, 33, 152, 234, 263, 454, 61, 291, 13, 14];
const FP = {nose: 0, forehead: 1, eyeR: 2, chin: 3, cheekR: 4, eyeL: 5, cheekL: 6};

/** Limb landmarks are tracked relative to their parent inside a body frame. [joint, parent, frame, length key] */
export const CHAIN = [
  [13, 11, 'chest', 'upperArmL'], [15, 13, 'chest', 'forearmL'], [17, 15, 'chest'], [19, 15, 'chest'], [21, 15, 'chest'],
  [14, 12, 'chest', 'upperArmR'], [16, 14, 'chest', 'forearmR'], [18, 16, 'chest'], [20, 16, 'chest'], [22, 16, 'chest'],
  [25, 23, 'pelvis', 'thighL'], [27, 25, 'pelvis', 'shinL'], [29, 27, 'pelvis'], [31, 27, 'pelvis'],
  [26, 24, 'pelvis', 'thighR'], [28, 26, 'pelvis', 'shinR'], [30, 28, 'pelvis'], [32, 28, 'pelvis'],
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => [i, 'neck', 'chest']),
];
const CORE = [11, 12, 23, 24];
const LIMB_BONES = [['upperArmL', 11, 13], ['forearmL', 13, 15], ['upperArmR', 12, 14], ['forearmR', 14, 16], ['thighL', 23, 25], ['shinL', 25, 27], ['thighR', 24, 26], ['shinR', 26, 28]];
const DESCENDANTS = {13: [15, 17, 19, 21], 15: [17, 19, 21], 14: [16, 18, 20, 22], 16: [18, 20, 22], 25: [27, 29, 31], 27: [29, 31], 26: [28, 30, 32], 28: [30, 32]};
const IK = [
  {root: 11, mid: 13, end: 15, a: 'upperArmL', b: 'forearmL', side: 1, kind: 'arm'}, {root: 12, mid: 14, end: 16, a: 'upperArmR', b: 'forearmR', side: -1, kind: 'arm'},
  {root: 23, mid: 25, end: 27, a: 'thighL', b: 'shinL', side: 1, kind: 'leg'}, {root: 24, mid: 26, end: 28, a: 'thighR', b: 'shinR', side: -1, kind: 'leg'},
];

/** Generic standing skeleton (metres, hip centre at origin), used only when neither the person nor the rig supplies a joint. */
export const DEFAULT_SKELETON = (() => {
  const L = {0: [0, 0.7, 0.1], 1: [0.015, 0.73, 0.085], 2: [0.03, 0.73, 0.08], 3: [0.045, 0.73, 0.075], 7: [0.075, 0.71, 0], 9: [0.025, 0.66, 0.09],
    11: [0.18, 0.5, 0], 13: [0.22, 0.22, -0.01], 15: [0.25, -0.03, 0.02], 17: [0.24, -0.11, 0.03], 19: [0.27, -0.12, 0.05], 21: [0.28, -0.07, 0.06],
    23: [0.09, 0, 0], 25: [0.09, -0.42, 0.01], 27: [0.09, -0.83, -0.01], 29: [0.09, -0.89, -0.06], 31: [0.1, -0.9, 0.14]};
  const out = new Array(33);
  for (let i = 0; i < 33; i++) {
    const own = L[i], partner = L[SWAP33[i]];
    out[i] = own ? new Vector3(...own) : new Vector3(-partner[0], partner[1], partner[2]);
  }
  return out;
})();

const median = values => { const s = [...values].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const average = vectors => vectors.reduce((sum, v) => sum.add(v), new Vector3()).divideScalar(vectors.length);

export function normalizeFrame(input) {
  if (Array.isArray(input)) return {world: input, image: null, hands: [], face: null, width: 1280, height: 720, timestamp: NaN};
  return {world: input?.worldLandmarks || null, image: input?.landmarks?.length ? input.landmarks : null, hands: input?.hands || [], face: input?.face || null,
    width: input?.width || 1280, height: input?.height || 720, timestamp: input?.timestamp ?? NaN};
}

/** Back-facing reading of the same image: swap left/right labels and reflect depth. Both readings project identically. */
export function reflectAndSwap(obs) {
  for (let i = 0; i < 33; i++) {
    const j = SWAP33[i]; if (j <= i) continue;
    [obs.P[i], obs.P[j]] = [obs.P[j], obs.P[i]];
    if (obs.img) [obs.img[i], obs.img[j]] = [obs.img[j], obs.img[i]];
    const v = obs.vis[i]; obs.vis[i] = obs.vis[j]; obs.vis[j] = v;
  }
  for (const p of obs.P) p.z = -p.z;
  return obs;
}

export function twoBoneIK(root, end, a, b, pole) {
  if (!a || !b) return null;
  const v = end.clone().sub(root); const raw = v.length(); if (raw < 1e-6) return null;
  const u = v.divideScalar(raw), d = clamp(raw, Math.abs(a - b) + 1e-4, a + b - 1e-4);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const p = pole.clone().addScaledVector(u, -pole.dot(u)); if (p.lengthSq() < 1e-10) return null; p.normalize();
  return root.clone().addScaledVector(u, a * cosA).addScaledVector(p, a * sinA);
}

/** Face orientation (avatar-left and up vectors) from the face-mesh subset. */
export function faceFrame(points, mirror, vw, vh, rotation) {
  if (!points || points.length < 7) return null;
  const fp = i => new Vector3((mirror ? 1 - points[i].x : points[i].x) * vw, -points[i].y * vh, -(points[i].z || 0) * vw);
  const eyes = mirror ? fp(FP.eyeR).sub(fp(FP.eyeL)) : fp(FP.eyeL).sub(fp(FP.eyeR));
  const cheeks = mirror ? fp(FP.cheekR).sub(fp(FP.cheekL)) : fp(FP.cheekL).sub(fp(FP.cheekR));
  const L = normalizeOr(eyes, AXIS.X).add(normalizeOr(cheeks, AXIS.X)).normalize();
  const U = normalizeOr(fp(FP.forehead).sub(fp(FP.chin)), AXIS.Y);
  if (rotation) { L.applyQuaternion(rotation); U.applyQuaternion(rotation); }
  return {L, U};
}

export class BodyState {
  constructor() { this.hands = new HandAssigner(false); this.cal = null; this.prior = new Map(); this.analysisFixes = 0; this.reset(); this.setSmoothing(0.15); }

  reset() {
    this.clock = 0; this.tracked = 0; this.mirror = false;
    this.J = DEFAULT_SKELETON.map(v => v.clone()); this.conf = new Float32Array(33); this.status = new Array(33).fill('seen');
    this.coreFilters = new Map(CORE.map(i => [i, new VectorFilter(3, 1.5, 1.5)])); this.coreInit = false;
    this.chain = new Map(CHAIN.map(([j]) => [j, {rel: null, vel: new Vector3(), missing: 0, conf: 0, filter: new VectorFilter(3, 1.5, 1.5)}]));
    this.handState = {L: null, R: null}; this.handFilters = {L: new VectorFilter(63, 2, 1), R: new VectorFilter(63, 2, 1)};
    this.face = null; this.faceFilter = new VectorFilter(6, 1.5, 1.5); this.jawFilter = new OneEuro(3, 1);
    this.facing = {yaw: 0, omega: 0, choice: 0, profile: 1, back: false};
    this.depthSign = {}; this.floor = null; this.toes = {L: 0, R: 0};
    this.overlap = {previous: {arms: 'observed', legs: 'observed'}, choice: {arms: 'observed', legs: 'observed'}, preferred: {}, corrections: {}, riskFrames: 0, lastRequest: -1, report: null,
      predicting: {arms: 0, legs: 0}, cooldown: {arms: 0, legs: 0}};
    this.analysisRequest = null; this.history = []; this.lastAnalysis = null; this.projection = null;
    this.chestQ = new Quaternion(); this.pelvisQ = new Quaternion();
    this.cutoff = null;
  }

  setSmoothing(tau) {
    const cutoff = clamp(0.25 / Math.max(0.01, tau), 0.6, 8);
    if (cutoff === this.cutoff) return; this.cutoff = cutoff;
    for (const f of this.coreFilters.values()) f.setCutoff(cutoff);
    for (const st of this.chain.values()) st.filter.setCutoff(cutoff);
    this.faceFilter.setCutoff(cutoff * 1.2); this.handFilters.L.setCutoff(cutoff * 1.3); this.handFilters.R.setCutoff(cutoff * 1.3);
  }

  /** Camera landmarks -> avatar axes (mirrored if asked). Display pixels for 2D checks; visibility drops outside the image. */
  convert(frame, mirror) {
    const W = frame.world, I = frame.image, vw = frame.width || 1280, vh = frame.height || 720;
    const P = new Array(33), img = I ? new Array(33) : null, vis = new Float32Array(33);
    for (let i = 0; i < 33; i++) {
      const src = mirror ? SWAP33[i] : i, w = W[src];
      const ok = w && Number.isFinite(w.x) && Number.isFinite(w.y) && Number.isFinite(w.z);
      P[i] = ok ? new Vector3(mirror ? -w.x : w.x, -w.y, -w.z) : new Vector3();
      let v = ok ? Math.min(w.visibility ?? 1, w.presence ?? 1) : 0;
      const l = I?.[src];
      if (l && Number.isFinite(l.x) && Number.isFinite(l.y)) {
        const u = mirror ? 1 - l.x : l.x;
        img[i] = [u * vw, l.y * vh];
        v = Math.min(v, l.visibility ?? 1, l.presence ?? 1);
        if (u < -0.03 || u > 1.03 || l.y < -0.03 || l.y > 1.03) v = Math.min(v, 0.1);
      } else if (img) img[i] = null;
      vis[i] = v;
    }
    return {P, img, vis, vw, vh};
  }

  bodyFrames(J) {
    const up = normalizeOr(mid(J[11], J[12]).sub(mid(J[23], J[24])), AXIS.Y);
    const lat = normalizeOr(J[11].clone().sub(J[12]), AXIS.X);
    const hipLat = normalizeOr(J[23].clone().sub(J[24]), lat);
    return {chest: basisQ(up, lat) || new Quaternion(), pelvis: basisQ(AXIS.Y, horizontal(lerpDir(lat, hipLat, 0.5))) || new Quaternion(), up, lat};
  }

  // ------------------------------------------------------------------------------------------------ calibration
  /**
   * frames: one or more tracker frames of a relaxed neutral stance. rigLandmarks: rig joint positions in the same landmark layout.
   * options.partial: only part of the body will be driven (for example one arm), so a low-confidence shoulder is accepted.
   * Errors carry a `code` ('noBody' | 'shoulders') so the interface can show translated text.
   */
  calibrate(frames, mirror, rigLandmarks = null, options = {}) {
    this.reset(); this.mirror = mirror;
    const samples = frames.map(normalizeFrame).filter(f => f.world?.length >= 33).map(f => ({frame: f, obs: this.convert(f, mirror)}));
    if (!samples.length) throw Object.assign(new Error('No body was detected. Step back so your shoulders and hips are in view, then calibrate.'), {code: 'noBody'});
    const ref = (rigLandmarks || []).length === 33 ? rigLandmarks.map((p, i) => p ? p.clone() : DEFAULT_SKELETON[i].clone()) : DEFAULT_SKELETON.map(v => v.clone());
    let usable = samples.filter(s => s.obs.vis[11] > 0.5 && s.obs.vis[12] > 0.5);
    if (!usable.length && options.partial) usable = samples;
    if (!usable.length) throw Object.assign(new Error('Keep both shoulders visible and face the camera, then calibrate again.'), {code: 'shoulders'});
    const up = average(usable.map(s => mid(s.obs.P[11], s.obs.P[12]).sub(mid(s.obs.P[23], s.obs.P[24])).normalize())).normalize();
    const lat = average(usable.map(s => s.obs.P[11].clone().sub(s.obs.P[12]).normalize())).normalize();
    const refUp = normalizeOr(mid(ref[11], ref[12]).sub(mid(ref[23], ref[24])), AXIS.Y), refLat = normalizeOr(ref[11].clone().sub(ref[12]), AXIS.X);
    const q = deltaQ(up, lat, refUp, refLat);

    const lengths = {};
    for (const [key, [a, b]] of Object.entries(BONE_PAIRS)) {
      const values = samples.filter(s => s.obs.vis[a] > 0.6 && s.obs.vis[b] > 0.6).map(s => s.obs.P[a].distanceTo(s.obs.P[b]));
      if (values.length) lengths[key] = median(values);
    }
    const neutral = new Array(33).fill(null);
    for (let i = 0; i < 33; i++) {
      const points = samples.filter(s => s.obs.vis[i] > 0.5).map(s => s.obs.P[i].clone().applyQuaternion(q));
      if (points.length) neutral[i] = average(points);
    }
    const coverage = {arms: [13, 14, 15, 16].every(i => neutral[i]), knees: Boolean(neutral[25] && neutral[26]), ankles: Boolean(neutral[27] && neutral[28]),
      feet: [29, 30, 31, 32].every(i => neutral[i]), head: [0, 7, 8].every(i => neutral[i])};

    // Fill what the camera could not see from the rig's own proportions, scaled to this person.
    const refLength = key => ref[BONE_PAIRS[key][0]].distanceTo(ref[BONE_PAIRS[key][1]]);
    const scale = lengths.shoulders ? clamp(lengths.shoulders / Math.max(1e-3, refLength('shoulders')), 0.6, 1.6) : 1;
    for (const [side, hip, ankle] of [['L', 23, 27], ['R', 24, 28]]) {
      if ((!lengths['thigh' + side] || !lengths['shin' + side]) && neutral[hip] && neutral[ankle]) {
        const leg = neutral[hip].distanceTo(neutral[ankle]), t = refLength('thigh' + side), s = refLength('shin' + side);
        lengths['thigh' + side] ??= leg * t / (t + s); lengths['shin' + side] ??= leg * s / (t + s);
      }
    }
    for (const key of Object.keys(BONE_PAIRS)) lengths[key] ??= refLength(key) * scale;
    for (const i of CORE) neutral[i] ??= ref[i].clone().multiplyScalar(scale);
    for (const [j, parent, , key] of CHAIN) {
      if (neutral[j]) continue;
      const parentNeutral = parent === 'neck' ? mid(neutral[11], neutral[12]) : neutral[parent];
      const parentRef = parent === 'neck' ? mid(ref[11], ref[12]) : ref[parent];
      const offset = ref[j].clone().sub(parentRef);
      neutral[j] = parentNeutral.clone().add(key ? offset.normalize().multiplyScalar(lengths[key]) : offset.multiplyScalar(scale));
    }
    const frames0 = this.bodyFrames(neutral);
    this.prior = new Map();
    for (const [j, parent, frameName] of CHAIN) {
      const parentPos = parent === 'neck' ? mid(neutral[11], neutral[12]) : neutral[parent];
      this.prior.set(j, neutral[j].clone().sub(parentPos).applyQuaternion((frameName === 'chest' ? frames0.chest : frames0.pelvis).clone().invert()));
    }
    const faces = samples.map(s => faceFrame(s.frame.face?.points, mirror, s.frame.width, s.frame.height, q)).filter(Boolean);
    const face = faces.length ? {L: average(faces.map(f => f.L)).normalize(), U: average(faces.map(f => f.U)).normalize()} : null;
    const run = (h, t) => Math.hypot(neutral[t].x - neutral[h].x, neutral[t].z - neutral[h].z);
    const footPitch = {L: Math.atan2(neutral[29].y - neutral[31].y, Math.max(0.03, run(29, 31))), R: Math.atan2(neutral[30].y - neutral[32].y, Math.max(0.03, run(30, 32)))};
    const NOTES = {arms: 'Arms were not fully visible, so the model\'s own arm pose is used as neutral.',
      knees: 'Knees were hidden (for example by a dress or coat); they will be inferred from hips and ankles.',
      feet: 'Feet were out of view, so a standing leg pose is assumed until they appear.'};
    const noteCodes = [];
    if (!coverage.arms) noteCodes.push('arms');
    if (!coverage.knees && coverage.ankles) noteCodes.push('knees');
    if (!coverage.ankles) noteCodes.push('feet');
    const notes = noteCodes.map(code => NOTES[code]);
    this.cal = {q, lengths, neutral, mirror, coverage, shoulderWidth: lengths.shoulders, face, footPitch, scale, notes, noteCodes};
    this.J = neutral.map(v => v.clone());
    return this.cal;
  }

  // ------------------------------------------------------------------------------------------------ per frame
  ingest(input, mirror, dt = 1 / 30, options = {}) {
    if (!this.cal) return null;
    const opt = {hands: true, face: true, predict: true, overlap: true, analysis: true, toes: true, ...options};
    dt = Math.max(1e-3, Number.isFinite(dt) ? dt : 1 / 30);
    this.clock += dt; this.mirror = mirror;
    const frame = normalizeFrame(input);
    if (!frame.world || frame.world.length < 33) { this.tracked = 0; return null; }
    this.tracked += dt;
    const fresh = clamp(this.tracked / 0.5, 0, 1);
    const obs = this.convert(frame, mirror);
    if (opt.predict) this.resolveFacing(obs, frame, dt); else this.facing.choice = 0;
    this.fixDepth(obs);
    for (const p of obs.P) p.applyQuaternion(this.cal.q);
    const evidence = opt.hands ? this.hands.evidence(frame.hands, mirror, obs.vw, obs.vh) : {L: null, R: null};
    this.updateCore(obs, dt);
    const pred = this.predictLimbs(Math.min(dt, 0.25));
    const raw = cloneObservation(obs);
    if (opt.overlap) this.resolveOverlap(obs, pred, evidence, frame, dt, fresh, opt);
    else { this.overlap.report = null; this.overlap.choice = {arms: 'observed', legs: 'observed'}; }
    this.updateChains(obs, dt, opt);
    this.applyConstraints();
    this.updateHands(frame, obs, mirror, dt, opt);
    this.updateFace(frame, mirror, dt, opt);
    this.updateFeet(dt, opt);
    this.projection = fitProjection(this.J, obs.img, obs.vis, 0.6);
    this.pushHistory(frame, raw, pred, evidence, dt);
    return this.output();
  }

  /** Spins: pick the reading (as labelled, or back-facing) that keeps the turn continuous and agrees with the face. */
  resolveFacing(obs, frame, dt) {
    const q = this.cal.q, F = this.facing;
    const lat0 = obs.P[11].clone().sub(obs.P[12]).applyQuaternion(q);
    const lat1 = obs.P[12].clone().sub(obs.P[11]); lat1.z = -lat1.z; lat1.applyQuaternion(q);
    const yaw0 = yawFromLateral(lat0), yaw1 = yawFromLateral(lat1);
    const profile = clamp(Math.hypot(lat0.x, lat0.z) / Math.max(0.1, this.cal.shoulderWidth || 0.33), 0, 1.2);
    const faceSeen = Boolean(frame.face?.points?.length);
    const headVis = (obs.vis[0] + obs.vis[2] + obs.vis[5]) / 3, shoulderVis = Math.min(obs.vis[11], obs.vis[12]);
    const predicted = F.yaw + F.omega * Math.min(dt, 0.25);
    const cost = (yaw, k) => {
      let c = (angleBetween(yaw, predicted) / 0.7) ** 2;
      if (faceSeen && Math.abs(wrapAngle(yaw)) > 1.75) c += 4;
      if (!faceSeen && headVis < 0.45 && shoulderVis > 0.6 && profile > 0.45 && Math.abs(wrapAngle(yaw)) < 1.4) c += 2.5;
      if (k !== F.choice) c += 0.6;
      return c;
    };
    const choice = cost(yaw1, 1) < cost(yaw0, 0) ? 1 : 0;
    if (choice === 1) reflectAndSwap(obs);
    const measured = choice ? yaw1 : yaw0, before = F.yaw;
    const weight = profile < 0.35 ? 0.15 : 0.6;
    F.yaw = predicted + weight * wrapAngle(measured - predicted);
    const omega = wrapAngle(F.yaw - before) / dt;
    F.omega = clamp(F.omega + (omega - F.omega) * (1 - Math.exp(-dt / 0.12)), -12, 12) * Math.exp(-dt / 1.5);
    F.choice = choice; F.profile = profile; F.back = Math.abs(wrapAngle(F.yaw)) > Math.PI / 2;
  }

  /** MediaPipe depth is the weakest axis; when a limb is foreshortened, restore depth so its length matches calibration. */
  fixDepth(obs) {
    const lengths = this.cal.lengths;
    for (const [key, a, b] of LIMB_BONES) {
      const L = lengths[key]; if (!L || obs.vis[a] < 0.6 || obs.vis[b] < 0.6) continue;
      const d = obs.P[b].clone().sub(obs.P[a]), planar = d.x * d.x + d.y * d.y;
      if (planar >= L * L * 0.97) continue;
      let sign = this.depthSign[key];
      if (Math.abs(d.z) > 0.25 * L || sign === undefined) sign = Math.sign(d.z) || 1;
      this.depthSign[key] = sign;
      const shift = (sign * Math.sqrt(L * L - planar) - d.z) * 0.5;
      for (const j of [b, ...(DESCENDANTS[b] || [])]) obs.P[j].z += shift;
    }
  }

  updateCore(obs, dt) {
    for (const i of CORE) {
      const v = this.coreFilters.get(i).filter(obs.P[i].toArray(), dt);
      this.J[i].set(v[0], v[1], v[2]); this.conf[i] = seg(obs.vis[i]); this.status[i] = 'seen';
    }
    const frames = this.bodyFrames(this.J); this.chestQ = frames.chest; this.pelvisQ = frames.pelvis;
  }

  frameFor(name) { return name === 'chest' ? this.chestQ : this.pelvisQ; }
  parentPosition(parent, J = this.J) { return parent === 'neck' ? mid(J[11], J[12]) : J[parent]; }

  predictLimbs(step) {
    const P = this.J.map(v => v.clone());
    for (const [j, parent, frameName] of CHAIN) {
      const st = this.chain.get(j);
      if (!st.rel) { P[j] = null; continue; }
      const base = this.parentPosition(parent, P); if (!base) { P[j] = null; continue; }
      P[j] = base.clone().add(st.rel.clone().addScaledVector(st.vel, step).applyQuaternion(this.frameFor(frameName)));
    }
    return P;
  }

  torsoBox() {
    const sh = mid(this.J[11], this.J[12]), hip = mid(this.J[23], this.J[24]);
    const up = normalizeOr(sh.clone().sub(hip), AXIS.Y), lateral = normalizeOr(this.J[11].clone().sub(this.J[12]), AXIS.X);
    const forward = lateral.clone().cross(up).normalize(), height = sh.distanceTo(hip);
    return {center: mid(sh, hip), lateral, up, forward, halfWidth: this.J[11].distanceTo(this.J[12]) / 2, top: height / 2, bottom: -height / 2};
  }

  resolveOverlap(obs, pred, evidence, frame, dt, fresh, opt) {
    const O = this.overlap;
    const shoulderPx = obs.img?.[11] && obs.img?.[12] ? dist2(obs.img[11], obs.img[12]) : 0;
    const fit = fitProjection(obs.P, obs.img, obs.vis);
    const ctx = {lengths: this.cal.lengths, pred, fresh, dt, handWrists: evidence, shoulderPx, torso: this.torsoBox()};
    const report = assessOverlap(obs, ctx); O.report = report;
    for (const group of ['arms', 'legs']) {
      const pref = O.preferred[group], prefActive = pref && pref.until > this.clock;
      const corr = O.corrections[group], corrActive = corr && corr.until > this.clock;
      const risk = Math.max(report[group].risk, prefActive || corrActive ? 0.5 : 0);
      if (risk < 0.35) { O.choice[group] = O.previous[group] = 'observed'; continue; }
      const joints = GROUPS[group].joints;
      const candidates = [{...obs, name: 'observed', kind: 'observed'}];
      for (const [name, pairs] of Object.entries(SWAPS[group])) candidates.push({...swapPairs(obs, pairs), name, kind: 'swap'});
      // Prediction may override a visible limb only briefly; otherwise a real fast move could lock the limb in place.
      O.cooldown[group] = Math.max(0, O.cooldown[group] - dt);
      if (opt.predict && fresh > 0.5 && O.cooldown[group] === 0 && joints.every(j => pred[j])) {
        const c = cloneObservation(obs);
        for (const j of joints) { c.P[j].copy(pred[j]); c.vis[j] = 0; if (c.img) c.img[j] = fit ? project(fit, pred[j]) : c.img[j]; }
        candidates.push({...c, name: 'predicted', kind: 'predicted'});
      }
      if (corrActive) {
        const c = cloneObservation(obs);
        applyRelative(c.P, joints, corr.deltas, this.frameFor(group === 'arms' ? 'chest' : 'pelvis'));
        if (c.img && fit) for (const j of joints) c.img[j] = project(fit, c.P[j]);
        candidates.push({...c, name: 'analysis', kind: 'analysis'});
      }
      const preferred = prefActive ? pref.name : corrActive ? 'analysis' : null;
      const {best} = chooseCandidate(candidates, {...ctx, previous: O.previous[group], preferred}, group);
      O.previous[group] = O.choice[group] = best.name;
      O.predicting[group] = best.kind === 'predicted' ? O.predicting[group] + dt : 0;
      if (O.predicting[group] > 0.2) { O.cooldown[group] = 0.4; O.predicting[group] = 0; }
      if (best.name !== 'observed') {
        for (const j of joints) {
          obs.P[j].copy(best.P[j]); if (obs.img && best.img) obs.img[j] = best.img[j];
          obs.vis[j] = best.kind === 'predicted' ? 0 : best.vis[j];
        }
      }
    }
    O.riskFrames = report.max >= 0.4 ? O.riskFrames + 1 : 0;
    if (opt.analysis && O.riskFrames >= 2 && obs.img && this.clock - O.lastRequest > 0.25) {
      const roi = this.regionOfInterest(obs, pred, fit);
      if (roi) { this.analysisRequest = {roi, timestamp: frame.timestamp}; O.lastRequest = this.clock; }
    }
  }

  /** Crop around the person (raw camera coordinates, 0..1) for the heavy-model re-analysis. */
  regionOfInterest(obs, pred, fit) {
    const xs = [], ys = [];
    for (let i = 0; i < 33; i++) {
      if (obs.img[i] && obs.vis[i] > 0.3) { xs.push(obs.img[i][0]); ys.push(obs.img[i][1]); }
      else if (fit && pred[i]) { const p = project(fit, pred[i]); xs.push(p[0]); ys.push(p[1]); }
    }
    if (xs.length < 6) return null;
    let x0 = Math.min(...xs) / obs.vw, x1 = Math.max(...xs) / obs.vw, y0 = Math.min(...ys) / obs.vh, y1 = Math.max(...ys) / obs.vh;
    const padX = (x1 - x0) * 0.25 + 0.03, padY = (y1 - y0) * 0.15 + 0.03;
    x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
    if (this.mirror) [x0, x1] = [1 - x1, 1 - x0];
    x0 = clamp(x0, 0, 1); x1 = clamp(x1, 0, 1); y0 = clamp(y0, 0, 1); y1 = clamp(y1, 0, 1);
    if (x1 - x0 < 0.08 || y1 - y0 < 0.08) return null;
    return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
  }

  updateChains(obs, dt, opt) {
    const step = Math.min(dt, 0.25), kConf = 1 - Math.exp(-dt / 0.12), kVel = 1 - Math.exp(-dt / 0.1);
    const velDecay = Math.exp(-dt / 0.35), kPrior = 1 - Math.exp(-dt / 0.8);
    for (const [j, parent, frameName] of CHAIN) {
      const st = this.chain.get(j), q = this.frameFor(frameName), qi = q.clone().invert();
      const parentPos = this.parentPosition(parent);
      const w = seg(obs.vis[j]);
      st.conf += (w - st.conf) * kConf;
      const relObs = obs.P[j].clone().sub(parentPos).applyQuaternion(qi);
      const prior = this.prior.get(j);
      if (!st.rel) {
        st.rel = w > 0.15 ? relObs.clone() : prior.clone(); st.vel.set(0, 0, 0); st.filter.reset();
        if (w > 0.15) st.filter.filter(relObs.toArray(), dt);
        st.conf = w;
      } else if (w > 0.15) {
        const previous = st.rel.clone();
        const filtered = new Vector3(...st.filter.filter(relObs.toArray(), dt));
        const predicted = opt.predict ? st.rel.clone().addScaledVector(st.vel, step) : st.rel.clone();
        st.rel = predicted.lerp(filtered, clamp(st.conf / 0.6, 0, 1));
        st.vel.lerp(st.rel.clone().sub(previous).divideScalar(dt), kVel);
        st.missing = 0;
      } else {
        st.missing += dt;
        if (st.missing > 0.2) st.filter.reset();
        if (opt.predict) {
          st.rel.addScaledVector(st.vel, step); st.vel.multiplyScalar(velDecay);
          if (st.missing > 0.35) st.rel.lerp(prior, kPrior);
        }
      }
      this.J[j] = parentPos.clone().add(st.rel.clone().applyQuaternion(q));
      this.conf[j] = st.conf;
      this.status[j] = w > 0.15 ? 'seen' : opt.predict ? (st.missing > 0.35 ? 'prior' : 'predicted') : 'held';
    }
  }

  pole(ik) {
    const {up, lateral, forward} = this.torsoBox();
    if (ik.kind === 'arm') return forward.clone().multiplyScalar(-0.5).addScaledVector(lateral, 0.6 * ik.side).addScaledVector(up, -0.2);
    const pelvisForward = new Vector3(0, 0, 1).applyQuaternion(this.pelvisQ.clone().multiply(basisQ(AXIS.Y, AXIS.X).invert()));
    return pelvisForward.addScaledVector(lateral, 0.08 * ik.side);
  }

  applyConstraints() {
    const L = this.cal.lengths;
    for (const ik of IK) {
      const cm = this.chain.get(ik.mid).conf, ce = this.chain.get(ik.end).conf;
      if (cm >= 0.45 || ce < 0.5) continue;
      const solved = twoBoneIK(this.J[ik.root], this.J[ik.end], L[ik.a], L[ik.b], this.pole(ik));
      if (!solved) continue;
      this.J[ik.mid].lerp(solved, 1 - cm / 0.45);
      if (this.status[ik.mid] !== 'seen') this.status[ik.mid] = 'inferred';
    }
    for (const [key, a, b] of LIMB_BONES) {
      const len = L[key]; if (!len) continue;
      const d = this.J[b].clone().sub(this.J[a]), n = d.length(); if (n < 1e-6) continue;
      const move = d.multiplyScalar(len / n - 1);
      this.J[b].add(move); for (const k of DESCENDANTS[b] || []) this.J[k].add(move);
    }
    for (const [j, parent, frameName] of CHAIN) {
      this.chain.get(j).rel = this.J[j].clone().sub(this.parentPosition(parent)).applyQuaternion(this.frameFor(frameName).clone().invert());
    }
  }

  updateHands(frame, obs, mirror, dt, opt) {
    if (!opt.hands) { this.handState = {L: null, R: null}; return; }
    const shoulderPx = obs.img?.[11] && obs.img?.[12] ? dist2(obs.img[11], obs.img[12]) : 0;
    const assigned = this.hands.assign(frame.hands, {wrists: {L: obs.img?.[15] || null, R: obs.img?.[16] || null}, wristConf: {L: obs.vis[15], R: obs.vis[16]},
      shoulderPx, mirror, vw: obs.vw, vh: obs.vh});
    for (const side of ['L', 'R']) {
      const hand = assigned[side];
      if (hand) {
        const flat = handToAvatar(hand.worldLandmarks, mirror, this.cal.q).flatMap(p => [p.x, p.y, p.z]);
        const f = this.handFilters[side].filter(flat, dt), points = [];
        for (let k = 0; k < 21; k++) points.push(new Vector3(f[3 * k], f[3 * k + 1], f[3 * k + 2]));
        this.handState[side] = {points, score: hand.score ?? 1, seen: this.clock, image: hand.landmarks};
      } else if (this.handState[side] && this.clock - this.handState[side].seen > 0.3) {
        this.handState[side] = null; this.handFilters[side].reset();
      }
    }
  }

  updateFace(frame, mirror, dt, opt) {
    const face = opt.face && this.facing.choice === 0 ? faceFrame(frame.face?.points, mirror, frame.width, frame.height, this.cal.q) : null;
    if (face) {
      const v = this.faceFilter.filter([face.L.x, face.L.y, face.L.z, face.U.x, face.U.y, face.U.z], dt);
      const jaw = this.jawFilter.filter(clamp(frame.face.blendshapes?.jawOpen ?? 0, 0, 1), dt);
      this.face = {L: new Vector3(v[0], v[1], v[2]).normalize(), U: new Vector3(v[3], v[4], v[5]).normalize(), jaw, seen: this.clock, image: frame.face.points};
    } else if (this.face && this.clock - this.face.seen > 0.35) { this.face = null; this.faceFilter.reset(); this.jawFilter.reset(); }
  }

  /** Predictive toes: when the heel lifts while the ball of the foot stays down, the toes bend to stay on the floor. */
  updateFeet(dt, opt) {
    const lowest = Math.min(this.J[29].y, this.J[30].y, this.J[31].y, this.J[32].y);
    if (this.floor === null) this.floor = lowest;
    else this.floor += (lowest - this.floor) * (1 - Math.exp(-dt / (lowest < this.floor ? 0.05 : 0.8)));
    for (const [side, heel, toe] of [['L', 29, 31], ['R', 30, 32]]) {
      let target = 0;
      const seen = Math.min(this.conf[heel], this.conf[toe]) > 0.3;
      if (opt.toes && seen) {
        const h = this.J[heel], t = this.J[toe], run = Math.hypot(t.x - h.x, t.z - h.z);
        const heelLift = h.y - this.floor, toeLift = t.y - this.floor;
        const pitch = Math.atan2(h.y - t.y, Math.max(0.03, run)) - (this.cal.footPitch?.[side] || 0);
        if (toeLift < 0.03 && heelLift > 0.035 && run > 0.03) target = clamp(pitch, 0, 1);
        else if (toeLift > 0.05 && heelLift > 0.05) target = -0.12;
      }
      this.toes[side] = approach(this.toes[side], target, dt, 0.12);
    }
  }

  pushHistory(frame, raw, pred, evidence, dt) {
    if (!Number.isFinite(frame.timestamp)) return;
    this.history.push({t: frame.timestamp, obs: raw, pred, evidence, choice: this.facing.choice, chest: this.chestQ.clone(), pelvis: this.pelvisQ.clone(), vw: raw.vw, vh: raw.vh, dt});
    if (this.history.length > 40) this.history.shift();
  }

  takeAnalysisRequest() { const r = this.analysisRequest; this.analysisRequest = null; return r; }

  /** Deep pass result (heavy model on a crop + person silhouette) for an earlier frame: score it against the live reading. */
  ingestAnalysis(result, mirror) {
    if (!this.cal || !result?.worldLandmarks?.length) return null;
    let entry = null;
    for (const h of this.history) if (!entry || Math.abs(h.t - result.timestamp) < Math.abs(entry.t - result.timestamp)) entry = h;
    if (!entry || Math.abs(entry.t - result.timestamp) > 80) return null;
    const heavy = this.convert({world: result.worldLandmarks, image: result.landmarks, width: entry.vw, height: entry.vh}, mirror);
    if (entry.choice === 1) reflectAndSwap(heavy);
    this.fixDepth(heavy);
    for (const p of heavy.P) p.applyQuaternion(this.cal.q);
    const sample = maskSampler(result.mask, result.roi, mirror, entry.vw, entry.vh);
    const base = entry.obs;
    const shoulderPx = base.img?.[11] && base.img?.[12] ? dist2(base.img[11], base.img[12]) : 0;
    const summary = {};
    for (const group of ['arms', 'legs']) {
      const candidates = [{...base, name: 'observed', kind: 'observed'}, {...heavy, name: 'heavy', kind: 'heavy'}];
      for (const [name, pairs] of Object.entries(SWAPS[group])) {
        candidates.push({...swapPairs(base, pairs), name, kind: 'swap'});
        candidates.push({...swapPairs(heavy, pairs), name: 'heavy-' + name, kind: 'swap'});
      }
      const ctx = {lengths: this.cal.lengths, pred: entry.pred, fresh: 1, dt: entry.dt, handWrists: entry.evidence, shoulderPx, sample, torso: this.torsoBox()};
      const {best, margin} = chooseCandidate(candidates, ctx, group);
      summary[group] = best.name;
      if (best.name === 'observed' || margin < 0.3) continue;
      const inverse = (group === 'arms' ? entry.chest : entry.pelvis).clone().invert(), deltas = {};
      for (const j of GROUPS[group].joints) deltas[j] = relativeVector(best.P, j, inverse).sub(relativeVector(base.P, j, inverse));
      this.overlap.corrections[group] = {deltas, until: this.clock + 0.6, source: best.name};
      if (SWAPS[group][best.name]) this.overlap.preferred[group] = {name: best.name, until: this.clock + 0.6};
      this.analysisFixes++;
    }
    this.lastAnalysis = {summary, at: this.clock};
    return summary;
  }

  output() {
    const freshFace = this.face && this.clock - this.face.seen < 0.35 ? this.face : null;
    return {J: this.J, conf: this.conf, status: this.status, hands: this.handState, face: freshFace, facing: {...this.facing}, floor: this.floor, toes: {...this.toes},
      overlap: {report: this.overlap.report, choice: {...this.overlap.choice}}, analysisFixes: this.analysisFixes, lastAnalysis: this.lastAnalysis,
      projection: this.projection || null};
  }
}
