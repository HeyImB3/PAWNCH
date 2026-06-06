// PAWNCH entry point: boot the game, wire fullscreen, warm up the chess engine.

import { Game } from './game.js';
import { initEngine } from './chess/engine.js';
import { loadAssets } from './assets.js';
import * as Chess from './chess/board.js';
window.CHESS = Chess; // debug handle

const canvas = document.getElementById('game');
const loading = document.getElementById('loading');

const game = new Game(canvas);
window.PAWNCH = game; // debug handle
game.start();
if (loading) loading.style.display = 'none';

// Warm up the chess brain in the background (Stockfish WASM if reachable,
// otherwise the built-in engine). Non-blocking; game is playable meanwhile.
initEngine().then((ok) => {
  game.engineReady = true;
  game.usingStockfish = ok;
});

// Optionally load Aseprite art (no-op if assets/sprites/manifest.json is absent).
loadAssets().then((ok) => { game.usingSprites = ok; });

// Fullscreen on F. Fullscreen the whole page shell — not just the canvas frame —
// so the frame keeps its 512:448 aspect ratio and letterboxes cleanly instead of
// being stretched to the monitor's 16:9 (1920×1080).
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF') {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
});

// Resume audio context on first pointer interaction too.
window.addEventListener('pointerdown', () => game.audio.resume(), { once: false });
