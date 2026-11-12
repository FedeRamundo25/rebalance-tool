import { describe, it, expect } from 'vitest';
import { getVacancyBreakdownByRole, getTeamForMilestone } from '../../src/js/engine/capacityEngine.js';

describe('Capacity engine', () => {
  const sampleEngineers = [
    { id: '1', role: 'Backend', initialTeam: 'Team A', teams: { 'Q4 2026': 'Team B' } },
    { id: '2', role: 'Backend', initialTeam: 'Team C', teams: { 'Q4 2026': 'Team B' } },
  ];

  it('resolves the assigned team for each milestone', () => {
    expect(getTeamForMilestone(sampleEngineers[0], 'Q3 2026')).toBe('Team A');
    expect(getTeamForMilestone(sampleEngineers[0], 'Q4 2026')).toBe('Team B');
  });

  it('calculates coverage, pending vacancies, and excess using the production engine', () => {
    const needs = { 'Q4 2026': { 'Team B': { Backend: 1 } } };
    const result = getVacancyBreakdownByRole('Team B', 'Q4 2026', sampleEngineers, needs);
    expect(result).toMatchObject({ totalNeed: 1, totalCovered: 1, totalPending: 0, totalExcess: 1 });
  });

  it('handles absent teamNeeds safely', () => {
    expect(getVacancyBreakdownByRole('Team B', 'Q4 2026', sampleEngineers, undefined).totalNeed).toBe(0);
  });
});
