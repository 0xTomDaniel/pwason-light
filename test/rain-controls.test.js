import assert from "node:assert/strict";
import test from "node:test";

import { createRainControls } from "../src/rain-controls.js";

test("Speed and Drop Population remain independent while unlinked", () => {
  const controls = createRainControls({
    speedLog: 1,
    dropPopulation: 0.8,
    linked: false,
  });

  controls.setSpeedLog(2);
  assert.deepEqual(controls.snapshot(), {
    speedLog: 2,
    rateHz: 100,
    dropPopulation: 0.8,
    linked: false,
  });

  controls.setDropPopulation(0.25);
  assert.equal(controls.snapshot().speedLog, 2);
  assert.equal(controls.snapshot().dropPopulation, 0.25);
});

test("linking aligns Drop Population to normalized logarithmic Speed", () => {
  const controls = createRainControls({
    speedLog: 1.5,
    dropPopulation: 0.9,
    linked: false,
  });

  controls.setLinked(true);
  assert.deepEqual(controls.snapshot(), {
    speedLog: 1.5,
    rateHz: 10 ** 1.5,
    dropPopulation: 0.5,
    linked: true,
  });
});

test("either linked control moves the other and unlinking preserves both", () => {
  const controls = createRainControls({ linked: true });

  controls.setSpeedLog(2.25);
  assert.equal(controls.snapshot().dropPopulation, 0.75);

  controls.setDropPopulation(0.2);
  assert.ok(Math.abs(controls.snapshot().speedLog - 0.6) < 1e-12);
  assert.ok(Math.abs(controls.snapshot().rateHz - 10 ** 0.6) < 1e-12);

  controls.setLinked(false);
  controls.setSpeedLog(3);
  assert.equal(controls.snapshot().dropPopulation, 0.2);
});

test("Rain control inputs are finite and bounded", () => {
  const controls = createRainControls({
    speedLog: 9,
    dropPopulation: -4,
    linked: false,
  });

  assert.deepEqual(controls.snapshot(), {
    speedLog: 3,
    rateHz: 1000,
    dropPopulation: 0,
    linked: false,
  });
  controls.setSpeedLog(Number.NaN);
  controls.setDropPopulation(Number.POSITIVE_INFINITY);
  assert.equal(controls.snapshot().speedLog, 3);
  assert.equal(controls.snapshot().dropPopulation, 0);
});
