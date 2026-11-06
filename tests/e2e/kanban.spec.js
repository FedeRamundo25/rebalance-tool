import { test, expect } from '@playwright/test';

test.describe('Engineering Rebalance Tool E2E', () => {
  test('debe cargar la página principal de presentación con su título y preview', async ({ page }) => {
    await page.goto('/');

    // Verificar título principal de la landing
    await expect(page.locator('h1')).toContainText('Engineering Capacity Planning');

    // Verificar que el botón de lanzar app esté visible
    const launchButton = page.locator('a', { hasText: 'Launch Live Interactive Kanban Tool' });
    await expect(launchButton).toBeVisible();
  });

  test('debe permitir navegar hacia la aplicación interactiva', async ({ page }) => {
    await page.goto('/');

    // Hacer clic en el botón de launch
    const launchButton = page.locator('a', { hasText: 'Launch Live Interactive Kanban Tool' }).first();
    await launchButton.click();

    // Verificar que cargue la ruta de la app
    await expect(page).toHaveURL(/.*src/);
  });
});
