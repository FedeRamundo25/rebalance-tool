import { test, expect } from '@playwright/test';

test.describe('Engineering Rebalance Tool E2E', () => {
  test('debe cargar la aplicación y mostrar el tablero Kanban con sus hitos', async ({ page }) => {
    await page.goto('/');

    // Verificar título principal
    await expect(page.locator('h1')).toContainText('Engineering Rebalance & Capacity Planning');

    // Verificar que los botones de hitos estén presentes
    const milestoneButtons = page.locator('#milestone-controls button');
    await expect(milestoneButtons).toHaveCount(3);

    // Verificar que las columnas del tablero se renderizan
    const boardColumns = page.locator('#board-container > div');
    await expect(boardColumns.first()).toBeVisible();
  });

  test('debe permitir cambiar de hito al hacer clic en las solapas', async ({ page }) => {
    await page.goto('/');

    // Hacer clic en el segundo hito (Q4 2026)
    const q4Button = page.locator('#milestone-controls button', { hasText: 'Q4 2026 (Reorg)' });
    await q4Button.click();

    // Validar que el botón quede activo visualmente
    await expect(q4Button).toHaveClass(/bg-blue-600/);
  });
});
