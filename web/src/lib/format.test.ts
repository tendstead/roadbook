import { test, expect } from 'vitest';
import { money } from './format';
test('formats minor units without treating cents as whole currency', () => {
  expect(money(12345, 'EUR')).toContain('123.45');
});
