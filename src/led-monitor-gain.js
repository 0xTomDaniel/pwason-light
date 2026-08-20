function boundedTarget(value) {
  const target = Number(value);
  if (!Number.isFinite(target)) return 0.5;
  return Math.min(1, Math.max(0, target));
}

/**
 * Returns the largest scalar that cannot drive a target-centered [0, 1]
 * current outside Web Audio full scale [-1, 1].
 */
export function maximumSafeMonitorGain(targetCurrent) {
  const target = boundedTarget(targetCurrent);
  return 1 / Math.max(target, 1 - target);
}
