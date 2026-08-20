const CHANNEL_COUNT = 8;
const MINIMUM_RATE_HZ = 1;
const MAXIMUM_RATE_HZ = 48_000;
const DEFAULT_FIELD_RADIUS_METERS = 20;

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createChannelRoute(random, channelCoupling) {
  const shared = random() < channelCoupling;
  const privateChannel = Math.floor(random() * CHANNEL_COUNT);
  if (shared) {
    return {
      route: "shared",
      channelWeights: Array(CHANNEL_COUNT).fill(1 / CHANNEL_COUNT),
    };
  }

  return {
    route: "private",
    channelWeights: Array.from(
      { length: CHANNEL_COUNT },
      (_, index) => (index === privateChannel ? 1 : 0),
    ),
  };
}

function createImpactPosition(random, fieldRadiusMeters) {
  return Object.freeze({
    radialDistanceMeters: Math.sqrt(random()) * fieldRadiusMeters,
    azimuthRadians: random() * Math.PI * 2 - Math.PI,
  });
}

export function createPoissonEngine({
  seed = "pwason",
  rateHz = 3,
  coupling = 0.35,
  fieldRadiusMeters = DEFAULT_FIELD_RADIUS_METERS,
} = {}) {
  const random = createRandom(seed);
  const baseRate = clamp(Number(rateHz) || 3, MINIMUM_RATE_HZ, MAXIMUM_RATE_HZ);
  const channelCoupling = clamp(Number(coupling) || 0, 0, 1);
  const requestedFieldRadius = Number(fieldRadiusMeters);
  const listeningFieldRadius = Math.max(
    0,
    Number.isFinite(requestedFieldRadius)
      ? requestedFieldRadius
      : DEFAULT_FIELD_RADIUS_METERS,
  );
  let eventId = 0;
  let elapsed = 0;

  return Object.freeze({
    next() {
      const currentRate = baseRate;
      const gap = -Math.log(1 - random()) / currentRate;
      const channelRoute = createChannelRoute(random, channelCoupling);
      elapsed += gap;
      eventId += 1;

      return Object.freeze({
        id: eventId,
        at: elapsed,
        gap,
        rateHz: Number(currentRate.toFixed(6)),
        amplitude: Number((0.28 + random() * 0.72).toFixed(6)),
        attack: Number((0.012 + random() * 0.075).toFixed(6)),
        decay: Number((0.18 + random() * 0.92).toFixed(6)),
        route: channelRoute.route,
        channelWeights: Object.freeze(channelRoute.channelWeights),
        position: createImpactPosition(random, listeningFieldRadius),
      });
    },
  });
}
