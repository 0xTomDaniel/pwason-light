const DEFAULT_EAR_HEIGHT_METERS = 1.5;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function calculateAcousticPropagation(
  position,
  { earHeightMeters = DEFAULT_EAR_HEIGHT_METERS } = {},
) {
  const radialDistanceMeters = Math.max(
    0,
    finiteNumber(position?.radialDistanceMeters, 0),
  );
  const azimuthRadians = finiteNumber(position?.azimuthRadians, 0);
  const listenerHeight = Math.max(
    0.01,
    finiteNumber(earHeightMeters, DEFAULT_EAR_HEIGHT_METERS),
  );
  const sourceDistanceMeters = Math.hypot(radialDistanceMeters, listenerHeight);
  const stereoPan = (2 / Math.PI) * Math.asin(Math.sin(azimuthRadians));

  return Object.freeze({
    sourceDistanceMeters,
    relativePressure: listenerHeight / sourceDistanceMeters,
    stereoPan: Math.max(-1, Math.min(1, stereoPan)),
  });
}
