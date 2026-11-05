export function getTeamForMilestone(eng, milestone) {
  if (eng.teams && eng.teams[milestone]) {
    return eng.teams[milestone];
  }
  return eng.initialTeam || 'Sin Equipo';
}

export function getVacancyBreakdownByRole(teamName, milestone, engineers, teamNeeds) {
  const needsObj = (teamNeeds[milestone] && teamNeeds[milestone][teamName]) ? teamNeeds[milestone][teamName] : {};
  const addedCountByRole = {};

  engineers.forEach(eng => {
    const teamInCurrent = getTeamForMilestone(eng, milestone);
    if (teamInCurrent === teamName && teamInCurrent !== eng.initialTeam) {
      const role = eng.role || 'Otros';
      addedCountByRole[role] = (addedCountByRole[role] || 0) + 1;
    }
  });

  const result = [];
  let totalNeed = 0, totalCovered = 0, totalPending = 0, totalExcess = 0;
  const processedRoles = new Set();

  Object.keys(needsObj).forEach(role => {
    const need = needsObj[role] || 0;
    if (need > 0) {
      processedRoles.add(role);
      const added = addedCountByRole[role] || 0;
      const covered = Math.min(need, added);
      const pending = Math.max(0, need - added);
      const excess = Math.max(0, added - need);

      totalNeed += need;
      totalCovered += covered;
      totalPending += pending;
      totalExcess += excess;

      result.push({ role, need, covered, pending, excess, added });
    }
  });

  Object.keys(addedCountByRole).forEach(role => {
    if (!processedRoles.has(role) && addedCountByRole[role] > 0) {
      const added = addedCountByRole[role];
      totalExcess += added;
      result.push({ role, need: 0, covered: 0, pending: 0, excess: added, added });
    }
  });

  return { roles: result, totalNeed, totalCovered, totalPending, totalExcess, addedCountByRole };
}

export function getAllTeams(engineers) {
  const teamSet = new Set(['Payments Management']);
  engineers.forEach(e => {
    if (e.initialTeam) teamSet.add(e.initialTeam);
    if (e.teams) {
      Object.values(e.teams).forEach(t => { if (t) teamSet.add(t); });
    }
  });
  return [...teamSet].sort();
}
