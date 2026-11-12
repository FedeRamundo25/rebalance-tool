import { store } from './core/store.js';
import { renderMilestones } from './ui/components/milestoneUI.js';
import { renderBoard } from './ui/components/board.js';

document.addEventListener('DOMContentLoaded', () => {
  const boardContainer = document.getElementById('board-container');
  const milestoneControls = document.getElementById('milestone-controls');

  // Función principal de renderizado suscripta al store
  function renderApp(currentState) {
    renderMilestones(milestoneControls, currentState);
    renderBoard(boardContainer, currentState);
  }

  // Suscribir la UI al store reactivo
  store.subscribe(renderApp);

  // Render inicial
  renderApp(store);

  document.getElementById('export-state')?.addEventListener('click', () => {
    const blob = new Blob([store.exportState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'rebalance-backup.json'; link.click(); URL.revokeObjectURL(url);
  });
  document.getElementById('import-state')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { if (!store.importState(await file.text())) window.alert('El archivo no contiene un estado válido.'); }
    catch { window.alert('No se pudo leer el archivo.'); }
    event.target.value = '';
  });
  document.getElementById('restore-state')?.addEventListener('click', () => {
    if (!store.restoreBackup()) window.alert('No hay una copia anterior disponible.');
  });
  
  console.log('🚀 Engineering Rebalance Tool v3.5 - Reactiva y Modular inicializada.');
});
