// Landmarks -> bone rotations. This is the Ranma VTuber solve() rebuilt for the INNOVA skeleton:
// frames are (primary, secondary) direction pairs, the elbow/knee hinge keeps limb twist stable,
// and every segment is solved relative to the person's calibrated neutral stance.
import {Quaternion} from '../../vendor/three/three.module.js';
import {AXIS, basisQ, deltaQ, frameDelta, lerpDir, horizontal, limitTo, swingTwist, normalizeOr, clamp, seg, mid} from './frames.js';
import {FINGER_CHAINS, fingerLimits, fingerRotation, palmFrame} from './hands.js';

const SIDES = [
  ['L', 1, {sh: 11, el: 13, wr: 15, pinky: 17, index: 19, hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31}],
  ['R', -1, {sh: 12, el: 14, wr: 16, pinky: 18, index: 20, hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32}],
];

/** Elbow/knee hinge: the bend plane when the limb is bent, a sensible default bend direction when it is straight. */
function hingeAxis(a, f, preferred) {
  const n = a.clone().cross(f), nl = n.length();
  let fallback = preferred.clone();
  if (fallback.lengthSq() < 1e-10) fallback = a.clone().cross(AXIS.Y.clone().addScaledVector(AXIS.Z, 0.3));
  fallback.normalize();
  if (n.dot(fallback) < 0) n.negate();
  const wn = clamp((nl - 0.08) / 0.3, 0, 1);
  return (nl > 1e-6 ? n.normalize() : n).multiplyScalar(wn).addScaledVector(fallback, 1 - wn);
}

export function extractFrames(J, conf = null) {
  const c = i => (conf ? conf[i] : 1);
  const up = normalizeOr(mid(J[11], J[12]).sub(mid(J[23], J[24])), AXIS.Y);
  const shLat = normalizeOr(J[11].clone().sub(J[12]), AXIS.X);
  const hipW = seg(Math.min(c(23), c(24)));
  const hipLat = lerpDir(horizontal(shLat), normalizeOr(J[23].clone().sub(J[24]), horizontal(shLat)), hipW);
  const F = {};
  F.pelvis = [lerpDir(AXIS.Y, up, 0.5 + 0.4 * hipW), hipLat];
  F.spine = [up, hipLat.clone().add(shLat)];
  F.chest = [up, shLat];
  const Lc = normalizeOr(shLat.clone().addScaledVector(up, -shLat.dot(up)), AXIS.X), Fc = Lc.clone().cross(up).normalize();
  const Fh = normalizeOr(hipLat.clone().cross(F.pelvis[0]), AXIS.Z);
  const down = up.clone().negate();
  for (const [s, sg, ix] of SIDES) {
    const bend = Fc.clone().addScaledVector(Lc, -0.5 * sg).normalize();
    const a = normalizeOr(J[ix.el].clone().sub(J[ix.sh]), down), f = normalizeOr(J[ix.wr].clone().sub(J[ix.el]), a);
    const hinge = hingeAxis(a, f, a.clone().cross(bend));
    F['upperArm' + s] = [a, hinge]; F['forearm' + s] = [f, hinge];
    const hp = mid(J[ix.index], J[ix.pinky]).sub(J[ix.wr]), hs = J[ix.index].clone().sub(J[ix.pinky]);
    F['handPose' + s] = hp.length() > 0.03 && hp.length() < 0.25 && hs.length() > 0.015 && hs.length() < 0.15 ? [hp, hs] : null;
    const la = normalizeOr(J[ix.knee].clone().sub(J[ix.hip]), down), lf = normalizeOr(J[ix.ankle].clone().sub(J[ix.knee]), la);
    const legHinge = hingeAxis(la, lf, la.clone().cross(Fh.clone().negate()));
    F['thigh' + s] = [la, legHinge]; F['shin' + s] = [lf, legHinge];
    const foot = J[ix.toe].clone().sub(J[ix.heel]);
    F['foot' + s] = foot.length() > 0.08 && foot.length() < 0.45 ? [foot, legHinge] : null;
  }
  const ears = J[7].clone().sub(J[8]), nose = J[0].clone().sub(mid(J[7], J[8]));
  F.headPose = ears.length() > 0.05 && ears.length() < 0.35 && nose.length() > 0.02 ?
    [nose.clone().cross(ears).applyAxisAngle(ears.clone().normalize(), -0.25), ears] : null;
  F.basis = {up, Lc, Fc, Fh};
  return F;
}

export class RigSolver {
  constructor(rig) { this.rig = rig; this.rest = null; this.faceRest = null; }
  setRest(cal) {
    this.rest = extractFrames(cal.neutral);
    this.faceRest = cal.face ? [cal.face.U.clone(), cal.face.L.clone()] : null;
  }
  restWorld(name) { return this.rig.rest.get(name)?.world || null; }

  /** body: BodyState output. Returns Map(bone name -> target world quaternion). */
  solve(body, opt = {}) {
    const out = new Map(), R = this.rest, cur = extractFrames(body.J, body.conf), rig = this.rig;
    const set = (name, D) => { const w = this.restWorld(name); if (w && rig.bones.has(name)) out.set(name, D.clone().multiply(w)); return out.get(name) || null; };
    const Dc = frameDelta(R.chest, cur.chest);
    const Dp = limitTo(Dc, frameDelta(R.pelvis, cur.pelvis), 0.75); // spine twist is limited
    const Ds = frameDelta(R.spine, cur.spine);
    set('pelvis', Dp); set('spine.lower', Ds); set('spine.upper', Ds.clone().slerp(Dc, 0.5)); set('chest', Dc);
    const {Fc} = cur.basis;

    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      const Du = frameDelta(R['upperArm' + s], cur['upperArm' + s]);
      let Df = frameDelta(R['forearm' + s], cur['forearm' + s]);
      set(`upper_arm.${s}`, Du);
      // Scapulohumeral rhythm: the shoulder girdle lifts as the arm rises above about 30 degrees.
      // Measured on the avatar's own arm, so a calibration pose with raised arms does not lift the shoulders at rest.
      const armAxis = rig.axis[`upper_arm.${s}`], arm = armAxis ? armAxis.clone().applyQuaternion(Du) : cur['upperArm' + s][0];
      const lift = clamp((arm.angleTo(AXIS.Y.clone().negate().applyQuaternion(Dc)) - 0.52) * 0.25, 0, 0.4);
      set(`clavicle.${s}`, new Quaternion().setFromAxisAngle(Fc, sg * lift).multiply(Dc));
      let Dh = Df.clone(), palm = null;
      const tracked = opt.hands !== false ? body.hands?.[s] : null;
      if (tracked && rig.palm[s]) {
        const [a, b] = palmFrame(tracked.points); palm = basisQ(a, b);
        if (palm) Dh = palm.clone().multiply(rig.palm[s].q0.clone().invert());
      } else if (cur['handPose' + s] && rig.handPose[s]) {
        Dh = Df.clone().slerp(frameDelta(rig.handPose[s], cur['handPose' + s]), 0.6 * seg(Math.min(body.conf[sg > 0 ? 15 : 16], body.conf[sg > 0 ? 19 : 20])));
      }
      Dh = limitTo(Df, Dh, 1.4);
      const axis = rig.axis[`forearm.${s}`];
      if (axis) { // half of the forearm roll goes to the forearm so the wrist does not kink (no separate radius/ulna bones)
        const {twist} = swingTwist(Df.clone().invert().multiply(Dh), axis);
        Df = Df.multiply(new Quaternion().slerp(twist, 0.5));
      }
      set(`forearm.${s}`, Df);
      const handWorld = set(`hand.${s}`, Dh);
      if (tracked && palm && handWorld) this.solveFingers(s, handWorld, palm, tracked.points, out);
    }

    for (const s of ['L', 'R']) {
      const Dt = frameDelta(R['thigh' + s], cur['thigh' + s]), Dsh = frameDelta(R['shin' + s], cur['shin' + s]);
      const Dfoot = R['foot' + s] && cur['foot' + s] ? limitTo(Dsh, frameDelta(R['foot' + s], cur['foot' + s]), 1.1) : Dsh.clone();
      set(`thigh.${s}`, Dt); set(`shin.${s}`, Dsh); set(`foot.${s}`, Dfoot);
      const toe = opt.toes !== false ? body.toes?.[s] || 0 : 0;
      if (Math.abs(toe) > 1e-4) {
        const lift = new Quaternion().setFromAxisAngle(AXIS.X.clone().applyQuaternion(Dfoot), -toe).multiply(Dfoot);
        for (let t = 1; t <= 5; t++) set(`toe${t}.proximal.${s}`, lift);
      }
    }

    let Dh = Dc.clone();
    if (opt.face !== false && body.face) {
      const {U, L} = body.face;
      Dh = this.faceRest ? deltaQ(this.faceRest[0], this.faceRest[1], U, L) : deltaQ(AXIS.Y, AXIS.X, U.clone().applyAxisAngle(L, 0.12), L);
    } else if (cur.headPose && R.headPose) {
      Dh = Dc.clone().slerp(frameDelta(R.headPose, cur.headPose), 0.8 * seg(Math.min(body.conf[0], body.conf[7], body.conf[8])));
    }
    Dh = limitTo(Dc, Dh, 1.4);
    set('neck', Dc.clone().slerp(Dh, 0.5)); set('head', Dh);
    if (rig.bones.has('jaw') && this.restWorld('jaw')) {
      const open = opt.face !== false && body.face ? clamp(body.face.jaw * 1.3, 0, 1) * 0.42 : 0;
      out.set('jaw', Dh.clone().multiply(this.restWorld('jaw')).multiply(new Quaternion().setFromAxisAngle(AXIS.X, open)));
    }
    for (const [name, q] of out) if (!Number.isFinite(q.x + q.y + q.z + q.w)) out.delete(name);
    return out;
  }

  /** Fingers: tracked segment directions are carried from the tracked palm frame into the rig's palm frame, then limited per joint. */
  solveFingers(s, handWorld, palm, points, out) {
    const rig = this.rig;
    const rigPalm = handWorld.clone().multiply(rig.rest.get(`hand.${s}`).world.clone().invert()).multiply(rig.palm[s].q0);
    const map = rigPalm.multiply(palm.clone().invert());
    for (const chain of FINGER_CHAINS) {
      let parentWorld = handWorld;
      for (let k = 0; k < chain.bones.length; k++) {
        const name = `finger${chain.finger}.${chain.bones[k]}.${s}`, rest = rig.rest.get(name);
        if (!rest || !rig.bones.has(name)) break;
        const restWorldNow = parentWorld.clone().multiply(rest.quaternion);
        const d = points[chain.points[k + 1]].clone().sub(points[chain.points[k]]);
        let world = restWorldNow;
        if (d.lengthSq() > 1e-8) {
          const target = d.applyQuaternion(map).normalize().applyQuaternion(restWorldNow.clone().invert());
          world = restWorldNow.clone().multiply(fingerRotation(rig.segment?.[name] || AXIS.Y, target, fingerLimits(chain.finger, k), rig.palmar[s]?.[chain.finger] ?? 1));
        }
        out.set(name, world); parentWorld = world;
      }
    }
  }
}
