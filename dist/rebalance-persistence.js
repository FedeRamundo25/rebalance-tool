(function attachRebalancePersistence(root) {
  const BACKUP_SUFFIX = '__backup';
  const validators = {
    eng_milestones_v34: value => Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.trim()),
    eng_team_needs_v34: value => value && typeof value === 'object' && !Array.isArray(value)
      && Object.values(value).every(teams => teams && typeof teams === 'object' && !Array.isArray(teams)
        && Object.values(teams).every(roles => roles && typeof roles === 'object' && !Array.isArray(roles)
          && Object.values(roles).every(count => Number.isFinite(count) && count >= 0))),
    rebalance_app_state: value => value && typeof value === 'object' && Array.isArray(value.engineers)
      && value.engineers.every(person => person && typeof person === 'object' && person.id != null && typeof person.name === 'string'
        && (person.teams === undefined || (person.teams && typeof person.teams === 'object' && !Array.isArray(person.teams) && Object.values(person.teams).every(team => typeof team === 'string'))))
      && (value.teamNeeds === undefined || validators.eng_team_needs_v34(value.teamNeeds)),
    eng_change_log_v34: Array.isArray,
    eng_rebalance_v34: value => Array.isArray(value) && value.every(person => person && typeof person === 'object' && person.id != null && typeof person.name === 'string'
      && (person.teams === undefined || (person.teams && typeof person.teams === 'object' && !Array.isArray(person.teams) && Object.values(person.teams).every(team => typeof team === 'string')))
      && (person.rotationTypes === undefined || (person.rotationTypes && typeof person.rotationTypes === 'object' && !Array.isArray(person.rotationTypes) && Object.values(person.rotationTypes).every(type => type === 'indefinida' || type === 'acotada')))),
  };

  function getStorage() {
    try { return root.localStorage; } catch { return null; }
  }

  function readStoredJSON(key, fallback) {
    const storage = getStorage();
    const validate = validators[key] || (value => value !== undefined);
    for (const candidateKey of [key, `${key}${BACKUP_SUFFIX}`]) {
      try {
        const raw = storage?.getItem(candidateKey);
        if (raw === null || raw === undefined) continue;
        const parsed = JSON.parse(raw);
        if (validate(parsed)) {
          if (candidateKey !== key) {
            try { storage.setItem(key, JSON.stringify(parsed)); } catch { /* recovered value stays in memory */ }
          }
          return parsed;
        }
      } catch { /* try backup, then defaults */ }
    }
    return fallback;
  }

  function readBackupJSON(key) {
    const storage = getStorage();
    try {
      const raw = storage?.getItem(`${key}${BACKUP_SUFFIX}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return validators[key]?.(parsed) ? parsed : null;
    } catch { return null; }
  }

  function writeStoredJSON(key, value) {
    const storage = getStorage();
    if (!storage) return false;
    const validate = validators[key] || (item => item !== undefined);
    try {
      const previousRaw = storage.getItem(key);
      if (previousRaw) {
        try {
          const previous = JSON.parse(previousRaw);
          if (validate(previous)) storage.setItem(`${key}${BACKUP_SUFFIX}`, previousRaw);
        } catch { /* do not overwrite a valid backup with corrupt data */ }
      }
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  }

  function removeStoredItem(key) {
    try { getStorage()?.removeItem(key); } catch { /* storage is optional */ }
  }

  root.RebalancePersistence = { readStoredJSON, readBackupJSON, writeStoredJSON, removeStoredItem };
})(globalThis);
