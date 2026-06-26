import { suite, test, assert, assertEqual, assertDeepEqual } from '../../tools/test/runner.js';
import { newMatch, stepMatch, snapshotMatch, restoreMatch } from './match.js';
import { DEFAULT_PARAMS } from './box.js';
import { hashHex } from './hash.js';

suite('match');

// M-prefixed helpers: the headless runner shares ONE scope across test files, and
// box.test.js already owns DUMMY / runHashes at top level.
const MDUMMY = { ...DEFAULT_PARAMS, aggression: 0, dodgeSkill: 0, parrySkill: 0, guardChance: 0,
  signature: { name: 'x', dmg: 1, telegraphMs: 600, chance: 0 } };
const mcfg = (seed) => ({ seed, mode: 'story', enemyParams: MDUMMY, startHP: { player: 100, enemy: 100 } });
// skip walk + chess fast, then hammer hookR (KOs the inert dummy -> match ends)
const mKoInput = (s) => (s.phase === 'walk' || s.phase === 'chess') ? { skip: true }
  : s.phase === 'boxing' ? { box: { pressed: ['hookR'], held: [] } } : {};
// skip walk + chess, never attack -> boxing TIMES OUT -> heal -> break -> next round
const mLoopInput = (s) => (s.phase === 'walk' || s.phase === 'chess') ? { skip: true } : {};
function mHashes(seed, n, inputFn) {
  const s = newMatch(mcfg(seed));
  const hs = [hashHex(snapshotMatch(s))];
  for (let t = 0; t < n; t++) { stepMatch(s, inputFn(s)); hs.push(hashHex(snapshotMatch(s))); }
  return { s, hs };
}

test('a full match segment is deterministic (same seed -> identical per-tick hashes)', () => {
  const a = mHashes(777, 1600, mKoInput);
  const b = mHashes(777, 1600, mKoInput);
  assertDeepEqual(a.hs, b.hs);
  assert(a.s.over && a.s.winner === 'player', 'hammering should KO the dummy and end the match');
});

test('different seeds diverge', () => {
  const a = mHashes(777, 1600, mKoInput);
  const c = mHashes(99, 1600, mKoInput);
  assert(a.hs.some((h, i) => h !== c.hs[i]), 'different seeds should produce different matches');
});

test('the round loop (boxing timeout -> seeded heal -> break -> round 2) is deterministic', () => {
  const a = mHashes(11, 4200, mLoopInput);
  const b = mHashes(11, 4200, mLoopInput);
  assertDeepEqual(a.hs, b.hs);
  assert(a.s.round >= 2, 'should have advanced into round 2');
});

test('snapshotMatch round-trips (restoreMatch . snapshotMatch is identity)', () => {
  const s = newMatch(mcfg(3));
  for (let i = 0; i < 300; i++) stepMatch(s, mKoInput(s));
  const snap = snapshotMatch(s);
  assertEqual(JSON.stringify(snapshotMatch(restoreMatch(snap))), JSON.stringify(snap));
});

test('restore + re-simulate matches the original (rollback-ready)', () => {
  const orig = newMatch(mcfg(42));
  for (let i = 0; i < 500; i++) stepMatch(orig, mKoInput(orig));
  const mid = snapshotMatch(orig);
  const cont = []; for (let i = 0; i < 200; i++) { stepMatch(orig, mKoInput(orig)); cont.push(hashHex(snapshotMatch(orig))); }
  const restored = restoreMatch(mid);
  const re = []; for (let i = 0; i < 200; i++) { stepMatch(restored, mKoInput(restored)); re.push(hashHex(snapshotMatch(restored))); }
  assertDeepEqual(cont, re);
});
