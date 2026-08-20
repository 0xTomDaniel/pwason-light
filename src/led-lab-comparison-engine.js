import { createPoissonLedLabEngine } from "./led-current-engine.js";

const MONITOR_SOURCES = new Set(["poisson", "pwm"]);

/**
 * Owns the matched, simultaneous Poisson hypothesis and PWM control.
 * Shared settings are applied to both condition engines; monitorSource only
 * selects which already-running current field is exposed to the audio path.
 */
export function createLedLabComparisonEngine({
  monitorSource = "poisson",
  ...settings
} = {}) {
  if (!MONITOR_SOURCES.has(monitorSource)) {
    throw new TypeError(`Unknown LED lab monitor source: ${monitorSource}`);
  }
  let monitored = monitorSource;
  const poisson = createPoissonLedLabEngine({
    ...settings,
    seed: `${settings.seed ?? "poisson-led-lab"}:poisson`,
    source: "poisson",
  });
  const pwm = createPoissonLedLabEngine({
    ...settings,
    seed: `${settings.seed ?? "poisson-led-lab"}:pwm`,
    source: "pwm",
  });

  function configure(next = {}) {
    if (next.monitorSource !== undefined) {
      if (!MONITOR_SOURCES.has(next.monitorSource)) {
        throw new TypeError(`Unknown LED lab monitor source: ${next.monitorSource}`);
      }
      monitored = next.monitorSource;
    }
    const { monitorSource: _ignored, source: _source, ...shared } = next;
    poisson.configure(shared);
    pwm.configure(shared);
    return snapshot();
  }

  function render(frameCount) {
    const conditions = Object.freeze({
      poisson: poisson.render(frameCount),
      pwm: pwm.render(frameCount),
    });
    return Object.freeze({
      conditions,
      monitorSource: monitored,
      audioMonitor: conditions[monitored].audioMonitor,
    });
  }

  function snapshot() {
    return Object.freeze({
      monitorSource: monitored,
      conditions: Object.freeze({
        poisson: poisson.snapshot(),
        pwm: pwm.snapshot(),
      }),
    });
  }

  function reset() {
    poisson.reset();
    pwm.reset();
  }

  return Object.freeze({ configure, render, snapshot, reset });
}
