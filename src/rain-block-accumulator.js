function finiteInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function createVoice(startFrame, plan, sampleRate) {
  const cutoffHz = Math.min(
    Number(plan.filter?.cutoffHz) || 20_000,
    sampleRate * 0.45,
  );
  const pan = Math.max(-1, Math.min(1, Number(plan.stereoPan) || 0));
  const panAngle = (pan + 1) * Math.PI / 4;
  return {
    startFrame,
    response: plan.response,
    gain: Number(plan.gain) || 0,
    coefficient: 1 - Math.exp(-2 * Math.PI * cutoffHz / sampleRate),
    filterA: 0,
    filterB: 0,
    leftGain: Math.cos(panAngle),
    rightGain: Math.sin(panAngle),
    channelWeights: Float64Array.from(
      Array.from({ length: 8 }, (_, index) => (
        Number.isFinite(Number(plan.channelWeights?.[index]))
          ? Number(plan.channelWeights[index])
          : 0
      )),
    ),
  };
}

export function createRainBlockAccumulator({
  sampleRate = 48_000,
  channelCount = 1,
  startFrame = 0,
} = {}) {
  const rate = Math.max(8_000, Number(sampleRate) || 48_000);
  const channels = channelCount === 2 ? 2 : 1;
  let frame = finiteInteger(startFrame);
  let pending = [];
  let active = [];

  function schedule(scheduledFrame, plan) {
    if (!(plan?.response instanceof Float32Array)) {
      throw new TypeError("Rain block accumulation requires a prepared Arrival plan.");
    }
    const voice = createVoice(finiteInteger(scheduledFrame), plan, rate);
    const previous = pending[pending.length - 1];
    pending.push(voice);
    if (previous && previous.startFrame > voice.startFrame) {
      pending.sort((left, right) => left.startFrame - right.startFrame);
    }
  }

  function renderBlock(frameCount, includeOptical) {
    const length = finiteInteger(frameCount);
    const output = Array.from({ length: channels }, () => new Float32Array(length));
    const optical = includeOptical
      ? Array.from({ length: 8 }, () => new Float32Array(length))
      : null;

    for (let blockIndex = 0; blockIndex < length; blockIndex += 1) {
      while (pending[0]?.startFrame <= frame) {
        active.push(pending.shift());
      }

      let mono = 0;
      let left = 0;
      let right = 0;
      let survivorCount = 0;
      for (let voiceIndex = 0; voiceIndex < active.length; voiceIndex += 1) {
        const voice = active[voiceIndex];
        const responseIndex = frame - voice.startFrame;
        if (responseIndex < 0 || responseIndex >= voice.response.length) continue;
        voice.filterA += voice.coefficient
          * (voice.response[responseIndex] - voice.filterA);
        voice.filterB += voice.coefficient * (voice.filterA - voice.filterB);
        const sample = voice.filterB * voice.gain;
        if (channels === 1) {
          mono += sample;
        } else {
          left += sample * voice.leftGain;
          right += sample * voice.rightGain;
        }
        if (optical) {
          for (let channel = 0; channel < optical.length; channel += 1) {
            optical[channel][blockIndex] += sample * voice.channelWeights[channel];
          }
        }
        if (responseIndex + 1 < voice.response.length) {
          active[survivorCount] = voice;
          survivorCount += 1;
        }
      }
      active.length = survivorCount;

      if (channels === 1) output[0][blockIndex] = mono;
      else {
        output[0][blockIndex] = left;
        output[1][blockIndex] = right;
      }
      frame += 1;
    }

    return includeOptical ? { audio: output, optical } : output;
  }

  function render(frameCount) {
    return renderBlock(frameCount, false);
  }

  function renderWithOptical(frameCount) {
    return renderBlock(frameCount, true);
  }

  function reset(nextFrame = frame) {
    frame = finiteInteger(nextFrame, frame);
    pending = [];
    active = [];
  }

  return Object.freeze({
    schedule,
    render,
    renderWithOptical,
    reset,
    get currentFrame() { return frame; },
  });
}
