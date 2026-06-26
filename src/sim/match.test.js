import { suite, test, assert, assertEqual, assertDeepEqual } from '../../tools/test/runner.js';
import { newMatch, stepMatch, snapshotMatch, restoreMatch } from './match.js';
import { DEFAULT_PARAMS } from './box.js';
import { hashHex } from './hash.js';
import { MATCH } from '../config.js';
import { legalMoves, idxToAlg } from '../chess/board.js';

suite('match');

const MDUMMY = { ...DEFAULT_PARAMS, aggression: 0, dodgeSkill: 0, parrySkill: 0, guardChance: 0,
  signature: { name: 'x', dmg: 1, telegraphMs: 600, chance: 0 } };
const mcfg = (seed) => ({ seed, mode: 'story', enemyParams: MDUMMY, startHP: { player: 100, enemy: 100 } });
const mFind = (board, uci) => legalMoves(board).find((m) => idxToAlg(m.from) + idxToAlg(m.to) === uci);
const mNoMove = (s) => (s.phase === 'walk' || s.phase === 'break') ? { skip: true } : {};
// skip walk/break; in chess, play the next scripted move (indexed by pgnMoves.length)
const mDriver = (moves) => (s) => {
  if (s.phase === 'walk' || s.phase === 'break') return { skip: true };
  if (s.phase === 'chess') {
    const n = s.pgnMoves.length;
    if (n < moves.length) { const mv = mFind(s.board, moves[n]); if (mv) return { chessMove: mv }; }
    return {};
  }
  return {};
};
const OPENING = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];
const MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];   // fool's mate
function mHashes(seed, n, driver) {
  const s = newMatch(mcfg(seed));
  const hs = [hashHex(snapshotMatch(s))];
  for (let t = 0; t < n; t++) { stepMatch(s, driver(s)); hs.push(hashHex(snapshotMatch(s))); }
  return { s, hs };
}

test('chess + boxing is deterministic (opening -> clock times out -> boxing)', () => {
  const d = mDriver(OPENING);
  const a = mHashes(777, 3700, d), b = mHashes(777, 3700, d);
  assertDeepEqual(a.hs, b.hs);
  assertEqual(a.s.phase, 'boxing');
  assertDeepEqual(a.s.pgnMoves, ['e4', 'e5', 'Nf3', 'Nc6']);
});
test('different seeds diverge', () => {
  const d = mDriver(OPENING);
  const a = mHashes(777, 3700, d), c = mHashes(99, 3700, d);
  assert(a.hs.some((h, i) => h !== c.hs[i]), 'different seeds should diverge');
});
test("checkmate ends the match (fool's mate)", () => {
  const s = newMatch(mcfg(5)); const d = mDriver(MATE);
  for (let t = 0; t < 200 && !s.over; t++) stepMatch(s, d(s));
  assert(s.over && s.reason === 'checkmate', 'fools mate -> checkmate, got ' + s.reason);
});
test('a no-move chess half caps the human player HP (anti-skip Golden Rule)', () => {
  const s = newMatch(mcfg(3));
  for (let t = 0; t < 3800 && s.phase !== 'boxing'; t++) stepMatch(s, mNoMove(s));
  assertEqual(s.phase, 'boxing');
  assert(s.hp.player <= MATCH.NO_MOVE_HP_CAP, 'player capped at ' + MATCH.NO_MOVE_HP_CAP + ', got ' + s.hp.player);
});
test('running a clock to zero flags (decisive)', () => {
  const s = newMatch(mcfg(7));
  for (let t = 0; t < 200 && s.phase !== 'chess'; t++) stepMatch(s, { skip: true });
  s.clock.w = 30;   // tiny white clock; the round window still has ~60s
  for (let t = 0; t < 6 && !s.over; t++) stepMatch(s, {});
  assert(s.over && s.reason === 'flag', 'clock to zero -> flag, got ' + s.reason);
});
test('a drawn final round is decided by chess material', () => {
  const s = newMatch(mcfg(2));
  for (let t = 0; t < 200 && s.phase !== 'chess'; t++) stepMatch(s, { skip: true });
  s.round = MATCH.TOTAL_ROUNDS; s.board.board[8] = '';   // remove black a7 pawn -> white +1
  for (let t = 0; t < 4000 && s.phase !== 'boxing'; t++) stepMatch(s, {});   // chess times out -> boxing
  s.box.timeLeft = 1;   // about to time out
  stepMatch(s, {});     // box times out on the final round -> material verdict
  const expected = s.playerColor === 'w' ? 'player' : 'enemy';
  assert(s.over && s.reason === 'material' && s.winner === expected, 'final round by material, got ' + s.reason + '/' + s.winner);
});
test('snapshotMatch round-trips', () => {
  const s = newMatch(mcfg(3)); const d = mDriver(OPENING);
  for (let i = 0; i < 300; i++) stepMatch(s, d(s));
  const snap = snapshotMatch(s);
  assertEqual(JSON.stringify(snapshotMatch(restoreMatch(snap))), JSON.stringify(snap));
});
test('restore + re-simulate matches the original (rollback-ready)', () => {
  const d = mDriver(OPENING);
  const orig = newMatch(mcfg(42));
  for (let i = 0; i < 500; i++) stepMatch(orig, d(orig));
  const mid = snapshotMatch(orig);
  const cont = []; for (let i = 0; i < 200; i++) { stepMatch(orig, d(orig)); cont.push(hashHex(snapshotMatch(orig))); }
  const restored = restoreMatch(mid);
  const re = []; for (let i = 0; i < 200; i++) { stepMatch(restored, d(restored)); re.push(hashHex(snapshotMatch(restored))); }
  assertDeepEqual(cont, re);
});
test('the round loop reaches round 2 deterministically', () => {
  const a = mHashes(11, 7600, mNoMove), b = mHashes(11, 7600, mNoMove);
  assertDeepEqual(a.hs, b.hs);
  assert(a.s.round >= 2, 'should reach round 2, got ' + a.s.round);
});
