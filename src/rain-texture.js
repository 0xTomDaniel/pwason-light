import {
  effectiveAcousticFactor,
  normalizeAcousticFactors,
} from "./acoustic-factors.js";
import { calculateAcousticPropagation } from "./acoustic-propagation.js";
import { createRainImpact } from "./rain-impact.js";

const RAIN_IMPACT_VARIANTS = 128;
const DEFAULT_EAR_HEIGHT_METERS = 1.5;
const FILTER_Q = 0.38;

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
  const eventLevel = 0.26 * (1 + (amplitude - 0.5) * eventVariation);

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
} = {}) {
  const rate = Math.max(8_000, finiteNumber(sampleRate, 48_000));
  const listenerHeight = Math.max(
    0.01,
    finiteNumber(earHeightMeters, DEFAULT_EAR_HEIGHT_METERS),
  );
  const factorSnapshot = normalizeAcousticFactors(factors);
  const variants = Array.from(
    { length: RAIN_IMPACT_VARIANTS },
    (_, index) => createRainImpact({
      sampleRate: rate,
      seed: index + 1,
      factors: factorSnapshot,
    }),
  );

  function prepareArrival(arrival) {
    const id = Math.max(0, Math.floor(finiteNumber(arrival?.id, 0)));
    const response = variants[
      (Math.imul(id, 2654435761) >>> 0) % variants.length
    ];
    const rendering = eventRendering(arrival ?? {}, factorSnapshot, listenerHeight);

    return Object.freeze({
      response,
      gain: rendering.gain,
      stereoPan: rendering.stereoPan,
      filter: rendering.filter,
    });
  }

  function renderProfile({ durationSeconds = 8, nextArrival } = {}) {
    if (typeof nextArrival !== "function") {
      throw new TypeError("Generated Rain Renderer requires a nextArrival function.");
    }
    const duration = Math.max(0.1, finiteNumber(durationSeconds, 8));
    const samples = new Float32Array(Math.round(rate * duration));

    for (
      let arrival = nextArrival();
      arrival?.at < duration;
      arrival = nextArrival()
    ) {
      const plan = prepareArrival(arrival);
      const start = Math.round(arrival.at * rate);
      const cutoffHz = Math.min(plan.filter.cutoffHz, rate * 0.45);
      const coefficient = 1 - Math.exp(-2 * Math.PI * cutoffHz / rate);
      let filterA = 0;
      let filterB = 0;

      for (
        let index = 0;
        index < plan.response.length && start + index < samples.length;
        index += 1
      ) {
        filterA += coefficient * (plan.response[index] - filterA);
        filterB += coefficient * (filterA - filterB);
        samples[start + index] += filterB * plan.gain;
      }
    }

    return samples;
  }

  return Object.freeze({ prepareArrival, renderProfile });
}
