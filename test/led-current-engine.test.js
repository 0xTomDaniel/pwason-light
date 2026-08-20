import assert from "node:assert/strict";
import test from "node:test";

import { createPoissonLedLabEngine } from "../src/led-current-engine.js";

function concatenate(blocks, key) {
  const totalLength = blocks.reduce((sum, block) => sum + block[key].length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const block of blocks) {
    result.set(block[key], offset);
    offset += block[key].length;
  }
  return result;
}

test("the LED lab generates one reproducible total-lamp Poisson field split across eight Channels", () => {
  const first = createPoissonLedLabEngine({
    seed: "current-first",
    sampleRate: 8_000,
    rateHz: 800,
  });
  const second = createPoissonLedLabEngine({
    seed: "current-first",
    sampleRate: 8_000,
    rateHz: 800,
  });

  const firstBlock = first.render(80_000);
  const secondBlock = second.render(80_000);

  assert.deepEqual(firstBlock.arrivalsByChannel, secondBlock.arrivalsByChannel);
  assert.equal(firstBlock.arrivalCount, firstBlock.arrivalsByChannel.reduce((sum, count) => sum + count, 0));
  assert.ok(Math.abs(firstBlock.arrivalCount / 10 - 800) < 30);
  assert.ok(firstBlock.arrivalsByChannel.every(count => Math.abs(count / 10 - 100) < 18));
});

test("Aggregate White is the sample-by-sample arithmetic mean of the eight positive current Channels", () => {
  const engine = createPoissonLedLabEngine({
    seed: "white-fusion",
    sampleRate: 48_000,
    rateHz: 12_000,
  });
  const block = engine.render(4_096);

  for (let sample = 0; sample < block.fusedCurrent.length; sample += 1) {
    const expected = block.currentChannels.reduce(
      (sum, channel) => sum + channel[sample],
      0,
    ) / 8;
    assert.ok(Math.abs(block.fusedCurrent[sample] - expected) < 1e-7);
  }
  assert.ok(block.currentChannels.every(channel => (
    channel.every(current => current >= 0 && current < 1)
  )));
});

test("the only sound transformation is the declared current-to-AC recurrence", () => {
  const engine = createPoissonLedLabEngine({
    seed: "direct-monitor",
    sampleRate: 48_000,
    rateHz: 2_400,
    dcBlockHz: 2,
  });
  const block = engine.render(8_192);
  const coefficient = engine.snapshot().dcBlockCoefficient;

  let previousCurrent = 0;
  let previousAudio = 0;
  for (let sample = 0; sample < block.audioMonitor.length; sample += 1) {
    const expected = block.fusedCurrent[sample] - previousCurrent + coefficient * previousAudio;
    assert.ok(Math.abs(block.audioMonitor[sample] - expected) < 1e-6);
    previousCurrent = block.fusedCurrent[sample];
    previousAudio = block.audioMonitor[sample];
  }
});

test("rendering is invariant to AudioWorklet block partitions", () => {
  const settings = {
    seed: "partition-proof",
    sampleRate: 48_000,
    rateHz: 9_600,
    pulseWidthMs: 4,
    targetCurrent: 0.5,
  };
  const whole = createPoissonLedLabEngine(settings).render(1_024);
  const partitionedEngine = createPoissonLedLabEngine(settings);
  const parts = [
    partitionedEngine.render(128),
    partitionedEngine.render(384),
    partitionedEngine.render(512),
  ];

  assert.deepEqual(concatenate(parts, "fusedCurrent"), whole.fusedCurrent);
  assert.deepEqual(concatenate(parts, "audioMonitor"), whole.audioMonitor);
  for (let channel = 0; channel < 8; channel += 1) {
    const partitioned = new Float32Array(1_024);
    partitioned.set(parts[0].currentChannels[channel], 0);
    partitioned.set(parts[1].currentChannels[channel], 128);
    partitioned.set(parts[2].currentChannels[channel], 512);
    assert.deepEqual(partitioned, whole.currentChannels[channel]);
  }
});

test("48 kHz means 48 kHz for the lamp and 6 kHz expected for each Channel", () => {
  const engine = createPoissonLedLabEngine({ rateHz: 100_000 });
  const snapshot = engine.snapshot();

  assert.equal(snapshot.rateHz, 48_000);
  assert.equal(snapshot.expectedChannelRateHz, 6_000);
});

test("constant-mean scaling makes modulation converge as total rate rises", () => {
  function modulationAt(rateHz) {
    const engine = createPoissonLedLabEngine({
      seed: `convergence-${rateHz}`,
      sampleRate: 48_000,
      rateHz,
      pulseWidthMs: 4,
      targetCurrent: 0.5,
    });
    const block = engine.render(480_000);
    const mean = block.fusedCurrent.reduce((sum, value) => sum + value, 0) / block.fusedCurrent.length;
    const variance = block.fusedCurrent.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0,
    ) / block.fusedCurrent.length;
    return { mean, rms: Math.sqrt(variance) };
  }

  const medium = modulationAt(4_800);
  const dense = modulationAt(48_000);

  assert.ok(Math.abs(dense.mean - 0.5) < 0.04);
  assert.ok(dense.rms < medium.rms * 0.55);
});
