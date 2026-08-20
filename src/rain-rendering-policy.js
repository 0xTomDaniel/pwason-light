export const RAIN_DENSE_RESPONSE_THRESHOLD_HZ = 10_000;

export function selectRainAudioRendering(rateHz) {
  const rate = Math.max(0, Number(rateHz) || 0);
  return rate > RAIN_DENSE_RESPONSE_THRESHOLD_HZ
    ? "dense-response-field"
    : "impact-waveforms";
}
