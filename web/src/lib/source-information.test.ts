import { expect, test } from 'vitest';
import { sourceInformation } from './source-information';

test('source cells follow numeric CSV column order with metadata after the source', () => {
  const extra = {
    '10:Km / Liter': '',
    '18:': 'last value',
    '1:Date': '01.02.2025',
    '2:Gas Station': 'Synthetic station',
    '9:Costs per Km': '0,1000 €',
    'import:tank_override': 'full'
  };
  expect(sourceInformation(extra)).toEqual([
    ['1:Date', '01.02.2025'],
    ['2:Gas Station', 'Synthetic station'],
    ['9:Costs per Km', '0,1000 €'],
    ['10:Km / Liter', ''],
    ['18:', 'last value'],
    ['import:tank_override', 'full']
  ]);
  expect(Object.keys(extra)[0]).toBe('10:Km / Liter');
});

test('hides only trailing empty source columns, independently of import metadata', () => {
  const extra = {
    '1:A': 'data',
    '2:B': 'data',
    '3:C': '',
    '4:D': '0',
    '5:E': '',
    '6:F': '  ',
    'import:tank_override': 'full'
  };
  expect(sourceInformation(extra)).toEqual([
    ['1:A', 'data'],
    ['2:B', 'data'],
    ['3:C', ''],
    ['4:D', '0'],
    ['import:tank_override', 'full']
  ]);
  expect(extra['6:F']).toBe('  ');
  expect(
    sourceInformation({ '1:A': '', '2:B': ' ', 'import:tank_override': 'full' })
  ).toEqual([['import:tank_override', 'full']]);
  expect(sourceInformation({})).toEqual([]);
});
