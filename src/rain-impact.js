import {
  effectiveAcousticFactor,
  normalizeAcousticFactors,
} from "./acoustic-factors.js";

const SURFACES = Object.freeze({
  leaf: Object.freeze({
    contactScale: 0.52,
    textureScale: 0.88,
    damping: 0.72,
    bandAmplitudes: Object.freeze([0.28, 0.36, 0.42, 0.4, 0.48, 0.72, 1.45, 1.7]),
    bandDecayMilliseconds: Object.freeze([14, 16, 18, 20, 21, 19, 15, 11]),
  }),
  litter: Object.freeze({
    contactScale: 0.34,
    textureScale: 1,
    damping: 0.84,
    bandAmplitudes: Object.freeze([0.9, 1.18, 0.86, 0.48, 0.28, 0.18, 0.13, 0.1]),
    bandDecayMilliseconds: Object.freeze([15, 18, 19, 17, 14, 11, 8, 6]),
  }),
  wood: Object.freeze({
    contactScale: 0.68,
    textureScale: 0.54,
    damping: 0.64,
    bandAmplitudes: Object.freeze([0.16, 0.25, 0.42, 0.7, 0.98, 1.12, 0.92, 0.58]),
    bandDecayMilliseconds: Object.freeze([15, 16, 17, 17, 16, 14, 11, 8]),
  }),
});

const ERB_BAND_COUNT = 8;

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

function erbRate(frequencyHz) {
  return 21.4 * Math.log10(1 + 0.00437 * frequencyHz);
}

function frequencyAtErbRate(rate) {
  return (10 ** (rate / 21.4) - 1) / 0.00437;
}

function createErbBandpassFilters(sampleRate) {
  const minimumFrequency = 180;
  const maximumFrequency = Math.min(12_000, sampleRate * 0.42);
  const minimumErb = erbRate(minimumFrequency);
  const maximumErb = erbRate(maximumFrequency);
  const erbStep = (maximumErb - minimumErb) / (ERB_BAND_COUNT - 1);

  return Array.from({ length: ERB_BAND_COUNT }, (_, index) => {
    const centerErb = minimumErb + erbStep * index;
    const centerFrequency = frequencyAtErbRate(centerErb);
    const lowerFrequency = Math.max(
      20,
      frequencyAtErbRate(centerErb - erbStep / 2),
    );
    const upperFrequency = Math.min(
      sampleRate * 0.47,
      frequencyAtErbRate(centerErb + erbStep / 2),
    );
    const bandwidth = Math.max(40, upperFrequency - lowerFrequency);
    const q = Math.max(1.45, centerFrequency / bandwidth * 4.7);
    const omega = 2 * Math.PI * centerFrequency / sampleRate;
    const alpha = Math.sin(omega) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = -2 * Math.cos(omega) / a0;
    const a2 = (1 - alpha) / a0;
    let state1 = 0;
    let state2 = 0;

    return input => {
      const output = b0 * input + state1;
      state1 = -a1 * output + state2;
      state2 = b2 * input - a2 * output;
      return output;
    };
  });
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
    ["leaf", interpolate(0.72, 0.38, diversity) * effectiveAcousticFactor(settings, "leafSurface")],
    ["litter", interpolate(0.28, 0.55, diversity) * effectiveAcousticFactor(settings, "litterSurface")],
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
    interpolate(0.00048, 0.00016, sizeNormalized),
    0.24,
    variation,
  ) * (surface === "leaf" ? 1.25 : surface === "litter" ? 1.1 : 0.75);
  const surfaceDamping = clamp(
    surfaceModel.damping + (random() - 0.5) * 0.16 * variation,
    0.48,
    0.96,
  );
  const splashProbability = clamp(
    (0.04 + sizeNormalized * 0.48)
      * (surface === "leaf" ? 1 : surface === "litter" ? 0.72 : 0.32),
  );
  const spectralFocus = surface === "leaf"
    ? clamp(interpolate(0.92, 0.72, sizeNormalized) + (random() - 0.5) * 0.14)
    : surface === "litter"
      ? clamp(interpolate(0.32, 0.14, sizeNormalized) + (random() - 0.5) * 0.14)
      : clamp(interpolate(0.7, 0.5, sizeNormalized) + (random() - 0.5) * 0.18);
  const spectralSpread = varied(
    random,
    surface === "leaf" ? 0.17 : surface === "litter" ? 0.21 : 0.18,
    0.28,
    variation,
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
    spectralFocus,
    spectralSpread,
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
  const softness = amount("impactSoftness");
  const tailScale = interpolate(0.68, 1.25, amount("tailLength"));
  const sustainScale = interpolate(0.78, 1.22, amount("diffuseField"));
  const dampingScale = interpolate(1.18, 0.78, rainMark.surfaceDamping);
  const sizeDecayScale = interpolate(0.88, 1.18, rainMark.diameterMm / 5.4);
  const contactWidth = rainMark.contactDurationSeconds
    * interpolate(0.82, 1.35, softness);
  const contactCenter = contactWidth * 1.25;
  const contactGain = amount("impactBody")
    * surface.contactScale
    * rainMark.impactLevel
    * 0.18;
  const independence = amount("bandIndependence");
  const sharedWeight = Math.sqrt(1 - independence);
  const independentWeight = Math.sqrt(independence);
  const filters = createErbBandpassFilters(rate);
  const textureGroups = [
    amount("lowTexture"),
    amount("lowTexture"),
    amount("lowTexture"),
    amount("midTexture"),
    amount("midTexture"),
    amount("midTexture"),
    amount("highTexture"),
    amount("highTexture"),
  ];
  const focusWeights = Array.from({ length: ERB_BAND_COUNT }, (_, index) => {
    const position = index / (ERB_BAND_COUNT - 1);
    const distance = (position - rainMark.spectralFocus)
      / Math.max(0.08, rainMark.spectralSpread);
    return 0.18 + 1.82 * Math.exp(-0.5 * distance * distance);
  });
  const focusRms = Math.sqrt(
    focusWeights.reduce((sum, weight) => sum + weight * weight, 0)
      / focusWeights.length,
  );
  const textureLevel = surface.textureScale
    * surfaceLevel
    * (0.035 + 0.38 * rainMark.impactLevel ** 1.8);
  const bands = filters.map((filter, index) => {
    const position = index / (ERB_BAND_COUNT - 1);
    const highFrequencySoftening = 1 - 0.08 * softness * position ** 1.4;
    return {
      filter,
      gain: interpolate(1, surface.bandAmplitudes[index], independence)
        * Math.sqrt(textureGroups[index])
        * textureLevel
        * highFrequencySoftening
        * interpolate(1, focusWeights[index] / focusRms, independence)
        * varied(random, 1, 0.16, variation),
      decaySeconds: surface.bandDecayMilliseconds[index]
        / 1000
        * tailScale
        * sustainScale
        * dampingScale
        * sizeDecayScale
        * varied(random, 1, interpolate(0.06, 0.42, independence), variation),
      onsetDelaySeconds: random()
        * interpolate(0, 0.0015, independence)
        * varied(random, 1, 0.2, variation),
      attackScale: varied(
        random,
        1,
        interpolate(0.04, 0.38, independence),
        variation,
      ),
    };
  });

  const secondaryContacts = [];
  const splashAmount = amount("microSplashes") * rainMark.splashProbability;
  const maximumContacts = 1 + Math.floor(rainMark.diameterMm / 1.6);
  for (let index = 0; index < maximumContacts; index += 1) {
    if (random() > splashAmount) continue;
    secondaryContacts.push({
      delay: interpolate(0.003, 0.028, amount("microSplashDelay"))
        * (0.7 + random() * 0.8),
      width: (0.00012 + random() * 0.00028) * interpolate(0.9, 1.4, softness),
      gain: (0.008 + random() * 0.016) * rainMark.impactLevel * splashAmount,
    });
  }

  const longestDecay = Math.max(...bands.map(band => band.decaySeconds));
  const latestSecondaryContact = secondaryContacts.reduce(
    (latest, contact) => Math.max(latest, contact.delay + contact.width * 4),
    0,
  );
  const responseDuration = clamp(
    Math.max(contactCenter + contactWidth * 4, longestDecay * 4.2, latestSecondaryContact),
    0.025,
    0.14,
  );
  const samples = new Float32Array(Math.ceil(rate * responseDuration));
  const attackSeconds = interpolate(0.00004, 0.00018, softness);
  const fadeOutSamples = Math.max(
    1,
    Math.round(rate * 0.0015),
  );

  // Start every band with a stationary stochastic state, then expose it through
  // the same sub-millisecond physical onset as the contact response.
  const warmupSamples = Math.max(16, Math.round(rate * 0.004));
  for (let index = 0; index < warmupSamples; index += 1) {
    const sharedNoise = random() * 2 - 1;
    for (const band of bands) {
      const excitation = sharedNoise * sharedWeight
        + (random() * 2 - 1) * independentWeight;
      band.filter(excitation);
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / rate;
    const attack = 1 - Math.exp(-time / attackSeconds);
    const contactDistance = (time - contactCenter) / Math.max(0.0001, contactWidth);
    const directContact = -contactDistance
      * Math.exp(-0.5 * contactDistance * contactDistance)
      * contactGain
      * attack;

    const sharedNoise = random() * 2 - 1;
    let surfaceResponse = 0;
    for (const band of bands) {
      const bandTime = time - band.onsetDelaySeconds;
      if (bandTime <= 0) continue;
      const excitation = sharedNoise * sharedWeight
        + (random() * 2 - 1) * independentWeight;
      const bandAttack = 1 - Math.exp(
        -bandTime / Math.max(0.00002, attackSeconds * band.attackScale),
      );
      surfaceResponse += band.filter(excitation)
        * Math.exp(-bandTime / Math.max(0.001, band.decaySeconds))
        * band.gain
        * bandAttack;
    }

    let fragments = 0;
    for (const contact of secondaryContacts) {
      const localTime = time - contact.delay;
      if (localTime <= 0) continue;
      const localAttack = 1 - Math.exp(-localTime / 0.00004);
      const distance = (localTime - contact.width * 1.25) / contact.width;
      fragments += -distance
        * Math.exp(-0.5 * distance * distance)
        * contact.gain
        * localAttack;
    }

    const fadeOut = Math.min(1, (samples.length - 1 - index) / fadeOutSamples);
    samples[index] = clamp(
      (directContact + surfaceResponse + fragments) * fadeOut,
      -0.98,
      0.98,
    );
  }

  return samples;
}
