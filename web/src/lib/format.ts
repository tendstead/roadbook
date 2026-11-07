export function money(minor: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(
    minor / 100
  );
}
