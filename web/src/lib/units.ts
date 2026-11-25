const factors: Record<string, [bigint, bigint]> = {
  km: [1000n, 1n],
  mi: [1609344n, 1000n],
  L: [1000n, 1n],
  'US gal': [3785411784n, 1000000n],
  'Imp gal': [454609n, 100n]
};
function fraction(text: string): [bigint, bigint] {
  const s = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,6})?$/.test(s))
    throw new Error('Enter a number with up to six decimal places');
  const [whole, decimal = ''] = s.split('.');
  return [BigInt(whole + decimal), 10n ** BigInt(decimal.length)];
}
export function scaled(text: string, unit: string): number | null {
  if (!text.trim()) return null;
  const [n, d] = fraction(text);
  const [a, b] = factors[unit];
  const result = Number(
    (n * a + (n >= 0n ? (d * b) / 2n : (-d * b) / 2n)) / (d * b)
  );
  if (!Number.isSafeInteger(result) || result < 0 || result > 1e12)
    throw new Error('Measurement outside supported range');
  return result;
}
export function display(
  value: number | null | undefined,
  unit: string
): string {
  if (value == null) return '';
  const [a, b] = factors[unit];
  return ((value * Number(b)) / Number(a)).toFixed(3).replace(/\.?0+$/, '');
}
export function minor(text: string): number | null {
  if (!text.trim()) return null;
  const s = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s))
    throw new Error('Use at most two decimal places for money');
  const [n, d] = fraction(s);
  const v = Number((n * 100n) / d);
  if (!Number.isSafeInteger(v) || Math.abs(v) > 1e12)
    throw new Error('Amount outside supported range');
  return v;
}
export function moneyInput(value: number | null | undefined): string {
  return value == null ? '' : (value / 100).toFixed(2);
}
export function consumption(
  value: string,
  distance: string,
  volume: string
): string {
  const distanceFactor = distance === 'mi' ? 1.609344 : 1;
  const [a, b] = factors[volume];
  return (
    (Number(value) * distanceFactor) /
    (Number(a) / Number(b) / 1000)
  ).toFixed(3);
}
