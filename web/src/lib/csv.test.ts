import { test, expect } from 'vitest';
import { parseCSV } from './csv';
test('quoted delimiters and multiline headings survive CSV inspection', () => {
  expect(
    parseCSV('Date,"Station\nname",Paid\r\n2025-01-01,"Shop, A",10', ',')
  ).toEqual([
    ['Date', 'Station\nname', 'Paid'],
    ['2025-01-01', 'Shop, A', '10']
  ]);
  expect(parseCSV('date;paid\n2025-01-01;12,50', ';')[1][1]).toBe('12,50');
});
