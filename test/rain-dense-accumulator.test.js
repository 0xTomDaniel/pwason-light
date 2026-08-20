import assert from "node:assert/strict";
import test from "node:test";

import { createRainDenseAccumulator } from "../src/rain-dense-accumulator.js";

const signatures = Object.freeze([
  Float32Array.from([0.8, -0.45, 0.3, -0.2, 0.12, -0.08, 0.05, -0.03]),
]);

function plan(overrides = {}) {
  return {
    variantIndex: 0,
    gain: 0.25,
    stereoPan: 0,
    filter: { cutoffHz: 20_000 },
    ...overrides,
  };
}

function renderAt(startFrames, partitions) {
  const accumulator = createRainDenseAccumulator({
    sampleRate: 48_000,
    signatures,
  });
  for (const startFrame of startFrames) accumulator.schedule(startFrame, plan());
  const output = [];
  for (const length of partitions) output.push(...accumulator.render(length)[0]);
  return output;
}

test("the dense accumulator preserves every Arrival sharing one sample", () => {
  const one = renderAt([2], [256]);
  const two = renderAt([2, 2], [256]);

  assert.deepEqual(two, one.map(sample => sample * 2));
});

test("dense Arrival rendering is invariant across audio-block partitions", () => {
  const whole = renderAt([2, 2, 61, 129], [384]);
  const partitioned = renderAt([2, 2, 61, 129], [17, 111, 1, 255]);

  assert.deepEqual(partitioned, whole);
});

test("dense response state crosses blocks and reset removes its tail", () => {
  const accumulator = createRainDenseAccumulator({
    sampleRate: 48_000,
    signatures,
  });
  accumulator.schedule(127, plan());
  const first = accumulator.render(128)[0];
  const second = accumulator.render(128)[0];

  assert.equal(first.slice(0, 127).every(sample => sample === 0), true);
  assert.ok(first[127] !== 0);
  assert.ok(second.some(sample => sample !== 0));

  accumulator.reset();
  assert.equal(accumulator.render(128)[0].every(sample => sample === 0), true);
});

test("dense rendering ignores representative weights", () => {
  const exact = createRainDenseAccumulator({ sampleRate: 48_000, signatures });
  const accidental = createRainDenseAccumulator({ sampleRate: 48_000, signatures });
  exact.schedule(0, plan());
  accidental.schedule(0, plan({ renderWeight: 100 }));

  assert.deepEqual(accidental.render(256)[0], exact.render(256)[0]);
});

test("the dense optical tap preserves stereo audio and normalized shared routing", () => {
  const sharedPlan = plan({ channelWeights: Array(8).fill(1 / 8) });
  const plain = createRainDenseAccumulator({
    sampleRate: 48_000,
    channelCount: 2,
    signatures,
  });
  const tapped = createRainDenseAccumulator({
    sampleRate: 48_000,
    channelCount: 2,
    signatures,
  });
  const mono = createRainDenseAccumulator({
    sampleRate: 48_000,
    channelCount: 1,
    signatures,
  });
  plain.schedule(0, sharedPlan);
  tapped.schedule(0, sharedPlan);
  mono.schedule(0, sharedPlan);

  const audio = plain.render(256);
  const detailed = tapped.renderWithOptical(256);
  const monoAudio = mono.render(256)[0];

  assert.deepEqual(detailed.audio, audio);
  for (const channel of detailed.optical) {
    assert.deepEqual(
      channel,
      Float32Array.from(monoAudio, sample => sample / 8),
    );
  }
});
