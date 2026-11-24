// Rotation helpers shared by the body state, solver and tests.
// A "frame" is a (primary, secondary) direction pair; basisQ turns it into an orientation.
import {Matrix4, Quaternion, Vector3} from '../../vendor/three/three.module.js';

export const AXIS = Object.freeze({X: new Vector3(1, 0, 0), Y: new Vector3(0, 1, 0), Z: new Vector3(0, 0, 1)});
export const IDENTITY = new Quaternion();
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** Soft confidence gate used throughout (Ranma used the same 0.35 to 0.7 ramp). */
export const seg = v => smoothstep(0.35, 0.7, v);
export const isBadQuaternion = q => !Number.isFinite(q.x + q.y + q.z + q.w);
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const angleBetween = (a, b) => Math.abs(wrapAngle(a - b));
export const vec = (a) => Array.isArray(a) ? new Vector3(a[0], a[1], a[2]) : a.clone();
export const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);

/** Orientation whose X axis is `primary` and Y axis is `secondary` (orthogonalised). Null when degenerate. */
export function basisQ(primary, secondary) {
  if (!primary || !secondary) return null;
  const a = primary.clone(); if (!(a.lengthSq() > 1e-12)) return null; a.normalize();
  const b = secondary.clone().addScaledVector(a, -secondary.dot(a));
  if (b.lengthSq() < 1e-10) {
    const fallback = Math.abs(a.y) < 0.9 ? AXIS.Y : AXIS.X;
    b.copy(fallback).addScaledVector(a, -fallback.dot(a));
  }
  b.normalize();
  const c = a.clone().cross(b);
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(a, b, c));
  return isBadQuaternion(q) ? null : q;
}

/** World rotation taking the rest frame (p0, s0) onto the target frame (p, s). */
export function deltaQ(p0, s0, p, s) {
  const q1 = basisQ(p, s), q0 = basisQ(p0, s0);
  if (!q1 || !q0) return new Quaternion();
  const q = q1.multiply(q0.invert());
  return isBadQuaternion(q) ? new Quaternion() : q;
}
export const frameDelta = (rest, current) => rest && current ? deltaQ(rest[0], rest[1], current[0], current[1]) : new Quaternion();

export function lerpDir(a, b, t) {
  const v = a.clone().multiplyScalar(1 - t).addScaledVector(b, t);
  return v.lengthSq() > 1e-10 ? v.normalize() : b.clone();
}
export function horizontal(v) { const h = new Vector3(v.x, 0, v.z); return h.lengthSq() > 1e-8 ? h.normalize() : AXIS.X.clone(); }
export function normalizeOr(v, fallback) { return v.lengthSq() > 1e-12 ? v.clone().normalize() : fallback.clone(); }
/** Keep q within `max` radians of base. */
export const limitTo = (base, q, max) => (base.angleTo(q) > max ? base.clone().rotateTowards(q, max) : q.clone());

/** Swing-twist decomposition of q around a unit axis (expressed in q's space). */
export function swingTwist(q, axis) {
  const projection = axis.clone().multiplyScalar(axis.x * q.x + axis.y * q.y + axis.z * q.z);
  const twist = new Quaternion(projection.x, projection.y, projection.z, q.w);
  if (twist.lengthSq() < 1e-12) twist.identity(); else twist.normalize();
  const swing = q.clone().multiply(twist.clone().invert());
  return {swing, twist};
}
export function scaleRotation(q, t) { return new Quaternion().slerp(q, t); }

/** Yaw (radians) of a body whose left-pointing lateral vector is `lateral`; 0 = facing +Z. */
export function yawFromLateral(lateral) {
  const forward = new Vector3(-lateral.z, 0, lateral.x); // lateral × up, ignoring tilt
  return Math.atan2(forward.x, forward.z);
}
