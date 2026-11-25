// Hand landmarker results -> which avatar hand they belong to, plus the finger joint limits.
import {Quaternion, Vector3} from '../../vendor/three/three.module.js';
import {clamp} from './frames.js';

/** Rig finger chains: finger1 = thumb ... finger5 = little finger, with the hand-landmark indices along each. */
export const FINGER_CHAINS = [
  {finger: 1, bones: ['proximal', 'distal'], points: [2, 3, 4]},
  {finger: 2, bones: ['proximal', 'middle', 'distal'], points: [5, 6, 7, 8]},
  {finger: 3, bones: ['proximal', 'middle', 'distal'], points: [9, 10, 11, 12]},
  {finger: 4, bones: ['proximal', 'middle', 'distal'], points: [13, 14, 15, 16]},
  {finger: 5, bones: ['proximal', 'middle', 'distal'], points: [17, 18, 19, 20]},
];
/** Joint limits in radians, relative to the rig's rest curl. flex = toward the palm, splay = sideways. */
export function fingerLimits(finger, segment) {
  if (finger === 1) return segment === 0 ? {cone: 1.25} : {cone: 1.35};
  if (segment === 0) return {flex: [-0.5, 1.6], splay: 0.38};
  if (segment === 1) return {flex: [-0.1, 1.9], splay: 0};
  return {flex: [-0.1, 1.4], splay: 0};
}
const X_AXIS = new Vector3(1, 0, 0);
function limitRotation(q, max) {
  const angle = 2 * Math.acos(clamp(Math.abs(q.w), 0, 1));
  return angle > max ? new Quaternion().slerp(q, max / angle) : q;
}
/**
 * Local rotation of a finger bone that turns its rest segment direction `segment` toward `target`
 * (both bone-local). Fingers flex about the bone's local X axis (the rig's hinge); knuckles may also swing
 * sideways a little; the thumb is limited to a cone. `palmar` is +1 when +X rotation bends toward the palm.
 */
export function fingerRotation(segment, target, limits, palmar = 1) {
  if (limits.cone !== undefined) return limitRotation(new Quaternion().setFromUnitVectors(segment, target.clone().normalize()), limits.cone);
  const a = new Vector3(0, segment.y, segment.z), b = new Vector3(0, target.y, target.z);
  let flex = a.lengthSq() > 1e-10 && b.lengthSq() > 1e-10 ? Math.atan2(a.clone().cross(b).x, a.dot(b)) : 0;
  flex = palmar * clamp(palmar * flex, limits.flex[0], limits.flex[1]);
  const hinge = new Quaternion().setFromAxisAngle(X_AXIS, flex);
  if (!(limits.splay > 0)) return hinge;
  const bent = segment.clone().applyQuaternion(hinge);
  return limitRotation(new Quaternion().setFromUnitVectors(bent, target.clone().normalize()), limits.splay).multiply(hinge);
}

/** Hand world landmarks (metres, camera axes) -> avatar axes, optionally mirrored and rotated by the calibration. */
export function handToAvatar(world, mirror, rotation) {
  return world.map(p => {
    const v = new Vector3(mirror ? -p.x : p.x, -p.y, -p.z);
    return rotation ? v.applyQuaternion(rotation) : v;
  });
}
/** Palm frame: along the hand (wrist -> middle knuckle) and across it (little-finger knuckle -> index knuckle). */
export function palmFrame(points) {
  return [points[9].clone().sub(points[0]), points[5].clone().sub(points[17])];
}

const other = side => side === 'L' ? 'R' : 'L';

/**
 * Matches detected hands to avatar sides. Primary cue: distance to the body tracker's wrists.
 * Secondary cue: the hand model's handedness label. On raw (unmirrored) camera frames the bundled model labels the
 * real hand (checked on Google's two-right-hands sample), but the convention is still learned online from
 * unambiguous frames, so a model that reports mirrored labels is handled too.
 */
export class HandAssigner {
  constructor(flipPrior = false) { this.flipScore = flipPrior ? 3 : -3; }
  get flip() { return this.flipScore > 0; }
  get labelTrust() { return Math.min(1, Math.abs(this.flipScore) / 6); }
  /** Avatar side implied by the label alone. */
  labelSide(hand, mirror) {
    const label = String(hand.handedness || '').toLowerCase().startsWith('l') ? 'L' : 'R';
    const person = this.flip ? other(label) : label;
    return mirror ? other(person) : person;
  }
  /** Display-pixel wrist position of a detected hand. */
  static wristPx(hand, mirror, vw, vh) {
    const w = hand.landmarks?.[0]; if (!w) return null;
    return [(mirror ? 1 - w.x : w.x) * vw, w.y * vh];
  }
  /** Label-only evidence (independent of the body tracker) for the overlap check. */
  evidence(hands, mirror, vw, vh) {
    const out = {L: null, R: null};
    if (this.labelTrust < 0.5) return out;
    for (const hand of hands || []) {
      if ((hand.score ?? 1) < 0.85) continue;
      const side = this.labelSide(hand, mirror), px = HandAssigner.wristPx(hand, mirror, vw, vh);
      if (px && !out[side]) out[side] = px;
    }
    return out;
  }
  /** ctx: {wrists {L,R} px|null, wristConf {L,R}, shoulderPx, mirror, vw, vh}. Returns {L: hand|null, R: hand|null}. */
  assign(hands, ctx) {
    const result = {L: null, R: null};
    const list = (hands || []).filter(h => h.worldLandmarks?.length === 21 && h.landmarks?.length === 21);
    if (!list.length) return result;
    const sw = Math.max(30, ctx.shoulderPx || 0);
    const cost = (hand, side) => {
      const px = HandAssigner.wristPx(hand, ctx.mirror, ctx.vw, ctx.vh), wrist = ctx.wrists?.[side];
      let c = 0;
      if (px && wrist && (ctx.wristConf?.[side] ?? 0) > 0.3) c += (Math.hypot(px[0] - wrist[0], px[1] - wrist[1]) / (0.6 * sw)) ** 2;
      else c += 0.8;
      if (this.labelSide(hand, ctx.mirror) !== side) c += 1.5 * (hand.score ?? 1) * (0.4 + 0.6 * this.labelTrust);
      return c;
    };
    if (list.length === 1) {
      const [h] = list, cl = cost(h, 'L'), cr = cost(h, 'R');
      const side = cl <= cr ? 'L' : 'R';
      if (Math.min(cl, cr) < 4) result[side] = h;
      this.learn(h, side, ctx, Math.abs(cl - cr));
    } else {
      const [a, b] = list;
      const direct = cost(a, 'L') + cost(b, 'R'), swapped = cost(a, 'R') + cost(b, 'L');
      const [l, r] = direct <= swapped ? [a, b] : [b, a];
      if (cost(l, 'L') < 4) result.L = l; if (cost(r, 'R') < 4) result.R = r;
    }
    return result;
  }
  /** Learn the label convention only when the geometry makes the true side obvious. */
  learn(hand, side, ctx, margin) {
    const px = HandAssigner.wristPx(hand, ctx.mirror, ctx.vw, ctx.vh);
    const a = ctx.wrists?.[side], b = ctx.wrists?.[other(side)], sw = Math.max(30, ctx.shoulderPx || 0);
    if (!px || !a || !b || (ctx.wristConf?.[side] ?? 0) < 0.7 || (ctx.wristConf?.[other(side)] ?? 0) < 0.7) return;
    if (Math.hypot(px[0] - a[0], px[1] - a[1]) > 0.35 * sw || Math.hypot(px[0] - b[0], px[1] - b[1]) < 1.0 * sw || margin < 1) return;
    const person = ctx.mirror ? other(side) : side;
    const label = String(hand.handedness || '').toLowerCase().startsWith('l') ? 'L' : 'R';
    this.flipScore = clamp(this.flipScore + (label === person ? -1 : 1), -20, 20);
  }
}
