import {
  test,
  expect,
  type Page,
  type APIRequestContext
} from '@playwright/test';

async function seed(page: Page, request: APIRequestContext) {
  const profile = await (
    await request.post('/api/profiles', {
      headers: { 'X-Roadbook-Request': '1' },
      data: { name: `Charts ${Date.now()}` }
    })
  ).json();
  const headers = {
    'X-Roadbook-Request': '1',
    'X-Roadbook-Profile': profile.id
  };
  const vehicle = await (
    await request.post('/api/vehicles', {
      headers,
      data: { name: 'Chart car', kind: 'car', members: [profile.id] }
    })
  ).json();
  await page.addInitScript(
    ({ p, v }) => {
      localStorage.setItem('roadbook-profile', p);
      localStorage.setItem('roadbook-vehicle', v);
      localStorage.setItem('roadbook-language', 'en');
    },
    { p: profile.id, v: vehicle.id }
  );
  return { headers, vehicle };
}
test('history date shortcuts filter both tabs and allow custom dates and reset', async ({
  page,
  request
}) => {
  const { headers, vehicle } = await seed(page, request);
  await page.clock.setFixedTime(new Date('2025-08-31T12:00:00Z'));
  for (const kind of ['fuel', 'expense']) {
    for (const date of [
      '2025-08-25',
      '2025-08-24',
      '2025-08-02',
      '2025-02-28'
    ]) {
      expect(
        (
          await request.post('/api/entries', {
            headers,
            data: {
              vehicle_id: vehicle.id,
              kind,
              date,
              amount_minor: 1000,
              category: 'service',
              tank: 'full'
            }
          })
        ).ok()
      ).toBe(true);
    }
    await page.goto(kind === 'fuel' ? '/fuel' : '/costs');
    const shortcuts = page.getByRole('group', { name: 'Date range shortcuts' });
    await expect(page.locator('.history-entry')).toHaveCount(4);
    await shortcuts
      .getByRole('button', { name: '7 days', exact: true })
      .click();
    await expect(page.getByLabel('From', { exact: true })).toHaveValue(
      '2025-08-25'
    );
    await expect(page.getByLabel('Through', { exact: true })).toHaveValue(
      '2025-08-31'
    );
    await expect(page.locator('.history-entry')).toHaveCount(1);
    await expect(
      shortcuts.getByRole('button', { name: '7 days', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('From', { exact: true }).fill('2025-08-24');
    await expect(shortcuts.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(page.locator('.history-entry')).toHaveCount(2);
    await shortcuts
      .getByRole('button', { name: '30 days', exact: true })
      .click();
    await expect(page.locator('.history-entry')).toHaveCount(3);
    await shortcuts
      .getByRole('button', { name: '6 months', exact: true })
      .click();
    await expect(page.getByLabel('From', { exact: true })).toHaveValue(
      '2025-02-28'
    );
    await expect(page.locator('.history-entry')).toHaveCount(4);
    await page.getByLabel('From', { exact: true }).fill('2025-09-01');
    await expect(
      page.getByRole('heading', { name: 'No entries in this date range.' })
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Show all dates', exact: true })
      .click();
    await expect(page.getByLabel('From', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Through', { exact: true })).toHaveValue('');
    await expect(
      shortcuts.getByRole('button', { name: 'All dates', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.history-entry')).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  }
});
test('full-fill import default updates local examples, server review and saved records', async ({
  page,
  request
}) => {
  const { headers } = await seed(page, request);
  await page.goto('/settings#import');
  await page.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: 'synthetic.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Date,Paid,Litres,Km\n01.01.2025,60,40,500\n01.02.2025,50,30,500'
    )
  });
  for (const [name, value] of [
    ['Date column', '0'],
    ['Amount paid column', '1'],
    ['Fuel volume column', '2'],
    ['Distance driven column', '3']
  ])
    await page.getByRole('combobox', { name, exact: true }).selectOption(value);
  await expect(
    page.getByRole('combobox', {
      name: 'Filled to full? column',
      exact: true
    })
  ).toHaveValue('full');
  await expect(page.locator('.import-example').first()).toContainText(
    'Full fill'
  );
  await page
    .getByRole('button', { name: 'Preview import', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Fill type row 2', exact: true })
  ).toHaveValue('full');
  await page
    .getByRole('combobox', { name: 'Fill type row 3', exact: true })
    .selectOption('partial');
  await page
    .getByRole('button', { name: 'Import 2 selected rows', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Imported 2');
  const state = await (await request.get('/api/state', { headers })).json();
  expect(state.state.records.map((r: { tank: string }) => r.tank)).toEqual([
    'full',
    'partial'
  ]);
  expect(state.state.records[0].extra['import:tank_override']).toBe('full');
});
test('fill assumptions and source columns share one mapping control', async ({
  page,
  request
}) => {
  await seed(page, request);
  await page.goto('/settings#import');
  await page.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: 'synthetic.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Date,Full\n01.01.2025,partial\n02.01.2025,full')
  });
  await expect(
    page.getByRole('combobox', {
      name: 'Fill type for this import',
      exact: true
    })
  ).toHaveCount(0);
  const fill = page.getByRole('combobox', {
    name: 'Filled to full? column',
    exact: true
  });
  await expect(fill).toHaveValue('full');
  await page
    .getByRole('combobox', { name: 'Date column', exact: true })
    .selectOption('0');
  await fill.selectOption('1');
  await expect(page.locator('.import-example').first()).toContainText(
    'Partial fill'
  );
  await page
    .getByRole('button', { name: 'Preview import', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Fill type row 2', exact: true })
  ).toHaveValue('partial');
  await fill.selectOption('full');
  await expect(page.getByRole('heading', { name: /^Review/ })).toHaveCount(0);
  await expect(page.locator('.import-example').first()).toContainText(
    'Full fill'
  );
  await page
    .getByRole('button', { name: 'Use column 2: Full', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Map Filled to full?', exact: true })
    .click();
  await expect(fill).toHaveValue('1');
  await page
    .getByRole('button', { name: 'Clear Filled to full?', exact: true })
    .click();
  await expect(fill).toHaveValue('unknown');
  await fill.selectOption('partial');
  await expect(page.locator('.import-example').first()).toContainText(
    'Partial fill'
  );
  const previewRequest = page.waitForRequest((r) =>
    r.url().endsWith('/api/import/preview')
  );
  await page
    .getByRole('button', { name: 'Preview import', exact: true })
    .click();
  const submitted = (await previewRequest).postDataJSON();
  expect(submitted.tank_override).toBe('partial');
  expect(submitted.columns.tank).toBeUndefined();
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.setData('application/x-roadbook-column', '1');
    return data;
  });
  await page
    .locator('.mapping-target[data-field="tank"]')
    .dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
  await expect(fill).toHaveValue('1');
  await page.locator('.import-format > summary').click();
  await page
    .getByRole('combobox', { name: 'Delimiter', exact: true })
    .selectOption(';');
  await expect(fill).toHaveValue('unknown');
});
test('consumption chart uses complete intervals, weighted months and visible gaps', async ({
  page,
  request
}) => {
  const { headers, vehicle } = await seed(page, request);
  await page.goto('/');
  const chart = page.locator('.chart').filter({
    has: page.getByRole('heading', {
      name: 'Fuel consumption over time',
      exact: true
    })
  });
  await expect(chart).toContainText('No recorded data yet.');
  for (const [date, tank, volume_ml, distance_m, gap] of [
    ['2025-01-01', 'full', 40000, 500000, false],
    ['2025-02-01', 'full', 10000, 100000, false],
    ['2025-02-05', 'partial', 10000, 300000, false],
    ['2025-02-20', 'full', 20000, 600000, false],
    ['2025-03-01', 'full', 20000, 400000, true],
    ['2025-04-01', 'full', 30000, 500000, false],
    ['2025-06-01', 'full', 30000, 500000, false],
    ['2025-07-01', 'partial', 10000, 200000, false],
    ['2025-08-01', 'full', 20000, 300000, false],
    ['2025-09-01', 'unknown', 20000, 400000, false]
  ]) {
    expect(
      (
        await request.post('/api/entries', {
          headers,
          data: {
            vehicle_id: vehicle.id,
            kind: 'fuel',
            date,
            tank,
            volume_ml,
            distance_m,
            gap
          }
        })
      ).ok()
    ).toBe(true);
  }
  await page.reload();
  const points = chart.getByRole('button');
  await expect(points).toHaveCount(4);
  await expect(chart.locator('polyline')).toHaveCount(2);
  const segments = await chart
    .locator('polyline')
    .evaluateAll((lines) =>
      lines.map(
        (line) => line.getAttribute('points')!.trim().split(/\s+/).length
      )
    );
  expect(segments).toEqual([1, 3]);
  await expect(chart.locator('.y-axis-label')).toHaveText([
    '0 L/100 km',
    '1.50 L/100 km',
    '3 L/100 km',
    '4.50 L/100 km',
    '6 L/100 km'
  ]);
  await points.first().focus();
  await expect(chart.getByRole('tooltip')).toContainText('Feb 2025');
  await expect(chart.getByRole('tooltip')).toContainText('4 L/100 km');
  const table = chart.locator('table');
  await expect(table.locator('tbody tr')).toHaveCount(9);
  await expect(table.locator('tbody tr').nth(2)).toContainText(
    'No complete fuel interval'
  );
  await points.last().click();
  await expect(chart.getByRole('tooltip')).toContainText('6 L/100 km');
});
test('charts have quarter-value scales, usable tooltips and non-overlapping end labels', async ({
  page,
  request
}) => {
  const { headers, vehicle } = await seed(page, request);
  for (let i = 0; i < 39; i++) {
    const date = new Date(Date.UTC(2023, 7 + i, 1)).toISOString().slice(0, 10);
    expect(
      (
        await request.post('/api/entries', {
          headers,
          data: {
            kind: 'fuel',
            vehicle_id: vehicle.id,
            date,
            amount_minor: (i + 1) * 100,
            volume_ml: 30000,
            distance_m: (i + 1) * 100000,
            tank: 'full'
          }
        })
      ).ok()
    ).toBe(true);
  }
  await page.goto('/');
  const chart = page.locator('.chart').filter({
    has: page.getByRole('heading', {
      name: 'Fuel spending by month',
      exact: true
    })
  });
  await expect(chart.locator('.y-axis-label')).toHaveCount(5);
  await expect(chart.locator('.y-axis-label')).toHaveText([
    '€0.00',
    '€9.75',
    '€19.50',
    '€29.25',
    '€39.00'
  ]);
  const point = chart.getByRole('button').first();
  if (test.info().project.name === 'mobile') await point.tap();
  else await point.hover();
  await expect(chart.getByRole('tooltip')).toContainText('€1.00');
  await page.keyboard.press('Escape');
  await expect(chart.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('heading', { name: 'Overview', exact: true }).click();
  await point.focus();
  await expect(chart.getByRole('tooltip')).toContainText('Aug 2023');
  const labels = await chart.locator('.x-axis-label').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right };
    })
  );
  expect(labels.length).toBeGreaterThan(1);
  for (let i = 1; i < labels.length; i++)
    expect(labels[i].left).toBeGreaterThan(labels[i - 1].right);
  const annual = page.locator('.chart').filter({
    has: page.getByRole('heading', {
      name: 'Annual distance by vehicle',
      exact: true
    })
  });
  await expect(annual.locator('.y-axis-label')).toHaveCount(5);
  await expect(annual.locator('.y-axis-label').first()).toContainText('0 km');
  await expect(page.getByText('View values ·', { exact: false })).toHaveCount(
    0
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: `test-results/charts-${test.info().project.name}.png`,
    fullPage: true
  });
});
test('sun and moon control remembers the browser theme across reloads', async ({
  page
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page
    .getByRole('button', { name: 'Switch to light mode', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page
    .getByRole('button', { name: 'Switch to dark mode', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('short two-month chart labels stay separate on narrow screens', async ({
  page,
  request
}) => {
  const { headers, vehicle } = await seed(page, request);
  for (const date of ['2025-01-01', '2025-02-01'])
    expect(
      (
        await request.post('/api/entries', {
          headers,
          data: {
            kind: 'fuel',
            vehicle_id: vehicle.id,
            date,
            amount_minor: 1000,
            tank: 'unknown'
          }
        })
      ).ok()
    ).toBe(true);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  const labels = page.locator('.chart').first().locator('.x-axis-label');
  await expect(labels).toHaveCount(2);
  const bounds = await labels.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right };
    })
  );
  expect(bounds[1].left).toBeGreaterThan(bounds[0].right);
});

test('fuel history fits compact rows while keeping source details and editing accessible', async ({
  page,
  request
}) => {
  const { headers, vehicle } = await seed(page, request);
  for (let i = 1; i <= 12; i++)
    expect(
      (
        await request.post('/api/entries', {
          headers,
          data: {
            kind: 'fuel',
            vehicle_id: vehicle.id,
            date: `2025-01-${String(i).padStart(2, '0')}`,
            station: `Station ${i}`,
            volume_ml: 30000,
            distance_m: 500000,
            amount_minor: 5000,
            tank: 'full',
            notes: 'Station note',
            extra: {
              '10:later': 'tenth',
              '11:trailing': '',
              '12:trailing': '  ',
              '3:interior': '',
              '2:second': 'second',
              '1:source': 'kept'
            }
          }
        })
      ).ok()
    ).toBe(true);
  // Match the large-screen density complaint; row height is checked separately.
  if (test.info().project.name === 'desktop')
    await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/fuel');
  const entries = page.locator('.history-entry');
  await expect(entries).toHaveCount(12);
  const row = entries.first();
  await expect(row).toContainText('30');
  await expect(row).toContainText('500');
  if (test.info().project.name === 'desktop') {
    const heights = await entries.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height)
    );
    expect(Math.max(...heights)).toBeLessThan(145);
    expect(
      await entries.evaluateAll(
        (els) =>
          els.filter((el) => {
            const r = el.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= innerHeight;
          }).length
      )
    ).toBeGreaterThanOrEqual(4);
  }
  await page.screenshot({
    path: `test-results/compact-fuel-${test.info().project.name}.png`,
    fullPage: true
  });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(
    row.getByText('Delete this entry and its attachments?', { exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await row.getByRole('button', { name: 'Keep entry', exact: true }).click();
  await row.getByText('Imported source information', { exact: true }).click();
  await expect(row.getByText('kept', { exact: true })).toBeVisible();
  await expect(row.locator('dt')).toHaveText([
    '1:source',
    '2:second',
    '3:interior',
    '10:later'
  ]);
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Edit', exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});
