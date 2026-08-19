import assert from "node:assert/strict";
import test from "node:test";

import { createRainBlockAccumulator } from "../src/rain-block-accumulator.js";

function renderAt(startFrames, partitions) {
  const accumulator = createRainBlockAccumulator({ sampleRate: 48_000 });
  for (const startFrame of startFrames) {
    accumulator.schedule(startFrame, {
      response: Float32Array.from([0, 1, 0, -0.5, 0]),
      gain: 1,
      stereoPan: 0,
      filter: { cutoffHz: 20_000 },
    });
  }
  const output = [];
  for (const length of partitions) output.push(...accumulator.render(length)[0]);
  return output;
}

test("the audio accumulator sums every Arrival sharing one sample", () => {
  const one = renderAt([2], [8]);
  const two = renderAt([2, 2], [8]);

  assert.deepEqual(two, one.map(sample => sample * 2));
});

test("same-sample Arrival rendering is invariant across audio-block partitions", () => {
  assert.deepEqual(renderAt([2, 2], [3, 5]), renderAt([2, 2], [8]));
});
