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
const leds = [...document.querySelectorAll("[data-current-led]")];
const ledValues = [...document.querySelectorAll("[data-current-value]")];
const canvas = document.querySelector("#current-scope");
const context = canvas.getContext("2d");

let audioContext = null;
let workletNode = null;
let monitorGain = null;
let running = false;
let scopeRing = new Float32Array(48_000);
let scopeWrite = 0;
let scopeFilled = 0;

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
    rateHz: rateFromControl(),
    pulseWidthMs: pulseWidthFromControl(),
    targetCurrent: Number(targetInput.value) / 100,
  };
}

function updateControlLabels() {
  const values = settings();
  rateOutput.value = `${values.rateHz.toLocaleString()} Arrivals/s`;
  channelRateOutput.value = `${formatRate(values.rateHz / 8)} expected per Channel`;
  pulseOutput.value = values.pulseWidthMs < 1
    ? `${values.pulseWidthMs.toFixed(2)} ms`
    : `${values.pulseWidthMs.toFixed(values.pulseWidthMs < 10 ? 1 : 0)} ms`;
  targetOutput.value = `${Math.round(values.targetCurrent * 100)}%`;
  volumeOutput.value = `${Math.round(Number(volumeInput.value) * 100)}%`;
}

function configureRunningEngine() {
  updateControlLabels();
  workletNode?.port.postMessage({ type: "configure", settings: settings() });
  if (monitorGain && audioContext) {
    const level = soundInput.checked ? Number(volumeInput.value) : 0;
    monitorGain.gain.setTargetAtTime(level, audioContext.currentTime, 0.01);
  }
}

function clearLeds() {
  leds.forEach((led, index) => {
    led.style.setProperty("--level", "0");
    led.setAttribute("aria-valuenow", "0");
    if (ledValues[index]) ledValues[index].value = "0.0% mean";
  });
  meanOutput.value = "0.0%";
  rmsOutput.value = "0.0%";
  peakOutput.value = "0.0%";
  limitOutput.value = "0.00%";
  arrivalOutput.value = "0/s";
}

function appendScope(samples, sampleRate) {
  if (scopeRing.length !== Math.round(sampleRate * SCOPE_SECONDS)) {
    scopeRing = new Float32Array(Math.round(sampleRate * SCOPE_SECONDS));
    scopeWrite = 0;
    scopeFilled = 0;
  }
  for (const sample of samples) {
    scopeRing[scopeWrite] = sample;
    scopeWrite = (scopeWrite + 1) % scopeRing.length;
    scopeFilled = Math.min(scopeRing.length, scopeFilled + 1);
  }
}

function currentAt(index) {
  const start = (scopeWrite - scopeFilled + scopeRing.length) % scopeRing.length;
  return scopeRing[(start + index) % scopeRing.length];
}

function resizeCanvas() {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, ratio };
}

function drawScope() {
  const { width, height, ratio } = resizeCanvas();
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

  if (scopeFilled > 0) {
    context.strokeStyle = "#d7ff73";
    context.fillStyle = "rgba(201, 245, 103, .15)";
    context.lineWidth = Math.max(1, ratio);
    context.beginPath();
    for (let pixel = 0; pixel < width; pixel += 1) {
      const start = Math.floor(pixel * scopeFilled / width);
      const end = Math.max(start + 1, Math.floor((pixel + 1) * scopeFilled / width));
      let minimum = 1;
      let maximum = 0;
      for (let sample = start; sample < end; sample += 1) {
        const current = currentAt(sample);
        minimum = Math.min(minimum, current);
        maximum = Math.max(maximum, current);
      }
      const x = pixel + 0.5;
      const yMaximum = height - maximum * height;
      const yMinimum = height - minimum * height;
      context.moveTo(x, yMaximum);
      context.lineTo(x, yMinimum);
    }
    context.stroke();
  }
}

const scopeRenderLoop = createRenderLoop({
  draw: drawScope,
  isActive: () => false,
  requestFrame: callback => requestAnimationFrame(callback),
  framesPerSecond: 30,
});

function renderCurrentFrame(message) {
  appendScope(message.scope, message.engine.sampleRate);
  scopeRenderLoop.wake();
  message.levels.forEach((level, index) => {
    const bounded = Math.min(1, Math.max(0, level));
    leds[index]?.style.setProperty("--level", bounded.toFixed(5));
    leds[index]?.setAttribute("aria-valuenow", String(Math.round(bounded * 100)));
    if (ledValues[index]) ledValues[index].value = `${(bounded * 100).toFixed(1)}% mean`;
  });
  const aggregate = 8;
  meanOutput.value = `${(message.levels[aggregate] * 100).toFixed(1)}%`;
  rmsOutput.value = `${(message.modulationRms[aggregate] * 100).toFixed(2)}%`;
  peakOutput.value = `${(message.peaks[aggregate] * 100).toFixed(1)}%`;
  limitOutput.value = `${(message.nearLimitFraction * 100).toFixed(3)}%`;
  arrivalOutput.value = `${Math.round(message.arrivalCount * message.engine.sampleRate / message.sampleCount).toLocaleString()}/s`;
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
  statusOutput.value = "Running · current owns the signal";
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
  scopeRing.fill(0);
  scopeWrite = 0;
  scopeFilled = 0;
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

for (const input of [rateInput, pulseInput, targetInput, soundInput, volumeInput]) {
  input.addEventListener("input", configureRunningEngine);
  input.addEventListener("change", configureRunningEngine);
}

window.addEventListener("pagehide", () => {
  if (running) stop();
});

updateControlLabels();
clearLeds();
scopeRenderLoop.wake();

leds.forEach((led, index) => {
  led.setAttribute("aria-label", `${CHANNEL_NAMES[index]} frame-mean current`);
});
