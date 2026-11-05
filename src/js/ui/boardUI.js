import { getTeamForMilestone, getVacancyBreakdownByRole, getAllTeams } from '../engine/capacityEngine.js';

export function renderBoard(containerEl, state) {
  containerEl.innerHTML = '';
  const teams = getAllTeams(state.engineers);

  teams.forEach(teamName => {
    const engineersInTeam = state.engineers.filter(eng => 
      getTeamForMilestone(eng, state.currentMilestone) === teamName
    );

    const breakdown = getVacancyBreakdownByRole(teamName, state.currentMilestone, state.engineers, state.teamNeeds);

    const columnEl = document.createElement('div');
    columnEl.className = 'bg-slate-100 rounded-lg p-4 flex flex-col gap-3 border border-slate-200 shadow-sm';
    
    const cardsHTML = engineersInTeam.map(eng => {
      const isRotated = eng.teams && eng.teams[state.currentMilestone] && eng.teams[state.currentMilestone] !== eng.initialTeam;
      
      return `
        <div class="bg-white p-3 rounded-md shadow-sm border ${isRotated ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'} hover:shadow-md transition cursor-pointer" data-id="${eng.id}">
          <div class="flex justify-between items-start">
            <span class="font-semibold text-sm text-slate-800">${eng.name}</span>
            ${isRotated ? '<span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">Rotado</span>' : ''}
          </div>
          <div class="text-xs text-slate-500 flex justify-between mt-2 pt-2 border-t border-slate-100">
            <span>${eng.role} (${eng.seniority})</span>
            <span class="text-indigo-600 font-medium">${eng.modality}</span>
          </div>
        </div>
      `;
    }).join('');

    columnEl.innerHTML = `
      <div class="flex justify-between items-center border-b border-slate-200 pb-2">
        <h3 class="font-bold text-slate-700 text-sm">${teamName}</h3>
        <span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">${engineersInTeam.length}</span>
      </div>
      
      <div class="text-xs bg-white p-2 rounded border border-slate-200 text-slate-600 flex justify-between">
        <span>Necesidad: <strong class="text-slate-800">${breakdown.totalNeed}</strong></span>
        <span>Cubiertas: <strong class="text-blue-600">${breakdown.totalCovered}</strong></span>
        <span>Pendientes: <strong class="${breakdown.totalPending > 0 ? 'text-amber-600' : 'text-slate-800'}">${breakdown.totalPending}</strong></span>
      </div>

      <div class="card-list flex flex-col gap-2 overflow-y-auto max-h-[600px] pr-1">
        ${cardsHTML.length > 0 ? cardsHTML : '<div class="text-xs text-slate-400 text-center py-6 italic">Sin miembros</div>'}
      </div>
    `;

    containerEl.appendChild(columnEl);
  });
}
