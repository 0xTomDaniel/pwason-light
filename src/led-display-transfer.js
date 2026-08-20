const DISPLAY_TRANSFER_EXPONENT = 2.2;

function boundedCurrent(value) {
  const current = Number(value);
  if (!Number.isFinite(current)) return 0;
  return Math.min(1, Math.max(0, current));
}

/**
 * Converts linear current evidence into an approximate sRGB display code.
 * This affects only the virtual disc; meters and signal diagnostics stay linear.
 */
export function currentToDisplayLevel(current) {
  return boundedCurrent(current) ** (1 / DISPLAY_TRANSFER_EXPONENT);
}
