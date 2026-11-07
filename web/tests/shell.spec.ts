import { test, expect } from '@playwright/test';
test('shell supports direct navigation on mobile and desktop', async ({
  page
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Overview', exact: true })
  ).toBeVisible();
  await page.goto('/fuel');
  await expect(
    page.getByRole('heading', { name: 'Fuel', exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});
