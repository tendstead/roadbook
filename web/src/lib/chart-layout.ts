// Evenly distribute labels including both endpoints, rather than appending a
// final label immediately next to a regularly spaced tick.
export function labelIndexes(length: number, maximum: number): number[] {
  if (!length) return [];
  const count = Math.min(length, Math.max(2, maximum));
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, i) =>
    Math.round((i * (length - 1)) / (count - 1))
  );
}
