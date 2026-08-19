const DEFAULT_FFT_SIZE = 512;
const SPECTROGRAM_FFT_SIZE = 1_024;
const SPECTROGRAM_HOP_SECONDS = 0.001;
const HIGH_BAND_START_HZ = 8_000;
const IMPACT_DURATION_SECONDS = 0.12;
const IMPACT_PREROLL_SECONDS = 0.005;
const ONSET_WINDOW_SECONDS = 256 / 48_000;
const ONSET_HOP_SECONDS = 128 / 48_000;
const ONSET_REFRACTORY_SECONDS = 0.01;

function onePoleCoefficient(cutoffHz, sampleRate) {
  return 1 - Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
}

function correlation(first, second) {
  const count = Math.min(first.length, second.length);
  if (count === 0) return 0;
  const firstMean = first.reduce((sum, value) => sum + value, 0) / count;
  const secondMean = second.reduce((sum, value) => sum + value, 0) / count;
  let covariance = 0;
  let firstVariance = 0;
  let secondVariance = 0;

  for (let index = 0; index < count; index += 1) {
    const firstOffset = first[index] - firstMean;
    const secondOffset = second[index] - secondMean;
    covariance += firstOffset * secondOffset;
    firstVariance += firstOffset * firstOffset;
    secondVariance += secondOffset * secondOffset;
  }

  const denominator = Math.sqrt(firstVariance * secondVariance);
  return denominator > 0 ? covariance / denominator : 0;
}

function analyzeEnvelopeScale(samples, sampleRate, milliseconds) {
  const frameSize = Math.max(1, Math.round(sampleRate * milliseconds / 1000));
  const hopSize = Math.max(1, Math.floor(frameSize / 2));
  const frameCount = samples.length <= frameSize
    ? 1
    : Math.floor((samples.length - frameSize) / hopSize) + 1;
  const envelope = new Float64Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    const end = Math.min(samples.length, start + frameSize);
    let energy = 0;
    for (let index = start; index < end; index += 1) {
      energy += (samples[index] || 0) ** 2;
    }
    envelope[frame] = Math.sqrt(energy / Math.max(1, end - start));
  }
  const mean = envelope.reduce((sum, value) => sum + value, 0) / envelope.length;
  const variance = envelope.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / envelope.length;
  const sorted = [...envelope].sort((left, right) => left - right);
  const floor = sorted[Math.floor((sorted.length - 1) * 0.1)] ?? 0;
  const median = sorted[Math.floor((sorted.length - 1) * 0.5)] ?? 0;
  return Object.freeze({
    coefficientOfVariation: mean > 0 ? Math.sqrt(variance) / mean : 0,
    floorRatio: median > 0 ? floor / median : 0,
  });
}

export function detectProminentOnsets(samples, sampleRate) {
  const rate = Math.max(8_000, Number(sampleRate) || 48_000);
  const frameSize = Math.max(8, Math.round(rate * ONSET_WINDOW_SECONDS));
  const hopSize = Math.max(1, Math.round(rate * ONSET_HOP_SECONDS));
  const frameCount = samples.length < frameSize
    ? 0
    : Math.floor((samples.length - frameSize) / hopSize) + 1;
  const logEnergy = new Float64Array(frameCount);
  const positiveFlux = new Float64Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    let energy = 0;
    for (let index = start; index < start + frameSize; index += 1) {
      const sample = samples[index] || 0;
      energy += sample * sample;
    }
    logEnergy[frame] = Math.log(Math.max(energy / frameSize, 1e-20));
    if (frame > 0) {
      positiveFlux[frame] = Math.max(0, logEnergy[frame] - logEnergy[frame - 1]);
    }
  }

  const sortedFlux = [...positiveFlux].sort((left, right) => left - right);
  const threshold = sortedFlux[Math.floor((sortedFlux.length - 1) * 0.85)] ?? 0;
  const refractoryFrames = Math.max(
    1,
    Math.round(ONSET_REFRACTORY_SECONDS * rate / hopSize),
  );
  const timesSeconds = [];
  let lastOnsetFrame = -refractoryFrames;

  for (let frame = 1; frame < frameCount - 1; frame += 1) {
    const flux = positiveFlux[frame];
    if (
      flux > threshold
      && flux >= positiveFlux[frame - 1]
      && flux > positiveFlux[frame + 1]
      && frame - lastOnsetFrame >= refractoryFrames
    ) {
      timesSeconds.push((frame * hopSize + frameSize / 2) / rate);
      lastOnsetFrame = frame;
    }
  }

  const durationSeconds = samples.length / rate;
  return Object.freeze({
    count: timesSeconds.length,
    rateHz: durationSeconds > 0 ? timesSeconds.length / durationSeconds : 0,
    timesSeconds: Object.freeze(timesSeconds),
  });
}

function analyzeTemporalTexture(samples, sampleRate) {
  const frameSize = Math.max(32, Math.round(sampleRate * 0.005));
  const hopSize = Math.max(16, Math.floor(frameSize / 2));
  const frameCount = samples.length <= frameSize
    ? 1
    : Math.floor((samples.length - frameSize) / hopSize) + 1;
  const envelopes = {
    full: new Float64Array(frameCount),
    low: new Float64Array(frameCount),
    mid: new Float64Array(frameCount),
    high: new Float64Array(frameCount),
  };
  const lowSamples = new Float64Array(samples.length);
  const midSamples = new Float64Array(samples.length);
  const highSamples = new Float64Array(samples.length);
  const lowCoefficient = onePoleCoefficient(1_200, sampleRate);
  const highCoefficient = onePoleCoefficient(8_000, sampleRate);
  let lowStateA = 0;
  let lowStateB = 0;
  let highStateA = 0;
  let highStateB = 0;
  let energy = 0;
  let peak = 0;
  let sampleMean = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] || 0;
    sampleMean += sample;
    energy += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
    lowStateA += lowCoefficient * (sample - lowStateA);
    lowStateB += lowCoefficient * (lowStateA - lowStateB);
    highStateA += highCoefficient * (sample - highStateA);
    highStateB += highCoefficient * (highStateA - highStateB);
    lowSamples[index] = lowStateB;
    midSamples[index] = highStateB - lowStateB;
    highSamples[index] = sample - highStateB;
  }
  sampleMean /= Math.max(1, samples.length);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    const end = Math.min(samples.length, start + frameSize);
    let fullEnergy = 0;
    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;
    for (let index = start; index < end; index += 1) {
      fullEnergy += samples[index] ** 2;
      lowEnergy += lowSamples[index] ** 2;
      midEnergy += midSamples[index] ** 2;
      highEnergy += highSamples[index] ** 2;
    }
    const count = Math.max(1, end - start);
    envelopes.full[frame] = Math.sqrt(fullEnergy / count);
    envelopes.low[frame] = Math.sqrt(lowEnergy / count);
    envelopes.mid[frame] = Math.sqrt(midEnergy / count);
    envelopes.high[frame] = Math.sqrt(highEnergy / count);
  }

  const envelopeMean = envelopes.full.reduce((sum, value) => sum + value, 0)
    / envelopes.full.length;
  const envelopeVariance = envelopes.full.reduce(
    (sum, value) => sum + (value - envelopeMean) ** 2,
    0,
  ) / envelopes.full.length;
  const sortedEnvelope = [...envelopes.full].sort((left, right) => left - right);
  const floor = sortedEnvelope[Math.floor((sortedEnvelope.length - 1) * 0.1)] ?? 0;
  const median = sortedEnvelope[Math.floor((sortedEnvelope.length - 1) * 0.5)] ?? 0;
  const rms = samples.length > 0 ? Math.sqrt(energy / samples.length) : 0;
  const bandCorrelations = [
    correlation(envelopes.low, envelopes.mid),
    correlation(envelopes.low, envelopes.high),
    correlation(envelopes.mid, envelopes.high),
  ];
  let sampleVariance = 0;
  let fourthMoment = 0;
  for (const sample of samples) {
    const centered = sample - sampleMean;
    sampleVariance += centered ** 2;
    fourthMoment += centered ** 4;
  }
  sampleVariance /= Math.max(1, samples.length);
  fourthMoment /= Math.max(1, samples.length);
  const envelopeScales = Object.freeze(Object.fromEntries(
    [5, 20, 100, 500].map(milliseconds => [
      milliseconds,
      analyzeEnvelopeScale(samples, sampleRate, milliseconds),
    ]),
  ));

  return {
    rms,
    peak,
    crestFactor: rms > 0 ? peak / rms : 0,
    envelopeCoefficientOfVariation: envelopeMean > 0
      ? Math.sqrt(envelopeVariance) / envelopeMean
      : 0,
    envelopeFloorRatio: median > 0 ? floor / median : 0,
    bandEnvelopeCorrelation: bandCorrelations.reduce(
      (sum, value) => sum + value,
      0,
    ) / bandCorrelations.length,
    sampleKurtosis: sampleVariance > 0
      ? fourthMoment / (sampleVariance ** 2)
      : 0,
    envelopeScales,
  };
}

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

function createSpectrogram(samples, sampleRate) {
  const size = SPECTROGRAM_FFT_SIZE;
  const hopSize = Math.max(1, Math.round(sampleRate * SPECTROGRAM_HOP_SECONDS));
  const binCount = size / 2 + 1;
  const frameCount = Math.max(1, Math.ceil(samples.length / hopSize));
  const frames = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    const center = frame * hopSize + Math.floor(hopSize / 2);
    const start = center - Math.floor(size / 2);
    const real = new Float64Array(size);
    const imaginary = new Float64Array(size);
    for (let index = 0; index < size; index += 1) {
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (size - 1));
      real[index] = (samples[start + index] || 0) * window;
    }
    transform(real, imaginary);

    const frameSpectrum = new Float64Array(binCount);
    for (let bin = 0; bin < binCount; bin += 1) {
      frameSpectrum[bin] = real[bin] ** 2 + imaginary[bin] ** 2;
    }
    frames.push(frameSpectrum);
  }

  return { frames, fftSize: size, hopSize };
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

    for (let bin = 0; bin < binCount; bin += 1) {
      const power = real[bin] ** 2 + imaginary[bin] ** 2;
      spectrum[bin] += power;
    }
  }

  const spectrogramAnalysis = includeSpectrogram
    ? createSpectrogram(samples, rate)
    : { frames: [], fftSize: SPECTROGRAM_FFT_SIZE, hopSize: Math.round(rate * SPECTROGRAM_HOP_SECONDS) };

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
  const temporalTexture = analyzeTemporalTexture(samples, rate);

  return Object.freeze({
    durationSeconds: samples.length / rate,
    sampleRate: rate,
    fftSize: size,
    hopSize,
    spectrum,
    spectrogram: spectrogramAnalysis.frames,
    spectrogramFftSize: spectrogramAnalysis.fftSize,
    spectrogramHopSize: spectrogramAnalysis.hopSize,
    spectralCentroidHz: totalEnergy > 0 ? weightedFrequency / totalEnergy : 0,
    highBandEnergyRatio: totalEnergy > 0 ? highBandEnergy / totalEnergy : 0,
    spectralFlatness: arithmeticMean > 0 ? geometricMean / arithmeticMean : 0,
    ...temporalTexture,
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
