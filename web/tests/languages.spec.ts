import { test, expect } from '@playwright/test';

test('German browser default, saved language, translated shell and exact expense entry', async ({
  browser
}, info) => {
  const context = await browser.newContext({
    ...info.project.use,
    locale: 'de-DE'
  });
  const page = await context.newPage();
  try {
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(
      page.getByRole('heading', { name: 'Einstellungen', exact: true })
    ).toBeVisible();
    const language = page.getByRole('combobox', {
      name: 'Sprache',
      exact: true
    });
    await expect(language).toHaveValue('de');
    // Per-browser preference takes priority over the browser's German locale.
    await language.selectOption('en');
    await expect(
      page.getByRole('heading', { name: 'Settings', exact: true })
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('combobox', { name: 'Language', exact: true })
    ).toHaveValue('en');
    await page
      .getByRole('combobox', { name: 'Language', exact: true })
      .selectOption('de');
    const name = `Language fixture ${info.project.name} ${Date.now()}`;
    await page.getByLabel('Fahrzeugname', { exact: true }).fill(name);
    await page
      .getByRole('button', { name: 'Fahrzeug hinzufügen', exact: true })
      .click();
    await expect(
      page.getByText('Fahrzeug gespeichert', { exact: true })
    ).toBeVisible();
    await page.goto('/costs');
    await page
      .getByRole('button', { name: 'Neue Ausgabe', exact: true })
      .click();
    await page.getByLabel('Datum', { exact: true }).fill('2026-02-03');
    await page.getByRole('textbox', { name: /^Betrag/ }).fill('12,345');
    await page
      .getByRole('combobox', { name: 'Kategorie', exact: true })
      .selectOption('service');
    await page
      .getByLabel('Beschreibung', { exact: true })
      .fill('Untranslated user text');
    await page
      .getByRole('button', { name: 'Ausgabe speichern', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'höchstens zwei Nachkommastellen'
    );
    await page.getByRole('textbox', { name: /^Betrag/ }).fill('1234,56');
    await page
      .getByRole('button', { name: 'Ausgabe speichern', exact: true })
      .click();
    await expect(
      page.getByText('Ausgabe gespeichert', { exact: true })
    ).toBeVisible();
    const entry = page
      .locator('.history-entry')
      .filter({ hasText: 'Untranslated user text' });
    await expect(entry).toContainText('1.234,56');
    await expect(entry).toContainText('03.02.2026');
    const state = await (await page.request.get('/api/state')).json();
    const saved = state.state.records.find(
      (r: { description: string; vehicle_id: string }) =>
        r.description === 'Untranslated user text' &&
        r.vehicle_id ===
          state.state.vehicles.find((v: { name: string }) => v.name === name).id
    );
    expect(saved.amount_minor).toBe(123456);
    expect(saved.category).toBe('service');
    expect(saved.date).toBe('2026-02-03');
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Übersicht', exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('Gesamtausgaben', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('1.234,56', { exact: false }).first()
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/language-de-${info.project.name}.png`,
      fullPage: true
    });
    if (info.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Menü', exact: true }).click();
      const drawer = page.getByRole('dialog');
      await expect(
        drawer.getByRole('heading', { name: 'Alle Bereiche' })
      ).toBeVisible();
      await drawer.getByRole('button', { name: 'Menü schließen' }).click();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await page.goto('/settings');
    await page
      .getByRole('combobox', { name: 'Sprache', exact: true })
      .selectOption('en');
    await page.goto('/costs');
    await expect(
      page
        .locator('.history-entry')
        .filter({ hasText: 'Untranslated user text' })
    ).toContainText('1,234.56');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  } finally {
    await context.close();
  }
});

test('German import review translates feedback and preserves source parsing and category codes', async ({
  page,
  request
}) => {
  const state = await (await request.get('/api/state')).json();
  const response = await request.post('/api/vehicles', {
    headers: { 'X-Roadbook-Request': '1' },
    data: {
      name: `Import language ${Date.now()}`,
      kind: 'car',
      members: [state.profile_id]
    }
  });
  const vehicle = await response.json();
  await page.addInitScript(
    ({ id }) => {
      localStorage.setItem('roadbook-language', 'de');
      localStorage.setItem('roadbook-vehicle', id);
    },
    { id: vehicle.id }
  );
  await page.goto('/settings');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'synthetic.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Date;Amount;Note\n03.02.2026;1234,56;Original English description\n04.02.2026;invalid;Keep original source'
    )
  });
  await page.locator('.import-format > summary').click();
  await page
    .getByRole('combobox', { name: 'Trennzeichen', exact: true })
    .selectOption(';');
  await page
    .getByRole('combobox', { name: 'Tabellentyp', exact: true })
    .selectOption('expense');
  await page
    .getByRole('combobox', { name: 'Standardkategorie', exact: true })
    .selectOption('service');
  await page
    .getByRole('combobox', { name: 'Datum Spalte', exact: true })
    .selectOption('0');
  await page
    .getByRole('combobox', { name: 'Gezahlter Betrag Spalte', exact: true })
    .selectOption('1');
  await page.locator('.mapping-optional > summary').click();
  await page
    .getByRole('combobox', { name: 'Beschreibung Spalte', exact: true })
    .selectOption('2');
  await page
    .getByRole('button', { name: 'Importvorschau', exact: true })
    .click();
  await expect(page.getByLabel('Betrag Zeile 2', { exact: true })).toHaveValue(
    '1234.56'
  );
  await expect(
    page.getByRole('cell').filter({ hasText: 'Betrag: Ungültige Zahl' })
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: '1 ausgewählte Zeilen importieren',
      exact: true
    })
    .click();
  await expect(page.getByRole('status')).toContainText(
    '1 neue Einträge importiert'
  );
  await page.goto('/costs');
  const entry = page
    .locator('.history-entry')
    .filter({ hasText: 'Original English description' });
  await expect(entry).toContainText('1.234,56');
  await entry.getByText('Importierte Quelldaten', { exact: true }).click();
  await expect(
    entry.getByText('03.02.2026', { exact: true }).last()
  ).toBeVisible();
});
