// Tiny localStorage-backed save: story progress + settings.

import { SAVE_KEY } from './config.js';
import { DEFAULT_BINDINGS } from './input.js';

const DEFAULT = {
  storyProgress: 0,            // index of next opponent to face (0..9)
  savedMatch: null,           // an in-progress match parked from the pause menu (null = none)
  settings: {
    volume: { master: 0.8, music: 0.7, sfx: 0.9 },
    scale: 'fit',              // 'fit' | 'integer'
    scanlines: true,
    bindings: DEFAULT_BINDINGS,
  },
};

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT);
    const data = JSON.parse(raw);
    return deepMerge(structuredClone(DEFAULT), data);
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function save(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
}

function deepMerge(base, over) {
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]))
      base[k] = deepMerge(base[k] || {}, over[k]);
    else base[k] = over[k];
  }
  return base;
}
