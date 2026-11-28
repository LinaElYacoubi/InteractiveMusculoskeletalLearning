# Software layers

The application uses ES modules and a small Node static server. There is no build step or npm dependency installation. All runtime files are bundled locally.

| Layer | Module | Responsibility |
| --- | --- | --- |
| Anatomical assets | public/assets/ | Completed skinned GLB, joint map, branding |
| 3D rendering | public/src/anatomy/viewer.js | Scene, skinning, clips, camera, selection, layer visibility and framing |
| Camera acquisition | public/src/motion/camera.js | Device enumeration, opt-in streams, races/cancellation and track release |
| Pose detection | public/src/motion/pose.js + pose-worker.js | Live worker (body lite/full, hands, face) and analysis worker (heavy body model with person silhouette); one frame in flight; GPU with automatic CPU fallback when a GPU frame stalls |
| Pose interpretation | public/src/motion/pose-math.js | Confidence gates, mirror convention, landmark constants, calibration readiness, angle estimates |
| Body state | public/src/motion/body-state.js | Calibration (camera alignment, body proportions, neutral stance), spin handling, depth recovery, prediction of hidden limbs, knee and elbow inference, hands, face, predictive toes |
| Overlap analysis | public/src/motion/overlap.js | Detects crossing or touching limbs, scores competing readings of a frame and carries heavy-model corrections forward |
| Hands | public/src/motion/hands.js | Matches detected hands to sides (label convention checked on a sample image and learned online), finger joint limits |
| Solver | public/src/motion/solver.js + rig.js | Frame solver ported from the Ranma VTuber: hinge-aware arms and legs, torso split, clavicle rhythm, forearm twist split, fingers, toes, head and jaw |
| Rig retargeting | public/src/motion/retarget.js | Calibrate, ingest and update lifecycle; parent-first local targets; per-frame easing and rest recovery |
| Skinning modes | public/src/anatomy/skin-modes.js | Smooth, segmented and seamless segmented muscle weights, switchable at runtime |
| Teaching content | public/src/data/knowledge.js | Original source names, reviewed-later group context and explicit content gaps |
| Lesson content | public/src/data/lessons/elbow-flexion.js, knee-flexion.js | Bilingual draft text, sources, claim→source links, highlight rules by exact `anatomy_name`, review status |
| Guided lesson | public/src/lesson/ | DOM-free step controller (camera/tracking ownership, cleanup), exact highlight resolution, content validation, panel view |
| Narration | public/src/ui/speech.js | Local device voices, rate selection, start/cancel lifecycle |
| UI coordination | public/src/app.js | DOM events, inspector state, playback, calibration and tracked/demo modes |
| Presentation | public/index.html + styles.css | White display, red layer rail, responsive inspector and UHD layout |
| Local delivery | server.mjs + launch.mjs | Loopback static serving, correct MIME/range support, ownership-aware start/stop |

## Data path

CameraInput → ImageBitmap → live worker (body, hands, face) → BodyState (mirror, spin resolution, depth recovery, calibration rotation, overlap choice, filtering and prediction, bone-length constraints) → RigSolver (bone targets) → PoseRetargeter (local targets, eased every rendered frame) → skeleton → Three.js skinning → display.

When the overlap check flags a frame (limbs crossing, hands together, a limb length that does not fit, a sudden jump, or the hand tracker disagreeing with the body tracker), the next camera frame is also cropped around the person and sent to the analysis worker. Its heavy model reads the crop afresh in image mode and returns landmarks plus a person silhouette. BodyState scores the live reading, the heavy reading and left/right swapped variants against calibrated bone lengths, recent motion, hand-tracker evidence and silhouette coverage. A better reading becomes a short-lived correction that is offered to the following live frames as another candidate. Requests are rate limited to four per second and only happen while the risk persists.

Raw camera frames (and analysis crops) are transferred to the local workers and closed after inference. There is no camera upload or recording API. The static server only accepts GET/HEAD and serves the public directory plus a local health endpoint. It binds to 127.0.0.1. Its Content Security Policy permits local files and blob-backed embedded textures; it does not permit third-party network destinations.

The renderer and inference run independently. Rendering size follows the actual viewport using ResizeObserver, without a fixed landscape canvas. Demo clip framing includes its peak pose; clicking Fit body restores full-body framing. The UHD interface can operate even when an embedded browser does not allow the fullscreen API; use F11 in desktop Chrome/Edge for browser fullscreen if needed.

## Guided lesson integration

The lesson reuses the single viewer render loop, the shared CameraInput and PoseDetection instances, and the existing `Elbow_Flexion_R` and `Knee_Flexion_R` clips. It keeps its own PoseRetargeter, calibrated only on the lesson's `trackedSegments` (`upper_arm.R` and `forearm.R`, or `thigh.R` and `shin.R`) through the optional `segments` argument. Choosing another lesson leaves the current step first, so any lesson-owned camera is released. Movement lab's default full-body calibration is unchanged. With the upgraded tracker, bones outside the segment list stay at rest, a low-confidence opposite shoulder is accepted, and the lesson uses whatever tracking settings are selected in the Movement lab panel (it prepares the shared PoseDetection with them). Entering the lesson pauses Movement lab live anatomy. On exit the lesson restores the saved layer, coverage, clip, speed and rotation, fits the body and clears highlights and fading.

The controller records whether it started the camera and pose loop and releases only what it started. All of its listeners share one AbortController per tracking session. A pending camera request is cancelled through CameraInput's generation check. The viewer adds `setHighlight`/`clearHighlight` (which stack under selection), `setGhost`/`clearGhost`, `lookFrom` and `frameParts`.

## Coordinate conventions

The GLB is in meters with Y up and anatomical anterior toward +Z. Pose landmarks arrive in MediaPipe camera coordinates. Conversion is (x, -y, -z); mirror mode swaps paired landmark IDs and reflects X.

Calibration averages about a second of frames. It measures a rotation that aligns the person's torso with the rig's torso (removing camera tilt and the angle the person stood at), the person's segment lengths, and their relaxed neutral stance. Joints the camera could not see are filled from the rig's own proportions, scaled to the person.

Each segment is described by a frame: a main direction plus a secondary one (the elbow or knee hinge, the shoulder line, and so on). A bone's world rotation is the change from its neutral frame to its current frame, applied to the bone's rest orientation; local targets are then computed parent first and eased toward every rendered frame. Hands and fingers use absolute palm frames from the hand tracker, so palm orientation at calibration does not matter. Finger bones flex about their local X axis within per-joint limits; this rig's finger axes do not point exactly at the next joint, so each segment's rest direction is stored separately.

Retargeting tracks one person: torso, arms, legs, feet, fingers, head and jaw, with predictive toes. It infers no muscle forces or patient-specific joint mechanics. Hidden limbs keep their momentum briefly, then ease into the person's calibrated neutral; sustained loss of the whole body eases the rig toward rest. The root remains fixed (no walking or jumping translation). Predicted, inferred and back-view poses are estimates and are marked in the camera preview. Camera viewing angle, occlusion, clothing and monocular depth remain limitations to assess on site.

## Asset ownership

The supplied anatomical archive is authoritative and remains unchanged. The web GLB is a copy of its completed export; anatomy edits belong in the completed Blender asset workflow, followed by an updated export and compatibility checks. Mirror provenance remains attached to every exported anatomy mesh.

Vendor code is isolated under public/vendor. Three.js 0.170.0 and MediaPipe Tasks Vision 1.2.2 are pinned, with license notices. The bundled models are Google's float16 version 1 pose_landmarker lite, full and heavy, hand_landmarker and face_landmarker (Apache 2.0, like the MediaPipe runtime). The portable runtime is Node 24.22.1 for Windows x64, with the official Node license notice. Asset hashes are recorded in the project dependency manifest.

## Planned follow-on modules

1. Capsule validation: camera view, lighting, full-body coverage, latency and display fit.
2. Biomechanist review: reference poses, axes, movement limits and muscle deformation corrections.
3. Teaching activities: selected movements, annotations, bilingual content and instructional guidance.
4. Optional delivery: Electron wrapper, managed content updates or a hosted browser edition using the same renderer/content modules.
