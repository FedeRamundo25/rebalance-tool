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
  
  console.log('🚀 Engineering Rebalance Tool v3.5 - Reactiva y Modular inicializada.');
});
