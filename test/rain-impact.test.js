import assert from "node:assert/strict";
import test from "node:test";

import { createRainImpact } from "../src/rain-impact.js";
import { analyzeSignal } from "../src/signal-analysis.js";

function rms(samples) {
  const energy = samples.reduce((sum, sample) => sum + sample * sample, 0);
  return Math.sqrt(energy / samples.length);
}

test("a generated Rain Impact Waveform is a signed onset with a decaying tail", () => {
  const sampleRate = 48_000;
  const impact = createRainImpact({ sampleRate, seed: 42 });
  const peakIndex = impact.reduce(
    (peak, sample, index) => Math.abs(sample) > Math.abs(impact[peak]) ? index : peak,
    0,
  );
  const onset = impact.slice(0, Math.round(sampleRate * 0.01));
  const tail = impact.slice(-Math.round(sampleRate * 0.02));

  assert.equal(impact.length, Math.round(sampleRate * 0.12));
  assert.ok(Math.min(...impact) < -0.05);
  assert.ok(Math.max(...impact) > 0.05);
  assert.ok(peakIndex < sampleRate * 0.005);
  assert.ok(rms(onset) > rms(tail) * 8);
});

test("a Rain Impact Waveform is reproducible without Channel identity", () => {
  assert.deepEqual(
    createRainImpact({ sampleRate: 44_100, seed: 7 }),
    createRainImpact({ sampleRate: 44_100, seed: 7 }),
  );
});

test("a Rain Impact Waveform follows the measured forest-rain spectral region", () => {
  const sampleRate = 48_000;
  const impact = createRainImpact({ sampleRate, seed: 42 });
  const analysis = analyzeSignal(impact, sampleRate);

  assert.ok(analysis.spectralCentroidHz >= 300);
  assert.ok(analysis.spectralCentroidHz <= 2_500);
  assert.ok(analysis.highBandEnergyRatio < 0.01);
  assert.ok(analysis.spectralFlatness < 0.1);
});
