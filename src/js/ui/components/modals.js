import { store } from '../../core/store.js';
import { getAllTeams } from '../../engine/capacityEngine.js';

export function openEngineerModal(engineer) {
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  
  const teams = getAllTeams(store.engineers);
  const currentAssignedTeam = engineer.teams?.[store.currentMilestone] || engineer.initialTeam;

  modalOverlay.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg text-slate-800">Editar Asignación</h3>
        <button id="close-modal" class="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
      </div>
      
      <div class="mb-4">
        <p class="text-sm font-semibold text-slate-700">${engineer.name}</p>
        <p class="text-xs text-slate-500">${engineer.role} &bull; ${engineer.seniority} &bull; Hito: ${store.currentMilestone}</p>
      </div>

      <div class="mb-6">
        <label class="block text-xs font-bold text-slate-600 uppercase mb-2">Equipo Destino</label>
        <select id="team-select" class="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          ${teams.map(t => `<option value="${t}" ${t === currentAssignedTeam ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>

      <div class="flex justify-end gap-2">
        <button id="btn-cancel" class="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded hover:bg-slate-200">Cancelar</button>
        <button id="btn-save" class="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700">Guardar Cambios</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const closeModal = () => modalOverlay.remove();

  modalOverlay.querySelector('#close-modal').onclick = closeModal;
  modalOverlay.querySelector('#btn-cancel').onclick = closeModal;
  modalOverlay.querySelector('#btn-save').onclick = () => {
    const newTeam = modalOverlay.querySelector('#team-select').value;
    store.updateEngineerAssignment(engineer.id, newTeam, store.currentMilestone);
    closeModal();
  };
}
