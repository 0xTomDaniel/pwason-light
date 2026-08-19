import { createPoissonEngine } from "./poisson-engine.js";
import { createRainArrivalRendering } from "./rain-arrival-rendering.js";
import { createRainBlockAccumulator } from "./rain-block-accumulator.js";

class RainBlockRendererProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.responses = options.processorOptions?.responses ?? [];
    this.renderingOptions = {
      factors: options.processorOptions?.factors,
      earHeightMeters: options.processorOptions?.earHeightMeters,
    };
    this.arrivalRendering = this.createArrivalRendering();
    this.accumulator = null;
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
      this.renderingOptions = {
        factors: message.factors ?? this.renderingOptions.factors,
        earHeightMeters: message.earHeightMeters
          ?? this.renderingOptions.earHeightMeters,
      };
      this.arrivalRendering = this.createArrivalRendering();
      return;
    }

    if (message?.type === "start") {
      const engine = createPoissonEngine(message.settings);
      this.field = {
        engine,
        nextArrival: engine.next(),
        startFrame: null,
      };
      return;
    }

    if (message?.type === "stop" || message?.type === "reset") {
      this.field = null;
      this.accumulator?.reset();
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

    if (this.field) {
      if (this.field.startFrame === null) {
        this.field.startFrame = this.accumulator.currentFrame;
        this.accumulator.reset(this.field.startFrame);
      }
      const endFrame = this.accumulator.currentFrame + output[0].length;
      while (
        this.field.startFrame + this.field.nextArrival.at * sampleRate < endFrame
      ) {
        const plan = this.arrivalRendering.prepareArrival(this.field.nextArrival);
        const response = this.responses[plan.variantIndex];
        if (response instanceof Float32Array) {
          this.accumulator.schedule(
            Math.round(this.field.startFrame + this.field.nextArrival.at * sampleRate),
            { ...plan, response },
          );
        }
        this.field.nextArrival = this.field.engine.next();
      }
    }

    const rendered = this.accumulator.render(output[0].length);
    output[0].set(rendered[0]);
    if (output[1]) output[1].set(rendered[1] ?? rendered[0]);
    return true;
  }
}

registerProcessor("rain-block-renderer", RainBlockRendererProcessor);
