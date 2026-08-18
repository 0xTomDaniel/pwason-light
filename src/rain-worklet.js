import { createRainBlockAccumulator } from "./rain-block-accumulator.js";

class RainBlockRendererProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.responses = options.processorOptions?.responses ?? [];
    this.accumulator = null;
    this.pendingEvents = [];
    this.port.onmessage = event => this.receive(event.data);
  }

  receive(message) {
    if (message?.type === "configure") {
      this.responses = message.responses ?? this.responses;
      return;
    }

    if (message?.type === "reset") {
      this.pendingEvents = [];
      this.accumulator?.reset(message.startFrame);
      return;
    }

    if (message?.type !== "schedule" || !Array.isArray(message.events)) return;
    for (const scheduled of message.events) {
      const response = this.responses[scheduled.plan?.variantIndex];
      if (!(response instanceof Float32Array)) continue;
      const entry = {
        startFrame: scheduled.startFrame,
        plan: { ...scheduled.plan, response },
      };
      if (this.accumulator) {
        this.accumulator.schedule(entry.startFrame, entry.plan);
      } else {
        this.pendingEvents.push(entry);
      }
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
      for (const entry of this.pendingEvents) {
        this.accumulator.schedule(entry.startFrame, entry.plan);
      }
      this.pendingEvents = [];
    }

    const rendered = this.accumulator.render(output[0].length);
    output[0].set(rendered[0]);
    if (output[1]) output[1].set(rendered[1] ?? rendered[0]);
    return true;
  }
}

registerProcessor("rain-block-renderer", RainBlockRendererProcessor);
