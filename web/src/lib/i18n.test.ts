import { afterEach, expect, test } from 'vitest';
import { get } from 'svelte/store';
import {
  language,
  detectLanguage,
  translate,
  translator,
  setLanguage
} from './i18n';
import { money, date, number } from './format';
afterEach(() => language.set('en'));
test('uses an explicit supported preference before browser language, with English fallback', () => {
  expect(detectLanguage('en', ['de-DE'])).toBe('en');
  expect(detectLanguage(null, ['de-AT', 'en'])).toBe('de');
  expect(detectLanguage('broken', ['fr-FR'])).toBe('en');
});
test('translates parameters and reacts to language changes without changing user content', () => {
  expect(translate('de', 'Settings')).toBe('Einstellungen');
  expect(translate('de', 'Import {count} selected rows', { count: 3 })).toBe(
    '3 ausgewählte Zeilen importieren'
  );
  expect(translate('de', 'Our Golf')).toBe('Our Golf');
  language.set('de');
  expect(get(translator)('Fuel')).toBe('Tanken');
});
test('stores the preference but works when browser storage is blocked', () => {
  const values = new Map<string, string>();
  setLanguage('de', {
    setItem: (key, value) => {
      values.set(key, value);
    }
  });
  expect(values.get('roadbook-language')).toBe('de');
  expect(() =>
    setLanguage('en', {
      setItem: () => {
        throw new Error('blocked');
      }
    })
  ).not.toThrow();
});
test('localizes presentation while preserving ISO dates and canonical values', () => {
  language.set('de');
  expect(money(123456, 'EUR')).toMatch(/1\.234,56\s€/);
  expect(date('2026-02-03')).toBe('03.02.2026');
  expect(number(1234.5, 3)).toBe('1.234,500');
  language.set('en');
  expect(date('2026-02-03')).toBe('03/02/2026');
});
test('feedback localizes field and interval warnings and keeps unknown technical details', async () => {
  const { feedback } = await import('./i18n');
  language.set('de');
  expect(get(feedback)('amount_minor: invalid number')).toBe(
    'Betrag: Ungültige Zahl'
  );
  expect(get(feedback)('2026-02-03: distance unavailable or zero')).toContain(
    'Strecke fehlt oder ist null'
  );
  expect(
    get(feedback)(
      'Imported 2 new records. Previously imported rows were skipped.'
    )
  ).toContain('2 neue Einträge importiert');
  expect(get(feedback)('selected import row has errors')).toBe(
    'Ausgewählte Importzeile enthält Fehler'
  );
  expect(get(feedback)('currency changed; preview the import again')).toContain(
    'Importvorschau erneut'
  );
  expect(
    get(feedback)(
      'matching record already exists; review duplicates before explicitly allowing matches'
    )
  ).toContain('prüfe Duplikate');
  expect(get(feedback)('Unexpected diagnostic XYZ')).toBe(
    'Unexpected diagnostic XYZ'
  );
});
test('all German messages preserve the named parameters of their English source', async () => {
  const { german } = await import('./translations');
  const tokens = (value: string) =>
    [...value.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
  for (const [english, translated] of Object.entries(german)) {
    expect(translated.trim(), english).not.toBe('');
    expect(tokens(translated), english).toEqual(tokens(english));
  }
});
