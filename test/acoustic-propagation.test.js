import assert from "node:assert/strict";
import test from "node:test";

import { calculateAcousticPropagation } from "../src/acoustic-propagation.js";

test("Acoustic Propagation turns Impact Position into distance loss and stereo direction", () => {
  const propagation = calculateAcousticPropagation(
    { radialDistanceMeters: 4, azimuthRadians: Math.PI / 2 },
    { earHeightMeters: 3 },
  );

  assert.equal(propagation.sourceDistanceMeters, 5);
  assert.equal(propagation.relativePressure, 0.6);
  assert.equal(propagation.stereoPan, 1);
});

test("Acoustic Propagation fills the stereo field evenly between center and each speaker", () => {
  const positions = [
    { azimuthRadians: -Math.PI / 2, expectedPan: -1 },
    { azimuthRadians: -Math.PI / 4, expectedPan: -0.5 },
    { azimuthRadians: 0, expectedPan: 0 },
    { azimuthRadians: Math.PI / 4, expectedPan: 0.5 },
    { azimuthRadians: Math.PI / 2, expectedPan: 1 },
  ];

  for (const { azimuthRadians, expectedPan } of positions) {
    const propagation = calculateAcousticPropagation({
      radialDistanceMeters: 4,
      azimuthRadians,
    });

    assert.ok(Math.abs(propagation.stereoPan - expectedPan) < 0.000001);
  }
});

test("Acoustic Propagation exposes independent distance, spread, and air-damping factors", () => {
  const position = { radialDistanceMeters: 12, azimuthRadians: Math.PI / 2 };
  const dry = calculateAcousticPropagation(position, {
    distanceLoss: 0,
    stereoSpread: 0,
    airDamping: 0,
  });
  const distant = calculateAcousticPropagation(position, {
    distanceLoss: 1,
    stereoSpread: 0.5,
    airDamping: 1,
  });

  assert.equal(dry.relativePressure, 1);
  assert.equal(dry.stereoPan, 0);
  assert.equal(dry.airDampingCutoffHz, 20_000);
  assert.ok(distant.relativePressure < 1);
  assert.equal(distant.stereoPan, 0.5);
  assert.ok(distant.airDampingCutoffHz < 20_000);
  assert.ok(distant.airDampingCutoffHz >= 2_500);
});
