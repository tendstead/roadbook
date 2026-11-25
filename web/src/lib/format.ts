import { display, consumption } from './units';
import { derived, get } from 'svelte/store';
import { language, type Language } from './i18n';
export function locale(value: Language = get(language)): string {
  return value === 'de' ? 'de-DE' : 'en-GB';
}
export function money(
  minor: number,
  currency = 'EUR',
  lang: Language = get(language)
): string {
  return new Intl.NumberFormat(locale(lang), {
    style: 'currency',
    currency
  }).format(minor / 100);
}
export function number(
  value: number,
  decimals = 0,
  lang: Language = get(language)
): string {
  return new Intl.NumberFormat(locale(lang), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}
// ISO calendar dates must not shift when the user's browser is in another timezone.
export function date(value: string, lang: Language = get(language)): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value + 'T00:00:00Z'));
}
export function period(value: string, lang: Language = get(language)): string {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: 'UTC',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value + '-01T00:00:00Z'));
}
export const formatters = derived(language, (lang) => ({
  money: (minor: number, currency = 'EUR') => money(minor, currency, lang),
  number: (value: number, decimals = 0) => number(value, decimals, lang),
  date: (value: string) => date(value, lang),
  period: (value: string) => period(value, lang),
  measurement: (value: number | null | undefined, unit: string): string => {
    const raw = display(value, unit);
    return raw === ''
      ? ''
      : new Intl.NumberFormat(locale(lang), {
          maximumFractionDigits: 3
        }).format(Number(raw));
  },
  consumption: (value: string, distance: string, volume: string) =>
    number(Number(consumption(value, distance, volume)), 3, lang)
}));
