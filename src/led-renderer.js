const DEFAULT_CHANNEL_COUNT = 8;
const VISIBLE_TAILS = 3.4;
const MILLISECONDS_PER_SECOND = 1_000;

function envelope(ageSeconds, attackSeconds, decaySeconds) {
  if (ageSeconds < 0) return 0;
  if (ageSeconds < attackSeconds) return ageSeconds / attackSeconds;
  return Math.exp(
    -(ageSeconds - attackSeconds) / Math.max(0.01, decaySeconds * 0.33),
  );
}

export function sampleLedOutput(pulses, nowMilliseconds, channelCount = DEFAULT_CHANNEL_COUNT) {
  const activePulses = pulses.filter(
    (pulse) =>
      nowMilliseconds - pulse.startedAt <
      pulse.decay * VISIBLE_TAILS * MILLISECONDS_PER_SECOND,
  );
  const levels = Array(channelCount).fill(0);

  for (const pulse of activePulses) {
    const ageSeconds = (nowMilliseconds - pulse.startedAt) / MILLISECONDS_PER_SECOND;
    const level = envelope(ageSeconds, pulse.attack, pulse.decay) * pulse.amplitude;
    pulse.channelWeights.forEach((weight, index) => {
      if (index < levels.length) levels[index] += level * weight;
    });
  }

  return { activePulses, levels };
}
