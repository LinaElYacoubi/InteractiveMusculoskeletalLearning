# Movement Atlas tracking upgrade (from the Ranma VTuber tracker)

The Movement lab now uses the Ranma VTuber tracking pipeline, rebuilt for the INNOVA musculoskeletal rig and extended. Everything still runs locally; no frame leaves the computer.

## What is new

| Area | What it does |
| --- | --- |
| Ranma solver, ported | Elbow and knee hinge planes keep limb twist stable; torso split across pelvis, spine and chest; neck between chest and head. Solved relative to each person's calibrated neutral stance, so neutral stays exactly at rest. |
| Hands and fingers | MediaPipe hand tracker drives all five fingers per hand (thumb included) with per-joint limits, so fingers cannot bend backwards or sideways at hinge joints. The rig's finger axes do not point at the next joint, which the solver accounts for. |
| Face | Face mesh drives head turn and tilt (more precise than ears and nose) and opens the jaw. The viewer gives the mandible and lower teeth their own jaw bone, hinged at the jaw joint. |
| Predictive toes | When the heel lifts and the ball of the foot stays down, the toes bend to stay on the floor. |
| Overlap analysis | Detects crossed arms, hands together, legs crossing, impossible limb lengths, sudden jumps and the hand tracker disagreeing with the body tracker. Each flagged frame is re-read several ways (as tracked, wrists swapped, arms swapped, predicted) and scored on bone lengths, motion, hand evidence and forearm-through-torso. While the risk lasts, a crop around the person also goes to a second worker running the heavy pose model, which adds a person silhouette to the scoring. |
| Spins and hidden limbs | Full turns stay continuous: back views (where trackers often swap left and right) are resolved by turn continuity and whether a face is visible. Hidden or out-of-frame limbs keep their momentum briefly, then ease into the person's own relaxed pose. |
| Clothing and body size | Calibration measures each person's segment lengths and neutral stance. Knees hidden by a dress or coat are inferred from hips and ankles; hidden elbows likewise. Arms reaching toward the camera get their depth back from the measured arm length. |
| Skinning modes | The Skinning menu (top right of the 3D view) switches between Smooth (original), Segmented (each muscle vertex rigid to one bone, PS1 look as in the Ranma VTuber models) and Seamless segmented (rigid inside segments, blended only in a narrow seam). On this rig, Seamless cuts blended muscle vertices from 24.3% to 6.5%. Skeletal bone meshes were already rigid. |
| Languages and the lesson | Every new control, metric and message is in English and French (public/src/i18n/strings.js). The elbow lesson runs on the new tracker: its one-arm calibration drives only the right upper arm and forearm. |
| Robustness | GPU inference falls back to the CPU by itself if a GPU frame stalls (seen in testing with software graphics). Calibration accepts slower frame rates. |

## Trying it

1. Start Movement Atlas and open Movement lab.
2. Start camera, then 1. Prepare pose tracking (the first load takes longer: body, hand and face models).
3. Stand facing the camera, arms relaxed, and press 2. Calibrate. Hold still for about a second.
4. Press 3. Start live anatomy.
5. Tracking detail switches: Body model (Full or Lite), Inference (Auto or CPU only), Hands and fingers, Face, Predict hidden limbs and turns, Overlap analysis, Predictive toes.
6. The preview shows hands in blue, face points in green, flagged overlaps in orange, predicted joints as orange rings, and the re-analysis crop as a dashed box.

## Files

New: `public/src/motion/body-state.js`, `overlap.js`, `hands.js`, `solver.js`, `rig.js`, `filters.js`, `frames.js`, `public/src/anatomy/skin-modes.js`, `tests/tracking.test.mjs`, `tests/helpers/synthetic.mjs`, this note, and four models in `public/vendor/mediapipe/` (pose full and heavy, hand, face).

Changed: `public/src/motion/retarget.js` (same methods, including the lesson's `segments` argument), `pose.js`, `pose-worker.js`, `pose-math.js` (additions only), `body-state.js`, `public/src/anatomy/viewer.js` (jaw bone, skin modes, pre-render hook), `public/src/app.js`, `public/index.html`, `public/styles.css`, `public/src/i18n/strings.js`, `README.md`, `web-app/README.md`, `web-app/ARCHITECTURE.md`, `asset-dependencies.json`.

## Tests

`.\runtime\node.exe --test tests/*.test.mjs` runs the whole suite; every existing test passes unchanged. The 13 tests in tests/tracking.test.mjs pose a copy of the real rig, render it as tracker output (including known tracker failures), and check the retargeted rig against the truth: resting and curled fingers, a full 360 degree spin with back-view left/right swaps (plus a control showing the old behaviour flips), knees hidden under a dress, swapped crossed wrists, momentum versus holding for a hidden arm, depth recovery for reaching, tiptoe toes, head turn and jaw, heavy-model corrections, skin weight modes, the hand label convention, and the lesson's one-arm calibration.

## Still to validate with people

Synthetic tests cannot replace real testers. Please check on the capsule hardware: GPU versus CPU frame rate with all models on; testers of different sizes and in dresses, skirts and long coats; fast spins; crossed arms and hands touching; and long hair over the shoulders. The root of the rig stays fixed, so walking, squatting depth and jumps are not shown as movement of the whole body.
