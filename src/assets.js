// Optional Aseprite sprite-sheet loading.
//
// At boot we try to fetch assets/sprites/manifest.json. If it exists, each
// listed PNG is loaded and registered with gfx.js, which then blits it in
// place of the procedural art. If there's no manifest (the default), nothing
// happens and the game stays 100% procedural — so dropping in your own art is
// purely additive.
//
// manifest.json format:
// {
//   "boxers": { "front:idle": "boxer_front_idle.png", ... },
//   "pieceSets": { "celestial": "celestial", "arcane": "arcane" }
// }
// `pieceSets` maps a set NAME -> a sub-directory holding the 12 piece PNGs
// (wp.png..bk.png). The game switches between sets at runtime (settings/unlock).
// A legacy flat "pieces": { "wq": "file.png", ... } map is still honored and
// registered as the default 'celestial' set.
// Boxer pose keys: front|back : idle|guard|windupL|windupR|punchL|punchR|hurt|down|walk
// Piece keys: (w|b)(p|n|b|r|q|k)

import { registerSprite, registerPiece, registerBoxer, registerRing, registerArenaLayer, registerUi, registerPortrait } from './gfx.js';

const PIECE_KEYS = ['wp', 'wn', 'wb', 'wr', 'wq', 'wk', 'bp', 'bn', 'bb', 'br', 'bq', 'bk'];
const BOXER_POSE_KEYS = ['idle', 'guard', 'windupL', 'windupR', 'jabL', 'jabR',
  'hookL', 'hookR', 'special', 'duck', 'hurt', 'stagger', 'down', 'walk'];
const BOXER_FACINGS = ['front', 'back'];
const ARENA_LAYER_KEYS = ['far', 'mid', 'near'];
const PORTRAIT_KEYS = ['neutral', 'pleased', 'smirk', 'beaming', 'concerned',
  'upset', 'dejected', 'wince', 'shock', 'grin3'];
const OVERLAY_KEYS = ['damage1', 'damage2', 'damage3'];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('img ' + url));
    img.src = url;
  });
}

export async function loadAssets(base = 'assets/sprites') {
  let manifest;
  try {
    const r = await fetch(`${base}/manifest.json`, { cache: 'no-cache' });
    if (!r.ok) return false;
    manifest = await r.json();
  } catch {
    return false; // no manifest -> procedural art
  }
  let count = 0;
  // boxers: flat key -> file
  await Promise.all(Object.entries(manifest.boxers || {}).map(async ([key, file]) => {
    try { registerSprite('boxers', key, await loadImage(`${base}/${file}`)); count++; }
    catch { /* skip a missing/bad file, keep procedural for that key */ }
  }));
  // piece sets: name -> sub-dir of wp.png..bk.png (any missing file stays procedural)
  await Promise.all(Object.entries(manifest.pieceSets || {}).map(([set, dir]) =>
    Promise.all(PIECE_KEYS.map(async (key) => {
      try { registerPiece(set, key, await loadImage(`${base}/${dir}/${key}.png`)); count++; }
      catch { /* a set may be only partially supplied; that's fine */ }
    }))));
  // boxer sets: slug -> sub-dir of `${facing}_${pose}.png` (any missing file stays procedural)
  await Promise.all(Object.entries(manifest.boxerSets || {}).map(([set, dir]) =>
    Promise.all(BOXER_FACINGS.flatMap((face) => BOXER_POSE_KEYS.map(async (pose) => {
      try { registerBoxer(set, `${face}:${pose}`, await loadImage(`${base}/${dir}/${face}_${pose}.png`)); count++; }
      catch { /* a set may supply only some poses/facings; that's fine */ }
    })))));
  // ring kit: flat key -> file (any missing piece stays procedural)
  await Promise.all(Object.entries(manifest.ring || {}).map(async ([key, file]) => {
    try { registerRing(key, await loadImage(`${base}/${file}`)); count++; }
    catch { /* piece stays procedural */ }
  }));
  // arena scenes: sceneId -> sub-dir of far/mid/near.png (any subset is fine)
  await Promise.all(Object.entries(manifest.arenas || {}).map(([scene, dir]) =>
    Promise.all(ARENA_LAYER_KEYS.map(async (layer) => {
      try { registerArenaLayer(scene, layer, await loadImage(`${base}/${dir}/${layer}.png`)); count++; }
      catch { /* layer stays procedural */ }
    }))));
  // face-tile portraits: slug -> dir of <expr>.png (any subset is fine)
  await Promise.all(Object.entries(manifest.portraits || {}).map(([slug, dir]) =>
    Promise.all(PORTRAIT_KEYS.map(async (key) => {
      try { registerPortrait(slug, key, await loadImage(`${base}/${dir}/${key}.png`)); count++; }
      catch { /* face stays fallback */ }
    }))));
  // shared damage overlays -> reserved slug '_overlays'
  if (manifest.portraitOverlays) {
    await Promise.all(OVERLAY_KEYS.map(async (key) => {
      try { registerPortrait('_overlays', key, await loadImage(`${base}/${manifest.portraitOverlays}/${key}.png`)); count++; }
      catch { /* no overlays */ }
    }));
  }
  // painted UI chrome: flat key -> file (missing = procedural fallback)
  await Promise.all(Object.entries(manifest.ui || {}).map(async ([key, file]) => {
    try { registerUi(key, await loadImage(`${base}/${file}`)); count++; }
    catch { /* chrome stays procedural */ }
  }));
  // legacy flat "pieces" map -> the default 'celestial' set
  await Promise.all(Object.entries(manifest.pieces || {}).map(async ([key, file]) => {
    try { registerPiece('celestial', key, await loadImage(`${base}/${file}`)); count++; }
    catch { /* skip */ }
  }));
  console.log(`[PAWNCH] loaded ${count} sprite(s) from ${base}`);
  return count > 0;
}
