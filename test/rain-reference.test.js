import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AMAZON_RAIN_REFERENCE,
  RAIN_REFERENCE_PROFILES,
  getRainReferenceProfile,
  loadRainReference,
  prepareRainReference,
  resolveReferenceCalibration,
} from "../src/rain-reference.js";

test("the bundled Rain Reference is the cited Amazon light-rain research recording", async () => {
  const recording = await readFile(new URL(AMAZON_RAIN_REFERENCE.assetUrl));

  assert.equal(AMAZON_RAIN_REFERENCE.datasetDoi, "10.23708/I0QYNM");
  assert.equal(AMAZON_RAIN_REFERENCE.license, "CC BY 4.0");
  assert.equal(AMAZON_RAIN_REFERENCE.intensity, "light rainfall");
  assert.equal(recording.byteLength, 5_761_144);
  assert.equal(
    createHash("md5").update(recording).digest("hex"),
    "8a2351b76dcb0145f24705596ab32665",
  );
});

test("the Reference Library keeps Amazon and adds the CC0 leaf-and-ground recording", async () => {
  assert.deepEqual(
    RAIN_REFERENCE_PROFILES.map(reference => reference.id),
    ["redwood-ground", "amazon-forest"],
  );

  const clean = getRainReferenceProfile("redwood-ground");
  const recording = await readFile(new URL(clean.assetUrl));

  assert.equal(clean.license, "CC0 1.0");
  assert.equal(clean.sourceUrl, "https://freesound.org/s/464334/");
  assert.equal(clean.playbackFormat, "Freesound high-quality MP3 preview");
  assert.equal(
    createHash("sha256").update(recording).digest("hex"),
    clean.sha256,
  );
});

test("Reference Profiles separate detected onsets from equivalent total Arrivals", () => {
  const redwood = getRainReferenceProfile("redwood-ground");
  const amazon = getRainReferenceProfile("amazon-forest");

  assert.equal(redwood.detectedOnsetRateHz, 23.1);
  assert.equal(redwood.equivalentTotalRateHz, 120);
  assert.ok(Math.abs(redwood.prominenceFraction - 0.1925) < 0.000001);
  assert.equal(redwood.calibrationKind, "operator-tempo-match");

  assert.equal(amazon.detectedOnsetRateHz, 15.8);
  assert.equal(amazon.equivalentTotalRateHz, null);
  assert.equal(amazon.prominenceFraction, null);
  assert.equal(amazon.calibrationKind, "detected-onsets-only");
});

test("Reference calibration chooses an explicit generation and playback basis", () => {
  assert.deepEqual(resolveReferenceCalibration(getRainReferenceProfile("redwood-ground")), {
    detectedOnsetRateHz: 23.1,
    equivalentTotalRateHz: 120,
    comparisonRateHz: 120,
    prominenceFraction: 0.1925,
    isTotalCalibrated: true,
  });
  assert.deepEqual(resolveReferenceCalibration(getRainReferenceProfile("amazon-forest")), {
    detectedOnsetRateHz: 15.8,
    equivalentTotalRateHz: null,
    comparisonRateHz: 15.8,
    prominenceFraction: null,
    isTotalCalibrated: false,
  });
});

test("unknown Reference Profile ids are rejected", () => {
  assert.throws(
    () => getRainReferenceProfile("storm-drain"),
    /Unknown Rain Reference Profile/,
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
  assert.equal(prepared.profileAnalysis.durationSeconds, 1);
  assert.equal(prepared.profileAnalysis.spectrogram.length, 0);
  assert.equal(prepared.prominentOnsets.count, 1);
  assert.equal(prepared.prominentOnsets.rateHz, 1);
});

test("the Rain Reference loader fetches and prepares a selected profile", async () => {
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

  const loaded = await loadRainReference(AMAZON_RAIN_REFERENCE, {
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

  assert.deepEqual(requestedUrls, [AMAZON_RAIN_REFERENCE.assetUrl]);
  assert.equal(loaded.reference, AMAZON_RAIN_REFERENCE);
  assert.equal(loaded.decodedAudio, decodedAudio);
  assert.equal(loaded.peakSeconds, 0.25);
});
