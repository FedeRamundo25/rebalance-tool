import { defaultEngineers, defaultMilestones } from '../data/initialData.js';

class Store {
  constructor() {
    const savedState = localStorage.getItem('rebalance_app_state');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      this.engineers = parsed.engineers || defaultEngineers;
      this.currentMilestone = parsed.currentMilestone || defaultMilestones[0];
    } else {
      this.engineers = [...defaultEngineers];
      this.currentMilestone = defaultMilestones[0];
    }
    this.milestones = [...defaultMilestones];
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    localStorage.setItem('rebalance_app_state', JSON.stringify({
      engineers: this.engineers,
      currentMilestone: this.currentMilestone
    }));
    this.listeners.forEach(listener => listener(this));
  }

  setMilestone(milestone) {
    this.currentMilestone = milestone;
    this.notify();
  }

  updateEngineerAssignment(engineerId, newTeam, milestone) {
    const eng = this.engineers.find(e => e.id === engineerId);
    if (eng) {
      if (!eng.teams) eng.teams = {};
      eng.teams[milestone] = newTeam;
      this.notify();
    }
  }
}

export const store = new Store();
