const DURATION_SECONDS = 0.12;
const IMPACT_WIDTH_SECONDS = 0.0012;
const REACTION_DECAY_SECONDS = 0.045;
const SURFACE_REACTION_CUTOFF_HZ = 1_800;

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

export function createRainImpact({ sampleRate, seed }) {
  const rate = Math.max(8_000, Number(sampleRate) || 48_000);
  const sampleCount = Math.round(rate * DURATION_SECONDS);
  const samples = new Float32Array(sampleCount);
  const random = createRandom(seed);
  const impactCenter = IMPACT_WIDTH_SECONDS * 3;
  const filterCoefficient = 1 - Math.exp(
    -2 * Math.PI * SURFACE_REACTION_CUTOFF_HZ / rate,
  );
  let reactionFilterA = 0;
  let reactionFilterB = 0;
  let peak = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / rate;
    const distance = (time - impactCenter) / IMPACT_WIDTH_SECONDS;
    const pressurePulse = (1 - distance * distance) * Math.exp(-0.5 * distance * distance);
    const reactionEnvelope = (1 - Math.exp(-time / 0.0008))
      * Math.exp(-time / REACTION_DECAY_SECONDS);
    const stochasticForce = random() * 2 - 1;
    reactionFilterA += filterCoefficient * (stochasticForce - reactionFilterA);
    reactionFilterB += filterCoefficient * (reactionFilterA - reactionFilterB);
    const surfaceReaction = reactionFilterB * reactionEnvelope * 0.72;
    const sample = pressurePulse + surfaceReaction;
    samples[index] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  const normalization = peak > 0 ? 0.9 / peak : 1;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] *= normalization;
  }

  return samples;
}
