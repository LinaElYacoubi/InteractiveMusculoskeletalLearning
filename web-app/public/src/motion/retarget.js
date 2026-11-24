import {Quaternion} from '../../vendor/three/three.module.js';
import {poseMetrics} from './pose-math.js';
import {BodyState, normalizeFrame} from './body-state.js';
import {RigSolver} from './solver.js';
import {describeRig} from './rig.js';

export const DEFAULT_OPTIONS = Object.freeze({hands: true, face: true, predict: true, overlap: true, analysis: true, toes: true});

/**
 * Drives the INNOVA rig from camera tracking.
 *   ingest(frame) runs on each tracker result (body state + solver -> per-bone targets)
 *   update(dt)    runs every rendered frame and eases bones toward their targets
 *   apply()       does both, for single-shot use and tests
 */
export class PoseRetargeter {
  constructor(viewer) {
    this.viewer = viewer; this.smoothing = 0.15; this.lastGood = 0; this.calibrated = false;
    this.options = {...DEFAULT_OPTIONS};
    this.state = new BodyState(); this.targets = new Map(); this.segments = null; this.rig = null; this.solver = null; this.last = null; this.calibration = null;
  }
  ensureRig() { if (!this.rig) { this.rig = describeRig(this.viewer); this.solver = new RigSolver(this.rig); } }
  /** Rebuild the rig description (after the viewer adds bones such as the jaw). */
  refreshRig() { this.rig = null; this.ensureRig(); }

  /**
   * input: one tracker frame, a raw 33-landmark array, or a list of frames captured while standing still.
   * segments (optional): bone names to drive, for activities that track part of the body (the elbow lesson passes
   * ['upper_arm.R', 'forearm.R']). Every other bone stays at rest. Omit it to drive the whole rig.
   */
  calibrate(input, mirror, segments = null) {
    const frames = Array.isArray(input) && input.length && (Array.isArray(input[0]) || input[0]?.worldLandmarks) ? input : [input];
    const last = normalizeFrame(frames[frames.length - 1]);
    this.ensureRig(); this.viewer.resetPose();
    this.segments = Array.isArray(segments) && segments.length ? new Set(segments) : null;
    const cal = this.state.calibrate(frames, mirror, this.rig.landmarks, {partial: Boolean(this.segments)});
    this.solver.setRest(cal); this.targets.clear();
    this.calibrated = true; this.lastGood = performance.now(); this.calibration = cal;
    return {...poseMetrics(last.world, mirror), coverage: cal.coverage, notes: cal.notes, noteCodes: cal.noteCodes};
  }
  invalidate() { this.segments = null; this.calibrated = false; this.state.reset(); this.state.cal = null; this.targets.clear(); this.calibration = null; }

  ingest(input, mirror, dt = 0.08) {
    if (!this.calibrated) return null;
    this.state.setSmoothing(this.smoothing);
    const body = this.state.ingest(input, mirror, dt, this.options);
    if (!body) return null;
    this.setTargets(this.solver.solve(body, this.options));
    this.lastGood = performance.now(); this.last = body;
    return body;
  }
  /** World targets -> local targets, parents first, so smoothing never compounds down the hierarchy. */
  setTargets(worlds) {
    const world = new Map();
    for (const [name, bone] of this.rig.order) {
      const rest = this.rig.rest.get(name); if (!rest) continue;
      const parentWorld = world.get(bone.parent) || bone.parent?.getWorldQuaternion(new Quaternion()) || new Quaternion();
      let local;
      if (worlds.has(name) && (!this.segments || this.segments.has(name))) local = parentWorld.clone().invert().multiply(worlds.get(name)).normalize();
      else local = rest.quaternion.clone();
      this.targets.set(bone, local);
      world.set(bone, parentWorld.clone().multiply(local));
    }
  }
  update(dt) {
    if (!this.targets.size) return;
    const alpha = 1 - Math.exp(-dt / Math.max(0.01, this.smoothing * 0.35));
    for (const [bone, q] of this.targets) bone.quaternion.slerp(q, alpha);
  }
  apply(input, mirror, dt = 0.08) {
    const body = this.ingest(input, mirror, dt); this.update(dt); this.viewer.model?.updateMatrixWorld(true); return body;
  }
  easeToRest(dt) {
    const alpha = 1 - Math.exp(-dt / 0.45);
    for (const [name, bone] of this.viewer.bones) { const rest = this.viewer.rest.get(name); if (rest) bone.quaternion.slerp(rest.quaternion, alpha); }
    this.targets.clear();
    this.viewer.model?.updateMatrixWorld(true);
  }
  takeAnalysisRequest() { return this.calibrated ? this.state.takeAnalysisRequest() : null; }
  ingestAnalysis(result, mirror) { return this.calibrated ? this.state.ingestAnalysis(result, mirror) : null; }
}
