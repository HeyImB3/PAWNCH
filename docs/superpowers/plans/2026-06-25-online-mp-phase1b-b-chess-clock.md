# Online Multiplayer — Phase 1B-B: Deterministic Chess Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `src/sim/chessclock.js` — a deterministic, tick-based chess-clock model (per-player clocks + per-round window + flag/time detection + Fischer increment) — so the chess half's clocks become a function of a shared tick count instead of wall-clock `dt`, and prove it with headless tests.

**Architecture:** The chess BOARD (`src/chess/board.js`) is already pure and deterministic; the only nondeterminism in the chess half is the clock, which `src/states/chess.js` currently decrements by wall-clock `dt` (lines 103, 112). This plan extracts the clock as a tiny pure module under `src/sim/` whose values are advanced by the caller's fixed `dt` (`SIM.TICK_MS` in lockstep) — so two clients compute identical clock values from the same tick count, with no drift and no clock-snapshot reconciliation. It is **purely additive**: the live game keeps using the `dt`-based clock in `states/chess.js` until Phase 1B-C wires this module in. There is no RNG here, so determinism is structural (pure subtraction); the tests pin the tick arithmetic and the flag/time/precedence logic.

**Tech Stack:** Vanilla JavaScript ES modules, no build step, no dependencies. Headless tests via macOS JavaScriptCore (`osascript`).

## Global Constraints

- **No build step, no dependencies, no framework.** Vanilla ES modules only.
- **No Node/npm on the dev machine.** Verification of record is headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` → `[TESTS] N passed, 0 failed`, non-zero exit on failure. The browser page is an optional human cross-check.
- **Sim import boundary:** `src/sim/chessclock.js` imports ONLY `../config.js` (for `MATCH`). No DOM/`gfx`/`audio`/`Math.random`/`Date.now`/wall-clock.
- **Faithful to the live clock semantics:** values stay in milliseconds; per-player clocks persist across rounds (only the round window resets each half); the Fischer increment is `MATCH.CHESS_INCREMENT_MS`; and **the round-window ('time') takes precedence over a flag** on a tick where both cross zero — matching `states/chess.js`, which checks `halfTime` (line 103-104) before the per-player clock (line 112-113).
- **Headless concat names unique:** the headless runner concatenates all `*.test.js` into one scope. `chessclock.test.js` declares NO top-level helper consts (everything lives inside `test()` callbacks) and uses `SIM.TICK_MS` directly, so there is nothing to collide.
- **Tune from `src/config.js`:** the module reads `MATCH.CHESS_SECONDS`, `MATCH.CHESS_HALF_SECONDS`, `MATCH.CHESS_INCREMENT_MS` as defaults — no new magic numbers.
- **Commits** end with the two standard trailers:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01W79S4wsgidziRj2QHrf5G1
  ```
- **Branch:** all work on `online-multiplayer` (create from `main`: `git checkout -b online-multiplayer`).

## File Structure

- Create: `src/sim/chessclock.js` — the clock model. Exports `newChessClock`, `tickChessClock`, `addIncrement`, `resetHalf`, `chessClockStatus`. Imports only `../config.js`.
- Create: `src/sim/chessclock.test.js` — headless tests for the arithmetic and status logic.
- Modify: `tools/test/index.html` — add the `chessclock.test.js` import.
- Modify: `tools/test/run-headless.js` — add `'src/sim/chessclock.js'` to `MODULES` (after `'src/sim/box.js'`) and `'src/sim/chessclock.test.js'` to `TESTS`.

**Interfaces (what 1B-C will consume):**
- `newChessClock(perPlayerMs?, halfMs?) -> { w, b, halfLeft }` — all ms; defaults from `MATCH`.
- `tickChessClock(c, toMove, dt) -> c` — `toMove` is `'w'|'b'`; decrements that side's clock and `halfLeft` by `dt`. Mutates and returns `c`.
- `addIncrement(c, side, incMs?) -> c` — adds the Fischer increment to `side` (the side that just moved).
- `resetHalf(c, halfMs?) -> c` — resets `halfLeft` at the start of a new chess half; per-player clocks untouched.
- `chessClockStatus(c, toMove) -> 'time' | 'flag' | null` — how the half should end this tick (window expiry before flag).

---

### Task 1: Deterministic chess clock module + tests

**Files:**
- Create: `src/sim/chessclock.test.js`
- Create: `src/sim/chessclock.js`
- Modify: `tools/test/index.html`, `tools/test/run-headless.js`

**Interfaces:**
- Consumes: `MATCH`, `SIM` from `../config.js`; the runner from `../../tools/test/runner.js`.
- Produces: `newChessClock`, `tickChessClock`, `addIncrement`, `resetHalf`, `chessClockStatus` (see above).

- [ ] **Step 1: Write the failing test**

Create `src/sim/chessclock.test.js`:

```js
import { suite, test, assert, assertEqual } from '../../tools/test/runner.js';
import { newChessClock, tickChessClock, addIncrement, resetHalf, chessClockStatus } from './chessclock.js';
import { MATCH, SIM } from '../config.js';

suite('chessclock');

test('a fresh clock has full per-player clocks and the round window', () => {
  const c = newChessClock();
  assertEqual(c.w, MATCH.CHESS_SECONDS * 1000);
  assertEqual(c.b, MATCH.CHESS_SECONDS * 1000);
  assertEqual(c.halfLeft, MATCH.CHESS_HALF_SECONDS * 1000);
});

test('ticking burns the side-to-move clock and the round window only', () => {
  const c = newChessClock();
  tickChessClock(c, 'w', SIM.TICK_MS);
  assert(Math.abs(c.w - (MATCH.CHESS_SECONDS * 1000 - SIM.TICK_MS)) < 1e-9, 'w should drop one tick');
  assertEqual(c.b, MATCH.CHESS_SECONDS * 1000);              // the other side is untouched
  assert(Math.abs(c.halfLeft - (MATCH.CHESS_HALF_SECONDS * 1000 - SIM.TICK_MS)) < 1e-9, 'window should drop one tick');
});

test('600 ticks burns ~10s (tick-based, not wall-clock)', () => {
  const c = newChessClock();
  for (let i = 0; i < 600; i++) tickChessClock(c, 'w', SIM.TICK_MS);
  assert(Math.abs(c.w - (MATCH.CHESS_SECONDS * 1000 - 10000)) < 0.01, 'w off: ' + c.w);
});

test('flag when the side-to-move clock reaches zero', () => {
  const c = newChessClock(50, 100000);                       // 50ms clock, big window
  assertEqual(chessClockStatus(c, 'w'), null);
  for (let i = 0; i < 4; i++) tickChessClock(c, 'w', SIM.TICK_MS);   // 4 * 16.67ms > 50ms
  assertEqual(chessClockStatus(c, 'w'), 'flag');
});

test('time when the round window expires', () => {
  const c = newChessClock();
  for (let i = 0; i < 3601; i++) tickChessClock(c, 'w', SIM.TICK_MS);   // past the 60s window
  assertEqual(chessClockStatus(c, 'w'), 'time');
});

test('round-window expiry takes precedence over a simultaneous flag', () => {
  const c = newChessClock(50, 50);
  tickChessClock(c, 'w', 60);                                // both cross zero this tick
  assertEqual(chessClockStatus(c, 'w'), 'time');            // matches live chess.js: window checked first
});

test('increment adds to the moving side only', () => {
  const c = newChessClock();
  addIncrement(c, 'w');
  assertEqual(c.w, MATCH.CHESS_SECONDS * 1000 + MATCH.CHESS_INCREMENT_MS);
  assertEqual(c.b, MATCH.CHESS_SECONDS * 1000);
});

test('resetHalf restores the window but keeps the per-player clocks', () => {
  const c = newChessClock();
  for (let i = 0; i < 60; i++) tickChessClock(c, 'w', SIM.TICK_MS);
  const wBefore = c.w;
  resetHalf(c);
  assertEqual(c.halfLeft, MATCH.CHESS_HALF_SECONDS * 1000);
  assertEqual(c.w, wBefore);                                 // per-player clocks persist across rounds
});
```

- [ ] **Step 2: Register the new files and run to verify it fails**

Add to `tools/test/index.html` after the `box.test.js` import:

```html
    import '../../src/sim/chessclock.test.js';
```

In `tools/test/run-headless.js`, add `'src/sim/chessclock.js'` to `MODULES` (after `'src/sim/box.js'`) and `'src/sim/chessclock.test.js'` to `TESTS`.

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected: it FAILS with `cannot read src/sim/chessclock.js` and `exit=1`. This is the red state.

- [ ] **Step 3: Write the implementation**

Create `src/sim/chessclock.js`:

```js
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
```

- [ ] **Step 4: Run to verify it passes**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 46 passed, 0 failed
exit=0
```

(38 prior + 8 chessclock.) Optional browser cross-check: title `✓ 46 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/sim/chessclock.js src/sim/chessclock.test.js tools/test/index.html tools/test/run-headless.js
git commit -m "$(cat <<'EOF'
feat(sim): deterministic tick-based chess clock (src/sim/chessclock.js)

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

Expected: `[TESTS] 46 passed, 0 failed` and `exit=0`.

Confirm the live game is unaffected (this plan only ADDS `src/sim/chessclock.js` + tests; nothing imports it yet): open `http://localhost:5174/`, play a chess half — it still runs on the `dt`-based clock in `states/chess.js`, unchanged. No console `[PAWNCH] frame error:` lines.

## What this plan deliberately does NOT do (next: Phase 1B-C)

- It does NOT rewire `states/chess.js` to use this module (replacing `this.m.clocks[side] -= dt` and `this.halfTime -= dt`), nor delete the clock-snapshot net band-aid (`applyNetClock`/`_broadcastNetClock`). That happens in **Phase 1B-C** with the loop-level fixed-step wiring.
- It does NOT seed `tossColor()` (`src/chess/board.js:10`) or the offline AI reveal-delay (`states/chess.js`) — those are flow/offline concerns folded into **Phase 1B-C** (where the per-match seed is established). The chess board and move application are already deterministic and need no change.
- No boxing integration (1B-C), networking (Phase 2), rollback (Phase 3), rating server (Phase 4), or Steam wrapper (Phase 5).
