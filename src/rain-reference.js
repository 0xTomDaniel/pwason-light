import {
  analyzeSignal,
  detectProminentOnsets,
  extractProminentImpact,
} from "./signal-analysis.js";

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
  sha256: "ebf3ab59c140a5d44f939f3f871a58ed205377dcccb02fe6d0147d29535fcadb",
  detectedOnsetRateHz: 23.1,
  equivalentTotalRateHz: 120,
  prominenceFraction: 23.1 / 120,
  calibrationKind: "operator-tempo-match",
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

export const RAIN_REFERENCE_PROFILES = Object.freeze([
  REDWOOD_GROUND_REFERENCE,
  AMAZON_RAIN_REFERENCE,
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

export function prepareRainReference(decodedAudio) {
  const sampleCount = Math.min(
    decodedAudio.length,
    Math.round(decodedAudio.sampleRate * MAX_ANALYSIS_SECONDS),
  );
  const monoSamples = new Float32Array(sampleCount);

  for (let channel = 0; channel < decodedAudio.numberOfChannels; channel += 1) {
    const channelSamples = decodedAudio.getChannelData(channel);
    for (let index = 0; index < sampleCount; index += 1) {
      monoSamples[index] += channelSamples[index] / decodedAudio.numberOfChannels;
    }
  }

  const impact = extractProminentImpact(monoSamples, decodedAudio.sampleRate);
  return {
    ...impact,
    analysis: analyzeSignal(impact.samples, decodedAudio.sampleRate),
    profileAnalysis: analyzeSignal(monoSamples, decodedAudio.sampleRate, {
      includeSpectrogram: false,
    }),
    prominentOnsets: detectProminentOnsets(monoSamples, decodedAudio.sampleRate),
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
    ...prepareRainReference(decodedAudio),
  };
}
