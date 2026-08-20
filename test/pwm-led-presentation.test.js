import assert from "node:assert/strict";
import test from "node:test";

import { createPwmLedPresentation } from "../src/pwm-led-presentation.js";

function framesAt(refreshRateHz, count) {
  const intervalMs = 1_000 / refreshRateHz;
  return Array.from({ length: count }, (_, index) => index * intervalMs);
}

test("PWM LED Presentation resolves complete on/off cycles below its quality limit", () => {
  const presentation = createPwmLedPresentation();
  const levels = framesAt(60, 12).map(timestampMs => presentation.frame({
    timestampMs,
    pwmFrequencyHz: 10,
    pwmOnCurrent: 1,
    pwmDutyCycle: 0.5,
  }));

  assert.equal(levels.at(-1).displayRefreshRateHz, 60);
  assert.equal(levels.at(-1).resolvedLimitHz, 15);
  assert.ok(levels.every(frame => frame.mode === "resolved"));
  assert.deepEqual(
    levels.map(frame => frame.level),
    [1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0],
  );
});

test("PWM LED Presentation integrates rates above the display limit without a beat", () => {
  const presentation = createPwmLedPresentation();
  const levels = framesAt(60, 120).map(timestampMs => presentation.frame({
    timestampMs,
    pwmFrequencyHz: 137.5,
    pwmOnCurrent: 1,
    pwmDutyCycle: 0.5,
  }));

  assert.ok(levels.every(frame => frame.mode === "integrated"));
  assert.ok(levels.every(frame => frame.level === 0.5));
});

test("PWM LED Presentation keeps at least four display frames per resolved cycle", () => {
  const presentation = createPwmLedPresentation();
  const frames = framesAt(120, 24).map(timestampMs => presentation.frame({
    timestampMs,
    pwmFrequencyHz: 16,
    pwmOnCurrent: 0.8,
    pwmDutyCycle: 0.25,
  }));

  assert.equal(frames.at(-1).displayRefreshRateHz, 120);
  assert.equal(frames.at(-1).resolvedLimitHz, 15);
  assert.ok(frames.every(frame => frame.mode === "integrated"));
});

test("PWM LED Presentation normalizes fractional timing to a nominal display refresh", () => {
  const presentation = createPwmLedPresentation();
  const frames = framesAt(59.94, 24).map(timestampMs => presentation.frame({
    timestampMs,
    pwmFrequencyHz: 30,
    pwmOnCurrent: 1,
    pwmDutyCycle: 0.5,
  }));

  assert.equal(frames.at(-1).displayRefreshRateHz, 60);
  assert.equal(frames.at(-1).resolvedLimitHz, 15);
  assert.equal(frames.at(-1).mode, "integrated");
});

test("PWM LED Presentation does not alternate display modes when variable refresh drops every other frame", () => {
  const presentation = createPwmLedPresentation();
  let timestampMs = 0;
  const frames = [];

  for (let index = 0; index < 80; index += 1) {
    frames.push(presentation.frame({
      timestampMs,
      pwmFrequencyHz: 12,
      pwmOnCurrent: 1,
      pwmDutyCycle: 0.5,
    }));
    timestampMs += index % 2 === 0 ? 1_000 / 120 : 1_000 / 60;
  }

  assert.equal(frames.at(-1).displayRefreshRateHz, 120);
  assert.ok(frames.slice(12).every(frame => frame.displayRefreshRateHz === 120));
  assert.ok(frames.slice(12).every(frame => frame.mode === "transition"));
});

test("PWM LED Presentation progressively removes modulation before integration", () => {
  const presentation = createPwmLedPresentation();
  const frames = framesAt(60, 120).map(timestampMs => presentation.frame({
    timestampMs,
    pwmFrequencyHz: 12.5,
    pwmOnCurrent: 1,
    pwmDutyCycle: 0.5,
  }));
  const steadyFrames = frames.slice(12);

  assert.ok(steadyFrames.every(frame => frame.mode === "transition"));
  assert.ok(Math.min(...steadyFrames.map(frame => frame.level)) > 0);
  assert.ok(Math.max(...steadyFrames.map(frame => frame.level)) < 1);
});

test("PWM LED Presentation preserves the matched mean when integration begins", () => {
  const presentation = createPwmLedPresentation();
  const frame = presentation.frame({
    timestampMs: 0,
    pwmFrequencyHz: 1_000,
    pwmOnCurrent: 0.5,
    pwmDutyCycle: 0.5,
  });

  assert.equal(frame.mode, "integrated");
  assert.equal(frame.displayRefreshRateHz, 60);
  assert.equal(frame.resolvedLimitHz, 15);
  assert.equal(frame.level, 0.25);
});
