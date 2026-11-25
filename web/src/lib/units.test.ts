import { test, expect } from 'vitest';
import { scaled, display, minor } from './units';
test('custom distance preserves tenths while miles convert instead of relabelling', () => {
  expect(scaled('500.1', 'km')).toBe(500100);
  expect(scaled('1', 'mi')).toBe(1609);
  expect(display(1609344, 'mi')).toBe('1000');
});
test('decimal money is parsed exactly and excessive precision is rejected', () => {
  expect(minor('19.99')).toBe(1999);
  expect(minor('-12,05')).toBe(-1205);
  expect(() => minor('12.001')).toThrow();
  expect(() => scaled('NaN', 'km')).toThrow();
});
