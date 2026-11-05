import { describe, it, expect } from 'vitest';
import { getVacancyBreakdownByRole, getTeamForMilestone } from '../../src/js/engine/capacityEngine.js';

describe('Capacity Engine Tests (Modulo Desacoplado)', () => {
  const sampleEngineers = [
    { id: '1', role: 'Backend', initialTeam: 'Team A', teams: { 'Q4 2026': 'Team B' } },
    { id: '2', role: 'Backend', initialTeam: 'Team C', teams: { 'Q4 2026': 'Team B' } }
  ];

  it('devuelve el equipo correcto según el hito', () => {
    expect(getTeamForMilestone(sampleEngineers[0], 'Q3 2026')).toBe('Team A');
    expect(getTeamForMilestone(sampleEngineers[0], 'Q4 2026')).toBe('Team B');
  });

  it('calcula cobertura de vacantes y excesos correctamente', () => {
    const teamNeeds = { 'Q4 2026': { 'Team B': { 'Backend': 1 } } };
    const breakdown = getVacancyBreakdownByRole('Team B', 'Q4 2026', sampleEngineers, teamNeeds);

    expect(breakdown.totalNeed).toBe(1);
    expect(breakdown.totalCovered).toBe(1);
    expect(breakdown.totalPending).toBe(0);
    expect(breakdown.totalExcess).toBe(1); // Había 2 rotados para 1 vacante
  });
});
