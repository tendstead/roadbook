import { expect, test } from 'vitest';
import { labelIndexes } from './chart-layout';

test('month labels include endpoints without crowding the last two labels', () => {
  expect(labelIndexes(39, 6)).toEqual([0, 8, 15, 23, 30, 38]);
  expect(labelIndexes(39, 2)).toEqual([0, 38]);
  expect(labelIndexes(1, 6)).toEqual([0]);
  expect(labelIndexes(0, 6)).toEqual([]);
});
