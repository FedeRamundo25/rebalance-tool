import { test, expect } from '@playwright/test';

test.describe('Engineering Rebalance Tool E2E', () => {
  test('debe cargar la aplicación y mostrar el tablero Kanban con sus hitos', async ({ page }) => {
    await page.goto('/');

    // Verificar título principal
    await expect(page.locator('h1')).toContainText('Engineering Rebalance & Capacity Planning');

    // Esperar a que los botones de hitos estén presentes
    const milestoneButtons = page.locator('#milestone-controls button');
    await expect(milestoneButtons.first()).toBeVisible();

    // Esperar a que el contenedor del tablero esté presente en el DOM
    const boardContainer = page.locator('#board-container');
    await boardContainer.waitFor({ state: 'attached' });
    await expect(boardContainer).toBeAttached();
  });

  test('debe permitir cambiar de hito al hacer clic en las solapas', async ({ page }) => {
    await page.goto('/');

    const q4Button = page.locator('#milestone-controls button', { hasText: 'Q4 2026' });
    await q4Button.waitFor({ state: 'visible' });
    await q4Button.click();

    await expect(q4Button).toHaveClass(/bg-blue-600/);
  });
});
