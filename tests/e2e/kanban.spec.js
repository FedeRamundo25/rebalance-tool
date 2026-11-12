import { test, expect } from '@playwright/test';

test.describe('Rebalance app', () => {
  test('landing opens a rendered, interactive board', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Engineering Capacity Planning');
    await page.getByRole('link', { name: /Launch Live Interactive Kanban Tool/ }).click();
    await expect(page).toHaveURL(/app\.html$/);
    await expect(page.locator('#board-container .engineer-card').first()).toBeVisible();
    await expect(page.locator('#milestone-controls button')).toHaveCount(3);
  });

  test('changes milestone, assigns an engineer, and persists the assignment', async ({ page }) => {
    await page.goto('/app.html');
    const cards = page.locator('#board-container .engineer-card');
    await expect(cards.first()).toBeVisible();
    await page.getByRole('button', { name: 'Q4 2026 (Reorg)' }).click();
    await expect(page.getByRole('button', { name: 'Q4 2026 (Reorg)' })).toHaveClass(/bg-blue-600/);
    await cards.first().click();
    await expect(page.getByRole('heading', { name: 'Editar Asignación' })).toBeVisible();
    const select = page.locator('#team-select');
    const original = await select.inputValue();
    const destination = await select.locator('option').evaluateAll(options => options.find(option => option.value !== options.find(o => o.selected)?.value)?.value);
    await select.selectOption(destination);
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();
    await expect(page.locator('#board-container h3', { hasText: destination })).toBeVisible();
    await page.reload();
    await expect(page.locator('#milestone-controls button').filter({ hasText: 'Q4 2026 (Reorg)' })).toHaveClass(/bg-blue-600/);
    await expect(page.locator('#board-container h3', { hasText: destination })).toBeVisible();
    expect(destination).not.toBe(original);
  });

  test('exports the current state and shows recovery feedback when no backup exists', async ({ page }) => {
    await page.goto('/app.html');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar' }).click();
    expect((await downloadPromise).suggestedFilename()).toBe('rebalance-backup.json');
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Restaurar copia' }).click();
  });
});
