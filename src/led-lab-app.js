import { createRenderLoop } from "./render-loop.js";

const CHANNEL_NAMES = [
  "Violet",
  "Royal Blue",
  "Cyan",
  "Green",
  "PC Lime",
  "PC Amber",
  "Red",
  "Deep Red",
  "White Σ",
];
const SCOPE_SECONDS = 1;

const instrument = document.querySelector("[data-led-lab]");
const startButton = document.querySelector("#start-stop");
const rateInput = document.querySelector("#led-rate");
const rateOutput = document.querySelector("#led-rate-output");
const channelRateOutput = document.querySelector("#channel-rate-output");
const pwmFrequencyOutput = document.querySelector("#pwm-frequency-output");
const sourceInputs = [...document.querySelectorAll('[name="monitor-source"]')];
const pulseInput = document.querySelector("#pulse-width");
const pulseOutput = document.querySelector("#pulse-width-output");
const targetInput = document.querySelector("#target-current");
const targetOutput = document.querySelector("#target-current-output");
const soundInput = document.querySelector("#sound-enabled");
const volumeInput = document.querySelector("#output-level");
const volumeOutput = document.querySelector("#output-level-output");
const statusOutput = document.querySelector("#engine-status");
const meanOutput = document.querySelector("#mean-current");
const rmsOutput = document.querySelector("#rms-modulation");
const peakOutput = document.querySelector("#peak-current");
const limitOutput = document.querySelector("#limit-proximity");
const arrivalOutput = document.querySelector("#observed-rate");
const observedRateLabel = document.querySelector("#observed-rate-label");
const ledBanks = Object.fromEntries(
  [...document.querySelectorAll("[data-condition-bank]")].map(bank => [
    bank.dataset.conditionBank,
    {
      leds: [...bank.querySelectorAll("[data-current-led]")],
      values: [...bank.querySelectorAll("[data-current-value]")],
    },
  ]),
);
const leds = Object.values(ledBanks).flatMap(bank => bank.leds);
const currentCanvas = document.querySelector("#current-scope");
const audioCanvas = document.querySelector("#audio-scope");
const scopeSourceOutput = document.querySelector("#scope-source-output");
const audioSourceOutput = document.querySelector("#audio-source-output");

let audioContext = null;
let workletNode = null;
let monitorGain = null;
let running = false;
let lastMonitorSource = "poisson";

function selectedSource() {
  return sourceInputs.find(input => input.checked)?.value ?? "poisson";
}

function rateFromControl() {
  return Math.min(48_000, Math.max(1, Math.round(10 ** Number(rateInput.value))));
}

function pulseWidthFromControl() {
  return 10 ** Number(pulseInput.value);
}

function formatRate(rate) {
  return rate >= 1_000
    ? `${(rate / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kHz`
    : `${Math.round(rate).toLocaleString()} Hz`;
}

function settings() {
  return {
    monitorSource: selectedSource(),
    rateHz: rateFromControl(),
    pulseWidthMs: pulseWidthFromControl(),
    targetCurrent: Number(targetInput.value) / 100,
  };
}

function updateControlLabels() {
  const values = settings();
  rateOutput.value = `${values.rateHz.toLocaleString()} events/s shared`;
  channelRateOutput.value = `${formatRate(values.rateHz / 8)} expected Poisson per Channel`;
  pwmFrequencyOutput.value = `${formatRate(values.rateHz / 8)} per Channel`;
  pulseOutput.value = values.pulseWidthMs < 1
    ? `${values.pulseWidthMs.toFixed(2)} ms`
    : `${values.pulseWidthMs.toFixed(values.pulseWidthMs < 10 ? 1 : 0)} ms`;
  targetOutput.value = `${Math.round(values.targetCurrent * 100)}%`;
  volumeOutput.value = `${Math.round(Number(volumeInput.value) * 100)}%`;
  const sourceName = selectedSource() === "pwm" ? "PWM" : "Poisson";
  scopeSourceOutput.textContent = `${sourceName} · min/max-preserving`;
  audioSourceOutput.textContent = `${sourceName} · post-DC · before Output Level`;
}

function configureRunningEngine() {
  const monitorChanged = lastMonitorSource !== selectedSource();
  lastMonitorSource = selectedSource();
  updateControlLabels();
  workletNode?.port.postMessage({ type: "configure", settings: settings() });
  if (monitorChanged) {
    currentScope.clear();
    audioScope.clear();
    scopeRenderLoop.wake();
  }
  if (running) {
    statusOutput.value = `Both running · monitoring ${selectedSource() === "pwm" ? "PWM" : "Poisson"}`;
  }
  if (monitorGain && audioContext) {
    const level = soundInput.checked ? Number(volumeInput.value) : 0;
    monitorGain.gain.setTargetAtTime(level, audioContext.currentTime, 0.01);
  }
}

function clearLeds() {
  for (const bank of Object.values(ledBanks)) {
    bank.leds.forEach((led, index) => {
      led.style.setProperty("--level", "0");
      led.setAttribute("aria-valuenow", "0");
      if (bank.values[index]) bank.values[index].value = "0.0% mean";
    });
  }
  meanOutput.value = "0.0%";
  rmsOutput.value = "0.0%";
  peakOutput.value = "0.0%";
  limitOutput.value = "0.00%";
  observedRateLabel.textContent = selectedSource() === "pwm"
    ? "PWM rising edges"
    : "Poisson Arrivals";
  arrivalOutput.value = "0/s";
}

function createScope(canvas, { minimum, maximum, color, center = null }) {
  const context = canvas.getContext("2d");
  let ring = new Float32Array(48_000);
  let write = 0;
  let filled = 0;

  function append(samples, sampleRate) {
    if (ring.length !== Math.round(sampleRate * SCOPE_SECONDS)) {
      ring = new Float32Array(Math.round(sampleRate * SCOPE_SECONDS));
      write = 0;
      filled = 0;
    }
    for (const sample of samples) {
      ring[write] = sample;
      write = (write + 1) % ring.length;
      filled = Math.min(ring.length, filled + 1);
    }
  }

  function valueAt(index) {
    const start = (write - filled + ring.length) % ring.length;
    return ring[(start + index) % ring.length];
  }

  function draw() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#070b0a";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(120, 159, 154, .13)";
    context.lineWidth = ratio;
    for (let line = 0; line <= 4; line += 1) {
      const y = line * height / 4;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    for (let line = 0; line <= 8; line += 1) {
      const x = line * width / 8;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    if (center !== null) {
      const centerY = height - (center - minimum) / (maximum - minimum) * height;
      context.strokeStyle = "rgba(105, 229, 220, .38)";
      context.beginPath();
      context.moveTo(0, centerY);
      context.lineTo(width, centerY);
      context.stroke();
    }

    if (filled === 0) return;
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, ratio);
    context.beginPath();
    for (let pixel = 0; pixel < width; pixel += 1) {
      const start = Math.floor(pixel * filled / width);
      const end = Math.max(start + 1, Math.floor((pixel + 1) * filled / width));
      let localMinimum = Infinity;
      let localMaximum = -Infinity;
      for (let sample = start; sample < end; sample += 1) {
        const value = valueAt(sample);
        localMinimum = Math.min(localMinimum, value);
        localMaximum = Math.max(localMaximum, value);
      }
      const x = pixel + 0.5;
      const yMaximum = height - (localMaximum - minimum) / (maximum - minimum) * height;
      const yMinimum = height - (localMinimum - minimum) / (maximum - minimum) * height;
      context.moveTo(x, yMaximum);
      context.lineTo(x, yMinimum);
    }
    context.stroke();
  }

  function clear() {
    ring.fill(0);
    write = 0;
    filled = 0;
  }

  return Object.freeze({ append, clear, draw });
}

const currentScope = createScope(currentCanvas, {
  minimum: 0,
  maximum: 1,
  color: "#d7ff73",
});
const audioScope = createScope(audioCanvas, {
  minimum: -1,
  maximum: 1,
  center: 0,
  color: "#69e5dc",
});

const scopeRenderLoop = createRenderLoop({
  draw: () => {
    currentScope.draw();
    audioScope.draw();
  },
  isActive: () => false,
  requestFrame: callback => requestAnimationFrame(callback),
  framesPerSecond: 30,
});

function renderBank(name, condition) {
  const bank = ledBanks[name];
  condition.levels.forEach((level, index) => {
    const bounded = Math.min(1, Math.max(0, level));
    bank?.leds[index]?.style.setProperty("--level", bounded.toFixed(5));
    bank?.leds[index]?.setAttribute("aria-valuenow", String(Math.round(bounded * 100)));
    if (bank?.values[index]) bank.values[index].value = `${(bounded * 100).toFixed(1)}% mean`;
  });
}

function renderCurrentFrame(message) {
  for (const [name, condition] of Object.entries(message.conditions)) {
    renderBank(name, condition);
  }
  const monitored = message.conditions[message.monitorSource];
  const engine = message.engine.conditions[message.monitorSource];
  currentScope.append(monitored.scope, engine.sampleRate);
  audioScope.append(monitored.audioScope, engine.sampleRate);
  scopeRenderLoop.wake();
  const aggregate = 8;
  meanOutput.value = `${(monitored.levels[aggregate] * 100).toFixed(1)}%`;
  rmsOutput.value = `${(monitored.modulationRms[aggregate] * 100).toFixed(2)}%`;
  peakOutput.value = `${(monitored.peaks[aggregate] * 100).toFixed(1)}%`;
  limitOutput.value = `${(monitored.nearLimitFraction * 100).toFixed(3)}%`;
  observedRateLabel.textContent = monitored.eventKind;
  arrivalOutput.value = `${Math.round(monitored.eventCount * engine.sampleRate / message.sampleCount).toLocaleString()}/s`;
}

async function start() {
  if (running) return;
  audioContext = new AudioContext({ sampleRate: 48_000, latencyHint: "interactive" });
  await audioContext.audioWorklet.addModule(new URL("./led-lab-worklet.js", import.meta.url));
  workletNode = new AudioWorkletNode(audioContext, "poisson-led-lab", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: settings(),
  });
  monitorGain = audioContext.createGain();
  monitorGain.gain.value = soundInput.checked ? Number(volumeInput.value) : 0;
  workletNode.port.onmessage = ({ data }) => {
    if (data?.type === "current-frame" && running) renderCurrentFrame(data);
  };
  workletNode.connect(monitorGain).connect(audioContext.destination);
  await audioContext.resume();
  running = true;
  instrument.dataset.running = "true";
  startButton.textContent = "Stop field";
  statusOutput.value = `Both running · monitoring ${selectedSource() === "pwm" ? "PWM" : "Poisson"}`;
}

async function stop() {
  if (!running && !audioContext) return;
  running = false;
  instrument.dataset.running = "false";
  startButton.textContent = "Start field";
  statusOutput.value = "Stopped · zero current";
  workletNode?.port.postMessage({ type: "stop" });
  workletNode?.disconnect();
  monitorGain?.disconnect();
  workletNode = null;
  monitorGain = null;
  const contextToClose = audioContext;
  audioContext = null;
  await contextToClose?.close();
  currentScope.clear();
  audioScope.clear();
  clearLeds();
  scopeRenderLoop.wake();
}

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  try {
    if (running) await stop();
    else await start();
  } catch (error) {
    statusOutput.value = `Unavailable · ${error.message}`;
    await stop();
  } finally {
    startButton.disabled = false;
  }
});

for (const input of [
  ...sourceInputs,
  rateInput,
  pulseInput,
  targetInput,
  soundInput,
  volumeInput,
]) {
  input.addEventListener("input", configureRunningEngine);
  input.addEventListener("change", configureRunningEngine);
}

window.addEventListener("pagehide", () => {
  if (running) stop();
});

updateControlLabels();
clearLeds();
scopeRenderLoop.wake();

for (const [name, bank] of Object.entries(ledBanks)) {
  bank.leds.forEach((led, index) => {
    led.setAttribute("aria-label", `${name === "pwm" ? "PWM" : "Poisson"} ${CHANNEL_NAMES[index]} frame-mean current`);
  });
}
