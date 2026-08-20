import assert from "node:assert/strict";
import test from "node:test";

import { currentToDisplayLevel } from "../src/led-display-transfer.js";

test("LED Display Transfer maps linear current through the inverse screen transfer", () => {
  assert.equal(currentToDisplayLevel(0), 0);
  assert.equal(currentToDisplayLevel(1), 1);
  assert.ok(Math.abs(currentToDisplayLevel(0.5) ** 2.2 - 0.5) < 1e-12);
});

test("LED Display Transfer bounds invalid current without changing current semantics", () => {
  assert.equal(currentToDisplayLevel(-1), 0);
  assert.equal(currentToDisplayLevel(2), 1);
  assert.equal(currentToDisplayLevel(Number.NaN), 0);
});
