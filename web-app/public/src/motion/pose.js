// Schedules camera frames into the local tracking workers (one frame in flight at a time).
// The live worker returns body + hands + face; the optional analysis worker re-reads hard frames with the
// heavy pose model. Both receive bitmaps captured from the same video frame so results can be matched.
export const DEFAULT_TRACKING = Object.freeze({model: 'full', hands: true, face: true, analysis: true, delegate: 'auto'});

export class PoseDetection extends EventTarget {
  constructor(video) {
    super(); this.video = video; this.worker = null; this.ready = false; this.running = false; this.busy = false; this.previousTime = -1; this.preparing = null;
    this.options = {...DEFAULT_TRACKING}; this.analysis = {worker: null, ready: false, busy: false, preparing: null, roi: null};
    this.delegates = {}; this.sentAt = 0; this.fallingBack = null;
    this.watchdog = setInterval(() => this.checkStall(), 1000);
  }
  spawn(role, onMessage) {
    const worker = new Worker(new URL('./pose-worker.js', import.meta.url), {type: 'module', name: `atlas-${role}`});
    worker.onmessage = ({data}) => onMessage(data);
    return worker;
  }
  prepare(options = {}) {
    Object.assign(this.options, options);
    if (this.ready) return Promise.resolve(); if (this.preparing) return this.preparing;
    this.preparing = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.dispose(); reject(new Error('Tracking preparation timed out. Check that the bundled model and WASM files are available.')); }, 90000);
      this.worker = this.spawn('live', data => {
        if (data.type === 'ready') { clearTimeout(timeout); this.ready = true; this.preparing = null; this.delegates = data.delegates; resolve(); this.dispatchEvent(new CustomEvent('ready', {detail: data})); if (this.options.analysis) this.prepareAnalysis(); }
        if (data.type === 'delegate' || data.type === 'configured') { this.delegates = data.delegates; this.dispatchEvent(new CustomEvent('delegates', {detail: data.delegates})); }
        if (data.type === 'pose') { this.busy = false; this.sentAt = 0; this.dispatchEvent(new CustomEvent('pose', {detail: data})); }
        if (data.type === 'error') {
          clearTimeout(timeout); this.busy = false;
          if (!this.ready) { this.worker?.terminate(); this.worker = null; this.preparing = null; reject(new Error(data.message)); }
          this.dispatchEvent(new CustomEvent('failure', {detail: data.message}));
        }
      });
      this.worker.onerror = event => { clearTimeout(timeout); this.dispose(); reject(new Error(event.message || 'Pose tracking could not start.')); this.dispatchEvent(new CustomEvent('failure', {detail: event.message || 'Pose worker failed.'})); };
      this.worker.postMessage({type: 'prepare', role: 'live', options: {model: this.options.model, hands: this.options.hands, face: this.options.face, delegate: this.options.delegate}});
    });
    return this.preparing;
  }
  /** Heavy-model worker for overlap re-analysis. Failure only disables the analysis; live tracking continues. */
  prepareAnalysis() {
    const A = this.analysis;
    if (A.ready || A.preparing) return A.preparing;
    A.preparing = new Promise(resolve => {
      A.worker = this.spawn('analysis', data => {
        if (data.type === 'ready') { A.ready = true; A.preparing = null; this.dispatchEvent(new CustomEvent('analysis-ready', {detail: data})); resolve(true); }
        if (data.type === 'analysis') { A.busy = false; A.sentAt = 0; this.dispatchEvent(new CustomEvent('analysis', {detail: data})); }
        if (data.type === 'error') {
          A.busy = false;
          if (!A.ready) { A.worker?.terminate(); A.worker = null; A.preparing = null; this.dispatchEvent(new CustomEvent('analysis-failure', {detail: data.message})); resolve(false); }
        }
      });
      A.worker.onerror = event => { A.worker?.terminate(); A.worker = null; A.ready = false; A.preparing = null; this.dispatchEvent(new CustomEvent('analysis-failure', {detail: event.message || 'Analysis worker failed.'})); resolve(false); };
      A.worker.postMessage({type: 'prepare', role: 'analysis', options: {delegate: this.options.delegate}});
    });
    return A.preparing;
  }
  /** Live switches for hands/face (the worker loads models on first use). Body model changes need prepare() again. */
  configure(options) {
    Object.assign(this.options, options);
    if (this.worker && this.ready) this.worker.postMessage({type: 'configure', options: {hands: this.options.hands, face: this.options.face}});
    if (this.options.analysis && this.ready) this.prepareAnalysis();
  }
  /** roi in raw camera coordinates (0..1). The next captured frame is also sent, cropped, to the heavy model. */
  requestAnalysis(roi) { if (this.options.analysis && this.analysis.ready && !this.analysis.busy) this.analysis.roi = roi; }

  start() {
    if (!this.ready || this.running) return;
    this.running = true; this.previousTime = -1;
    if (typeof this.video.requestVideoFrameCallback === 'function') {
      const loop = () => { if (!this.running) return; this.pump(); this.frameRequest = this.video.requestVideoFrameCallback(loop); };
      this.frameRequest = this.video.requestVideoFrameCallback(loop);
      this.timer = setInterval(() => this.pump(), 250); // keeps going if the video element stops reporting frames
    } else this.timer = setInterval(() => this.pump(), 33);
  }
  async pump() {
    if (!this.running || !this.ready || this.busy || this.video.readyState < 2 || this.video.currentTime === this.previousTime) return;
    this.busy = true; this.previousTime = this.video.currentTime;
    try {
      const width = this.video.videoWidth, height = this.video.videoHeight, timestamp = performance.now();
      const bitmap = await createImageBitmap(this.video);
      let crop = null; const A = this.analysis, roi = A.roi;
      if (roi && A.ready && !A.busy && width && height) {
        A.roi = null;
        const sx = Math.round(roi.x * width), sy = Math.round(roi.y * height), sw = Math.max(16, Math.round(roi.w * width)), sh = Math.max(16, Math.round(roi.h * height));
        const scale = Math.min(1.6, 512 / Math.max(sw, sh));
        try { crop = await createImageBitmap(this.video, sx, sy, sw, sh, {resizeWidth: Math.round(sw * scale), resizeHeight: Math.round(sh * scale), resizeQuality: 'high'}); }
        catch { crop = null; }
        if (crop) { A.busy = true; A.sentAt = performance.now(); A.worker.postMessage({type: 'analyze', bitmap: crop, timestamp, roi: {x: sx / width, y: sy / height, w: sw / width, h: sh / height}}, [crop]); }
      }
      if (!this.running || !this.worker) { bitmap.close(); this.busy = false; return; }
      this.sentAt = performance.now();
      this.worker.postMessage({type: 'frame', bitmap, timestamp, width, height}, [bitmap]);
    } catch (error) { this.busy = false; this.dispatchEvent(new CustomEvent('failure', {detail: error.message})); }
  }
  /**
   * GPU inference inside a worker can stall on some graphics drivers without raising an error.
   * If a GPU frame does not come back in time, rebuild the worker on the CPU and carry on.
   */
  checkStall() {
    const now = performance.now(), onGpu = Object.values(this.delegates || {}).includes('GPU');
    if (this.busy && this.sentAt && onGpu && now - this.sentAt > 8000 && !this.fallingBack) this.fallbackToCpu();
    const A = this.analysis;
    if (A.busy && A.sentAt && now - A.sentAt > 15000) {
      this.disposeAnalysis(); this.dispatchEvent(new CustomEvent('analysis-failure', {detail: 'the heavy model stopped responding; retrying on the CPU'}));
      if (this.options.analysis) { const saved = this.options.delegate; this.options.delegate = 'cpu'; this.prepareAnalysis(); this.options.delegate = saved; }
    }
  }
  async fallbackToCpu() {
    const wasRunning = this.running;
    this.fallingBack = (async () => {
      this.dispose(); this.options.delegate = 'cpu';
      this.dispatchEvent(new CustomEvent('fallback', {detail: 'GPU inference stalled, so tracking moved to the CPU.'}));
      try { await this.prepare(); if (wasRunning) this.start(); }
      catch (error) { this.dispatchEvent(new CustomEvent('failure', {detail: error.message})); }
    })();
    try { await this.fallingBack; } finally { this.fallingBack = null; }
  }
  pause() {
    this.running = false; clearInterval(this.timer);
    if (this.frameRequest && this.video.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(this.frameRequest);
  }
  disposeAnalysis() { const A = this.analysis; A.worker?.terminate(); A.worker = null; A.ready = false; A.busy = false; A.preparing = null; A.roi = null; A.sentAt = 0; }
  dispose() { this.pause(); this.worker?.terminate(); this.worker = null; this.ready = false; this.busy = false; this.sentAt = 0; this.preparing = null; this.delegates = {}; this.disposeAnalysis(); }
}
