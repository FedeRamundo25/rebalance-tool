export type CapacityPerson = { id: string; role: string; initialTeam: string };
export type CapacityAssignment = { personId: string; milestone: string; teamName: string };
export type RoleNeed = { milestone: string; teamName: string; role: string; requiredCount: number };

export function teamForMilestone(person: CapacityPerson, assignments: CapacityAssignment[], milestone: string) {
  return assignments.find(item => item.personId === person.id && item.milestone === milestone)?.teamName ?? person.initialTeam ?? 'Sin Equipo';
}

export function getAllTeams(people: CapacityPerson[], assignments: CapacityAssignment[]) {
  return [...new Set([...people.map(person => person.initialTeam), ...assignments.map(item => item.teamName)].filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function getVacancyBreakdown(teamName: string, milestone: string, people: CapacityPerson[], assignments: CapacityAssignment[], needs: RoleNeed[]) {
  const movedByRole = new Map<string, number>();
  for (const person of people) {
    if (person.initialTeam !== teamName && teamForMilestone(person, assignments, milestone) === teamName) {
      const role = person.role || 'Otros';
      movedByRole.set(role, (movedByRole.get(role) ?? 0) + 1);
    }
  }

  const activeNeeds = needs.filter(item => item.milestone === milestone && item.teamName === teamName && item.requiredCount > 0);
  const roles = new Set([...activeNeeds.map(item => item.role), ...[...movedByRole.keys()].filter(role => !activeNeeds.some(item => item.role === role))]);
  const breakdown = [...roles].map(role => {
    const need = activeNeeds.find(item => item.role === role)?.requiredCount ?? 0;
    const moved = movedByRole.get(role) ?? 0;
    return { role, need, moved, covered: Math.min(need, moved), pending: Math.max(0, need - moved), excess: Math.max(0, moved - need) };
  });
  return {
    roles: breakdown,
    totalNeed: breakdown.reduce((sum, item) => sum + item.need, 0),
    totalCovered: breakdown.reduce((sum, item) => sum + item.covered, 0),
    totalPending: breakdown.reduce((sum, item) => sum + item.pending, 0),
    totalExcess: breakdown.reduce((sum, item) => sum + item.excess, 0),
  };
}
