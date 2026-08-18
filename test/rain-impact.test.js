import assert from "node:assert/strict";
import test from "node:test";

import { createRainImpact } from "../src/rain-impact.js";
import { createDefaultAcousticFactors } from "../src/acoustic-factors.js";
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

test("impact and surface texture contributions can be auditioned independently", () => {
  const sampleRate = 48_000;
  const impactOnly = createDefaultAcousticFactors();
  const textureOnly = createDefaultAcousticFactors();

  for (const id of ["lowTexture", "midTexture", "highTexture", "microSplashes"]) {
    impactOnly[id].enabled = false;
  }
  textureOnly.impactBody.enabled = false;

  const impactSamples = createRainImpact({ sampleRate, seed: 42, factors: impactOnly });
  const textureSamples = createRainImpact({ sampleRate, seed: 42, factors: textureOnly });

  assert.ok(rms(impactSamples) > 0);
  assert.ok(rms(textureSamples) > 0);
  assert.notDeepEqual(impactSamples, textureSamples);
});

test("Micro-splashes add delayed energy without changing the 120 ms Arrival response", () => {
  const sampleRate = 48_000;
  const dry = createDefaultAcousticFactors();
  const wet = createDefaultAcousticFactors();
  dry.microSplashes.enabled = false;
  wet.microSplashes.amount = 1;
  wet.microSplashDelay.amount = 1;

  const drySamples = createRainImpact({ sampleRate, seed: 9, factors: dry });
  const wetSamples = createRainImpact({ sampleRate, seed: 9, factors: wet });
  const delayedStart = Math.round(sampleRate * 0.045);

  assert.equal(wetSamples.length, drySamples.length);
  assert.ok(rms(wetSamples.slice(delayedStart)) > rms(drySamples.slice(delayedStart)));
});

test("generated Rain Impact Waveforms follow the Redwood recording's steady profile", () => {
  const sampleRate = 48_000;
  const averagedSpectrum = new Float64Array(257);
  for (let seed = 1; seed <= 128; seed += 1) {
    const analysis = analyzeSignal(createRainImpact({ sampleRate, seed }), sampleRate);
    analysis.spectrum.forEach((power, bin) => {
      averagedSpectrum[bin] += power / 128;
    });
  }

  let totalEnergy = 0;
  let weightedFrequency = 0;
  let highBandEnergy = 0;
  let logPower = 0;
  for (let bin = 0; bin < averagedSpectrum.length; bin += 1) {
    const power = averagedSpectrum[bin];
    const frequency = bin * sampleRate / 512;
    totalEnergy += power;
    weightedFrequency += power * frequency;
    if (frequency >= 8_000) highBandEnergy += power;
    logPower += Math.log(Math.max(power, 1e-20));
  }
  const centroid = weightedFrequency / totalEnergy;
  const highBandRatio = highBandEnergy / totalEnergy;
  const flatness = Math.exp(logPower / averagedSpectrum.length) /
    (totalEnergy / averagedSpectrum.length);

  assert.ok(centroid >= 3_500);
  assert.ok(centroid <= 5_000);
  assert.ok(highBandRatio >= 0.16);
  assert.ok(highBandRatio <= 0.30);
  assert.ok(flatness < 0.55);
});
