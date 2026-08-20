const DEFAULT_CHANNEL_COUNT = 8;
const DEFAULT_SAMPLE_RATE = 48_000;
const DEFAULT_RATE_HZ = 1_000;
const DEFAULT_PULSE_WIDTH_MS = 4;
const DEFAULT_TARGET_CURRENT = 0.5;
const DEFAULT_DC_BLOCK_HZ = 2;
const MINIMUM_RATE_HZ = 1;
const MAXIMUM_RATE_HZ = 48_000;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function exponentialGap(random, rateHz) {
  return -Math.log(1 - random()) / rateHz;
}

function smoothCurrentLimit(rawCurrent) {
  const positive = Math.max(0, rawCurrent);
  return positive / (1 + positive);
}

export function createPoissonLedLabEngine({
  seed = "poisson-led-lab",
  channelCount = DEFAULT_CHANNEL_COUNT,
  sampleRate = DEFAULT_SAMPLE_RATE,
  rateHz = DEFAULT_RATE_HZ,
  pulseWidthMs = DEFAULT_PULSE_WIDTH_MS,
  targetCurrent = DEFAULT_TARGET_CURRENT,
  dcBlockHz = DEFAULT_DC_BLOCK_HZ,
} = {}) {
  const channels = Math.max(1, Math.floor(finite(channelCount, DEFAULT_CHANNEL_COUNT)));
  const samplesPerSecond = Math.max(1, finite(sampleRate, DEFAULT_SAMPLE_RATE));
  const random = createRandom(seed);
  const rawState = new Float64Array(channels);
  let totalRateHz = clamp(finite(rateHz, DEFAULT_RATE_HZ), MINIMUM_RATE_HZ, MAXIMUM_RATE_HZ);
  let pulseSeconds = clamp(finite(pulseWidthMs, DEFAULT_PULSE_WIDTH_MS), 0.05, 1_000) / 1_000;
  let target = clamp(finite(targetCurrent, DEFAULT_TARGET_CURRENT), 0.001, 0.95);
  let dcCutoffHz = clamp(finite(dcBlockHz, DEFAULT_DC_BLOCK_HZ), 0.1, 20);
  let timeToNextArrival = exponentialGap(random, totalRateHz);
  let previousFusedCurrent = 0;
  let previousAudio = 0;
  let elapsedSamples = 0;
  let totalArrivals = 0;

  function derived() {
    const expectedChannelRateHz = totalRateHz / channels;
    const rawTarget = target / (1 - target);
    return {
      decay: Math.exp(-1 / (samplesPerSecond * pulseSeconds)),
      eventInjection: rawTarget / (expectedChannelRateHz * pulseSeconds),
      dcBlockCoefficient: Math.exp(-2 * Math.PI * dcCutoffHz / samplesPerSecond),
      expectedChannelRateHz,
    };
  }

  function configure(settings = {}) {
    const previousRate = totalRateHz;
    if (settings.rateHz !== undefined) {
      totalRateHz = clamp(finite(settings.rateHz, totalRateHz), MINIMUM_RATE_HZ, MAXIMUM_RATE_HZ);
    }
    if (settings.pulseWidthMs !== undefined) {
      pulseSeconds = clamp(finite(settings.pulseWidthMs, pulseSeconds * 1_000), 0.05, 1_000) / 1_000;
    }
    if (settings.targetCurrent !== undefined) {
      target = clamp(finite(settings.targetCurrent, target), 0.001, 0.95);
    }
    if (settings.dcBlockHz !== undefined) {
      dcCutoffHz = clamp(finite(settings.dcBlockHz, dcCutoffHz), 0.1, 20);
    }
    if (totalRateHz !== previousRate) {
      timeToNextArrival = exponentialGap(random, totalRateHz);
    }
    return snapshot();
  }

  function render(frameCount) {
    const length = Math.max(0, Math.floor(finite(frameCount, 0)));
    const currentChannels = Array.from(
      { length: channels },
      () => new Float32Array(length),
    );
    const fusedCurrent = new Float32Array(length);
    const audioMonitor = new Float32Array(length);
    const arrivalsByChannel = Array(channels).fill(0);
    const { decay, eventInjection, dcBlockCoefficient } = derived();
    const secondsPerSample = 1 / samplesPerSecond;
    let arrivalCount = 0;
    let nearLimitSamples = 0;

    for (let sample = 0; sample < length; sample += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        rawState[channel] *= decay;
      }

      timeToNextArrival -= secondsPerSample;
      while (timeToNextArrival <= 0) {
        const channel = Math.min(channels - 1, Math.floor(random() * channels));
        const ageAtSampleEnd = -timeToNextArrival;
        rawState[channel] += eventInjection * Math.exp(-ageAtSampleEnd / pulseSeconds);
        arrivalsByChannel[channel] += 1;
        arrivalCount += 1;
        timeToNextArrival += exponentialGap(random, totalRateHz);
      }

      let fused = 0;
      for (let channel = 0; channel < channels; channel += 1) {
        const current = smoothCurrentLimit(rawState[channel]);
        currentChannels[channel][sample] = current;
        fused += current;
        if (current >= 0.98) nearLimitSamples += 1;
      }
      fused /= channels;
      fusedCurrent[sample] = fused;

      const acCurrent = fused - previousFusedCurrent + dcBlockCoefficient * previousAudio;
      audioMonitor[sample] = acCurrent;
      previousFusedCurrent = fused;
      previousAudio = acCurrent;
    }

    elapsedSamples += length;
    totalArrivals += arrivalCount;
    return Object.freeze({
      currentChannels: Object.freeze(currentChannels),
      fusedCurrent,
      audioMonitor,
      arrivalCount,
      arrivalsByChannel: Object.freeze(arrivalsByChannel),
      nearLimitSamples,
      channelSampleCount: length * channels,
    });
  }

  function snapshot() {
    const values = derived();
    return Object.freeze({
      channelCount: channels,
      sampleRate: samplesPerSecond,
      rateHz: totalRateHz,
      expectedChannelRateHz: values.expectedChannelRateHz,
      pulseWidthMs: pulseSeconds * 1_000,
      targetCurrent: target,
      dcBlockHz: dcCutoffHz,
      dcBlockCoefficient: values.dcBlockCoefficient,
      elapsedSamples,
      totalArrivals,
    });
  }

  function reset() {
    rawState.fill(0);
    timeToNextArrival = exponentialGap(random, totalRateHz);
    previousFusedCurrent = 0;
    previousAudio = 0;
    elapsedSamples = 0;
    totalArrivals = 0;
  }

  return Object.freeze({ configure, render, snapshot, reset });
}
