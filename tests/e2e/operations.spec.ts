import { expect, Page, test } from '@playwright/test';

const blockApi = async (page: Page) => {
  await page.route('http://localhost:3000/**', route => route.abort());
  await page.route('http://127.0.0.1:3000/**', route => route.abort());
};

const resetBrowserState = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
};

const loginAsAdmin = async (page: Page) => {
  await blockApi(page);
  await resetBrowserState(page);
  await page.goto('/#/auth');
  await page.getByPlaceholder(/admin_rd/i).fill('admin');
  await page.getByPlaceholder('admin123').fill('admin123');
  await page.getByRole('button', { name: /Sincronizar Terminal/i }).click();
  await expect(page).toHaveURL(/#\/$/);
};

test('admin can create and approve a client in local fallback mode', async ({ page }) => {
  await loginAsAdmin(page);

  const stamp = Date.now().toString().slice(-6);
  const firstName = `E2E${stamp}`;
  const lastName = 'Cliente';

  await page.getByRole('link', { name: /Clientes/i }).click();
  await expect(page.getByRole('heading', { name: /Expedientes/i })).toBeVisible();
  await page.getByRole('button', { name: /NUEVO CLIENTE/i }).click({ force: true });
  await expect(page.getByRole('heading', { name: /Alta de Cliente/i })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(firstName);
  await page.getByRole('textbox', { name: 'Apellido', exact: true }).fill(lastName);
  await page.locator('input[placeholder="Cédula"]').fill(`001${stamp}01`);
  await page.locator('input[placeholder="Teléfono"]').fill('809-555-0101');
  await page.locator('textarea[placeholder="Dirección de cobro"]').fill('Santo Domingo, RD');
  await page.getByRole('combobox').nth(1).selectOption({ index: 1 });
  await page.getByRole('combobox').nth(2).selectOption({ index: 1 });
  await page.getByRole('button', { name: /REGISTRAR EXPEDIENTE/i }).click();

  await expect(page.getByText(`${firstName} ${lastName}`)).toBeVisible();
  await page.getByText(`${firstName} ${lastName}`).click();
  await page.getByRole('button', { name: /^APROBAR$/i }).click();
  await page.getByRole('button', { name: /CONFIRMAR/i }).click();

  await expect(page.locator('body')).toContainText(/APROBADO/i);
});

test('admin can create a loan for an approved client', async ({ page }) => {
  await loginAsAdmin(page);

  const stamp = Date.now().toString().slice(-6);
  const firstName = `Loan${stamp}`;
  const lastName = 'Cliente';

  await page.getByRole('link', { name: /Clientes/i }).click();
  await expect(page.getByRole('heading', { name: /Expedientes/i })).toBeVisible();
  await page.getByRole('button', { name: /NUEVO CLIENTE/i }).click({ force: true });
  await expect(page.getByRole('heading', { name: /Alta de Cliente/i })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(firstName);
  await page.getByRole('textbox', { name: 'Apellido', exact: true }).fill(lastName);
  await page.locator('input[placeholder="Cédula"]').fill(`002${stamp}01`);
  await page.locator('input[placeholder="Teléfono"]').fill('809-555-0202');
  await page.locator('textarea[placeholder="Dirección de cobro"]').fill('Santiago, RD');
  await page.getByRole('combobox').nth(1).selectOption({ index: 1 });
  await page.getByRole('combobox').nth(2).selectOption({ index: 1 });
  await page.getByRole('button', { name: /REGISTRAR EXPEDIENTE/i }).click();
  await page.getByText(`${firstName} ${lastName}`).click();
  await page.getByRole('button', { name: /^APROBAR$/i }).click();
  await page.getByRole('button', { name: /CONFIRMAR/i }).click();

  await page.getByRole('button', { name: /NUEVO PR/i }).click();
  if (await page.getByRole('heading', { name: /Elegir Cliente/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: new RegExp(firstName, 'i') }).click();
    await page.getByRole('button', { name: /Siguiente Paso/i }).click();
  }
  await expect(page.getByRole('heading', { name: /Configurar/i })).toBeVisible();
  await page.getByRole('spinbutton').nth(0).fill('5000');
  await page.getByRole('spinbutton').nth(1).fill('15');
  await page.getByRole('spinbutton').nth(2).fill('5');
  await page.getByRole('button', { name: /Verificar Plan/i }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Generar Pr/i }).click();

  await expect(page.locator('body')).toContainText(/RD\$/);
});

test('reports and activity pages render operational summaries', async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole('link', { name: /Reportes/i }).click();
  await expect(page.getByRole('heading', { name: /Financiero/i })).toBeVisible();
  await expect(page.locator('body')).toContainText(/Balance en Calle/i);

  await page.getByRole('link', { name: /Actividad/i }).click();
  await expect(page.getByRole('heading', { name: /Bit.*cora Global/i })).toBeVisible();
  await expect(page.getByPlaceholder(/Buscar por cliente/i)).toBeVisible();
});

test('team permissions prevent self suspension from the UI', async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole('link', { name: /Equipo/i }).click();
  const adminCard = page.locator('div').filter({ hasText: /@admin/i }).first();
  await expect(adminCard).toContainText(/SOLO LECTURA/i);
});
