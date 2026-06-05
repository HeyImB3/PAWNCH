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
//   "boxers": { "front:idle": "boxer_front_idle.png", "front:punchL": "...png",
//               "back:idle": "boxer_back_idle.png" , ... },
//   "pieces": { "wq": "white_queen.png", "bn": "black_knight.png", ... }
// }
// Boxer pose keys: front|back : idle|guard|windupL|windupR|punchL|punchR|hurt|down|walk
// Piece keys: (w|b)(p|n|b|r|q|k)

import { registerSprite } from './gfx.js';

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
  for (const group of ['boxers', 'pieces']) {
    const entries = manifest[group] || {};
    await Promise.all(Object.entries(entries).map(async ([key, file]) => {
      try { registerSprite(group, key, await loadImage(`${base}/${file}`)); count++; }
      catch { /* skip a missing/bad file, keep procedural for that key */ }
    }));
  }
  console.log(`[PAWNCH] loaded ${count} sprite(s) from ${base}`);
  return count > 0;
}
