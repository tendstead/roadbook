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
test('batch full-fill choice updates local examples, server review and saved records', async ({
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
  await page
    .getByRole('combobox', { name: 'Fill type for this import', exact: true })
    .selectOption('full');
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
