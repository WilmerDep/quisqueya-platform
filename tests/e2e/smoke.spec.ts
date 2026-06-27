import { expect, test } from '@playwright/test';

test('landing loads without production CDN warning', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', message => consoleMessages.push(message.text()));

  await page.goto('/');

  await expect(page).toHaveTitle(/PrestaFácil RD/);
  await expect(page.getByRole('heading', { name: /Controle su Capital/i })).toBeVisible();
  expect(consoleMessages.join('\n')).not.toContain('cdn.tailwindcss.com should not be used in production');
});

test('demo login requires explicit password and reaches dashboard', async ({ page }) => {
  await page.goto('/#/auth');
  await page.getByPlaceholder(/admin_rd/i).fill('admin');
  await page.getByPlaceholder('admin123').fill('admin123');
  await page.getByRole('button', { name: /Sincronizar Terminal/i }).click();

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator('body')).toContainText(/Admin Presta/i);
});
