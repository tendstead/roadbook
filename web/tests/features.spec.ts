import { test, expect, type APIRequestContext } from '@playwright/test';
const headers = { 'X-Roadbook-Request': '1' };

test('editing a name preserves the untouched odometer after a miles switch', async ({
  page,
  request
}) => {
  const { profile, vehicle } = await seed(request);
  await select(page, profile, vehicle.id);
  const initial = await (await request.get('/api/state')).json();
  expect(
    (
      await request.put('/api/vehicles/' + vehicle.id, {
        headers,
        data: { ...vehicle, initial_odometer_m: 1000002 }
      })
    ).ok()
  ).toBe(true);
  expect(
    (
      await request.put('/api/settings', {
        headers,
        data: { ...initial.state.settings, distance_unit: 'mi' }
      })
    ).ok()
  ).toBe(true);
  try {
    await page.goto('/settings');
    await page
      .locator('.recent')
      .filter({ hasText: vehicle.name })
      .getByRole('button', { name: 'Edit vehicle', exact: true })
      .click();
    await page
      .getByLabel('Vehicle name', { exact: true })
      .fill('Renamed without changing distance');
    await page
      .getByRole('button', { name: 'Save vehicle', exact: true })
      .click();
    await expect(page.getByText('Vehicle saved')).toBeVisible();
    const after = await (await request.get('/api/state')).json();
    expect(
      after.state.vehicles.find((v: { id: string }) => v.id === vehicle.id)
        .initial_odometer_m
    ).toBe(1000002);
  } finally {
    await request.put('/api/settings', {
      headers,
      data: initial.state.settings
    });
  }
});
async function seed(request: APIRequestContext) {
  const response = await request.get('/api/state');
  const state = await response.json();
  const profile = state.profile_id;
  const r = await request.post('/api/vehicles', {
    headers,
    data: {
      name: `Fixture ${Date.now()}`,
      kind: 'car',
      members: [profile],
      ownership_start: '2024-01-01'
    }
  });
  expect(r.ok()).toBe(true);
  const vehicle = await r.json();
  return { profile, vehicle };
}
async function select(
  page: import('@playwright/test').Page,
  profile: string,
  vehicle: string
) {
  await page.addInitScript(
    ({ p, v }) => {
      localStorage.setItem('roadbook-profile', p);
      localStorage.setItem('roadbook-vehicle', v);
    },
    { p: profile, v: vehicle }
  );
}
test('twenty attachment entries fetch thumbnails only until explicitly opened', async ({
  page,
  request
}) => {
  const { profile, vehicle } = await seed(request);
  await select(page, profile, vehicle.id);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC',
    'base64'
  );
  for (let i = 0; i < 20; i++) {
    const r = await request.post('/api/entries', {
      headers,
      data: {
        kind: 'fuel',
        vehicle_id: vehicle.id,
        date: '2025-01-01',
        tank: 'unknown',
        amount_minor: 1000 + i
      }
    });
    expect(r.ok()).toBe(true);
    const entry = await r.json();
    const a = await request.post('/api/attachments', {
      headers,
      multipart: {
        entry_id: entry.id,
        purpose: 'dashboard',
        file: { name: 'synthetic.png', mimeType: 'image/png', buffer: png }
      }
    });
    expect(a.ok()).toBe(true);
  }
  const originals: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/original')) originals.push(r.url());
  });
  await page.goto('/fuel');
  await expect(
    page.getByRole('button', { name: 'Open dashboard: synthetic.png' })
  ).toHaveCount(20);
  await page
    .getByRole('button', { name: 'Open dashboard: synthetic.png' })
    .last()
    .scrollIntoViewIfNeeded();
  expect(originals).toEqual([]);
  await page
    .getByRole('button', { name: 'Open dashboard: synthetic.png' })
    .last()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => originals.length).toBe(1);
  await page.getByRole('button', { name: 'Close image' }).click();
});
test('reviewed CSV import is repeatable without duplicating records', async ({
  page,
  request
}) => {
  const { profile, vehicle } = await seed(request);
  await select(page, profile, vehicle.id);
  await page.goto('/settings');
  await page.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: 'synthetic.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Date,Volume,Distance,Paid\n01.01.2025,30,500,60\n01.02.2025,31,510,62'
    )
  });
  await page
    .getByRole('combobox', { name: 'Date column', exact: true })
    .selectOption('0');
  await page.getByLabel('Fuel volume column').selectOption('1');
  await page.getByLabel('Distance driven column').selectOption('2');
  await page.getByLabel('Amount paid column').selectOption('3');
  await page
    .getByRole('button', { name: 'Preview import', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Review 2 rows' })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Import 2 selected rows', exact: true })
    .click();
  await expect(
    page.getByText('Imported 2 new records.', { exact: false })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Preview import', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Import 2 selected rows', exact: true })
    .click();
  await expect(
    page.getByText('Imported 0 new records.', { exact: false })
  ).toBeVisible();
  await page.goto('/fuel');
  await expect(page.locator('.history-entry')).toHaveCount(2);
});
test('recurring costs stop at their inclusive end date and shared vehicles follow profiles', async ({
  page,
  request
}) => {
  const { profile, vehicle } = await seed(request);
  await select(page, profile, vehicle.id);
  const r = await request.post('/api/profiles', {
    headers,
    data: { name: `Other ${Date.now()}` }
  });
  const other = await r.json();
  expect(
    (
      await request.put('/api/vehicles/' + vehicle.id, {
        headers,
        data: { ...vehicle, members: [profile, other.id] }
      })
    ).ok()
  ).toBe(true);
  expect(
    (
      await request.post('/api/schedules', {
        headers,
        data: {
          template: {
            kind: 'expense',
            vehicle_id: vehicle.id,
            payer_id: profile,
            category: 'lease',
            date: '2025-01-31',
            amount_minor: 12500
          },
          first: '2025-01-31',
          end: '2025-03-31',
          months: 1,
          active: true
        }
      })
    ).ok()
  ).toBe(true);
  await page.goto('/costs');
  await expect(page.locator('.history-entry')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.history-entry')).toHaveCount(3);
  await page
    .getByRole('combobox', { name: 'Profile', exact: true })
    .selectOption(other.id);
  await expect(page.locator('.history-entry')).toHaveCount(3);
});
