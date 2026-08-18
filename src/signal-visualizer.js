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

export function renderSignalWaveform(canvas, samples, color) {
  const { context, width, height } = prepareCanvas(canvas);
  drawGrid(context, width, height);
  context.strokeStyle = color;
  context.lineWidth = 1.35;
  context.beginPath();
  const stride = Math.max(1, Math.floor(samples.length / width));
  let point = 0;
  for (let index = 0; index < samples.length; index += stride) {
    const x = point * width / Math.max(1, Math.ceil(samples.length / stride) - 1);
    const y = height / 2 - samples[index] * height * 0.43;
    if (point === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
    point += 1;
  }
  context.stroke();
}

function heatColor(intensity) {
  const value = Math.max(0, Math.min(1, intensity));
  const red = Math.round(12 + value * 205);
  const green = Math.round(18 + value * 220);
  const blue = Math.round(15 + value * 95);
  return `rgb(${red} ${green} ${blue})`;
}

export function renderSignalSpectrogram(canvas, analysis) {
  const { context, width, height } = prepareCanvas(canvas);
  const frames = analysis.spectrogram;
  let peakPower = 0;
  for (const frame of frames) {
    for (const power of frame) peakPower = Math.max(peakPower, power);
  }
  peakPower = Math.max(peakPower, 1e-20);
  const minimumFrequency = 80;
  const maximumFrequency = analysis.sampleRate / 2;
  const frameWidth = width / frames.length;

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    for (let y = 0; y < height; y += 1) {
      const vertical = 1 - y / Math.max(1, height - 1);
      const frequency = minimumFrequency * (
        maximumFrequency / minimumFrequency
      ) ** vertical;
      const bin = Math.min(
        frame.length - 1,
        Math.round(frequency * analysis.fftSize / analysis.sampleRate),
      );
      const decibels = 10 * Math.log10(Math.max(frame[bin] / peakPower, 1e-6));
      context.fillStyle = heatColor((decibels + 60) / 60);
      context.fillRect(frameIndex * frameWidth, y, Math.ceil(frameWidth + 0.5), 1);
    }
  }

  context.fillStyle = "rgba(229, 236, 217, 0.7)";
  context.font = "9px IBM Plex Mono, monospace";
  context.fillText("24k", 7, 12);
  context.fillText("1k", 7, height * 0.58);
  context.fillText("80 Hz", 7, height - 7);
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

export function renderEmptySignal(canvas, message) {
  const { context, width, height } = prepareCanvas(canvas);
  drawGrid(context, width, height);
  context.fillStyle = "rgba(174, 188, 164, 0.42)";
  context.font = "10px IBM Plex Mono, monospace";
  context.textAlign = "center";
  context.fillText(message, width / 2, height / 2);
  context.textAlign = "start";
}
