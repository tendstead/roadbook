import type { Entry } from './api';
import { parseCSV } from './csv';

export const dateFormats = [
  'DD.MM.YYYY',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
  'YYYY.MM.DD'
];
export interface ImportConfig {
  kind: string;
  decimal: string;
  date_format: string;
  distance_unit: string;
  fuel_unit: string;
  start_row: number;
  end_row: number;
  columns: Record<string, number>;
  default_category?: string;
}
export interface LocalPreview {
  source_row: number;
  entry: Entry;
  issues: string[];
}

export function inspectCSV(source: string, delimiter: string): string[][] {
  if (new TextEncoder().encode(source).length > 1500000)
    throw new Error('CSV exceeds 1.5 MB; split into smaller imports');
  const cells = parseCSV(source, delimiter);
  if (cells.length > 10001) throw new Error('maximum 10000 rows');
  if (cells.some((row) => row.length > 100))
    throw new Error('maximum 100 columns');
  return cells;
}

const factors: Record<string, [bigint, bigint]> = {
  money: [100n, 1n],
  km: [1000n, 1n],
  mi: [1609344n, 1000n],
  L: [1000n, 1n],
  'US gal': [3785411784n, 1000000n],
  'Imp gal': [454609n, 100n]
};
function numberValue(
  text: string,
  decimal: string,
  unit: string
): number | null {
  if (['', '-', '—'].includes(text.trim())) return null;
  let value = text
    .trim()
    .replace(/€|\$|£|EUR|USD|GBP|CHF|CAD|AUD|[ \u00a0\u202f]/g, '');
  value =
    decimal === ','
      ? value.replaceAll('.', '').replaceAll(',', '.')
      : value.replaceAll(',', '');
  if (value.length > 40 || !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))
    throw new Error('invalid number');
  const [whole, fraction = ''] = value.split('.');
  if (unit === 'money' && fraction.length > 2)
    throw new Error('money has more than two decimal places');
  const sign = value.startsWith('-') ? -1n : 1n;
  const n = BigInt((whole.replace('-', '') || '0') + fraction);
  const [a, b] = factors[unit];
  const denominator = 10n ** BigInt(fraction.length) * b;
  const rounded = sign * ((n * a + denominator / 2n) / denominator);
  if (rounded < -1000000000000n || rounded > 1000000000000n)
    throw new Error('number too large');
  if (unit !== 'money' && rounded < 0n)
    throw new Error('measurement outside supported range');
  return Number(rounded);
}
function dateValue(text: string, format: string): string {
  const pattern = format.split(/[^A-Z]/);
  const separator = format.match(/[^A-Z]/)?.[0];
  if (!separator || !dateFormats.includes(format))
    throw new Error('unsupported date format');
  const parts = text.trim().split(separator);
  if (
    parts.length !== 3 ||
    parts.some((p, i) => !/^\d+$/.test(p) || p.length !== pattern[i].length)
  )
    throw new Error('invalid date');
  const year = Number(parts[pattern.indexOf('YYYY')]);
  const month = Number(parts[pattern.indexOf('MM')]);
  const day = Number(parts[pattern.indexOf('DD')]);
  if (year < 1900 || year > 2100) throw new Error('year outside 1900–2100');
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw new Error('invalid date');
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function previewRows(
  cells: string[][],
  spec: ImportConfig
): LocalPreview[] {
  if (
    !Number.isInteger(spec.start_row) ||
    spec.start_row < 2 ||
    !Number.isInteger(spec.end_row) ||
    spec.end_row < 0
  )
    return [];
  const end = spec.end_row || cells.length;
  return cells
    .slice(spec.start_row - 1, Math.min(end, spec.start_row + 1))
    .map((row, offset) => {
      const get = (field: string) => row[spec.columns[field]] || '';
      const entry: Entry = {
        id: '',
        vehicle_id: '',
        payer_id: '',
        kind: spec.kind === 'fuel' ? 'fuel' : 'expense',
        date: '',
        amount_minor: null,
        volume_ml: null,
        distance_m: null,
        odometer_m: null,
        tank: 'unknown',
        gap: ['true', '1'].includes(get('gap').toLowerCase()),
        station: get('station'),
        fuel_type: get('fuel_type'),
        notes: get('notes'),
        category:
          get('category').trim() ||
          ('category' in spec.columns
            ? 'other'
            : spec.default_category || 'other'),
        description: get('description')
      };
      const issues: string[] = [];
      try {
        entry.date = dateValue(get('date'), spec.date_format);
      } catch (e) {
        issues.push('Date: ' + (e as Error).message);
      }
      for (const [field, unit] of [
        ['amount_minor', 'money'],
        ['volume_ml', spec.fuel_unit],
        ['distance_m', spec.distance_unit],
        ['odometer_m', spec.distance_unit]
      ] as const) {
        try {
          entry[field] = numberValue(get(field), spec.decimal, unit);
        } catch (e) {
          issues.push(field + ': ' + (e as Error).message);
        }
      }
      if (entry.kind === 'fuel') {
        const tank = get('tank').trim().toLowerCase();
        if (['full', 'voll'].includes(tank)) entry.tank = 'full';
        else if (['partial', 'teil'].includes(tank)) entry.tank = 'partial';
        else if (tank && tank !== 'unknown')
          issues.push(
            'Unrecognized tank status retained in source cells; marked unknown'
          );
        if (entry.amount_minor !== null && entry.amount_minor < 0)
          issues.push('use an expense refund for negative costs');
        if (
          entry.volume_ml === null ||
          (entry.distance_m === null && entry.odometer_m === null) ||
          entry.tank === 'unknown'
        )
          issues.push(
            'Incomplete fuel measurements or unknown tank status; consumption may be unavailable'
          );
      } else if (
        entry.amount_minor === null ||
        ![
          'repair',
          'service',
          'tyres',
          'inspection',
          'parts',
          'purchase',
          'insurance',
          'tax',
          'lease',
          'parking',
          'toll',
          'other'
        ].includes(entry.category)
      )
        issues.push('expense requires an amount and category');
      if (
        spec.kind === 'schedule' &&
        ![
          'monthly',
          'quarterly',
          'annually',
          'annual',
          'yearly',
          '1',
          '3',
          '12'
        ].includes(get('frequency').trim().toLowerCase())
      )
        issues.push('invalid recurring expense dates or frequency');
      if (spec.kind === 'schedule' && get('end_date').trim()) {
        try {
          const end = dateValue(get('end_date'), spec.date_format);
          if (entry.date && end < entry.date)
            issues.push('invalid recurring expense dates or frequency');
        } catch (e) {
          issues.push('Last due date: ' + (e as Error).message);
        }
      }
      return { source_row: spec.start_row + offset, entry, issues };
    });
}
