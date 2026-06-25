import { suite, test, assert, assertEqual, assertDeepEqual } from '../../tools/test/runner.js';
import { runReplay, checkDeterministic } from './replay.js';
import { newRng, rngFloat } from './rng.js';

suite('replay');

// A tiny DETERMINISTIC fixture sim: state carries a seeded rng and an
// accumulator; each tick adds a random step scaled by the input. Used only to
// exercise the harness.
const makeState = (seed) => ({ rng: newRng(seed), total: 0, ticks: 0 });
const step = (s, input) => {
  s.total += rngFloat(s.rng) * (input || 1);
  s.ticks += 1;
  return s;
};

// A NON-deterministic fixture: pulls from Math.random, so two runs diverge.
const badStep = (s) => { s.total += Math.random(); s.ticks += 1; return s; };

const inputs = [1, 2, 1, 3, 1, 1, 2];

test('runReplay produces one hash per tick plus the initial', () => {
  const { hashes } = runReplay(makeState, step, 42, inputs);
  assertEqual(hashes.length, inputs.length + 1);
});

test('deterministic sim replays identically', () => {
  const { ok, divergedAt } = checkDeterministic(makeState, step, 42, inputs);
  assert(ok, 'expected determinism, diverged at tick ' + divergedAt);
  assertEqual(divergedAt, -1);
});

test('two runs share identical per-tick hashes', () => {
  const a = runReplay(makeState, step, 7, inputs);
  const b = runReplay(makeState, step, 7, inputs);
  assertDeepEqual(a.hashes, b.hashes);
});

test('the harness CATCHES non-determinism', () => {
  const { ok, divergedAt } = checkDeterministic(makeState, badStep, 42, inputs);
  assert(!ok, 'harness must flag a Math.random sim as non-deterministic');
  assert(divergedAt >= 1, 'divergence should be at or after the first tick');
});
