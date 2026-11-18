# Software layers

The application uses ES modules and a small Node static server. There is no build step or npm dependency installation. All runtime files are bundled locally.

| Layer | Module | Responsibility |
| --- | --- | --- |
| Anatomical assets | public/assets/ | Completed skinned GLB, joint map, branding |
| 3D rendering | public/src/anatomy/viewer.js | Scene, skinning, clips, camera, selection, layer visibility and framing |
| Camera acquisition | public/src/motion/camera.js | Device enumeration, opt-in streams, races/cancellation and track release |
| Pose detection | public/src/motion/pose.js + pose-worker.js | Single-frame-in-flight scheduling, local CPU inference, readiness and error recovery |
| Pose interpretation | public/src/motion/pose-math.js | Confidence gates, mirror convention, directions and angle estimates |
| Rig retargeting | public/src/motion/retarget.js | Neutral calibration offsets, parent-aware joint rotation, smoothing and rest recovery |
| Teaching content | public/src/data/knowledge.js | Original source names, reviewed-later group context and explicit content gaps |
| Lesson content | public/src/data/lessons/elbow-flexion.js | Bilingual draft text, sources, claim→source links, highlight rules by exact `anatomy_name`, review status |
| Guided lesson | public/src/lesson/ | DOM-free step controller (camera/tracking ownership, cleanup), exact highlight resolution, content validation, panel view |
| Narration | public/src/ui/speech.js | Local device voices, rate selection, start/cancel lifecycle |
| UI coordination | public/src/app.js | DOM events, inspector state, playback, calibration and tracked/demo modes |
| Presentation | public/index.html + styles.css | White display, red layer rail, responsive inspector and UHD layout |
| Local delivery | server.mjs + launch.mjs | Loopback static serving, correct MIME/range support, ownership-aware start/stop |

## Data path

CameraInput → ImageBitmap → PoseDetection worker → confidence-filtered landmarks → neutral calibration → PoseRetargeter → existing skeleton → Three.js skinning → display.

Raw camera frames are transferred to the local worker and closed after inference. There is no camera upload or recording API. The static server only accepts GET/HEAD and serves the public directory plus a local health endpoint. It binds to 127.0.0.1. Its Content Security Policy permits local files and blob-backed embedded textures; it does not permit third-party network destinations.

The renderer and inference run independently. Rendering size follows the actual viewport using ResizeObserver, without a fixed landscape canvas. Demo clip framing includes its peak pose; clicking Fit body restores full-body framing. The UHD interface can operate even when an embedded browser does not allow the fullscreen API; use F11 in desktop Chrome/Edge for browser fullscreen if needed.

## Guided lesson integration

The lesson reuses the single viewer render loop, the shared CameraInput and PoseDetection instances, and the existing elbow clip. It keeps its own PoseRetargeter, calibrated on `upper_arm.R` and `forearm.R` only through the optional `segments` argument. Movement lab's default full-body calibration is unchanged. Entering the lesson pauses Movement lab live anatomy. On exit the lesson restores the saved layer, coverage, clip, speed and rotation, fits the body and clears highlights and fading.

The controller records whether it started the camera and pose loop and releases only what it started. All of its listeners share one AbortController per tracking session. A pending camera request is cancelled through CameraInput's generation check. The viewer adds `setHighlight`/`clearHighlight` (which stack under selection), `setGhost`/`clearGhost`, `lookFrom` and `frameParts`.

## Coordinate conventions

The GLB is in meters with Y up and anatomical anterior toward +Z. Pose landmarks arrive in MediaPipe camera coordinates. Conversion is (x, -y, -z); mirror mode swaps paired landmark IDs and reflects X. Each target direction receives a neutral-pose calibration offset. A rotation from the rig's rest direction to that target is transformed through the current parent's world orientation before updating the local bone quaternion.

Retargeting is deliberately limited to one person, relative limb directions and torso lean, with no inferred muscle forces or patient-specific joint mechanics. Low-confidence segments are held; sustained body tracking loss eases the rig toward rest. The root remains fixed. Camera viewing angle, occlusion and monocular depth estimation are expected limitations to assess on site.

## Asset ownership

The supplied anatomical archive is authoritative and remains unchanged. The web GLB is a copy of its completed export; anatomy edits belong in the completed Blender asset workflow, followed by an updated export and compatibility checks. Mirror provenance remains attached to every exported anatomy mesh.

Vendor code is isolated under public/vendor. Three.js 0.170.0 and MediaPipe Tasks Vision 1.2.2 are pinned, with license notices. The pose model is Google's pose_landmarker_lite float16 version 1. The portable runtime is Node 24.22.1 for Windows x64, with the official Node license notice. Asset hashes are recorded in the project dependency manifest.

## Planned follow-on modules

1. Capsule validation: camera view, lighting, full-body coverage, latency and display fit.
2. Biomechanist review: reference poses, axes, movement limits and muscle deformation corrections.
3. Teaching activities: selected movements, annotations, bilingual content and instructional guidance.
4. Optional delivery: Electron wrapper, managed content updates or a hosted browser edition using the same renderer/content modules.
