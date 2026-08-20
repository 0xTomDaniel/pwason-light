const MINIMUM_SPEED_LOG = 2;
const MAXIMUM_RATE_HZ = 48_000;
const MAXIMUM_SPEED_LOG = Math.log10(MAXIMUM_RATE_HZ);
const SPEED_LOG_SPAN = MAXIMUM_SPEED_LOG - MINIMUM_SPEED_LOG;

function finiteBounded(value, fallback, minimum = 0, maximum = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

export function createRainControls({
  speedLog = 3,
  dropPopulation = (speedLog - MINIMUM_SPEED_LOG) / SPEED_LOG_SPAN,
  linked = true,
} = {}) {
  let currentSpeedLog = finiteBounded(
    speedLog,
    3,
    MINIMUM_SPEED_LOG,
    MAXIMUM_SPEED_LOG,
  );
  let currentDropPopulation = finiteBounded(dropPopulation, 0.5);
  let currentlyLinked = Boolean(linked);

  if (currentlyLinked) {
    currentDropPopulation =
      (currentSpeedLog - MINIMUM_SPEED_LOG) / SPEED_LOG_SPAN;
  }

  function snapshot() {
    return Object.freeze({
      speedLog: currentSpeedLog,
      rateHz: Math.min(MAXIMUM_RATE_HZ, 10 ** currentSpeedLog),
      dropPopulation: currentDropPopulation,
      linked: currentlyLinked,
    });
  }

  function setSpeedLog(value) {
    currentSpeedLog = finiteBounded(
      value,
      currentSpeedLog,
      MINIMUM_SPEED_LOG,
      MAXIMUM_SPEED_LOG,
    );
    if (currentlyLinked) {
      currentDropPopulation =
        (currentSpeedLog - MINIMUM_SPEED_LOG) / SPEED_LOG_SPAN;
    }
    return snapshot();
  }

  function setDropPopulation(value) {
    currentDropPopulation = finiteBounded(value, currentDropPopulation);
    if (currentlyLinked) {
      currentSpeedLog = MINIMUM_SPEED_LOG
        + currentDropPopulation * SPEED_LOG_SPAN;
    }
    return snapshot();
  }

  function setLinked(value) {
    currentlyLinked = Boolean(value);
    if (currentlyLinked) {
      currentDropPopulation =
        (currentSpeedLog - MINIMUM_SPEED_LOG) / SPEED_LOG_SPAN;
    }
    return snapshot();
  }

  return Object.freeze({
    snapshot,
    setSpeedLog,
    setDropPopulation,
    setLinked,
  });
}
