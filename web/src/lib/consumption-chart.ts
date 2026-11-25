import type { ChartValue } from './chart-layout';

type Interval = { date: string; volume_ml: number; distance_m: number };

// Intervals are validated by the backend. Aggregate their measurements rather
// than averaging ratios. An unmeasured month alone does not imply missing fills.
export function monthlyConsumption(
  intervals: Interval[],
  dates: string[],
  breakDates: string[] = []
): ChartValue[] {
  const totals = new Map<
    string,
    { volume: number; distance: number; lastDate: string }
  >();
  for (const interval of intervals) {
    const month = interval.date.slice(0, 7);
    const total = totals.get(month) || { volume: 0, distance: 0, lastDate: '' };
    total.volume += interval.volume_ml;
    total.distance += interval.distance_m;
    if (interval.date > total.lastDate) total.lastDate = interval.date;
    totals.set(month, total);
  }
  const months = [...dates, ...intervals.map((i) => i.date)].map(
    (date) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
  );
  if (!months.length) return [];
  const first = Math.min(...months);
  const last = Math.max(...months);
  let previousDate = '';
  return Array.from({ length: last - first + 1 }, (_, offset) => {
    const month = first + offset;
    const label = `${String(Math.floor(month / 12)).padStart(4, '0')}-${String((month % 12) + 1).padStart(2, '0')}`;
    const total = totals.get(label);
    const breakBefore =
      total &&
      breakDates.some((date) => date > previousDate && date <= total.lastDate);
    if (total) previousDate = total.lastDate;
    // ml / metres has the same numeric ratio as litres / kilometres.
    return {
      label,
      ...(breakBefore ? { breakBefore: true } : {}),
      value:
        total && total.distance > 0
          ? (100 * total.volume) / total.distance
          : null
    };
  });
}
