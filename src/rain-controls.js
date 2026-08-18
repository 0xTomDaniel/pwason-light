const MINIMUM_SPEED_LOG = 0;
const MAXIMUM_SPEED_LOG = 3;

function finiteBounded(value, fallback, minimum = 0, maximum = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

export function createRainControls({
  speedLog = 1.364,
  dropPopulation = speedLog / MAXIMUM_SPEED_LOG,
  linked = true,
} = {}) {
  let currentSpeedLog = finiteBounded(
    speedLog,
    1.364,
    MINIMUM_SPEED_LOG,
    MAXIMUM_SPEED_LOG,
  );
  let currentDropPopulation = finiteBounded(dropPopulation, 0.5);
  let currentlyLinked = Boolean(linked);

  if (currentlyLinked) {
    currentDropPopulation = currentSpeedLog / MAXIMUM_SPEED_LOG;
  }

  function snapshot() {
    return Object.freeze({
      speedLog: currentSpeedLog,
      rateHz: 10 ** currentSpeedLog,
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
      currentDropPopulation = currentSpeedLog / MAXIMUM_SPEED_LOG;
    }
    return snapshot();
  }

  function setDropPopulation(value) {
    currentDropPopulation = finiteBounded(value, currentDropPopulation);
    if (currentlyLinked) {
      currentSpeedLog = currentDropPopulation * MAXIMUM_SPEED_LOG;
    }
    return snapshot();
  }

  function setLinked(value) {
    currentlyLinked = Boolean(value);
    if (currentlyLinked) {
      currentDropPopulation = currentSpeedLog / MAXIMUM_SPEED_LOG;
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
