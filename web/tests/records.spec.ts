import { test, expect } from '@playwright/test';
test('vehicle setup, full-to-full fuel and upkeep survive reload', async ({
  page
}) => {
  await page.goto('/settings');
  await page
    .getByLabel('Vehicle name', { exact: true })
    .fill(`Test car ${Date.now()}`);
  await page.getByLabel('Ownership start').fill('2025-01-01');
  await page.getByRole('button', { name: 'Add vehicle', exact: true }).click();
  await expect(page.getByText('Vehicle saved')).toBeVisible();
  await page.goto('/fuel?new=1');
  await page.getByLabel('Date', { exact: true }).fill('2025-01-01');
  await page.getByRole('textbox', { name: /^Volume/ }).fill('40');
  await page.getByRole('textbox', { name: /^Total paid/ }).fill('70');
  await page.getByLabel('Filled to full?').selectOption('full');
  await page.getByRole('button', { name: 'Save fuel', exact: true }).click();
  await expect(page.getByText('Fuel saved')).toBeVisible();
  await page
    .getByRole('button', { name: 'New fuel stop', exact: true })
    .click();
  await page.getByLabel('Date', { exact: true }).fill('2025-02-01');
  await page.getByRole('textbox', { name: /^Distance driven/ }).fill('500.1');
  await page.getByRole('textbox', { name: /^Volume/ }).fill('30');
  await page.getByRole('textbox', { name: /^Total paid/ }).fill('60');
  await page.getByLabel('Filled to full?').selectOption('full');
  await page.getByRole('button', { name: 'Save fuel', exact: true }).click();
  await expect(page.getByText('Fuel saved')).toBeVisible();
  await page.goto('/');
  await page.reload();
  await expect(page.getByTestId('consumption')).toContainText('5.999');
  await expect(page.getByText('0.1200')).toBeVisible();
  await page.screenshot({
    path: `test-results/overview-${test.info().project.name}.png`,
    fullPage: true
  });
  await page.goto('/costs');
  await page.getByRole('button', { name: 'New expense', exact: true }).click();
  await page.getByRole('textbox', { name: /^Amount/ }).fill('125');
  await page.getByLabel('Category').selectOption('service');
  await page.getByLabel('Description').fill('Synthetic service');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByText('Synthetic service')).toBeVisible();
});
