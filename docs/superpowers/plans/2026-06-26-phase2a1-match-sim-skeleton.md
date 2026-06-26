# Phase 2-A-1 — Match-Sim Skeleton + Flow Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `src/sim/match.js` — a pure, deterministic, serializable sim of the whole match *flow* (walk → chess-stub → boxing → break → over, with the round loop), with `box.js` plugged in via a new `restoreBox`, and prove it deterministic + rollback-ready headlessly.

**Architecture:** A unified `MatchState` (plain serializable object) holds the phase machine, a seeded RNG, round, HP, and the boxing snapshot. `stepMatch(state, inputs)` advances one fixed tick, transitioning phases at deterministic tick boundaries; the boxing phase restores a `BoxingMatch` from the snapshot, steps it, and re-snapshots. Chess is a fixed-length stub here (real chess is Phase 2-A-2). **Purely additive** — nothing wires `match.js` into the live game yet (that's 2-A-3), so zero offline-regression risk and full headless verifiability.

**Tech Stack:** Vanilla JavaScript ES modules, no build step, no dependencies. Headless tests via macOS JavaScriptCore (`osascript`).

## Global Constraints

- **No build step, no dependencies, no framework.** Vanilla ES modules only.
- **No Node/npm.** Verification of record is headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` → `[TESTS] N passed, 0 failed`, non-zero exit on failure.
- **Sim import boundary:** `src/sim/*` imports only `../config.js` and sibling `src/sim/*`. `match.js` imports `config`, `rng`, `box`.
- **Determinism:** no `Math.random`/`Date.now`/`setTimeout`/wall-clock in `match.js`; all randomness from the seeded RNG carried in `MatchState.rng`. State is plain + serializable (no class instances stored — the boxing phase stores `snapshotBox`, not a `BoxingMatch`).
- **Additive:** this plan does NOT modify any live-game file; `match.js` is unimported by the game until Phase 2-A-3. `box.js` only GAINS `restoreBox` (no behavior change).
- **Headless concat names must be unique** across all `*.test.js` (one shared eval scope). `match.js` must NOT declare `const TICK` (collides with `clock.test.js`); it inlines `SIM.TICK_MS`. `match.test.js` helpers are `M`-prefixed (`MDUMMY`, `mcfg`, `mKoInput`, `mLoopInput`, `mHashes`) to avoid `box.test.js`'s `DUMMY`/`runHashes`.
- **Commits** end with the two standard trailers:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01W79S4wsgidziRj2QHrf5G1
  ```
- **Branch:** `phase2-lockstep` (already exists with the 2-A spec).

## File Structure

- Modify: `src/sim/box.js` — append `restoreBox(snap, opts)` (rebuild a `BoxingMatch` from a `snapshotBox` + live opts).
- Modify: `src/sim/box.test.js` — import `restoreBox`; add 2 round-trip tests.
- Create: `src/sim/match.js` — the unified match sim. Exports `newMatch`, `stepMatch`, `snapshotMatch`, `restoreMatch`.
- Create: `src/sim/match.test.js` — headless determinism + rollback tests.
- Modify: `tools/test/index.html`, `tools/test/run-headless.js` — register `match.test.js` / `match.js`.

**Interfaces (what 2-A-2/2-A-3 consume):**
- `restoreBox(snap, opts) -> BoxingMatch` — `opts = { mode, enemyParams, hooks }`.
- `newMatch(config) -> MatchState` — `config = { seed, mode, enemyParams, startHP? }`.
- `stepMatch(state, inputs) -> state` — advance one tick. `inputs = { box?: {pressed:[],held:[]}, skip?: bool }` (chess move input arrives in 2-A-2). Mutates and returns `state`.
- `snapshotMatch(state) -> plainObject`, `restoreMatch(snap) -> MatchState`.
- `MatchState` fields: `tick, phase('walk'|'chess'|'boxing'|'break'|'over'), phaseTick, rng:{s}, round, mode, playerColor, enemyParams, hp:{player,enemy}, box:<snapshotBox>|null, over, winner, reason`.

---

### Task 1: `restoreBox` — rebuild a BoxingMatch from a snapshot

**Files:**
- Modify: `src/sim/box.js` (append `restoreBox`)
- Modify: `src/sim/box.test.js` (import `restoreBox`; add 2 tests)

**Interfaces:**
- Consumes: `BoxingMatch`, `snapshotBox` (already in `box.js`); `makeMatch`, `DUMMY`, `AGG`, `STEP_MS`, `viewFor` (already in `box.test.js`).
- Produces: `restoreBox(snap, opts) -> BoxingMatch`.

- [ ] **Step 1: Write the failing test**

In `src/sim/box.test.js`, change the `./box.js` import to add `restoreBox`:

```js
import { BoxingMatch, DEFAULT_PARAMS, snapshotBox, restoreBox } from './box.js';
```

Append these two tests to the END of `src/sim/box.test.js`:

```js
test('restoreBox round-trips a snapshot (snapshot -> restore -> snapshot is identity)', () => {
  const m = makeMatch(5, DUMMY);
  for (let i = 0; i < 40; i++) m.update(STEP_MS, viewFor());
  const snap = snapshotBox(m);
  const back = snapshotBox(restoreBox(snap, { mode: 'story', enemyParams: DUMMY, hooks: {} }));
  assertEqual(JSON.stringify(back), JSON.stringify(snap));
});

test('a restored boxing sim re-simulates identically (rollback-ready)', () => {
  const m = makeMatch(9, AGG);
  for (let i = 0; i < 60; i++) m.update(STEP_MS, viewFor());
  const snap = snapshotBox(m);
  const a = []; for (let i = 0; i < 80; i++) { m.update(STEP_MS, viewFor()); a.push(snapshotBox(m).enemy.hp); }
  const r = restoreBox(snap, { mode: 'story', enemyParams: AGG, hooks: {} });
  const b = []; for (let i = 0; i < 80; i++) { r.update(STEP_MS, viewFor()); b.push(snapshotBox(r).enemy.hp); }
  assertDeepEqual(a, b);
});
```

- [ ] **Step 2: Run to verify it fails**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected: it FAILS — `restoreBox` is not exported yet (the import resolves to `undefined`, and the tests throw / the run does not reach `53 passed`). Red state.

- [ ] **Step 3: Write the implementation**

Append this function to the END of `src/sim/box.js` (after `snapshotBox`):

```js
// Rebuild a BoxingMatch from a snapshotBox + the live opts (mode/enemyParams/hooks),
// which the snapshot intentionally omits (immutable / non-serializable). Lets the
// match sim restore -> step -> snapshot each boxing tick, and enables rollback.
export function restoreBox(snap, opts) {
  const m = new BoxingMatch({ mode: opts.mode, enemyParams: opts.enemyParams, hooks: opts.hooks || {}, seed: 1 });
  m.player = { ...snap.player };
  m.enemy = { ...snap.enemy };
  m.ai = { ...snap.ai, seq: snap.ai.seq.map((x) => ({ ...x })) };
  m.timeLeft = snap.timeLeft;
  m.over = snap.over;
  m.result = snap.result;
  m.maxCombo = snap.maxCombo;
  m.rng = { ...snap.rng };
  return m;
}
```

- [ ] **Step 4: Run to verify it passes**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 53 passed, 0 failed
exit=0
```

(51 prior + 2 restoreBox.)

- [ ] **Step 5: Commit**

```bash
git add src/sim/box.js src/sim/box.test.js
git commit -m "$(cat <<'EOF'
feat(sim): restoreBox — rebuild a BoxingMatch from a snapshot (rollback-ready)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W79S4wsgidziRj2QHrf5G1
EOF
)"
```

---

### Task 2: `src/sim/match.js` — the match-sim skeleton + flow machine

**Files:**
- Create: `src/sim/match.test.js`
- Create: `src/sim/match.js`
- Modify: `tools/test/index.html`, `tools/test/run-headless.js`

**Interfaces:**
- Consumes: `MATCH`, `SIM` from `../config.js`; `newRng`, `rngFloat`, `rngInt` from `./rng.js`; `BoxingMatch`, `snapshotBox`, `restoreBox` from `./box.js` (Task 1); `DEFAULT_PARAMS` from `./box.js` and `hashHex` from `./hash.js` (tests).
- Produces: `newMatch`, `stepMatch`, `snapshotMatch`, `restoreMatch` (see interface list above).

- [ ] **Step 1: Write the failing test**

Create `src/sim/match.test.js`:

```js
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
```

- [ ] **Step 2: Register the new files and run to verify it fails**

Add to `tools/test/index.html` after the `inputview.test.js` import:

```html
    import '../../src/sim/match.test.js';
```

In `tools/test/run-headless.js`, add `'src/sim/match.js'` to `MODULES` (after `'src/sim/box.js'`) and `'src/sim/match.test.js'` to `TESTS`.

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected: it FAILS with `cannot read src/sim/match.js` and `exit=1`. Red state.

- [ ] **Step 3: Write the implementation**

Create `src/sim/match.js` with EXACTLY this content (validated headless — deterministic + rollback-ready):

```js
// Unified deterministic match sim — Phase 2-A-1 skeleton (flow machine + boxing).
// Chess is a fixed-length stub here; real chess lands in 2-A-2.
import { MATCH, SIM } from '../config.js';
import { newRng, rngFloat, rngInt } from './rng.js';
import { BoxingMatch, snapshotBox, restoreBox } from './box.js';

const WALK_TICKS = Math.round(MATCH.WALK_SECONDS * SIM.TICK_HZ);
const CHESS_STUB_TICKS = Math.round((MATCH.CHESS_HALF_SECONDS || 60) * SIM.TICK_HZ);
const BREAK_TICKS = Math.round(3.2 * SIM.TICK_HZ);

function nextSeed(rng) { return rngInt(rng, 0x100000000); }   // uint32 seed, advances rng

export function newMatch(config) {
  const rng = newRng((config.seed >>> 0) || 1);
  const playerColor = rngFloat(rng) < 0.5 ? 'w' : 'b';        // coin flip from the seed
  return {
    tick: 0, phase: 'walk', phaseTick: 0, rng,
    round: 1, mode: config.mode || 'story', playerColor,
    enemyParams: config.enemyParams || null,
    hp: { player: config.startHP?.player ?? 100, enemy: config.startHP?.enemy ?? 100 },
    box: null, over: false, winner: null, reason: null,
  };
}

function startBoxing(s) {
  const box = new BoxingMatch({
    mode: s.mode === 'pvp' ? 'pvp' : 'story',
    enemyParams: s.enemyParams || undefined,
    seconds: MATCH.BOXING_SECONDS,
    startHP: { player: s.hp.player, enemy: s.hp.enemy },
    seed: nextSeed(s.rng), hooks: {}, onKO() {}, onTime() {},
  });
  s.box = snapshotBox(box); s.phase = 'boxing'; s.phaseTick = 0;
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
    if (s.phaseTick >= WALK_TICKS || skip) { s.phase = 'chess'; s.phaseTick = 0; }
  } else if (s.phase === 'chess') {
    s.phaseTick++;
    if (s.phaseTick >= CHESS_STUB_TICKS || skip) startBoxing(s);
  } else if (s.phase === 'boxing') {
    const box = restoreBox(s.box, { mode: s.mode, enemyParams: s.enemyParams, hooks: {} });
    box.update(SIM.TICK_MS, boxView(inputs.box));
    s.box = snapshotBox(box);
    s.hp.player = box.player.hp; s.hp.enemy = box.enemy.hp;
    if (box.over) {
      if (box.result) { s.over = true; s.winner = box.result; s.reason = 'ko'; s.phase = 'over'; }
      else if (s.round >= MATCH.TOTAL_ROUNDS) {
        s.over = true; s.reason = 'material';
        s.winner = s.hp.player > s.hp.enemy ? 'player' : s.hp.enemy > s.hp.player ? 'enemy' : 'draw';
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
    hp: { ...s.hp }, box: s.box ? JSON.parse(JSON.stringify(s.box)) : null,
    over: s.over, winner: s.winner, reason: s.reason };
}
export function restoreMatch(snap) { return snapshotMatch(snap); }
```

- [ ] **Step 4: Run to verify it passes**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 58 passed, 0 failed
exit=0
```

(53 prior + 5 match.) The "same seed -> identical per-tick hashes" over a full match segment is the core proof; the "restore + re-simulate" test confirms the sim is rollback-ready.

- [ ] **Step 5: Commit**

```bash
git add src/sim/match.js src/sim/match.test.js tools/test/index.html tools/test/run-headless.js
git commit -m "$(cat <<'EOF'
feat(sim): unified match-sim skeleton — deterministic flow machine (src/sim/match.js)

Phase 2-A-1: pure serializable MatchState + stepMatch advancing walk -> chess(stub)
-> boxing -> break -> over with the round loop, boxing plugged in via restoreBox,
seeded coin flip + heal. Headless-proven deterministic + rollback-ready (58/58).
Additive — not wired into the live game until 2-A-3.

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

Expected: `[TESTS] 58 passed, 0 failed` and `exit=0`.

Confirm the live game is unaffected (purely additive — nothing imports `match.js`): open `http://localhost:5174/`, play a Story match — unchanged. No console `[PAWNCH] frame error:` lines.

## What this plan deliberately does NOT do (next: 2-A-2, 2-A-3)

- The chess phase is a **fixed-length stub** (a timer pass-through). Real chess — clock via `chessclock`, move-as-input, checkmate/flag/draw endings — is **Phase 2-A-2**, which replaces the stub.
- It does NOT wire `match.js` into the live game (`game.js` / the state renderers, chess-move emission, the offline AI as a move-producer, seeding the live coin flip + heal). That cutover is **Phase 2-A-3**.
- No networking (2-B), matchmaking/handshake or net-code deletion (2-C), or rollback wiring (Phase 3) — though `snapshotMatch`/`restoreMatch` are built and proven rollback-ready here.
