import assert from "node:assert/strict";
import test from "node:test";

import {
  createPoissonLedLabEngine,
  derivePwmTiming,
} from "../src/led-current-engine.js";
import { createLedLabComparisonEngine } from "../src/led-lab-comparison-engine.js";

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

test("the only sound transformation is direct commanded-mean subtraction", () => {
  const engine = createPoissonLedLabEngine({
    seed: "direct-monitor",
    sampleRate: 48_000,
    rateHz: 2_400,
    targetCurrent: 0.35,
  });
  const block = engine.render(8_192);

  for (let sample = 0; sample < block.audioMonitor.length; sample += 1) {
    const expected = block.fusedCurrent[sample] - 0.35;
    assert.ok(Math.abs(block.audioMonitor[sample] - expected) < 1e-6);
  }
  assert.equal("dcBlockCoefficient" in engine.snapshot(), false);
  assert.equal("dcBlockHz" in engine.snapshot(), false);
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

test("PWM is a matched periodic control with the same total event budget", () => {
  const engine = createPoissonLedLabEngine({
    source: "pwm",
    sampleRate: 48_000,
    rateHz: 8_000,
    targetCurrent: 0.25,
  });
  const block = engine.render(48_000);
  const snapshot = engine.snapshot();
  const mean = block.fusedCurrent.reduce((sum, value) => sum + value, 0) /
    block.fusedCurrent.length;

  assert.equal(snapshot.source, "pwm");
  assert.equal(snapshot.pwmFrequencyHz, 1_000);
  assert.equal(block.eventKind, "PWM rising edges");
  assert.equal(block.eventCount, 8_000);
  assert.deepEqual(block.eventsByChannel, Array(8).fill(1_000));
  assert.ok(Math.abs(mean - 0.25) < 1e-6);
  assert.ok(block.currentChannels.every(channel => (
    channel.every(current => current === 0 || current === 1)
  )));
  assert.ok(block.currentChannels.slice(1).every(channel => (
    channel.every((current, sample) => current === block.currentChannels[0][sample])
  )));
});

test("PWM On Current trades on-state height for duty while preserving commanded mean", () => {
  const engine = createPoissonLedLabEngine({
    source: "pwm",
    sampleRate: 48_000,
    rateHz: 8_000,
    targetCurrent: 0.25,
    pwmOnCurrent: 0.5,
  });
  const block = engine.render(48_000);
  const snapshot = engine.snapshot();
  const mean = block.fusedCurrent.reduce((sum, value) => sum + value, 0) /
    block.fusedCurrent.length;

  assert.equal(snapshot.pwmOnCurrent, 0.5);
  assert.equal("pwmPulseCurrent" in snapshot, false);
  assert.equal(snapshot.pwmDutyCycle, 0.5);
  assert.ok(Math.abs(mean - 0.25) < 2e-5);
  assert.ok(block.currentChannels.every(channel => (
    channel.every(current => current === 0 || current === 0.5)
  )));
});

test("PWM On Current cannot imply a duty cycle above 100%", () => {
  const engine = createPoissonLedLabEngine({
    source: "pwm",
    targetCurrent: 0.6,
    pwmOnCurrent: 0.4,
  });

  assert.equal(engine.snapshot().pwmOnCurrent, 0.6);
  assert.equal(engine.snapshot().pwmDutyCycle, 1);

  const snapshot = engine.configure({
    targetCurrent: 0.8,
    pwmOnCurrent: 0.7,
  });
  assert.equal(snapshot.pwmOnCurrent, 0.8);
  assert.equal(snapshot.pwmDutyCycle, 1);
});

test("PWM timing reports on-time and silence from frequency, mean, and PWM On Current", () => {
  const fullPulse = derivePwmTiming({
    totalRateHz: 8_000,
    channelCount: 8,
    targetCurrent: 0.25,
    pwmOnCurrent: 1,
  });
  const reducedPulse = derivePwmTiming({
    totalRateHz: 8_000,
    channelCount: 8,
    targetCurrent: 0.25,
    pwmOnCurrent: 0.5,
  });

  assert.deepEqual(fullPulse, {
    frequencyHz: 1_000,
    periodSeconds: 0.001,
    dutyCycle: 0.25,
    onTimeSeconds: 0.00025,
    silenceSeconds: 0.00075,
  });
  assert.deepEqual(reducedPulse, {
    frequencyHz: 1_000,
    periodSeconds: 0.001,
    dutyCycle: 0.5,
    onTimeSeconds: 0.0005,
    silenceSeconds: 0.0005,
  });
});

test("PWM uses the same direct current-to-AC monitor as Poisson current", () => {
  const engine = createPoissonLedLabEngine({
    source: "pwm",
    sampleRate: 48_000,
    rateHz: 8_000,
    targetCurrent: 0.25,
  });
  const block = engine.render(1_024);

  for (let sample = 0; sample < block.audioMonitor.length; sample += 1) {
    const expected = block.fusedCurrent[sample] - 0.25;
    assert.ok(Math.abs(block.audioMonitor[sample] - expected) < 1e-6);
  }
});

test("switching source conditions starts the selected experiment from a clean state", () => {
  const engine = createPoissonLedLabEngine({
    seed: "source-switch",
    source: "poisson",
    sampleRate: 48_000,
    rateHz: 8_000,
  });
  engine.render(2_048);

  const snapshot = engine.configure({ source: "pwm" });
  const pwm = engine.render(1);

  assert.equal(snapshot.source, "pwm");
  assert.equal(snapshot.elapsedSamples, 0);
  assert.equal(snapshot.totalEvents, 0);
  assert.ok(pwm.currentChannels.every(channel => channel[0] === 1));
});

test("the comparison engine renders Poisson and PWM continuously from shared controls", () => {
  const engine = createLedLabComparisonEngine({
    seed: "parallel-control",
    sampleRate: 48_000,
    rateHz: 8_000,
    pulseWidthMs: 4,
    targetCurrent: 0.25,
  });

  const first = engine.render(48_000);
  const beforeSwitch = engine.snapshot();
  engine.configure({ monitorSource: "pwm" });
  const second = engine.render(128);
  const afterSwitch = engine.snapshot();

  assert.equal(first.conditions.poisson.fusedCurrent.length, 48_000);
  assert.equal(first.conditions.pwm.eventCount, 8_000);
  assert.ok(Math.abs(first.conditions.poisson.eventCount - 8_000) < 300);
  assert.equal(beforeSwitch.conditions.poisson.elapsedSamples, 48_000);
  assert.equal(beforeSwitch.conditions.pwm.elapsedSamples, 48_000);
  assert.equal(afterSwitch.conditions.poisson.elapsedSamples, 48_128);
  assert.equal(afterSwitch.conditions.pwm.elapsedSamples, 48_128);
  assert.equal(afterSwitch.monitorSource, "pwm");
  assert.equal(second.audioMonitor, second.conditions.pwm.audioMonitor);
});

test("shared comparison settings configure both conditions without cross-coupling their source", () => {
  const engine = createLedLabComparisonEngine();
  const snapshot = engine.configure({
    rateHz: 48_000,
    pulseWidthMs: 2,
    targetCurrent: 0.4,
  });

  assert.equal(snapshot.conditions.poisson.source, "poisson");
  assert.equal(snapshot.conditions.pwm.source, "pwm");
  for (const condition of Object.values(snapshot.conditions)) {
    assert.equal(condition.rateHz, 48_000);
    assert.equal(condition.targetCurrent, 0.4);
  }
  assert.equal(snapshot.conditions.poisson.pulseWidthMs, 2);
});

test("100% target is an explicit full-DC endpoint while both clocks continue", () => {
  for (const source of ["poisson", "pwm"]) {
    const engine = createPoissonLedLabEngine({
      seed: `full-dc-${source}`,
      source,
      sampleRate: 8_000,
      rateHz: 800,
      targetCurrent: 1,
    });
    const block = engine.render(8_000);

    assert.equal(engine.snapshot().targetCurrent, 1);
    assert.ok(block.currentChannels.every(channel => (
      channel.every(current => current === 1)
    )));
    assert.ok(block.fusedCurrent.every(current => current === 1));
    assert.ok(block.audioMonitor.every(sample => sample === 0));
    assert.ok(block.eventCount > 0);
  }
});
