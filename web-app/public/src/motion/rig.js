// Reads what the solver needs from the loaded skeleton: rest orientations, joint positions laid out like the
// tracker's landmarks, palm frames, finger bend directions and the bone hierarchy order.
import {Vector3} from '../../vendor/three/three.module.js';
import {AXIS, basisQ, horizontal, mid} from './frames.js';

const LANDMARK_BONES = {11: 'upper_arm.L', 12: 'upper_arm.R', 13: 'forearm.L', 14: 'forearm.R', 15: 'hand.L', 16: 'hand.R',
  17: 'finger5.proximal.L', 18: 'finger5.proximal.R', 19: 'finger2.proximal.L', 20: 'finger2.proximal.R', 21: 'finger1.proximal.L', 22: 'finger1.proximal.R',
  23: 'thigh.L', 24: 'thigh.R', 25: 'shin.L', 26: 'shin.R', 27: 'foot.L', 28: 'foot.R'};

export function describeRig(viewer) {
  viewer.resetPose?.(); viewer.model?.updateMatrixWorld(true);
  const bones = viewer.bones, rest = viewer.rest;
  const pos = name => bones.get(name)?.getWorldPosition(new Vector3()) || null;
  let landmarks = new Array(33).fill(null);
  for (const [i, name] of Object.entries(LANDMARK_BONES)) landmarks[i] = pos(name);
  for (const [s, ankle, heel, toe] of [['L', 27, 29, 31], ['R', 28, 30, 32]]) {
    const a = landmarks[ankle], t = pos(`toe2.proximal.${s}`) || pos(`toe1.proximal.${s}`);
    if (a && t) { landmarks[heel] = new Vector3(a.x, t.y, a.z - 0.055); landmarks[toe] = t.clone().addScaledVector(horizontal(t.clone().sub(a)), 0.045); }
  }
  const head = pos('head');
  if (head) {
    const at = (x, y, z) => head.clone().add(new Vector3(x, y, z));
    Object.assign(landmarks, {0: at(0, 0.07, 0.1), 1: at(0.015, 0.1, 0.085), 2: at(0.032, 0.1, 0.08), 3: at(0.047, 0.1, 0.075), 4: at(-0.015, 0.1, 0.085),
      5: at(-0.032, 0.1, 0.08), 6: at(-0.047, 0.1, 0.075), 7: at(0.075, 0.08, 0), 8: at(-0.075, 0.08, 0), 9: at(0.025, 0.03, 0.09), 10: at(-0.025, 0.03, 0.09)});
  }
  const valid = landmarks[11] && landmarks[12] && landmarks[23] && landmarks[24] && landmarks[11].distanceTo(landmarks[12]) > 0.05 &&
    mid(landmarks[11], landmarks[12]).distanceTo(mid(landmarks[23], landmarks[24])) > 0.1;
  if (valid) { const hip = mid(landmarks[23], landmarks[24]); for (const p of landmarks) p?.sub(hip); } else landmarks = null;

  const palm = {}, handPose = {}, palmar = {}, axis = {};
  for (const s of ['L', 'R']) {
    const h = pos(`hand.${s}`), f2 = pos(`finger2.proximal.${s}`), f3 = pos(`finger3.proximal.${s}`), f5 = pos(`finger5.proximal.${s}`);
    if (h && f2 && f3 && f5 && f2.distanceTo(f5) > 1e-3) {
      palm[s] = {q0: basisQ(f3.clone().sub(h), f2.clone().sub(f5))};
      handPose[s] = [mid(f2, f5).sub(h), f2.clone().sub(f5)];
    }
    palmar[s] = {};
    for (let f = 1; f <= 5; f++) {
      const r = rest.get(`finger${f}.${f === 1 ? 'distal' : 'middle'}.${s}`);
      if (r) palmar[s][f] = AXIS.Y.clone().applyQuaternion(r.quaternion).z < -1e-3 ? -1 : 1;
    }
  }
  for (const name of ['forearm.L', 'forearm.R', 'upper_arm.L', 'upper_arm.R']) { const r = rest.get(name); if (r?.world) axis[name] = AXIS.Y.clone().applyQuaternion(r.world).normalize(); }
  // Finger bone axes do not point exactly at the next joint in this rig, so keep each segment's rest direction (bone-local).
  const segment = {};
  for (const s of ['L', 'R']) for (let f = 1; f <= 5; f++) {
    const names = (f === 1 ? ['proximal', 'distal'] : ['proximal', 'middle', 'distal']).map(n => `finger${f}.${n}.${s}`);
    names.forEach((name, k) => {
      const child = rest.get(names[k + 1]);
      segment[name] = child && child.position.lengthSq() > 1e-10 ? child.position.clone().normalize() : AXIS.Y.clone();
    });
  }
  const depth = bone => { let d = 0, p = bone.parent; while (p) { d++; p = p.parent; } return d; };
  const order = [...bones.entries()].sort((a, b) => depth(a[1]) - depth(b[1]));
  return {bones, rest, landmarks, palm, handPose, palmar, axis, segment, order};
}
