import { normalizeAcousticFactors } from "./acoustic-factors.js";
import { createRainBlockAccumulator } from "./rain-block-accumulator.js";
import { createRainDenseSignatures } from "./rain-dense-accumulator.js";
import { createRainArrivalRendering } from "./rain-arrival-rendering.js";
import { createRainImpact, createRainMark } from "./rain-impact.js";

const RAIN_IMPACT_VARIANTS = 192;
const DEFAULT_EAR_HEIGHT_METERS = 1.5;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function createGeneratedRainRenderer({
  sampleRate = 48_000,
  factors,
  earHeightMeters = DEFAULT_EAR_HEIGHT_METERS,
  dropPopulation = 0.5,
} = {}) {
  const rate = Math.max(8_000, finiteNumber(sampleRate, 48_000));
  const listenerHeight = Math.max(
    0.01,
    finiteNumber(earHeightMeters, DEFAULT_EAR_HEIGHT_METERS),
  );
  const factorSnapshot = normalizeAcousticFactors(factors);
  const arrivalRendering = createRainArrivalRendering({
    factors: factorSnapshot,
    earHeightMeters: listenerHeight,
    responseCount: RAIN_IMPACT_VARIANTS,
  });
  const population = Math.max(0, Math.min(1, finiteNumber(dropPopulation, 0.5)));
  const variants = Array.from(
    { length: RAIN_IMPACT_VARIANTS },
    (_, index) => {
      const seed = index + 1;
      const mark = createRainMark({
        seed,
        dropPopulation: population,
        factors: factorSnapshot,
      });
      return Object.freeze({
        mark,
        response: createRainImpact({
          sampleRate: rate,
          seed,
          factors: factorSnapshot,
          dropPopulation: population,
          mark,
        }),
      });
    },
  );
  const denseSignatures = createRainDenseSignatures(
    variants.map(variant => variant.response),
    { sampleRate: rate },
  );

  function prepareArrival(arrival) {
    const id = Math.max(0, Math.floor(finiteNumber(arrival?.id, 0)));
    const rendering = arrivalRendering.prepareArrival({ ...arrival, id });
    const variant = variants[rendering.variantIndex];

    return Object.freeze({
      mark: variant.mark,
      response: variant.response,
      variantIndex: rendering.variantIndex,
      gain: rendering.gain,
      stereoPan: rendering.stereoPan,
      filter: rendering.filter,
    });
  }

  function exportResponseBank() {
    return Object.freeze(variants.map(variant => variant.response));
  }

  function exportDenseShotBank() {
    return denseSignatures;
  }

  function renderProfile({
    durationSeconds = 8,
    nextArrival,
    blockSize = 128,
  } = {}) {
    if (typeof nextArrival !== "function") {
      throw new TypeError("Generated Rain Renderer requires a nextArrival function.");
    }
    const duration = Math.max(0.1, finiteNumber(durationSeconds, 8));
    const samples = new Float32Array(Math.round(rate * duration));
    const accumulator = createRainBlockAccumulator({ sampleRate: rate });

    for (
      let arrival = nextArrival();
      arrival?.at < duration;
      arrival = nextArrival()
    ) {
      accumulator.schedule(Math.round(arrival.at * rate), prepareArrival(arrival));
    }

    const partition = Math.max(1, Math.round(finiteNumber(blockSize, 128)));
    for (let offset = 0; offset < samples.length; offset += partition) {
      const length = Math.min(partition, samples.length - offset);
      samples.set(accumulator.render(length)[0], offset);
    }

    return samples;
  }

  return Object.freeze({
    prepareArrival,
    renderProfile,
    exportResponseBank,
    exportDenseShotBank,
  });
}
