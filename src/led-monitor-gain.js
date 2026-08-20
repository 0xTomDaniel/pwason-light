function boundedTarget(value) {
  const target = Number(value);
  if (!Number.isFinite(target)) return 0.5;
  return Math.min(1, Math.max(0, target));
}

const MONITOR_SOURCE_GAIN = Object.freeze({
  poisson: 1,
  pwm: 0.25,
});

/**
 * Returns the largest scalar that cannot drive a target-centered [0, 1]
 * current outside Web Audio full scale [-1, 1].
 */
export function maximumSafeMonitorGain(targetCurrent) {
  const target = boundedTarget(targetCurrent);
  return 1 / Math.max(target, 1 - target);
}

export function effectiveMonitorGain(manualGain, monitorSource) {
  if (!(monitorSource in MONITOR_SOURCE_GAIN)) {
    throw new TypeError(`Unknown LED monitor source: ${monitorSource}`);
  }
  const gain = Number(manualGain);
  const boundedGain = Number.isFinite(gain) ? Math.max(0, gain) : 0;
  return boundedGain * MONITOR_SOURCE_GAIN[monitorSource];
}
