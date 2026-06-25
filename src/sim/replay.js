// Determinism / desync harness. Runs a sim through an input log and records a
// state hash per tick; running it twice and comparing the hashes proves the sim
// is deterministic (or pinpoints the first tick that diverged). This is the
// closest thing the repo has to an automated test for lockstep correctness, and
// later phases reuse it against the real match sim and across the wire.
//
// Sim step contract:
//   makeState(seed) -> state      fresh initial state, with an embedded rng
//   step(state, input) -> state   advance exactly one tick, return next state

import { hashState } from './hash.js';

// Run one pass; returns the final state and the per-tick hashes
// (hashes[0] is the initial state, hashes[t+1] is after input t).
export function runReplay(makeState, step, seed, inputLog) {
  let state = makeState(seed);
  const hashes = [hashState(state)];
  for (let t = 0; t < inputLog.length; t++) {
    state = step(state, inputLog[t]);
    hashes.push(hashState(state));
  }
  return { state, hashes };
}

// Run the same sim twice and compare. Returns { ok, divergedAt } where
// divergedAt is the first differing tick index, or -1 if fully deterministic.
export function checkDeterministic(makeState, step, seed, inputLog) {
  const a = runReplay(makeState, step, seed, inputLog);
  const b = runReplay(makeState, step, seed, inputLog);
  for (let i = 0; i < a.hashes.length; i++) {
    if (a.hashes[i] !== b.hashes[i]) return { ok: false, divergedAt: i };
  }
  return { ok: true, divergedAt: -1 };
}
