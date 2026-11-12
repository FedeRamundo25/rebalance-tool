import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_KEY, STORAGE_KEY, Store } from '../../src/js/core/store.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

afterEach(() => vi.unstubAllGlobals());

describe('Store persistence and recovery', () => {
  it('initializes teamNeeds and defaults when storage is unavailable', () => {
    const store = new Store(null);
    expect(store.teamNeeds).toEqual({});
    expect(store.engineers.length).toBeGreaterThan(0);
  });

  it('recovers defaults from corrupt JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{broken');
    const store = new Store(storage);
    expect(store.engineers.length).toBeGreaterThan(0);
    expect(store.teamNeeds).toEqual({});
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).engineers).toHaveLength(store.engineers.length);
  });

  it('rejects invalid state imports and imports valid exported state', () => {
    const store = new Store(new MemoryStorage());
    expect(store.importState('{bad json')).toBe(false);
    expect(store.importState({ engineers: [{ id: 'x' }] })).toBe(false);
    const copy = new Store(new MemoryStorage());
    expect(copy.importState(store.exportState())).toBe(true);
    expect(copy.engineers).toEqual(store.engineers);
  });

  it('keeps a valid prior snapshot and can restore it', () => {
    const storage = new MemoryStorage();
    const store = new Store(storage);
    const initial = store.exportState();
    store.updateEngineerAssignment(store.engineers[0].id, 'New Team', store.currentMilestone);
    expect(JSON.parse(storage.getItem(BACKUP_KEY))).toEqual(JSON.parse(initial));
    expect(store.restoreBackup()).toBe(true);
    expect(store.engineers[0].teams[store.currentMilestone]).toBeUndefined();
  });

  it('survives storage write failures without breaking state changes', () => {
    const storage = new MemoryStorage();
    const store = new Store(storage);
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => store.setMilestone(store.milestones[1])).not.toThrow();
    expect(store.currentMilestone).toBe(store.milestones[1]);
  });
});
