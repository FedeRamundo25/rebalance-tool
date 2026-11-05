export function renderMilestones(containerEl, state, onMilestoneChange) {
  containerEl.innerHTML = '';
  
  state.milestones.forEach(milestone => {
    const btn = document.createElement('button');
    const isActive = milestone === state.currentMilestone;
    
    btn.className = `px-3 py-1.5 text-xs font-semibold rounded-md transition ${
      isActive 
        ? 'bg-blue-600 text-white shadow' 
        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
    }`;
    btn.textContent = milestone;
    btn.onclick = () => {
      state.setMilestone(milestone);
      onMilestoneChange();
    };
    
    containerEl.appendChild(btn);
  });
}
