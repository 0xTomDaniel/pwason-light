import { createPoissonEngine } from "./poisson-engine.js";
import { createRainArrivalRendering } from "./rain-arrival-rendering.js";
import { createRainBlockAccumulator } from "./rain-block-accumulator.js";
import { createRainDenseAccumulator } from "./rain-dense-accumulator.js";
import { selectRainAudioRendering } from "./rain-rendering-policy.js";
import { createOpticalDriveRenderer } from "./optical-drive-renderer.js";

class RainBlockRendererProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.responses = options.processorOptions?.responses ?? [];
    this.denseSignatures = options.processorOptions?.denseSignatures ?? [];
    this.renderingOptions = {
      factors: options.processorOptions?.factors,
      earHeightMeters: options.processorOptions?.earHeightMeters,
    };
    this.arrivalRendering = this.createArrivalRendering();
    this.accumulator = null;
    this.denseAccumulator = null;
    this.opticalDrive = null;
    this.opticalSensitivity = options.processorOptions?.opticalSensitivity ?? 32;
    this.opticalMode = options.processorOptions?.opticalMode ?? "additive";
    this.opticalFramesSincePost = 0;
    this.field = null;
    this.port.onmessage = event => this.receive(event.data);
  }

  createArrivalRendering() {
    return createRainArrivalRendering({
      ...this.renderingOptions,
      responseCount: this.responses.length,
    });
  }

  receive(message) {
    if (message?.type === "configure") {
      this.responses = message.responses ?? this.responses;
      this.denseSignatures = message.denseSignatures ?? this.denseSignatures;
      this.renderingOptions = {
        factors: message.factors ?? this.renderingOptions.factors,
        earHeightMeters: message.earHeightMeters
          ?? this.renderingOptions.earHeightMeters,
      };
      this.arrivalRendering = this.createArrivalRendering();
      this.denseAccumulator = null;
      return;
    }

    if (message?.type === "start") {
      this.opticalSensitivity = message.opticalSensitivity ?? this.opticalSensitivity;
      this.opticalMode = message.opticalMode ?? this.opticalMode;
      const engine = createPoissonEngine(message.settings);
      this.field = {
        engine,
        nextArrival: engine.next(),
        startFrame: null,
        rendering: selectRainAudioRendering(message.settings?.rateHz),
      };
      this.opticalDrive = createOpticalDriveRenderer({
        sensitivity: this.opticalSensitivity,
        mode: this.opticalMode,
      });
      this.opticalFramesSincePost = 0;
      return;
    }

    if (message?.type === "configure-optical-drive") {
      this.opticalSensitivity = message.sensitivity ?? this.opticalSensitivity;
      this.opticalMode = message.mode ?? this.opticalMode;
      if (this.field) {
        this.opticalDrive = createOpticalDriveRenderer({
          sensitivity: this.opticalSensitivity,
          mode: this.opticalMode,
        });
        this.opticalFramesSincePost = 0;
      }
      return;
    }

    if (message?.type === "stop" || message?.type === "reset") {
      this.field = null;
      this.accumulator?.reset();
      this.denseAccumulator?.reset();
      this.opticalDrive = null;
      this.opticalFramesSincePost = 0;
      this.port.postMessage({ type: "optical-drive-stopped" });
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output?.length) return true;
    if (!this.accumulator) {
      this.accumulator = createRainBlockAccumulator({
        sampleRate,
        channelCount: output.length >= 2 ? 2 : 1,
        startFrame: currentFrame,
      });
    }
    if (!this.denseAccumulator) {
      this.denseAccumulator = createRainDenseAccumulator({
        sampleRate,
        channelCount: output.length >= 2 ? 2 : 1,
        signatures: this.denseSignatures,
        startFrame: currentFrame,
      });
    }

    if (this.field) {
      const activeAccumulator = this.field.rendering === "dense-response-field"
        ? this.denseAccumulator
        : this.accumulator;
      if (this.field.startFrame === null) {
        this.field.startFrame = currentFrame;
        activeAccumulator.reset(this.field.startFrame);
      }
      const endFrame = activeAccumulator.currentFrame + output[0].length;
      while (
        this.field.startFrame + this.field.nextArrival.at * sampleRate < endFrame
      ) {
        const arrival = this.field.nextArrival;
        const plan = {
          ...this.arrivalRendering.prepareArrival(arrival),
          channelWeights: arrival.channelWeights,
        };
        if (this.field.rendering === "dense-response-field") {
          this.denseAccumulator.schedule(
            Math.round(this.field.startFrame + this.field.nextArrival.at * sampleRate),
            plan,
          );
        } else {
          const response = this.responses[plan.variantIndex];
          if (response instanceof Float32Array) {
            this.accumulator.schedule(
              Math.round(this.field.startFrame + this.field.nextArrival.at * sampleRate),
              { ...plan, response },
            );
          }
        }
        this.field.nextArrival = this.field.engine.next();
      }

      const rendered = activeAccumulator.renderWithOptical(output[0].length);
      output[0].set(rendered.audio[0]);
      if (output[1]) output[1].set(rendered.audio[1] ?? rendered.audio[0]);
      this.opticalDrive?.process(rendered.optical);
      this.opticalFramesSincePost += output[0].length;
      if (this.opticalDrive && this.opticalFramesSincePost >= sampleRate / 30) {
        this.port.postMessage({
          type: "optical-drive",
          ...this.opticalDrive.snapshot({ resetDiagnostics: true }),
        });
        this.opticalFramesSincePost = 0;
      }
    } else {
      for (const channel of output) channel.fill(0);
    }
    return true;
  }
}

registerProcessor("rain-block-renderer", RainBlockRendererProcessor);
