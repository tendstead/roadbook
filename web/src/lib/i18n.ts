import { derived, writable } from 'svelte/store';
import { german } from './translations';
export type Language = 'en' | 'de';
export const language = writable<Language>('en');
const storageKey = 'roadbook-language';
export function detectLanguage(
  saved: string | null,
  preferred: readonly string[]
): Language {
  if (saved === 'en' || saved === 'de') return saved;
  return preferred[0]?.toLowerCase().split('-')[0] === 'de' ? 'de' : 'en';
}
export function setLanguage(
  next: Language,
  storage?: Pick<Storage, 'setItem'>
) {
  language.set(next);
  try {
    (storage ?? window.localStorage).setItem(storageKey, next);
  } catch {
    /* Private browsing may disable storage; the current session still works. */
  }
}
export function initializeLanguage() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {
    /* Use browser preference. */
  }
  language.set(detectLanguage(saved, navigator.languages));
  return language.subscribe((value) => {
    document.documentElement.lang = value;
  });
}
export function translate(
  locale: Language,
  key: string,
  parameters: Record<string, string | number> = {}
): string {
  const value = locale === 'de' ? (german[key] ?? key) : key;
  return value.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    String(parameters[name] ?? placeholder)
  );
}
export const translator = derived(
  language,
  (locale) => (key: string, parameters?: Record<string, string | number>) =>
    translate(locale, key, parameters)
);
// API responses retain their stable English protocol messages. Translate only known
// messages at the display boundary; never rewrite user notes, source cells or names.
export const feedback = derived(
  language,
  (locale) =>
    (input: string): string => {
      function render(value: string): string {
        if (locale === 'en' || german[value] !== undefined)
          return translate(locale, value);
        const prefix = value.match(
          /^(\d{4}-\d{2}-\d{2}|Date|amount_minor|volume_ml|distance_m|odometer_m): (.*)$/s
        );
        if (prefix) {
          const fields: Record<string, string> = {
            amount_minor: 'Amount',
            volume_ml: 'Volume',
            distance_m: 'Distance',
            odometer_m: 'Odometer'
          };
          return (
            translate(locale, fields[prefix[1]] || prefix[1]) +
            ': ' +
            render(prefix[2])
          );
        }
        for (const suffix of [
          ' Your record is saved; retry any remaining attachments.',
          ' Vehicle saved; add any missing purchase expense under Costs.'
        ]) {
          if (value.endsWith(suffix))
            return (
              render(value.slice(0, -suffix.length)) + translate(locale, suffix)
            );
        }
        const imported = value.match(
          /^Imported (\d+) new records\. Previously imported rows were skipped\.$/
        );
        if (imported)
          return translate(
            locale,
            'Imported {count} new records. Previously imported rows were skipped.',
            { count: imported[1] }
          );
        const invalidField = value.match(
          /^Correct invalid (amount_minor|volume_ml|distance_m|odometer_m) or explicitly mark it unknown before importing$/
        );
        if (invalidField)
          return translate(
            locale,
            'Correct invalid {field} or explicitly mark it unknown before importing',
            {
              field: translate(
                locale,
                {
                  amount_minor: 'Amount',
                  volume_ml: 'Volume',
                  distance_m: 'Distance',
                  odometer_m: 'Odometer'
                }[invalidField[1]]!
              )
            }
          );
        const failed = value.match(/^Request failed \((\d+)\)$/);
        if (failed) return `Anfrage fehlgeschlagen (${failed[1]})`;
        return value;
      }
      return render(input);
    }
);
