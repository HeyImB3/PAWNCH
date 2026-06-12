# PAWNCH Tutorial Mode — Design Spec

**Date:** 2026-06-12
**Status:** Approved (brainstorm) → ready for implementation plan
**Branch:** `feature/tutorial-mode`

## Goal

Give brand-new players a gentle on-ramp to both halves of PAWNCH. A new
**TUTORIAL** entry in the main menu opens a two-tile select screen (CHESS / FIGHT);
each tile launches a short, fully-interactive, beginner-focused tutorial with
freeze-frame teaching windows that pause the action until the player presses
**Enter**.

This must not endanger the real match path. All tutorial code is **self-contained
new states** that reuse existing primitives (the chess board module, `piece()`
drawing, the `BoxingMatch` sim) but **never touch** `game.js`'s `resolveChess` /
`resolveBoxing` / round logic, nor the live `ChessState` / `BoxingState`
(Golden Rule 6). The release-blocking online code is likewise untouched.

## Design pillars honored

- **Hard on purpose / skill game:** the tutorial *teaches* the read-and-react loop
  and the perfect parry; it does not dumb down the real ladder. The dummy is a
  teaching tool confined to the tutorial, not a new roster fight.
- **You out-read, not out-mash:** the parry lesson is the centerpiece of the fight
  tutorial. The anti-mash rules in `boxing.js` (`BOX.PARRY`, whiff cost, lockout)
  are **unchanged** (Golden Rule 9).
- **Both halves matter:** the tutorial covers chess *and* boxing as equals.

## Architecture (approach ①)

Three new self-contained states + two small shared helpers. Everything is vanilla
ES modules, no build step, no deps (Golden Rule 1). All tuning pulls from
`config.js` / `PAL` (Golden Rules 2 & 3); all drawing goes through `gfx.js`
helpers with `imageSmoothingEnabled` left off (Golden Rule 4).

### New files
- `src/states/tutorial.js` — `TutorialState` (two-tile select screen).
- `src/states/tutorialchess.js` — `TutorialChessState` (guided opening).
- `src/states/tutorialbox.js` — `TutorialBoxState` (staged fight lessons).
- `src/teach.js` — `TeachSequence`, the shared freeze-frame teaching component.

### Changed files
- `src/game.js` — register the three states in the `STATES` map. No changes to
  match lifecycle / resolve methods.
- `src/states/title.js` — add the `TUTORIAL` menu item.
- `src/gfx.js` — add a `glove()` helper (procedural, sprite-overridable).
- `src/boxing.js` — add ONE additive optional hook, `onBlock(side)` (see below).
- `src/config.js` — add a `TUTORIAL` config block (dummy params + tuning).
- `assets/sprites/manifest.example.json` — document the optional `boxers.glove`
  sprite key (so the future glove sprite is discoverable). The game still runs
  with zero image files (Golden Rule 5).

## Component: `TeachSequence` (`src/teach.js`)

A reusable "freeze time, show a window, press Enter to continue" component, used by
both tutorials so the behavior is identical.

- **State:** a queue of steps `{ title, lines: string[], onShow?: () => void }` and
  the currently-active step (or `null`).
- **API:**
  - `queue(steps)` / `push(step)` — enqueue teaching windows.
  - `get active()` — truthy while a window is showing (the owner freezes its sim
    while this is true).
  - `update(input)` — when active, **Enter** (`confirm`) advances to the next step
    (plays `sfx.confirm`); returns `true` the frame the last step is dismissed.
  - `draw(ctx, game)` — dims the scene, draws a centered `panel()` with the title,
    wrapped body `lines`, and a blinking `PRESS ENTER ▶` prompt. Uses `PAL` only.
- **Freeze semantics:** the owning state checks `teach.active` at the top of its
  `update()`. If active, it advances only the teach sequence and **does not** tick
  its sim / accept gameplay input — this is the "freeze time" the design calls for.

## Component: `glove()` (`src/gfx.js`)

`glove(ctx, cx, cy, size, { glow })` draws a 16-bit red boxing glove pointing up
with the cuff opening (the inside) visible at the bottom, matching the approved
mockup. It first checks for a registered sprite (`SPRITES.boxers.glove`, loaded via
the existing manifest path in `assets.js`) and blits that if present; otherwise it
draws the procedural placeholder bitmap. Colors come from `PAL` (red body, dark
shadow, light cuff). This keeps the game asset-free by default and lets the user
drop in `assets/sprites/glove.png` later with a one-line manifest entry
(`"boxers": { "glove": "glove.png" }`).

## State: title menu change (`src/states/title.js`)

Add `{ id: 'tutorial', label: 'TUTORIAL' }` to the items list, positioned first
among the always-present items (after `CONTINUE` when it exists) so a new player is
highlighted on it by default. Selecting it calls `game.changeState('tutorial')`.
(Trivially reorderable if a lower slot is preferred.)

## State: `TutorialState` — tile select (`src/states/tutorial.js`)

The approved **option B** screen:
- Dark arcade background (reuse `bgGradient` + a light starfield, like the title).
- Header `TUTORIAL` (orange) + subtitle `CHOOSE WHAT TO LEARN` (blue).
- Two tiles side by side, labels **CHESS** / **FIGHT** above each:
  - CHESS tile: blue-accented panel + glow; artwork is the **celestial white king**.
    Draw it specifically from the celestial set regardless of the player's chosen
    set (temporarily select the `celestial` piece set for this draw, or draw `wk`
    directly), with a warm sun halo behind it.
  - FIGHT tile: orange-accented panel + glow; artwork is `glove()` with a red halo.
- The selected tile pulses gold with `>` / `<` carets (mirrors the title menu feel).
- **Controls:** Left/Right (and mouse hover/click) choose a tile; Enter selects;
  Esc → `changeState('title')`.
- CHESS → `changeState('tutorialChess')`; FIGHT → `changeState('tutorialBox')`.
- No `game.match` is created (tutorials hold their own lightweight sim), so the
  in-game pause overlay never engages here; Esc backs out instead.

## State: `TutorialChessState` — guided opening (`src/states/tutorialchess.js`)

Visually matches the real chess half: same board geometry (`SQ = 44`, `OX = 17`,
`OY = 40`), the same `piece()` art using the **player's chosen piece set**, the
same cursor + green legal-move dots. It holds its **own** `Chess.newGame()` and
applies moves with `Chess.applyMove` (real, validated chess). It has **no clocks,
HP, rounds, or `resolve*`** — the side panel shows tutorial progress instead.

### Scripted line (player = White)

A fixed sequence designed so the player drives **every piece type once**, the
opponent plays slightly weak, a capture nets a clean pawn, and each type is taught
by a freeze-frame the first time it is used. (Verified legal and sound.)

| # | Player move | Teaches (freeze-frame on first use) | Opponent reply |
|---|-------------|-------------------------------------|----------------|
| 1 | **e4**  | PAWN — forward one (two on first move), captures diagonally | e5 |
| 2 | **Nf3** | KNIGHT — the L-shape; the only piece that jumps | Nc6 |
| 3 | **Bc4** | BISHOP — diagonals | Bc5 |
| 4 | **O-O** | KING — one square any direction, **and** castling (king + rook together) | Nf6 |
| 5 | **Re1** | ROOK — straight lines (files & ranks) | d6 |
| 6 | **Qe2** | QUEEN — rook + bishop combined | **b5??** |
| 7 | **Bxb5**| CAPTURING — land on an enemy piece to remove it; you're now **+1 pawn** | (end) |

- Each step stores `{ from, to, promo?, teachKey?, oppReply: {from,to} }`.
- **Interaction:** only the highlighted required move is accepted. The from-square
  pulses and the to-square shows the green legal dot; the player may use
  click / drag / keyboard exactly like the real half. A wrong move plays a soft
  reject sfx and a transient "Make the highlighted move" hint — it does not advance.
- After the player's move animates, the opponent's scripted reply auto-plays after a
  short beat (reuse the real move-animation juice).
- **End:** a final teach window — "You're up a pawn with a winning position. In a
  real match, checkmate or running your opponent's clock to zero wins the half
  instantly." → `changeState('tutorial')`.
- **Esc** at any time → `changeState('tutorial')`.

### Board-render reuse

To match the real half, reuse the same constants and `piece()` / `panel()` calls.
The board-drawing core (frame + squares + pieces + cursor + legal dots) is small;
duplicating it inside `TutorialChessState` is acceptable and matches the codebase's
"small, self-contained states" style (Golden Rule 7). If duplication proves large
during implementation, extract a pure `drawBoard(ctx, chess, opts)` helper that
both `ChessState` and `TutorialChessState` call — but only as a clean, behavior-
preserving extraction (chess half is not the broken subsystem; keep risk low).

## State: `TutorialBoxState` — staged lessons (`src/states/tutorialbox.js`)

Wraps the **real `BoxingMatch`** for authentic feel, configured with a new
super-easy `TUTORIAL_DUMMY` params set from `config.js`:
- Long `telegraphMs` / `recoverMs` (very readable, huge openings), tiny `punchDmg`,
  `aggression` low at rest, `parrySkill: 0`, no `signature` / `special`. Easier
  than Patty (`d = 0.05`) by construction.
- No KO / time stakes: `seconds` set very high so `onTime` never fires; the lesson
  queue drives progression. If the player is ever downed (unlikely at this damage),
  treat it as benign (revive / ignore) — losing is not possible in the tutorial.

### Lesson queue (each: teach → unfreeze → wait for demonstration → advance)

1. **Intro** — "Read the tell, react, then punish."
2. **JAB** — A/D (or arrows). Advance when the player throws a jab.
3. **HOOK** — Q/E. Advance on a hook.
4. **BLOCK** — hold S to guard (chips damage). The dummy throws a slow jab; advance
   on a successful block.
5. **DODGE** — Z/C to slip, X to duck. Advance when the player slips/ducks a punch.
6. **PARRY** (centerpiece) — raise guard (S) the instant the punch lands, not early,
   not held. Explain the tell to watch (glove flash + HIGH/LOW banner). The dummy
   feeds slow, clearly-telegraphed blockable jabs; allow multiple gentle attempts
   with encouraging hints. Advance on a successful parry.
7. **Free spar** — "You've got it. Spar freely; try a star punch (hook with a star).
   Press Enter to finish." → `changeState('tutorial')`.

- During the read-and-react lessons (4–6), temporarily nudge the dummy's
  `aggression` so it reliably throws a readable punch every ~2s to practice on
  (tunable in `config.js`). Telegraphs stay long and damage tiny.
- **Detection** uses existing hooks: `onPunch(side, kind)` (jab/hook),
  `onParry(side)`, `onDodge(side)`. For block detection, add ONE additive optional
  hook to `boxing.js`: `onBlock(side)` fired where an attack resolves as `'block'`
  (in `_strike` / `_playerContact`). Real matches simply do not pass `onBlock`, so
  their behavior is unchanged, and the anti-mash parry mechanics are untouched
  (Golden Rule 9).
- **Esc** at any time → `changeState('tutorial')`.

## Config additions (`src/config.js`)

A `TUTORIAL` block, e.g.:
- `TUTORIAL.DUMMY` — the easy boxing params object described above.
- `TUTORIAL.PRACTICE_AGGRESSION` — the bumped aggression used during lessons 4–6.
- Any teach-panel tuning (panel size, blink rate) if not derivable from existing UI.

No magic numbers scattered in state code (Golden Rule 2).

## Data flow / freeze model

- `Game.update` already supports a global hit-stop (`this.freeze`) but that is for
  impact juice; the tutorial's "freeze time" is owned by each tutorial state via
  `TeachSequence.active` (so it composes cleanly and needs no `game.js` change).
- State transitions all go through the existing `game.changeState()` wipe.
- No new persistence; `localStorage` / `SAVE_KEY` untouched.

## Error handling / edge cases

- **No assets present:** celestial king falls back to the procedural glyph; glove
  falls back to the procedural bitmap. Game runs 100% procedural (Golden Rule 5).
- **Player set ≠ celestial:** tile forces the celestial king for art; the chess
  tutorial board respects the player's set (matches a real match).
- **Wrong chess move / illegal attempt:** rejected with a hint; never advances.
- **Esc mid-tutorial:** clean return to the tile screen; no dangling `match`.
- **Frame errors:** the loop's per-frame try/catch still applies.

## Testing (manual — no automated suite)

Run `npm run dev`, then:
1. Title shows **TUTORIAL**; selecting it opens the two-tile screen (option B look,
   celestial king + red glove).
2. CHESS tile: each piece type triggers its teach window once; only the highlighted
   move is accepted; opponent replies auto-play; line ends at **Bxb5** with the
   player +1 pawn; returns to tile screen.
3. FIGHT tile: each lesson freezes on a teach window (Enter advances); jab, hook,
   block, dodge, and **parry** each gate progression; free spar works; returns to
   tile screen.
4. Esc backs out at every level (tutorial → tile screen → title).
5. Confirm a normal Story match still plays unchanged (resolve/round logic intact).
6. Watch the console for `[PAWNCH] frame error:`.

## Out of scope (YAGNI)

- Saving tutorial completion (no `SAVE_KEY` bump).
- Online / multiplayer tutorial.
- A new `ROSTER` opponent (the dummy is a local config const).
- Shipping a real glove PNG (placeholder only; sprite hook is ready).
