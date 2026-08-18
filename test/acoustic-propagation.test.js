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
