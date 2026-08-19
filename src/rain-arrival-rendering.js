import {
  effectiveAcousticFactor,
  normalizeAcousticFactors,
} from "./acoustic-factors.js";
import { calculateAcousticPropagation } from "./acoustic-propagation.js";

const DEFAULT_EAR_HEIGHT_METERS = 1.5;
const DEFAULT_RESPONSE_COUNT = 192;
const FILTER_Q = 0.38;
const GENERATED_EVENT_LEVEL = 3.2;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function createRainArrivalRendering({
  factors,
  earHeightMeters = DEFAULT_EAR_HEIGHT_METERS,
  responseCount = DEFAULT_RESPONSE_COUNT,
} = {}) {
  const factorSnapshot = normalizeAcousticFactors(factors);
  const listenerHeight = Math.max(
    0.01,
    finiteNumber(earHeightMeters, DEFAULT_EAR_HEIGHT_METERS),
  );
  const variants = Math.max(
    1,
    Math.floor(finiteNumber(responseCount, DEFAULT_RESPONSE_COUNT)),
  );

  function prepareArrival(arrival = {}) {
    const id = Math.max(0, Math.floor(finiteNumber(arrival.id, 0)));
    const propagation = calculateAcousticPropagation(arrival.position, {
      earHeightMeters: listenerHeight,
      distanceLoss: effectiveAcousticFactor(factorSnapshot, "distanceLoss"),
      stereoSpread: effectiveAcousticFactor(factorSnapshot, "stereoSpread"),
      airDamping: effectiveAcousticFactor(factorSnapshot, "airDamping"),
    });
    const fullDensityCompensation = Math.min(
      1,
      Math.sqrt(12 / Math.max(12, finiteNumber(arrival.rateHz, 12))),
    );
    const densityCompensation = effectiveAcousticFactor(
      factorSnapshot,
      "densityCompensation",
    );
    const densityNormalization = 1 - densityCompensation
      * (1 - fullDensityCompensation);
    const eventVariation = effectiveAcousticFactor(factorSnapshot, "eventVariation");
    const amplitude = Math.max(0, finiteNumber(arrival.amplitude, 0.5));
    const gain = GENERATED_EVENT_LEVEL
      * (1 + (amplitude - 0.5) * eventVariation * 2)
      * densityNormalization
      * propagation.relativePressure;

    return Object.freeze({
      variantIndex: (Math.imul(id, 2654435761) >>> 0) % variants,
      gain,
      stereoPan: propagation.stereoPan,
      filter: Object.freeze({
        cutoffHz: propagation.airDampingCutoffHz,
        q: FILTER_Q,
      }),
    });
  }

  return Object.freeze({ prepareArrival });
}
