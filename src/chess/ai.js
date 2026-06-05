// Built-in chess engine: alpha-beta minimax + piece-square eval, with an
// ELO knob that scales search depth, blunder rate, and move "humanity".
// Used as the offline fallback (and on weaker opponents) when Stockfish
// WASM isn't available. Pure JS, no deps.

import { legalMoves, applyMove, inCheck, material, WHITE, BLACK, rc } from './board.js';

const PV = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Piece-square tables (white POV, index 0 = a8). Mirrored for black.
const PST = {
  p: [ 0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
       5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
       5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0 ],
  n: [ -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40,
       -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
       -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
       -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50 ],
  b: [ -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10,
       -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
       -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
       -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20 ],
  r: [ 0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5,
       -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
       -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0 ],
  q: [ -20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10,
       -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5,
       -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20 ],
  k: [ -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
       -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
       -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
       20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20 ],
};

function evaluate(s) {
  // Always from White's perspective (positive = white better).
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (!p) continue;
    const t = p.toLowerCase();
    const white = p === p.toUpperCase();
    const base = PV[t] + PST[t][white ? i : 63 - i];
    score += white ? base : -base;
  }
  return score;
}

// Negamax with alpha-beta. Returns score from side-to-move POV.
function search(s, depth, alpha, beta) {
  if (depth === 0) {
    const e = evaluate(s);
    return s.turn === WHITE ? e : -e;
  }
  const moves = orderMoves(s, legalMoves(s));
  if (moves.length === 0) {
    if (inCheck(s, s.turn)) return -100000 + (10 - depth); // prefer slower mates
    return 0; // stalemate
  }
  let best = -Infinity;
  for (const m of moves) {
    const score = -search(applyMove(s, m), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function orderMoves(s, moves) {
  // captures & promotions first -> better pruning
  return moves.sort((a, b) => moveScore(s, b) - moveScore(s, a));
}
function moveScore(s, m) {
  let v = 0;
  if (m.flag === 'capture') {
    const victim = s.board[m.to], attacker = s.board[m.from];
    v += 10 * PV[victim.toLowerCase()] - PV[attacker.toLowerCase()];
  }
  if (m.promo) v += PV[m.promo] || 0;
  if (m.flag === 'ep') v += 100;
  return v;
}

// Map ELO -> behaviour profile.
function profile(elo) {
  const e = Math.max(300, Math.min(2400, elo));
  let depth;
  if (e < 700) depth = 1;
  else if (e < 1200) depth = 2;
  else if (e < 1800) depth = 3;
  else depth = 4;
  // chance the engine deliberately plays a non-best move
  const blunder = Math.max(0.02, Math.min(0.5, (1500 - e) / 2200 + 0.05));
  // how far down the ranked list a blunder may reach (0..1 of list)
  const sloppiness = Math.max(0.15, Math.min(0.9, (1700 - e) / 1600));
  return { depth, blunder, sloppiness };
}

// Choose a move for the side to move. Returns { move, score }.
export function chooseMove(s, elo = 1000) {
  const moves = legalMoves(s);
  if (moves.length === 0) return null;
  const { depth, blunder, sloppiness } = profile(elo);

  // Score every root move.
  const scored = moves.map((m) => ({
    m,
    score: -search(applyMove(s, m), depth - 1, -Infinity, Infinity),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Best play, with a small "near-equal" jitter for variety.
  if (Math.random() > blunder) {
    const top = scored.filter((x) => x.score >= scored[0].score - 15);
    return pick(top).m;
  }
  // Blunder: choose from a weaker slice of the move list (weighted toward
  // the better end so it's a human mistake, not random garbage).
  const cut = Math.max(1, Math.floor(scored.length * sloppiness));
  const pool = scored.slice(0, cut);
  // weight by rank (earlier = more likely)
  const weights = pool.map((_, i) => 1 / (i + 1));
  return weightedPick(pool, weights).m;
}

function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function weightedPick(arr, w) {
  const sum = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
