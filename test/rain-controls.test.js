import assert from "node:assert/strict";
import test from "node:test";

import { createRainControls } from "../src/rain-controls.js";

const MAXIMUM_SPEED_LOG = Math.log10(48_000);
const SPEED_LOG_SPAN = MAXIMUM_SPEED_LOG - 2;

test("Speed and Drop Population remain independent while unlinked", () => {
  const controls = createRainControls({
    speedLog: 3,
    dropPopulation: 0.8,
    linked: false,
  });

  controls.setSpeedLog(4);
  assert.deepEqual(controls.snapshot(), {
    speedLog: 4,
    rateHz: 10_000,
    dropPopulation: 0.8,
    linked: false,
  });

  controls.setDropPopulation(0.25);
  assert.equal(controls.snapshot().speedLog, 4);
  assert.equal(controls.snapshot().dropPopulation, 0.25);
});

test("linking aligns Drop Population to normalized logarithmic Speed", () => {
  const controls = createRainControls({
    speedLog: 3,
    dropPopulation: 0.9,
    linked: false,
  });

  controls.setLinked(true);
  assert.deepEqual(controls.snapshot(), {
    speedLog: 3,
    rateHz: 1_000,
    dropPopulation: 1 / SPEED_LOG_SPAN,
    linked: true,
  });
});

test("either linked control moves the other and unlinking preserves both", () => {
  const controls = createRainControls({ linked: true });

  controls.setSpeedLog(3.5);
  assert.equal(controls.snapshot().dropPopulation, 1.5 / SPEED_LOG_SPAN);

  controls.setDropPopulation(0.2);
  const linkedSpeed = 2 + 0.2 * SPEED_LOG_SPAN;
  assert.ok(Math.abs(controls.snapshot().speedLog - linkedSpeed) < 1e-12);
  assert.ok(Math.abs(controls.snapshot().rateHz - 10 ** linkedSpeed) < 1e-12);

  controls.setLinked(false);
  controls.setSpeedLog(5);
  assert.equal(controls.snapshot().dropPopulation, 0.2);
});

test("Rain control inputs are finite and bounded", () => {
  const controls = createRainControls({
    speedLog: 9,
    dropPopulation: -4,
    linked: false,
  });

  assert.deepEqual(controls.snapshot(), {
    speedLog: MAXIMUM_SPEED_LOG,
    rateHz: 48_000,
    dropPopulation: 0,
    linked: false,
  });
  controls.setSpeedLog(Number.NaN);
  controls.setDropPopulation(Number.POSITIVE_INFINITY);
  assert.equal(controls.snapshot().speedLog, MAXIMUM_SPEED_LOG);
  assert.equal(controls.snapshot().dropPopulation, 0);
});

test("the exact-rendering trial spans 100 through 48000 Arrivals per second", () => {
  const controls = createRainControls({
    speedLog: 3,
    dropPopulation: 0.69,
    linked: false,
  });

  assert.equal(controls.snapshot().rateHz, 1_000);
  controls.setSpeedLog(2);
  assert.equal(controls.snapshot().rateHz, 100);
  controls.setSpeedLog(4);
  assert.equal(controls.snapshot().rateHz, 10_000);
  controls.setSpeedLog(MAXIMUM_SPEED_LOG);
  assert.equal(controls.snapshot().rateHz, 48_000);
});
