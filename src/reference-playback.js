const MINIMUM_PITCH_PRESERVING_RATE = 0.75;
const MAXIMUM_PITCH_PRESERVING_RATE = 4;

function positiveFinite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
  return number;
}

export function calculateReferenceTimeStretch(speedHz, naturalRateHz) {
  const requestedRate = positiveFinite(speedHz, "Speed") /
    positiveFinite(naturalRateHz, "Reference natural rate");
  const playbackRate = Math.min(
    MAXIMUM_PITCH_PRESERVING_RATE,
    Math.max(MINIMUM_PITCH_PRESERVING_RATE, requestedRate),
  );

  return {
    requestedRate,
    playbackRate,
    limited: playbackRate !== requestedRate,
  };
}

export function enablePitchPreservation(mediaElement) {
  for (const property of [
    "preservesPitch",
    "mozPreservesPitch",
    "webkitPreservesPitch",
  ]) {
    if (property in mediaElement) mediaElement[property] = true;
  }
  return mediaElement;
}
