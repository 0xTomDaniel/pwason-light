const DEFAULT_FFT_SIZE = 512;
const HIGH_BAND_START_HZ = 8_000;
const IMPACT_DURATION_SECONDS = 0.12;
const IMPACT_PREROLL_SECONDS = 0.005;

function transform(real, imaginary) {
  const size = real.length;

  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }

  for (let length = 2; length <= size; length *= 2) {
    const angle = -2 * Math.PI / length;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);

    for (let offset = 0; offset < size; offset += length) {
      let rotationReal = 1;
      let rotationImaginary = 0;
      for (let index = 0; index < length / 2; index += 1) {
        const even = offset + index;
        const odd = even + length / 2;
        const oddReal = real[odd] * rotationReal - imaginary[odd] * rotationImaginary;
        const oddImaginary = real[odd] * rotationImaginary + imaginary[odd] * rotationReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextRotationReal = rotationReal * stepReal - rotationImaginary * stepImaginary;
        rotationImaginary = rotationReal * stepImaginary + rotationImaginary * stepReal;
        rotationReal = nextRotationReal;
      }
    }
  }
}

export function analyzeSignal(samples, sampleRate, {
  fftSize = DEFAULT_FFT_SIZE,
  includeSpectrogram = true,
} = {}) {
  const rate = Math.max(8_000, Number(sampleRate) || 48_000);
  const size = Math.max(64, 2 ** Math.round(Math.log2(fftSize)));
  const hopSize = size / 4;
  const binCount = size / 2 + 1;
  const spectrum = new Float64Array(binCount);
  const spectrogram = [];
  const frameStarts = samples.length <= size
    ? [0]
    : Array.from(
      { length: Math.floor((samples.length - size) / hopSize) + 1 },
      (_, index) => index * hopSize,
    );

  for (const frameStart of frameStarts) {
    const real = new Float64Array(size);
    const imaginary = new Float64Array(size);
    for (let index = 0; index < size; index += 1) {
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (size - 1));
      real[index] = (samples[frameStart + index] || 0) * window;
    }
    transform(real, imaginary);

    const frameSpectrum = includeSpectrogram ? new Float64Array(binCount) : null;
    for (let bin = 0; bin < binCount; bin += 1) {
      const power = real[bin] ** 2 + imaginary[bin] ** 2;
      if (frameSpectrum) frameSpectrum[bin] = power;
      spectrum[bin] += power;
    }
    if (frameSpectrum) spectrogram.push(frameSpectrum);
  }

  let totalEnergy = 0;
  let weightedFrequency = 0;
  let highBandEnergy = 0;
  let logPower = 0;
  for (let bin = 0; bin < binCount; bin += 1) {
    spectrum[bin] /= frameStarts.length;
    const frequency = bin * rate / size;
    totalEnergy += spectrum[bin];
    weightedFrequency += spectrum[bin] * frequency;
    if (frequency >= HIGH_BAND_START_HZ) highBandEnergy += spectrum[bin];
    logPower += Math.log(Math.max(spectrum[bin], 1e-20));
  }

  const arithmeticMean = totalEnergy / binCount;
  const geometricMean = Math.exp(logPower / binCount);

  return Object.freeze({
    durationSeconds: samples.length / rate,
    sampleRate: rate,
    fftSize: size,
    hopSize,
    spectrum,
    spectrogram,
    spectralCentroidHz: totalEnergy > 0 ? weightedFrequency / totalEnergy : 0,
    highBandEnergyRatio: totalEnergy > 0 ? highBandEnergy / totalEnergy : 0,
    spectralFlatness: arithmeticMean > 0 ? geometricMean / arithmeticMean : 0,
  });
}

export function extractProminentImpact(samples, sampleRate) {
  const rate = Math.max(8_000, Number(sampleRate) || 48_000);
  const sampleCount = Math.round(rate * IMPACT_DURATION_SECONDS);
  const prerollSamples = Math.round(rate * IMPACT_PREROLL_SECONDS);
  let peakIndex = 0;

  for (let index = 1; index < samples.length; index += 1) {
    if (Math.abs(samples[index]) > Math.abs(samples[peakIndex])) peakIndex = index;
  }

  const latestStart = Math.max(0, samples.length - sampleCount);
  const startIndex = Math.min(
    latestStart,
    Math.max(0, peakIndex - prerollSamples),
  );
  const impactSamples = new Float32Array(sampleCount);
  impactSamples.set(samples.subarray(startIndex, startIndex + sampleCount));

  return Object.freeze({
    samples: impactSamples,
    startSeconds: startIndex / rate,
    peakSeconds: peakIndex / rate,
  });
}
