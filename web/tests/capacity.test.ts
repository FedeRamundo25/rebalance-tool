import { describe, expect, it } from 'vitest';
import { getAllTeams, getVacancyBreakdown, teamForMilestone } from '../src/domain/capacity';

const people = [
  { id: '1', role: 'Backend', initialTeam: 'Payments' },
  { id: '2', role: 'Backend', initialTeam: 'Platform' },
  { id: '3', role: 'QA', initialTeam: 'Delivery' },
];
const assignments = [
  { personId: '2', milestone: 'Q4', teamName: 'Payments' },
  { personId: '3', milestone: 'Q4', teamName: 'Payments' },
];

describe('capacity rules used by the Rebalance board', () => {
  it('uses the initial team when there is no assignment for a milestone', () => {
    expect(teamForMilestone(people[0], assignments, 'Q4')).toBe('Payments');
    expect(teamForMilestone(people[1], assignments, 'Q3')).toBe('Platform');
  });

  it('counts only incoming rotations against role needs and reports pending/excess by role', () => {
    const result = getVacancyBreakdown('Payments', 'Q4', people, assignments, [
      { milestone: 'Q4', teamName: 'Payments', role: 'Backend', requiredCount: 2 },
      { milestone: 'Q4', teamName: 'Payments', role: 'Frontend', requiredCount: 1 },
    ]);
    expect(result.roles).toEqual([
      { role: 'Backend', need: 2, moved: 1, covered: 1, pending: 1, excess: 0 },
      { role: 'Frontend', need: 1, moved: 0, covered: 0, pending: 1, excess: 0 },
      { role: 'QA', need: 0, moved: 1, covered: 0, pending: 0, excess: 1 },
    ]);
    expect(result.totalPending).toBe(2);
    expect(result.totalExcess).toBe(1);
  });

  it('returns stable unique teams from people and planned assignments', () => {
    expect(getAllTeams(people, assignments)).toEqual(['Delivery', 'Payments', 'Platform']);
  });
});
