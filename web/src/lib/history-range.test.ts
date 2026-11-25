import { expect, test } from 'vitest';
import { historyRange } from './history-range';

test('day shortcuts include today and cross month/year boundaries as calendar dates', () => {
  expect(historyRange('7', '2025-01-03')).toEqual({
    from: '2024-12-28',
    to: '2025-01-03'
  });
  expect(historyRange('30', '2025-03-30')).toEqual({
    from: '2025-03-01',
    to: '2025-03-30'
  });
});

test('six calendar months clamp to the last valid day, including leap years', () => {
  expect(historyRange('6months', '2025-08-31')).toEqual({
    from: '2025-02-28',
    to: '2025-08-31'
  });
  expect(historyRange('6months', '2024-08-31')).toEqual({
    from: '2024-02-29',
    to: '2024-08-31'
  });
  expect(historyRange('all', '2025-08-31')).toEqual({ from: '', to: '' });
});
