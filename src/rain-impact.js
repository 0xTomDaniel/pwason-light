import {
  effectiveAcousticFactor,
  normalizeAcousticFactors,
} from "./acoustic-factors.js";

const DURATION_SECONDS = 0.12;

function createRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function interpolate(from, to, amount) {
  return from + (to - from) * amount;
}

function filterCoefficient(cutoffHz, sampleRate) {
  return 1 - Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
}

function responseEnvelope(time, delay, attack, decay) {
  const elapsed = time - delay;
  if (elapsed <= 0) return 0;
  return (1 - Math.exp(-elapsed / attack)) * Math.exp(-elapsed / decay);
}

export function createRainImpact({ sampleRate, seed, factors }) {
  const rate = Math.max(8_000, Number(sampleRate) || 48_000);
  const settings = normalizeAcousticFactors(factors);
  const amount = id => effectiveAcousticFactor(settings, id);
  const sampleCount = Math.round(rate * DURATION_SECONDS);
  const samples = new Float32Array(sampleCount);
  const random = createRandom(seed);

  const impactStrength = amount("impactBody");
  const impactWidth = interpolate(0.00055, 0.0021, amount("impactSoftness"));
  const impactCenter = impactWidth * 2.6;
  const tailAmount = amount("tailLength");
  const variation = amount("eventVariation");
  const independence = amount("bandIndependence");
  const sharedWeight = Math.sqrt(Math.max(0, 1 - independence));
  const independentWeight = Math.sqrt(independence);
  const morphology = (random() * 2 - 1) * variation;
  const onsetJitter = random() * 0.0012 * variation;

  const lowGain = amount("lowTexture") * 0.54 * (1 + morphology * 0.18);
  const midGain = amount("midTexture") * 0.63 * (1 - morphology * 0.12);
  const highGain = amount("highTexture") * 0.44 * (1 + morphology * 0.22);
  const lowDecay = interpolate(0.022, 0.085, tailAmount) * (1 + morphology * 0.16);
  const midDecay = interpolate(0.018, 0.067, tailAmount) * (1 - morphology * 0.1);
  const highDecay = interpolate(0.012, 0.044, tailAmount) * (1 + morphology * 0.12);

  const lowCoefficient = filterCoefficient(1_500, rate);
  const midLowCoefficient = filterCoefficient(850, rate);
  const midHighCoefficient = filterCoefficient(7_600, rate);
  const highLowCoefficient = filterCoefficient(6_200, rate);
  const highCeilingCoefficient = filterCoefficient(17_000, rate);
  let lowA = 0;
  let lowB = 0;
  let midFloor = 0;
  let midCeilingA = 0;
  let midCeilingB = 0;
  let highFloor = 0;
  let highCeiling = 0;

  const splashAmount = amount("microSplashes");
  const splashDelay = amount("microSplashDelay");
  const splashes = [];
  for (let index = 0; index < 4; index += 1) {
    if (random() > splashAmount) continue;
    splashes.push({
      delay: interpolate(0.012, 0.058, splashDelay) * (0.55 + random() * 0.9),
      decay: 0.005 + random() * 0.012,
      strength: splashAmount * (0.035 + random() * 0.075),
    });
  }

  let splashFilter = 0;
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / rate;
    const distance = (time - impactCenter) / impactWidth;
    const pressurePulse = impactStrength
      * (1 - distance * distance)
      * Math.exp(-0.5 * distance * distance);

    const sharedNoise = random() * 2 - 1;
    const lowNoise = sharedNoise * sharedWeight + (random() * 2 - 1) * independentWeight;
    const midNoise = sharedNoise * sharedWeight + (random() * 2 - 1) * independentWeight;
    const highNoise = sharedNoise * sharedWeight + (random() * 2 - 1) * independentWeight;

    lowA += lowCoefficient * (lowNoise - lowA);
    lowB += lowCoefficient * (lowA - lowB);
    midFloor += midLowCoefficient * (midNoise - midFloor);
    const midHighPassed = midNoise - midFloor;
    midCeilingA += midHighCoefficient * (midHighPassed - midCeilingA);
    midCeilingB += midHighCoefficient * (midCeilingA - midCeilingB);
    highFloor += highLowCoefficient * (highNoise - highFloor);
    highCeiling += highCeilingCoefficient * ((highNoise - highFloor) - highCeiling);

    const lowEnvelope = responseEnvelope(time, onsetJitter, 0.0012, lowDecay);
    const midEnvelope = responseEnvelope(time, onsetJitter + 0.0008, 0.0018, midDecay);
    const highEnvelope = responseEnvelope(time, onsetJitter + 0.0017, 0.0026, highDecay);
    const surfaceTexture = lowB * lowEnvelope * lowGain
      + midCeilingB * midEnvelope * midGain
      + highCeiling * highEnvelope * highGain;

    const splashNoise = random() * 2 - 1;
    splashFilter += 0.38 * (splashNoise - splashFilter);
    let secondaryContacts = 0;
    for (const splash of splashes) {
      secondaryContacts += (splashNoise - splashFilter)
        * responseEnvelope(time, splash.delay, 0.0007, splash.decay)
        * splash.strength;
    }

    const sample = pressurePulse + surfaceTexture + secondaryContacts;
    samples[index] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  const normalization = peak > 0 ? 0.9 / peak : 1;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] *= normalization;
  }

  return samples;
}
