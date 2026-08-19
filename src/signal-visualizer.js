function prepareCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function drawGrid(context, width, height) {
  context.strokeStyle = "rgba(174, 188, 164, 0.1)";
  context.lineWidth = 1;
  context.beginPath();
  for (let division = 1; division < 5; division += 1) {
    const x = width * division / 5;
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let division = 1; division < 4; division += 1) {
    const y = height * division / 4;
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function drawUnscoredTail(
  context,
  width,
  height,
  minimumFrequency,
  maximumFrequency,
  evaluationMaximumFrequency,
  {
    fillStyle = "rgba(255, 237, 179, 0.055)",
    label = true,
  } = {},
) {
  if (
    !Number.isFinite(evaluationMaximumFrequency)
    || evaluationMaximumFrequency >= maximumFrequency
  ) return;
  const unscoredStart = Math.log(
    evaluationMaximumFrequency / minimumFrequency,
  ) / Math.log(maximumFrequency / minimumFrequency);
  const unscoredX = clamp(unscoredStart, 0, 1) * width;
  context.fillStyle = fillStyle;
  context.fillRect(unscoredX, 0, width - unscoredX, height);
  context.strokeStyle = "rgba(255, 237, 179, 0.4)";
  context.setLineDash([3, 3]);
  context.beginPath();
  context.moveTo(unscoredX, 0);
  context.lineTo(unscoredX, height);
  context.stroke();
  context.setLineDash([]);
  if (!label) return;
  context.fillStyle = "rgba(255, 237, 179, 0.62)";
  context.font = "8px IBM Plex Mono, monospace";
  context.textAlign = "right";
  context.fillText("UNSCORED", width - 6, 12);
  context.textAlign = "start";
}

export function prepareWaveformEnvelope(
  samples,
  columnCount,
  {
    targetPeak = 0.84,
    peakPercentile = 0.995,
    normalizationGain = null,
  } = {},
) {
  const columns = Math.max(1, Math.round(Number(columnCount) || 1));
  const input = samples ?? [];
  const minimums = new Float32Array(columns);
  const maximums = new Float32Array(columns);
  const absoluteSamples = Array.from(
    input,
    sample => Math.abs(Number(sample) || 0),
  ).sort((left, right) => left - right);
  const quantileIndex = Math.min(
    absoluteSamples.length - 1,
    Math.max(
      0,
      Math.ceil(clamp(peakPercentile, 0, 1) * (absoluteSamples.length - 1)),
    ),
  );
  const normalizationPeak = absoluteSamples.length > 0
    ? absoluteSamples[quantileIndex]
    : 0;
  const boundedTarget = clamp(Number(targetPeak) || 0.84, 0.05, 1);
  const requestedGain = Number.isFinite(normalizationGain)
    ? Math.max(0, normalizationGain)
    : null;
  const resolvedNormalizationGain = requestedGain ?? (
    normalizationPeak > 1e-12
      ? boundedTarget / normalizationPeak
      : 1
  );

  for (let column = 0; column < columns; column += 1) {
    const start = Math.floor(column * input.length / columns);
    const end = Math.max(
      start + 1,
      Math.floor((column + 1) * input.length / columns),
    );
    let minimum = 0;
    let maximum = 0;
    for (let index = start; index < Math.min(input.length, end); index += 1) {
      const value = (Number(input[index]) || 0) * resolvedNormalizationGain;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    minimums[column] = clamp(minimum, -1, 1);
    maximums[column] = clamp(maximum, -1, 1);
  }

  return Object.freeze({
    minimums,
    maximums,
    normalizationGain: resolvedNormalizationGain,
  });
}

function drawTimeMarker(context, width, height, markerFraction, label) {
  if (!Number.isFinite(markerFraction)) return;
  const x = clamp(markerFraction, 0, 1) * width;
  context.save();
  context.strokeStyle = "rgba(255, 237, 179, 0.82)";
  context.lineWidth = 1;
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, height);
  context.stroke();
  context.setLineDash([]);
  if (label) {
    context.fillStyle = "rgba(255, 237, 179, 0.9)";
    context.font = "9px IBM Plex Mono, monospace";
    context.fillText(label, Math.min(width - 56, x + 5), height - 7);
  }
  context.restore();
}

export function renderSignalWaveform(canvas, samples, color, {
  markerFraction = null,
  markerLabel = "",
  normalizationGain = null,
} = {}) {
  const { context, width, height } = prepareCanvas(canvas);
  drawGrid(context, width, height);
  const envelope = prepareWaveformEnvelope(samples, Math.round(width), {
    normalizationGain,
  });

  context.strokeStyle = color;
  context.lineWidth = 1;
  context.globalAlpha = 0.72;
  context.beginPath();
  for (let column = 0; column < envelope.minimums.length; column += 1) {
    const x = (column + 0.5) * width / envelope.minimums.length;
    const upperY = height / 2 - envelope.maximums[column] * height * 0.47;
    const lowerY = height / 2 - envelope.minimums[column] * height * 0.47;
    context.moveTo(x, upperY);
    context.lineTo(x, lowerY);
  }
  context.stroke();

  context.globalAlpha = 0.9;
  context.lineWidth = 1.15;
  context.beginPath();
  for (let column = 0; column < envelope.minimums.length; column += 1) {
    const x = column * width / Math.max(1, envelope.minimums.length - 1);
    const midpoint = (envelope.minimums[column] + envelope.maximums[column]) / 2;
    const y = height / 2 - midpoint * height * 0.47;
    if (column === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
  context.globalAlpha = 1;
  drawTimeMarker(context, width, height, markerFraction, markerLabel);
}

export function renderOnsetPopulation(canvas, population, color) {
  if (!population?.count || population.envelopeQuantiles?.length !== 3) {
    renderEmptySignal(canvas, "Aligned onset population will appear here");
    return;
  }
  const { context, width, height } = prepareCanvas(canvas);
  drawGrid(context, width, height);
  const [lower, median, upper] = population.envelopeQuantiles;
  const pointCount = Math.min(lower.length, median.length, upper.length);
  const xAt = point => point * width / Math.max(1, pointCount - 1);
  const yAt = value => height - 8 - clamp(value, 0, 1) * (height - 20);

  context.fillStyle = color;
  context.globalAlpha = 0.16;
  context.beginPath();
  for (let point = 0; point < pointCount; point += 1) {
    const x = xAt(point);
    const y = yAt(upper[point]);
    if (point === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  for (let point = pointCount - 1; point >= 0; point -= 1) {
    context.lineTo(xAt(point), yAt(lower[point]));
  }
  context.closePath();
  context.fill();

  context.globalAlpha = 0.95;
  context.strokeStyle = color;
  context.lineWidth = 1.6;
  context.beginPath();
  for (let point = 0; point < pointCount; point += 1) {
    const x = xAt(point);
    const y = yAt(median[point]);
    if (point === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
  context.globalAlpha = 1;

  drawTimeMarker(
    context,
    width,
    height,
    population.onsetOffsetSeconds / population.durationSeconds,
    "onset",
  );
  context.fillStyle = "rgba(229, 236, 217, 0.68)";
  context.font = "9px IBM Plex Mono, monospace";
  context.fillText("q10–q90 band · q50 line", 7, 12);
}

const SPECTROGRAM_COLORS = Object.freeze([
  Object.freeze([7, 9, 8]),
  Object.freeze([42, 39, 83]),
  Object.freeze([33, 145, 140]),
  Object.freeze([94, 201, 98]),
  Object.freeze([253, 231, 37]),
]);

function heatColor(intensity) {
  const value = Math.max(0, Math.min(1, intensity));
  const position = value * (SPECTROGRAM_COLORS.length - 1);
  const lowerIndex = Math.min(
    SPECTROGRAM_COLORS.length - 2,
    Math.floor(position),
  );
  const mix = position - lowerIndex;
  return SPECTROGRAM_COLORS[lowerIndex].map((channel, index) => Math.round(
    channel + (SPECTROGRAM_COLORS[lowerIndex + 1][index] - channel) * mix,
  ));
}

export function renderSignalSpectrogram(canvas, analysis, {
  markerFraction = null,
  markerLabel = "",
  powerGain = 1,
  peakPower = null,
} = {}) {
  const { context, width, height } = prepareCanvas(canvas);
  const frames = analysis.spectrogram;
  if (frames.length === 0) {
    renderEmptySignal(canvas, "No time-frequency data");
    return;
  }
  const resolvedPowerGain = Number.isFinite(powerGain)
    ? Math.max(0, powerGain)
    : 1;
  let localPeakPower = 0;
  for (const frame of frames) {
    for (const power of frame) {
      localPeakPower = Math.max(localPeakPower, power * resolvedPowerGain);
    }
  }
  const resolvedPeakPower = Number.isFinite(peakPower) && peakPower > 0
    ? peakPower
    : Math.max(localPeakPower, 1e-20);
  const minimumFrequency = 80;
  const maximumFrequency = analysis.sampleRate / 2;
  const imageWidth = canvas.width;
  const imageHeight = canvas.height;
  const pixels = context.createImageData(imageWidth, imageHeight);
  const fftSize = analysis.spectrogramFftSize ?? analysis.fftSize;

  for (let y = 0; y < imageHeight; y += 1) {
    const vertical = 1 - y / Math.max(1, imageHeight - 1);
    const frequency = minimumFrequency * (
      maximumFrequency / minimumFrequency
    ) ** vertical;
    const binPosition = Math.min(
      frames[0].length - 1,
      frequency * fftSize / analysis.sampleRate,
    );
    const lowerBin = Math.floor(binPosition);
    const upperBin = Math.min(frames[0].length - 1, lowerBin + 1);
    const frequencyMix = binPosition - lowerBin;

    for (let x = 0; x < imageWidth; x += 1) {
      const framePosition = x * (frames.length - 1) / Math.max(1, imageWidth - 1);
      const lowerFrame = Math.floor(framePosition);
      const upperFrame = Math.min(frames.length - 1, lowerFrame + 1);
      const timeMix = framePosition - lowerFrame;
      const lowerPower = frames[lowerFrame][lowerBin]
        + (frames[lowerFrame][upperBin] - frames[lowerFrame][lowerBin]) * frequencyMix;
      const upperPower = frames[upperFrame][lowerBin]
        + (frames[upperFrame][upperBin] - frames[upperFrame][lowerBin]) * frequencyMix;
      const power = (
        lowerPower + (upperPower - lowerPower) * timeMix
      ) * resolvedPowerGain;
      const decibels = 10 * Math.log10(Math.max(power / resolvedPeakPower, 1e-7));
      const color = heatColor(((decibels + 70) / 70) ** 0.9);
      const pixel = (y * imageWidth + x) * 4;
      pixels.data[pixel] = color[0];
      pixels.data[pixel + 1] = color[1];
      pixels.data[pixel + 2] = color[2];
      pixels.data[pixel + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);

  context.strokeStyle = "rgba(229, 236, 217, 0.14)";
  context.lineWidth = 1;
  context.beginPath();
  for (const fraction of [0.25, 0.5, 0.75]) {
    context.moveTo(width * fraction, 0);
    context.lineTo(width * fraction, height);
  }
  for (const frequency of [1_000, 8_000]) {
    const y = height * (1 - Math.log(frequency / minimumFrequency)
      / Math.log(maximumFrequency / minimumFrequency));
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();

  context.fillStyle = "rgba(245, 248, 237, 0.82)";
  context.font = "9px IBM Plex Mono, monospace";
  context.fillText("24k", 7, 12);
  const oneKilohertzY = height * (1 - Math.log(1_000 / minimumFrequency)
    / Math.log(maximumFrequency / minimumFrequency));
  context.fillText("1k", 7, oneKilohertzY - 4);
  context.fillText("80 Hz", 7, height - 7);
  drawTimeMarker(context, width, height, markerFraction, markerLabel);
}

function spectrumDecibels(analysis, frequency, peakPower) {
  const bin = Math.min(
    analysis.spectrum.length - 1,
    Math.max(0, Math.round(frequency * analysis.fftSize / analysis.sampleRate)),
  );
  return 10 * Math.log10(Math.max(analysis.spectrum[bin] / peakPower, 1e-6));
}

export function renderSpectrumComparison(canvas, series) {
  const { context, width, height } = prepareCanvas(canvas);
  drawGrid(context, width, height);
  const minimumFrequency = 80;
  const maximumFrequency = Math.min(
    ...series.map(item => item.analysis.sampleRate / 2),
  );
  const limitedReference = series.find(item => (
    Number.isFinite(item.evaluationMaximumFrequencyHz)
      && item.evaluationMaximumFrequencyHz < maximumFrequency
  ));
  if (limitedReference) {
    drawUnscoredTail(
      context,
      width,
      height,
      minimumFrequency,
      maximumFrequency,
      limitedReference.evaluationMaximumFrequencyHz,
    );
  }

  for (const item of series) {
    let peakPower = 0;
    for (const power of item.analysis.spectrum) peakPower = Math.max(peakPower, power);
    peakPower = Math.max(peakPower, 1e-20);
    context.strokeStyle = item.color;
    context.lineWidth = 1.5;
    context.beginPath();
    for (let x = 0; x < width; x += 1) {
      const frequency = minimumFrequency * (
        maximumFrequency / minimumFrequency
      ) ** (x / Math.max(1, width - 1));
      const decibels = spectrumDecibels(item.analysis, frequency, peakPower);
      const y = Math.max(0, Math.min(height, (-decibels / 60) * height));
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  context.fillStyle = "rgba(229, 236, 217, 0.68)";
  context.font = "9px IBM Plex Mono, monospace";
  context.fillText("80 Hz", 7, height - 7);
  context.fillText("1 kHz", width * 0.39, height - 7);
  context.fillText(`${Math.round(maximumFrequency / 1000)} kHz`, width - 38, height - 7);
}

export function renderProfileResidual(canvas, series) {
  const { context, width, height } = prepareCanvas(canvas);
  drawGrid(context, width, height);
  if (series.length === 0) {
    renderEmptySignal(canvas, "Residuals will appear when references are ready");
    return;
  }
  const magnitudes = series.flatMap(item => {
    const comparison = item.comparison;
    const values = comparison.perceptualProfileResidualDecibels
      ?? comparison.profileResidualDecibels;
    return [...values].flatMap((value, index) => (
      comparison.frequenciesHz[index]
        <= comparison.evaluationMaximumFrequencyHz
        ? [Math.abs(value)]
        : []
    ));
  }).sort((left, right) => left - right);
  const robustMagnitude = magnitudes[
    Math.floor((magnitudes.length - 1) * 0.95)
  ] ?? 12;
  const scaleDecibels = Math.min(
    36,
    Math.max(12, Math.ceil(robustMagnitude / 6) * 6),
  );
  const centerY = height / 2;

  const selectedComparison = series[0].comparison;
  const maximumFrequency = selectedComparison.frequenciesHz.at(-1);
  drawUnscoredTail(
    context,
    width,
    height,
    selectedComparison.frequenciesHz[0],
    maximumFrequency,
    selectedComparison.evaluationMaximumFrequencyHz,
  );

  context.strokeStyle = "rgba(229, 236, 217, 0.34)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, centerY);
  context.lineTo(width, centerY);
  context.stroke();

  for (const item of series) {
    const rawValues = item.comparison.profileResidualDecibels;
    const values = item.comparison.perceptualProfileResidualDecibels
      ?? rawValues;
    if (values !== rawValues) {
      context.strokeStyle = item.color;
      context.globalAlpha = 0.25;
      context.lineWidth = 0.75;
      context.beginPath();
      for (let index = 0; index < rawValues.length; index += 1) {
        const x = index * width / Math.max(1, rawValues.length - 1);
        const bounded = clamp(rawValues[index], -scaleDecibels, scaleDecibels);
        const y = centerY - bounded / scaleDecibels * height * 0.46;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      context.globalAlpha = 1;
    }
    context.strokeStyle = item.color;
    context.fillStyle = item.fillColor;
    context.lineWidth = 1.6;
    context.beginPath();
    for (let index = 0; index < values.length; index += 1) {
      const x = index * width / Math.max(1, values.length - 1);
      const bounded = clamp(values[index], -scaleDecibels, scaleDecibels);
      const y = centerY - bounded / scaleDecibels * height * 0.46;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  context.fillStyle = "rgba(229, 236, 217, 0.68)";
  context.font = "9px IBM Plex Mono, monospace";
  context.fillText(`+${scaleDecibels} dB excess`, 7, 12);
  context.fillText("0 dB", 7, centerY - 5);
  context.fillText(`−${scaleDecibels} dB missing`, 7, height - 7);
  context.fillText("80 Hz", 68, height - 7);
  context.fillText("1 kHz", width * 0.457, height - 7);
  context.fillText("20 kHz", width - 43, height - 7);
}

const RESIDUAL_MISSING = Object.freeze([34, 153, 164]);
const RESIDUAL_NEUTRAL = Object.freeze([12, 16, 13]);
const RESIDUAL_EXCESS = Object.freeze([224, 116, 69]);

function residualColor(decibels, scaleDecibels) {
  const amount = clamp(Math.abs(decibels) / scaleDecibels, 0, 1) ** 0.72;
  const target = decibels < 0 ? RESIDUAL_MISSING : RESIDUAL_EXCESS;
  return RESIDUAL_NEUTRAL.map((channel, index) => Math.round(
    channel + (target[index] - channel) * amount,
  ));
}

export function renderDistributionResidual(canvas, comparison, {
  scaleDecibels = 18,
} = {}) {
  const { context, width, height } = prepareCanvas(canvas);
  if (!comparison?.distributionResidualDecibels?.length) {
    renderEmptySignal(canvas, "Distribution residual will appear here");
    return;
  }
  const imageWidth = canvas.width;
  const imageHeight = canvas.height;
  const rows = comparison.distributionResidualDecibels;
  const pixels = context.createImageData(imageWidth, imageHeight);

  for (let y = 0; y < imageHeight; y += 1) {
    const visualRow = Math.min(
      rows.length - 1,
      Math.floor((1 - y / Math.max(1, imageHeight)) * rows.length),
    );
    const values = rows[visualRow];
    for (let x = 0; x < imageWidth; x += 1) {
      const position = x * (values.length - 1) / Math.max(1, imageWidth - 1);
      const lower = Math.floor(position);
      const upper = Math.min(values.length - 1, lower + 1);
      const value = values[lower] + (values[upper] - values[lower])
        * (position - lower);
      const color = residualColor(value, scaleDecibels);
      const pixel = (y * imageWidth + x) * 4;
      pixels.data[pixel] = color[0];
      pixels.data[pixel + 1] = color[1];
      pixels.data[pixel + 2] = color[2];
      pixels.data[pixel + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);

  const maximumFrequency = comparison.frequenciesHz.at(-1);
  drawUnscoredTail(
    context,
    width,
    height,
    comparison.frequenciesHz[0],
    maximumFrequency,
    comparison.evaluationMaximumFrequencyHz,
    { fillStyle: "rgba(5, 8, 6, 0.72)", label: false },
  );

  context.strokeStyle = "rgba(229, 236, 217, 0.16)";
  context.lineWidth = 1;
  context.beginPath();
  for (let row = 1; row < rows.length; row += 1) {
    const y = height * row / rows.length;
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  for (const fraction of [0.25, 0.5, 0.75]) {
    context.moveTo(width * fraction, 0);
    context.lineTo(width * fraction, height);
  }
  context.stroke();

  context.fillStyle = "rgba(245, 248, 237, 0.8)";
  context.font = "9px IBM Plex Mono, monospace";
  const reversedQuantiles = [...comparison.quantiles].reverse();
  reversedQuantiles.forEach((probability, row) => {
    context.fillText(
      `q${Math.round(probability * 100)}`,
      7,
      height * (row + 0.5) / reversedQuantiles.length + 3,
    );
  });
  context.fillText("80 Hz", 48, height - 7);
  context.fillText("1 kHz", width * 0.457, height - 7);
  context.fillText("20 kHz", width - 43, height - 7);
}

export function renderEmptySignal(canvas, message) {
  const { context, width, height } = prepareCanvas(canvas);
  drawGrid(context, width, height);
  context.fillStyle = "rgba(174, 188, 164, 0.42)";
  context.font = "10px IBM Plex Mono, monospace";
  context.textAlign = "center";
  context.fillText(message, width / 2, height / 2);
  context.textAlign = "start";
}
