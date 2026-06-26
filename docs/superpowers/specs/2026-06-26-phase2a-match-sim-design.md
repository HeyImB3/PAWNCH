# Phase 2-A — Whole-Match Deterministic Sim: Design Spec

**Date:** 2026-06-26
**Status:** Design for review (precedes the implementation plan).
**Part of:** Phase 2 (lockstep) of the online-multiplayer rebuild
(`docs/superpowers/specs/2026-06-25-online-multiplayer-design.md`). 2-A is the foundation;
2-B (lockstep netcode) and 2-C (matchmaking handshake + net cleanup) build on it.

## Goal

Make the **entire match** — walk-up, chess half, boxing half, round break, and every flow
transition — one **pure, deterministic, serializable simulation** advanced by a fixed 60 Hz tick and
seeded once. The on-screen states become **renderers** that read sim state and emit input events.
Today only the boxing half is deterministic (`src/sim/box.js`, Phase 1B-C); this extends that to the
whole match. It is **headless-provable**: a full match replayed from the same seed + input log
produces an identical per-tick state hash (`checkDeterministic`). This is the foundation lockstep
(2-B) runs on, and the snapshot/restore rollback (Phase 3) needs.

## Why this is the hard part

Lockstep keeps two clients in sync **only if the whole match is deterministic**. Right now the chess
clock decrements by wall-clock `dt`, the walk-up and round-break time out by wall-clock seconds, the
coin flip and round-heal use `Math.random`, and flow transitions fire on `setTimeout` + the wall-clock
wipe. Each of those is a divergence source. 2-A removes them all by moving the match's *logic* onto the
shared tick counter and the seeded RNG, leaving the states with only *rendering*.

## Architecture

### The sim owns the match; states render it

Today `game.js` is the state machine: it swaps state **classes** (`walk`→`chess`→`boxing`→`break`) via
`changeState` and runs `resolveChess`/`resolveBoxing` to decide transitions. In 2-A the **phase lives
in the sim** (`state.phase`), and transitions are deterministic tick-boundary events inside the sim.
The renderer dispatches drawing by `sim.phase`; the existing state classes keep their `draw()` (and UI
input handling) but their timing/logic moves into the sim.

New module layout (final names settled in the plan):
- `src/sim/match.js` — the unified match sim: `newMatch(config) -> MatchState`,
  `stepMatch(state, inputs) -> MatchState` (advance one tick), `snapshotMatch(state)` /
  `restoreMatch(snap)` (serialize for hashing + rollback). Imports only `config` + sibling `src/sim/*`
  (`box`, `chessclock`, `rng`, `hash`) + `chess/board` (already pure & deterministic).
- `src/sim/coinflip.js` (tiny) — derive the coin-toss result from the seed (replaces `tossColor`).
- The states (`walk`, `chess`, `boxing`, `roundbreak`, `matchend`) lose their update/timing logic and
  become render+input modules driven by `MatchState`.

### MatchState (all serializable — no class instances, no closures, no DOM)

```
{
  tick,                       // global tick counter
  phase,                      // 'walk' | 'chess' | 'boxing' | 'break' | 'over'
  phaseTick,                  // ticks since this phase began
  rng: { s },                 // the match RNG, seeded once from the match seed
  round,                      // 1..TOTAL_ROUNDS
  mode,                       // 'story' | 'pvp'   (story => an AI move-producer feeds chess/box inputs)
  playerColor,                // 'w' | 'b'  (derived from the seed via coinflip)
  // chess (board is already pure/serializable via FEN or the plain board object)
  board,                      // Chess board state
  clock: { w, b, halfLeft },  // chessclock state (ms)
  movedThisHalf: { player, enemy },
  pgnMoves: [],
  chessResult,                // last half's {decisive,winner,reason}
  // boxing (box.js snapshot — restored to a BoxingMatch when stepping the boxing phase)
  box: <snapshotBox> | null,
  // shared
  hp: { player, enemy },
  over, winner, reason,
}
```

The boxing half runs `src/sim/box.js`. To keep MatchState plain, the boxing phase stores
`snapshotBox`; `stepMatch` restores a `BoxingMatch` from it, advances one tick, and re-snapshots.
(This needs the `restoreBox` carry-forward from 1B-A — `restore` takes `mode`/`enemyParams`/seed from
MatchState, not the snapshot.) Hooks (audio/FX) are **not** in the sim — the renderer reads sim state
transitions and fires effects, OR `stepMatch` returns an **event list** the renderer consumes (decision
in the plan; leaning toward an emitted-events list so FX stay perfectly out of the sim).

### Input model (per tick)

```
inputs = { p1: PlayerInput, p2: PlayerInput }
PlayerInput = {
  box: { pressed: [actions], held: [actions] } | null,   // boxing buttons (see inputview)
  chessMove: { from, to, promo } | null,                 // a committed chess move THIS tick
  skip: bool,                                             // advance walk-up / round-break early
}
```

The sim uses only the field relevant to the current phase. Crucially, **the chess move is an input
event**, not UI: the chess renderer keeps all the non-deterministic UI (cursor, mouse drag, promotion
picker, move animation, the offline AI's think-time) and, when a move is *committed*, emits
`chessMove`. The sim applies it (`board.applyMove` + Fischer increment + status). For lockstep (2-B)
the `chessMove` is the tick-stamped input exchanged over the wire; for the offline AI it's produced by
an AI driver and fed as `p2.chessMove`. This keeps the sim free of UI, animation, and AI randomness.

### stepMatch(state, inputs) — per phase

- **walk:** `phaseTick++`; on round 1, run the coin-toss reveal window (deterministic, derived from
  seed); when `phaseTick >= WALK_TICKS` or a `skip` → `phase='chess'`.
- **chess:** `chessclock.tickChessClock(clock, sideToMove, TICK_MS)`; apply a `chessMove` input if
  present (`applyMove` + `addIncrement` + record PGN/movedThisHalf + `Chess.status`); resolve endings
  via `chessClockStatus` (flag/time) and status (checkmate/draw) → set `chessResult`, transition to
  `boxing` (non-decisive) or `over` (decisive checkmate/flag). Replaces `chess.js` lines 103/112/332 +
  `resolveChess`.
- **boxing:** restore `BoxingMatch` from `box`, `box.update(TICK_MS, boxInputView)`, re-snapshot; on
  KO → `over`; on time → `break` (or `over` on the final round via material). Replaces `resolveBoxing`.
- **break:** `phaseTick++`; apply the **seeded** round-heal once (replaces `applyRoundHeal`'s
  `Math.random`); when `phaseTick >= BREAK_TICKS` or `skip` → `round++`, `phase='walk'` (or `over`).
- **over:** terminal; the renderer shows match-end.

All the per-phase durations (`WALK_TICKS`, `BREAK_TICKS`, the chess half window, boxing seconds) come
from `MATCH`/`SIM` config as **tick counts**. Transition delays that today are cosmetic `setTimeout`s
(the 900/1100 ms "let the result land" pauses) become render-only — the *logical* transition is the
deterministic tick; the renderer can still hold a visual beat.

### The renderer / loop

`game.js` steps the match sim in its fixed-step `tick(game, input)` path (already built in 1B-C), and a
single match-render dispatcher draws the phase-appropriate view (reusing the existing `walk`/`chess`/
`boxing`/`roundbreak`/`matchend` draw code). The wipe transition becomes a pure render flourish over
deterministic phase changes. The chess UI handler produces `chessMove` events; the boxing input is
captured via `inputview` as today.

## Verification (headless-first)

The whole point: **determinism is provable without a browser.** Extend the harness with a full-match
determinism test — `newMatch(seed)` + a scripted input log (walk-skip, a few chess moves, boxing
buttons, across a couple of rounds) run through `stepMatch`, twice, asserting identical per-tick
`hashState(snapshotMatch(...))`. Plus a negative control (different seed diverges) and targeted tests
(a chess move applies + flags deterministically; a round-heal is seed-identical; the coin flip is
seed-derived). The live game is then a **browser playtest** (offline still plays the same), since the
renderer can't load headless — but the *logic* is proven by the harness.

## Decomposition of 2-A (each its own plan → execute cycle)

1. **2-A-1 — Match-sim skeleton + flow state machine.** `newMatch`/`stepMatch`/`snapshotMatch`/
   `restoreMatch` with the phase machine (walk/break as tick timers, transitions), the seed/RNG, the
   coin flip, and the boxing phase plugged into `box.js` (add `restoreBox`). Chess phase stubbed to a
   fixed-length pass-through initially. Headless full-match determinism test (walk→boxing→break loop).
2. **2-A-2 — Chess into the sim.** Clock via `chessclock`, move application + status + endings, move
   as an input event. Headless determinism over chess halves (scripted move inputs).
3. **2-A-3 — Cut the live game over to the match sim.** Rewire `game.js` + the state renderers to drive
   `src/sim/match.js`; chess UI emits `chessMove`; the offline AI becomes a move-producer; seed the
   heal + coin flip live; delete the now-dead per-state timing logic and the old `resolveChess`/
   `resolveBoxing`/`applyRoundHeal`/`tossColor`-random. Browser playtest (offline parity).

(The dead authoritative-timeline net code — `netFlow`, `applyNetClock`, etc. — is deleted in 2-C with
the online rebuild, not here.)

## Risks & how we de-risk

- **The chess move/UI split** is the subtlest part: the renderer keeps cursor/drag/promotion/animation/
  AI; only the committed move crosses into the sim. We dry-run a headless chess-move determinism test
  before wiring the live UI.
- **BoxingMatch is a class inside a serializable state.** Resolved by `snapshotBox`/`restoreBox` at the
  phase boundary; add `restoreBox` (1A carry-forward) with a round-trip test.
- **Offline regression** is the live risk of 2-A-3 (the cutover). Mitigations: keep gameplay constants
  in `config`; build 2-A-1/2-A-2 additively and prove them headless first; cut over last; parse-check
  every edited live file via JavaScriptCore; the user's offline playtest is the final gate.
- **Transition feel** (the cosmetic `setTimeout` beats) must be preserved as render-only so the cutover
  doesn't change pacing.

## Out of scope for 2-A

- Networking / input exchange / stall / desync-hash-over-the-wire (2-B).
- Matchmaking handshake, the shared server seed, deleting the dead net scaffolding, online flow (2-C).
- Rollback (Phase 3) — but 2-A's `snapshotMatch`/`restoreMatch` are built to enable it.
