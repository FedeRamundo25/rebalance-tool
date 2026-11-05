import { test, expect } from '@playwright/test';

test.describe('Engineering Rebalance Tool E2E', () => {
  test('debe cargar la aplicación y mostrar el tablero Kanban con sus hitos', async ({ page }) => {
    await page.goto('/');

    // Verificar título principal
    await expect(page.locator('h1')).toContainText('Engineering Rebalance & Capacity Planning');

    // Esperar a que el contenedor de hitos tenga botones
    await page.waitForSelector('#milestone-controls button');
    const milestoneButtons = page.locator('#milestone-controls button');
    await expect(milestoneButtons).toHaveCount(3);

    // Esperar a que el tablero renderice las columnas
    await page.waitForSelector('#board-container');
    const boardContainer = page.locator('#board-container');
    await expect(boardContainer).toBeVisible();
  });

  test('debe permitir cambiar de hito al hacer clic en las solapas', async ({ page }) => {
    await page.goto('/');

    // Esperar a que carguen los botones de hitos
    const q4Button = page.locator('#milestone-controls button', { hasText: 'Q4 2026' });
    await q4Button.waitFor({ state: 'visible' });
    await q4Button.click();

    // Validar que el botón quede activo visualmente con la clase de selección
    await expect(q4Button).toHaveClass(/bg-blue-600/);
  });
});
