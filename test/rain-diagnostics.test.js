import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeRainField,
  compareRainFieldDiagnostics,
} from "../src/rain-diagnostics.js";

test("Rain Diagnostics selects the one-second Field Window closest to its complete profile", () => {
  const sampleRate = 8_000;
  const samples = Float32Array.from(
    { length: sampleRate * 3 },
    (_, index) => {
      const time = index / sampleRate;
      const low = Math.sin(2 * Math.PI * 500 * time);
      const high = Math.sin(2 * Math.PI * 2_500 * time);
      if (time < 1) return low;
      if (time < 2) return (low + high) / Math.sqrt(2);
      return high;
    },
  );

  const diagnostics = analyzeRainField(samples, sampleRate);

  assert.equal(diagnostics.representativeField.samples.length, sampleRate);
  assert.ok(diagnostics.representativeField.startSeconds >= 0.9);
  assert.ok(diagnostics.representativeField.startSeconds <= 1.1);
  assert.ok(diagnostics.representativeField.spectrumDistanceDb < 2);
});

test("Rain Diagnostics aligns every Impact Microscope to a detected acoustic onset", () => {
  const sampleRate = 48_000;
  const samples = new Float32Array(sampleRate * 2);
  for (const [timeSeconds, amplitude] of [[0.5, 0.3], [1.5, 1]]) {
    const onset = Math.round(timeSeconds * sampleRate);
    for (let offset = 0; offset < sampleRate * 0.025; offset += 1) {
      samples[onset + offset] += amplitude
        * Math.sin(2 * Math.PI * 2_800 * offset / sampleRate)
        * Math.exp(-offset / (sampleRate * 0.006));
    }
  }

  const diagnostics = analyzeRainField(samples, sampleRate);
  const [microscope] = diagnostics.impactMicroscopes;

  assert.equal(microscope.samples.length, Math.round(sampleRate * 0.12));
  assert.ok(Math.abs(microscope.onsetSeconds - 1.5) < 0.01);
  assert.ok(Math.abs(microscope.onsetOffsetSeconds - 0.02) < 1 / sampleRate);
  assert.ok(Math.abs(
    microscope.startSeconds + microscope.onsetOffsetSeconds
      - microscope.onsetSeconds,
  ) < 1 / sampleRate);
});

test("Rain Diagnostics offers strong, typical, and soft non-overlapping impacts", () => {
  const sampleRate = 48_000;
  const samples = new Float32Array(sampleRate * 3);
  for (const [timeSeconds, amplitude] of [
    [0.35, 0.2],
    [0.75, 0.4],
    [1.15, 0.6],
    [1.55, 0.8],
    [1.95, 1],
  ]) {
    const onset = Math.round(timeSeconds * sampleRate);
    for (let offset = 0; offset < sampleRate * 0.025; offset += 1) {
      samples[onset + offset] += amplitude
        * Math.sin(2 * Math.PI * 2_800 * offset / sampleRate)
        * Math.exp(-offset / (sampleRate * 0.006));
    }
  }

  const microscopes = analyzeRainField(samples, sampleRate).impactMicroscopes;

  assert.deepEqual(
    microscopes.map(microscope => microscope.selectionKind),
    ["strong", "typical", "soft"],
  );
  assert.ok(Math.abs(microscopes[0].onsetSeconds - 1.95) < 0.01);
  assert.ok(Math.abs(microscopes[1].onsetSeconds - 1.15) < 0.01);
  assert.ok(Math.abs(microscopes[2].onsetSeconds - 0.75) < 0.01);
  for (let index = 0; index < microscopes.length; index += 1) {
    for (let other = index + 1; other < microscopes.length; other += 1) {
      assert.ok(Math.abs(
        microscopes[index].onsetSeconds - microscopes[other].onsetSeconds,
      ) >= 0.12);
    }
  }
});

test("Rain Diagnostics summarizes a population of onset-aligned contact envelopes", () => {
  const sampleRate = 48_000;
  const samples = new Float32Array(sampleRate * 3);
  for (const [timeSeconds, amplitude] of [
    [0.5, 0.4],
    [1.25, 0.7],
    [2, 1],
    [2.6, 0.55],
  ]) {
    const onset = Math.round(timeSeconds * sampleRate);
    for (let offset = 0; offset < sampleRate * 0.04; offset += 1) {
      samples[onset + offset] += amplitude
        * Math.sin(2 * Math.PI * 2_800 * offset / sampleRate)
        * Math.exp(-offset / (sampleRate * 0.008));
    }
  }

  const population = analyzeRainField(samples, sampleRate).onsetPopulation;
  const onsetPoint = Math.round(
    population.onsetOffsetSeconds / population.pointIntervalSeconds,
  );
  const median = population.envelopeQuantiles[1];
  const preOnsetPeak = Math.max(...median.subarray(0, onsetPoint));
  const postOnsetPeak = Math.max(...median.subarray(onsetPoint));

  assert.ok(population.count >= 4);
  assert.deepEqual(population.quantiles, [0.1, 0.5, 0.9]);
  assert.equal(population.envelopeQuantiles.length, 3);
  assert.equal(median.length, 240);
  assert.ok(Math.abs(population.onsetOffsetSeconds - 0.02) < 1 / sampleRate);
  assert.ok(postOnsetPeak > preOnsetPeak * 4);
  assert.ok(population.peakDelayQuantilesSeconds[1] >= 0);
  assert.ok(population.energy90DelayQuantilesSeconds[1] > 0);
});

test("Rain Diagnostics exposes time-order-independent spectral distribution residuals", () => {
  const sampleRate = 8_000;
  const steady = Float32Array.from(
    { length: sampleRate * 2 },
    (_, index) => 0.5 * Math.sin(2 * Math.PI * 500 * index / sampleRate),
  );
  const varying = Float32Array.from(
    steady,
    (sample, index) => sample * (
      Math.floor(index / (sampleRate * 0.1)) % 2 === 0 ? 0.2 : 2
    ),
  );

  const comparison = compareRainFieldDiagnostics(
    analyzeRainField(varying, sampleRate),
    analyzeRainField(steady, sampleRate),
  );
  const frequencyIndex = comparison.frequenciesHz.reduce(
    (best, frequency, index) => (
      Math.abs(frequency - 500) < Math.abs(comparison.frequenciesHz[best] - 500)
        ? index
        : best
    ),
    0,
  );

  assert.ok(Math.abs(comparison.profileResidualDecibels[frequencyIndex]) < 1);
  assert.ok(comparison.distributionResidualDecibels[0][frequencyIndex] < -8);
  assert.ok(comparison.distributionResidualDecibels.at(-1)[frequencyIndex] > 2);
});

test("Rain Diagnostics compares different sample rates on one shared frequency grid", () => {
  const tone = sampleRate => Float32Array.from(
    { length: sampleRate * 2 },
    (_, index) => 0.4 * Math.sin(2 * Math.PI * 500 * index / sampleRate),
  );

  const comparison = compareRainFieldDiagnostics(
    analyzeRainField(tone(8_000), 8_000),
    analyzeRainField(tone(48_000), 48_000),
  );
  const frequencyIndex = comparison.frequenciesHz.reduce(
    (best, frequency, index) => (
      Math.abs(frequency - 500) < Math.abs(comparison.frequenciesHz[best] - 500)
        ? index
        : best
    ),
    0,
  );

  assert.ok(comparison.frequenciesHz.at(-1) <= 4_000);
  assert.ok(Math.abs(comparison.profileResidualDecibels[frequencyIndex]) < 1);
});
