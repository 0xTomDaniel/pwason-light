import { createPoissonEngine } from "./poisson-engine.js";
import { createRainControls } from "./rain-controls.js";
import { sampleLedOutput } from "./led-renderer.js";
import { createGeneratedRainRenderer } from "./rain-texture.js";
import { prepareImpactAudition } from "./impact-playback.js";
import { prepareMicroscopeScaling } from "./microscope-scaling.js";
import {
  ACOUSTIC_FACTOR_DEFINITIONS,
  createDefaultAcousticFactors,
  effectiveAcousticFactor,
} from "./acoustic-factors.js";
import { createRenderLoop } from "./render-loop.js";
import {
  analyzeRainField,
  compareRainFieldDiagnostics,
} from "./rain-diagnostics.js";
import { calculateSourceMix } from "./source-mix.js";
import {
  DEFAULT_RAIN_REFERENCE_PROFILE,
  FARNELL_RAIN_REFERENCE,
  RAIN_REFERENCE_PROFILES,
  getRainReferenceProfile,
  loadRainReference,
  prepareRainReference,
  resolveReferenceCalibration,
} from "./rain-reference.js";
import {
  calculateReferenceTimeStretch,
  enablePitchPreservation,
  resolveReferencePlaybackWindow,
} from "./reference-playback.js";
import {
  renderEmptySignal,
  renderDistributionResidual,
  renderOnsetPopulation,
  renderProfileResidual,
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
const MAX_LISTENING_FIELD_RADIUS_METERS = 100;
const EAR_HEIGHT_METERS = 1.5;
const ANALYSIS_SAMPLE_RATE = 48_000;
const GENERATED_PROFILE_SECONDS = 8;
const REFERENCE_FILE_LIMIT_BYTES = 25 * 1024 * 1024;

const leds = [...document.querySelectorAll("[data-led]")];
const startButton = document.querySelector("#start-stop");
const reseedButton = document.querySelector("#reseed");
const rateInput = document.querySelector("#rate");
const dropPopulationInput = document.querySelector("#drop-population");
const speedPopulationLinkInput = document.querySelector("#speed-population-link");
const couplingInput = document.querySelector("#coupling");
const volumeInput = document.querySelector("#output-level");
const sourceMixInput = document.querySelector("#source-mix");
const soundInput = document.querySelector("#sound-enabled");
const rateOutput = document.querySelector("#rate-output");
const dropPopulationOutput = document.querySelector("#drop-population-output");
const couplingOutput = document.querySelector("#coupling-output");
const volumeOutput = document.querySelector("#output-level-output");
const sourceMixOutput = document.querySelector("#source-mix-output");
const referenceProfileSelect = document.querySelector("#reference-profile");
const referenceSpeedOutput = document.querySelector("#reference-speed-output");
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
const referenceProvenance = document.querySelector("#reference-provenance");
const referenceCard = document.querySelector("#reference-analysis-card");
const referenceFilename = document.querySelector("#reference-filename");
const generatedAnalysisWaveform = document.querySelector("#generated-analysis-waveform");
const generatedAnalysisSpectrogram = document.querySelector("#generated-analysis-spectrogram");
const referenceAnalysisWaveform = document.querySelector("#reference-analysis-waveform");
const referenceAnalysisSpectrogram = document.querySelector("#reference-analysis-spectrogram");
const farnellCard = document.querySelector("#farnell-analysis-card");
const farnellFilename = document.querySelector("#farnell-filename");
const farnellAnalysisWaveform = document.querySelector("#farnell-analysis-waveform");
const farnellAnalysisSpectrogram = document.querySelector("#farnell-analysis-spectrogram");
const comparisonSpectrum = document.querySelector("#comparison-spectrum");
const selectedSpectrumLabel = document.querySelector("#selected-spectrum-label");
const generatedCentroid = document.querySelector("#generated-centroid");
const generatedHighBand = document.querySelector("#generated-high-band");
const generatedFlatness = document.querySelector("#generated-flatness");
const generatedCrest = document.querySelector("#generated-crest");
const generatedEnvelopeVariation = document.querySelector("#generated-envelope-variation");
const generatedEnvelopeFloor = document.querySelector("#generated-envelope-floor");
const generatedBandCorrelation = document.querySelector("#generated-band-correlation");
const generatedKurtosis = document.querySelector("#generated-kurtosis");
const generatedEnvelope100 = document.querySelector("#generated-envelope-100");
const generatedProfileLabel = document.querySelector("#generated-profile-label");
const generatedTotalRate = document.querySelector("#generated-total-rate");
const generatedDetectedRate = document.querySelector("#generated-detected-rate");
const referenceCentroid = document.querySelector("#reference-centroid");
const referenceHighBand = document.querySelector("#reference-high-band");
const referenceFlatness = document.querySelector("#reference-flatness");
const referenceCrest = document.querySelector("#reference-crest");
const referenceEnvelopeVariation = document.querySelector("#reference-envelope-variation");
const referenceEnvelopeFloor = document.querySelector("#reference-envelope-floor");
const referenceBandCorrelation = document.querySelector("#reference-band-correlation");
const referenceKurtosis = document.querySelector("#reference-kurtosis");
const referenceEnvelope100 = document.querySelector("#reference-envelope-100");
const referenceDetectedRate = document.querySelector("#reference-detected-rate");
const referenceTotalRate = document.querySelector("#reference-total-rate");
const referenceSpectrumDistance = document.querySelector("#reference-spectrum-distance");
const farnellCentroid = document.querySelector("#farnell-centroid");
const farnellHighBand = document.querySelector("#farnell-high-band");
const farnellFlatness = document.querySelector("#farnell-flatness");
const farnellCrest = document.querySelector("#farnell-crest");
const farnellEnvelopeVariation = document.querySelector("#farnell-envelope-variation");
const farnellEnvelopeFloor = document.querySelector("#farnell-envelope-floor");
const farnellBandCorrelation = document.querySelector("#farnell-band-correlation");
const farnellKurtosis = document.querySelector("#farnell-kurtosis");
const farnellEnvelope100 = document.querySelector("#farnell-envelope-100");
const farnellDetectedRate = document.querySelector("#farnell-detected-rate");
const farnellSpectrumDistance = document.querySelector("#farnell-spectrum-distance");
const farnellWindowDistance = document.querySelector("#farnell-window-distance");
const generatedWindowDistance = document.querySelector("#generated-window-distance");
const referenceWindowDistance = document.querySelector("#reference-window-distance");
const profileResidual = document.querySelector("#profile-residual");
const selectedResidualLabel = document.querySelector("#selected-residual-label");
const selectedDistributionTitle = document.querySelector("#selected-distribution-title");
const selectedDistributionResidual = document.querySelector("#selected-distribution-residual");
const farnellDistributionResidual = document.querySelector("#farnell-distribution-residual");
const selectedDistributionDistance = document.querySelector("#selected-distribution-distance");
const farnellDistributionDistance = document.querySelector("#farnell-distribution-distance");
const generatedImpactWaveform = document.querySelector("#generated-impact-waveform");
const generatedImpactSpectrogram = document.querySelector("#generated-impact-spectrogram");
const generatedImpactLabel = document.querySelector("#generated-impact-label");
const generatedImpactPlayButton = document.querySelector("#generated-impact-play");
const generatedImpactChoiceButtons = [...document.querySelectorAll('[data-impact-source="generated"]')];
const referenceImpactWaveform = document.querySelector("#reference-impact-waveform");
const referenceImpactSpectrogram = document.querySelector("#reference-impact-spectrogram");
const referenceImpactLabel = document.querySelector("#reference-impact-label");
const referenceImpactPlayButton = document.querySelector("#reference-impact-play");
const referenceImpactChoiceButtons = [...document.querySelectorAll('[data-impact-source="reference"]')];
const farnellImpactWaveform = document.querySelector("#farnell-impact-waveform");
const farnellImpactSpectrogram = document.querySelector("#farnell-impact-spectrogram");
const farnellImpactLabel = document.querySelector("#farnell-impact-label");
const farnellImpactPlayButton = document.querySelector("#farnell-impact-play");
const farnellImpactChoiceButtons = [...document.querySelectorAll('[data-impact-source="farnell"]')];
const microscopeScalingInputs = [...document.querySelectorAll('[name="microscope-scaling"]')];
const microscopeScalingNote = document.querySelector("#microscope-scaling-note");
const generatedOnsetPopulation = document.querySelector("#generated-onset-population");
const generatedOnsetPopulationLabel = document.querySelector("#generated-onset-population-label");
const referenceOnsetPopulation = document.querySelector("#reference-onset-population");
const referenceOnsetPopulationLabel = document.querySelector("#reference-onset-population-label");
const farnellOnsetPopulation = document.querySelector("#farnell-onset-population");
const farnellOnsetPopulationLabel = document.querySelector("#farnell-onset-population-label");
const acousticFactorList = document.querySelector("#acoustic-factor-list");
const acousticPresetOutput = document.querySelector("#acoustic-preset-output");
const resetAcousticFactorsButton = document.querySelector("#reset-acoustic-factors");

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
let liveRainRenderer = null;
let rainAudioBufferCache = new WeakMap();
let rainWorkletNode = null;
let activeImpactAuditionSource = null;
let activeImpactAuditionButton = null;
let microscopeScalingMode = microscopeScalingInputs.find(input => input.checked)?.value
  ?? "profile-matched";
let acousticFactors = createDefaultAcousticFactors();
const rainControls = createRainControls({
  speedLog: rateInput.value,
  dropPopulation: dropPopulationInput.value,
  linked: speedPopulationLinkInput.checked,
});
let selectedReferenceProfile = DEFAULT_RAIN_REFERENCE_PROFILE;
let selectedReferenceCalibration = resolveReferenceCalibration(selectedReferenceProfile);
let selectedReferenceReady = false;
let referenceMedia = null;
let referenceMediaSource = null;
let analysisRainRenderer = createGeneratedRainRenderer({
  sampleRate: ANALYSIS_SAMPLE_RATE,
  factors: acousticFactors,
  earHeightMeters: EAR_HEIGHT_METERS,
  dropPopulation: rainControls.snapshot().dropPopulation,
});
let generatedProfileSamples = createCurrentGeneratedProfileSamples();
let generatedDiagnostics = analyzeRainField(
  generatedProfileSamples,
  ANALYSIS_SAMPLE_RATE,
);
let generatedReferenceSamples = generatedDiagnostics.representativeField.samples;
let generatedReferenceAnalysis = generatedDiagnostics.representativeField.analysis;
let generatedProfileAnalysis = generatedDiagnostics.profileAnalysis;
let generatedProfileOnsets = generatedDiagnostics.prominentOnsets;
let generatedImpacts = generatedDiagnostics.impactMicroscopes;
let generatedImpactSelection = 0;
let measuredReferenceDiagnostics = null;
let measuredReferenceSamples = null;
let measuredReferenceAnalysis = null;
let measuredReferenceProfileAnalysis = null;
let measuredReferenceOnsets = null;
let measuredReferenceCalibration = null;
let measuredReferenceImpacts = [];
let measuredReferenceImpactSelection = 0;
let farnellReferenceDiagnostics = null;
let farnellReferenceSamples = null;
let farnellReferenceAnalysis = null;
let farnellReferenceProfileAnalysis = null;
let farnellReferenceOnsets = null;
let farnellReferenceImpacts = [];
let farnellReferenceImpactSelection = 0;
let comparisonResizeTimer = null;
let acousticRegenerationTimer = null;
let acousticWaveformRebuildPending = false;
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
    fieldRadiusMeters: listeningFieldRadiusMeters(),
  };
}

function listeningFieldRadiusMeters() {
  const fieldDepth = effectiveAcousticFactor(acousticFactors, "fieldDepth");
  return fieldDepth === 0
    ? 0
    : 1 + fieldDepth * (MAX_LISTENING_FIELD_RADIUS_METERS - 1);
}

function createCurrentGeneratedProfileSamples() {
  const profileEngine = createPoissonEngine({
    seed: `${selectedReferenceProfile.id}-generated-profile`,
    rateHz: selectedRateHz(),
    coupling: 0,
    fieldRadiusMeters: listeningFieldRadiusMeters(),
  });
  return analysisRainRenderer.renderProfile({
    durationSeconds: GENERATED_PROFILE_SECONDS,
    nextArrival: () => profileEngine.next(),
  });
}

function createAcousticFactorControls() {
  acousticFactorList.replaceChildren();
  let currentGroup = null;
  let groupElement = null;

  for (const definition of ACOUSTIC_FACTOR_DEFINITIONS) {
    if (definition.group !== currentGroup) {
      currentGroup = definition.group;
      groupElement = document.createElement("section");
      groupElement.className = "factor-group";
      const heading = document.createElement("h3");
      heading.textContent = currentGroup;
      groupElement.append(heading);
      acousticFactorList.append(groupElement);
    }

    const row = document.createElement("article");
    row.className = "factor-control";
    row.dataset.factor = definition.id;
    const heading = document.createElement("div");
    heading.className = "factor-heading";
    const switchLabel = document.createElement("label");
    switchLabel.className = "factor-switch";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.setAttribute("role", "switch");
    toggle.checked = acousticFactors[definition.id].enabled;
    toggle.dataset.factorToggle = definition.id;
    toggle.setAttribute("aria-label", `Enable ${definition.label}`);
    const title = document.createElement("span");
    title.textContent = definition.label;
    switchLabel.append(toggle, title);
    const output = document.createElement("output");
    output.dataset.factorOutput = definition.id;
    heading.append(switchLabel, output);

    const range = document.createElement("input");
    range.type = "range";
    range.min = String(definition.min);
    range.max = String(definition.max);
    range.step = String(definition.step);
    range.value = String(acousticFactors[definition.id].amount);
    range.dataset.factorAmount = definition.id;
    range.setAttribute("aria-label", `${definition.label} amount`);
    const description = document.createElement("p");
    description.textContent = definition.description;
    row.append(heading, range, description);
    groupElement.append(row);

    toggle.addEventListener("change", updateAcousticFactor);
    range.addEventListener("input", updateAcousticFactor);
    updateAcousticFactorRow(definition.id);
  }
}

function updateAcousticFactorRow(id) {
  const setting = acousticFactors[id];
  const row = acousticFactorList.querySelector(`[data-factor="${id}"]`);
  const output = acousticFactorList.querySelector(`[data-factor-output="${id}"]`);
  row.dataset.enabled = String(setting.enabled);
  output.value = setting.enabled
    ? `${Math.round(setting.amount * 100)}%`
    : `Off · ${Math.round(setting.amount * 100)}%`;
}

function updateAcousticFactor(event) {
  const id = event.currentTarget.dataset.factorToggle
    ?? event.currentTarget.dataset.factorAmount;
  const toggle = acousticFactorList.querySelector(`[data-factor-toggle="${id}"]`);
  const range = acousticFactorList.querySelector(`[data-factor-amount="${id}"]`);
  acousticFactors[id] = {
    enabled: toggle.checked,
    amount: Number(range.value),
  };
  acousticPresetOutput.textContent = "Custom";
  updateAcousticFactorRow(id);

  if (id === "fieldDepth") restartEngine();
  if (id === "compression") applyCompressionSettings();
  const rebuildRenderer = id !== "fieldDepth" && id !== "compression";
  if (rebuildRenderer) {
    scheduleAcousticRegeneration({ rebuildRenderer });
  } else if (id === "fieldDepth") {
    scheduleAcousticRegeneration();
  }
}

function resetAcousticFactors() {
  acousticFactors = createDefaultAcousticFactors();
  for (const definition of ACOUSTIC_FACTOR_DEFINITIONS) {
    acousticFactorList.querySelector(`[data-factor-toggle="${definition.id}"]`).checked =
      acousticFactors[definition.id].enabled;
    acousticFactorList.querySelector(`[data-factor-amount="${definition.id}"]`).value =
      String(acousticFactors[definition.id].amount);
    updateAcousticFactorRow(definition.id);
  }
  acousticPresetOutput.textContent = "Redwood target";
  applyCompressionSettings();
  restartEngine();
  scheduleAcousticRegeneration({ rebuildRenderer: true });
}

function regenerateAcousticAssets(rebuildRenderer) {
  if (rebuildRenderer) {
    analysisRainRenderer = createGeneratedRainRenderer({
      sampleRate: ANALYSIS_SAMPLE_RATE,
      factors: acousticFactors,
      earHeightMeters: EAR_HEIGHT_METERS,
      dropPopulation: rainControls.snapshot().dropPopulation,
    });
  }
  generatedProfileSamples = createCurrentGeneratedProfileSamples();
  generatedDiagnostics = analyzeRainField(
    generatedProfileSamples,
    ANALYSIS_SAMPLE_RATE,
  );
  generatedReferenceSamples = generatedDiagnostics.representativeField.samples;
  generatedReferenceAnalysis = generatedDiagnostics.representativeField.analysis;
  generatedProfileAnalysis = generatedDiagnostics.profileAnalysis;
  generatedProfileOnsets = generatedDiagnostics.prominentOnsets;
  generatedImpacts = generatedDiagnostics.impactMicroscopes;
  generatedImpactSelection = Math.min(
    generatedImpactSelection,
    Math.max(0, generatedImpacts.length - 1),
  );
  if (rebuildRenderer && audioContext) {
    liveRainRenderer = audioContext.sampleRate === ANALYSIS_SAMPLE_RATE
      ? analysisRainRenderer
      : createGeneratedRainRenderer({
        sampleRate: audioContext.sampleRate,
        factors: acousticFactors,
        earHeightMeters: EAR_HEIGHT_METERS,
        dropPopulation: rainControls.snapshot().dropPopulation,
      });
    rainAudioBufferCache = new WeakMap();
    rainWorkletNode?.port.postMessage({
      type: "configure",
      responses: liveRainRenderer.exportResponseBank(),
    });
  }
  renderAnalysisComparison();
}

function scheduleAcousticRegeneration({ rebuildRenderer = false } = {}) {
  acousticWaveformRebuildPending ||= rebuildRenderer;
  clearTimeout(acousticRegenerationTimer);
  acousticRegenerationTimer = window.setTimeout(() => {
    const shouldRebuildRenderer = acousticWaveformRebuildPending;
    acousticWaveformRebuildPending = false;
    regenerateAcousticAssets(shouldRebuildRenderer);
  }, 120);
}

function applyCompressionSettings() {
  if (!audioContext || !masterCompressor) return;
  const compression = effectiveAcousticFactor(acousticFactors, "compression");
  const now = audioContext.currentTime;
  masterCompressor.threshold.setTargetAtTime(-18 * compression, now, 0.025);
  masterCompressor.knee.setTargetAtTime(10 * compression, now, 0.025);
  masterCompressor.ratio.setTargetAtTime(1 + 5 * compression, now, 0.025);
  masterCompressor.attack.setTargetAtTime(0.002 + 0.006 * compression, now, 0.025);
  masterCompressor.release.setTargetAtTime(0.08 + 0.28 * compression, now, 0.025);
}

function selectedRateHz() {
  return rainControls.snapshot().rateHz;
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
  const controls = rainControls.snapshot();
  const rateHz = controls.rateHz;
  rateInput.value = String(controls.speedLog);
  dropPopulationInput.value = String(controls.dropPopulation);
  speedPopulationLinkInput.checked = controls.linked;
  rateOutput.value = `${formatRate(rateHz)} events/s`;
  rateInput.setAttribute("aria-valuetext", `${formatRate(rateHz)} events per second`);
  couplingOutput.value = `${Math.round(Number(couplingInput.value) * 100)}%`;
  const populationPercent = Math.round(controls.dropPopulation * 100);
  dropPopulationOutput.value = controls.dropPopulation < 0.34
    ? `Fine · ${populationPercent}%`
    : controls.dropPopulation < 0.67
      ? `Mixed · ${populationPercent}%`
      : `Large · ${populationPercent}%`;
  dropPopulationInput.setAttribute(
    "aria-valuetext",
    `${dropPopulationOutput.value} drop population`,
  );
  volumeOutput.value = `${Math.round(Number(volumeInput.value) * 100)}%`;
  const referencePercent = Math.round(Number(sourceMixInput.value) * 100);
  const generatedPercent = 100 - referencePercent;
  sourceMixOutput.value = referencePercent === 0
    ? "Generated only"
    : referencePercent === 100
      ? `${selectedReferenceProfile.shortTitle} only`
      : `${generatedPercent} / ${referencePercent}`;
  sourceMixInput.setAttribute(
    "aria-valuetext",
    referencePercent === 0
      ? "Generated only"
      : referencePercent === 100
        ? `${selectedReferenceProfile.title} only`
        : `${generatedPercent} percent generated, ${referencePercent} percent selected Rain Reference`,
  );
  updateReferenceTimeStretch();
}

function updateRate() {
  rainControls.setSpeedLog(rateInput.value);
  updateControlReadouts();
  restartEngine();
  scheduleAcousticRegeneration({
    rebuildRenderer: rainControls.snapshot().linked,
  });
}

function updateDropPopulation() {
  rainControls.setDropPopulation(dropPopulationInput.value);
  updateControlReadouts();
  if (rainControls.snapshot().linked) restartEngine();
  scheduleAcousticRegeneration({ rebuildRenderer: true });
}

function updateSpeedPopulationLink() {
  rainControls.setLinked(speedPopulationLinkInput.checked);
  updateControlReadouts();
  scheduleAcousticRegeneration({ rebuildRenderer: true });
}

function updateOutputLevel() {
  updateControlReadouts();
  if (!audioContext || !outputGain) return;
  outputGain.gain.setTargetAtTime(Number(volumeInput.value), audioContext.currentTime, 0.018);
}

function updateReferenceTimeStretch() {
  const stretch = calculateReferenceTimeStretch(
    selectedRateHz(),
    selectedReferenceCalibration.comparisonRateHz,
  );
  if (referenceMedia) referenceMedia.playbackRate = stretch.playbackRate;

  const applied = `${stretch.playbackRate.toFixed(2)}×`;
  referenceSpeedOutput.value = stretch.limited
    ? `${applied} ${stretch.requestedRate < stretch.playbackRate ? "clean floor" : "ceiling"} · requested ${stretch.requestedRate.toFixed(2)}×`
    : `${applied} · pitch held`;
  referenceSpeedOutput.dataset.state = stretch.limited ? "limited" : "matched";
  referenceSpeedOutput.setAttribute(
    "aria-label",
    stretch.limited
      ? `Reference playback limited to ${applied}; requested ${stretch.requestedRate.toFixed(2)} times`
      : `Reference playback ${applied} with pitch preserved`,
  );
}

function syncReferenceMediaProfile() {
  if (!referenceMedia || referenceMedia.dataset.profileId === selectedReferenceProfile.id) return;
  referenceMedia.pause();
  referenceMedia.src = selectedReferenceProfile.assetUrl;
  referenceMedia.dataset.profileId = selectedReferenceProfile.id;
  referenceMedia.loop = !resolveReferencePlaybackWindow(
    selectedReferenceProfile,
  ).isBounded;
  referenceMedia.load();
  updateReferenceTimeStretch();
}

function constrainReferencePlaybackToProfile() {
  if (!referenceMedia) return;
  const playbackWindow = resolveReferencePlaybackWindow(selectedReferenceProfile);
  if (!playbackWindow.isBounded) return;
  if (
    referenceMedia.currentTime < playbackWindow.startSeconds
    || referenceMedia.currentTime >= playbackWindow.endSeconds
  ) {
    referenceMedia.currentTime = playbackWindow.startSeconds;
  }
}

function startReferencePlayback() {
  if (
    !running ||
    !soundInput.checked ||
    Number(sourceMixInput.value) <= 0 ||
    !audioContext ||
    !referenceGain ||
    !selectedReferenceReady ||
    !referenceMedia
  ) return;

  syncReferenceMediaProfile();
  constrainReferencePlaybackToProfile();
  updateReferenceTimeStretch();
  void referenceMedia.play().catch(error => {
    if (error?.name === "AbortError") return;
    referenceStatus.dataset.state = "error";
    referenceStatus.textContent = "Reference playback was blocked. Press Stop, then Start again.";
    console.error(error);
  });
}

function stopReferencePlayback() {
  referenceMedia?.pause();
}

function updateSourceMix() {
  updateControlReadouts();
  if (!audioContext || !masterGain || !referenceGain) return;

  const mix = soundInput.checked
    ? calculateSourceMix(sourceMixInput.value)
    : { generatedGain: 0, referenceGain: 0 };
  masterGain.gain.setTargetAtTime(mix.generatedGain, audioContext.currentTime, 0.025);
  referenceGain.gain.setTargetAtTime(mix.referenceGain, audioContext.currentTime, 0.025);

  if (mix.referenceGain > 0) startReferencePlayback();
  else stopReferencePlayback();
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
  elements.crest.textContent = `${analysis.crestFactor.toFixed(1)}×`;
  elements.envelopeVariation.textContent = analysis.envelopeCoefficientOfVariation.toFixed(2);
  elements.envelopeFloor.textContent = `${(analysis.envelopeFloorRatio * 100).toFixed(0)}%`;
  elements.bandCorrelation.textContent = analysis.bandEnvelopeCorrelation.toFixed(2);
  elements.kurtosis.textContent = analysis.sampleKurtosis.toFixed(1);
  elements.envelope100.textContent = analysis.envelopeScales[100]
    .coefficientOfVariation.toFixed(2);
}

function renderRateCalibration() {
  const generatedRateLabel = `${formatRate(selectedRateHz())}/s`;
  generatedProfileLabel.textContent = `1 s representative @ ${generatedDiagnostics.representativeField.centerSeconds.toFixed(2)} s · 8 s at ${generatedRateLabel}`;
  generatedTotalRate.textContent = generatedRateLabel;
  generatedTotalRate.title = "Selected total Poisson Arrival rate";
  generatedDetectedRate.textContent = `${formatRate(generatedProfileOnsets.rateHz)}/s`;

  if (!measuredReferenceOnsets) {
    referenceDetectedRate.textContent = "—";
    referenceTotalRate.textContent = "—";
  } else {
    referenceDetectedRate.textContent = `${formatRate(measuredReferenceOnsets.rateHz)}/s`;
    referenceDetectedRate.title = measuredReferenceCalibration
      ? `Stored detector baseline: ${formatRate(measuredReferenceCalibration.detectedOnsetRateHz)}/s`
      : "Detected in the local ten-second analysis window";
    referenceTotalRate.textContent = measuredReferenceCalibration?.isTotalCalibrated
      ? `${formatRate(measuredReferenceCalibration.equivalentTotalRateHz)}/s`
      : "Uncalibrated";
  }

  farnellDetectedRate.textContent = farnellReferenceOnsets
    ? `${formatRate(farnellReferenceOnsets.rateHz)}/s`
    : "—";
  generatedWindowDistance.textContent = `${generatedDiagnostics.representativeField.spectrumDistanceDb.toFixed(1)} dB`;
}

function selectedImpact(impacts, selectedIndex) {
  return impacts?.[selectedIndex] ?? impacts?.[0] ?? null;
}

function currentMicroscopeScaling() {
  return prepareMicroscopeScaling([
    {
      id: "generated",
      profileRms: generatedProfileAnalysis?.rms,
      microscopes: generatedImpacts,
    },
    {
      id: "reference",
      profileRms: measuredReferenceProfileAnalysis?.rms,
      microscopes: measuredReferenceImpacts,
    },
    {
      id: "farnell",
      profileRms: farnellReferenceProfileAnalysis?.rms,
      microscopes: farnellReferenceImpacts,
    },
  ], { mode: microscopeScalingMode });
}

function renderMicroscopeScalingNote() {
  microscopeScalingNote.textContent = microscopeScalingMode === "profile-matched"
    ? "Profile-matched · complete profiles share one RMS baseline; all available impacts retain one common waveform and spectrogram scale. Display only."
    : "Shape · every selected impact is independently normalized to expose quiet morphology. Display only.";
}

function renderImpactMicroscope(
  waveform,
  spectrogram,
  label,
  playButton,
  choiceButtons,
  impacts,
  selectedIndex,
  color,
  scaling,
  sharedSpectrogramPeakPower,
) {
  const impact = selectedImpact(impacts, selectedIndex);
  playButton.disabled = !impact;
  choiceButtons.forEach((button, index) => {
    button.disabled = !impacts?.[index];
    button.setAttribute("aria-pressed", String(Boolean(impact && index === selectedIndex)));
  });
  if (playButton.dataset.playing !== "true") {
    playButton.textContent = impact ? "▶ Play 120 ms" : "Loading impact…";
  }
  if (!impact) {
    renderEmptySignal(waveform, "Impact microscope loading");
    renderEmptySignal(spectrogram, "Aligned spectrogram will appear here");
    label.textContent = "Waiting for complete profile…";
    return;
  }
  const durationSeconds = impact.samples.length / impact.analysis.sampleRate;
  const markerFraction = durationSeconds > 0
    ? impact.onsetOffsetSeconds / durationSeconds
    : 0;
  const marker = { markerFraction, markerLabel: "onset" };
  renderSignalWaveform(waveform, impact.samples, color, {
    ...marker,
    normalizationGain: scaling?.waveformGain ?? null,
  });
  renderSignalSpectrogram(spectrogram, impact.analysis, {
    ...marker,
    powerGain: scaling?.spectrogramPowerGain ?? 1,
    peakPower: sharedSpectrogramPeakPower,
  });
  const peakDelayMilliseconds = Math.max(
    0,
    (impact.peakSeconds - impact.onsetSeconds) * 1_000,
  );
  const selectionLabel = impact.selectionKind === "fallback"
    ? "Fallback"
    : `${impact.selectionKind[0].toUpperCase()}${impact.selectionKind.slice(1)}`;
  label.textContent = `${selectionLabel} · ${impact.alignmentKind === "detected-onset" ? "detected onset" : "peak fallback"} ${impact.onsetSeconds.toFixed(3)} s · peak +${peakDelayMilliseconds.toFixed(1)} ms`;
}

async function playImpactMicroscope(impact, button) {
  if (!impact) return;
  await ensureAudio();
  if (!audioContext || !outputGain) {
    button.disabled = true;
    button.textContent = "Audio unavailable";
    return;
  }
  if (audioContext.state === "suspended") await audioContext.resume();

  if (activeImpactAuditionSource) {
    activeImpactAuditionButton.dataset.playing = "false";
    activeImpactAuditionButton.textContent = "▶ Play 120 ms";
    try {
      activeImpactAuditionSource.stop();
    } catch {
      // The previous 120 ms source may already have ended.
    }
  }

  const audition = prepareImpactAudition(impact.samples, {
    sampleRate: impact.analysis.sampleRate,
  });
  const buffer = audioContext.createBuffer(
    1,
    audition.samples.length,
    audition.sampleRate,
  );
  buffer.copyToChannel(audition.samples, 0);
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(outputGain);
  activeImpactAuditionSource = source;
  activeImpactAuditionButton = button;
  button.dataset.playing = "true";
  button.textContent = "Playing 120 ms";
  source.addEventListener("ended", () => {
    if (activeImpactAuditionSource !== source) return;
    activeImpactAuditionSource = null;
    activeImpactAuditionButton = null;
    button.dataset.playing = "false";
    button.textContent = "▶ Play 120 ms";
  }, { once: true });
  source.start();
}

function requestImpactAudition(impact, button) {
  void playImpactMicroscope(impact, button).catch(error => {
    button.dataset.playing = "false";
    button.textContent = "Playback failed";
    console.error(error);
  });
}

function renderOnsetPopulationPanel(canvas, label, population, color) {
  renderOnsetPopulation(canvas, population, color);
  if (!population?.count) {
    label.textContent = "Waiting for detected onsets…";
    return;
  }
  const medianPeakMilliseconds = population.peakDelayQuantilesSeconds[1] * 1_000;
  const medianEnergy90Milliseconds = population.energy90DelayQuantilesSeconds[1] * 1_000;
  label.textContent = `${population.count} aligned onsets · q50 peak +${medianPeakMilliseconds.toFixed(1)} ms · 90% energy +${medianEnergy90Milliseconds.toFixed(1)} ms`;
}

function renderAnalysisComparison() {
  const microscopeScaling = currentMicroscopeScaling();
  renderMicroscopeScalingNote();
  renderSignalWaveform(generatedAnalysisWaveform, generatedReferenceSamples, "#d9ff86");
  renderSignalSpectrogram(generatedAnalysisSpectrogram, generatedReferenceAnalysis);
  renderImpactMicroscope(
    generatedImpactWaveform,
    generatedImpactSpectrogram,
    generatedImpactLabel,
    generatedImpactPlayButton,
    generatedImpactChoiceButtons,
    generatedImpacts,
    generatedImpactSelection,
    "#d9ff86",
    microscopeScaling.bySource.generated,
    microscopeScaling.sharedSpectrogramPeakPower,
  );
  renderOnsetPopulationPanel(
    generatedOnsetPopulation,
    generatedOnsetPopulationLabel,
    generatedDiagnostics.onsetPopulation,
    "#d9ff86",
  );
  setAnalysisMetrics(generatedProfileAnalysis, {
    centroid: generatedCentroid,
    highBand: generatedHighBand,
    flatness: generatedFlatness,
    crest: generatedCrest,
    envelopeVariation: generatedEnvelopeVariation,
    envelopeFloor: generatedEnvelopeFloor,
    bandCorrelation: generatedBandCorrelation,
    kurtosis: generatedKurtosis,
    envelope100: generatedEnvelope100,
  });
  renderRateCalibration();

  const spectrumSeries = [{
    analysis: generatedProfileAnalysis,
    color: "#d9ff86",
  }];
  const residualSeries = [];

  if (
    measuredReferenceSamples &&
    measuredReferenceAnalysis &&
    measuredReferenceProfileAnalysis &&
    measuredReferenceDiagnostics
  ) {
    renderSignalWaveform(referenceAnalysisWaveform, measuredReferenceSamples, "#54dce3");
    renderSignalSpectrogram(referenceAnalysisSpectrogram, measuredReferenceAnalysis);
    setAnalysisMetrics(measuredReferenceProfileAnalysis, {
      centroid: referenceCentroid,
      highBand: referenceHighBand,
      flatness: referenceFlatness,
      crest: referenceCrest,
      envelopeVariation: referenceEnvelopeVariation,
      envelopeFloor: referenceEnvelopeFloor,
      bandCorrelation: referenceBandCorrelation,
      kurtosis: referenceKurtosis,
      envelope100: referenceEnvelope100,
    });
    spectrumSeries.push({
      analysis: measuredReferenceProfileAnalysis,
      color: "#54dce3",
    });
    const comparison = compareRainFieldDiagnostics(
      generatedDiagnostics,
      measuredReferenceDiagnostics,
    );
    residualSeries.push({ comparison, color: "#54dce3" });
    referenceSpectrumDistance.textContent = `${comparison.profileDistanceDb.toFixed(1)} dB`;
    referenceWindowDistance.textContent = `${measuredReferenceDiagnostics.representativeField.spectrumDistanceDb.toFixed(1)} dB`;
    selectedDistributionDistance.textContent = `${comparison.distributionDistanceDb.toFixed(1)} dB`;
    renderDistributionResidual(selectedDistributionResidual, comparison);
    renderImpactMicroscope(
      referenceImpactWaveform,
      referenceImpactSpectrogram,
      referenceImpactLabel,
      referenceImpactPlayButton,
      referenceImpactChoiceButtons,
      measuredReferenceImpacts,
      measuredReferenceImpactSelection,
      "#54dce3",
      microscopeScaling.bySource.reference,
      microscopeScaling.sharedSpectrogramPeakPower,
    );
    renderOnsetPopulationPanel(
      referenceOnsetPopulation,
      referenceOnsetPopulationLabel,
      measuredReferenceDiagnostics.onsetPopulation,
      "#54dce3",
    );
  } else {
    renderEmptySignal(referenceAnalysisWaveform, "Loading selected Rain Reference");
    renderEmptySignal(referenceAnalysisSpectrogram, "Representative Field will appear here");
    referenceSpectrumDistance.textContent = "—";
    referenceWindowDistance.textContent = "—";
    selectedDistributionDistance.textContent = "—";
    renderEmptySignal(selectedDistributionResidual, "Selected distribution loading");
    renderImpactMicroscope(
      referenceImpactWaveform,
      referenceImpactSpectrogram,
      referenceImpactLabel,
      referenceImpactPlayButton,
      referenceImpactChoiceButtons,
      [],
      measuredReferenceImpactSelection,
      "#54dce3",
      microscopeScaling.bySource.reference,
      microscopeScaling.sharedSpectrogramPeakPower,
    );
    renderOnsetPopulationPanel(
      referenceOnsetPopulation,
      referenceOnsetPopulationLabel,
      null,
      "#54dce3",
    );
  }

  if (
    farnellReferenceSamples
    && farnellReferenceAnalysis
    && farnellReferenceProfileAnalysis
    && farnellReferenceDiagnostics
  ) {
    renderSignalWaveform(farnellAnalysisWaveform, farnellReferenceSamples, "#ff9d72");
    renderSignalSpectrogram(farnellAnalysisSpectrogram, farnellReferenceAnalysis);
    setAnalysisMetrics(farnellReferenceProfileAnalysis, {
      centroid: farnellCentroid,
      highBand: farnellHighBand,
      flatness: farnellFlatness,
      crest: farnellCrest,
      envelopeVariation: farnellEnvelopeVariation,
      envelopeFloor: farnellEnvelopeFloor,
      bandCorrelation: farnellBandCorrelation,
      kurtosis: farnellKurtosis,
      envelope100: farnellEnvelope100,
    });
    spectrumSeries.push({
      analysis: farnellReferenceProfileAnalysis,
      color: "#ff9d72",
    });
    const comparison = compareRainFieldDiagnostics(
      generatedDiagnostics,
      farnellReferenceDiagnostics,
    );
    residualSeries.push({ comparison, color: "#ff9d72" });
    farnellSpectrumDistance.textContent = `${comparison.profileDistanceDb.toFixed(1)} dB`;
    farnellWindowDistance.textContent = `${farnellReferenceDiagnostics.representativeField.spectrumDistanceDb.toFixed(1)} dB`;
    farnellDistributionDistance.textContent = `${comparison.distributionDistanceDb.toFixed(1)} dB`;
    renderDistributionResidual(farnellDistributionResidual, comparison);
    renderImpactMicroscope(
      farnellImpactWaveform,
      farnellImpactSpectrogram,
      farnellImpactLabel,
      farnellImpactPlayButton,
      farnellImpactChoiceButtons,
      farnellReferenceImpacts,
      farnellReferenceImpactSelection,
      "#ff9d72",
      microscopeScaling.bySource.farnell,
      microscopeScaling.sharedSpectrogramPeakPower,
    );
    renderOnsetPopulationPanel(
      farnellOnsetPopulation,
      farnellOnsetPopulationLabel,
      farnellReferenceDiagnostics.onsetPopulation,
      "#ff9d72",
    );
  } else {
    renderEmptySignal(farnellAnalysisWaveform, "Loading Farnell procedural reference");
    renderEmptySignal(farnellAnalysisSpectrogram, "Representative Field will appear here");
    farnellSpectrumDistance.textContent = "—";
    farnellWindowDistance.textContent = "—";
    farnellDistributionDistance.textContent = "—";
    renderEmptySignal(farnellDistributionResidual, "Farnell distribution loading");
    renderImpactMicroscope(
      farnellImpactWaveform,
      farnellImpactSpectrogram,
      farnellImpactLabel,
      farnellImpactPlayButton,
      farnellImpactChoiceButtons,
      [],
      farnellReferenceImpactSelection,
      "#ff9d72",
      microscopeScaling.bySource.farnell,
      microscopeScaling.sharedSpectrogramPeakPower,
    );
    renderOnsetPopulationPanel(
      farnellOnsetPopulation,
      farnellOnsetPopulationLabel,
      null,
      "#ff9d72",
    );
  }

  selectedSpectrumLabel.textContent = selectedReferenceProfile.shortTitle;
  selectedResidualLabel.textContent = selectedReferenceProfile.shortTitle;
  selectedDistributionTitle.textContent = `Generated − ${selectedReferenceProfile.shortTitle} distribution`;
  renderSpectrumComparison(comparisonSpectrum, spectrumSeries);
  renderProfileResidual(profileResidual, residualSeries);
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

function applyPreparedRainReference(prepared, filename, status, calibration = null) {
  measuredReferenceDiagnostics = prepared.rainDiagnostics;
  measuredReferenceSamples = prepared.samples;
  measuredReferenceAnalysis = prepared.analysis;
  measuredReferenceProfileAnalysis = prepared.profileAnalysis;
  measuredReferenceOnsets = prepared.prominentOnsets;
  measuredReferenceImpacts = prepared.impactMicroscopes;
  measuredReferenceImpactSelection = 0;
  measuredReferenceCalibration = calibration;
  referenceFilename.textContent = `${filename} · representative @ ${prepared.fieldWindowCenterSeconds.toFixed(2)} s`;
  referenceStatus.dataset.state = "ready";
  referenceStatus.textContent = status;
  renderAnalysisComparison();
}

function renderReferenceProvenance(reference) {
  referenceProvenance.replaceChildren();
  const source = document.createElement("a");
  source.href = reference.sourceUrl ?? reference.datasetUrl;
  source.textContent = reference.creator
    ? reference.id === "redwood-ground"
      ? `${reference.creator} on Freesound`
      : `${reference.creator} · source example`
    : "Xavier et al. Amazon rainfall dataset";
  const license = document.createElement("a");
  license.href = reference.licenseUrl;
  license.textContent = reference.license;
  referenceProvenance.append(
    "Selected: ",
    source,
    ` · ${reference.intensity} · ${reference.surface} · ${reference.playbackFormat} · `,
    license,
    ". The selector controls analysis and Reference Playback; a local file remains a silent visual override.",
  );
}

function describePreparedField(prepared) {
  return `Representative one-second Field centered at ${prepared.fieldWindowCenterSeconds.toFixed(2)} s (${prepared.fieldWindowDistanceDb.toFixed(1)} dB from its complete profile); Strong Impact Microscope onset ${prepared.impactMicroscopes[0].onsetSeconds.toFixed(3)} s`;
}

async function analyzeFarnellRainReference() {
  farnellCard.setAttribute("aria-busy", "true");
  farnellFilename.textContent = "Loading 14–24 s profile…";
  renderAnalysisComparison();

  try {
    const prepared = await loadRainReference(FARNELL_RAIN_REFERENCE, {
      decodeAudioData: decodeReferenceAudio,
    });
    farnellReferenceDiagnostics = prepared.rainDiagnostics;
    farnellReferenceSamples = prepared.samples;
    farnellReferenceAnalysis = prepared.analysis;
    farnellReferenceProfileAnalysis = prepared.profileAnalysis;
    farnellReferenceOnsets = prepared.prominentOnsets;
    farnellReferenceImpacts = prepared.impactMicroscopes;
    farnellReferenceImpactSelection = 0;
    farnellFilename.textContent = `14–24 s profile · representative @ ${prepared.fieldWindowCenterSeconds.toFixed(2)} s`;
  } catch (error) {
    farnellFilename.textContent = "Farnell procedural reference unavailable";
    console.error(error);
  } finally {
    farnellCard.setAttribute("aria-busy", "false");
    renderAnalysisComparison();
  }
}

async function analyzeSelectedRainReference() {
  const request = ++referenceLoadRequest;
  selectedReferenceReady = false;
  measuredReferenceDiagnostics = null;
  measuredReferenceSamples = null;
  measuredReferenceAnalysis = null;
  measuredReferenceProfileAnalysis = null;
  measuredReferenceOnsets = null;
  measuredReferenceImpacts = [];
  measuredReferenceImpactSelection = 0;
  measuredReferenceCalibration = null;
  sourceMixInput.disabled = true;
  stopReferencePlayback();
  syncReferenceMediaProfile();
  renderReferenceProvenance(selectedReferenceProfile);
  referenceCard.setAttribute("aria-busy", "true");
  referenceStatus.dataset.state = "loading";
  referenceStatus.textContent = `Loading ${selectedReferenceProfile.title}…`;
  renderAnalysisComparison();

  try {
    const prepared = await loadRainReference(selectedReferenceProfile, {
      decodeAudioData: decodeReferenceAudio,
    });
    if (request !== referenceLoadRequest) return;
    selectedReferenceReady = true;
    sourceMixInput.disabled = false;
    startReferencePlayback();
    applyPreparedRainReference(
      prepared,
      selectedReferenceProfile.title,
      selectedReferenceCalibration.isTotalCalibrated
        ? `${selectedReferenceProfile.shortTitle} reference: ${selectedReferenceCalibration.detectedOnsetRateHz.toFixed(1)} detected onsets/s; provisional ${selectedReferenceCalibration.equivalentTotalRateHz.toFixed(0)} total Arrivals/s. Current window detects ${prepared.prominentOnsets.rateHz.toFixed(1)}/s. ${describePreparedField(prepared)}.`
        : `${selectedReferenceProfile.shortTitle} reference: ${selectedReferenceCalibration.detectedOnsetRateHz.toFixed(1)} detected onsets/s; total Arrival rate uncalibrated. Current window detects ${prepared.prominentOnsets.rateHz.toFixed(1)}/s. ${describePreparedField(prepared)}.`,
      selectedReferenceCalibration,
    );
  } catch (error) {
    if (request !== referenceLoadRequest) return;
    referenceStatus.dataset.state = "error";
    referenceStatus.textContent = "The selected reference could not be loaded. Choose another profile or a local recording.";
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
  referenceStatus.textContent = "Decoding, selecting a representative Field, and aligning the q90 strong onset…";

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
      `Local override ready at ${prepared.prominentOnsets.rateHz.toFixed(1)} detected onsets/s; total Arrival rate is uncalibrated. ${describePreparedField(prepared)}. The file remains local and silent.`,
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
  constrainReferencePlaybackToProfile();
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

async function ensureAudio() {
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
  liveRainRenderer = audioContext.sampleRate === ANALYSIS_SAMPLE_RATE
    ? analysisRainRenderer
    : createGeneratedRainRenderer({
      sampleRate: audioContext.sampleRate,
      factors: acousticFactors,
      earHeightMeters: EAR_HEIGHT_METERS,
      dropPopulation: rainControls.snapshot().dropPopulation,
    });
  rainAudioBufferCache = new WeakMap();
  referenceMedia = enablePitchPreservation(new Audio());
  referenceMedia.preload = "auto";
  referenceMedia.addEventListener("loadedmetadata", constrainReferencePlaybackToProfile);
  referenceMedia.addEventListener("timeupdate", constrainReferencePlaybackToProfile);
  referenceMediaSource = audioContext.createMediaElementSource(referenceMedia);
  referenceMediaSource.connect(referenceGain);
  syncReferenceMediaProfile();
  const mix = calculateSourceMix(sourceMixInput.value);
  masterGain.gain.value = soundInput.checked ? mix.generatedGain : 0;
  referenceGain.gain.value = soundInput.checked ? mix.referenceGain : 0;
  outputGain.gain.value = Number(volumeInput.value);
  applyCompressionSettings();
  if (audioContext.audioWorklet && typeof AudioWorkletNode === "function") {
    try {
      await audioContext.audioWorklet.addModule(
        new URL("./rain-worklet.js", import.meta.url),
      );
      rainWorkletNode = new AudioWorkletNode(audioContext, "rain-block-renderer", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          responses: liveRainRenderer.exportResponseBank(),
        },
      });
      rainWorkletNode.connect(masterGain);
    } catch (error) {
      rainWorkletNode = null;
      console.warn("Continuous rain block renderer unavailable; using node fallback.", error);
    }
  }
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
  const plan = liveRainRenderer.prepareArrival(event);
  let buffer = rainAudioBufferCache.get(plan.response);
  if (!buffer) {
    buffer = audioContext.createBuffer(
      1,
      plan.response.length,
      audioContext.sampleRate,
    );
    buffer.copyToChannel(plan.response, 0);
    rainAudioBufferCache.set(plan.response, buffer);
  }

  source.buffer = buffer;
  gain.gain.setValueAtTime(plan.gain, startTime);
  if (plan.filter.cutoffHz < 19_900) {
    const distanceFilter = audioContext.createBiquadFilter();
    distanceFilter.type = "lowpass";
    distanceFilter.frequency.setValueAtTime(
      plan.filter.cutoffHz,
      startTime,
    );
    distanceFilter.Q.value = plan.filter.q;
    source.connect(distanceFilter).connect(gain);
  } else {
    source.connect(gain);
  }
  if (panner) {
    panner.pan.setValueAtTime(plan.stereoPan, startTime);
    gain.connect(panner).connect(masterGain);
  } else {
    gain.connect(masterGain);
  }
  source.start(startTime);
}

function scheduleAudioBatch(events) {
  if (
    !events.length
    || !soundInput.checked
    || Number(sourceMixInput.value) >= 1
    || !audioContext
  ) return;
  if (rainWorkletNode) {
    rainWorkletNode.port.postMessage({
      type: "schedule",
      events: events.map(({ event, scheduledAt }) => ({
        plan: (() => {
          const prepared = liveRainRenderer.prepareArrival(event);
          return {
            variantIndex: prepared.variantIndex,
            gain: prepared.gain,
            stereoPan: prepared.stereoPan,
            filter: prepared.filter,
          };
        })(),
        startFrame: Math.round(scheduledAt * audioContext.sampleRate),
      })),
    });
    return;
  }
  for (const scheduled of events) playEvent(scheduled.event, scheduled.scheduledAt);
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
  const audioBatch = [];

  while (
    nextScheduledEvent.at <= elapsedSeconds &&
    emittedThisTick < MAX_EVENTS_PER_TICK
  ) {
    const startedAt = simulationStartedAt + nextScheduledEvent.at * 1000;
    scheduledArrivals.push({ event: nextScheduledEvent, startedAt });
    audioBatch.push({
      event: nextScheduledEvent,
      scheduledAt: audioTimelineStartedAt + nextScheduledEvent.at,
    });
    nextScheduledEvent = engine.next();
    emittedThisTick += 1;
  }

  scheduleAudioBatch(audioBatch);

  timer = window.setTimeout(scheduleNext, SCHEDULER_TICK_MS);
}

async function toggleRunning() {
  if (!running) {
    await ensureAudio();
    if (audioContext?.state === "suspended") await audioContext.resume();
    running = true;
    simulator.dataset.running = "true";
    startButton.textContent = "Stop process";
    startButton.setAttribute("aria-pressed", "true");
    restartEngine();
    updateSourceMix();
    startReferencePlayback();
    return;
  }

  running = false;
  scheduledArrivals = [];
  simulator.dataset.running = "false";
  startButton.textContent = "Start process";
  startButton.setAttribute("aria-pressed", "false");
  clearTimeout(timer);
  rainWorkletNode?.port.postMessage({
    type: "reset",
    startFrame: Math.round((audioContext?.currentTime ?? 0) * (audioContext?.sampleRate ?? 1)),
  });
  stopReferencePlayback();
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
dropPopulationInput.addEventListener("input", updateDropPopulation);
speedPopulationLinkInput.addEventListener("change", updateSpeedPopulationLink);
couplingInput.addEventListener("input", updateControlReadouts);
volumeInput.addEventListener("input", updateOutputLevel);
sourceMixInput.addEventListener("input", updateSourceMix);
soundInput.addEventListener("change", async () => {
  await ensureAudio();
  if (soundInput.checked && audioContext?.state === "suspended") {
    await audioContext.resume();
  }
  updateSourceMix();
  if (soundInput.checked) startReferencePlayback();
  else stopReferencePlayback();
});
couplingInput.addEventListener("change", restartEngine);
referenceProfileSelect.addEventListener("change", () => {
  selectedReferenceProfile = getRainReferenceProfile(referenceProfileSelect.value);
  selectedReferenceCalibration = resolveReferenceCalibration(selectedReferenceProfile);
  updateControlReadouts();
  regenerateAcousticAssets(false);
  void analyzeSelectedRainReference();
});
referenceInput.addEventListener("change", () => {
  const [file] = referenceInput.files;
  if (file) analyzeRainReference(file);
});
resetAcousticFactorsButton.addEventListener("click", resetAcousticFactors);
generatedImpactPlayButton.addEventListener("click", () => {
  requestImpactAudition(
    selectedImpact(generatedImpacts, generatedImpactSelection),
    generatedImpactPlayButton,
  );
});
referenceImpactPlayButton.addEventListener("click", () => {
  requestImpactAudition(
    selectedImpact(measuredReferenceImpacts, measuredReferenceImpactSelection),
    referenceImpactPlayButton,
  );
});
farnellImpactPlayButton.addEventListener("click", () => {
  requestImpactAudition(
    selectedImpact(farnellReferenceImpacts, farnellReferenceImpactSelection),
    farnellImpactPlayButton,
  );
});
generatedImpactChoiceButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    generatedImpactSelection = index;
    renderAnalysisComparison();
  });
});
referenceImpactChoiceButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    measuredReferenceImpactSelection = index;
    renderAnalysisComparison();
  });
});
farnellImpactChoiceButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    farnellReferenceImpactSelection = index;
    renderAnalysisComparison();
  });
});
microscopeScalingInputs.forEach(input => {
  input.addEventListener("change", () => {
    if (!input.checked) return;
    microscopeScalingMode = input.value;
    renderAnalysisComparison();
  });
});
window.addEventListener("resize", () => {
  clearTimeout(comparisonResizeTimer);
  comparisonResizeTimer = window.setTimeout(renderAnalysisComparison, 120);
});

createAcousticFactorControls();
updateControlReadouts();
referenceProfileSelect.replaceChildren(...RAIN_REFERENCE_PROFILES.map(reference => {
  const option = document.createElement("option");
  option.value = reference.id;
  option.textContent = reference.title;
  option.selected = reference.id === selectedReferenceProfile.id;
  return option;
}));
renderReferenceProvenance(selectedReferenceProfile);
seedOutput.textContent = seed;
renderAnalysisComparison();
renderLoop.wake();
void analyzeSelectedRainReference();
void analyzeFarnellRainReference();
