// Tiny localStorage-backed save: story progress + settings.

import { SAVE_KEY } from './config.js';
import { DEFAULT_BINDINGS } from './input.js';

// Bump when the DEFAULT keybinding layout changes meaningfully, so existing
// saves get re-seeded to the new defaults (see the migration in load()).
//   1 = original layout
//   2 = hotseat P2 moved to a mirrored numpad cluster; P1 gained Z/X/C dodge/duck
export const BINDINGS_REV = 2;

const DEFAULT = {
  storyProgress: 0,            // index of next opponent to face (0..9)
  savedMatch: null,           // an in-progress match parked from the pause menu (null = none)
  settings: {
    volume: { master: 0.8, music: 0.7, sfx: 0.9 },
    scale: 'fit',              // 'fit' | 'integer'
    scanlines: true,
    bindings: DEFAULT_BINDINGS,
    bindingsRev: BINDINGS_REV,
  },
};

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT);
    const data = JSON.parse(raw);
    const state = deepMerge(structuredClone(DEFAULT), data);
    // Schema hygiene: storyProgress MUST be a non-negative integer. Older or
    // hand-edited saves could carry null/NaN/string here, which made every
    // ladder slot (including the first) read as "locked" and unstartable.
    state.storyProgress = Math.max(0, Math.floor(Number(state.storyProgress)) || 0);
    // Keybinding migration: when the default layout revision advances, re-seed
    // bindings to the new defaults so improvements (e.g. the numpad hotseat P2
    // cluster) reach existing saves. Other settings + story progress are kept.
    if ((data.settings?.bindingsRev || 1) < BINDINGS_REV) {
      state.settings.bindings = structuredClone(DEFAULT_BINDINGS);
      state.settings.bindingsRev = BINDINGS_REV;
    }
    return state;
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
