import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultAcousticFactors } from "../src/acoustic-factors.js";
import { createRainArrivalRendering } from "../src/rain-arrival-rendering.js";

test("live Arrival rendering exposes one deterministic worklet-ready plan", () => {
  const factors = createDefaultAcousticFactors();
  factors.distanceLoss.enabled = false;
  factors.densityCompensation.enabled = false;
  factors.eventVariation.enabled = false;
  const rendering = createRainArrivalRendering({ factors, responseCount: 192 });
  const arrival = {
    id: 3,
    rateHz: 10_000,
    amplitude: 0.5,
    position: { radialDistanceMeters: 0, azimuthRadians: 0 },
  };

  assert.deepEqual(rendering.prepareArrival(arrival), {
    variantIndex: 83,
    gain: 3.2,
    stereoPan: 0,
    filter: { cutoffHz: 20_000, q: 0.38 },
  });
  assert.deepEqual(
    rendering.prepareArrival({ ...arrival, renderWeight: 50 }),
    rendering.prepareArrival(arrival),
  );
});
