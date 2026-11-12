import { defaultEngineers, defaultMilestones } from '../data/initialData.js';

export const STORAGE_KEY = 'rebalance_app_state';
export const BACKUP_KEY = 'rebalance_app_state_backup';

function cloneDefaults() {
  return defaultEngineers.map(engineer => ({ ...engineer, teams: {}, rotationTypes: {} }));
}

export function isValidState(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Array.isArray(value.engineers)
    && value.engineers.every(engineer => engineer && typeof engineer === 'object'
      && typeof engineer.id === 'string' && typeof engineer.name === 'string'
      && (engineer.teams === undefined || (engineer.teams && typeof engineer.teams === 'object' && !Array.isArray(engineer.teams))))
    && (value.currentMilestone === undefined || defaultMilestones.includes(value.currentMilestone))
    && (value.teamNeeds === undefined || (value.teamNeeds && typeof value.teamNeeds === 'object' && !Array.isArray(value.teamNeeds))));
}

function readState(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return isValidState(value) ? value : null;
  } catch {
    return null;
  }
}

function getBrowserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

class Store {
  constructor(storage = getBrowserStorage()) {
    this.storage = storage;
    const parsed = readState(storage, STORAGE_KEY);
    this.engineers = parsed ? parsed.engineers : cloneDefaults();
    this.currentMilestone = parsed?.currentMilestone ?? defaultMilestones[0];
    this.milestones = [...defaultMilestones];
    this.teamNeeds = parsed?.teamNeeds ?? {};
    this.listeners = [];
    if (!parsed && storage) this.persist();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(item => item !== listener); };
  }

  persist() {
    if (!this.storage) return false;
    const state = { engineers: this.engineers, currentMilestone: this.currentMilestone, teamNeeds: this.teamNeeds };
    try {
      const previous = readState(this.storage, STORAGE_KEY);
      if (previous) this.storage.setItem(BACKUP_KEY, JSON.stringify(previous));
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  notify() {
    this.persist();
    this.listeners.forEach(listener => listener(this));
  }

  restoreBackup() {
    const backup = readState(this.storage, BACKUP_KEY);
    if (!backup) return false;
    this.applyState(backup);
    this.persist();
    this.listeners.forEach(listener => listener(this));
    return true;
  }

  exportState() {
    return JSON.stringify({ engineers: this.engineers, currentMilestone: this.currentMilestone, teamNeeds: this.teamNeeds }, null, 2);
  }

  importState(raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!isValidState(parsed)) return false;
      this.applyState(parsed);
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  applyState(parsed) {
    this.engineers = parsed.engineers;
    this.currentMilestone = parsed.currentMilestone ?? defaultMilestones[0];
    this.teamNeeds = parsed.teamNeeds ?? {};
  }

  setMilestone(milestone) {
    if (!this.milestones.includes(milestone)) return;
    this.currentMilestone = milestone;
    this.notify();
  }

  updateEngineerAssignment(engineerId, newTeam, milestone) {
    const eng = this.engineers.find(engineer => engineer.id === engineerId);
    if (eng && this.milestones.includes(milestone) && typeof newTeam === 'string' && newTeam.trim()) {
      eng.teams = { ...(eng.teams || {}), [milestone]: newTeam };
      this.notify();
    }
  }
}

export { Store };
export const store = new Store();
