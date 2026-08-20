import assert from "node:assert/strict";
import test from "node:test";

import { prepareScopeEnvelope } from "../src/led-scope-visualizer.js";

test("Scope Visualization preserves sustained positive PWM plateaus", () => {
  const envelope = prepareScopeEnvelope(
    Float32Array.from([0, 0, 1, 1, 1, 1, 0, 0]),
    4,
  );

  assert.deepEqual([...envelope.minimums], [0, 1, 1, 0]);
  assert.deepEqual([...envelope.maximums], [0, 1, 1, 0]);
});

test("Scope Visualization preserves unresolved within-column excursions", () => {
  const envelope = prepareScopeEnvelope(
    Float32Array.from([0, 1, 0, 1, -0.5, 0.5, -0.5, 0.5]),
    2,
  );

  assert.deepEqual([...envelope.minimums], [0, -0.5]);
  assert.deepEqual([...envelope.maximums], [1, 0.5]);
});
