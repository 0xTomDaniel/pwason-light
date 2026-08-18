import {
  effectiveAcousticFactor,
  normalizeAcousticFactors,
} from "./acoustic-factors.js";

const SURFACES = Object.freeze({
  leaf: Object.freeze({
    contactScale: 0.52,
    textureScale: 0.88,
    durationSeconds: 0.19,
    damping: 0.72,
    modeFrequencies: Object.freeze([230, 410, 760]),
  }),
  litter: Object.freeze({
    contactScale: 0.34,
    textureScale: 1,
    durationSeconds: 0.14,
    damping: 0.84,
    modeFrequencies: Object.freeze([]),
  }),
  wood: Object.freeze({
    contactScale: 0.68,
    textureScale: 0.54,
    durationSeconds: 0.12,
    damping: 0.64,
    modeFrequencies: Object.freeze([310, 690, 1_260]),
  }),
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

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function interpolate(from, to, amount) {
  return from + (to - from) * amount;
}

function filterCoefficient(cutoffHz, sampleRate) {
  return 1 - Math.exp(-2 * Math.PI * Math.min(cutoffHz, sampleRate * 0.45) / sampleRate);
}

function decayEnvelope(time, attack, decay) {
  if (time <= 0) return 0;
  return (1 - Math.exp(-time / Math.max(0.0001, attack)))
    * Math.exp(-time / Math.max(0.001, decay));
}

function varied(random, center, range, variation) {
  return center * (1 + (random() * 2 - 1) * range * variation);
}

export function createRainMark({ seed, dropPopulation = 0.5, factors } = {}) {
  const random = createRandom(seed);
  const population = clamp(Number(dropPopulation) || 0);
  const settings = normalizeAcousticFactors(factors);
  const variation = effectiveAcousticFactor(settings, "eventVariation");
  const diversity = effectiveAcousticFactor(settings, "responseDiversity");

  // A fine-biased random draw moves toward a broad, large-drop-rich population.
  // This is a compact statistical control, not a second event clock.
  const fineDraw = random() ** 1.85;
  const largeDraw = random() ** 0.72;
  const diameterMm = clamp(
    0.32 + 1.25 * fineDraw + population * (0.35 + 3.45 * largeDraw),
    0.3,
    5.4,
  );
  const velocityMetersPerSecond = 2.25 + 2.55 * Math.sqrt(diameterMm);
  const sizeNormalized = clamp((diameterMm - 0.3) / 5.1);
  const surfaceWeights = [
    ["leaf", interpolate(0.82, 0.52, diversity) * effectiveAcousticFactor(settings, "leafSurface")],
    ["litter", interpolate(0.16, 0.36, diversity) * effectiveAcousticFactor(settings, "litterSurface")],
    ["wood", interpolate(0.02, 0.12, diversity) * effectiveAcousticFactor(settings, "woodSurface")],
  ];
  const surfaceWeightTotal = surfaceWeights.reduce((sum, entry) => sum + entry[1], 0);
  let surface = "leaf";
  if (surfaceWeightTotal > 0) {
    let surfaceDraw = random() * surfaceWeightTotal;
    for (const [candidate, weight] of surfaceWeights) {
      surfaceDraw -= weight;
      if (surfaceDraw <= 0) {
        surface = candidate;
        break;
      }
    }
  }
  const surfaceModel = SURFACES[surface];
  const impactLevel = (0.16 + 0.84 * sizeNormalized ** 1.2)
    * (velocityMetersPerSecond / 8.2)
    * varied(random, 1, 0.22, variation);
  const contactDurationSeconds = varied(
    random,
    interpolate(0.0019, 0.00065, sizeNormalized),
    0.3,
    variation,
  ) * (surface === "leaf" ? 1.55 : surface === "litter" ? 1.25 : 0.75);
  const surfaceDamping = clamp(
    surfaceModel.damping + (random() - 0.5) * 0.16 * variation,
    0.48,
    0.96,
  );
  const splashProbability = clamp(
    (0.04 + sizeNormalized * 0.48)
      * (surface === "leaf" ? 1 : surface === "litter" ? 0.72 : 0.32),
  );

  return Object.freeze({
    population,
    diameterMm,
    sizeClass: diameterMm < 1.25 ? "fine" : diameterMm < 2.8 ? "medium" : "large",
    velocityMetersPerSecond,
    surface,
    surfaceEnabled: surfaceWeightTotal > 0,
    impactLevel,
    contactDurationSeconds,
    surfaceDamping,
    splashProbability,
  });
}

export function createRainImpact({
  sampleRate,
  seed,
  factors,
  dropPopulation = 0.5,
  mark,
} = {}) {
  const rate = Math.max(8_000, Number(sampleRate) || 48_000);
  const settings = normalizeAcousticFactors(factors);
  const amount = id => effectiveAcousticFactor(settings, id);
  const rainMark = mark ?? createRainMark({ seed, dropPopulation, factors: settings });
  const surface = SURFACES[rainMark.surface];
  const surfaceLevel = rainMark.surfaceEnabled === false ? 0 : 1;
  const random = createRandom((Number(seed) >>> 0) ^ 0xa511e9b3);
  const variation = amount("eventVariation");
  const tailScale = interpolate(0.58, 1.32, amount("tailLength"));
  const sustainScale = interpolate(0.72, 1.28, amount("diffuseField"));
  const responseDuration = clamp(
    surface.durationSeconds
      * tailScale
      * sustainScale
      * interpolate(0.82, 1.28, rainMark.diameterMm / 5.4)
      * varied(random, 1, 0.18, variation),
    0.075,
    0.48,
  );
  const samples = new Float32Array(Math.ceil(rate * responseDuration));
  const softness = amount("impactSoftness");
  const contactWidth = rainMark.contactDurationSeconds
    * interpolate(0.62, 1.72, softness);
  const contactCenter = contactWidth * 2.2;
  const contactGain = amount("impactBody")
    * surface.contactScale
    * rainMark.impactLevel
    * 0.52;
  const surfaceDecay = responseDuration
    * interpolate(0.28, 0.74, 1 - rainMark.surfaceDamping);
  const lowGain = amount("lowTexture")
    * surface.textureScale
    * surfaceLevel
    * interpolate(0.12, 0.34, rainMark.impactLevel);
  const midGain = amount("midTexture")
    * surface.textureScale
    * surfaceLevel
    * interpolate(0.12, 0.32, rainMark.impactLevel);
  const highGain = amount("highTexture")
    * surface.textureScale
    * surfaceLevel
    * interpolate(0.08, 0.24, rainMark.impactLevel);
  const independence = amount("bandIndependence");
  const sharedWeight = Math.sqrt(1 - independence);
  const independentWeight = Math.sqrt(independence);
  const lowCoefficient = filterCoefficient(1_350, rate);
  const midFloorCoefficient = filterCoefficient(900, rate);
  const midCeilingCoefficient = filterCoefficient(4_800, rate);
  const highFloorCoefficient = filterCoefficient(4_200, rate);
  const highCeilingCoefficient = filterCoefficient(12_500, rate);
  let lowA = 0;
  let lowB = 0;
  let midFloor = 0;
  let midCeiling = 0;
  let highFloor = 0;
  let highCeiling = 0;

  const modeStates = surface.modeFrequencies.map((baseFrequency, index) => {
    const frequency = baseFrequency
      * interpolate(0.84, 1.45, rainMark.diameterMm / 5.4)
      * varied(random, 1, 0.11, variation);
    return {
      phase: random() * Math.PI * 2,
      phaseStep: 2 * Math.PI * frequency / rate,
      gain: (0.018 + index * 0.007)
        * rainMark.impactLevel
        * surfaceLevel
        * (rainMark.surface === "wood" ? 1 : 0.72),
      decay: surfaceDecay * (0.24 + index * 0.13),
    };
  });

  const secondaryContacts = [];
  const splashAmount = amount("microSplashes") * rainMark.splashProbability;
  const maximumContacts = 1 + Math.floor(rainMark.diameterMm / 1.2);
  for (let index = 0; index < maximumContacts; index += 1) {
    if (random() > splashAmount) continue;
    secondaryContacts.push({
      delay: interpolate(0.012, 0.095, amount("microSplashDelay"))
        * (0.7 + random() * 0.8),
      width: (0.001 + random() * 0.0025) * interpolate(1.2, 2.2, softness),
      gain: (0.012 + random() * 0.026) * rainMark.impactLevel * splashAmount,
    });
  }

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / rate;
    const contactDistance = (time - contactCenter) / Math.max(0.0001, contactWidth);
    // A derivative-of-Gaussian pressure pulse avoids the hard single-sample click.
    const directContact = -contactDistance
      * Math.exp(-0.5 * contactDistance * contactDistance)
      * contactGain;

    const sharedNoise = random() * 2 - 1;
    const lowNoise = sharedNoise * sharedWeight + (random() * 2 - 1) * independentWeight;
    const midNoise = sharedNoise * sharedWeight + (random() * 2 - 1) * independentWeight;
    const highNoise = sharedNoise * sharedWeight + (random() * 2 - 1) * independentWeight;
    lowA += lowCoefficient * (lowNoise - lowA);
    lowB += lowCoefficient * (lowA - lowB);
    midFloor += midFloorCoefficient * (midNoise - midFloor);
    midCeiling += midCeilingCoefficient * ((midNoise - midFloor) - midCeiling);
    highFloor += highFloorCoefficient * (highNoise - highFloor);
    highCeiling += highCeilingCoefficient * ((highNoise - highFloor) - highCeiling);

    const lowEnvelope = decayEnvelope(
      time,
      rainMark.surface === "litter" ? 0.005 : 0.009,
      surfaceDecay * 1.05,
    );
    const midEnvelope = decayEnvelope(time, 0.0035, surfaceDecay * 0.72);
    const highEnvelope = decayEnvelope(time, 0.0025, surfaceDecay * 0.46);
    let surfaceResponse = lowB * lowEnvelope * lowGain
      + midCeiling * midEnvelope * midGain
      + highCeiling * highEnvelope * highGain;

    for (const mode of modeStates) {
      surfaceResponse += Math.sin(mode.phase + index * mode.phaseStep)
        * Math.exp(-time / Math.max(0.004, mode.decay))
        * mode.gain;
    }

    let fragments = 0;
    for (const contact of secondaryContacts) {
      const distance = (time - contact.delay) / contact.width;
      fragments += -distance * Math.exp(-0.5 * distance * distance) * contact.gain;
    }

    samples[index] = clamp(directContact + surfaceResponse + fragments, -0.98, 0.98);
  }

  return samples;
}
