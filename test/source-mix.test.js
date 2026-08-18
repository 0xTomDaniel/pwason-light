import assert from "node:assert/strict";
import test from "node:test";

import { calculateSourceMix } from "../src/source-mix.js";

test("Source Mix crossfades continuously between synthesis and selected Reference Playback", () => {
  assert.deepEqual(calculateSourceMix(0), {
    generatedGain: 1,
    referenceGain: 0,
  });

  const midpoint = calculateSourceMix(0.5);
  assert.ok(Math.abs(midpoint.generatedGain - Math.SQRT1_2) < 0.000001);
  assert.ok(Math.abs(midpoint.referenceGain - Math.SQRT1_2) < 0.000001);

  const referenceOnly = calculateSourceMix(1);
  assert.ok(referenceOnly.generatedGain < 0.000001);
  assert.equal(referenceOnly.referenceGain, 1);
});

test("Source Mix bounds values outside its slider range", () => {
  assert.deepEqual(calculateSourceMix(-1), calculateSourceMix(0));
  assert.deepEqual(calculateSourceMix(2), calculateSourceMix(1));
});
