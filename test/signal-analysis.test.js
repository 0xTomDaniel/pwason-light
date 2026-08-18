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

test("Signal Analysis distinguishes a continuous texture from isolated percussive bursts", () => {
  const sampleRate = 48_000;
  const continuous = Float32Array.from(
    { length: sampleRate },
    (_, index) => 0.2 * Math.sin(2 * Math.PI * 1_000 * index / sampleRate),
  );
  const bursts = Float32Array.from(
    { length: sampleRate },
    (_, index) => {
      const position = index % Math.round(sampleRate * 0.2);
      const envelope = position < sampleRate * 0.01
        ? Math.exp(-position / (sampleRate * 0.0025))
        : 0;
      return envelope * Math.sin(2 * Math.PI * 1_000 * index / sampleRate);
    },
  );

  const continuousAnalysis = analyzeSignal(continuous, sampleRate, {
    includeSpectrogram: false,
  });
  const burstAnalysis = analyzeSignal(bursts, sampleRate, {
    includeSpectrogram: false,
  });

  assert.ok(continuousAnalysis.envelopeCoefficientOfVariation < 0.05);
  assert.ok(continuousAnalysis.envelopeFloorRatio > 0.9);
  assert.ok(burstAnalysis.envelopeCoefficientOfVariation > 2);
  assert.ok(burstAnalysis.envelopeFloorRatio < 0.05);
  assert.ok(burstAnalysis.crestFactor > continuousAnalysis.crestFactor * 2);
});

test("Signal Analysis measures whether frequency-region envelopes move together", () => {
  const sampleRate = 48_000;
  const length = sampleRate * 2;
  const correlated = new Float32Array(length);
  const alternating = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    const block = Math.floor(index / (sampleRate * 0.05));
    const commonEnvelope = block % 2 === 0 ? 1 : 0.08;
    const lowEnvelope = block % 2 === 0 ? 1 : 0.08;
    const highEnvelope = block % 2 === 0 ? 0.08 : 1;
    const low = Math.sin(2 * Math.PI * 500 * index / sampleRate);
    const high = Math.sin(2 * Math.PI * 10_000 * index / sampleRate);
    correlated[index] = commonEnvelope * (low + high) * 0.2;
    alternating[index] = (lowEnvelope * low + highEnvelope * high) * 0.2;
  }

  const together = analyzeSignal(correlated, sampleRate, {
    includeSpectrogram: false,
  });
  const apart = analyzeSignal(alternating, sampleRate, {
    includeSpectrogram: false,
  });

  assert.ok(together.bandEnvelopeCorrelation > 0.75);
  assert.ok(apart.bandEnvelopeCorrelation < 0.3);
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

test("Signal Analysis exposes impulsiveness and multiscale envelope structure", () => {
  const sampleRate = 8_000;
  const steady = Float32Array.from(
    { length: sampleRate * 2 },
    (_, index) => 0.2 * Math.sin(2 * Math.PI * 400 * index / sampleRate),
  );
  const impulses = new Float32Array(sampleRate * 2);
  for (let index = 0; index < impulses.length; index += 800) impulses[index] = 1;

  const steadyAnalysis = analyzeSignal(steady, sampleRate, { includeSpectrogram: false });
  const impulseAnalysis = analyzeSignal(impulses, sampleRate, { includeSpectrogram: false });

  assert.ok(impulseAnalysis.sampleKurtosis > steadyAnalysis.sampleKurtosis * 10);
  assert.deepEqual(Object.keys(impulseAnalysis.envelopeScales), ["5", "20", "100", "500"]);
  assert.ok(
    impulseAnalysis.envelopeScales[20].coefficientOfVariation
      > steadyAnalysis.envelopeScales[20].coefficientOfVariation,
  );
});
