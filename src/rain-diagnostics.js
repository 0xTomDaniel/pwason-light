import {
  analyzeSignal,
  analyzeSpectralFrames,
  detectProminentOnsets,
} from "./signal-analysis.js";

const FIELD_DURATION_SECONDS = 1;
const FIELD_SCAN_HOP_SECONDS = 0.01;
const SPECTRAL_FLOOR_DECIBELS = -70;
const IMPACT_DURATION_SECONDS = 0.12;
const IMPACT_PREROLL_SECONDS = 0.02;
const DISTRIBUTION_QUANTILES = Object.freeze([0.1, 0.25, 0.5, 0.75, 0.9]);
const ONSET_POPULATION_QUANTILES = Object.freeze([0.1, 0.5, 0.9]);
const ONSET_POPULATION_POINTS = 240;
const MAX_ONSET_POPULATION_SIZE = 96;

function normalizedDecibels(powers, floorDecibels = SPECTRAL_FLOOR_DECIBELS) {
  const peak = Math.max(...powers, 1e-20);
  return Float64Array.from(
    powers,
    power => Math.max(
      floorDecibels,
      10 * Math.log10(Math.max(power / peak, 1e-20)),
    ),
  );
}

function rmsDifference(first, second) {
  let squaredError = 0;
  for (let index = 0; index < first.length; index += 1) {
    squaredError += (first[index] - second[index]) ** 2;
  }
  return Math.sqrt(squaredError / Math.max(1, first.length));
}

function quantile(sorted, probability) {
  if (sorted.length === 0) return 0;
  const position = probability * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(sorted.length - 1, lower + 1);
  const mix = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * mix;
}

function createSpectralDistribution(spectralFrames) {
  const profilePeak = Math.max(...spectralFrames.meanPowers, 1e-20);
  const profileDecibels = normalizedDecibels(spectralFrames.meanPowers);
  const quantileDecibels = DISTRIBUTION_QUANTILES.map(() => (
    new Float64Array(spectralFrames.frequenciesHz.length)
  ));

  for (let point = 0; point < spectralFrames.frequenciesHz.length; point += 1) {
    const powers = spectralFrames.frames
      .map(frame => frame[point])
      .sort((left, right) => left - right);
    DISTRIBUTION_QUANTILES.forEach((probability, quantileIndex) => {
      quantileDecibels[quantileIndex][point] = Math.max(
        SPECTRAL_FLOOR_DECIBELS,
        10 * Math.log10(Math.max(
          quantile(powers, probability) / profilePeak,
          1e-20,
        )),
      );
    });
  }

  return Object.freeze({
    frequenciesHz: spectralFrames.frequenciesHz,
    profileDecibels,
    quantiles: DISTRIBUTION_QUANTILES,
    quantileDecibels: Object.freeze(quantileDecibels),
    floorDecibels: SPECTRAL_FLOOR_DECIBELS,
  });
}

function selectRepresentativeField(samples, sampleRate, spectralFrames) {
  const sampleCount = Math.min(
    samples.length,
    Math.round(sampleRate * FIELD_DURATION_SECONDS),
  );
  const durationSeconds = sampleCount / sampleRate;
  const latestStartSeconds = Math.max(0, samples.length / sampleRate - durationSeconds);
  const targetDecibels = normalizedDecibels(spectralFrames.meanPowers);
  let bestStartSeconds = 0;
  let bestDistanceDb = Number.POSITIVE_INFINITY;

  for (
    let startSeconds = 0;
    startSeconds <= latestStartSeconds + 1e-9;
    startSeconds += FIELD_SCAN_HOP_SECONDS
  ) {
    const endSeconds = startSeconds + durationSeconds;
    const powers = new Float64Array(spectralFrames.frequenciesHz.length);
    let frameCount = 0;

    for (let frame = 0; frame < spectralFrames.frames.length; frame += 1) {
      const center = spectralFrames.frameCentersSeconds[frame];
      if (center < startSeconds || center >= endSeconds) continue;
      frameCount += 1;
      for (let point = 0; point < powers.length; point += 1) {
        powers[point] += spectralFrames.frames[frame][point];
      }
    }
    if (frameCount === 0) continue;
    for (let point = 0; point < powers.length; point += 1) {
      powers[point] /= frameCount;
    }
    const distanceDb = rmsDifference(normalizedDecibels(powers), targetDecibels);
    if (distanceDb < bestDistanceDb) {
      bestDistanceDb = distanceDb;
      bestStartSeconds = startSeconds;
    }
  }

  const startIndex = Math.round(bestStartSeconds * sampleRate);
  const fieldSamples = new Float32Array(sampleCount);
  fieldSamples.set(samples.subarray(startIndex, startIndex + sampleCount));
  return Object.freeze({
    samples: fieldSamples,
    analysis: analyzeSignal(fieldSamples, sampleRate, {
      spectrogramHopSeconds: 0.004,
    }),
    startSeconds: startIndex / sampleRate,
    centerSeconds: (startIndex + sampleCount / 2) / sampleRate,
    spectrumDistanceDb: bestDistanceDb,
  });
}

function createImpactMicroscope(
  samples,
  sampleRate,
  onsetIndex,
  selectionKind,
  alignmentKind = "detected-onset",
) {
  const impactSampleCount = Math.min(
    samples.length,
    Math.round(sampleRate * IMPACT_DURATION_SECONDS),
  );
  const prerollSamples = Math.round(sampleRate * IMPACT_PREROLL_SECONDS);
  const latestStart = Math.max(0, samples.length - impactSampleCount);
  const startIndex = Math.min(latestStart, Math.max(0, onsetIndex - prerollSamples));
  const impactSamples = new Float32Array(impactSampleCount);
  impactSamples.set(samples.subarray(startIndex, startIndex + impactSampleCount));
  let peakIndex = onsetIndex;
  const peakEnd = Math.min(samples.length, startIndex + impactSampleCount);
  for (let index = onsetIndex + 1; index < peakEnd; index += 1) {
    if (Math.abs(samples[index]) > Math.abs(samples[peakIndex])) peakIndex = index;
  }

  return Object.freeze({
    samples: impactSamples,
    analysis: analyzeSignal(impactSamples, sampleRate),
    startSeconds: startIndex / sampleRate,
    onsetSeconds: onsetIndex / sampleRate,
    onsetOffsetSeconds: (onsetIndex - startIndex) / sampleRate,
    peakSeconds: peakIndex / sampleRate,
    alignmentKind,
    selectionKind,
  });
}

function selectImpactMicroscopes(samples, sampleRate, prominentOnsets) {
  const impactSampleCount = Math.min(
    samples.length,
    Math.round(sampleRate * IMPACT_DURATION_SECONDS),
  );
  const prerollSamples = Math.round(sampleRate * IMPACT_PREROLL_SECONDS);
  const postrollSamples = Math.max(0, impactSampleCount - prerollSamples);
  const scoringSamples = Math.round(sampleRate * 0.04);
  const candidates = prominentOnsets.timesSeconds.flatMap(onsetSeconds => {
    const onsetIndex = Math.round(onsetSeconds * sampleRate);
    if (
      onsetIndex < prerollSamples
      || onsetIndex + postrollSamples > samples.length
    ) return [];
    let score = 0;
    const end = Math.min(samples.length, onsetIndex + scoringSamples);
    for (let index = onsetIndex; index < end; index += 1) {
      score += samples[index] ** 2;
    }
    return [{ onsetIndex, score }];
  });

  if (candidates.length === 0) {
    let peakIndex = 0;
    for (let index = 1; index < samples.length; index += 1) {
      if (Math.abs(samples[index]) > Math.abs(samples[peakIndex])) peakIndex = index;
    }
    return Object.freeze([
      createImpactMicroscope(
        samples,
        sampleRate,
        peakIndex,
        "fallback",
        "peak-fallback",
      ),
    ]);
  }

  const distinctCandidates = [];
  for (const candidate of [...candidates].sort(
    (left, right) => right.score - left.score || left.onsetIndex - right.onsetIndex,
  )) {
    if (distinctCandidates.every(existing => (
      Math.abs(existing.onsetIndex - candidate.onsetIndex) >= impactSampleCount
    ))) {
      distinctCandidates.push(candidate);
    }
  }
  const byEnergy = distinctCandidates.sort(
    (left, right) => left.score - right.score || left.onsetIndex - right.onsetIndex,
  );
  const usedIndices = new Set();
  const selections = [];
  for (const [selectionKind, percentile] of [
    ["strong", 0.9],
    ["typical", 0.5],
    ["soft", 0.25],
  ]) {
    const targetIndex = Math.round(percentile * (byEnergy.length - 1));
    const candidateIndex = byEnergy.reduce((best, _, index) => {
      if (usedIndices.has(index)) return best;
      if (best === -1) return index;
      return Math.abs(index - targetIndex) < Math.abs(best - targetIndex)
        ? index
        : best;
    }, -1);
    if (candidateIndex === -1) continue;
    usedIndices.add(candidateIndex);
    selections.push(createImpactMicroscope(
      samples,
      sampleRate,
      byEnergy[candidateIndex].onsetIndex,
      selectionKind,
    ));
  }
  return Object.freeze(selections);
}

function selectPopulationOnsets(timesSeconds) {
  if (timesSeconds.length <= MAX_ONSET_POPULATION_SIZE) return timesSeconds;
  return Array.from(
    { length: MAX_ONSET_POPULATION_SIZE },
    (_, index) => timesSeconds[Math.round(
      index * (timesSeconds.length - 1) / (MAX_ONSET_POPULATION_SIZE - 1),
    )],
  );
}

function createOnsetPopulation(samples, sampleRate, prominentOnsets) {
  const sampleCount = Math.min(
    samples.length,
    Math.round(sampleRate * IMPACT_DURATION_SECONDS),
  );
  const prerollSamples = Math.round(sampleRate * IMPACT_PREROLL_SECONDS);
  const onsetPoint = Math.round(
    IMPACT_PREROLL_SECONDS / IMPACT_DURATION_SECONDS * ONSET_POPULATION_POINTS,
  );
  const envelopes = [];
  const peakDelays = [];
  const energy90Delays = [];

  for (const onsetSeconds of selectPopulationOnsets(prominentOnsets.timesSeconds)) {
    const onsetIndex = Math.round(onsetSeconds * sampleRate);
    const startIndex = onsetIndex - prerollSamples;
    if (startIndex < 0 || startIndex + sampleCount > samples.length) continue;
    const envelope = new Float32Array(ONSET_POPULATION_POINTS);

    for (let point = 0; point < envelope.length; point += 1) {
      const start = startIndex + Math.floor(point * sampleCount / envelope.length);
      const end = startIndex + Math.max(
        Math.floor((point + 1) * sampleCount / envelope.length),
        Math.floor(point * sampleCount / envelope.length) + 1,
      );
      let energy = 0;
      for (let index = start; index < end; index += 1) {
        energy += samples[index] ** 2;
      }
      envelope[point] = Math.sqrt(energy / Math.max(1, end - start));
    }

    const baseline = quantile(
      [...envelope.subarray(0, onsetPoint)].sort((left, right) => left - right),
      0.5,
    );
    let peak = 0;
    let peakPoint = onsetPoint;
    for (let point = 0; point < envelope.length; point += 1) {
      envelope[point] = Math.max(0, envelope[point] - baseline);
      if (point >= onsetPoint && envelope[point] > peak) {
        peak = envelope[point];
        peakPoint = point;
      }
    }
    if (peak <= 1e-12) continue;
    for (let point = 0; point < envelope.length; point += 1) {
      envelope[point] /= peak;
    }

    const postOnsetEnergy = envelope.subarray(onsetPoint).reduce(
      (sum, value) => sum + value ** 2,
      0,
    );
    let cumulativeEnergy = 0;
    let energy90Point = envelope.length - 1;
    for (let point = onsetPoint; point < envelope.length; point += 1) {
      cumulativeEnergy += envelope[point] ** 2;
      if (cumulativeEnergy >= postOnsetEnergy * 0.9) {
        energy90Point = point;
        break;
      }
    }
    const pointIntervalSeconds = IMPACT_DURATION_SECONDS / envelope.length;
    peakDelays.push(Math.max(
      0,
      (peakPoint + 0.5) * pointIntervalSeconds - IMPACT_PREROLL_SECONDS,
    ));
    energy90Delays.push(Math.max(
      0,
      (energy90Point + 0.5) * pointIntervalSeconds - IMPACT_PREROLL_SECONDS,
    ));
    envelopes.push(envelope);
  }

  const envelopeQuantiles = ONSET_POPULATION_QUANTILES.map(probability => (
    Float32Array.from({ length: ONSET_POPULATION_POINTS }, (_, point) => quantile(
      envelopes.map(envelope => envelope[point]).sort((left, right) => left - right),
      probability,
    ))
  ));
  const sortedPeakDelays = peakDelays.sort((left, right) => left - right);
  const sortedEnergy90Delays = energy90Delays.sort((left, right) => left - right);

  return Object.freeze({
    count: envelopes.length,
    quantiles: ONSET_POPULATION_QUANTILES,
    envelopeQuantiles: Object.freeze(envelopeQuantiles),
    durationSeconds: IMPACT_DURATION_SECONDS,
    onsetOffsetSeconds: IMPACT_PREROLL_SECONDS,
    pointIntervalSeconds: IMPACT_DURATION_SECONDS / ONSET_POPULATION_POINTS,
    peakDelayQuantilesSeconds: Object.freeze(ONSET_POPULATION_QUANTILES.map(
      probability => quantile(sortedPeakDelays, probability),
    )),
    energy90DelayQuantilesSeconds: Object.freeze(ONSET_POPULATION_QUANTILES.map(
      probability => quantile(sortedEnergy90Delays, probability),
    )),
  });
}

export function analyzeRainField(samples, sampleRate) {
  const profileAnalysis = analyzeSignal(samples, sampleRate, {
    includeSpectrogram: false,
  });
  const spectralFrames = analyzeSpectralFrames(samples, sampleRate);

  const prominentOnsets = detectProminentOnsets(samples, sampleRate);

  const impactMicroscopes = selectImpactMicroscopes(
    samples,
    profileAnalysis.sampleRate,
    prominentOnsets,
  );

  return Object.freeze({
    profileAnalysis,
    prominentOnsets,
    spectralDistribution: createSpectralDistribution(spectralFrames),
    representativeField: selectRepresentativeField(
      samples,
      profileAnalysis.sampleRate,
      spectralFrames,
    ),
    impactMicroscopes,
    onsetPopulation: createOnsetPopulation(
      samples,
      profileAnalysis.sampleRate,
      prominentOnsets,
    ),
  });
}

export function compareRainFieldDiagnostics(first, second) {
  const firstDistribution = first?.spectralDistribution;
  const secondDistribution = second?.spectralDistribution;
  if (
    !firstDistribution
    || !secondDistribution
  ) {
    throw new TypeError("Rain diagnostic comparison requires compatible fields.");
  }

  const pointCount = Math.min(
    firstDistribution.frequenciesHz.length,
    secondDistribution.frequenciesHz.length,
  );
  const minimumFrequency = Math.max(
    firstDistribution.frequenciesHz[0],
    secondDistribution.frequenciesHz[0],
  );
  const maximumFrequency = Math.min(
    firstDistribution.frequenciesHz.at(-1),
    secondDistribution.frequenciesHz.at(-1),
  );
  const frequenciesHz = Float64Array.from(
    { length: pointCount },
    (_, index) => minimumFrequency * (
      maximumFrequency / minimumFrequency
    ) ** (index / Math.max(1, pointCount - 1)),
  );
  const interpolate = (distribution, values, frequency) => {
    const frequencies = distribution.frequenciesHz;
    if (frequency <= frequencies[0]) return values[0];
    if (frequency >= frequencies.at(-1)) return values.at(-1);
    let lower = 0;
    let upper = frequencies.length - 1;
    while (upper - lower > 1) {
      const middle = Math.floor((lower + upper) / 2);
      if (frequencies[middle] <= frequency) lower = middle;
      else upper = middle;
    }
    const mix = (Math.log(frequency) - Math.log(frequencies[lower]))
      / (Math.log(frequencies[upper]) - Math.log(frequencies[lower]));
    return values[lower] + (values[upper] - values[lower]) * mix;
  };
  const profileResidualDecibels = Float64Array.from(
    frequenciesHz,
    frequency => interpolate(
      firstDistribution,
      firstDistribution.profileDecibels,
      frequency,
    ) - interpolate(
      secondDistribution,
      secondDistribution.profileDecibels,
      frequency,
    ),
  );
  const distributionResidualDecibels = firstDistribution.quantileDecibels.map(
    (values, quantileIndex) => Float64Array.from(
      frequenciesHz,
      frequency => interpolate(
        firstDistribution,
        values,
        frequency,
      ) - interpolate(
        secondDistribution,
        secondDistribution.quantileDecibels[quantileIndex],
        frequency,
      ),
    ),
  );
  const distributionValues = distributionResidualDecibels.flatMap(values => (
    [...values]
  ));

  return Object.freeze({
    frequenciesHz,
    quantiles: firstDistribution.quantiles,
    profileResidualDecibels,
    profileDistanceDb: Math.sqrt(
      [...profileResidualDecibels].reduce((sum, value) => sum + value ** 2, 0)
        / Math.max(1, profileResidualDecibels.length),
    ),
    distributionResidualDecibels: Object.freeze(distributionResidualDecibels),
    distributionDistanceDb: Math.sqrt(
      distributionValues.reduce((sum, value) => sum + value ** 2, 0)
        / Math.max(1, distributionValues.length),
    ),
  });
}
