import { suite, test, assert, assertEqual } from '../../tools/test/runner.js';
import { BoxingMatch, DEFAULT_PARAMS, snapshotBox } from './box.js';

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
