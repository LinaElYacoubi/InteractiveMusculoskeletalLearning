# INNOVA Movement Atlas · 0.1

1. Extract the entire ZIP to a folder on a Windows x64 computer. Keep its files together.
2. Double-click **Start Movement Atlas.cmd**. A bundled Node runtime starts the local app and opens your browser at http://127.0.0.1:4185/.
3. Use **Stop Movement Atlas.cmd** when finished. This stops only a server started by the launcher.

No Node/npm installation, internet hosting, or Blender installation is required to use the web app. Use current Chrome or Edge with WebGL 2 support. Local narration needs an installed Windows speech voice. Files can be copied to the capsule computer as a complete folder.

Explore anatomy includes bones, muscles and combined layers; original-only coverage; structure search/selection; floating labels and automatic focus; narration voice/speed; and four synthetic demo animations. Use UHD display for the large portrait layout. If fullscreen is unavailable inside an embedded browser, open the app in desktop Chrome/Edge and use F11.

Movement lab includes opt-in camera preview, camera selection, local pose detection, neutral calibration and experimental live rig retargeting. Start the camera, prepare tracking, stand with the full body visible and arms relaxed, calibrate, then start live anatomy. Changing mirror mode needs recalibration. Stop releases the camera. No recording or video upload is implemented.

**Learn a movement / Apprendre un mouvement** is a guided, bilingual (EN/FR) activity on bending and straightening the right elbow. To open it:

1. Start the app with **Start Movement Atlas.cmd**. Developers can instead run `.\runtime\node.exe server.mjs` from web-app/ and open http://127.0.0.1:4185/.
2. Wait for the model to load. The **Learn a movement** tab stays disabled until then.
3. Choose **Learn a movement** in the header. Use **EN / FR** at the top of the lesson panel to switch language at any time.

The lesson has five steps: Introduction → Watch the movement (scripted demonstration) → Try it yourself (optional camera, or use the demonstration instead) → Understand the movement (proposed structure highlights) → Check your understanding (one question). **Back**, **Restart**, **Sources** and **Exit** are always at the bottom of the panel.

- **Camera.** The camera starts only when the visitor chooses. The lesson tracks only the visitor's right shoulder, elbow and wrist, so the full body need not be visible. The visitor's right arm drives the model's right arm, while the preview is shown like a mirror. The activity is never marked complete automatically: the visitor chooses "I'm ready to continue". Leaving the step, restarting, exiting or switching tabs stops any camera and tracking the lesson started. A camera that was already running in Movement lab is left running.
- **Layout.** The lesson works in the laptop layout, in portrait layouts (the lesson panel sits below the model) and in UHD display mode. UHD display mode hides the header tabs, so open the lesson before entering UHD.
- **Review status.** All educational content is a draft awaiting Kinesiology review. Each visitor sees "Educational prototype — content awaiting Kinesiology review." Content, sources and review status live in web-app/public/src/data/lessons/elbow-flexion.js. The review sheet for the expert is web-app/docs/elbow-lesson-expert-review.md.

The first retargeter drives limb directions and a simplified torso lean. It does not track root translation, independent hand/foot orientation or fingers. It does not measure muscle activity or validated clinical joint motion. Source muscles remain incomplete; mirrored anatomy is labelled. The physical Bose VB1/ARHT capsule workflow and latency still need on-device verification with the teaching team.

Source modules, tests and architecture notes are in web-app/. The completed editable Blender asset package is maintained separately in the Musculoskeletal Project folder. This ZIP includes the rigged GLB required for playback, all browser dependencies and the Windows runtime.
=======
# InteractiveMusculoskeletalLearning
Interactive Musculoskeletal Learning Experience

