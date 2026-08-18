import { createPoissonEngine } from "./poisson-engine.js";
import { sampleLedOutput } from "./led-renderer.js";
import { createRainImpact } from "./rain-impact.js";
import { calculateAcousticPropagation } from "./acoustic-propagation.js";
import { createRenderLoop } from "./render-loop.js";
import { analyzeSignal } from "./signal-analysis.js";
import { calculateSourceMix } from "./source-mix.js";
import {
  BUNDLED_RAIN_REFERENCE,
  loadBundledRainReference,
  prepareRainReference,
} from "./rain-reference.js";
import {
  renderEmptySignal,
  renderSignalSpectrogram,
  renderSignalWaveform,
  renderSpectrumComparison,
} from "./signal-visualizer.js";

const CHANNELS = [
  { name: "Violet", short: "VI", color: "#936cff" },
  { name: "Royal Blue", short: "RB", color: "#356dff" },
  { name: "Cyan", short: "CY", color: "#35d9df" },
  { name: "Green", short: "GR", color: "#4ee883" },
  { name: "PC Lime", short: "LI", color: "#c6ef67" },
  { name: "PC Amber", short: "AM", color: "#ffb347" },
  { name: "Red", short: "RE", color: "#ff514c" },
  { name: "Deep Red", short: "DR", color: "#cf1735" },
];
const SCHEDULER_TICK_MS = 16;
const AUDIO_LOOKAHEAD_MS = 50;
const MAX_EVENTS_PER_TICK = 2500;
const MAX_EVENT_MARKS_PER_SECOND = 30;
const RAIN_IMPACT_VARIANTS = 128;
const LISTENING_FIELD_RADIUS_METERS = 20;
const EAR_HEIGHT_METERS = 1.5;
const ANALYSIS_SAMPLE_RATE = 48_000;
const REFERENCE_FILE_LIMIT_BYTES = 25 * 1024 * 1024;

const leds = [...document.querySelectorAll("[data-led]")];
const startButton = document.querySelector("#start-stop");
const reseedButton = document.querySelector("#reseed");
const rateInput = document.querySelector("#rate");
const couplingInput = document.querySelector("#coupling");
const volumeInput = document.querySelector("#output-level");
const sourceMixInput = document.querySelector("#source-mix");
const soundInput = document.querySelector("#sound-enabled");
const rateOutput = document.querySelector("#rate-output");
const couplingOutput = document.querySelector("#coupling-output");
const volumeOutput = document.querySelector("#output-level-output");
const sourceMixOutput = document.querySelector("#source-mix-output");
const liveRateOutput = document.querySelector("#live-rate");
const eventCountOutput = document.querySelector("#event-count");
const seedOutput = document.querySelector("#seed-output");
const eventField = document.querySelector("#event-field");
const simulator = document.querySelector('[data-anchor="interactive-prototype"]');
const waveformCanvas = document.querySelector("#output-waveform");
const waveformContext = waveformCanvas.getContext("2d");
const rmsOutput = document.querySelector("#rms-output");
const peakOutput = document.querySelector("#peak-output");
const sampleRateOutput = document.querySelector("#sample-rate-output");
const scopeWindowOutput = document.querySelector("#scope-window-output");
const referenceInput = document.querySelector("#rain-reference");
const referenceStatus = document.querySelector("#reference-status");
const referenceCard = document.querySelector("#reference-analysis-card");
const referenceFilename = document.querySelector("#reference-filename");
const generatedAnalysisWaveform = document.querySelector("#generated-analysis-waveform");
const generatedAnalysisSpectrogram = document.querySelector("#generated-analysis-spectrogram");
const referenceAnalysisWaveform = document.querySelector("#reference-analysis-waveform");
const referenceAnalysisSpectrogram = document.querySelector("#reference-analysis-spectrogram");
const comparisonSpectrum = document.querySelector("#comparison-spectrum");
const generatedCentroid = document.querySelector("#generated-centroid");
const generatedHighBand = document.querySelector("#generated-high-band");
const generatedFlatness = document.querySelector("#generated-flatness");
const referenceCentroid = document.querySelector("#reference-centroid");
const referenceHighBand = document.querySelector("#reference-high-band");
const referenceFlatness = document.querySelector("#reference-flatness");

let seed = "steady-rain-01";
let engine = null;
let running = false;
let timer = null;
let simulationStartedAt = 0;
let audioTimelineStartedAt = 0;
let nextScheduledEvent = null;
let scheduledArrivals = [];
let eventCount = 0;
let activePulses = [];
let audioContext = null;
let masterGain = null;
let referenceGain = null;
let masterCompressor = null;
let outputGain = null;
let outputAnalyser = null;
let waveformBuffer = null;
let rainImpactBuffers = [];
let amazonReferenceBuffer = null;
let amazonReferenceSource = null;
const generatedReferenceSamples = createRainImpact({
  sampleRate: ANALYSIS_SAMPLE_RATE,
  seed: 42,
});
const generatedReferenceAnalysis = analyzeSignal(
  generatedReferenceSamples,
  ANALYSIS_SAMPLE_RATE,
);
let measuredReferenceSamples = null;
let measuredReferenceAnalysis = null;
let comparisonResizeTimer = null;
let referenceLoadRequest = 0;
const renderLoop = createRenderLoop({
  draw: renderFrame,
  isActive: () => (
    running || scheduledArrivals.length > 0 || activePulses.length > 0
  ),
  requestFrame: callback => requestAnimationFrame(callback),
  framesPerSecond: 30,
});

function settings() {
  return {
    seed,
    rateHz: selectedRateHz(),
    coupling: Number(couplingInput.value),
    fieldRadiusMeters: LISTENING_FIELD_RADIUS_METERS,
  };
}

function selectedRateHz() {
  return 10 ** Number(rateInput.value);
}

function formatRate(rateHz) {
  if (rateHz < 10) return rateHz.toFixed(2);
  if (rateHz < 100) return rateHz.toFixed(1);
  return Math.round(rateHz).toLocaleString("en-US");
}

function restartEngine() {
  engine = createPoissonEngine(settings());
  nextScheduledEvent = engine.next();
  simulationStartedAt = performance.now();
  audioTimelineStartedAt = audioContext?.currentTime ?? 0;
  scheduledArrivals = [];
  clearTimeout(timer);
  if (running) scheduleNext();
  renderLoop.wake();
}

function updateControlReadouts() {
  const rateHz = selectedRateHz();
  rateOutput.value = `${formatRate(rateHz)} events/s`;
  rateInput.setAttribute("aria-valuetext", `${formatRate(rateHz)} events per second`);
  couplingOutput.value = `${Math.round(Number(couplingInput.value) * 100)}%`;
  volumeOutput.value = `${Math.round(Number(volumeInput.value) * 100)}%`;
  const referencePercent = Math.round(Number(sourceMixInput.value) * 100);
  const generatedPercent = 100 - referencePercent;
  sourceMixOutput.value = referencePercent === 0
    ? "Generated only"
    : referencePercent === 100
      ? "Amazon only"
      : `${generatedPercent} / ${referencePercent}`;
  sourceMixInput.setAttribute(
    "aria-valuetext",
    referencePercent === 0
      ? "Generated only"
      : referencePercent === 100
        ? "Amazon recording only"
        : `${generatedPercent} percent generated, ${referencePercent} percent Amazon recording`,
  );
}

function updateRate() {
  updateControlReadouts();
  restartEngine();
}

function updateOutputLevel() {
  updateControlReadouts();
  if (!audioContext || !outputGain) return;
  outputGain.gain.setTargetAtTime(Number(volumeInput.value), audioContext.currentTime, 0.018);
}

function startAmazonPlayback() {
  if (
    amazonReferenceSource ||
    !running ||
    !soundInput.checked ||
    Number(sourceMixInput.value) <= 0 ||
    !audioContext ||
    !referenceGain ||
    !amazonReferenceBuffer
  ) return;

  const source = audioContext.createBufferSource();
  source.buffer = amazonReferenceBuffer;
  source.loop = true;
  source.connect(referenceGain);
  source.addEventListener("ended", () => {
    if (amazonReferenceSource === source) amazonReferenceSource = null;
  }, { once: true });
  amazonReferenceSource = source;
  source.start(audioContext.currentTime);
}

function stopAmazonPlayback() {
  if (!amazonReferenceSource) return;
  const source = amazonReferenceSource;
  amazonReferenceSource = null;
  source.stop();
  source.disconnect();
}

function updateSourceMix() {
  updateControlReadouts();
  if (!audioContext || !masterGain || !referenceGain) return;

  const mix = soundInput.checked
    ? calculateSourceMix(sourceMixInput.value)
    : { generatedGain: 0, referenceGain: 0 };
  masterGain.gain.setTargetAtTime(mix.generatedGain, audioContext.currentTime, 0.025);
  referenceGain.gain.setTargetAtTime(mix.referenceGain, audioContext.currentTime, 0.025);

  if (mix.referenceGain > 0) startAmazonPlayback();
  else stopAmazonPlayback();
}

function formatDecibels(value) {
  if (value < 0.00001) return "−∞ dBFS";
  return `${(20 * Math.log10(value)).toFixed(1)} dBFS`;
}

function formatAnalysisFrequency(frequencyHz) {
  if (frequencyHz >= 1_000) return `${(frequencyHz / 1_000).toFixed(2)} kHz`;
  return `${Math.round(frequencyHz)} Hz`;
}

function setAnalysisMetrics(analysis, elements) {
  elements.centroid.textContent = formatAnalysisFrequency(analysis.spectralCentroidHz);
  elements.highBand.textContent = `${(analysis.highBandEnergyRatio * 100).toFixed(1)}%`;
  elements.flatness.textContent = analysis.spectralFlatness.toFixed(3);
}

function renderAnalysisComparison() {
  renderSignalWaveform(generatedAnalysisWaveform, generatedReferenceSamples, "#d9ff86");
  renderSignalSpectrogram(generatedAnalysisSpectrogram, generatedReferenceAnalysis);
  setAnalysisMetrics(generatedReferenceAnalysis, {
    centroid: generatedCentroid,
    highBand: generatedHighBand,
    flatness: generatedFlatness,
  });

  const spectrumSeries = [{
    analysis: generatedReferenceAnalysis,
    color: "#d9ff86",
  }];

  if (measuredReferenceSamples && measuredReferenceAnalysis) {
    renderSignalWaveform(referenceAnalysisWaveform, measuredReferenceSamples, "#54dce3");
    renderSignalSpectrogram(referenceAnalysisSpectrogram, measuredReferenceAnalysis);
    setAnalysisMetrics(measuredReferenceAnalysis, {
      centroid: referenceCentroid,
      highBand: referenceHighBand,
      flatness: referenceFlatness,
    });
    spectrumSeries.push({
      analysis: measuredReferenceAnalysis,
      color: "#54dce3",
    });
  } else {
    renderEmptySignal(referenceAnalysisWaveform, "Loading scientific Rain Reference");
    renderEmptySignal(referenceAnalysisSpectrogram, "Measured impact will appear here");
  }

  renderSpectrumComparison(comparisonSpectrum, spectrumSeries);
}

async function decodeReferenceAudio(arrayBuffer) {
  const DecodeContext = window.AudioContext || window.webkitAudioContext;
  if (!DecodeContext) throw new Error("This browser cannot decode audio files.");

  const decodeContext = new DecodeContext();
  try {
    return await decodeContext.decodeAudioData(arrayBuffer);
  } finally {
    await decodeContext.close();
  }
}

function applyPreparedRainReference(prepared, filename, status) {
  measuredReferenceSamples = prepared.samples;
  measuredReferenceAnalysis = prepared.analysis;
  referenceFilename.textContent = filename;
  referenceStatus.dataset.state = "ready";
  referenceStatus.textContent = status;
  renderAnalysisComparison();
}

async function analyzeBundledRainReference() {
  const request = ++referenceLoadRequest;
  referenceCard.setAttribute("aria-busy", "true");
  referenceStatus.dataset.state = "loading";
  referenceStatus.textContent = "Loading the bundled Amazon forest recording…";

  try {
    const prepared = await loadBundledRainReference({
      decodeAudioData: decodeReferenceAudio,
    });
    if (request !== referenceLoadRequest) return;
    amazonReferenceBuffer = prepared.decodedAudio;
    sourceMixInput.disabled = false;
    startAmazonPlayback();
    applyPreparedRainReference(
      prepared,
      BUNDLED_RAIN_REFERENCE.title,
      `Scientific light-rain reference ready. Strongest impact found at ${prepared.peakSeconds.toFixed(3)} s; analysis is silent.`,
    );
  } catch (error) {
    if (request !== referenceLoadRequest) return;
    referenceStatus.dataset.state = "error";
    referenceStatus.textContent = "The bundled reference could not be loaded. You can still choose a local recording.";
    console.error(error);
  } finally {
    if (request === referenceLoadRequest) {
      referenceCard.setAttribute("aria-busy", "false");
    }
  }
}

async function analyzeRainReference(file) {
  const request = ++referenceLoadRequest;
  referenceCard.setAttribute("aria-busy", "true");
  referenceStatus.dataset.state = "loading";
  referenceStatus.textContent = "Decoding and locating the strongest impact…";

  try {
    if (file.size > REFERENCE_FILE_LIMIT_BYTES) {
      throw new Error("Choose an audio file smaller than 25 MB.");
    }
    const decoded = await decodeReferenceAudio(await file.arrayBuffer());
    const prepared = prepareRainReference(decoded);
    if (request !== referenceLoadRequest) return;
    applyPreparedRainReference(
      prepared,
      file.name,
      `Local override ready. Strongest impact found at ${prepared.peakSeconds.toFixed(3)} s; the file remains local and silent.`,
    );
  } catch (error) {
    if (request !== referenceLoadRequest) return;
    referenceStatus.dataset.state = "error";
    referenceStatus.textContent = error instanceof Error
      ? error.message
      : "The selected recording could not be analyzed.";
  } finally {
    if (request === referenceLoadRequest) {
      referenceCard.setAttribute("aria-busy", "false");
    }
  }
}

function sizeWaveformCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, waveformCanvas.clientWidth);
  const height = Math.max(1, waveformCanvas.clientHeight);
  const renderWidth = Math.round(width * pixelRatio);
  const renderHeight = Math.round(height * pixelRatio);

  if (waveformCanvas.width !== renderWidth || waveformCanvas.height !== renderHeight) {
    waveformCanvas.width = renderWidth;
    waveformCanvas.height = renderHeight;
  }

  waveformContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { width, height };
}

function renderWaveform() {
  const { width, height } = sizeWaveformCanvas();
  waveformContext.clearRect(0, 0, width, height);

  waveformContext.strokeStyle = "rgba(151, 170, 137, 0.13)";
  waveformContext.lineWidth = 1;
  waveformContext.beginPath();
  for (let division = 1; division < 8; division += 1) {
    const x = (width / 8) * division;
    waveformContext.moveTo(x, 0);
    waveformContext.lineTo(x, height);
  }
  for (let division = 1; division < 4; division += 1) {
    const y = (height / 4) * division;
    waveformContext.moveTo(0, y);
    waveformContext.lineTo(width, y);
  }
  waveformContext.stroke();

  if (!outputAnalyser || !waveformBuffer) {
    waveformContext.strokeStyle = "rgba(199, 238, 114, 0.35)";
    waveformContext.beginPath();
    waveformContext.moveTo(0, height / 2);
    waveformContext.lineTo(width, height / 2);
    waveformContext.stroke();
    return;
  }

  outputAnalyser.getFloatTimeDomainData(waveformBuffer);
  let peak = 0;
  let energy = 0;
  for (const sample of waveformBuffer) {
    const magnitude = Math.abs(sample);
    peak = Math.max(peak, magnitude);
    energy += sample * sample;
  }
  const rms = Math.sqrt(energy / waveformBuffer.length);
  rmsOutput.textContent = formatDecibels(rms);
  peakOutput.textContent = formatDecibels(peak);

  let triggerIndex = 0;
  for (let index = 1; index < waveformBuffer.length / 2; index += 1) {
    if (waveformBuffer[index - 1] < 0 && waveformBuffer[index] >= 0) {
      triggerIndex = index;
      break;
    }
  }

  const trace = waveformContext.createLinearGradient(0, 0, width, 0);
  trace.addColorStop(0, "#7ea84c");
  trace.addColorStop(0.5, "#d9ff86");
  trace.addColorStop(1, "#8cad62");
  waveformContext.strokeStyle = trace;
  waveformContext.shadowColor = "rgba(199, 238, 114, 0.75)";
  waveformContext.shadowBlur = 7;
  waveformContext.lineWidth = 1.6;
  waveformContext.beginPath();
  const availableSamples = waveformBuffer.length - triggerIndex;
  const sampleStride = Math.max(
    1,
    Math.floor(availableSamples / Math.max(1, Math.floor(width))),
  );
  for (let index = 0; index < availableSamples; index += sampleStride) {
    const sample = waveformBuffer[triggerIndex + index];
    const x = (index / Math.max(1, availableSamples - 1)) * width;
    const y = height / 2 - sample * height * 0.43;
    if (index === 0) waveformContext.moveTo(x, y);
    else waveformContext.lineTo(x, y);
  }
  waveformContext.stroke();
  waveformContext.shadowBlur = 0;
}

function renderFrame(now) {
  while (scheduledArrivals[0]?.startedAt <= now) {
    const scheduled = scheduledArrivals.shift();
    activateArrival(scheduled.event, scheduled.startedAt);
  }

  const output = sampleLedOutput(activePulses, now, CHANNELS.length);
  activePulses = output.activePulses;

  leds.forEach((led, index) => {
    const level = Math.min(1, output.levels[index]);
    led.style.setProperty("--level", level.toFixed(3));
    led.setAttribute("aria-valuenow", Math.round(level * 100));
  });

  renderWaveform();
}

function ensureAudio() {
  if (audioContext) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    soundInput.checked = false;
    soundInput.disabled = true;
    return;
  }

  audioContext = new AudioContext();
  masterGain = audioContext.createGain();
  referenceGain = audioContext.createGain();
  masterCompressor = audioContext.createDynamicsCompressor();
  outputGain = audioContext.createGain();
  outputAnalyser = audioContext.createAnalyser();
  outputAnalyser.fftSize = 2048;
  waveformBuffer = new Float32Array(outputAnalyser.fftSize);
  rainImpactBuffers = Array.from({ length: RAIN_IMPACT_VARIANTS }, (_, index) => {
    const samples = createRainImpact({ sampleRate: audioContext.sampleRate, seed: index + 1 });
    const buffer = audioContext.createBuffer(1, samples.length, audioContext.sampleRate);
    buffer.copyToChannel(samples, 0);
    return buffer;
  });
  const mix = calculateSourceMix(sourceMixInput.value);
  masterGain.gain.value = soundInput.checked ? mix.generatedGain : 0;
  referenceGain.gain.value = soundInput.checked ? mix.referenceGain : 0;
  outputGain.gain.value = Number(volumeInput.value);
  masterCompressor.threshold.value = -12;
  masterCompressor.knee.value = 8;
  masterCompressor.ratio.value = 4;
  masterCompressor.attack.value = 0.004;
  masterCompressor.release.value = 0.24;
  masterGain.connect(masterCompressor);
  referenceGain.connect(masterCompressor);
  masterCompressor
    .connect(outputGain)
    .connect(outputAnalyser)
    .connect(audioContext.destination);
  sampleRateOutput.textContent = `${(audioContext.sampleRate / 1000).toFixed(1)} kHz`;
  scopeWindowOutput.textContent = `${((outputAnalyser.fftSize / audioContext.sampleRate) * 1000).toFixed(1)} ms`;
}

function playEvent(event, scheduledAt) {
  if (
    !soundInput.checked ||
    Number(sourceMixInput.value) >= 1 ||
    !audioContext ||
    !masterGain
  ) return;

  const startTime = Math.max(audioContext.currentTime, scheduledAt);
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  const panner = typeof audioContext.createStereoPanner === "function"
    ? audioContext.createStereoPanner()
    : null;
  const bufferIndex = Math.imul(event.id, 2654435761) >>> 0;
  const densityNormalization = Math.min(1, Math.sqrt(12 / Math.max(12, event.rateHz)));
  const propagation = calculateAcousticPropagation(event.position, {
    earHeightMeters: EAR_HEIGHT_METERS,
  });

  source.buffer = rainImpactBuffers[bufferIndex % rainImpactBuffers.length];
  gain.gain.setValueAtTime(
    (0.12 + event.amplitude * 0.28) *
      densityNormalization *
      propagation.relativePressure,
    startTime,
  );
  source.connect(gain);
  if (panner) {
    panner.pan.setValueAtTime(propagation.stereoPan, startTime);
    gain.connect(panner).connect(masterGain);
  } else {
    gain.connect(masterGain);
  }
  source.start(startTime);
}

function renderEventMark(event) {
  const markStride = Math.max(1, Math.ceil(event.rateHz / MAX_EVENT_MARKS_PER_SECOND));
  if (event.id % markStride !== 0) return;

  const strongest = event.channelWeights.indexOf(Math.max(...event.channelWeights));
  const mark = document.createElement("span");
  mark.className = "event-mark";
  mark.style.setProperty(
    "--event-color",
    event.route === "shared" ? "#d9ff86" : CHANNELS[strongest].color,
  );
  mark.style.setProperty("--event-x", `${8 + ((event.id * 37) % 85)}%`);
  mark.style.setProperty("--event-size", `${3 + event.amplitude * 7}px`);
  eventField.append(mark);
  mark.addEventListener("animationend", () => mark.remove(), { once: true });
}

function activateArrival(event, startedAt) {
  eventCount += 1;
  eventCountOutput.textContent = String(eventCount).padStart(4, "0");
  liveRateOutput.textContent = event.rateHz.toFixed(2);
  activePulses.push({ ...event, startedAt });
  renderEventMark(event);
}

function scheduleNext() {
  if (!running) return;
  const elapsedSeconds = (
    performance.now() - simulationStartedAt + AUDIO_LOOKAHEAD_MS
  ) / 1000;
  let emittedThisTick = 0;

  while (
    nextScheduledEvent.at <= elapsedSeconds &&
    emittedThisTick < MAX_EVENTS_PER_TICK
  ) {
    const startedAt = simulationStartedAt + nextScheduledEvent.at * 1000;
    scheduledArrivals.push({ event: nextScheduledEvent, startedAt });
    playEvent(nextScheduledEvent, audioTimelineStartedAt + nextScheduledEvent.at);
    nextScheduledEvent = engine.next();
    emittedThisTick += 1;
  }

  timer = window.setTimeout(scheduleNext, SCHEDULER_TICK_MS);
}

async function toggleRunning() {
  if (!running) {
    ensureAudio();
    if (audioContext?.state === "suspended") await audioContext.resume();
    running = true;
    simulator.dataset.running = "true";
    startButton.textContent = "Stop process";
    startButton.setAttribute("aria-pressed", "true");
    restartEngine();
    updateSourceMix();
    startAmazonPlayback();
    return;
  }

  running = false;
  scheduledArrivals = [];
  simulator.dataset.running = "false";
  startButton.textContent = "Start process";
  startButton.setAttribute("aria-pressed", "false");
  clearTimeout(timer);
  stopAmazonPlayback();
  renderLoop.wake();
}

function reseed() {
  seed = `rain-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
  seedOutput.textContent = seed;
  eventCount = 0;
  eventCountOutput.textContent = "0000";
  activePulses = [];
  restartEngine();
}

startButton.addEventListener("click", toggleRunning);
reseedButton.addEventListener("click", reseed);
rateInput.addEventListener("input", updateRate);
couplingInput.addEventListener("input", updateControlReadouts);
volumeInput.addEventListener("input", updateOutputLevel);
sourceMixInput.addEventListener("input", updateSourceMix);
soundInput.addEventListener("change", async () => {
  ensureAudio();
  if (soundInput.checked && audioContext?.state === "suspended") {
    await audioContext.resume();
  }
  updateSourceMix();
  if (soundInput.checked) startAmazonPlayback();
  else stopAmazonPlayback();
});
couplingInput.addEventListener("change", restartEngine);
referenceInput.addEventListener("change", () => {
  const [file] = referenceInput.files;
  if (file) analyzeRainReference(file);
});
window.addEventListener("resize", () => {
  clearTimeout(comparisonResizeTimer);
  comparisonResizeTimer = window.setTimeout(renderAnalysisComparison, 120);
});

updateControlReadouts();
seedOutput.textContent = seed;
renderAnalysisComparison();
renderLoop.wake();
void analyzeBundledRainReference();
