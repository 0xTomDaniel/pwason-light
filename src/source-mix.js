export function calculateSourceMix(position) {
  const boundedPosition = Math.min(1, Math.max(0, Number(position) || 0));
  const angle = boundedPosition * Math.PI / 2;

  return {
    generatedGain: Math.cos(angle),
    referenceGain: Math.sin(angle),
  };
}
