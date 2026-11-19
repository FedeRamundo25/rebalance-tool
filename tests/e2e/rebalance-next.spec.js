import { expect, test } from '@playwright/test';

function demoBoard() {
  return {
    milestones: [{ name: 'Q4 2026', position: 0 }],
    teams: [{ name: 'Alpha' }, { name: 'Beta' }],
    people: [{ id: '1', name: 'Ava Demo', role: 'Backend', seniority: 'Sr', modality: 'Interno', manager: 'Mara Demo', initialTeam: 'Alpha', frozen: false, warning: false, version: 1 }],
    assignments: [],
    needs: [{ milestone: 'Q4 2026', teamName: 'Alpha', role: 'Backend', requiredCount: 1 }],
    activity: [],
  };
}

async function openNewApp(page) {
  let board = demoBoard();
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/session') return route.fulfill({ json: { user: { email: 'editor@example.com', displayName: 'Rebalance Editor', avatarUrl: null } } });
    if (url.pathname === '/api/board') return route.fulfill({ json: board });
    if (url.pathname === '/api/people/1' && request.method() === 'PATCH') {
      const patch = request.postDataJSON();
      board.people[0] = { ...board.people[0], ...patch, version: board.people[0].version + 1 };
      return route.fulfill({ json: { version: board.people[0].version } });
    }
    if (url.pathname === '/api/assignments/1/Q4%202026' || url.pathname.startsWith('/api/assignments/1/')) {
      const payload = request.postDataJSON();
      const milestone = decodeURIComponent(url.pathname.split('/').at(-1));
      board.assignments = board.assignments.filter(item => !(item.personId === '1' && item.milestone === milestone));
      board.assignments.push({ personId: '1', milestone, teamName: payload.teamName, rotationType: payload.rotationType });
      return route.fulfill({ json: { ok: true } });
    }
    if (url.pathname === '/api/role-needs' && request.method() === 'PUT') {
      const payload = request.postDataJSON();
      board.needs = board.needs.filter(item => !(item.milestone === payload.milestone && item.teamName === payload.teamName));
      for (const [role, requiredCount] of Object.entries(payload.needs)) if (requiredCount > 0) board.needs.push({ milestone: payload.milestone, teamName: payload.teamName, role, requiredCount });
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.goto('http://localhost:4174');
  await expect(page.getByRole('heading', { name: 'Plan de equipos' })).toBeVisible();
  return () => board;
}

test.describe('React Rebalance app', () => {
  test('keeps freeze, warning, and drag-and-drop working against shared API data', async ({ page }) => {
    const getBoard = await openNewApp(page);
    const card = page.locator('.person-card').filter({ hasText: 'Ava Demo' });
    await card.getByTitle('Warning').click();
    await expect(card.locator('.warning-badge')).toBeVisible();
    await card.getByTitle('Congelar').click();
    await expect(card).toHaveClass(/frozen/);
    await card.getByTitle('Descongelar').click();
    const beta = page.locator('.team-column').filter({ has: page.getByRole('heading', { name: 'Beta' }) });
    await card.dragTo(beta);
    await expect(beta.locator('.person-card').filter({ hasText: 'Ava Demo' })).toBeVisible();
    expect(getBoard().assignments[0].teamName).toBe('Beta');
  });

  test('edits team needs and renders the roadmap', async ({ page }) => {
    const getBoard = await openNewApp(page);
    const alpha = page.locator('.team-column').filter({ has: page.getByRole('heading', { name: 'Alpha' }) });
    await alpha.getByTitle('Editar necesidades por rol').click();
    await page.getByRole('heading', { name: 'Necesidades · Alpha' }).waitFor();
    await page.locator('.need-row').filter({ hasText: 'Backend' }).locator('input').fill('2');
    await page.getByRole('button', { name: 'Guardar necesidades' }).click();
    await expect(alpha.getByText('2 pendientes')).toBeVisible();
    expect(getBoard().needs.find(item => item.teamName === 'Alpha' && item.role === 'Backend').requiredCount).toBe(2);
    await page.getByRole('button', { name: 'Roadmap' }).click();
    await expect(page.getByRole('heading', { name: 'Roadmap' })).toBeVisible();
    await expect(page.getByRole('table').getByText('Ava Demo')).toBeVisible();
  });
});
