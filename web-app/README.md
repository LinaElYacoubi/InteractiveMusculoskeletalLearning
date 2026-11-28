# Movement Atlas web application · 0.1

For normal use, run **Start Movement Atlas.cmd** in the project/package's parent directory. It uses the included runtime, starts a loopback-only server and opens the application. Stop it with **Stop Movement Atlas.cmd**.

For development from this directory:

```powershell
.\runtime\node.exe server.mjs
.\runtime\node.exe --test tests/*.test.mjs
```

The default URL is http://127.0.0.1:4185/. Set MSK_PORT before starting to use another port. No npm install or build command is needed. After editing a module or stylesheet, reload the browser; there is no live-reload service.

All application files are in public/. To host a browser edition later, deploy that directory on an HTTPS static host. The local-only server, launcher, tests and runtime should not be uploaded as public website files. The current prototype has not been deployed.

The production app never requests the microphone, records video, or uploads camera frames. MediaPipe inference runs in local module workers. Auto mode tries the GPU and moves to the CPU if a GPU frame stalls or fails; choose CPU only in the Camera and tracking panel to skip the GPU entirely. Preparation has been checked in the browser; frame processing has been tested using Google's public pose test image. The real Bose VB1 and ARHT capsule workflow remains to be tested with hardware.

The developer-only public/qa/pose-check.html page runs a local inference check on a public Google sample. It is omitted from the portable package. Its fixture source is https://storage.googleapis.com/mediapipe-assets/pose.jpg and its use follows the upstream MediaPipe pose tests. It contains no user camera data.

Camera permissions are attached to browser origins, so switching ports or browsers may request camera permission again. Speech narration depends on local voices installed on the host computer. If local voices are unavailable, the information remains readable and the app explains the missing voice.

## Deploying to Netlify

`netlify.toml` at the repository root publishes `web-app/public` with no build step and sends the same security headers as `server.mjs` (tests/deploy.test.mjs keeps them in sync). In Netlify, import the GitHub repository and leave the build settings empty: the file supplies them. To deploy by hand instead, drag the `web-app/public` folder (not the whole project) onto Netlify Drop; custom headers don't apply in that case.

Netlify serves the site over HTTPS, which browsers require for camera access. Everything still runs in the visitor's browser: no camera video is sent to Netlify.

## English and French

The **English** and **Français** buttons in the header switch the whole interface, including the lesson. The choice is remembered in that browser. Interface text is in public/src/i18n/strings.js, information bank descriptions in public/src/data/knowledge.js, and lesson content in public/src/data/lessons/. Structure names from the 3D model keep their source names; only the side label is translated. tests/i18n.test.mjs fails if a key is missing a language or if the page uses a key that doesn't exist.

## Learn a movement (guided elbow and knee lessons)

Launch the server as shown above, open http://127.0.0.1:4185/ and wait for the model to load. Then choose **Learn a movement** in the header.

- **Content:** public/src/data/lessons/elbow-flexion.js and knee-flexion.js each hold the English and French text, sources, claim → source links, highlight rules (exact GLB `anatomy_name` values) and review status. Edit text there, not in the code.
- **Logic:** public/src/lesson/ contains:
  - lesson-controller.js: step flow, camera/tracking ownership and cleanup (DOM-free, tested in Node)
  - lesson-view.js: panel rendering
  - highlight.js: exact mesh matching with no substitution
  - lesson-content.js: translation lookup and the content validator
- **Tests:** tests/lesson.test.mjs checks step transitions, restart/exit cleanup, camera refusal and loss, listener cleanup, language switching, the question, content completeness, and that every highlight name exists in the real GLB.
- **Adding a lesson:** copy a lesson file, keep the same `ui` keys (a test checks this), set `clip`, `trackedSegments`, `trackedLandmarks`, `view` and `trackedGroup`, then add it to the `lessons` list in public/src/app.js. The introduction shows a picker when there is more than one lesson.
- **Review:** docs/elbow-lesson-expert-review.md and docs/knee-lesson-expert-review.md are the review sheets for the Kinesiology expert. Everything is marked pending review.

See ARCHITECTURE.md for module responsibilities and the main project README for limitations and the teaching workflow.
