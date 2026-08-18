import assert from "node:assert/strict";
import test from "node:test";

import {
  createRainImpact,
  createRainMark,
} from "../src/rain-impact.js";
import { createDefaultAcousticFactors } from "../src/acoustic-factors.js";

function rms(samples) {
  const energy = samples.reduce((sum, sample) => sum + sample * sample, 0);
  return Math.sqrt(energy / Math.max(1, samples.length));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

test("Direct Contact and generated surface excitation remain independently auditionable", () => {
  const sampleRate = 48_000;
  const contactOnly = createDefaultAcousticFactors();
  const surfaceOnly = createDefaultAcousticFactors();

  for (const id of ["lowTexture", "midTexture", "highTexture", "microSplashes"] ) {
    contactOnly[id].enabled = false;
  }
  contactOnly.diffuseField.enabled = false;
  surfaceOnly.impactBody.enabled = false;

  const contact = createRainImpact({ sampleRate, seed: 42, factors: contactOnly });
  const surface = createRainImpact({ sampleRate, seed: 42, factors: surfaceOnly });

  assert.ok(rms(contact) > 0);
  assert.ok(rms(surface) > 0);
  assert.notDeepEqual(contact, surface);
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
