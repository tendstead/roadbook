import {
  test,
  expect,
  type Page,
  type APIRequestContext
} from '@playwright/test';

async function setup(page: Page, request: APIRequestContext, vehicle = true) {
  const profile = await (
    await request.post('/api/profiles', {
      headers: { 'X-Roadbook-Request': '1' },
      data: { name: `Import ${Date.now()}` }
    })
  ).json();
  const headers = {
    'X-Roadbook-Request': '1',
    'X-Roadbook-Profile': profile.id
  };
  const car = vehicle
    ? await (
        await request.post('/api/vehicles', {
          headers,
          data: { name: 'Workspace car', kind: 'car', members: [profile.id] }
        })
      ).json()
    : null;
  await page.addInitScript(
    ({ p, v }) => {
      localStorage.setItem('roadbook-profile', p);
      localStorage.setItem('roadbook-language', 'en');
      if (v) localStorage.setItem('roadbook-vehicle', v);
    },
    { p: profile.id, v: car?.id || '' }
  );
  return { headers, car };
}
async function file(page: Page) {
  await page.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: 'synthetic.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Date;Paid;Litres;Distance;Memo\n04/05/2025;54,45;30,25;500,1;First note\n05/06/2025;60;32;510;Second note'
    )
  });
  await page
    .getByRole('combobox', { name: 'Delimiter', exact: true })
    .selectOption(';');
  await page
    .getByRole('combobox', { name: 'Date format', exact: true })
    .selectOption('DD/MM/YYYY');
}
test('empty history banner links to import and follows first record lifecycle', async ({
  page,
  request
}) => {
  const { headers, car } = await setup(page, request);
  await page.goto('/');
  const banner = page.getByRole('region', { name: 'Import existing history' });
  await expect(banner).toBeVisible();
  await banner.getByRole('link', { name: 'Import CSV' }).click();
  await expect(page).toHaveURL(/\/settings#import$/);
  await expect(banner).toHaveCount(0);
  await expect(page.locator('#import')).toBeInViewport();
  const response = await request.post('/api/entries', {
    headers,
    data: {
      vehicle_id: car.id,
      kind: 'fuel',
      date: '2025-01-01',
      amount_minor: 1000,
      tank: 'unknown'
    }
  });
  expect(response.ok()).toBe(true);
  const entry = await response.json();
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Fuel spending by month' })
  ).toBeVisible();
  await expect(banner).toHaveCount(0);
  expect(
    (await request.delete('/api/entries/' + entry.id, { headers })).ok()
  ).toBe(true);
  await page.reload();
  await expect(banner).toBeVisible();
});
test('mapping examples stay local, match history and invalidate changed review', async ({
  page,
  request
}) => {
  await setup(page, request);
  const sent: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/import')) sent.push(r.url());
  });
  await page.goto('/settings#import');
  await file(page);
  await expect(
    page.getByRole('button', { name: 'Use column 1: Date', exact: true })
  ).toContainText('04/05/2025');
  await page
    .getByRole('button', { name: 'Use column 1: Date', exact: true })
    .click();
  await page.getByRole('button', { name: 'Map Date', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Amount paid column', exact: true })
    .selectOption('1');
  await page
    .getByRole('combobox', { name: 'Fuel volume column', exact: true })
    .selectOption('2');
  await page
    .getByRole('combobox', { name: 'Distance driven column', exact: true })
    .selectOption('3');
  await page
    .getByRole('combobox', { name: 'Notes column', exact: true })
    .selectOption('4');
  const examples = page.locator('.import-example');
  await expect(examples).toHaveCount(2);
  await expect(examples.first()).toContainText('30.25');
  await expect(examples.first()).toContainText('500.1');
  await expect(examples.first()).toContainText('54.45');
  await expect(examples.first()).toContainText('First note');
  expect(sent).toEqual([]);
  await page.screenshot({
    path: `test-results/import-workspace-${test.info().project.name}.png`,
    fullPage: true
  });
  await page
    .getByRole('button', { name: 'Preview import', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Review 2 rows' })
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Date format', exact: true })
    .selectOption('MM/DD/YYYY');
  await expect(
    page.getByRole('heading', { name: 'Review 2 rows' })
  ).toHaveCount(0);
  await expect(examples.first()).toContainText('05/04/2025');
  await page
    .getByRole('button', { name: 'Preview import', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Import 2 selected rows', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    'Imported 2 new records'
  );
  await page.goto('/fuel');
  await expect(page.locator('.history-entry')).toHaveCount(2);
  await expect(
    page.locator('.history-entry').filter({ hasText: 'First note' })
  ).toContainText('54.45');
});
test('drop file, drag column, keyboard mapping and source units work without overflow', async ({
  page,
  request
}) => {
  await setup(page, request);
  await page.goto('/settings#import');
  const transfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(
      new File(
        ['Date,Volume,Distance,Paid\n2025.04.05,1,1,12.50'],
        'synthetic.csv',
        { type: 'text/csv' }
      )
    );
    return dt;
  });
  await page
    .getByRole('region', { name: 'Drop CSV file' })
    .dispatchEvent('drop', { dataTransfer: transfer });
  await page
    .getByRole('combobox', { name: 'Date format', exact: true })
    .selectOption('YYYY.MM.DD');
  await page
    .getByRole('combobox', { name: 'Decimal separator', exact: true })
    .selectOption('.');
  await page
    .getByRole('combobox', { name: 'Source distance unit', exact: true })
    .selectOption('mi');
  await page
    .getByRole('combobox', { name: 'Source fuel unit', exact: true })
    .selectOption('US gal');
  const chip = page.getByRole('button', {
    name: 'Use column 1: Date',
    exact: true
  });
  if (test.info().project.name === 'desktop') {
    await chip.dragTo(page.locator('[data-field="date"]'));
  } else {
    const dt = await page.evaluateHandle(() => new DataTransfer());
    await chip.dispatchEvent('dragstart', { dataTransfer: dt });
    await page
      .locator('[data-field="date"]')
      .dispatchEvent('drop', { dataTransfer: dt });
  }
  await expect(
    page.getByRole('combobox', { name: 'Date column', exact: true })
  ).toHaveValue('0');
  const volume = page.getByRole('button', {
    name: 'Use column 2: Volume',
    exact: true
  });
  await volume.focus();
  await page.keyboard.press('Enter');
  const target = page.getByRole('button', {
    name: 'Map Fuel volume',
    exact: true
  });
  await target.focus();
  await page.keyboard.press('Enter');
  await page
    .getByRole('combobox', { name: 'Distance driven column', exact: true })
    .selectOption('2');
  await page
    .getByRole('combobox', { name: 'Amount paid column', exact: true })
    .selectOption('3');
  await expect(page.locator('.import-example')).toContainText('3.785');
  await expect(page.locator('.import-example')).toContainText('1.609');
  await expect(page.locator('.import-example')).toContainText('12.50');
  await page.getByLabel('First data row', { exact: true }).fill('3');
  await expect(page.locator('.import-example')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});
test('changing configuration while server preview is pending cannot restore stale rows', async ({
  page,
  request
}) => {
  await setup(page, request);
  await page.goto('/settings#import');
  await file(page);
  await page
    .getByRole('combobox', { name: 'Date column', exact: true })
    .selectOption('0');
  await page.route('**/api/import/preview', async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ response });
  });
  const response = page.waitForResponse('**/api/import/preview');
  await page
    .getByRole('button', { name: 'Preview import', exact: true })
    .click();
  await page.getByLabel('First data row', { exact: true }).fill('3');
  await response;
  await expect(
    page.getByRole('button', { name: 'Preview import', exact: true })
  ).toBeEnabled();
  await expect(
    page.getByRole('heading', { name: 'Review 2 rows' })
  ).toHaveCount(0);
});
test('import anchor explains vehicle prerequisite without hiding setup', async ({
  page,
  request
}) => {
  await setup(page, request, false);
  await page.goto('/settings#import');
  await expect(
    page.getByText('Add a vehicle before importing.', { exact: true })
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Add your first vehicle', exact: true })
    .click();
  await expect(page.locator('#vehicle-setup')).toBeInViewport();
});
