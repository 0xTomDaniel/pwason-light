const DEFAULT_CHANNEL_COUNT = 8;
const DEFAULT_CURRENT_SENSITIVITY = 32;
const OPTICAL_CURRENT_MODES = new Set(["additive", "subtractive"]);

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function smoothCurrentLimit(value) {
  const positive = Math.max(0, value);
  return positive / (1 + positive);
}

export function createOpticalDriveRenderer({
  channelCount = DEFAULT_CHANNEL_COUNT,
  sensitivity = DEFAULT_CURRENT_SENSITIVITY,
  mode = "additive",
} = {}) {
  const channels = Math.max(1, Math.floor(finite(channelCount, DEFAULT_CHANNEL_COUNT)));
  const fixedSensitivity = Math.max(0, finite(sensitivity, DEFAULT_CURRENT_SENSITIVITY));
  if (!OPTICAL_CURRENT_MODES.has(mode)) {
    throw new TypeError(`Unknown optical current mode: ${mode}`);
  }
  let currentSum = new Float64Array(channels + 1);
  let currentEnergy = new Float64Array(channels + 1);
  let diagnosticFrames = 0;

  function process(signedChannels) {
    if (!Array.isArray(signedChannels) || signedChannels.length !== channels) {
      throw new TypeError(`Optical drive requires exactly ${channels} signed Channel buses.`);
    }
    const length = signedChannels[0]?.length ?? 0;
    if (!signedChannels.every(samples => samples?.length === length)) {
      throw new TypeError("Optical drive Channel buses must have equal lengths.");
    }

    for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
      let aggregateCurrent = 0;
      for (let channel = 0; channel < channels; channel += 1) {
        const signed = finite(signedChannels[channel][sampleIndex], 0);
        const additiveCurrent = smoothCurrentLimit(
          fixedSensitivity * Math.abs(signed),
        );
        const current = mode === "subtractive"
          ? 1 - additiveCurrent
          : additiveCurrent;
        currentSum[channel] += current;
        currentEnergy[channel] += current * current;
        aggregateCurrent += current;
      }
      aggregateCurrent /= channels;
      currentSum[channels] += aggregateCurrent;
      currentEnergy[channels] += aggregateCurrent * aggregateCurrent;
      diagnosticFrames += 1;
    }
  }

  function snapshot({ resetDiagnostics = false } = {}) {
    const divisor = Math.max(1, diagnosticFrames);
    const result = Object.freeze({
      levels: Object.freeze(
        Array.from(currentSum, sum => sum / divisor),
      ),
      currentRms: Object.freeze(
        Array.from(currentEnergy, energy => Math.sqrt(energy / divisor)),
      ),
      sensitivity: fixedSensitivity,
      mode,
      sampleCount: diagnosticFrames,
    });
    if (resetDiagnostics) {
      currentSum = new Float64Array(channels + 1);
      currentEnergy = new Float64Array(channels + 1);
      diagnosticFrames = 0;
    }
    return result;
  }

  function reset() {
    currentSum = new Float64Array(channels + 1);
    currentEnergy = new Float64Array(channels + 1);
    diagnosticFrames = 0;
  }

  return Object.freeze({ process, snapshot, reset });
}
