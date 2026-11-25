// One Euro filter (Casiez et al. 2012), ported from the Ranma VTuber tracker.
// Uses the exponential smoothing factor so a very large dt snaps straight to the input.
export class OneEuro {
  constructor(minCutoff = 1.5, beta = 1, derivativeCutoff = 1) {
    this.minCutoff = minCutoff; this.beta = beta; this.derivativeCutoff = derivativeCutoff;
    this.value = null; this.derivative = 0;
  }
  static alpha(cutoff, dt) { return 1 - Math.exp(-2 * Math.PI * cutoff * dt); }
  reset() { this.value = null; this.derivative = 0; }
  filter(x, dt) {
    if (this.value === null || !Number.isFinite(this.value) || !(dt > 0)) { this.value = x; this.derivative = 0; return x; }
    const dx = (x - this.value) / dt;
    this.derivative += OneEuro.alpha(this.derivativeCutoff, dt) * (dx - this.derivative);
    this.value += OneEuro.alpha(this.minCutoff + this.beta * Math.abs(this.derivative), dt) * (x - this.value);
    return this.value;
  }
}

export class VectorFilter {
  constructor(size, minCutoff = 1.5, beta = 1) { this.channels = Array.from({length: size}, () => new OneEuro(minCutoff, beta)); }
  setCutoff(minCutoff) { for (const channel of this.channels) channel.minCutoff = minCutoff; }
  reset() { for (const channel of this.channels) channel.reset(); }
  filter(values, dt) { return values.map((value, index) => this.channels[index].filter(value, dt)); }
}

/** Exponential approach with a time constant; dt >> tau snaps to the target. */
export function approach(current, target, dt, tau) { return tau <= 0 ? target : current + (target - current) * (1 - Math.exp(-dt / tau)); }
