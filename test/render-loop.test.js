import assert from "node:assert/strict";
import test from "node:test";

import { createRenderLoop } from "../src/render-loop.js";

test("a stopped Render Loop draws once and then becomes idle", () => {
  const requestedFrames = [];
  const drawnAt = [];
  const loop = createRenderLoop({
    draw: now => drawnAt.push(now),
    isActive: () => false,
    requestFrame: callback => requestedFrames.push(callback),
  });

  loop.wake();
  loop.wake();
  assert.equal(requestedFrames.length, 1);

  requestedFrames.shift()(100);

  assert.deepEqual(drawnAt, [100]);
  assert.equal(requestedFrames.length, 0);
});

test("an active Render Loop caps visual drawing at 30 frames per second", () => {
  const requestedFrames = [];
  const drawnAt = [];
  let active = true;
  const loop = createRenderLoop({
    draw: now => drawnAt.push(now),
    isActive: () => active,
    requestFrame: callback => requestedFrames.push(callback),
    framesPerSecond: 30,
  });

  loop.wake();
  requestedFrames.shift()(0);
  requestedFrames.shift()(10);
  requestedFrames.shift()(20);
  requestedFrames.shift()(34);
  active = false;
  requestedFrames.shift()(44);
  requestedFrames.shift()(68);

  assert.deepEqual(drawnAt, [0, 34, 68]);
  assert.equal(requestedFrames.length, 0);
});

test("a stopped Render Loop retries a throttled frame so final state is drawn", () => {
  const requestedFrames = [];
  const drawnAt = [];
  let active = true;
  const loop = createRenderLoop({
    draw: now => drawnAt.push(now),
    isActive: () => active,
    requestFrame: callback => requestedFrames.push(callback),
    framesPerSecond: 30,
  });

  loop.wake();
  requestedFrames.shift()(0);

  active = false;
  loop.wake();
  requestedFrames.shift()(10);

  assert.deepEqual(drawnAt, [0]);
  assert.equal(requestedFrames.length, 1);

  requestedFrames.shift()(34);

  assert.deepEqual(drawnAt, [0, 34]);
  assert.equal(requestedFrames.length, 0);
});
