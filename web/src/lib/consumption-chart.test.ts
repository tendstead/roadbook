import { expect, test } from 'vitest';
import { monthlyConsumption } from './consumption-chart';
import { lineSegments } from './chart-layout';

test('monthly consumption uses summed volume and distance, with missing months as gaps', () => {
  expect(
    monthlyConsumption(
      [
        { date: '2025-02-01', volume_ml: 10000, distance_m: 100000 },
        { date: '2025-02-20', volume_ml: 30000, distance_m: 900000 },
        { date: '2025-04-01', volume_ml: 30000, distance_m: 500000 }
      ],
      ['2025-01-01', '2025-05-01']
    )
  ).toEqual([
    { label: '2025-01', value: null },
    { label: '2025-02', value: 4 },
    { label: '2025-03', value: null },
    { label: '2025-04', value: 6 },
    { label: '2025-05', value: null }
  ]);
});

test('empty or incomplete history does not invent consumption', () => {
  expect(monthlyConsumption([], [])).toEqual([]);
  expect(monthlyConsumption([], ['2025-12-01', '2026-01-01'])).toEqual([
    { label: '2025-12', value: null },
    { label: '2026-01', value: null }
  ]);
});

test('line segments break at missing values and preserve measured zero', () => {
  const values = [
    { label: 'a', value: null },
    { label: 'b', value: 0 },
    { label: 'c', value: 4 },
    { label: 'd', value: null },
    { label: 'e', value: 6 },
    { label: 'f', value: null }
  ];
  expect(lineSegments(values)).toEqual([[values[1], values[2]], [values[4]]]);
  expect(lineSegments(values, true)).toEqual([
    [values[1], values[2], values[4]]
  ]);
});

test('ordinary months without refuelling connect, while confirmed incomplete intervals break the line', () => {
  const intervals = [
    { date: '2025-01-01', volume_ml: 30000, distance_m: 500000 },
    { date: '2025-03-01', volume_ml: 30000, distance_m: 500000 },
    { date: '2025-05-01', volume_ml: 30000, distance_m: 500000 }
  ];
  const values = monthlyConsumption(intervals, [], ['2025-04-01']);
  expect(lineSegments(values, true).map((s) => s.map((v) => v.label))).toEqual([
    ['2025-01', '2025-03'],
    ['2025-05']
  ]);
});

test('a later break in a measured month affects the next measured point', () => {
  const intervals = ['2024-12-01', '2025-01-01', '2025-03-01'].map((date) => ({
    date,
    volume_ml: 30000,
    distance_m: 500000
  }));
  const values = monthlyConsumption(intervals, [], ['2025-01-15']);
  expect(lineSegments(values, true).map((s) => s.map((v) => v.label))).toEqual([
    ['2024-12', '2025-01'],
    ['2025-03']
  ]);
});
