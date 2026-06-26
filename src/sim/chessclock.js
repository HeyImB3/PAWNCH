// PAWNCH chess clock — DETERMINISTIC, tick-based (Phase 1B-B).
//
// Both per-player clocks and the per-round window are advanced by the caller's
// fixed dt (SIM.TICK_MS in lockstep), so two clients compute identical clock
// values from the same tick count — no wall-clock drift, no snapshot
// reconciliation. Pure + serializable; values in milliseconds. The chess BOARD
// is already deterministic (src/chess/board.js); this is the only timing piece
// the chess half needs.
//
// Sim boundary: imports only ../config.js.

import { MATCH } from '../config.js';

// Fresh clock: both players get the full per-match clock; halfLeft is the
// per-round window. All values in milliseconds.
export function newChessClock(perPlayerMs = MATCH.CHESS_SECONDS * 1000, halfMs = MATCH.CHESS_HALF_SECONDS * 1000) {
  return { w: perPlayerMs, b: perPlayerMs, halfLeft: halfMs };
}

// Advance one tick: the side to move ('w'|'b') burns clock; the round window
// always burns. Mutates and returns the clock.
export function tickChessClock(c, toMove, dt) {
  c[toMove] -= dt;
  c.halfLeft -= dt;
  return c;
}

// Fischer increment for the side that just moved.
export function addIncrement(c, side, incMs = MATCH.CHESS_INCREMENT_MS) {
  c[side] += incMs;
  return c;
}

// Start a new round's chess half: reset the window, keep the per-player clocks.
export function resetHalf(c, halfMs = MATCH.CHESS_HALF_SECONDS * 1000) {
  c.halfLeft = halfMs;
  return c;
}

// How the half should end this tick: 'time' (round window expired), 'flag'
// (side to move ran out), or null. The window is checked first, matching the
// live order in src/states/chess.js (halfTime before the per-player clock).
export function chessClockStatus(c, toMove) {
  if (c.halfLeft <= 0) return 'time';
  if (c[toMove] <= 0) return 'flag';
  return null;
}
