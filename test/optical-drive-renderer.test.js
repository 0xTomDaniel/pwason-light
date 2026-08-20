import assert from "node:assert/strict";
import test from "node:test";

import { createOpticalDriveRenderer } from "../src/optical-drive-renderer.js";

function constantChannels(values, length = 8) {
  return values.map(value => Float32Array.from({ length }, () => value));
}

test("optical drive full-wave rectifies signed buses from dark silence through a smooth limiter", () => {
  const renderer = createOpticalDriveRenderer({ sensitivity: 1 });

  renderer.process(constantChannels([-1, -0.5, 0, 0.5, 1, 0, 0, 0]));
  const snapshot = renderer.snapshot();

  assert.deepEqual(snapshot.levels.slice(0, 8), [0.5, 1 / 3, 0, 1 / 3, 0.5, 0, 0, 0]);
  assert.ok(Math.abs(snapshot.levels[8] - 5 / 24) < 1e-12);
  assert.equal(snapshot.currentRms[0], 0.5);
  assert.ok(Math.abs(snapshot.currentRms[1] - 1 / 3) < 1e-12);
  assert.ok(Math.abs(snapshot.currentRms[8] - 5 / 24) < 1e-12);
  assert.equal(snapshot.sampleCount, 8);
});

test("identical audio produces identical optical drive at every Speed", () => {
  const low = createOpticalDriveRenderer({
    rateHz: 100,
  });
  const high = createOpticalDriveRenderer({
    rateHz: 48_000,
  });
  const input = constantChannels(Array(8).fill(0.2));

  low.process(input);
  high.process(input);

  assert.deepEqual(high.snapshot(), low.snapshot());
});

test("optical drive gives both pressure polarities equal current and silence no current", () => {
  const negative = createOpticalDriveRenderer({ sensitivity: 1 });
  const positive = createOpticalDriveRenderer({ sensitivity: 1 });
  const silent = createOpticalDriveRenderer({ sensitivity: 1 });

  negative.process(constantChannels(Array(8).fill(-0.25), 1));
  positive.process(constantChannels(Array(8).fill(0.25), 1));
  silent.process(constantChannels(Array(8).fill(0), 1));

  assert.deepEqual(negative.snapshot().levels, positive.snapshot().levels);
  assert.deepEqual(silent.snapshot().levels, Array(9).fill(0));
});

test("raw-current diagnostics are invariant across block partitions", () => {
  function render(partitions) {
    const renderer = createOpticalDriveRenderer();
    for (const length of partitions) {
      renderer.process(constantChannels(Array(8).fill(0.5), length));
    }
    return renderer.snapshot();
  }

  assert.deepEqual(render([32]), render([7, 9, 16]));
});
