const DEFINITIONS = [
  { id: "impactBody", group: "Impact shape", label: "Impact body", description: "Signed initial pressure response", defaultAmount: 0.32 },
  { id: "impactSoftness", group: "Impact shape", label: "Impact softness", description: "Rounds the initial pressure response", defaultAmount: 0.72 },
  { id: "tailLength", group: "Impact shape", label: "Tail length", description: "Extends each surface response", defaultAmount: 0.72 },
  { id: "eventVariation", group: "Impact shape", label: "Event variation", description: "Varies response shape between Arrivals", defaultAmount: 0.62 },
  { id: "lowTexture", group: "Surface texture", label: "Low texture", description: "Independent low-frequency surface energy", defaultAmount: 0.76 },
  { id: "midTexture", group: "Surface texture", label: "Mid texture", description: "Mid-frequency energy inside each surface response", defaultAmount: 0.20 },
  { id: "highTexture", group: "Surface texture", label: "High texture", description: "Independent high-frequency spray energy", defaultAmount: 0.46 },
  { id: "leafSurface", group: "Surface texture", label: "Leaf surface", description: "Prevalence of flexible leaf responses", defaultAmount: 0.80 },
  { id: "litterSurface", group: "Surface texture", label: "Litter / soil", description: "Prevalence of damped ground responses", defaultAmount: 0.60 },
  { id: "woodSurface", group: "Surface texture", label: "Wood surface", description: "Prevalence of short woody responses", defaultAmount: 0.20 },
  { id: "bandIndependence", group: "Surface texture", label: "Band independence", description: "Decouples low, mid, and high envelopes", defaultAmount: 0.88 },
  { id: "microSplashes", group: "Surface texture", label: "Micro-splashes", description: "Adds quieter secondary contacts inside one Arrival", defaultAmount: 0.42 },
  { id: "microSplashDelay", group: "Surface texture", label: "Splash delay", description: "Spreads secondary contacts later in the response", defaultAmount: 0.58 },
  { id: "responseDiversity", group: "Surface texture", label: "Surface diversity", description: "Broadens the leaf, litter, and wood surface mixture", defaultAmount: 0.82 },
  { id: "diffuseField", group: "Surface texture", label: "Surface sustain", description: "Extends each finite surface excitation", defaultAmount: 0.24 },
  { id: "distanceLoss", group: "Space", label: "Distance loss", description: "Fades pressure with source distance", defaultAmount: 0.70 },
  { id: "fieldDepth", group: "Space", label: "Field depth", description: "Sets how far impact positions extend around the listener", defaultAmount: 0.66 },
  { id: "stereoSpread", group: "Space", label: "Stereo spread", description: "Places impacts continuously across stereo", defaultAmount: 0.86 },
  { id: "airDamping", group: "Space", label: "Distance air damping", description: "Softens distant high frequencies", defaultAmount: 0.60 },
  { id: "densityCompensation", group: "Output", label: "Density compensation", description: "Reduces each impact as Speed creates more overlap", defaultAmount: 1 },
  { id: "compression", group: "Output", label: "Compression", description: "Controls dense-overlap peaks", defaultAmount: 0.45, defaultEnabled: false },
];

export const ACOUSTIC_FACTOR_DEFINITIONS = Object.freeze(
  DEFINITIONS.map(definition => Object.freeze({
    ...definition,
    defaultEnabled: definition.defaultEnabled ?? true,
    min: 0,
    max: 1,
    step: 0.01,
  })),
);

const DEFINITION_BY_ID = new Map(
  ACOUSTIC_FACTOR_DEFINITIONS.map(definition => [definition.id, definition]),
);

function clampAmount(value, fallback) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(0, Math.min(1, amount));
}

export function createDefaultAcousticFactors() {
  return Object.fromEntries(ACOUSTIC_FACTOR_DEFINITIONS.map(definition => [
    definition.id,
    {
      enabled: definition.defaultEnabled,
      amount: definition.defaultAmount,
    },
  ]));
}

export function normalizeAcousticFactors(input = {}) {
  return Object.fromEntries(ACOUSTIC_FACTOR_DEFINITIONS.map(definition => {
    const candidate = input?.[definition.id];
    return [definition.id, {
      enabled: typeof candidate?.enabled === "boolean"
        ? candidate.enabled
        : definition.defaultEnabled,
      amount: clampAmount(candidate?.amount, definition.defaultAmount),
    }];
  }));
}

export function effectiveAcousticFactor(input, id) {
  const definition = DEFINITION_BY_ID.get(id);
  if (!definition) throw new RangeError(`Unknown Acoustic Factor: ${id}`);
  const candidate = input?.[id];
  const enabled = typeof candidate?.enabled === "boolean"
    ? candidate.enabled
    : definition.defaultEnabled;
  if (!enabled) return 0;
  return clampAmount(candidate?.amount, definition.defaultAmount);
}
