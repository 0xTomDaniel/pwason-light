import assert from "node:assert/strict";
import test from "node:test";

import {
  RAIN_DENSE_RESPONSE_THRESHOLD_HZ,
  selectRainAudioRendering,
} from "../src/rain-rendering-policy.js";

test("the accepted 10k trial keeps complete impact waveforms", () => {
  assert.equal(RAIN_DENSE_RESPONSE_THRESHOLD_HZ, 10_000);
  assert.equal(selectRainAudioRendering(10_000), "impact-waveforms");
});

test("rates above 10k preserve arrivals through the dense response field", () => {
  assert.equal(selectRainAudioRendering(10_001), "dense-response-field");
  assert.equal(selectRainAudioRendering(100_000), "dense-response-field");
});
