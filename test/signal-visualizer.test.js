import assert from "node:assert/strict";
import test from "node:test";

import { prepareWaveformEnvelope } from "../src/signal-visualizer.js";

test("Signal Visualization normalizes a quiet field while preserving every pixel column's extrema", () => {
  const prepared = prepareWaveformEnvelope(
    Float32Array.from([0, 0.01, -0.02, 0.02, -0.5, 0.4, -0.01, 0.01]),
    4,
    { targetPeak: 1 },
  );

  assert.equal(prepared.minimums.length, 4);
  assert.equal(prepared.maximums.length, 4);
  assert.ok(Math.abs(prepared.normalizationGain - 2) < 0.000001);
  assert.deepEqual(
    [...prepared.minimums].map(value => Number(value.toFixed(3))),
    [0, -0.04, -1, -0.02],
  );
  assert.deepEqual(
    [...prepared.maximums].map(value => Number(value.toFixed(3))),
    [0.02, 0.04, 0.8, 0.02],
  );
});

test("Signal Visualization keeps silence finite", () => {
  const prepared = prepareWaveformEnvelope(new Float32Array(32), 8);

  assert.equal(prepared.normalizationGain, 1);
  assert.deepEqual([...prepared.minimums], Array(8).fill(0));
  assert.deepEqual([...prepared.maximums], Array(8).fill(0));
});
