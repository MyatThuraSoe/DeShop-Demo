// Demo localStorage "database".
// - Seeds itself on first load (per browser/origin).
// - Every mutation goes through save() so user changes persist in THEIR browser.
// - Versioned so we can re-seed cleanly when the seed schema changes.

import { buildSeed, SEED_VERSION } from './seedData';

const DB_KEY = 'lumipos_demo_db_v1';
const HIDDEN_KEY_PREFIX = 'lumipos_demo_';

let cache = null;

function readRaw() {
  try {
    return localStorage.getItem(DB_KEY);
  } catch {
    return null;
  }
}

export function getDb() {
  if (cache) return cache;
  const fresh = buildSeed();
  let raw = readRaw();
  if (!raw) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(fresh));
    } catch {
      // storage may be full/blocked — keep in-memory only
    }
  } else {
    try {
      const parsed = JSON.parse(raw);
      // Re-seed when the seed schema/data version changes so the demo always
      // shows fresh data (product photos, shop info, new seed enrichment).
      if (parsed && parsed.meta && parsed.meta.version === SEED_VERSION) {
        cache = parsed;
        return cache;
      }
    } catch {
      // corrupt/mismatched payload — fall through and re-seed
    }
  }
  cache = fresh;
  saveDb();
  return cache;
}

export function saveDb() {
  if (!cache) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch {
    // keep in-memory state alive even if storage fails
  }
}

export function resetDb() {
  const fresh = buildSeed();
  cache = fresh;
  saveDb();
  return fresh;
}

// Hidden per-user keys (outside the main DB object) — e.g. a brief snackbar hint.
export function demoGetHidden(key) {
  try {
    return localStorage.getItem(HIDDEN_KEY_PREFIX + key);
  } catch {
    return null;
  }
}

export function demoSetHidden(key, value) {
  try {
    localStorage.setItem(HIDDEN_KEY_PREFIX + key, value);
  } catch {
    /* ignore */
  }
}

// Simple in-memory single-row cache used by blobs isn't needed here;
// each blob is regenerated on demand from seed/DB data.