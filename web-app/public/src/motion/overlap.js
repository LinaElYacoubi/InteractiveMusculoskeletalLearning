// Overlap analysis: when limbs cross, touch or hide each other, the live tracker can swap sides,
// collapse a limb or jump. This module spots those moments and picks the most plausible reading
// of the frame from several hypotheses. The deep pass (heavy pose model + person silhouette) runs
// in a second worker and feeds extra hypotheses through the same scoring.
import {Vector3} from '../../vendor/three/three.module.js';
import {BONE_PAIRS} from './pose-math.js';

export const GROUPS = {
  arms: {joints: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22], bones: ['upperArmL', 'forearmL', 'upperArmR', 'forearmR'],
    sides: {L: {root: 11, mid: 13, end: 15}, R: {root: 12, mid: 14, end: 16}}},
  legs: {joints: [25, 26, 27, 28, 29, 30, 31, 32], bones: ['thighL', 'shinL', 'thighR', 'shinR'],
    sides: {L: {root: 23, mid: 25, end: 27}, R: {root: 24, mid: 26, end: 28}}},
};
export const SWAPS = {
  arms: {'swap-wrists': [[15, 16], [17, 18], [19, 20], [21, 22]], 'swap-arms': [[13, 14], [15, 16], [17, 18], [19, 20], [21, 22]]},
  legs: {'swap-feet': [[27, 28], [29, 30], [31, 32]], 'swap-legs': [[25, 26], [27, 28], [29, 30], [31, 32]]},
};
/** Parent of each limb landmark, used to move corrections between frames. */
export const LIMB_PARENT = {13: 11, 15: 13, 17: 15, 19: 15, 21: 15, 14: 12, 16: 14, 18: 16, 20: 16, 22: 16,
  25: 23, 27: 25, 29: 27, 31: 27, 26: 24, 28: 26, 30: 28, 32: 28};

// ---- 2D geometry (pixel coordinates) --------------------------------------------------------------
const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
export function segmentsIntersect(p1, p2, p3, p4) {
  const d1 = cross2(p3, p4, p1), d2 = cross2(p3, p4, p2), d3 = cross2(p1, p2, p3), d4 = cross2(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
export const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function segmentTouchesPolygon(a, b, poly) {
  if (pointInPolygon(b, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (segmentsIntersect(a, b, poly[j], poly[i])) return true;
  return false;
}

// ---- observation copies -------------------------------------------------------------------------
export function cloneObservation(o) {
  return {P: o.P.map(v => v.clone()), img: o.img ? o.img.map(p => p && p.slice()) : null, vis: Float32Array.from(o.vis), vw: o.vw, vh: o.vh};
}
export function swapPairs(o, pairs) {
  const c = cloneObservation(o);
  for (const [a, b] of pairs) {
    [c.P[a], c.P[b]] = [c.P[b], c.P[a]];
    if (c.img) [c.img[a], c.img[b]] = [c.img[b], c.img[a]];
    const v = c.vis[a]; c.vis[a] = c.vis[b]; c.vis[b] = v;
  }
  return c;
}

// ---- risk detection -----------------------------------------------------------------------------
/**
 * ctx: {lengths, pred (Vector3[33] | null), fresh 0..1, dt, handWrists {L,R} (px | null), shoulderPx}
 * Returns per-group risk 0..1 with the reasons that raised it.
 */
export function assessOverlap(obs, ctx) {
  const report = {arms: {risk: 0, reasons: []}, legs: {risk: 0, reasons: []}};
  const raise = (group, risk, reason) => { const r = report[group]; if (risk > r.risk) r.risk = risk; if (!r.reasons.includes(reason)) r.reasons.push(reason); };
  const {img, vis, P} = obs;
  const sw = Math.max(30, ctx.shoulderPx || 0);
  if (img) {
    const ok = i => img[i] && vis[i] > 0.2;
    const seg = (a, b) => ok(a) && ok(b) ? [img[a], img[b]] : null;
    const armSegs = {L: [seg(11, 13), seg(13, 15)], R: [seg(12, 14), seg(14, 16)]};
    for (const a of armSegs.L) for (const b of armSegs.R) if (a && b && segmentsIntersect(a[0], a[1], b[0], b[1])) raise('arms', 0.5, 'arms cross');
    if (ok(15) && ok(16) && dist2(img[15], img[16]) < 0.35 * sw) raise('arms', 0.75, 'hands together');
    if (ok(15) && ok(14) && dist2(img[15], img[14]) < 0.3 * sw) raise('arms', 0.5, 'hand at other elbow');
    if (ok(16) && ok(13) && dist2(img[16], img[13]) < 0.3 * sw) raise('arms', 0.5, 'hand at other elbow');
    if ([11, 12, 23, 24].every(ok)) {
      const torso = [img[11], img[12], img[24], img[23]];
      for (const [e, w] of [[13, 15], [14, 16]]) if (ok(e) && ok(w) && segmentTouchesPolygon(img[e], img[w], torso)) raise('arms', 0.35, 'arm across body');
    }
    const legSegs = {L: [seg(23, 25), seg(25, 27)], R: [seg(24, 26), seg(26, 28)]};
    for (const a of legSegs.L) for (const b of legSegs.R) if (a && b && segmentsIntersect(a[0], a[1], b[0], b[1])) raise('legs', 0.55, 'legs cross');
    for (const side of ['L', 'R']) {
      const hand = ctx.handWrists?.[side], wrist = side === 'L' ? 15 : 16;
      if (hand && ok(wrist) && dist2(hand, img[wrist]) > 0.45 * sw) raise('arms', 0.8, 'hand tracker disagrees');
    }
  }
  for (const [group, def] of Object.entries(GROUPS)) {
    for (const key of def.bones) {
      const L = ctx.lengths?.[key]; if (!L) continue;
      const [a, b] = BONE_PAIRS[key];
      if (vis[a] < 0.5 || vis[b] < 0.5) continue;
      const ratio = P[a].distanceTo(P[b]) / L;
      if (ratio < 0.7 || ratio > 1.35) raise(group, 0.7, 'limb length off');
    }
    // A joint that is simply hidden is not an overlap: low confidence already hands it to prediction and knee/elbow inference.
    if (ctx.pred && ctx.fresh > 0.5 && ctx.dt > 0) {
      for (const j of def.joints) {
        if (vis[j] < 0.5 || !ctx.pred[j]) continue;
        const jump = P[j].distanceTo(ctx.pred[j]);
        if (jump > 0.15 && jump / ctx.dt > 3.5) { raise(group, 0.6, 'sudden jump'); break; }
      }
    }
  }
  report.max = Math.max(report.arms.risk, report.legs.risk);
  return report;
}

// ---- weak-perspective projection: avatar space -> display pixels -------------------------------
function solve4(A, b) {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 4; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 5; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[4] / row[i]);
}
/** Least-squares affine map from 3D joints to their 2D image positions (ridge-regularised in depth). */
export function fitProjection(P, img, vis, minVis = 0.7) {
  if (!img) return null;
  const rows = [];
  for (let i = 0; i < P.length; i++) if (img[i] && vis[i] >= minVis && P[i]) rows.push(i);
  if (rows.length < 6) return null;
  const A = Array.from({length: 4}, () => [0, 0, 0, 0]), bu = [0, 0, 0, 0], bv = [0, 0, 0, 0];
  for (const i of rows) {
    const x = [P[i].x, P[i].y, P[i].z, 1];
    for (let r = 0; r < 4; r++) { for (let c = 0; c < 4; c++) A[r][c] += x[r] * x[c]; bu[r] += x[r] * img[i][0]; bv[r] += x[r] * img[i][1]; }
  }
  const lambda = 1e-3 * rows.length; A[2][2] += lambda; A[0][0] += 1e-6; A[1][1] += 1e-6;
  const u = solve4(A, bu), v = solve4(A, bv);
  return u && v ? {u, v} : null;
}
export const project = (fit, p) => [fit.u[0] * p.x + fit.u[1] * p.y + fit.u[2] * p.z + fit.u[3], fit.v[0] * p.x + fit.v[1] * p.y + fit.v[2] * p.z + fit.v[3]];

// ---- silhouette sampling (mask from the analysis worker) ----------------------------------------
/** Returns f(px, py) -> person probability 0..1 for display-pixel coordinates. */
export function maskSampler(mask, roi, mirror, vw, vh) {
  if (!mask?.data || !roi) return null;
  return (px, py) => {
    let x = px / vw; const y = py / vh; if (mirror) x = 1 - x;
    const mx = Math.floor((x - roi.x) / roi.w * mask.width), my = Math.floor((y - roi.y) / roi.h * mask.height);
    if (mx < 0 || my < 0 || mx >= mask.width || my >= mask.height) return 0;
    return mask.data[my * mask.width + mx] / 255;
  };
}
export function segmentCoverage(sample, a, b, steps = 7) {
  let sum = 0;
  for (let k = 0; k < steps; k++) { const t = (k + 0.5) / steps; sum += sample(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); }
  return sum / steps;
}

// ---- hypothesis scoring -------------------------------------------------------------------------
/**
 * Lower is better. Terms: bone-length consistency, motion continuity, agreement with the hand detector,
 * landmark confidence, forearm-through-torso, and (deep pass only) coverage by the person silhouette.
 */
export function scoreCandidate(c, ctx, group) {
  const def = GROUPS[group]; let e = 0; const terms = {};
  const add = (k, v) => { terms[k] = (terms[k] || 0) + v; e += v; };
  for (const key of def.bones) {
    const L = ctx.lengths?.[key]; if (!L) continue;
    const [a, b] = BONE_PAIRS[key];
    add('length', Math.min(2, ((c.P[a].distanceTo(c.P[b]) / L - 1) / 0.2) ** 2) * 0.6);
  }
  if (ctx.pred && ctx.fresh > 0) {
    const sigma = 0.12 + 1.5 * Math.max(0, ctx.dt || 0);
    for (const j of def.joints) if (ctx.pred[j]) add('motion', Math.min(2, (c.P[j].distanceTo(ctx.pred[j]) / sigma) ** 2) * 0.25 * ctx.fresh);
  }
  if (c.img && ctx.handWrists) {
    const sw = Math.max(30, ctx.shoulderPx || 0);
    for (const [side, wrist] of [['L', 15], ['R', 16]]) {
      const hand = ctx.handWrists[side];
      if (hand && c.img[wrist] && group === 'arms') add('hands', Math.min(3, (dist2(c.img[wrist], hand) / (0.3 * sw)) ** 2) * 1.2);
    }
  }
  if (c.kind === 'predicted') add('confidence', 0.3 * def.joints.length / 4);
  else for (const j of def.joints) add('confidence', (1 - Math.min(1, c.vis[j])) * 0.15);
  if (group === 'arms' && ctx.torso) {
    const {center, lateral, up, forward, halfWidth, top, bottom} = ctx.torso;
    for (const [e1, w1] of [[13, 15], [14, 16]]) {
      for (const t of [0.35, 0.65, 1]) {
        const p = c.P[e1].clone().lerp(c.P[w1], t).sub(center);
        const x = p.dot(lateral), y = p.dot(up), z = p.dot(forward);
        if (Math.abs(x) < halfWidth * 0.75 && y < top - 0.03 && y > bottom + 0.05 && z > -0.1 && z < 0.02) add('torso', 0.5);
      }
    }
  }
  if (ctx.sample && c.img) {
    for (const side of Object.values(def.sides)) {
      for (const [a, b] of [[side.root, side.mid], [side.mid, side.end]]) {
        if (!c.img[a] || !c.img[b]) continue;
        add('silhouette', 2.2 * (1 - segmentCoverage(ctx.sample, c.img[a], c.img[b])) ** 2);
      }
    }
  }
  if (c.name === 'observed') add('bias', -0.25);
  if (ctx.previous === c.name) add('bias', -0.3);
  if (ctx.preferred && ctx.preferred === c.name) add('bias', -0.6);
  return {energy: e, terms};
}

export function chooseCandidate(candidates, ctx, group) {
  let best = null; const scores = [];
  for (const c of candidates) {
    const s = scoreCandidate(c, ctx, group); scores.push({name: c.name, ...s});
    if (!best || s.energy < best.energy) best = {candidate: c, energy: s.energy};
  }
  const observed = scores.find(s => s.name === 'observed');
  return {best: best.candidate, margin: observed ? observed.energy - best.energy : 0, scores};
}

/** Body-relative vectors (child minus parent) let a correction found on one frame be carried to later frames. */
export function relativeVector(P, j, frameInverse) {
  const parent = LIMB_PARENT[j];
  return P[j].clone().sub(P[parent]).applyQuaternion(frameInverse);
}
export function applyRelative(P, joints, deltas, frame) {
  for (const j of joints) {
    const d = deltas[j]; if (!d) continue;
    const parent = LIMB_PARENT[j];
    const rel = P[j].clone().sub(P[parent]).applyQuaternion(frame.clone().invert()).add(d);
    const target = P[parent].clone().add(rel.applyQuaternion(frame));
    const move = target.clone().sub(P[j]);
    for (const k of joints) if (k === j || isDescendant(k, j)) P[k].add(move);
  }
}
function isDescendant(k, ancestor) { let p = LIMB_PARENT[k]; while (p !== undefined) { if (p === ancestor) return true; p = LIMB_PARENT[p]; } return false; }
export const zeroVector = () => new Vector3();
