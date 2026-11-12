import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../public/rebalance-persistence.js';

const { readStoredJSON, readBackupJSON, writeStoredJSON, removeStoredItem } = globalThis.RebalancePersistence;
const STATE_KEY = 'eng_rebalance_v34';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const validPerson = { id: '1', name: 'Ana', teams: {}, rotationTypes: {} };

afterEach(() => { vi.unstubAllGlobals(); });

describe('Rebalance persistence helpers used by the interactive app', () => {
  it('uses defaults when browser storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readStoredJSON(STATE_KEY, [validPerson])).toEqual([validPerson]);
  });

  it('recovers corrupt primary JSON from its validated backup', () => {
    const storage = new MemoryStorage();
    storage.setItem(STATE_KEY, '{corrupt');
    storage.setItem(`${STATE_KEY}__backup`, JSON.stringify([validPerson]));
    vi.stubGlobal('localStorage', storage);
    expect(readStoredJSON(STATE_KEY, [])).toEqual([validPerson]);
    expect(JSON.parse(storage.getItem(STATE_KEY))).toEqual([validPerson]);
  });

  it('rejects invalid persisted data and keeps defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem(STATE_KEY, JSON.stringify([{ id: '1' }]));
    vi.stubGlobal('localStorage', storage);
    expect(readStoredJSON(STATE_KEY, [validPerson])).toEqual([validPerson]);
  });

  it('saves a valid previous snapshot before writing and restores it', () => {
    const storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    writeStoredJSON(STATE_KEY, [validPerson]);
    const changed = [{ ...validPerson, name: 'Bea' }];
    writeStoredJSON(STATE_KEY, changed);
    expect(readBackupJSON(STATE_KEY)).toEqual([validPerson]);
    expect(readStoredJSON(STATE_KEY, [])).toEqual(changed);
  });

  it('handles write and remove failures without throwing', () => {
    const storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(writeStoredJSON(STATE_KEY, [validPerson])).toBe(false);
    expect(() => removeStoredItem(STATE_KEY)).not.toThrow();
  });
});
