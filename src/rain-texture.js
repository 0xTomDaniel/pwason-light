import {
  effectiveAcousticFactor,
  normalizeAcousticFactors,
} from "./acoustic-factors.js";
import { calculateAcousticPropagation } from "./acoustic-propagation.js";
import { createRainBlockAccumulator } from "./rain-block-accumulator.js";
import { createRainImpact, createRainMark } from "./rain-impact.js";

const RAIN_IMPACT_VARIANTS = 192;
const DEFAULT_EAR_HEIGHT_METERS = 1.5;
const FILTER_Q = 0.38;
const GENERATED_EVENT_LEVEL = 3.2;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function eventRendering(event, factors, earHeightMeters) {
  const propagation = calculateAcousticPropagation(event.position, {
    earHeightMeters,
    distanceLoss: effectiveAcousticFactor(factors, "distanceLoss"),
    stereoSpread: effectiveAcousticFactor(factors, "stereoSpread"),
    airDamping: effectiveAcousticFactor(factors, "airDamping"),
  });
  const fullDensityCompensation = Math.min(
    1,
    Math.sqrt(12 / Math.max(12, finiteNumber(event.rateHz, 12))),
  );
  const densityCompensation = effectiveAcousticFactor(
    factors,
    "densityCompensation",
  );
  const densityNormalization = 1 - densityCompensation
    * (1 - fullDensityCompensation);
  const eventVariation = effectiveAcousticFactor(factors, "eventVariation");
  const amplitude = Math.max(0, finiteNumber(event.amplitude, 0.5));
  const eventLevel = GENERATED_EVENT_LEVEL
    * (1 + (amplitude - 0.5) * eventVariation);

  return {
    gain: eventLevel * densityNormalization * propagation.relativePressure,
    stereoPan: propagation.stereoPan,
    filter: Object.freeze({
      cutoffHz: propagation.airDampingCutoffHz,
      q: FILTER_Q,
    }),
  };
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

  function prepareArrival(arrival) {
    const id = Math.max(0, Math.floor(finiteNumber(arrival?.id, 0)));
    const variantIndex = (Math.imul(id, 2654435761) >>> 0) % variants.length;
    const variant = variants[variantIndex];
    const rendering = eventRendering(arrival ?? {}, factorSnapshot, listenerHeight);

    return Object.freeze({
      mark: variant.mark,
      response: variant.response,
      variantIndex,
      gain: rendering.gain,
      stereoPan: rendering.stereoPan,
      filter: rendering.filter,
    });
  }

  function exportResponseBank() {
    return Object.freeze(variants.map(variant => variant.response));
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

  return Object.freeze({ prepareArrival, renderProfile, exportResponseBank });
}
