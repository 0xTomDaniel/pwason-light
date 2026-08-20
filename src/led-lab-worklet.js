import { createPoissonLedLabEngine } from "./led-current-engine.js";

const REPORT_FRAMES = 768;
const CHANNEL_COUNT = 8;

class PoissonLedLabProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.engine = createPoissonLedLabEngine({
      ...options.processorOptions,
      sampleRate,
    });
    this.running = true;
    this.reportSamples = 0;
    this.reportArrivals = 0;
    this.reportNearLimit = 0;
    this.currentSum = new Float64Array(CHANNEL_COUNT + 1);
    this.currentEnergy = new Float64Array(CHANNEL_COUNT + 1);
    this.currentPeak = new Float64Array(CHANNEL_COUNT + 1);
    this.scopeSamples = [];
    this.port.onmessage = ({ data }) => {
      if (data?.type === "configure") this.engine.configure(data.settings);
      if (data?.type === "reset") {
        this.engine.reset();
        this.resetReport();
      }
      if (data?.type === "stop") this.running = false;
    };
  }

  resetReport() {
    this.reportSamples = 0;
    this.reportArrivals = 0;
    this.reportNearLimit = 0;
    this.currentSum.fill(0);
    this.currentEnergy.fill(0);
    this.currentPeak.fill(0);
    this.scopeSamples = [];
  }

  accumulate(block) {
    const length = block.fusedCurrent.length;
    for (let sample = 0; sample < length; sample += 1) {
      let fused = block.fusedCurrent[sample];
      for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
        const current = block.currentChannels[channel][sample];
        this.currentSum[channel] += current;
        this.currentEnergy[channel] += current * current;
        this.currentPeak[channel] = Math.max(this.currentPeak[channel], current);
      }
      this.currentSum[CHANNEL_COUNT] += fused;
      this.currentEnergy[CHANNEL_COUNT] += fused * fused;
      this.currentPeak[CHANNEL_COUNT] = Math.max(this.currentPeak[CHANNEL_COUNT], fused);
      this.scopeSamples.push(fused);
    }
    this.reportSamples += length;
    this.reportArrivals += block.arrivalCount;
    this.reportNearLimit += block.nearLimitSamples;
  }

  publishReport() {
    if (this.reportSamples < REPORT_FRAMES) return;
    const sampleCount = this.reportSamples;
    const levels = Array.from(this.currentSum, sum => sum / sampleCount);
    const modulationRms = Array.from(
      this.currentEnergy,
      (energy, index) => Math.sqrt(Math.max(0, energy / sampleCount - levels[index] ** 2)),
    );
    const scope = Float32Array.from(this.scopeSamples);
    this.port.postMessage({
      type: "current-frame",
      levels,
      modulationRms,
      peaks: Array.from(this.currentPeak),
      arrivalCount: this.reportArrivals,
      sampleCount,
      nearLimitFraction: this.reportNearLimit / (sampleCount * CHANNEL_COUNT),
      scope,
      engine: this.engine.snapshot(),
    }, [scope.buffer]);
    this.resetReport();
  }

  process(_inputs, outputs) {
    if (!this.running) return false;
    const output = outputs[0];
    const frameCount = output[0]?.length ?? 128;
    const block = this.engine.render(frameCount);
    for (const channel of output) channel.set(block.audioMonitor);
    this.accumulate(block);
    this.publishReport();
    return true;
  }
}

registerProcessor("poisson-led-lab", PoissonLedLabProcessor);
