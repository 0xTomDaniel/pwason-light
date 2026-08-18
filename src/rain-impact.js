import {
  effectiveAcousticFactor,
  normalizeAcousticFactors,
} from "./acoustic-factors.js";

const DURATION_SECONDS = 0.6;

const RESPONSE_FAMILIES = Object.freeze([
  Object.freeze({
    id: "body-contact",
    contact: 4,
    low: 1.18,
    mid: 0.56,
    high: 0.24,
    delay: 0,
    width: 0.55,
    spread: 0.45,
    tail: 0.72,
  }),
  Object.freeze({
    id: "soft-contact",
    contact: 0.34,
    low: 0.62,
    mid: 1.04,
    high: 0.76,
    delay: 0.006,
    width: 1,
    spread: 0.82,
    tail: 1.05,
  }),
  Object.freeze({
    id: "diffuse-contact",
    contact: 0.08,
    low: 0.34,
    mid: 0.82,
    high: 1.16,
    delay: 0.022,
    width: 1.35,
    spread: 1.2,
    tail: 1.18,
  }),
]);

const NEUTRAL_RESPONSE = Object.freeze({
  contact: 0.38,
  low: 0.7,
  mid: 0.9,
  high: 0.7,
  delay: 0.006,
  width: 1,
  spread: 0.8,
  tail: 1,
});

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

function blendResponseFamily(family, diversity) {
  return Object.fromEntries(Object.keys(NEUTRAL_RESPONSE).map(key => [
    key,
    interpolate(NEUTRAL_RESPONSE[key], family[key], diversity),
  ]));
}

function chooseResponseFamily(random, diversity) {
  const selection = random();
  const family = selection < 0.18
    ? RESPONSE_FAMILIES[0]
    : selection < 0.73
      ? RESPONSE_FAMILIES[1]
      : RESPONSE_FAMILIES[2];
  return blendResponseFamily(family, diversity);
}

function filterCoefficient(cutoffHz, sampleRate) {
  return 1 - Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
}

function responseEnvelope(time, delay, attack, decay) {
  const elapsed = time - delay;
  if (elapsed <= 0) return 0;
  return (1 - Math.exp(-elapsed / attack)) * Math.exp(-elapsed / decay);
}

function plateauEnvelope(time, delay, attack) {
  const elapsed = time - delay;
  if (elapsed <= 0) return 0;
  const fadeIn = 1 - Math.exp(-elapsed / attack);
  const remaining = DURATION_SECONDS - time;
  const fadeOut = remaining > 0 ? 1 - Math.exp(-remaining / 0.028) : 0;
  return fadeIn * fadeOut;
}

function varied(random, center, range, variation) {
  return center * (1 + (random() * 2 - 1) * range * variation);
}

export function createRainImpact({ sampleRate, seed, factors }) {
  const rate = Math.max(8_000, Number(sampleRate) || 48_000);
  const settings = normalizeAcousticFactors(factors);
  const amount = id => effectiveAcousticFactor(settings, id);
  const sampleCount = Math.round(rate * DURATION_SECONDS);
  const samples = new Float32Array(sampleCount);
  const random = createRandom(seed);
  const variation = amount("eventVariation");
  const responseFamily = chooseResponseFamily(
    random,
    amount("responseDiversity"),
  );

  const impactStrength = amount("impactBody")
    * responseFamily.contact
    * varied(random, 0.82, 0.58, variation);
  const impactWidth = interpolate(0.0016, 0.0065, amount("impactSoftness"))
    * responseFamily.width
    * varied(random, 1, 0.35, variation);
  const impactCenter = responseFamily.delay * varied(random, 1, 0.5, variation)
    + impactWidth * 2.4;
  const tailAmount = amount("tailLength");
  const diffuseAmount = amount("diffuseField");
  const independence = amount("bandIndependence");
  const sharedWeight = Math.sqrt(Math.max(0, 1 - independence));
  const independentWeight = Math.sqrt(independence);

  const lowGain = amount("lowTexture") * 0.42 * responseFamily.low;
  const midGain = amount("midTexture") * 0.46 * responseFamily.mid;
  const highGain = amount("highTexture") * 0.25 * responseFamily.high;
  const tailScale = interpolate(0.55, 1.35, tailAmount) * responseFamily.tail;
  const lowDelay = responseFamily.delay + varied(random, 0.008, 0.9, variation);
  const midDelay = responseFamily.delay + varied(random, 0.017, 0.9, variation);
  const highDelay = responseFamily.delay + varied(random, 0.031, 0.9, variation);
  const lowAttack = varied(random, 0.013, 0.55, variation);
  const midAttack = varied(random, 0.009, 0.55, variation);
  const highAttack = varied(random, 0.014, 0.55, variation);
  const lowDecay = varied(random, 0.13, 0.4, variation) * tailScale;
  const midDecay = varied(random, 0.16, 0.4, variation) * tailScale;
  const highDecay = varied(random, 0.11, 0.4, variation) * tailScale;
  const lowDiffuseDelay = varied(random, 0.018, 0.8, variation) * responseFamily.spread;
  const midDiffuseDelay = varied(random, 0.043, 0.8, variation) * responseFamily.spread;
  const highDiffuseDelay = varied(random, 0.072, 0.8, variation) * responseFamily.spread;
  const lowDiffuseAttack = varied(random, 0.052, 0.5, variation);
  const midDiffuseAttack = varied(random, 0.068, 0.5, variation);
  const highDiffuseAttack = varied(random, 0.046, 0.5, variation);
  const lowDiffuseDecay = varied(random, 0.34, 0.35, variation) * tailScale;
  const midDiffuseDecay = varied(random, 0.29, 0.35, variation) * tailScale;
  const highDiffuseDecay = varied(random, 0.24, 0.35, variation) * tailScale;
  const lowDiffuseGain = varied(random, 0.54, 0.14, variation);
  const midDiffuseGain = varied(random, 0.68, 0.14, variation);
  const highDiffuseGain = varied(random, 0.48, 0.18, variation);

  const lowCoefficient = filterCoefficient(1_600, rate);
  const midLowCoefficient = filterCoefficient(850, rate);
  const midHighCoefficient = filterCoefficient(7_300, rate);
  const highLowCoefficient = filterCoefficient(5_800, rate);
  const highCeilingCoefficient = filterCoefficient(16_000, rate);
  let lowA = 0;
  let lowB = 0;
  let midFloor = 0;
  let midCeilingA = 0;
  let midCeilingB = 0;
  let highFloor = 0;
  let highCeiling = 0;

  const splashAmount = amount("microSplashes") * responseFamily.spread;
  const splashDelay = amount("microSplashDelay");
  const splashes = [];
  for (let index = 0; index < 5; index += 1) {
    if (random() > Math.min(1, splashAmount)) continue;
    splashes.push({
      delay: interpolate(0.028, 0.17, splashDelay) * (0.55 + random() * 0.9),
      attack: 0.003 + random() * 0.008,
      decay: 0.024 + random() * 0.052,
      strength: splashAmount * (0.012 + random() * 0.036),
    });
  }

  let splashFilterA = 0;
  let splashFilterB = 0;
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

    const lowDiffuseEnvelope = (
      responseEnvelope(time, lowDiffuseDelay, lowDiffuseAttack, lowDiffuseDecay)
      + plateauEnvelope(time, lowDiffuseDelay, lowDiffuseAttack) * 0.28
    ) * diffuseAmount;
    const midDiffuseEnvelope = (
      responseEnvelope(time, midDiffuseDelay, midDiffuseAttack, midDiffuseDecay)
      + plateauEnvelope(time, midDiffuseDelay, midDiffuseAttack) * 0.32
    ) * diffuseAmount;
    const highDiffuseEnvelope = (
      responseEnvelope(time, highDiffuseDelay, highDiffuseAttack, highDiffuseDecay)
      + plateauEnvelope(time, highDiffuseDelay, highDiffuseAttack) * 0.24
    ) * diffuseAmount;
    const lowEnvelope = responseEnvelope(time, lowDelay, lowAttack, lowDecay)
      + lowDiffuseEnvelope * lowDiffuseGain;
    const midEnvelope = responseEnvelope(time, midDelay, midAttack, midDecay)
      + midDiffuseEnvelope * midDiffuseGain;
    const highEnvelope = responseEnvelope(time, highDelay, highAttack, highDecay)
      + highDiffuseEnvelope * highDiffuseGain;
    const responseTexture = lowB * lowEnvelope * lowGain
      + midCeilingB * midEnvelope * midGain
      + highCeiling * highEnvelope * highGain;

    const splashNoise = random() * 2 - 1;
    splashFilterA += 0.24 * (splashNoise - splashFilterA);
    splashFilterB += 0.24 * (splashFilterA - splashFilterB);
    let secondaryContacts = 0;
    for (const splash of splashes) {
      secondaryContacts += splashFilterB
        * responseEnvelope(time, splash.delay, splash.attack, splash.decay)
        * splash.strength;
    }

    samples[index] = (pressurePulse + responseTexture + secondaryContacts) * 0.83;
  }

  return samples;
}
