const DEFAULT_EAR_HEIGHT_METERS = 1.5;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function calculateAcousticPropagation(
  position,
  {
    earHeightMeters = DEFAULT_EAR_HEIGHT_METERS,
    distanceLoss = 1,
    stereoSpread = 1,
    airDamping = 0,
  } = {},
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
  const fullDistancePressure = listenerHeight / sourceDistanceMeters;
  const distanceAmount = Math.max(0, Math.min(1, finiteNumber(distanceLoss, 1)));
  const spreadAmount = Math.max(0, Math.min(1, finiteNumber(stereoSpread, 1)));
  const dampingAmount = Math.max(0, Math.min(1, finiteNumber(airDamping, 0)));
  const fullStereoPan = (2 / Math.PI) * Math.asin(Math.sin(azimuthRadians));
  const distanceFraction = radialDistanceMeters / Math.max(
    radialDistanceMeters + listenerHeight,
    0.01,
  );
  // The accepted 70% listening setting is the ordinary free-field 1/d
  // pressure law. The factor varies its exponent without adding another bed.
  const distancePower = distanceAmount / 0.7;
  const distancePressure = fullDistancePressure ** distancePower;

  return Object.freeze({
    sourceDistanceMeters,
    relativePressure: distancePressure,
    stereoPan: Math.max(-1, Math.min(1, fullStereoPan * spreadAmount)),
    airDampingCutoffHz: 20_000 - 17_500 * dampingAmount * distanceFraction,
  });
}
