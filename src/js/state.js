import { defaultEngineers, defaultMilestones } from './data/initialData.js';

class AppState {
  constructor() {
    this.engineers = [...defaultEngineers];
    this.milestones = [...defaultMilestones];
    this.currentMilestone = defaultMilestones[0];
    this.teamNeeds = {};
  }

  setMilestone(milestone) {
    this.currentMilestone = milestone;
  }

  updateEngineerTeam(engineerId, newTeam, milestone) {
    const eng = this.engineers.find(e => e.id === engineerId);
    if (eng) {
      if (!eng.teams) eng.teams = {};
      eng.teams[milestone] = newTeam;
    }
  }
}

export const state = new AppState();
