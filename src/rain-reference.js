import { analyzeSignal, extractProminentImpact } from "./signal-analysis.js";

const MAX_ANALYSIS_SECONDS = 10;

export const BUNDLED_RAIN_REFERENCE = Object.freeze({
  filename: "SMM00894_20230510_224500.wav",
  assetUrl: new URL(
    "../assets/reference/SMM00894_20230510_224500.wav",
    import.meta.url,
  ).href,
  title: "Amazon forest · light rainfall",
  intensity: "light rainfall",
  datasetDoi: "10.23708/I0QYNM",
  datasetUrl: "https://doi.org/10.23708/I0QYNM",
  articleUrl: "https://doi.org/10.1029/2024GL108210",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  md5: "8a2351b76dcb0145f24705596ab32665",
});

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
  };
}

export async function loadBundledRainReference({
  fetcher = globalThis.fetch,
  decodeAudioData,
} = {}) {
  if (typeof fetcher !== "function" || typeof decodeAudioData !== "function") {
    throw new TypeError("Rain Reference loading requires fetch and audio decoding.");
  }

  const response = await fetcher(BUNDLED_RAIN_REFERENCE.assetUrl);
  if (!response.ok) {
    throw new Error(`Rain Reference download failed (${response.status ?? "unknown"}).`);
  }

  const decodedAudio = await decodeAudioData(await response.arrayBuffer());
  return {
    reference: BUNDLED_RAIN_REFERENCE,
    decodedAudio,
    ...prepareRainReference(decodedAudio),
  };
}
