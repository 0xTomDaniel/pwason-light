import test from "node:test";
import assert from "node:assert/strict";

import { prepareImpactAudition } from "../src/impact-playback.js";

test("Impact Audition level-matches one segment and removes excerpt-edge clicks", () => {
  const source = Float32Array.from([
    0.3, 0.3, 0.6, 0.8, 0.4, -0.2, -0.4, -0.4,
  ]);

  const audition = prepareImpactAudition(source, {
    sampleRate: 1_000,
    targetPeak: 0.5,
    fadeSeconds: 0.002,
  });

  assert.equal(audition.sampleRate, 1_000);
  assert.equal(audition.samples.length, source.length);
  assert.equal(audition.samples[0], 0);
  assert.equal(audition.samples.at(-1), 0);
  assert.ok(Math.abs(Math.max(...audition.samples.map(Math.abs)) - 0.5) < 1e-6);
  assert.deepEqual(source, Float32Array.from([
    0.3, 0.3, 0.6, 0.8, 0.4, -0.2, -0.4, -0.4,
  ]));
});

test("Impact Audition keeps a silent diagnostic segment finite", () => {
  const audition = prepareImpactAudition(new Float32Array(120), {
    sampleRate: 48_000,
  });

  assert.ok(audition.samples.every(sample => sample === 0));
});
