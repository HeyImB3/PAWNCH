import { suite, test, assert, assertEqual, assertDeepEqual } from '../../tools/test/runner.js';
import { BoxingMatch, DEFAULT_PARAMS, snapshotBox } from './box.js';
import { hashHex } from './hash.js';

suite('box');

// NOTE: STEP_MS, not TICK — clock.test.js already declares `const TICK` at top
// level and the headless runner concatenates all test files into one scope.
const STEP_MS = 1000 / 60;
const viewFor = (fr = { p: [], h: [] }) => ({ pressed: (a) => fr.p.includes(a), isDown: (a) => fr.h.includes(a) });
const makeMatch = (seed, params) =>
  new BoxingMatch({ mode: 'story', enemyParams: params, seed, hooks: {}, onKO() {}, onTime() {}, seconds: 60 });
// an inert opponent: never attacks, dodges, parries, or guards — so a player punch lands cleanly.
const DUMMY = { ...DEFAULT_PARAMS, aggression: 0, dodgeSkill: 0, parrySkill: 0, guardChance: 0,
  signature: { name: 'x', dmg: 1, telegraphMs: 600, chance: 0 } };

test('constructs and advances the round clock (story)', () => {
  const m = makeMatch(1, DEFAULT_PARAMS);
  for (let t = 0; t < 120; t++) m.update(STEP_MS, viewFor());
  assert(m.timeLeft < 60000, 'round clock should have ticked down');
  assert(!m.over, 'should not be over after ~2s');
});

test('constructs and runs in pvp mode with no inputs (no damage)', () => {
  const m = new BoxingMatch({ mode: 'pvp', enemyParams: DEFAULT_PARAMS, seed: 2, hooks: {}, onKO() {}, onTime() {}, seconds: 60 });
  for (let t = 0; t < 60; t++) m.update(STEP_MS, viewFor());
  assert(m.player.hp === 100 && m.enemy.hp === 100, 'pvp with no inputs -> nobody acts -> no damage');
});

test('player jab lands via the contactT countdown (~4 ticks, no setTimeout)', () => {
  const m = makeMatch(7, DUMMY);
  const hp0 = m.enemy.hp;
  m.update(STEP_MS, viewFor({ p: ['jabR'], h: [] }));   // throw at tick 0 -> contactT = 60ms
  let landedTick = -1;
  for (let k = 1; k <= 10; k++) { m.update(STEP_MS, viewFor()); if (m.enemy.hp < hp0 && landedTick < 0) landedTick = k; }
  assert(m.enemy.hp < hp0, 'jab should land on the inert dummy');
  assertEqual(landedTick, 4);                           // 60ms / 16.667ms -> 4 ticks
});

test('snapshotBox is plain and JSON-stable, excludes opts/hooks', () => {
  const m = makeMatch(3, DEFAULT_PARAMS);
  for (let t = 0; t < 50; t++) m.update(STEP_MS, viewFor());
  const snap = snapshotBox(m);
  assertEqual(JSON.stringify(snap), JSON.stringify(JSON.parse(JSON.stringify(snap))));
  assert(!('hooks' in snap) && !('opts' in snap), 'snapshot must exclude non-serializable opts/hooks');
});

// a lively opponent that uses every AI branch: baseline attacks, reactive
// parry/dodge, feints, signature, and a multi-step flurry special.
const AGG = { ...DEFAULT_PARAMS, aggression: 0.9, dodgeSkill: 0.3, parrySkill: 0.4, guardChance: 0.4, feintChance: 0.3,
  signature: { name: 'HAY', dmg: 24, telegraphMs: 600, chance: 0.15 },
  special: { type: 'flurry', name: 'STORM', dmg: 8, telegraphMs: 300, chance: 0.8, cooldownMs: 1500, hits: 3 } };

function scriptedLog(n) {
  const log = [];
  for (let t = 0; t < n; t++) {
    const f = { p: [], h: [] };
    if (t % 30 === 5) f.p.push('jabR');
    if (t % 30 === 15) f.p.push('hookL');
    if (t % 40 === 20) { f.p.push('block'); f.h.push('block'); }
    if (t % 50 === 25) f.p.push('dodgeL');
    log.push(f);
  }
  return log;
}
function runHashes(seed, params, log) {
  const m = makeMatch(seed, params);
  const hs = [hashHex(snapshotBox(m))];
  for (let t = 0; t < log.length; t++) { m.update(STEP_MS, viewFor(log[t])); hs.push(hashHex(snapshotBox(m))); }
  return { m, hs };
}

test('same seed + same inputs -> identical per-tick hashes (AI + specials)', () => {
  const log = scriptedLog(240);
  const a = runHashes(20250625, AGG, log);
  const b = runHashes(20250625, AGG, log);
  assertDeepEqual(a.hs, b.hs);
});

test('different seeds diverge', () => {
  const log = scriptedLog(240);
  const a = runHashes(20250625, AGG, log);
  const c = runHashes(99999, AGG, log);
  assert(a.hs.some((h, i) => h !== c.hs[i]), 'different seeds should produce different play');
});

test('a knockdown / get-up sequence is deterministic', () => {
  // player hammers an inert dummy -> knockdowns + auto-get-up; must replay identically.
  const hammer = Array.from({ length: 900 }, () => ({ p: ['hookR'], h: [] }));
  const a = runHashes(123, DUMMY, hammer);
  const b = runHashes(123, DUMMY, hammer);
  assertDeepEqual(a.hs, b.hs);
  assert(a.m.enemy.knockdowns >= 1, 'the hammering should have caused at least one knockdown');
});
