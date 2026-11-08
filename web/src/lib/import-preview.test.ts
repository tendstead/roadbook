import { expect, test } from 'vitest';
import { inspectCSV, previewRows, type ImportConfig } from './import-preview';

const config: ImportConfig = {
  kind: 'fuel',
  decimal: ',',
  date_format: 'DD/MM/YYYY',
  distance_unit: 'km',
  fuel_unit: 'L',
  start_row: 2,
  end_row: 0,
  columns: { date: 0, amount_minor: 1, volume_ml: 2, distance_m: 3, notes: 4 }
};
test('local examples preserve exact localized money, units and unknown tank status', () => {
  const cells = inspectCSV(
    'Date;Paid;Litres;Km;Notes\n04/05/2025;1.234,56 €;30,125;500,1;keep\n05/05/2025;-;-;;missing\n06/05/2025;3;2;1;third',
    ';'
  );
  const rows = previewRows(cells, config);
  expect(rows).toHaveLength(2);
  expect(rows[0].entry).toMatchObject({
    date: '2025-05-04',
    amount_minor: 123456,
    volume_ml: 30125,
    distance_m: 500100,
    tank: 'unknown',
    odometer_m: null,
    notes: 'keep'
  });
  expect(rows[1].entry).toMatchObject({
    amount_minor: null,
    volume_ml: null,
    distance_m: null
  });
  expect(rows[1].issues).toContain(
    'Incomplete fuel measurements or unknown tank status; consumption may be unavailable'
  );
});
test('explicit date interpretation, ranges and source units change the live examples', () => {
  const cells = [
    ['Date', 'Paid', 'Litres', 'Distance'],
    ['04/05/2025', '12,50', '1', '1'],
    ['05/06/2025', '13', '2', '2']
  ];
  const row = previewRows(cells, {
    ...config,
    start_row: 3,
    end_row: 3,
    date_format: 'MM/DD/YYYY',
    distance_unit: 'mi',
    fuel_unit: 'US gal'
  })[0];
  expect(row.source_row).toBe(3);
  expect(row.entry).toMatchObject({
    date: '2025-05-06',
    volume_ml: 7571,
    distance_m: 3219,
    amount_minor: 1300
  });
  expect(previewRows(cells, { ...config, start_row: 4 })).toEqual([]);
});
test('invalid dates and numbers are visible rather than normalized or guessed', () => {
  const rows = previewRows(
    [
      ['Date', 'Paid'],
      ['31/02/2025', '12,345'],
      ['25/05/0204', 'no']
    ],
    config
  );
  expect(rows[0].entry.date).toBe('');
  expect(rows[0].entry.amount_minor).toBeNull();
  expect(rows[0].issues).toContain('Date: invalid date');
  expect(rows[0].issues).toContain(
    'amount_minor: money has more than two decimal places'
  );
  expect(rows[1].issues).toContain('Date: year outside 1900–2100');
  expect(
    previewRows([['Date'], ['2026.10.31']], {
      ...config,
      date_format: 'YYYY.MM.DD'
    })[0].entry.date
  ).toBe('2026-10-31');
});
test('inspection accepts quoted cells and enforces source limits without retaining empty physical lines', () => {
  expect(
    inspectCSV('Date;Notes\r\n\r\n2025-01-01;"one\ntwo"\r\n', ';')
  ).toEqual([
    ['Date', 'Notes'],
    ['2025-01-01', 'one\ntwo']
  ]);
  expect(() => inspectCSV('x'.repeat(1500001), ',')).toThrow();
  expect(() => inspectCSV(Array(101).fill('a').join(','), ',')).toThrow();
  expect(() => inspectCSV('a\n' + 'b\n'.repeat(10001), ',')).toThrow();
  expect(() => inspectCSV('Date\n"unterminated', ',')).toThrow();
});

test('local inspection rejects invalid quoting and preserves quoted empty rows like the server', () => {
  expect(() => inspectCSV('Date,Note\n2025-01-01,bad"quote', ',')).toThrow();
  expect(() => inspectCSV('Date,Note\n2025-01-01,"closed"junk', ',')).toThrow();
  expect(inspectCSV('Date,Note\n2025-01-01,"one\r\ntwo"\n""\n', ',')).toEqual([
    ['Date', 'Note'],
    ['2025-01-01', 'one\ntwo'],
    ['']
  ]);
});

test('expense and schedule examples flag invalid categories and end dates without losing refunds', () => {
  const cells = [
    ['Date', 'Paid', 'Category', 'Frequency', 'End'],
    ['01/01/2025', '-12,50', 'repair', 'monthly', '31/02/2025'],
    ['02/01/2025', '20', 'invalid', 'weekly', '']
  ];
  const rows = previewRows(cells, {
    ...config,
    kind: 'schedule',
    columns: {
      date: 0,
      amount_minor: 1,
      category: 2,
      frequency: 3,
      end_date: 4
    }
  });
  expect(rows[0].entry.amount_minor).toBe(-1250);
  expect(rows[0].issues).toContain('Last due date: invalid date');
  expect(rows[1].issues).toContain('expense requires an amount and category');
  expect(rows[1].issues).toContain(
    'invalid recurring expense dates or frequency'
  );
});

test('mapped blank categories match Other in server review while unmapped categories use the selected default', () => {
  const cells = [
    ['Date', 'Paid', 'Category'],
    ['01/01/2025', '12,50', '']
  ];
  const spec = { ...config, kind: 'expense', default_category: 'repair' };
  expect(
    previewRows(cells, {
      ...spec,
      columns: { date: 0, amount_minor: 1, category: 2 }
    })[0].entry.category
  ).toBe('other');
  expect(
    previewRows(cells, { ...spec, columns: { date: 0, amount_minor: 1 } })[0]
      .entry.category
  ).toBe('repair');
});

test('embedded newlines and tabs in numeric cells remain invalid rather than joining digits', () => {
  for (const value of ['12\n34', '12\t34']) {
    const row = previewRows(
      [
        ['Date', 'Paid'],
        ['01/01/2025', value]
      ],
      config
    )[0];
    expect(row.entry.amount_minor).toBeNull();
    expect(row.issues).toContain('amount_minor: invalid number');
  }
});
