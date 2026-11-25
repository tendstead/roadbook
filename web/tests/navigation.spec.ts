import { test, expect } from '@playwright/test';

test('navigation keeps all destinations accessible with compact mobile icons', async ({
  page
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('roadbook-language', 'en')
  );
  await page.goto('/');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const mobile = width < 768;
    const nav = page.getByRole('navigation', {
      name: mobile ? 'Mobile navigation' : 'Main navigation',
      exact: true
    });
    await expect(nav).toBeVisible();
    for (const name of ['Overview', 'Fuel', 'Costs & upkeep', 'Settings']) {
      const link = nav.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link.locator('svg')).toBeVisible();
      const label = await link.locator('.ts-nav-label').boundingBox();
      if (mobile) expect(label?.width).toBe(1);
      else expect(label!.width).toBeGreaterThan(1);
      const box = (await link.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(
      page.getByRole('button', { name: 'Menu', exact: true })
    ).toBeHidden();
    if (mobile) {
      const add = nav.getByRole('link', { name: 'Add fuel', exact: true });
      await expect(add.locator('svg')).toBeVisible();
      expect((await add.locator('span').boundingBox())?.width).toBe(1);
    }
    await nav.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(
      nav.getByRole('link', { name: 'Settings', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  }
});
