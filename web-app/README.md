# Movement Atlas web application · 0.1

For normal use, run **Start Movement Atlas.cmd** in the project/package's parent directory. It uses the included runtime, starts a loopback-only server and opens the application. Stop it with **Stop Movement Atlas.cmd**.

For development from this directory:

```powershell
.\runtime\node.exe server.mjs
.\runtime\node.exe --test tests/*.test.mjs
```

The default URL is http://127.0.0.1:4185/. Set MSK_PORT before starting to use another port. No npm install or build command is needed. After editing a module or stylesheet, reload the browser; there is no live-reload service.

All application files are in public/. To host a browser edition later, deploy that directory on an HTTPS static host. The local-only server, launcher, tests and runtime should not be uploaded as public website files. The current prototype has not been deployed.

The production app never requests the microphone, records video, or uploads camera frames. MediaPipe inference runs in a local module worker using the CPU backend. Preparation has been checked in the browser; frame processing has been tested using Google's public pose test image. The real Bose VB1 and ARHT capsule workflow remains to be tested with hardware.

The developer-only public/qa/pose-check.html page runs a local inference check on a public Google sample. It is omitted from the portable package. Its fixture source is https://storage.googleapis.com/mediapipe-assets/pose.jpg and its use follows the upstream MediaPipe pose tests. It contains no user camera data.

Camera permissions are attached to browser origins, so switching ports or browsers may request camera permission again. Speech narration depends on local voices installed on the host computer. If local voices are unavailable, the information remains readable and the app explains the missing voice.

See ARCHITECTURE.md for module responsibilities and the main project README for limitations and the teaching workflow.
