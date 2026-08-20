const DEFAULT_CHANNEL_COUNT = 8;
const DEFAULT_SAMPLE_RATE = 48_000;
const DEFAULT_RATE_HZ = 1_000;
const DEFAULT_PULSE_WIDTH_MS = 4;
const DEFAULT_TARGET_CURRENT = 0.5;
const MINIMUM_RATE_HZ = 1;
const MAXIMUM_RATE_HZ = 48_000;
const DRIVE_SOURCES = new Set(["poisson", "pwm"]);

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
  source = "poisson",
} = {}) {
  const channels = Math.max(1, Math.floor(finite(channelCount, DEFAULT_CHANNEL_COUNT)));
  const samplesPerSecond = Math.max(1, finite(sampleRate, DEFAULT_SAMPLE_RATE));
  const random = createRandom(seed);
  const rawState = new Float64Array(channels);
  let totalRateHz = clamp(finite(rateHz, DEFAULT_RATE_HZ), MINIMUM_RATE_HZ, MAXIMUM_RATE_HZ);
  let pulseSeconds = clamp(finite(pulseWidthMs, DEFAULT_PULSE_WIDTH_MS), 0.05, 1_000) / 1_000;
  let target = clamp(finite(targetCurrent, DEFAULT_TARGET_CURRENT), 0.001, 1);
  if (!DRIVE_SOURCES.has(source)) {
    throw new TypeError(`Unknown LED lab drive source: ${source}`);
  }
  let currentSource = source;
  let timeToNextArrival = exponentialGap(random, totalRateHz);
  let pwmPhase = 0;
  let elapsedSamples = 0;
  let totalEvents = 0;

  function derived() {
    const expectedChannelRateHz = totalRateHz / channels;
    const rawTarget = target < 1 ? target / (1 - target) : 0;
    return {
      decay: Math.exp(-1 / (samplesPerSecond * pulseSeconds)),
      eventInjection: rawTarget / (expectedChannelRateHz * pulseSeconds),
      expectedChannelRateHz,
      pwmFrequencyHz: expectedChannelRateHz,
    };
  }

  function resetExperiment() {
    rawState.fill(0);
    timeToNextArrival = exponentialGap(random, totalRateHz);
    pwmPhase = 0;
    elapsedSamples = 0;
    totalEvents = 0;
  }

  function configure(settings = {}) {
    const previousRate = totalRateHz;
    const previousSource = currentSource;
    if (settings.source !== undefined) {
      if (!DRIVE_SOURCES.has(settings.source)) {
        throw new TypeError(`Unknown LED lab drive source: ${settings.source}`);
      }
      currentSource = settings.source;
    }
    if (settings.rateHz !== undefined) {
      totalRateHz = clamp(finite(settings.rateHz, totalRateHz), MINIMUM_RATE_HZ, MAXIMUM_RATE_HZ);
    }
    if (settings.pulseWidthMs !== undefined) {
      pulseSeconds = clamp(finite(settings.pulseWidthMs, pulseSeconds * 1_000), 0.05, 1_000) / 1_000;
    }
    if (settings.targetCurrent !== undefined) {
      target = clamp(finite(settings.targetCurrent, target), 0.001, 1);
    }
    if (currentSource !== previousSource) {
      resetExperiment();
    } else if (totalRateHz !== previousRate && currentSource === "poisson") {
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
    const eventsByChannel = Array(channels).fill(0);
    const { decay, eventInjection } = derived();
    const secondsPerSample = 1 / samplesPerSecond;
    let eventCount = 0;
    let nearLimitSamples = 0;

    for (let sample = 0; sample < length; sample += 1) {
      let fused = 0;
      if (currentSource === "pwm") {
        const current = pwmPhase < target ? 1 : 0;
        for (let channel = 0; channel < channels; channel += 1) {
          currentChannels[channel][sample] = current;
          fused += current;
          if (current >= 0.98) nearLimitSamples += 1;
        }
        pwmPhase += (totalRateHz / channels) * secondsPerSample;
        const completedCycles = Math.floor(pwmPhase);
        if (completedCycles > 0) {
          pwmPhase -= completedCycles;
          for (let channel = 0; channel < channels; channel += 1) {
            eventsByChannel[channel] += completedCycles;
          }
          eventCount += completedCycles * channels;
        }
      } else {
        for (let channel = 0; channel < channels; channel += 1) {
          rawState[channel] *= decay;
        }
        timeToNextArrival -= secondsPerSample;
        while (timeToNextArrival <= 0) {
          const channel = Math.min(channels - 1, Math.floor(random() * channels));
          const ageAtSampleEnd = -timeToNextArrival;
          rawState[channel] += eventInjection * Math.exp(-ageAtSampleEnd / pulseSeconds);
          eventsByChannel[channel] += 1;
          eventCount += 1;
          timeToNextArrival += exponentialGap(random, totalRateHz);
        }
        for (let channel = 0; channel < channels; channel += 1) {
          const current = target >= 1 ? 1 : smoothCurrentLimit(rawState[channel]);
          currentChannels[channel][sample] = current;
          fused += current;
          if (current >= 0.98) nearLimitSamples += 1;
        }
      }
      fused /= channels;
      fusedCurrent[sample] = fused;

      audioMonitor[sample] = fused - target;
    }

    elapsedSamples += length;
    totalEvents += eventCount;
    return Object.freeze({
      currentChannels: Object.freeze(currentChannels),
      fusedCurrent,
      audioMonitor,
      eventCount,
      eventsByChannel: Object.freeze(eventsByChannel),
      eventKind: currentSource === "pwm"
        ? (target >= 1 ? "PWM cycles · full DC" : "PWM rising edges")
        : "Poisson Arrivals",
      arrivalCount: eventCount,
      arrivalsByChannel: Object.freeze([...eventsByChannel]),
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
      source: currentSource,
      pwmFrequencyHz: values.pwmFrequencyHz,
      elapsedSamples,
      totalEvents,
      totalArrivals: totalEvents,
    });
  }

  function reset() {
    resetExperiment();
  }

  return Object.freeze({ configure, render, snapshot, reset });
}
