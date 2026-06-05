// Unified chess "opponent brain". Prefers Stockfish (WASM) for strong,
// ELO-accurate play when it can be loaded; otherwise falls back to the
// built-in JS engine. Either way it returns a move + a humanized think
// time (1-7s) so the bot burns some of its own chess clock like a person.

import { legalMoves, idxToAlg, applyMove } from './board.js';
import { chooseMove } from './ai.js';
import { CHESS } from '../config.js';

// Candidate Stockfish builds (CDN). First that loads wins; all optional.
const SF_SOURCES = [
  'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish.js',
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
];

let sf = null;          // active stockfish instance (or null)
let sfReady = false;

export async function initEngine() {
  if (sfReady) return true;
  for (const src of SF_SOURCES) {
    try {
      sf = await loadStockfish(src);
      sfReady = true;
      return true;
    } catch (e) { /* try next / fall back */ }
  }
  sf = null;
  return false; // built-in fallback will be used
}

export function engineName() {
  return sfReady ? 'Stockfish (WASM)' : 'PAWNCH AI (built-in)';
}

function loadStockfish(src) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('sf timeout')), 4000);
    // Stockfish builds expose a Worker-like postMessage/onmessage interface.
    let worker;
    try {
      worker = new Worker(src);
    } catch (e) {
      // Some builds need to be wrapped; try a tiny bootstrap blob.
      try {
        const blob = new Blob([`importScripts('${src}');`], { type: 'application/javascript' });
        worker = new Worker(URL.createObjectURL(blob));
      } catch (e2) { clearTimeout(timeout); return reject(e2); }
    }
    const onMsg = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data || '';
      if (line.includes('uciok')) {
        clearTimeout(timeout);
        worker.removeEventListener('message', onMsg);
        resolve(worker);
      }
    };
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('sf error')); });
    worker.postMessage('uci');
  });
}

// Humanized think time, weighted toward the quicker end but with occasional
// long thinks. Strong players think a touch longer on average.
export function humanThinkMs(elo = 1000) {
  const { MIN_MOVE_MS, MAX_MOVE_MS } = CHESS;
  const r = Math.random();
  const skew = Math.pow(r, 1.7);                 // bias toward shorter
  let ms = MIN_MOVE_MS + skew * (MAX_MOVE_MS - MIN_MOVE_MS);
  if (Math.random() < 0.12) ms = MAX_MOVE_MS * (0.8 + Math.random() * 0.2); // deep think
  ms *= 0.8 + Math.min(0.5, elo / 4000);          // stronger = slightly slower
  return Math.max(MIN_MOVE_MS, Math.min(MAX_MOVE_MS, Math.round(ms)));
}

// Resolve a UCI string (e.g. "g1f3", "e7e8q") to one of our legal moves.
function uciToMove(state, uci) {
  if (!uci || uci.length < 4) return null;
  const promo = uci.length >= 5 ? uci[4] : null;
  for (const m of legalMoves(state)) {
    if (idxToAlg(m.from) === uci.slice(0, 2) && idxToAlg(m.to) === uci.slice(2, 4)) {
      if (promo) { if (m.promo === promo) return m; }
      else if (!m.promo || m.promo === 'q') return m;
    }
  }
  return null;
}

function sfBestMove(state, elo, movetimeMs, fen) {
  return new Promise((resolve) => {
    const onMsg = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data || '';
      if (line.startsWith('bestmove')) {
        sf.removeEventListener('message', onMsg);
        const uci = line.split(/\s+/)[1];
        resolve(uciToMove(state, uci));
      }
    };
    sf.addEventListener('message', onMsg);
    const clampElo = Math.max(1320, Math.min(2850, elo)); // SF UCI_Elo floor ~1320
    sf.postMessage('setoption name UCI_LimitStrength value true');
    sf.postMessage(`setoption name UCI_Elo value ${clampElo}`);
    // For sub-1320 targets, also throttle Skill Level for extra weakness.
    const skill = Math.max(0, Math.min(20, Math.round((elo - 600) / 100)));
    sf.postMessage(`setoption name Skill Level value ${skill}`);
    sf.postMessage(`position fen ${fen}`);
    sf.postMessage(`go movetime ${movetimeMs}`);
  });
}

// Main entry. Returns { move, thinkMs }.
export async function bestMove(state, { elo = 1000, fen = null } = {}) {
  const thinkMs = humanThinkMs(elo);
  // Stockfish handles strong play AND eats clock via movetime.
  if (sfReady && elo >= 800) {
    const move = await sfBestMove(state, elo, thinkMs, fen);
    if (move) return { move, thinkMs };
  }
  // Built-in path (also covers very low ELO where we want clumsy play).
  // chooseMove is synchronous & fast; the phase controller applies the
  // think delay so the clock ticks down realistically.
  const move = chooseMove(state, elo);
  return { move, thinkMs };
}
