const DENSE_CENTER_FREQUENCIES_HZ = Object.freeze([
  100, 360, 710, 1_400, 3_350, 5_500, 9_550, 18_500,
]);
const DENSE_FILTER_Q = Object.freeze([0.8, 0.8, 0.8, 0.8, 0.8, 0.75, 0.68, 0.52]);
const SIGNATURE_PROBE_RATIOS = Object.freeze([0.82, 1, 1.22]);

function finiteInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function createBandpassCoefficients(sampleRate, frequencyHz, q) {
  const frequency = Math.min(sampleRate * 0.42, frequencyHz);
  const omega = 2 * Math.PI * frequency / sampleRate;
  const alpha = Math.sin(omega) / (2 * q);
  const a0 = 1 + alpha;
  return Object.freeze({
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: -2 * Math.cos(omega) / a0,
    a2: (1 - alpha) / a0,
    frequencyHz: frequency,
    cosine: Math.cos(omega),
  });
}

function createFilterState(coefficients) {
  return {
    ...coefficients,
    input1: 0,
    input2: 0,
    output1: 0,
    output2: 0,
  };
}

function processFilter(filter, input) {
  const output = filter.b0 * input
    + filter.b1 * filter.input1
    + filter.b2 * filter.input2
    - filter.a1 * filter.output1
    - filter.a2 * filter.output2;
  filter.input2 = filter.input1;
  filter.input1 = input;
  filter.output2 = filter.output1;
  filter.output1 = output;
  return output;
}

function filterImpulseEnergy(coefficients) {
  const filter = createFilterState(coefficients);
  let energy = 0;
  for (let index = 0; index < 8_192; index += 1) {
    const sample = processFilter(filter, index === 0 ? 1 : 0);
    energy += sample * sample;
  }
  return energy;
}

function spectralProjection(samples, sampleRate, frequencyHz) {
  let real = 0;
  let imaginary = 0;
  const angularStep = 2 * Math.PI * frequencyHz / sampleRate;
  const stepCosine = Math.cos(angularStep);
  const stepSine = Math.sin(angularStep);
  let cosine = 1;
  let sine = 0;
  for (let index = 0; index < samples.length; index += 1) {
    real += samples[index] * cosine;
    imaginary -= samples[index] * sine;
    const nextCosine = cosine * stepCosine - sine * stepSine;
    sine = sine * stepCosine + cosine * stepSine;
    cosine = nextCosine;
  }
  return { real, power: real * real + imaginary * imaginary };
}

export function createRainDenseSignatures(responses, { sampleRate = 48_000 } = {}) {
  const rate = Math.max(8_000, Number(sampleRate) || 48_000);
  const coefficients = DENSE_CENTER_FREQUENCIES_HZ.map(
    (frequency, index) => createBandpassCoefficients(
      rate,
      frequency,
      DENSE_FILTER_Q[index],
    ),
  );
  const impulseEnergies = coefficients.map(filterImpulseEnergy);

  return Object.freeze((responses ?? []).map(response => {
    if (!(response instanceof Float32Array)) return new Float32Array(8);
    const responseEnergy = response.reduce(
      (sum, sample) => sum + sample * sample,
      0,
    );
    const raw = coefficients.map(({ frequencyHz }) => {
      let power = 0;
      let centerReal = 0;
      for (const ratio of SIGNATURE_PROBE_RATIOS) {
        const projection = spectralProjection(
          response,
          rate,
          Math.min(rate * 0.42, frequencyHz * ratio),
        );
        power += projection.power;
        if (ratio === 1) centerReal = projection.real;
      }
      return (centerReal < 0 ? -1 : 1)
        * Math.sqrt(power / SIGNATURE_PROBE_RATIOS.length);
    });
    const renderedEnergy = raw.reduce(
      (sum, value, index) => sum + value * value * impulseEnergies[index],
      0,
    );
    const normalization = renderedEnergy > 0
      ? Math.sqrt(responseEnergy / renderedEnergy)
      : 0;
    return Float32Array.from(raw, value => value * normalization);
  }));
}

function createAirDamping(cutoffHz, sampleRate) {
  const cutoff = Math.min(Number(cutoffHz) || 20_000, sampleRate * 0.45);
  const coefficient = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);
  return { coefficient, pole: 1 - coefficient };
}

function airDampingGain(damping, cosine) {
  const { coefficient, pole } = damping;
  const magnitude = coefficient / Math.sqrt(
    1 + pole * pole - 2 * pole * cosine,
  );
  return magnitude * magnitude;
}

export function createRainDenseAccumulator({
  sampleRate = 48_000,
  channelCount = 1,
  signatures = [],
  startFrame = 0,
} = {}) {
  const rate = Math.max(8_000, Number(sampleRate) || 48_000);
  const channels = channelCount === 2 ? 2 : 1;
  const signatureBank = signatures;
  const coefficients = DENSE_CENTER_FREQUENCIES_HZ.map(
    (frequency, index) => createBandpassCoefficients(
      rate,
      frequency,
      DENSE_FILTER_Q[index],
    ),
  );
  let frame = finiteInteger(startFrame);
  let pending = [];
  let filters = Array.from(
    { length: channels },
    () => coefficients.map(createFilterState),
  );
  let opticalFilters = Array.from(
    { length: 8 },
    () => coefficients.map(createFilterState),
  );

  function schedule(scheduledFrame, plan) {
    const signature = signatureBank[plan?.variantIndex];
    if (!(signature instanceof Float32Array) || signature.length !== 8) {
      throw new TypeError("Dense rain accumulation requires a prepared Arrival plan.");
    }
    const pan = Math.max(-1, Math.min(1, Number(plan.stereoPan) || 0));
    const panAngle = (pan + 1) * Math.PI / 4;
    const gain = Number(plan.gain) || 0;
    const arrival = {
      startFrame: finiteInteger(scheduledFrame),
      signature,
      gain,
      damping: createAirDamping(plan.filter?.cutoffHz, rate),
      leftGain: channels === 2 ? Math.cos(panAngle) : 1,
      rightGain: channels === 2 ? Math.sin(panAngle) : 0,
      channelWeights: Float64Array.from(
        Array.from({ length: 8 }, (_, index) => (
          Number.isFinite(Number(plan.channelWeights?.[index]))
            ? Number(plan.channelWeights[index])
            : 0
        )),
      ),
    };
    const previous = pending[pending.length - 1];
    pending.push(arrival);
    if (previous && previous.startFrame > arrival.startFrame) {
      pending.sort((left, right) => left.startFrame - right.startFrame);
    }
  }

  function renderBlock(frameCount, includeOptical) {
    const length = finiteInteger(frameCount);
    const output = Array.from({ length: channels }, () => new Float32Array(length));
    const optical = includeOptical
      ? Array.from({ length: 8 }, () => new Float32Array(length))
      : null;
    const inputs = Array.from(
      { length: channels },
      () => new Float64Array(coefficients.length),
    );
    const opticalInputs = includeOptical
      ? Array.from(
        { length: 8 },
        () => new Float64Array(coefficients.length),
      )
      : null;
    let pendingIndex = 0;

    for (let blockIndex = 0; blockIndex < length; blockIndex += 1) {
      for (const input of inputs) input.fill(0);
      if (opticalInputs) {
        for (const input of opticalInputs) input.fill(0);
      }
      while (pending[pendingIndex]?.startFrame <= frame) {
        const arrival = pending[pendingIndex];
        for (let band = 0; band < coefficients.length; band += 1) {
          const bandInput = arrival.signature[band]
            * arrival.gain
            * airDampingGain(arrival.damping, coefficients[band].cosine);
          inputs[0][band] += bandInput * arrival.leftGain;
          if (channels === 2) {
            inputs[1][band] += bandInput * arrival.rightGain;
          }
          if (opticalInputs) {
            for (let channel = 0; channel < opticalInputs.length; channel += 1) {
              opticalInputs[channel][band] += bandInput
                * arrival.channelWeights[channel];
            }
          }
        }
        pendingIndex += 1;
      }

      for (let channel = 0; channel < channels; channel += 1) {
        let sample = 0;
        for (let band = 0; band < coefficients.length; band += 1) {
          sample += processFilter(filters[channel][band], inputs[channel][band]);
        }
        output[channel][blockIndex] = sample;
      }
      if (optical) {
        for (let channel = 0; channel < optical.length; channel += 1) {
          let sample = 0;
          for (let band = 0; band < coefficients.length; band += 1) {
            sample += processFilter(
              opticalFilters[channel][band],
              opticalInputs[channel][band],
            );
          }
          optical[channel][blockIndex] = sample;
        }
      }
      frame += 1;
    }

    if (pendingIndex > 0) pending = pending.slice(pendingIndex);
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
    filters = Array.from(
      { length: channels },
      () => coefficients.map(createFilterState),
    );
    opticalFilters = Array.from(
      { length: 8 },
      () => coefficients.map(createFilterState),
    );
  }

  return Object.freeze({
    schedule,
    render,
    renderWithOptical,
    reset,
    get currentFrame() { return frame; },
  });
}
