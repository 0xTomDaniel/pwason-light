import assert from "node:assert/strict";
import test from "node:test";

import {
  ACOUSTIC_FACTOR_DEFINITIONS,
  createDefaultAcousticFactors,
  effectiveAcousticFactor,
  normalizeAcousticFactors,
} from "../src/acoustic-factors.js";

test("every Acoustic Factor has one switch state and one bounded continuous amount", () => {
  const defaults = createDefaultAcousticFactors();

  assert.equal(ACOUSTIC_FACTOR_DEFINITIONS.length, 23);
  assert.equal(Object.keys(defaults).length, ACOUSTIC_FACTOR_DEFINITIONS.length);
  for (const definition of ACOUSTIC_FACTOR_DEFINITIONS) {
    assert.equal(typeof defaults[definition.id].enabled, "boolean");
    assert.ok(defaults[definition.id].amount >= 0);
    assert.ok(defaults[definition.id].amount <= 1);
  }
});

test("Acoustic Factor input is copied, completed, clamped, and bypassed when off", () => {
  const normalized = normalizeAcousticFactors({
    impactBody: { enabled: false, amount: 4 },
    stereoSpread: { enabled: true, amount: -2 },
  });

  assert.deepEqual(normalized.impactBody, { enabled: false, amount: 1 });
  assert.deepEqual(normalized.stereoSpread, { enabled: true, amount: 0 });
  assert.equal(typeof normalized.highTexture.enabled, "boolean");
  assert.equal(effectiveAcousticFactor(normalized, "impactBody"), 0);
  assert.equal(effectiveAcousticFactor(normalized, "stereoSpread"), 0);
});

test("the synthesis baseline preserves the rain-like listening checkpoint", () => {
  const defaults = createDefaultAcousticFactors();

  assert.deepEqual(defaults.distanceLoss, { enabled: true, amount: 0.7 });
  assert.deepEqual(defaults.midTexture, { enabled: true, amount: 0.2 });
  assert.deepEqual(defaults.airDamping, { enabled: true, amount: 0.6 });
  assert.deepEqual(defaults.compression, { enabled: false, amount: 0.45 });
});

test("the default preset favors soft leaf and ground splats over hard impacts", () => {
  const defaults = createDefaultAcousticFactors();

  assert.deepEqual(defaults.impactBody, { enabled: true, amount: 0.18 });
  assert.deepEqual(defaults.impactSoftness, { enabled: true, amount: 0.9 });
  assert.deepEqual(defaults.highTexture, { enabled: true, amount: 0.32 });
  assert.deepEqual(defaults.spectralSparsity, { enabled: true, amount: 0.78 });
  assert.deepEqual(defaults.wetMicrotexture, { enabled: true, amount: 0.35 });
  assert.deepEqual(defaults.microSplashes, { enabled: false, amount: 0.2 });
  assert.deepEqual(defaults.woodSurface, { enabled: false, amount: 0.2 });
});
