import assert from "node:assert/strict";
import test from "node:test";

import {
  createRainImpact,
  createRainMark,
} from "../src/rain-impact.js";
import { createDefaultAcousticFactors } from "../src/acoustic-factors.js";
import { analyzeSignal } from "../src/signal-analysis.js";

function rms(samples) {
  const energy = samples.reduce((sum, sample) => sum + sample * sample, 0);
  return Math.sqrt(energy / Math.max(1, samples.length));
}

function firstDifferenceRoughness(samples) {
  let energy = 0;
  for (let index = 1; index < samples.length; index += 1) {
    energy += (samples[index] - samples[index - 1]) ** 2;
  }
  return Math.sqrt(energy / Math.max(1, samples.length - 1))
    / Math.max(1e-12, rms(samples));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quantile(values, amount) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * amount)];
}

function peakTimeMilliseconds(samples, sampleRate) {
  let peakIndex = 0;
  for (let index = 1; index < samples.length; index += 1) {
    if (Math.abs(samples[index]) > Math.abs(samples[peakIndex])) peakIndex = index;
  }
  return peakIndex * 1000 / sampleRate;
}

function energyTimeMilliseconds(samples, sampleRate, fraction) {
  const total = samples.reduce((sum, sample) => sum + sample * sample, 0);
  let cumulative = 0;
  for (let index = 0; index < samples.length; index += 1) {
    cumulative += samples[index] * samples[index];
    if (cumulative >= total * fraction) return index * 1000 / sampleRate;
  }
  return samples.length * 1000 / sampleRate;
}

function temporalEnergySkewness(samples, sampleRate) {
  const total = samples.reduce((sum, sample) => sum + sample * sample, 0);
  const meanSeconds = samples.reduce(
    (sum, sample, index) => sum + sample * sample * index / sampleRate,
    0,
  ) / total;
  const variance = samples.reduce((sum, sample, index) => {
    const distance = index / sampleRate - meanSeconds;
    return sum + sample * sample * distance ** 2;
  }, 0) / total;
  const thirdMoment = samples.reduce((sum, sample, index) => {
    const distance = index / sampleRate - meanSeconds;
    return sum + sample * sample * distance ** 3;
  }, 0) / total;
  return thirdMoment / variance ** 1.5;
}

function highPass(samples, sampleRate, cutoffHz = 2_000) {
  const decay = Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
  const filtered = new Float32Array(samples.length);
  let previousInput = 0;
  let previousOutput = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const output = decay
      * (previousOutput + samples[index] - previousInput);
    filtered[index] = output;
    previousInput = samples[index];
    previousOutput = output;
  }
  return filtered;
}

function correlation(left, right) {
  const leftMean = average(left);
  const rightMean = average(right);
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }
  return covariance / Math.sqrt(leftVariance * rightVariance);
}

test("a Rain Mark is deterministic, audio-only, and physically coherent", () => {
  const marks = Array.from(
    { length: 256 },
    (_, index) => createRainMark({ seed: index + 1, dropPopulation: 0.55 }),
  );

  assert.deepEqual(
    createRainMark({ seed: 42, dropPopulation: 0.55 }),
    createRainMark({ seed: 42, dropPopulation: 0.55 }),
  );
  assert.ok(marks.every(mark => ["leaf", "litter", "wood"].includes(mark.surface)));
  assert.ok(marks.every(mark => !("bubble" in mark)));
  assert.ok(correlation(
    marks.map(mark => mark.diameterMm),
    marks.map(mark => mark.velocityMetersPerSecond),
  ) > 0.85);
  assert.ok(correlation(
    marks.map(mark => mark.diameterMm),
    marks.map(mark => mark.impactLevel),
  ) > 0.7);
});

test("Drop Population shifts the mark distribution without becoming an event clock", () => {
  const fine = Array.from(
    { length: 512 },
    (_, index) => createRainMark({ seed: index + 1, dropPopulation: 0 }),
  );
  const large = Array.from(
    { length: 512 },
    (_, index) => createRainMark({ seed: index + 1, dropPopulation: 1 }),
  );

  assert.ok(
    average(large.map(mark => mark.diameterMm))
      > average(fine.map(mark => mark.diameterMm)) * 1.8,
  );
  assert.ok(
    average(large.map(mark => mark.impactLevel))
      > average(fine.map(mark => mark.impactLevel)) * 1.8,
  );
});

test("an analytic surface response is signed, bounded, variable-length, and decays", () => {
  const sampleRate = 48_000;
  const impacts = Array.from({ length: 48 }, (_, index) => createRainImpact({
    sampleRate,
    seed: index + 1,
    dropPopulation: 0.5,
  }));
  const lengths = new Set(impacts.map(impact => impact.length));

  assert.ok(lengths.size >= 8);
  for (const impact of impacts) {
    const onset = impact.slice(0, Math.round(sampleRate * 0.08));
    const tail = impact.slice(-Math.min(impact.length, Math.round(sampleRate * 0.035)));
    assert.ok(Math.min(...impact) < 0);
    assert.ok(Math.max(...impact) > 0);
    assert.ok(Math.max(...impact.map(Math.abs)) <= 1);
    assert.ok(rms(onset) > rms(tail));
  }
});

test("default Rain Impact Waveforms peak inside a compact contact and concentrate energy briefly", () => {
  const sampleRate = 48_000;
  const impacts = Array.from({ length: 192 }, (_, index) => createRainImpact({
    sampleRate,
    seed: index + 1,
    dropPopulation: 0.5,
  }));
  const peakTimes = impacts.map(impact => peakTimeMilliseconds(impact, sampleRate));
  const energyTimes = impacts.map(
    impact => energyTimeMilliseconds(impact, sampleRate, 0.9),
  );

  for (const impact of impacts) {
    assert.equal(Math.abs(impact[0]), 0);
    assert.equal(Math.abs(impact[impact.length - 1]), 0);
  }
  assert.ok(quantile(peakTimes, 0.9) <= 25);
  assert.ok(quantile(energyTimes, 0.5) <= 35);
  assert.ok(quantile(energyTimes, 0.9) <= 55);
});

test("default Rain Impacts use compact rounded excitation rather than right-skewed noise bursts", () => {
  const impacts = Array.from({ length: 192 }, (_, index) => createRainImpact({
    sampleRate: 48_000,
    seed: index + 1,
    dropPopulation: 0.693,
  }));
  const skewness = impacts.map(
    impact => temporalEnergySkewness(impact, 48_000),
  );

  assert.ok(quantile(skewness, 0.5) < 1.5);
});

test("Direct Contact and generated surface excitation remain independently auditionable", () => {
  const sampleRate = 48_000;
  const contactOnly = createDefaultAcousticFactors();
  const surfaceOnly = createDefaultAcousticFactors();

  for (const id of ["lowTexture", "midTexture", "highTexture", "wetMicrotexture"]) {
    contactOnly[id].enabled = false;
  }
  surfaceOnly.impactBody.enabled = false;

  const contact = createRainImpact({ sampleRate, seed: 42, factors: contactOnly });
  const surface = createRainImpact({ sampleRate, seed: 42, factors: surfaceOnly });

  assert.ok(rms(contact) > 0);
  assert.ok(rms(surface) > 0);
  assert.notDeepEqual(contact, surface);
});

test("leaf and litter Surface Responses have distinct evolving spectral signatures", () => {
  const profiles = {};
  for (const surface of ["leaf", "litter"]) {
    const factors = createDefaultAcousticFactors();
    factors.impactBody.enabled = false;
    for (const id of ["leafSurface", "litterSurface", "woodSurface"]) {
      factors[id].enabled = id === `${surface}Surface`;
    }
    const impacts = Array.from({ length: 32 }, (_, index) => createRainImpact({
      sampleRate: 48_000,
      seed: index + 1,
      factors,
    }));
    profiles[surface] = {
      complete: average(impacts.map(impact => analyzeSignal(
        impact,
        48_000,
        { includeSpectrogram: false },
      ).spectralCentroidHz)),
      early: average(impacts.map(impact => analyzeSignal(
        impact.subarray(0, 576),
        48_000,
        { includeSpectrogram: false },
      ).spectralCentroidHz)),
      late: average(impacts.map(impact => analyzeSignal(
        impact.subarray(960, 2_400),
        48_000,
        { includeSpectrogram: false },
      ).spectralCentroidHz)),
    };
  }

  assert.ok(profiles.leaf.complete > profiles.litter.complete * 1.25);
  assert.ok(profiles.leaf.early > profiles.leaf.late * 1.08);
  assert.ok(profiles.litter.early > profiles.litter.late * 1.05);
});

test("a default Rain Impact population spans dark and papery high-frequency marks", () => {
  const analyses = Array.from({ length: 96 }, (_, index) => analyzeSignal(
    createRainImpact({
      sampleRate: 48_000,
      seed: index + 1,
      dropPopulation: 0.693,
    }),
    48_000,
    { includeSpectrogram: false },
  ));
  const centroids = analyses.map(analysis => analysis.spectralCentroidHz);
  const highBandRatios = analyses.map(analysis => analysis.highBandEnergyRatio);

  assert.ok(average(highBandRatios) > 0.12);
  assert.ok(quantile(centroids, 0.1) < 4_000);
  assert.ok(quantile(centroids, 0.9) > 5_000);
});

test("prominent large Rain Marks retain detail without becoming upper-band spikes", () => {
  // Seeds 116 and 127 are deterministic response-bank variants exposed by the
  // earlier maximum-energy microscope audit. Their
  // isolated responses expose the per-impact failure independently of timing,
  // overlap, propagation, or microscope normalization.
  const analyses = [116, 127].map(seed => {
    const factors = createDefaultAcousticFactors();
    const mark = createRainMark({
      seed,
      dropPopulation: 0.693,
      factors,
    });
    return {
      mark,
      samples: createRainImpact({
        sampleRate: 48_000,
        seed,
        factors,
        dropPopulation: 0.693,
        mark,
      }),
    };
  });

  for (const analysis of analyses) {
    analysis.signal = analyzeSignal(
      analysis.samples,
      48_000,
      { includeSpectrogram: false },
    );
  }

  assert.ok(analyses.every(({ mark }) => mark.sizeClass === "large"));
  assert.ok(analyses.every(({ mark }) => mark.impactLevel > 0.44));
  assert.ok(analyses.every(
    ({ signal }) => signal.spectralCentroidHz < 10_000,
  ));
  assert.ok(analyses.every(
    ({ signal }) => signal.highBandEnergyRatio < 0.55,
  ));
  assert.ok(analyses.every(
    ({ samples }) => firstDifferenceRoughness(samples.subarray(0, 1_920)) < 0.45,
  ));
});

test("default Rain Impacts retain a body beneath optional upper detail", () => {
  const highBandRatios = Array.from({ length: 192 }, (_, index) => (
    analyzeSignal(createRainImpact({
      sampleRate: 48_000,
      seed: index + 1,
      dropPopulation: 0.693,
    }), 48_000, { includeSpectrogram: false }).highBandEnergyRatio
  ));

  assert.ok(quantile(highBandRatios, 0.95) < 0.9);
  assert.ok(Math.max(...highBandRatios) < 0.95);
});

test("Spectral Sparsity reduces one impact's broad-region occupancy", () => {
  const sparseFactors = createDefaultAcousticFactors();
  const broadFactors = createDefaultAcousticFactors();
  broadFactors.spectralSparsity.enabled = false;
  const analyzePopulation = factors => Array.from(
    { length: 64 },
    (_, index) => analyzeSignal(
      createRainImpact({
        sampleRate: 48_000,
        seed: index + 1,
        factors,
        dropPopulation: 0.693,
      }),
      48_000,
      { includeSpectrogram: false },
    ),
  );
  const sparse = analyzePopulation(sparseFactors);
  const broad = analyzePopulation(broadFactors);

  assert.ok(
    average(broad.map(analysis => analysis.spectralFlatness))
      > average(sparse.map(analysis => analysis.spectralFlatness)) * 1.15,
  );
});

test("Wet Microtexture adds high-frequency cusp contrast inside one Rain Impact", () => {
  const wetFactors = createDefaultAcousticFactors();
  const dryFactors = createDefaultAcousticFactors();
  wetFactors.wetMicrotexture.amount = 1;
  dryFactors.wetMicrotexture.enabled = false;
  for (const factors of [wetFactors, dryFactors]) {
    factors.impactBody.enabled = false;
  }
  const contrast = factors => Array.from({ length: 96 }, (_, index) => (
    analyzeSignal(
      highPass(createRainImpact({
        sampleRate: 48_000,
        seed: index + 1,
        factors,
        dropPopulation: 0.693,
      }), 48_000),
      48_000,
      { includeSpectrogram: false },
    ).sampleKurtosis
  ));
  const wetContrast = contrast(wetFactors);
  const dryContrast = contrast(dryFactors);

  assert.ok(quantile(wetContrast, 0.5) > quantile(dryContrast, 0.5) * 1.35);
});

test("default Wet Microtexture stays cushioned by the Surface Response", () => {
  const wetFactors = createDefaultAcousticFactors();
  const dryFactors = createDefaultAcousticFactors();
  dryFactors.wetMicrotexture.enabled = false;
  const crestPopulation = factors => Array.from({ length: 96 }, (_, index) => {
    const impact = createRainImpact({
      sampleRate: 48_000,
      seed: index + 1,
      factors,
      dropPopulation: 0.693,
    });
    return Math.max(...impact.map(Math.abs)) / rms(impact);
  });
  const wetCrest = quantile(crestPopulation(wetFactors), 0.5);
  const dryCrest = quantile(crestPopulation(dryFactors), 0.5);

  assert.ok(wetCrest > dryCrest);
  assert.ok(wetCrest < dryCrest * 1.35);
});

test("low and high texture regions retain distinct but overlapping decay scales", () => {
  const energyTimes = {};
  for (const selected of ["lowTexture", "highTexture"]) {
    const factors = createDefaultAcousticFactors();
    factors.impactBody.enabled = false;
    for (const id of ["lowTexture", "midTexture", "highTexture"]) {
      factors[id].enabled = id === selected;
    }
    energyTimes[selected] = average(Array.from(
      { length: 32 },
      (_, index) => energyTimeMilliseconds(
        createRainImpact({ sampleRate: 48_000, seed: index + 1, factors }),
        48_000,
        0.9,
      ),
    ));
  }

  assert.ok(energyTimes.highTexture < energyTimes.lowTexture);
  assert.ok(energyTimes.highTexture > energyTimes.lowTexture * 0.6);
});

test("no hidden resonator remains when every explicit excitation is switched off", () => {
  const factors = createDefaultAcousticFactors();
  for (const id of [
    "impactBody",
    "lowTexture",
    "midTexture",
    "highTexture",
    "wetMicrotexture",
  ]) {
    factors[id].enabled = false;
  }

  for (let seed = 1; seed <= 32; seed += 1) {
    const impact = createRainImpact({ sampleRate: 48_000, seed, factors });
    assert.ok(impact.every(sample => sample === 0));
  }
});

test("the response is pure deterministic synthesis with no external audio input", () => {
  const options = { sampleRate: 44_100, seed: 7, dropPopulation: 0.7 };
  const first = createRainImpact(options);
  const second = createRainImpact(options);

  assert.deepEqual(first, second);
  assert.ok(first instanceof Float32Array);
});

test("each generated surface is an explicit switchable Acoustic Factor", () => {
  for (const surface of ["leaf", "litter", "wood"]) {
    const factors = createDefaultAcousticFactors();
    for (const id of ["leafSurface", "litterSurface", "woodSurface"]) {
      factors[id].enabled = id === `${surface}Surface`;
    }
    const marks = Array.from(
      { length: 32 },
      (_, index) => createRainMark({ seed: index + 1, factors }),
    );
    assert.ok(marks.every(mark => mark.surface === surface));
  }
});
