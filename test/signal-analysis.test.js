import assert from "node:assert/strict";
import test from "node:test";

import { analyzeSignal, extractProminentImpact } from "../src/signal-analysis.js";

test("Signal Analysis identifies the frequency shape of a known tone", () => {
  const sampleRate = 48_000;
  const frequencyHz = 1_000;
  const samples = Float32Array.from(
    { length: Math.round(sampleRate * 0.12) },
    (_, index) => Math.sin(2 * Math.PI * frequencyHz * index / sampleRate),
  );

  const analysis = analyzeSignal(samples, sampleRate);

  assert.ok(analysis.spectralCentroidHz > 950);
  assert.ok(analysis.spectralCentroidHz < 1_050);
  assert.ok(analysis.highBandEnergyRatio < 0.001);
  assert.ok(analysis.spectralFlatness < 0.01);
});

test("a Rain Reference comparison isolates its strongest 120 millisecond impact", () => {
  const sampleRate = 48_000;
  const samples = new Float32Array(sampleRate);
  samples[24_000] = -0.9;
  samples[36_000] = 0.4;

  const impact = extractProminentImpact(samples, sampleRate);

  assert.equal(impact.samples.length, 5_760);
  assert.equal(impact.peakSeconds, 0.5);
  assert.equal(impact.startSeconds, 0.495);
  assert.ok(Math.abs(impact.samples[240] + 0.9) < 0.000001);
});
