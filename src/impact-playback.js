function finiteSample(value) {
  return Number.isFinite(value) ? value : 0;
}

export function prepareImpactAudition(samples, {
  sampleRate,
  targetPeak = 0.32,
  fadeSeconds = 0.004,
} = {}) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError("Impact Audition requires a positive sample rate.");
  }

  const source = Float32Array.from(samples ?? [], finiteSample);
  const peak = source.reduce(
    (maximum, sample) => Math.max(maximum, Math.abs(sample)),
    0,
  );
  const boundedTargetPeak = Math.max(0, Math.min(1, Number(targetPeak) || 0));
  const gain = peak > 0 ? boundedTargetPeak / peak : 0;
  const fadeSamples = Math.min(
    Math.floor(source.length / 2),
    Math.max(0, Math.round((Number(fadeSeconds) || 0) * sampleRate)),
  );
  const prepared = Float32Array.from(source, (sample, index) => {
    const fadeIn = fadeSamples > 0 && index < fadeSamples
      ? index / fadeSamples
      : 1;
    const fadeOut = fadeSamples > 0 && index >= source.length - fadeSamples
      ? (source.length - 1 - index) / fadeSamples
      : 1;
    const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
    return envelope === 0 ? 0 : sample * gain * envelope;
  });

  return Object.freeze({
    samples: prepared,
    sampleRate,
  });
}
