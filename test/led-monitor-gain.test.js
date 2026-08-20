import assert from "node:assert/strict";
import test from "node:test";

import { maximumSafeMonitorGain } from "../src/led-monitor-gain.js";

test("Monitor Gain is bounded by every target-centered waveform's exact peak", () => {
  assert.equal(maximumSafeMonitorGain(0.5), 2);
  assert.equal(maximumSafeMonitorGain(0.25), 4 / 3);
  assert.equal(maximumSafeMonitorGain(0.75), 4 / 3);
  assert.equal(maximumSafeMonitorGain(1), 1);
});

test("Monitor Gain safely bounds invalid Target Mean Current input", () => {
  assert.equal(maximumSafeMonitorGain(-1), 1);
  assert.equal(maximumSafeMonitorGain(2), 1);
  assert.equal(maximumSafeMonitorGain(Number.NaN), 2);
});
