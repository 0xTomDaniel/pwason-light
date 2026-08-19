import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareMicroscopeScaling,
} from "../src/microscope-scaling.js";

const SOURCES = Object.freeze([
  Object.freeze({
    id: "generated",
    profileRms: 2,
    microscopes: Object.freeze([
      Object.freeze({
        samples: Float32Array.from([0, 2, -4]),
        analysis: Object.freeze({ spectrogram: Object.freeze([
          Float64Array.from([1, 16]),
        ]) }),
      }),
      Object.freeze({
        samples: Float32Array.from([0, 1, -2]),
        analysis: Object.freeze({ spectrogram: Object.freeze([
          Float64Array.from([0.25, 4]),
        ]) }),
      }),
    ]),
  }),
  Object.freeze({
    id: "reference",
    profileRms: 1,
    microscopes: Object.freeze([
      Object.freeze({
        samples: Float32Array.from([0, 1, -1]),
        analysis: Object.freeze({ spectrogram: Object.freeze([
          Float64Array.from([1, 4]),
        ]) }),
      }),
    ]),
  }),
]);

test("Shape Microscope Scaling preserves independent panel normalization", () => {
  const scaling = prepareMicroscopeScaling(SOURCES, { mode: "shape" });

  assert.equal(scaling.mode, "shape");
  assert.equal(scaling.sharedSpectrogramPeakPower, null);
  assert.deepEqual(scaling.bySource.generated, {
    waveformGain: null,
    spectrogramPowerGain: 1,
  });
  assert.deepEqual(scaling.bySource.reference, {
    waveformGain: null,
    spectrogramPowerGain: 1,
  });
});

test("Profile-matched Microscope Scaling uses one source gain and shared references", () => {
  const scaling = prepareMicroscopeScaling(SOURCES, {
    mode: "profile-matched",
    waveformTargetPeak: 0.84,
  });

  assert.equal(scaling.mode, "profile-matched");
  assert.deepEqual(scaling.bySource.generated, {
    waveformGain: 0.21,
    spectrogramPowerGain: 0.25,
  });
  assert.deepEqual(scaling.bySource.reference, {
    waveformGain: 0.42,
    spectrogramPowerGain: 1,
  });
  assert.equal(scaling.sharedSpectrogramPeakPower, 4);
});

test("Microscope Scaling rejects an unknown display mode", () => {
  assert.throws(
    () => prepareMicroscopeScaling(SOURCES, { mode: "raw" }),
    /Unknown Microscope Scaling mode: raw/,
  );
});
