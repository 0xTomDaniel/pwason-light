import assert from "node:assert/strict";
import test from "node:test";

import { sampleLedOutput } from "../src/led-renderer.js";

test("an LED pulse remains visible across animation frames for its seconds-based decay", () => {
  const pulse = {
    startedAt: 1_000,
    attack: 0.05,
    decay: 0.5,
    amplitude: 1,
    channelWeights: [1, 0, 0, 0, 0, 0, 0, 0],
  };

  const output = sampleLedOutput([pulse], 1_250);

  assert.equal(output.activePulses.length, 1);
  assert.ok(output.levels[0] > 0);
  assert.deepEqual(output.levels.slice(1), [0, 0, 0, 0, 0, 0, 0]);
});

test("an LED pulse is removed after its visible tail has decayed", () => {
  const pulse = {
    startedAt: 1_000,
    attack: 0.05,
    decay: 0.5,
    amplitude: 1,
    channelWeights: [1, 0, 0, 0, 0, 0, 0, 0],
  };

  const output = sampleLedOutput([pulse], 2_701);

  assert.deepEqual(output.activePulses, []);
  assert.deepEqual(output.levels, [0, 0, 0, 0, 0, 0, 0, 0]);
});
