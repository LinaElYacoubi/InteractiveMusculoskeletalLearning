app is deloyed in netlify and gets updated with changes automatically when we push to github : https://interactivemusculoskeletal.netlify.app/

# INNOVA Movement Atlas · 0.1

1. Extract the entire ZIP to a folder on a Windows x64 computer. Keep its files together.
2. Double-click **Start Movement Atlas.cmd**. A bundled Node runtime starts the local app and opens your browser at http://127.0.0.1:4185/.
3. Use **Stop Movement Atlas.cmd** when finished. This stops only a server started by the launcher.

No Node/npm installation, internet hosting, or Blender installation is required to use the web app. Use current Chrome or Edge with WebGL 2 support. Local narration needs an installed Windows speech voice. Files can be copied to the capsule computer as a complete folder.

Explore anatomy includes bones, muscles and combined layers; original-only coverage; structure search/selection; floating labels and automatic focus; narration voice/speed; and four synthetic demo animations. Use UHD display for the large portrait layout. If fullscreen is unavailable inside an embedded browser, open the app in desktop Chrome/Edge and use F11.

Movement lab includes opt-in camera preview, camera selection, local body, hand and face tracking, neutral calibration and experimental live rig retargeting. Start the camera, prepare tracking, stand facing the camera with arms relaxed, calibrate (hold still for about a second), then start live anatomy. Changing mirror mode needs recalibration. Stop releases the camera. No recording or video upload is implemented.

**Learn a movement / Apprendre un mouvement** is a guided, bilingual (EN/FR) activity with two lessons: bending and straightening the right elbow, and bending and straightening the right knee (a standing knee curl, holding a chair or wall for balance). To open it:

1. Start the app with **Start Movement Atlas.cmd**. Developers can instead run `.\runtime\node.exe server.mjs` from web-app/ and open http://127.0.0.1:4185/.
2. Wait for the model to load. The **Learn a movement** tab stays disabled until then.
3. Choose **Learn a movement** in the header. On the introduction, choose **Elbow** or **Knee**. Use **EN / FR** at the top of the lesson panel to switch language at any time.

The lesson has five steps: Introduction → Watch the movement (scripted demonstration) → Try it yourself (optional camera, or use the demonstration instead) → Understand the movement (proposed structure highlights) → Check your understanding (one question). **Back**, **Restart**, **Sources** and **Exit** are always at the bottom of the panel.

- **Camera.** The camera starts only when the visitor chooses. The elbow lesson tracks only the visitor's right shoulder, elbow and wrist, so the full body need not be visible. The knee lesson tracks the right hip, knee and ankle, so the visitor must stand far enough back for their feet to be in view. The visitor's right limb drives the model's right limb, while the preview is shown like a mirror. The activity is never marked complete automatically: the visitor chooses "I'm ready to continue". Leaving the step, restarting, exiting or switching tabs stops any camera and tracking the lesson started. A camera that was already running in Movement lab is left running.
- **Layout.** The lesson works in the laptop layout, in portrait layouts (the lesson panel sits below the model) and in UHD display mode. UHD display mode hides the header tabs, so open the lesson before entering UHD.
- **Review status.** All educational content is a draft awaiting Kinesiology review. Each visitor sees "Educational prototype — content awaiting Kinesiology review." Content, sources and review status live in web-app/public/src/data/lessons/elbow-flexion.js and knee-flexion.js. The review sheets for the expert are web-app/docs/elbow-lesson-expert-review.md and knee-lesson-expert-review.md.

The retargeter (adapted from the Ranma VTuber tracker) drives the torso, arms, legs, feet, fingers, head turn and jaw, with predictive toes. It handles full turns (back views where the tracker swaps left and right), predicts limbs that are hidden or out of frame, infers knees under dresses or coats, measures each person's proportions at calibration, and re-checks overlapping limbs with a heavier local model. Tracking detail switches in the Camera and tracking panel turn each part on or off. The Skinning menu compares smooth, segmented (PS1 style) and seamless segmented muscle deformation. It does not track root translation and does not measure muscle activity or validated clinical joint motion. Source muscles remain incomplete; mirrored anatomy is labelled. The physical Bose VB1/ARHT capsule workflow and latency still need on-device verification with the teaching team.

Source modules, tests and architecture notes are in web-app/. The completed editable Blender asset package is maintained separately in the Musculoskeletal Project folder. This ZIP includes the rigged GLB required for playback, all browser dependencies and the Windows runtime.

