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
export type ChartValue = {
  label: string;
  value: number | null;
  breakBefore?: boolean;
};
export type MeasuredValue = { label: string; value: number };

export function lineSegments(
  values: ChartValue[],
  connectMissing = false
): MeasuredValue[][] {
  const segments: MeasuredValue[][] = [];
  let current: MeasuredValue[] = [];
  for (const value of values) {
    if (value.breakBefore) current = [];
    if (value.value === null) {
      if (!connectMissing) current = [];
    } else {
      if (!current.length) segments.push(current);
      current.push({ label: value.label, value: value.value });
    }
  }
  return segments;
}
