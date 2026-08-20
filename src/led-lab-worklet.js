import { createLedLabComparisonEngine } from "./led-lab-comparison-engine.js";

const REPORT_FRAMES = 768;
const CHANNEL_COUNT = 8;
const CONDITION_NAMES = ["poisson", "pwm"];

function createAccumulator() {
  return {
    events: 0,
    nearLimit: 0,
    currentSum: new Float64Array(CHANNEL_COUNT + 1),
    currentEnergy: new Float64Array(CHANNEL_COUNT + 1),
    currentPeak: new Float64Array(CHANNEL_COUNT + 1),
    scopeSamples: [],
    audioScopeSamples: [],
    eventKind: "",
  };
}

class PoissonLedLabProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.engine = createLedLabComparisonEngine({
      ...options.processorOptions,
      sampleRate,
    });
    this.running = true;
    this.reportSamples = 0;
    this.accumulators = Object.fromEntries(
      CONDITION_NAMES.map(name => [name, createAccumulator()]),
    );
    this.port.onmessage = ({ data }) => {
      if (data?.type === "configure") {
        const before = this.engine.snapshot().monitorSource;
        const next = this.engine.configure(data.settings);
        if (next.monitorSource !== before) this.resetReport();
      }
      if (data?.type === "reset") {
        this.engine.reset();
        this.resetReport();
      }
      if (data?.type === "stop") this.running = false;
    };
  }

  resetReport() {
    this.reportSamples = 0;
    this.accumulators = Object.fromEntries(
      CONDITION_NAMES.map(name => [name, createAccumulator()]),
    );
  }

  accumulateCondition(accumulator, block) {
    const length = block.fusedCurrent.length;
    for (let sample = 0; sample < length; sample += 1) {
      const fused = block.fusedCurrent[sample];
      for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
        const current = block.currentChannels[channel][sample];
        accumulator.currentSum[channel] += current;
        accumulator.currentEnergy[channel] += current * current;
        accumulator.currentPeak[channel] = Math.max(accumulator.currentPeak[channel], current);
      }
      accumulator.currentSum[CHANNEL_COUNT] += fused;
      accumulator.currentEnergy[CHANNEL_COUNT] += fused * fused;
      accumulator.currentPeak[CHANNEL_COUNT] = Math.max(accumulator.currentPeak[CHANNEL_COUNT], fused);
      accumulator.scopeSamples.push(fused);
      accumulator.audioScopeSamples.push(block.audioMonitor[sample]);
    }
    accumulator.events += block.eventCount;
    accumulator.eventKind = block.eventKind;
    accumulator.nearLimit += block.nearLimitSamples;
  }

  summarizeCondition(name, sampleCount) {
    const accumulator = this.accumulators[name];
    const levels = Array.from(accumulator.currentSum, sum => sum / sampleCount);
    const modulationRms = Array.from(
      accumulator.currentEnergy,
      (energy, index) => Math.sqrt(Math.max(0, energy / sampleCount - levels[index] ** 2)),
    );
    return {
      levels,
      modulationRms,
      peaks: Array.from(accumulator.currentPeak),
      eventCount: accumulator.events,
      eventKind: accumulator.eventKind,
      nearLimitFraction: accumulator.nearLimit / (sampleCount * CHANNEL_COUNT),
      scope: Float32Array.from(accumulator.scopeSamples),
      audioScope: Float32Array.from(accumulator.audioScopeSamples),
    };
  }

  publishReport() {
    if (this.reportSamples < REPORT_FRAMES) return;
    const snapshot = this.engine.snapshot();
    const conditions = Object.fromEntries(
      CONDITION_NAMES.map(name => [name, this.summarizeCondition(name, this.reportSamples)]),
    );
    const transfers = CONDITION_NAMES.flatMap(name => [
      conditions[name].scope.buffer,
      conditions[name].audioScope.buffer,
    ]);
    this.port.postMessage({
      type: "current-frame",
      sampleCount: this.reportSamples,
      monitorSource: snapshot.monitorSource,
      conditions,
      engine: snapshot,
    }, transfers);
    this.resetReport();
  }

  process(_inputs, outputs) {
    if (!this.running) return false;
    const output = outputs[0];
    const frameCount = output[0]?.length ?? 128;
    const block = this.engine.render(frameCount);
    for (const channel of output) channel.set(block.audioMonitor);
    for (const name of CONDITION_NAMES) {
      this.accumulateCondition(this.accumulators[name], block.conditions[name]);
    }
    this.reportSamples += frameCount;
    this.publishReport();
    return true;
  }
}

registerProcessor("poisson-led-lab", PoissonLedLabProcessor);
