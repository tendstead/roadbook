import { expect, test } from 'vitest';
import { sourceInformation } from './source-information';

test('source cells follow numeric CSV column order with metadata after the source', () => {
  const extra = {
    '10:Km / Liter': '',
    '18:': '',
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
    ['18:', ''],
    ['import:tank_override', 'full']
  ]);
  expect(Object.keys(extra)[0]).toBe('10:Km / Liter');
});
