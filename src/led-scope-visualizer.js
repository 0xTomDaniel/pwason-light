function finiteSample(value) {
  const sample = Number(value);
  return Number.isFinite(sample) ? sample : 0;
}

/**
 * Reduces an exact sample window to display columns without normalization.
 * Positive-only plateaus remain positive because zero is not inserted into
 * each column; unresolved excursions remain represented by their extrema.
 */
export function prepareScopeEnvelope(samples, columnCount) {
  const input = samples ?? [];
  const columns = Math.max(1, Math.round(Number(columnCount) || 1));
  const minimums = new Float32Array(columns);
  const maximums = new Float32Array(columns);

  if (input.length === 0) {
    return Object.freeze({ minimums, maximums });
  }

  for (let column = 0; column < columns; column += 1) {
    const start = Math.min(
      input.length - 1,
      Math.floor(column * input.length / columns),
    );
    const end = Math.min(
      input.length,
      Math.max(start + 1, Math.floor((column + 1) * input.length / columns)),
    );
    let minimum = Infinity;
    let maximum = -Infinity;
    for (let sample = start; sample < end; sample += 1) {
      const value = finiteSample(input[sample]);
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    minimums[column] = minimum;
    maximums[column] = maximum;
  }

  return Object.freeze({ minimums, maximums });
}
