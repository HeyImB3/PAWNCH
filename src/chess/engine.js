// Unified chess "opponent brain". Prefers Stockfish (WASM) for strong,
// ELO-accurate play when it can be loaded; otherwise falls back to the
// built-in JS engine. It returns the move plus engine signals (real search
// time + whether the move is "tough/precise"); the chess state turns those
// into a humanized reveal delay (see states/chess.js _aiTurn).

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

// Eval (centipawns, from the bot's point of view) reported on the bot's
// previous move — used to detect a "swing" into a critical position. Null until
// the engine has scored at least one position.
let prevEvalCp = null;

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

// Run Stockfish for a bounded search, scraping its `info` stream for the running
// score along the way. Returns { move, searchMs, precise, scoreCp, mate }.
// "precise" = the engine found a forced mate OR the eval swung sharply versus the
// bot's previous move (a critical/tactical moment worth a longer human pause).
function sfBestMove(state, elo, movetimeMs, fen) {
  return new Promise((resolve) => {
    const start = (performance || Date).now();
    let scoreCp = null, mateIn = null;     // latest score seen this search
    const onMsg = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.data || '';
      if (line.startsWith('info')) {
        // score is from the side-to-move's view — always the bot here, so it's
        // directly comparable across the bot's own consecutive moves.
        const m = /score (cp|mate) (-?\d+)/.exec(line);
        if (m) { if (m[1] === 'mate') { mateIn = +m[2]; scoreCp = null; } else { scoreCp = +m[2]; mateIn = null; } }
        return;
      }
      if (line.startsWith('bestmove')) {
        sf.removeEventListener('message', onMsg);
        const move = uciToMove(state, line.split(/\s+/)[1]);
        const searchMs = Math.round((performance || Date).now() - start);
        const mate = mateIn != null;
        const swing = !mate && scoreCp != null && prevEvalCp != null
          && Math.abs(scoreCp - prevEvalCp) >= CHESS.PRECISE_SWING_CP;
        // remember this eval for next move's swing test (mate => clamp to a big number)
        prevEvalCp = mate ? (mateIn >= 0 ? 10000 : -10000) : (scoreCp != null ? scoreCp : prevEvalCp);
        resolve({ move, searchMs, precise: mate || swing, scoreCp, mate });
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

// Main entry. Returns { move, searchMs, precise } — searchMs is the engine's real
// search time and `precise` flags a tough/tactical move; the chess state turns
// those into the humanized reveal delay. The built-in fallback has no eval stream,
// so it never reports `precise` and uses the timing bands only.
export async function bestMove(state, { elo = 1000, fen = null } = {}) {
  if (sfReady && elo >= 800) {
    const res = await sfBestMove(state, elo, CHESS.SEARCH_MS, fen);
    if (res && res.move) return res;
  }
  // Built-in path (also covers very low ELO where we want clumsy play).
  // chooseMove is synchronous & fast; the phase controller applies the
  // reveal delay so the move doesn't pop out instantly.
  const move = chooseMove(state, elo);
  return { move, searchMs: 0, precise: false };
}
