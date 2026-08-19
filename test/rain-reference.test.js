import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AMAZON_RAIN_REFERENCE,
  FARNELL_RAIN_REFERENCE,
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

test("the Reference Library includes the two recordings and Farnell procedural rain", async () => {
  assert.deepEqual(
    RAIN_REFERENCE_PROFILES.map(reference => reference.id),
    ["redwood-ground", "amazon-forest", "farnell-procedural"],
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

  const procedural = await readFile(new URL(FARNELL_RAIN_REFERENCE.assetUrl));
  assert.equal(FARNELL_RAIN_REFERENCE.creator, "Andy Farnell");
  assert.equal(FARNELL_RAIN_REFERENCE.analysisStartSeconds, 14);
  assert.equal(FARNELL_RAIN_REFERENCE.analysisDurationSeconds, 10);
  assert.equal(FARNELL_RAIN_REFERENCE.fieldWindowCenterSeconds, undefined);
  assert.equal(
    createHash("sha256").update(procedural).digest("hex"),
    "2c0a72cf7561aba40a8af4510d7372cdd605216307e5b28985905bb354fe20a1",
  );
});

test("Reference Profiles separate detected onsets from equivalent total Arrivals", () => {
  const redwood = getRainReferenceProfile("redwood-ground");
  const amazon = getRainReferenceProfile("amazon-forest");

  assert.equal(redwood.detectedOnsetRateHz, 38.5);
  assert.equal(redwood.equivalentTotalRateHz, 1000);
  assert.ok(Math.abs(redwood.prominenceFraction - 0.0385) < 0.000001);
  assert.equal(redwood.calibrationKind, "field-continuity-match");

  assert.equal(amazon.detectedOnsetRateHz, 15.8);
  assert.equal(amazon.equivalentTotalRateHz, null);
  assert.equal(amazon.prominenceFraction, null);
  assert.equal(amazon.calibrationKind, "detected-onsets-only");
});

test("Reference calibration chooses an explicit generation and playback basis", () => {
  assert.deepEqual(resolveReferenceCalibration(getRainReferenceProfile("redwood-ground")), {
    detectedOnsetRateHz: 38.5,
    equivalentTotalRateHz: 1000,
    comparisonRateHz: 1000,
    prominenceFraction: 0.0385,
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

test("Rain Reference preparation returns one representative Field and one aligned Impact Microscope", () => {
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

  assert.equal(prepared.samples.length, sampleRate);
  assert.equal(prepared.fieldWindowKind, "spectrally-representative");
  assert.equal(prepared.fieldWindowCenterSeconds, 0.5);
  assert.equal(prepared.impactMicroscope.samples.length, 5_760);
  assert.ok(Math.abs(prepared.impactMicroscope.peakSeconds - 0.5) < 0.01);
  assert.equal(prepared.analysis.sampleRate, sampleRate);
  assert.equal(prepared.profileAnalysis.durationSeconds, 1);
  assert.equal(prepared.profileAnalysis.spectrogram.length, 0);
  assert.equal(prepared.prominentOnsets.count, 1);
  assert.equal(prepared.prominentOnsets.rateHz, 1);
});

test("Rain Reference preparation selects within its declared analysis interval", () => {
  const sampleRate = 48_000;
  const samples = new Float32Array(sampleRate * 2);
  samples[Math.round(0.74 * sampleRate)] = 0.6;
  samples[Math.round(1.75 * sampleRate)] = 1;

  const prepared = prepareRainReference({
    length: samples.length,
    numberOfChannels: 1,
    sampleRate,
    getChannelData: () => samples,
  }, {
    analysisStartSeconds: 0.5,
    analysisDurationSeconds: 1,
  });

  assert.equal(prepared.profileAnalysis.durationSeconds, 1);
  assert.equal(prepared.analysisStartSeconds, 0.5);
  assert.equal(prepared.analysisEndSeconds, 1.5);
  assert.equal(prepared.fieldWindowCenterSeconds, 1);
  assert.equal(prepared.fieldWindowKind, "spectrally-representative");
  assert.equal(prepared.samples.length, sampleRate);
  assert.ok(prepared.samples.some(sample => Math.abs(sample - 0.6) < 0.000001));
  assert.ok(!prepared.samples.some(sample => Math.abs(sample - 1) < 0.000001));
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
  assert.ok(Math.abs(loaded.impactMicroscope.peakSeconds - 0.25) < 0.01);
});
