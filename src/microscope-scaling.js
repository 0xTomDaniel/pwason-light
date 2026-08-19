const MODES = new Set(["shape", "profile-matched"]);
const DEFAULT_WAVEFORM_TARGET_PEAK = 0.84;
const ROBUST_PEAK_PERCENTILE = 0.995;

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function robustPeak(samples) {
  const absoluteSamples = Array.from(
    samples ?? [],
    sample => Math.abs(Number(sample) || 0),
  ).sort((left, right) => left - right);
  if (absoluteSamples.length === 0) return 0;
  const index = Math.min(
    absoluteSamples.length - 1,
    Math.ceil(ROBUST_PEAK_PERCENTILE * (absoluteSamples.length - 1)),
  );
  return absoluteSamples[index];
}

function spectrogramPeakPower(microscopes) {
  let peakPower = 0;
  for (const microscope of microscopes ?? []) {
    for (const frame of microscope?.analysis?.spectrogram ?? []) {
      for (const power of frame) peakPower = Math.max(peakPower, power);
    }
  }
  return peakPower;
}

function shapeScaling(sources) {
  return Object.freeze({
    mode: "shape",
    bySource: Object.freeze(Object.fromEntries(sources.map(source => [
      source.id,
      Object.freeze({ waveformGain: null, spectrogramPowerGain: 1 }),
    ]))),
    sharedSpectrogramPeakPower: null,
  });
}

export function prepareMicroscopeScaling(sources, {
  mode = "profile-matched",
  waveformTargetPeak = DEFAULT_WAVEFORM_TARGET_PEAK,
} = {}) {
  const sourceList = Array.from(sources ?? []);
  if (!MODES.has(mode)) {
    throw new RangeError(`Unknown Microscope Scaling mode: ${mode}`);
  }
  if (mode === "shape") return shapeScaling(sourceList);

  const sourceProfileGains = sourceList.map(source => {
    const profileRms = finitePositive(source.profileRms);
    return profileRms > 0 ? 1 / profileRms : 0;
  });
  let sharedWaveformPeak = 0;
  let sharedSpectrogramPeakPower = 0;
  sourceList.forEach((source, index) => {
    const profileGain = sourceProfileGains[index];
    for (const microscope of source.microscopes ?? []) {
      sharedWaveformPeak = Math.max(
        sharedWaveformPeak,
        robustPeak(microscope.samples) * profileGain,
      );
    }
    sharedSpectrogramPeakPower = Math.max(
      sharedSpectrogramPeakPower,
      spectrogramPeakPower(source.microscopes) * profileGain ** 2,
    );
  });

  const targetPeak = Math.max(
    0.05,
    Math.min(1, Number(waveformTargetPeak) || DEFAULT_WAVEFORM_TARGET_PEAK),
  );
  const sharedWaveformGain = sharedWaveformPeak > 0
    ? targetPeak / sharedWaveformPeak
    : 1;
  const bySource = Object.fromEntries(sourceList.map((source, index) => {
    const profileGain = sourceProfileGains[index];
    return [source.id, Object.freeze({
      waveformGain: profileGain * sharedWaveformGain,
      spectrogramPowerGain: profileGain ** 2,
    })];
  }));

  return Object.freeze({
    mode,
    bySource: Object.freeze(bySource),
    sharedSpectrogramPeakPower: Math.max(sharedSpectrogramPeakPower, 1e-20),
  });
}
