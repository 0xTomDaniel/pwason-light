import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultAcousticFactors } from "../src/acoustic-factors.js";
import { createPoissonEngine } from "../src/poisson-engine.js";
import { createGeneratedRainRenderer } from "../src/rain-texture.js";

function rms(samples) {
  const energy = samples.reduce((sum, sample) => sum + sample * sample, 0);
  return Math.sqrt(energy / samples.length);
}

function renderDefaultProfile(factors) {
  const renderer = createGeneratedRainRenderer({
    sampleRate: 24_000,
    factors,
  });
  const engine = createPoissonEngine({
    seed: "diffuse-balance-profile",
    rateHz: 23.1,
    fieldRadiusMeters: 20,
  });
  return renderer.renderProfile({
    durationSeconds: 4,
    nextArrival: () => engine.next(),
  });
}

test("Generated Rain Renderer prepares one deterministic live Arrival plan", () => {
  const factors = createDefaultAcousticFactors();
  factors.distanceLoss.enabled = false;
  factors.stereoSpread.amount = 0.5;
  factors.airDamping.enabled = false;
  factors.densityCompensation.enabled = false;
  factors.eventVariation.enabled = false;
  const renderer = createGeneratedRainRenderer({
    sampleRate: 48_000,
    factors,
  });
  const arrival = {
    id: 17,
    rateHz: 100,
    amplitude: 1,
    position: {
      radialDistanceMeters: 4,
      azimuthRadians: Math.PI / 4,
    },
  };

  const first = renderer.prepareArrival(arrival);
  const second = renderer.prepareArrival(arrival);

  factors.distanceLoss.enabled = true;
  factors.stereoSpread.amount = 1;
  factors.eventVariation.enabled = true;
  const afterCallerMutation = renderer.prepareArrival(arrival);

  assert.equal(first.response, second.response);
  assert.equal(first.response, afterCallerMutation.response);
  assert.equal(first.response.length, 28_800);
  assert.ok(Math.abs(first.gain - 0.26) < 0.000001);
  assert.equal(afterCallerMutation.gain, first.gain);
  assert.ok(Math.abs(first.stereoPan - 0.25) < 0.000001);
  assert.equal(afterCallerMutation.stereoPan, first.stereoPan);
  assert.equal(first.filter.cutoffHz, 20_000);
  assert.equal(first.filter.q, 0.38);
});

test("Generated Rain Renderer requires caller-owned Arrivals for an offline profile", () => {
  const renderer = createGeneratedRainRenderer({ sampleRate: 8_000 });

  assert.throws(
    () => renderer.renderProfile({ durationSeconds: 1 }),
    /nextArrival/,
  );
});

test("the default Diffuse Response supports rather than dominates generated rain", () => {
  const factors = createDefaultAcousticFactors();
  const withDiffuse = renderDefaultProfile(factors);
  factors.diffuseField.enabled = false;
  const withoutDiffuse = renderDefaultProfile(factors);
  const diffuseContribution = Float32Array.from(
    withDiffuse,
    (sample, index) => sample - withoutDiffuse[index],
  );

  assert.ok(rms(diffuseContribution) / rms(withDiffuse) < 0.22);
});
