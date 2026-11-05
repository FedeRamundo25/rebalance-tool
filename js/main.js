import { state } from './state.js';
import { renderMilestones } from './ui/milestoneUI.js';
import { renderBoard } from './ui/boardUI.js';

document.addEventListener('DOMContentLoaded', () => {
  const boardContainer = document.getElementById('board-container');
  const milestoneControls = document.getElementById('milestone-controls');

  function updateAppUI() {
    renderMilestones(milestoneControls, state, updateAppUI);
    renderBoard(boardContainer, state);
  }

  updateAppUI();
  console.log('🚀 Interfaz modular cargada y renderizada con éxito.');
});
