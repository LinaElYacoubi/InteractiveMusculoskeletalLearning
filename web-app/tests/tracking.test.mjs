import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3, Quaternion} from '../public/vendor/three/three.module.js';
import {PoseRetargeter} from '../public/src/motion/retarget.js';
import {loadRig, addJaw, capture, direction, position, yawOf, angleDeg, wrapDeg, rotateWorld} from './helpers/synthetic.mjs';

const DT = 1 / 30;
async function setup({jaw = false} = {}) {
  const person = await loadRig(), avatar = await loadRig();
  if (jaw) addJaw(avatar);
  const rig = new PoseRetargeter(avatar);
  rig.calibrate(Array.from({length: 6}, (_, i) => capture(person, {timestamp: i * 33})), false);
  return {person, avatar, rig, t: 1000};
}
function run(ctx, frames) { for (const f of frames) { ctx.t += DT * 1000; ctx.rig.apply({...f, timestamp: ctx.t}, false, DT); } }
const steady = (ctx, n, options = {}) => run(ctx, Array.from({length: n}, () => capture(ctx.person, options)));

test('a resting hand leaves the fingers at rest; curled fingers bend toward the palm like the person', async () => {
  const ctx = await setup();
  steady(ctx, 20);
  for (const name of ['finger2.middle.L', 'finger3.distal.R', 'finger1.distal.L']) {
    assert.ok(angleDeg(direction(ctx.avatar, name), direction(ctx.person, name)) < 4, `${name} should match a resting hand`);
  }
  for (const s of ['L', 'R']) for (const seg of ['proximal', 'middle', 'distal']) rotateWorld(ctx.person, `finger2.${seg}.${s}`, new Vector3(1, 0, 0), -0.55);
  rotateWorld(ctx.person, 'finger1.distal.L', new Vector3(1, 0, 0), -0.4);
  steady(ctx, 30);
  for (const s of ['L', 'R']) for (const seg of ['proximal', 'middle', 'distal']) {
    const name = `finger2.${seg}.${s}`, error = angleDeg(direction(ctx.avatar, name), direction(ctx.person, name));
    assert.ok(error < 12, `${name} off by ${error.toFixed(1)} degrees`);
  }
  const tip = position(ctx.avatar, 'finger2.distal.L'), base = position(ctx.avatar, 'finger2.proximal.L');
  assert.ok(tip.z - base.z > 0.02, 'a curled index finger moves toward the palm side (+Z in anatomical position)');
});

test('a full spin stays continuous through back views where the tracker swaps left and right', async () => {
  const ctx = await setup();
  steady(ctx, 10);
  const frames = 120, errors = [];
  for (let k = 1; k <= frames; k++) {
    const yaw = 2 * Math.PI * k / frames;
    ctx.person.resetPose(); rotateWorld(ctx.person, 'root', new Vector3(0, 1, 0), yaw);
    ctx.t += DT * 1000; ctx.rig.apply({...capture(ctx.person, {yaw}), timestamp: ctx.t}, false, DT);
    errors.push(Math.abs(wrapDeg(yawOf(ctx.avatar, 'chest') - yaw)));
  }
  const worst = Math.max(...errors), late = errors.slice(10);
  assert.ok(Math.max(...late) < 40, `chest yaw drifted ${Math.max(...late).toFixed(0)} degrees from the person`);
  assert.ok(errors.filter(e => e > 120).length === 0, `facing flipped by ~180 degrees (worst ${worst.toFixed(0)})`);
});

test('without spin handling the same back views would flip the avatar (control)', async () => {
  const ctx = await setup(); ctx.rig.options.predict = false;
  steady(ctx, 10);
  ctx.person.resetPose(); rotateWorld(ctx.person, 'root', new Vector3(0, 1, 0), Math.PI);
  for (let k = 0; k < 20; k++) { ctx.t += 33; ctx.rig.apply({...capture(ctx.person, {yaw: Math.PI}), timestamp: ctx.t}, false, DT); }
  assert.ok(Math.abs(wrapDeg(yawOf(ctx.avatar, 'chest') - Math.PI)) > 120, 'raw tracker output reads the back view as facing forward');
});

test('knees hidden by a dress are inferred bending forward from hips and ankles', async () => {
  const ctx = await setup();
  steady(ctx, 10);
  for (const s of ['L', 'R']) { rotateWorld(ctx.person, `thigh.${s}`, new Vector3(1, 0, 0), -0.7); rotateWorld(ctx.person, `shin.${s}`, new Vector3(1, 0, 0), 1.2); }
  const hidden = {25: 0.05, 26: 0.05};
  const frames = Array.from({length: 40}, () => {
    const f = capture(ctx.person, {visibility: hidden});
    for (const [knee, hip, ankle] of [[25, 23, 27], [26, 24, 28]]) { // tracker guesses a straight leg under the fabric
      for (const key of ['worldLandmarks', 'landmarks']) {
        const a = f[key][hip], b = f[key][ankle];
        f[key][knee] = {...f[key][knee], x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2};
      }
    }
    return f;
  });
  run(ctx, frames);
  for (const s of ['L', 'R']) {
    const error = angleDeg(direction(ctx.avatar, `thigh.${s}`), direction(ctx.person, `thigh.${s}`));
    assert.ok(error < 15, `thigh.${s} off by ${error.toFixed(1)} degrees`);
    assert.ok(position(ctx.avatar, `shin.${s}`).z > position(ctx.avatar, `thigh.${s}`).z + 0.15, 'knee comes forward');
  }
});

test('crossed wrists that the tracker swaps are put back on the right arms', async () => {
  const ctx = await setup();
  steady(ctx, 10);
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    rotateWorld(ctx.person, `upper_arm.${s}`, new Vector3(0, 0, 1), -sg * 0.25);
    rotateWorld(ctx.person, `forearm.${s}`, new Vector3(1, 0, 0), -1.4);
    rotateWorld(ctx.person, `forearm.${s}`, new Vector3(0, 1, 0), -sg * 0.9);
  }
  steady(ctx, 15);
  const swap = f => { for (const key of ['worldLandmarks', 'landmarks']) for (const [a, b] of [[15, 16], [17, 18], [19, 20], [21, 22]]) [f[key][a], f[key][b]] = [f[key][b], f[key][a]]; return f; };
  run(ctx, Array.from({length: 12}, () => swap(capture(ctx.person))));
  for (const s of ['L', 'R']) {
    const error = angleDeg(direction(ctx.avatar, `forearm.${s}`), direction(ctx.person, `forearm.${s}`));
    assert.ok(error < 20, `forearm.${s} off by ${error.toFixed(1)} degrees after a wrist swap`);
  }
  assert.equal(ctx.rig.last.overlap.choice.arms, 'swap-wrists');
});

test('a briefly hidden arm keeps its momentum; a long-hidden arm relaxes to the person\'s neutral', async () => {
  const predicting = await setup(), holding = await setup(); holding.rig.options.predict = false;
  const hide = {14: 0.02, 16: 0.02, 18: 0.02, 20: 0.02, 22: 0.02};
  const errors = {};
  for (const [name, ctx] of [['predict', predicting], ['hold', holding]]) {
    steady(ctx, 10);
    const swing = k => { ctx.person.resetPose(); rotateWorld(ctx.person, 'forearm.R', new Vector3(1, 0, 0), -0.04 * k); };
    for (let k = 0; k < 25; k++) { swing(k); run(ctx, [capture(ctx.person)]); }
    for (let k = 25; k < 31; k++) { swing(k); run(ctx, [capture(ctx.person, {visibility: hide})]); }
    errors[name] = angleDeg(direction(ctx.avatar, 'forearm.R'), direction(ctx.person, 'forearm.R'));
  }
  assert.ok(errors.predict < errors.hold * 0.75, `prediction (${errors.predict.toFixed(1)} deg) should beat holding the last pose (${errors.hold.toFixed(1)} deg)`);
  for (let k = 0; k < 120; k++) run(predicting, [capture(predicting.person, {visibility: hide})]);
  predicting.person.resetPose();
  const neutral = angleDeg(direction(predicting.avatar, 'forearm.R'), direction(predicting.person, 'forearm.R'));
  assert.ok(neutral < 8, `long-hidden forearm returns to neutral (off by ${neutral.toFixed(1)} degrees)`);
});

test('arms reaching toward the camera regain the depth the tracker under-reports', async () => {
  const withFix = await setup(), probe = await setup();
  for (const ctx of [withFix, probe]) steady(ctx, 10);
  for (const ctx of [withFix, probe]) rotateWorld(ctx.person, 'upper_arm.L', new Vector3(1, 0, 0), -1.25);
  const flatten = f => { const s = f.worldLandmarks[11]; for (const j of [13, 15, 17, 19, 21]) { const p = f.worldLandmarks[j]; p.z = s.z + (p.z - s.z) * 0.45; } return f; };
  run(withFix, Array.from({length: 30}, () => flatten(capture(withFix.person))));
  const error = angleDeg(direction(withFix.avatar, 'upper_arm.L'), direction(withFix.person, 'upper_arm.L'));
  const shallow = flatten(capture(probe.person)).worldLandmarks;
  const raw = new Vector3(shallow[13].x - shallow[11].x, -(shallow[13].y - shallow[11].y), -(shallow[13].z - shallow[11].z));
  const rawError = angleDeg(raw, direction(probe.person, 'upper_arm.L'));
  assert.ok(error < rawError * 0.6, `depth recovery should cut the error (${error.toFixed(1)} vs raw ${rawError.toFixed(1)} degrees)`);
});

test('heel lift with the ball of the foot down bends the toes so they stay on the floor', async () => {
  const ctx = await setup(), control = await setup(); control.rig.options.toes = false;
  for (const c of [ctx, control]) steady(c, 10);
  assert.ok(Math.abs(ctx.rig.last.toes.L) < 0.05, 'flat feet keep flat toes');
  const rest = direction(ctx.avatar, 'toe3.proximal.L');
  for (const c of [ctx, control]) for (const s of ['L', 'R']) rotateWorld(c.person, `foot.${s}`, new Vector3(1, 0, 0), 0.5); // tiptoe: heels up, balls down
  for (const c of [ctx, control]) steady(c, 30);
  const toes = direction(ctx.avatar, 'toe3.proximal.L'), rigid = direction(control.avatar, 'toe3.proximal.L');
  assert.ok(toes.y - rigid.y > 0.25, `toes bend up relative to a rigid foot (dy ${(toes.y - rigid.y).toFixed(2)})`);
  assert.ok(Math.abs(toes.y - rest.y) < 0.15, 'toes stay roughly flat on the floor while the heel is up');
  assert.ok(ctx.rig.last.toes.R > 0.25, 'both feet on tiptoe bend their toes');
});

test('face tracking turns the head and opens the jaw', async () => {
  const ctx = await setup({jaw: true});
  steady(ctx, 10);
  rotateWorld(ctx.person, 'head', new Vector3(0, 1, 0), 0.6);
  steady(ctx, 30, {jawOpen: 0.8});
  const yaw = yawOf(ctx.avatar, 'head') * 180 / Math.PI;
  assert.ok(Math.abs(yaw - 34.4) < 8, `head yaw ${yaw.toFixed(1)} should follow the face (34 degrees)`);
  const jaw = ctx.avatar.bones.get('jaw').quaternion, angle = 2 * Math.acos(Math.min(1, Math.abs(jaw.w)));
  assert.ok(angle > 0.3 && jaw.x > 0, `jaw opens downward (angle ${angle.toFixed(2)})`);
});

test('heavy-model analysis that disagrees with a swapped live reading produces a correction', async () => {
  const ctx = await setup();
  steady(ctx, 10);
  const truth = capture(ctx.person);
  const live = structuredClone(truth);
  for (const key of ['worldLandmarks', 'landmarks']) for (const [a, b] of [[13, 14], [15, 16], [17, 18], [19, 20], [21, 22]]) [live[key][a], live[key][b]] = [live[key][b], live[key][a]];
  live.hands = [];
  ctx.t += 33; ctx.rig.apply({...live, timestamp: ctx.t}, false, DT);
  const mask = {width: 64, height: 64, data: new Uint8Array(64 * 64).fill(255)};
  const summary = ctx.rig.ingestAnalysis({timestamp: ctx.t, worldLandmarks: truth.worldLandmarks, landmarks: truth.landmarks, mask, roi: {x: 0, y: 0, w: 1, h: 1}}, false);
  assert.ok(summary && summary.arms !== 'observed', 'the heavy reading wins for the arms');
  assert.ok(ctx.rig.state.overlap.corrections.arms, 'a correction is queued for the next live frames');
});

test('skin modes: segmented is fully rigid, stitched keeps only a narrow seam, smooth is untouched', async () => {
  const {remapWeights, blendedShare} = await import('../public/src/anatomy/skin-modes.js');
  const w = new Float32Array([1, 0, 0, 0, 0.7, 0.3, 0, 0, 0.55, 0.45, 0, 0, 0.4, 0.35, 0.25, 0]);
  assert.deepEqual(Array.from(remapWeights(w, 'smooth')), Array.from(w));
  const segmented = remapWeights(w, 'segmented');
  assert.equal(blendedShare(segmented), 0);
  assert.deepEqual(Array.from(segmented.slice(4, 8)), [1, 0, 0, 0]);
  const stitched = remapWeights(w, 'stitched');
  assert.deepEqual(Array.from(stitched.slice(4, 8)), [1, 0, 0, 0], 'a 70/30 vertex becomes rigid');
  assert.ok(stitched[8] > 0.5 && stitched[9] > 0.2, 'a near 50/50 seam vertex still blends');
  for (let v = 0; v < stitched.length; v += 4) assert.ok(Math.abs(stitched[v] + stitched[v + 1] + stitched[v + 2] + stitched[v + 3] - 1) < 1e-6);
});

test('hand labels: the left/right label convention is learned from unambiguous frames', async () => {
  const {HandAssigner} = await import('../public/src/motion/hands.js');
  const assigner = new HandAssigner(true); // start with the wrong (mirrored) assumption
  const hand = (x, label) => ({handedness: label, score: 0.95, landmarks: Array.from({length: 21}, () => ({x, y: 0.5, z: 0})), worldLandmarks: Array.from({length: 21}, () => ({x: 0, y: 0, z: 0}))});
  const ctx = {wrists: {L: [900, 360], R: [380, 360]}, wristConf: {L: 0.95, R: 0.95}, shoulderPx: 200, mirror: false, vw: 1280, vh: 720};
  for (let k = 0; k < 8; k++) assigner.assign([hand(900 / 1280, 'Left')], ctx); // person's left hand, labelled as it really is
  assert.equal(assigner.flip, false);
  const result = assigner.assign([hand(900 / 1280, 'Left'), hand(380 / 1280, 'Right')], ctx);
  assert.equal(result.L.handedness, 'Left'); assert.equal(result.R.handedness, 'Right');
});

test('lesson calibration with a segment subset drives only those bones (elbow lesson: right arm)', async () => {
  const person = await loadRig(), avatar = await loadRig(), rig = new PoseRetargeter(avatar);
  rig.calibrate(capture(person).worldLandmarks, false, ['upper_arm.R', 'forearm.R']); // the lesson passes one raw landmark array
  rotateWorld(person, 'forearm.R', new Vector3(1, 0, 0), -1.2);
  rotateWorld(person, 'forearm.L', new Vector3(1, 0, 0), -1.2);
  rotateWorld(person, 'thigh.L', new Vector3(1, 0, 0), -0.6);
  for (let k = 0; k < 20; k++) rig.apply(capture(person).worldLandmarks, false, 0.08);
  const error = angleDeg(direction(avatar, 'forearm.R'), direction(person, 'forearm.R'));
  assert.ok(error < 10, `right forearm follows the visitor (off by ${error.toFixed(1)} degrees)`);
  for (const name of ['forearm.L', 'thigh.L', 'head', 'chest']) {
    const bone = avatar.bones.get(name);
    assert.ok(bone.quaternion.angleTo(avatar.rest.get(name).quaternion) < 1e-6, `${name} stays at rest`);
  }
  rig.invalidate(); assert.equal(rig.calibrated, false);
});
