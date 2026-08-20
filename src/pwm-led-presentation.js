const DEFAULT_REFRESH_RATE_HZ = 60;
const MAXIMUM_RESOLVED_PWM_HZ = 15;
const MINIMUM_RESOLVED_FRAMES_PER_CYCLE = 4;
const MINIMUM_HIGHER_REFRESH_OBSERVATIONS = 4;
const TRANSITION_START_RATIO = 0.7;
const NOMINAL_REFRESH_RATES_HZ = Object.freeze([
  30, 50, 60, 75, 90, 100, 120, 144, 165, 240, 360,
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeRefreshRate(rateHz) {
  const nearest = NOMINAL_REFRESH_RATES_HZ.reduce((best, candidate) => (
    Math.abs(candidate - rateHz) < Math.abs(best - rateHz) ? candidate : best
  ));
  return Math.abs(nearest - rateHz) / nearest <= 0.02
    ? nearest
    : Math.round(rateHz * 10) / 10;
}

function smoothstep(value) {
  const bounded = clamp(value, 0, 1);
  return bounded * bounded * (3 - 2 * bounded);
}

/**
 * Owns the refresh-aware presentation of deterministic PWM on a frame-limited
 * virtual LED. It never changes or feeds back into the current engine.
 */
export function createPwmLedPresentation({
  initialRefreshRateHz = DEFAULT_REFRESH_RATE_HZ,
} = {}) {
  let displayRefreshRateHz = clamp(
    finite(initialRefreshRateHz, DEFAULT_REFRESH_RATE_HZ),
    20,
    500,
  );
  let lastTimestampMs = null;
  let phase = 0;
  const higherRefreshObservations = new Map();

  function frame({
    timestampMs,
    pwmFrequencyHz,
    pwmOnCurrent,
    pwmDutyCycle,
  } = {}) {
    const timestamp = finite(timestampMs, lastTimestampMs ?? 0);
    const frequency = Math.max(0, finite(pwmFrequencyHz, 0));
    const onCurrent = clamp(finite(pwmOnCurrent, 0), 0, 1);
    const dutyCycle = clamp(finite(pwmDutyCycle, 0), 0, 1);

    if (lastTimestampMs !== null) {
      const intervalMs = Math.max(0, timestamp - lastTimestampMs);
      phase = (phase + frequency * intervalMs / 1_000) % 1;
      if (phase > 1 - 1e-9) phase = 0;

      if (intervalMs >= 2 && intervalMs <= 50) {
        const observedRefreshRateHz = normalizeRefreshRate(1_000 / intervalMs);
        if (observedRefreshRateHz > displayRefreshRateHz * 1.05) {
          const observations = (higherRefreshObservations.get(observedRefreshRateHz) ?? 0) + 1;
          higherRefreshObservations.set(observedRefreshRateHz, observations);
          if (observations >= MINIMUM_HIGHER_REFRESH_OBSERVATIONS) {
            displayRefreshRateHz = observedRefreshRateHz;
            higherRefreshObservations.clear();
          }
        }
      }
    }
    lastTimestampMs = timestamp;

    const resolvedLimitHz = Math.min(
      MAXIMUM_RESOLVED_PWM_HZ,
      displayRefreshRateHz / MINIMUM_RESOLVED_FRAMES_PER_CYCLE,
    );
    const transitionStartHz = resolvedLimitHz * TRANSITION_START_RATIO;
    const resolvedCurrent = phase < dutyCycle ? onCurrent : 0;
    const integratedCurrent = onCurrent * dutyCycle;
    let mode = "resolved";
    let presentedCurrent = resolvedCurrent;

    if (frequency >= resolvedLimitHz) {
      mode = "integrated";
      presentedCurrent = integratedCurrent;
    } else if (frequency > transitionStartHz) {
      mode = "transition";
      const integrationMix = smoothstep(
        (frequency - transitionStartHz) / (resolvedLimitHz - transitionStartHz),
      );
      presentedCurrent = resolvedCurrent * (1 - integrationMix)
        + integratedCurrent * integrationMix;
    }
    const level = presentedCurrent;

    return Object.freeze({
      mode,
      level,
      displayRefreshRateHz,
      resolvedLimitHz,
    });
  }

  return Object.freeze({ frame });
}
