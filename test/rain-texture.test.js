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
    dropPopulation: 0.4,
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
  assert.ok(first.response.length >= 1_200);
  assert.ok(first.response.length <= 6_720);
  assert.deepEqual(first.mark, second.mark);
  assert.ok(Math.abs(first.gain - 3.2) < 0.000001);
  assert.equal(afterCallerMutation.gain, first.gain);
  assert.ok(Math.abs(first.stereoPan - 0.25) < 0.000001);
  assert.equal(afterCallerMutation.stereoPan, first.stereoPan);
  assert.equal(first.filter.cutoffHz, 20_000);
  assert.equal(first.filter.q, 0.38);
  assert.equal(renderer.exportResponseBank()[first.variantIndex], first.response);
  assert.equal(renderer.exportResponseBank().length, 192);
});

test("Generated Rain Renderer requires caller-owned Arrivals for an offline profile", () => {
  const renderer = createGeneratedRainRenderer({ sampleRate: 8_000 });

  assert.throws(
    () => renderer.renderProfile({ durationSeconds: 1 }),
    /nextArrival/,
  );
});

test("offline rendering is invariant to continuous block partition size", () => {
  const render = blockSize => {
    const renderer = createGeneratedRainRenderer({
      sampleRate: 12_000,
      dropPopulation: 0.6,
    });
    const engine = createPoissonEngine({
      seed: "block-partition",
      rateHz: 61,
      fieldRadiusMeters: 20,
    });
    return renderer.renderProfile({
      durationSeconds: 2,
      blockSize,
      nextArrival: () => engine.next(),
    });
  };

  const sixtyFour = render(64);
  const fiveEleven = render(511);
  assert.deepEqual(sixtyFour, fiveEleven);
});

test("Drop Population changes generated marks but not caller-owned Arrivals", () => {
  const arrival = Object.freeze({
    id: 9,
    at: 0.25,
    rateHz: 23.1,
    amplitude: 0.6,
    position: Object.freeze({ radialDistanceMeters: 3, azimuthRadians: 0.2 }),
  });
  const fine = createGeneratedRainRenderer({ dropPopulation: 0 }).prepareArrival(arrival);
  const large = createGeneratedRainRenderer({ dropPopulation: 1 }).prepareArrival(arrival);

  assert.notDeepEqual(fine.mark, large.mark);
  assert.equal(arrival.at, 0.25);
  assert.equal(arrival.rateHz, 23.1);
  assert.equal(fine.mark.population, 0);
  assert.equal(large.mark.population, 1);
});
