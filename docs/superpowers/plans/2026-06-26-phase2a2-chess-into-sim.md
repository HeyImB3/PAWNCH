# Phase 2-A-2 — Real Chess Into the Match Sim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chess STUB in `src/sim/match.js` with the real chess half — clock via `chessclock`, a chess move as an input event, all four endings (checkmate / flag / time / draw), the chess-skip `NO_MOVE_HP_CAP`, and the final-round material tiebreak — keeping the whole match headless-provably deterministic.

**Architecture:** The chess board (`src/chess/board.js`) is already pure + deterministic. `match.js`'s chess phase ticks the per-side clock + the round window (`chessclock`), applies a committed `chessMove` input (`applyMove` + Fischer `addIncrement` + `status`), and resolves endings; a non-decisive end runs the chess-skip HP cap then starts boxing. The final-round drawn match is decided by `material()`, matching the live `resolveBoxing`. `board.js` joins the headless test manifest; because the headless runner concatenates every file into one scope, `board.js`'s internal top-level `step` helper collides with `replay.test.js`'s fixture `step`, so that fixture is renamed to `fxStep` (a test-only change). **Purely additive to the live game** — nothing imports `match.js` yet (live cutover is 2-A-3).

**Tech Stack:** Vanilla JavaScript ES modules, no build step, no dependencies. Headless tests via macOS JavaScriptCore (`osascript`).

## Global Constraints

- **No build step, no dependencies, no framework.** Vanilla ES modules only.
- **No Node/npm.** Verification of record is headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` → `[TESTS] N passed, 0 failed`, non-zero exit on failure. (The chess+boxing determinism tests run several thousand ticks — the suite takes ~4s; that is expected.)
- **Sim import boundary:** `match.js` imports `../config.js`, sibling `src/sim/*`, and `../chess/board.js` (the board is pure + deterministic; explicitly allowed by the 2-A spec).
- **Headless: use NAMED imports, not `import * as`.** A namespace import (`import * as Chess`) does NOT survive the headless import-strip; `match.js` imports the board functions by name (`newGame`, `applyMove`, `status`, `material`, `moveLabel`).
- **Headless concat name uniqueness.** All files share one eval scope. `board.js`'s internal `step` collides with `replay.test.js`'s fixture `const step` → rename that fixture to `fxStep` (whole-word; leaves `badStep` untouched). `match.test.js` keeps its `M`-prefixed helpers.
- **Faithful to the live rules (no re-tuning):** the chess-skip cap matches `game.js applyNoMovePenalty` (`sides = mode==='pvp' ? ['player','enemy'] : ['player']`, cap at `MATCH.NO_MOVE_HP_CAP`); the final-round tiebreak matches `game.js resolveBoxing` (`material(board).diff`, oriented by `playerColor`); the round-window-before-flag precedence comes from `chessclock`.
- **Determinism:** no `Math.random`/`Date.now`/`setTimeout`/wall-clock in `match.js`; randomness only from `MatchState.rng`; the chess board/clock advance from the shared tick + move inputs.
- **Commits** end with the two standard trailers:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01W79S4wsgidziRj2QHrf5G1
  ```
- **Branch:** `phase2a2-chess`.

## File Structure

- Modify: `tools/test/run-headless.js` — add `'src/chess/board.js'` to `MODULES` (before `'src/sim/match.js'`).
- Modify: `src/sim/replay.test.js` — rename the fixture `step` → `fxStep`.
- Modify: `src/sim/match.js` — replace the chess stub with real chess (full rewrite of the module).
- Modify: `src/sim/match.test.js` — rewrite for real chess (9 tests).

**Interfaces (unchanged exports; richer input + state):**
- `newMatch`, `stepMatch`, `snapshotMatch`, `restoreMatch` — same names as 2-A-1.
- `stepMatch(state, inputs)` input gains `chessMove: { from, to, flag?, promo? } | null` (a committed move for the side to move). `MatchState` gains `board` (board.js state), `clock` (`{w,b,halfLeft}`), `movedThisHalf`, `pgnMoves`, `chessResult`.

---

### Task 1: Load the chess engine in the headless suite (board.js + fixture rename)

**Files:**
- Modify: `tools/test/run-headless.js`
- Modify: `src/sim/replay.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `board.js` available as concat globals in the headless suite; no `step`/`fxStep` collision.

- [ ] **Step 1: Rename the replay fixture and add board.js to the manifest**

Rename the `replay.test.js` fixture `step` → `fxStep` (whole-word, so `badStep` is untouched). From the repo root:

```bash
python3 - <<'PY'
import re
p='src/sim/replay.test.js'; s=open(p).read()
s=re.sub(r'\bstep\b','fxStep',s)
open(p,'w').write(s)
PY
```

In `tools/test/run-headless.js`, add `'src/chess/board.js'` to the `MODULES` array immediately BEFORE `'src/sim/box.js'` (board.js is dependency-free and must load before `match.js`, which imports it):

```js
  'src/chess/board.js',
  'src/sim/box.js',
```

- [ ] **Step 2: Run to verify the suite is unchanged**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 58 passed, 0 failed
exit=0
```

(board.js now loads alongside everything with no collision; the rename is internal to `replay.test.js`; the chess-stub match tests are unchanged. If you instead get a `Cannot declare a const variable twice` SyntaxError, the rename or the board.js ordering is wrong — fix before proceeding.)

- [ ] **Step 3: Commit**

```bash
git add tools/test/run-headless.js src/sim/replay.test.js
git commit -m "$(cat <<'EOF'
test(sim): load chess board.js in the headless suite (rename replay fixture step->fxStep)

board.js joins the headless concat (match.js needs it); its internal `step`
helper collided with replay.test.js's fixture, so the fixture is renamed.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W79S4wsgidziRj2QHrf5G1
EOF
)"
```

---

### Task 2: Real chess in the match sim

**Files:**
- Modify: `src/sim/match.js` (replace the chess stub with real chess)
- Modify: `src/sim/match.test.js` (rewrite — 9 tests)

**Interfaces:**
- Consumes: `newGame`/`applyMove`/`status`/`material`/`moveLabel` from `../chess/board.js`; `newChessClock`/`tickChessClock`/`addIncrement`/`resetHalf`/`chessClockStatus` from `./chessclock.js`; `box.js` + `rng.js` + `config` (as in 2-A-1); `legalMoves`/`idxToAlg` from `../chess/board.js` and `MATCH` from `../config.js` (tests).
- Produces: the same exports; chess phase now real.

- [ ] **Step 1: Rewrite the test for real chess**

Replace the ENTIRE contents of `src/sim/match.test.js` with:

```js
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
  for (let t = 0; t < 3800 && s.phase !== 'boxing'; t++) stepMatch(s, mNoMove);
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
```

- [ ] **Step 2: Run to verify it fails**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected: it FAILS — the new tests use real chess (`s.board`, `chessMove`, `s.clock`, etc.) that the current stub `match.js` doesn't provide, so several tests throw / the count is not 62 and `exit=1`. Red state.

- [ ] **Step 3: Rewrite match.js with real chess**

Replace the ENTIRE contents of `src/sim/match.js` with EXACTLY this (validated headless — deterministic, all endings, the chess-skip cap, the material tiebreak):

```js
import { MATCH, SIM } from '../config.js';
import { newRng, rngFloat, rngInt } from './rng.js';
import { BoxingMatch, snapshotBox, restoreBox } from './box.js';
import { newChessClock, tickChessClock, addIncrement, resetHalf, chessClockStatus } from './chessclock.js';
import { newGame, applyMove, status, material, moveLabel } from '../chess/board.js';

const WALK_TICKS = Math.round(MATCH.WALK_SECONDS * SIM.TICK_HZ);
const BREAK_TICKS = Math.round(MATCH.BREAK_SECONDS * SIM.TICK_HZ);

function nextSeed(rng) { return rngInt(rng, 0x100000000); }
function cloneBoard(b) { return b ? JSON.parse(JSON.stringify(b)) : null; }

export function newMatch(config) {
  const rng = newRng((config.seed >>> 0) || 1);
  const playerColor = rngFloat(rng) < 0.5 ? 'w' : 'b';
  return {
    tick: 0, phase: 'walk', phaseTick: 0, rng,
    round: 1, mode: config.mode || 'story', playerColor,
    enemyParams: config.enemyParams || null,
    board: newGame(), clock: newChessClock(), movedThisHalf: { player: false, enemy: false },
    pgnMoves: [], chessResult: null,
    hp: { player: config.startHP?.player ?? 100, enemy: config.startHP?.enemy ?? 100 },
    box: null, over: false, winner: null, reason: null,
  };
}

function startBoxing(s) {
  const box = new BoxingMatch({
    mode: s.mode === 'pvp' ? 'pvp' : 'story', enemyParams: s.enemyParams || undefined,
    seconds: MATCH.BOXING_SECONDS, startHP: { player: s.hp.player, enemy: s.hp.enemy },
    seed: nextSeed(s.rng), hooks: {}, onKO() {}, onTime() {},
  });
  s.box = snapshotBox(box); s.phase = 'boxing'; s.phaseTick = 0;
}

// chess half ended non-decisively -> apply the chess-skip HP cap (human sides that
// made no move), then start boxing.
function chessToBoxing(s) {
  const sides = s.mode === 'pvp' ? ['player', 'enemy'] : ['player'];
  for (const side of sides) {
    if (!s.movedThisHalf[side]) s.hp[side] = Math.min(s.hp[side], MATCH.NO_MOVE_HP_CAP);
  }
  startBoxing(s);
}

function applyHeal(s) {
  const amt = MATCH.HEAL_MIN + rngFloat(s.rng) * (MATCH.HEAL_MAX - MATCH.HEAL_MIN);
  const heal = Math.round(100 * amt);
  s.hp.player = Math.min(100, s.hp.player + heal);
  s.hp.enemy = Math.min(100, s.hp.enemy + heal);
}

function boxView(bi) {
  const p = new Set((bi && bi.pressed) || []), h = new Set((bi && bi.held) || []);
  return { pressed: (a) => p.has(a), isDown: (a) => h.has(a) };
}

export function stepMatch(s, inputs) {
  inputs = inputs || {};
  const skip = !!inputs.skip;
  if (s.phase === 'walk') {
    s.phaseTick++;
    if (s.phaseTick >= WALK_TICKS || skip) {
      s.phase = 'chess'; s.phaseTick = 0; resetHalf(s.clock); s.movedThisHalf = { player: false, enemy: false };
    }
  } else if (s.phase === 'chess') {
    tickChessClock(s.clock, s.board.turn, SIM.TICK_MS);
    let resolved = false;
    if (inputs.chessMove) {
      const mover = s.board.turn;
      s.pgnMoves.push(moveLabel(s.board, inputs.chessMove));
      s.movedThisHalf[mover === s.playerColor ? 'player' : 'enemy'] = true;
      s.board = applyMove(s.board, inputs.chessMove);
      addIncrement(s.clock, mover);
      const st = status(s.board);
      if (st === 'checkmate') {
        const winner = mover === s.playerColor ? 'player' : 'enemy';
        s.over = true; s.winner = winner; s.reason = 'checkmate';
        s.chessResult = { decisive: true, winner, reason: 'checkmate' }; s.phase = 'over'; resolved = true;
      } else if (st === 'stalemate' || st === 'fifty' || st === 'material') {
        s.chessResult = { decisive: false, winner: null, reason: 'draw' }; chessToBoxing(s); resolved = true;
      }
    }
    if (!resolved) {
      const cs = chessClockStatus(s.clock, s.board.turn);
      if (cs === 'flag') {
        const winnerColor = s.board.turn === 'w' ? 'b' : 'w';
        const winner = winnerColor === s.playerColor ? 'player' : 'enemy';
        s.over = true; s.winner = winner; s.reason = 'flag';
        s.chessResult = { decisive: true, winner, reason: 'flag' }; s.phase = 'over';
      } else if (cs === 'time') {
        s.chessResult = { decisive: false, winner: null, reason: 'time' }; chessToBoxing(s);
      }
    }
  } else if (s.phase === 'boxing') {
    const box = restoreBox(s.box, { mode: s.mode, enemyParams: s.enemyParams, hooks: {} });
    box.update(SIM.TICK_MS, boxView(inputs.box));
    s.box = snapshotBox(box);
    s.hp.player = box.player.hp; s.hp.enemy = box.enemy.hp;
    if (box.over) {
      if (box.result) { s.over = true; s.winner = box.result; s.reason = 'ko'; s.phase = 'over'; }
      else if (s.round >= MATCH.TOTAL_ROUNDS) {
        s.over = true; s.reason = 'material';
        const diff = material(s.board.board).diff;
        const playerDiff = s.playerColor === 'w' ? diff : -diff;
        s.winner = playerDiff > 0 ? 'player' : playerDiff < 0 ? 'enemy' : 'draw';
        s.phase = 'over';
      } else { applyHeal(s); s.phase = 'break'; s.phaseTick = 0; }
    }
  } else if (s.phase === 'break') {
    s.phaseTick++;
    if (s.phaseTick >= BREAK_TICKS || skip) { s.round++; s.box = null; s.phase = 'walk'; s.phaseTick = 0; }
  }
  s.tick++;
  return s;
}

export function snapshotMatch(s) {
  return { tick: s.tick, phase: s.phase, phaseTick: s.phaseTick, rng: { ...s.rng },
    round: s.round, mode: s.mode, playerColor: s.playerColor, enemyParams: s.enemyParams,
    board: cloneBoard(s.board), clock: { ...s.clock }, movedThisHalf: { ...s.movedThisHalf },
    pgnMoves: [...s.pgnMoves], chessResult: s.chessResult,
    hp: { ...s.hp }, box: s.box ? JSON.parse(JSON.stringify(s.box)) : null,
    over: s.over, winner: s.winner, reason: s.reason };
}
export function restoreMatch(snap) { return snapshotMatch(snap); }
```

- [ ] **Step 4: Run to verify it passes**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 62 passed, 0 failed
exit=0
```

(58 prior − 5 stub-match tests + 9 chess-match tests = 62. The run takes ~4s.) The "chess + boxing deterministic" and "round loop reaches round 2 deterministically" tests are the core proofs; checkmate / flag / cap / material confirm the endings + Golden Rules.

- [ ] **Step 5: Commit**

```bash
git add src/sim/match.js src/sim/match.test.js
git commit -m "$(cat <<'EOF'
feat(sim): real chess in the match sim — clock, moves, endings, cap, material (2-A-2)

Replace the chess stub: tick the per-side clock + round window (chessclock),
apply a chessMove input (applyMove + Fischer increment + status), resolve
checkmate/flag/time/draw, apply the chess-skip NO_MOVE_HP_CAP on a non-decisive
end, and decide a drawn final round by chess material. Headless-deterministic
(62/62), rollback-ready.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W79S4wsgidziRj2QHrf5G1
EOF
)"
```

---

## Verification (whole plan)

Headless (verification of record), from the repo root:

```bash
osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"
```

Expected: `[TESTS] 62 passed, 0 failed` and `exit=0` (~4s).

Confirm the live game is unaffected (purely additive — nothing imports `match.js`): open `http://localhost:5174/`, play a Story match — unchanged. No console `[PAWNCH] frame error:` lines.

## What this plan deliberately does NOT do (next: 2-A-3)

- It does NOT wire `match.js` into the live game. The cutover — `game.js` + the state renderers driving `src/sim/match.js`, the chess UI emitting `chessMove`, the offline AI becoming a move-producer, the boxing/chess renderers reading `MatchState`, unioning P1+P2 box inputs, and deleting the now-dead per-state timing + `resolveChess`/`resolveBoxing`/`applyRoundHeal`/`tossColor`-random — is **Phase 2-A-3**.
- No networking (2-B), matchmaking/handshake or net-code deletion (2-C), or rollback wiring (Phase 3) — though `snapshotMatch`/`restoreMatch` are proven rollback-ready.
