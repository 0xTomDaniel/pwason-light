import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateReferenceTimeStretch,
  enablePitchPreservation,
  resolveReferencePlaybackWindow,
} from "../src/reference-playback.js";

test("Reference Playback honors a profile-declared source interval", () => {
  assert.deepEqual(resolveReferencePlaybackWindow({
    analysisStartSeconds: 14,
    analysisDurationSeconds: 10,
  }), {
    startSeconds: 14,
    endSeconds: 24,
    isBounded: true,
  });
  assert.deepEqual(resolveReferencePlaybackWindow({}), {
    startSeconds: 0,
    endSeconds: null,
    isBounded: false,
  });
});

test("Reference Playback follows Speed relative to its explicit comparison rate", () => {
  assert.deepEqual(calculateReferenceTimeStretch(120, 120), {
    requestedRate: 1,
    playbackRate: 1,
    limited: false,
  });
  assert.deepEqual(calculateReferenceTimeStretch(90, 120), {
    requestedRate: 0.75,
    playbackRate: 0.75,
    limited: false,
  });
  assert.deepEqual(calculateReferenceTimeStretch(240, 120), {
    requestedRate: 2,
    playbackRate: 2,
    limited: false,
  });
});

test("Reference Playback avoids the observed low-speed distortion range", () => {
  assert.deepEqual(calculateReferenceTimeStretch(1, 80), {
    requestedRate: 0.0125,
    playbackRate: 0.75,
    limited: true,
  });
  assert.deepEqual(calculateReferenceTimeStretch(1000, 80), {
    requestedRate: 12.5,
    playbackRate: 4,
    limited: true,
  });
});

test("Reference Playback explicitly enables pitch preservation", () => {
  const media = {
    preservesPitch: false,
    mozPreservesPitch: false,
    webkitPreservesPitch: false,
  };

  enablePitchPreservation(media);

  assert.equal(media.preservesPitch, true);
  assert.equal(media.mozPreservesPitch, true);
  assert.equal(media.webkitPreservesPitch, true);
});
