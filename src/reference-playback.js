const MINIMUM_PITCH_PRESERVING_RATE = 0.75;
const MAXIMUM_PITCH_PRESERVING_RATE = 4;

function positiveFinite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
  return number;
}

export function calculateReferenceTimeStretch(speedHz, comparisonRateHz) {
  const requestedRate = positiveFinite(speedHz, "Speed") /
    positiveFinite(comparisonRateHz, "Reference comparison rate");
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

export function resolveReferencePlaybackWindow(reference) {
  const start = Number(reference?.analysisStartSeconds);
  const duration = Number(reference?.analysisDurationSeconds);
  const isBounded = Number.isFinite(start)
    && start >= 0
    && Number.isFinite(duration)
    && duration > 0;

  return Object.freeze({
    startSeconds: isBounded ? start : 0,
    endSeconds: isBounded ? start + duration : null,
    isBounded,
  });
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
