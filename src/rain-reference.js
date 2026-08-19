import {
  analyzeRainField,
} from "./rain-diagnostics.js";

const MAX_ANALYSIS_SECONDS = 10;

const REDWOOD_GROUND_REFERENCE = Object.freeze({
  id: "redwood-ground",
  filename: "464334_1504845-hq.mp3",
  assetUrl: new URL(
    "../assets/reference/464334_1504845-hq.mp3",
    import.meta.url,
  ).href,
  title: "Redwood Shores · leaves & ground",
  shortTitle: "Redwood",
  intensity: "steady rainfall",
  surface: "earthen ground, fallen logs, and large plant leaves",
  sourceUrl: "https://freesound.org/s/464334/",
  creator: "Andron827",
  license: "CC0 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  playbackFormat: "Freesound high-quality MP3 preview",
  originalFormat: "44.1 kHz, 16-bit stereo WAV",
  evaluationMaximumFrequencyHz: 18_000,
  sha256: "ebf3ab59c140a5d44f939f3f871a58ed205377dcccb02fe6d0147d29535fcadb",
  detectedOnsetRateHz: 38.5,
  equivalentTotalRateHz: 1_000,
  prominenceFraction: 38.5 / 1_000,
  calibrationKind: "field-continuity-match",
});

export const AMAZON_RAIN_REFERENCE = Object.freeze({
  id: "amazon-forest",
  filename: "SMM00894_20230510_224500.wav",
  assetUrl: new URL(
    "../assets/reference/SMM00894_20230510_224500.wav",
    import.meta.url,
  ).href,
  title: "Amazon forest · light rainfall",
  shortTitle: "Amazon",
  intensity: "light rainfall",
  surface: "forest recording with recorder fixed to a tree",
  datasetDoi: "10.23708/I0QYNM",
  datasetUrl: "https://doi.org/10.23708/I0QYNM",
  articleUrl: "https://doi.org/10.1029/2024GL108210",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  md5: "8a2351b76dcb0145f24705596ab32665",
  playbackFormat: "48 kHz, 16-bit mono WAV",
  detectedOnsetRateHz: 15.8,
  equivalentTotalRateHz: null,
  prominenceFraction: null,
  calibrationKind: "detected-onsets-only",
});

export const FARNELL_RAIN_REFERENCE = Object.freeze({
  id: "farnell-procedural",
  filename: "designing-sound-rain.wav",
  assetUrl: new URL(
    "../assets/reference/designing-sound-rain.wav",
    import.meta.url,
  ).href,
  title: "Designing Sound · procedural rain",
  shortTitle: "Farnell",
  intensity: "moving procedural rain mixture",
  surface: "synthesized pulses and noise-band surfaces",
  sourceUrl: "https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical15.html",
  creator: "Andy Farnell",
  license: "Source terms not stated",
  licenseUrl: "https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical15.html",
  playbackFormat: "44.1 kHz, 16-bit stereo PCM WAV",
  sha256: "2c0a72cf7561aba40a8af4510d7372cdd605216307e5b28985905bb354fe20a1",
  analysisStartSeconds: 14,
  analysisDurationSeconds: 10,
  detectedOnsetRateHz: 43.4,
  equivalentTotalRateHz: null,
  prominenceFraction: null,
  calibrationKind: "detected-onsets-only",
});

export const RAIN_REFERENCE_PROFILES = Object.freeze([
  REDWOOD_GROUND_REFERENCE,
  AMAZON_RAIN_REFERENCE,
  FARNELL_RAIN_REFERENCE,
]);

export const DEFAULT_RAIN_REFERENCE_PROFILE = REDWOOD_GROUND_REFERENCE;

export function getRainReferenceProfile(profileId) {
  const profile = RAIN_REFERENCE_PROFILES.find(candidate => candidate.id === profileId);
  if (!profile) throw new RangeError(`Unknown Rain Reference Profile: ${profileId}`);
  return profile;
}

export function resolveReferenceCalibration(reference) {
  const detectedOnsetRateHz = Number(reference?.detectedOnsetRateHz);
  if (!Number.isFinite(detectedOnsetRateHz) || detectedOnsetRateHz <= 0) {
    throw new RangeError("Reference detected-onset rate must be positive.");
  }
  const candidateTotal = Number(reference?.equivalentTotalRateHz);
  const equivalentTotalRateHz = Number.isFinite(candidateTotal) && candidateTotal > 0
    ? candidateTotal
    : null;
  const isTotalCalibrated = equivalentTotalRateHz !== null;

  return Object.freeze({
    detectedOnsetRateHz,
    equivalentTotalRateHz,
    comparisonRateHz: equivalentTotalRateHz ?? detectedOnsetRateHz,
    prominenceFraction: isTotalCalibrated
      ? detectedOnsetRateHz / equivalentTotalRateHz
      : null,
    isTotalCalibrated,
  });
}

export function prepareRainReference(decodedAudio, {
  analysisStartSeconds = 0,
  analysisDurationSeconds = MAX_ANALYSIS_SECONDS,
} = {}) {
  const requestedStart = Number(analysisStartSeconds);
  const boundedStartSeconds = Number.isFinite(requestedStart)
    ? Math.max(0, requestedStart)
    : 0;
  const requestedDuration = Number(analysisDurationSeconds);
  const boundedDurationSeconds = Number.isFinite(requestedDuration)
    && requestedDuration > 0
    ? requestedDuration
    : MAX_ANALYSIS_SECONDS;
  const startSample = Math.max(0, Math.min(
    decodedAudio.length,
    Math.round(decodedAudio.sampleRate * boundedStartSeconds),
  ));
  const sampleCount = Math.min(
    decodedAudio.length - startSample,
    Math.round(decodedAudio.sampleRate * boundedDurationSeconds),
  );
  const monoSamples = new Float32Array(sampleCount);

  for (let channel = 0; channel < decodedAudio.numberOfChannels; channel += 1) {
    const channelSamples = decodedAudio.getChannelData(channel);
    for (let index = 0; index < sampleCount; index += 1) {
      monoSamples[index] += channelSamples[startSample + index]
        / decodedAudio.numberOfChannels;
    }
  }

  const analysisStart = startSample / decodedAudio.sampleRate;
  const analysisEnd = analysisStart + sampleCount / decodedAudio.sampleRate;
  const diagnostics = analyzeRainField(monoSamples, decodedAudio.sampleRate);
  const representativeField = Object.freeze({
    ...diagnostics.representativeField,
    startSeconds: analysisStart + diagnostics.representativeField.startSeconds,
    centerSeconds: analysisStart + diagnostics.representativeField.centerSeconds,
  });
  const impactMicroscopes = Object.freeze(diagnostics.impactMicroscopes.map(
    microscope => Object.freeze({
      ...microscope,
      startSeconds: analysisStart + microscope.startSeconds,
      onsetSeconds: analysisStart + microscope.onsetSeconds,
      peakSeconds: analysisStart + microscope.peakSeconds,
    }),
  ));
  return {
    samples: representativeField.samples,
    startSeconds: representativeField.startSeconds,
    analysisStartSeconds: analysisStart,
    analysisEndSeconds: analysisEnd,
    fieldWindowCenterSeconds: representativeField.centerSeconds,
    fieldWindowKind: "spectrally-representative",
    fieldWindowDistanceDb: representativeField.spectrumDistanceDb,
    analysis: representativeField.analysis,
    profileAnalysis: diagnostics.profileAnalysis,
    spectralDistribution: diagnostics.spectralDistribution,
    impactMicroscopes,
    prominentOnsets: diagnostics.prominentOnsets,
    rainDiagnostics: Object.freeze({
      ...diagnostics,
      representativeField,
      impactMicroscopes,
    }),
  };
}

export async function loadRainReference(reference, {
  fetcher = globalThis.fetch,
  decodeAudioData,
} = {}) {
  if (typeof fetcher !== "function" || typeof decodeAudioData !== "function") {
    throw new TypeError("Rain Reference loading requires fetch and audio decoding.");
  }

  const response = await fetcher(reference.assetUrl);
  if (!response.ok) {
    throw new Error(`Rain Reference download failed (${response.status ?? "unknown"}).`);
  }

  const decodedAudio = await decodeAudioData(await response.arrayBuffer());
  return {
    reference,
    decodedAudio,
    ...prepareRainReference(decodedAudio, reference),
  };
}
