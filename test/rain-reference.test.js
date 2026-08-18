import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BUNDLED_RAIN_REFERENCE,
  loadBundledRainReference,
  prepareRainReference,
} from "../src/rain-reference.js";

test("the bundled Rain Reference is the cited Amazon light-rain research recording", async () => {
  const recording = await readFile(new URL(BUNDLED_RAIN_REFERENCE.assetUrl));

  assert.equal(BUNDLED_RAIN_REFERENCE.datasetDoi, "10.23708/I0QYNM");
  assert.equal(BUNDLED_RAIN_REFERENCE.license, "CC BY 4.0");
  assert.equal(BUNDLED_RAIN_REFERENCE.intensity, "light rainfall");
  assert.equal(recording.byteLength, 5_761_144);
  assert.equal(
    createHash("md5").update(recording).digest("hex"),
    "8a2351b76dcb0145f24705596ab32665",
  );
});

test("Rain Reference preparation downmixes browser audio and isolates one impact", () => {
  const sampleRate = 48_000;
  const left = new Float32Array(sampleRate);
  const right = new Float32Array(sampleRate);
  left[24_000] = -0.8;
  right[24_000] = -0.4;

  const prepared = prepareRainReference({
    length: sampleRate,
    numberOfChannels: 2,
    sampleRate,
    getChannelData: channel => [left, right][channel],
  });

  assert.equal(prepared.samples.length, 5_760);
  assert.equal(prepared.peakSeconds, 0.5);
  assert.ok(Math.abs(prepared.samples[240] + 0.6) < 0.000001);
  assert.equal(prepared.analysis.sampleRate, sampleRate);
});

test("the default Rain Reference loader fetches and prepares the bundled recording", async () => {
  const requestedUrls = [];
  const sampleRate = 48_000;
  const samples = new Float32Array(sampleRate);
  samples[12_000] = 0.75;
  const decodedAudio = {
    length: samples.length,
    numberOfChannels: 1,
    sampleRate,
    getChannelData: () => samples,
  };

  const loaded = await loadBundledRainReference({
    fetcher: async url => {
      requestedUrls.push(url);
      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([82, 73, 70, 70]).buffer,
      };
    },
    decodeAudioData: async bytes => {
      assert.equal(bytes.byteLength, 4);
      return decodedAudio;
    },
  });

  assert.deepEqual(requestedUrls, [BUNDLED_RAIN_REFERENCE.assetUrl]);
  assert.equal(loaded.reference, BUNDLED_RAIN_REFERENCE);
  assert.equal(loaded.decodedAudio, decodedAudio);
  assert.equal(loaded.peakSeconds, 0.25);
});
