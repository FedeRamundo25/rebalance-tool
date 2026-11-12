import { test, expect } from '@playwright/test';

test.describe('Rebalance board', () => {
  test('landing opens the full interactive board', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Engineering Capacity Planning');
    await page.getByRole('link', { name: /Launch Live Interactive Kanban Tool/ }).click();
    await expect(page).toHaveURL(/app\.html$/);
    await expect(page.locator('#board [data-team]').first()).toBeVisible();
    await expect(page.locator('#total-count')).toHaveText(/\d+/);
    const peopleCount = Number(await page.locator('#total-count').innerText());
    expect(peopleCount).toBeGreaterThan(100);
    await expect(page.getByRole('button', { name: /Roadmap/ })).toBeVisible();
    await expect(page.locator('#board .card-list > div').first()).toBeVisible();
  });

  test('freeze and warning controls update a person card', async ({ page }) => {
    await page.goto('/app.html');
    const card = page.locator('#board .card-list > div').first();
    await expect(card).toBeVisible();
    await card.getByTitle('Marcar Warning / Baja Performance').click();
    await expect(card.getByText('⚠️ Warning')).toBeVisible();
    await card.getByTitle('Congelar (No rotar)').click();
    await expect(card).toHaveClass(/is-frozen/);
    await expect(card).toHaveAttribute('draggable', 'false');
  });

  test('drag and drop rotates a person to another team', async ({ page }) => {
    await page.goto('/app.html');
    const card = page.locator('#board .card-list > div').first();
    const personId = await card.getAttribute('id');
    const personName = await card.locator('h3').innerText();
    const sourceTeam = await card.locator('xpath=ancestor::*[@data-team]').getAttribute('data-team');
    const columns = page.locator('#board [data-team]');
    const teams = await columns.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-team')));
    const targetIndex = teams.findIndex(team => team !== sourceTeam);
    const target = columns.nth(targetIndex);
    const targetTeam = teams[targetIndex];
    expect(targetTeam).not.toBe(sourceTeam);
    await page.evaluate(({ personId, targetIndex }) => {
      const dragged = document.getElementById(personId);
      const targetColumn = document.querySelectorAll('#board [data-team]')[targetIndex];
      const dataTransfer = new DataTransfer();
      dragged.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
      targetColumn.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
      targetColumn.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    }, { personId, targetIndex });
    await expect(page.locator('#board [data-team]').nth(targetIndex).locator(`[id="${personId}"]`)).toContainText(personName);
  });

  test('roadmap displays team assignments across milestones', async ({ page }) => {
    await page.goto('/app.html');
    await page.getByRole('button', { name: /Roadmap/ }).click();
    const modal = page.locator('#modal-roadmap');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#roadmap-thead th')).toHaveCount(4);
    await expect(modal.locator('#roadmap-tbody tr').first()).toBeVisible();
  });

  test('adds role needs for a team and persists them', async ({ page }) => {
    await page.goto('/app.html');
    const teamColumn = page.locator('#board [data-team]').first();
    const teamName = await teamColumn.getAttribute('data-team');
    await teamColumn.getByTitle('Editar vacantes requeridas por rol').click();
    const modal = page.locator('#modal-vacantes');
    await expect(modal).toBeVisible();
    const backendNeed = modal.locator('.input-vacante-role[data-role="Backend"]');
    await backendNeed.fill('2');
    await modal.getByRole('button', { name: 'Guardar Vacantes' }).click();
    const storedNeeds = await page.evaluate(() => JSON.parse(localStorage.getItem('eng_team_needs_v34')));
    expect(storedNeeds).toHaveProperty(`${await page.locator('#select-milestone').inputValue()}.${teamName}.Backend`, 2);
  });

  test('creates a roadmap milestone and makes it active', async ({ page }) => {
    await page.goto('/app.html');
    page.once('dialog', dialog => dialog.accept('Q2 2027 (Plan)'));
    await page.getByTitle('Crear nuevo hito').click();
    await expect(page.locator('#select-milestone')).toHaveValue('Q2 2027 (Plan)');
    await expect(page.locator('#select-milestone option')).toHaveCount(4);
  });

  test('migrates assignments saved by the previous app version', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rebalance_app_state', JSON.stringify({
        engineers: [{ id: '1', name: 'Alberto Gomez', teams: { 'Q4 2026 (Reorg)': 'Migrated Squad' } }],
        currentMilestone: 'Q4 2026 (Reorg)',
        teamNeeds: { 'Q4 2026 (Reorg)': { 'Migrated Squad': { Backend: 1 } } },
      }));
    });
    await page.goto('/app.html');
    await expect(page.locator('#select-milestone')).toHaveValue('Q4 2026 (Reorg)');
    await expect(page.locator('#board [data-team="Migrated Squad"]')).toContainText('Alberto Gomez');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('eng_rebalance_v34')));
    expect(saved).toHaveLength(124);
    expect(saved.find(person => person.id === '1').teams['Q4 2026 (Reorg)']).toBe('Migrated Squad');
  });

  test('restores valid backup data when the saved JSON is corrupt', async ({ page }) => {
    await page.addInitScript(() => {
      const backup = [{ id: 'test-person', name: 'Recovered Person', role: 'Backend', seniority: 'Sr', modality: 'Interno', manager: 'Manager', frozen: false, warning: false, pip: false, teams: {}, rotationTypes: {}, initialTeam: 'Recovery Team' }];
      localStorage.setItem('eng_rebalance_v34', '{invalid');
      localStorage.setItem('eng_rebalance_v34__backup', JSON.stringify(backup));
    });
    await page.goto('/app.html');
    await expect(page.locator('#board .card-list > div')).toHaveCount(1);
    await expect(page.getByText('Recovered Person')).toBeVisible();
    const repaired = await page.evaluate(() => JSON.parse(localStorage.getItem('eng_rebalance_v34')));
    expect(repaired[0].name).toBe('Recovered Person');
  });
});
