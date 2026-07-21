# Visual Overhaul V4 — Chess Broadcast Panel: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chess half's plain text side-column with painted championship-broadcast chrome: physical clock plates, captured-piece trays with a fly-in animation, a net-advantage badge, the burning-fuse half-timer, a move ticker, and portrait slots (silhouette placeholders until V5) with check-alarm/winner effects.

**Architecture:** One painted chrome strip (`assets/sprites/ui/chesspanel.png`, 129×448, blitted at x=383) carries every recess/plate/tray/track at positions declared in a new `PANEL` config block; `ChessState` gains a `_broadcastPanel()` renderer that draws all dynamic content (digits, icons, flames, ticker) into those recesses, falling back to the existing `_sidePanel()` text column when the sprite is absent. Captured pieces are **derived from the board every frame** (no match-model changes); the fly-in is transient render state in `ChessState`. A new `tools/chess-preview.html` harness mocks a mid-game match (scripted `1.e4 d5 2.exd5 Qxd5` = two captures + SAN history) for headless QA — it will serve V5's portraits too.

**Tech Stack:** Unchanged (PIL painter, Canvas 2D, Aseprite master, headless-Chrome QA).

## Global Constraints

- All prior Global Constraints verbatim (no deps; tuning in config; presentation-only — `m.chess`/`m.clocks`/`m.hp`/`m.pgnMoves` are READ, never written by panel code; zero-asset boot = legacy text panel pixel-identical; suite `66 passed, 0 failed`).
- Panel geometry: column x=383, painted strip 129×448 at (383,0); board untouched (user: "the board doesn't look bad").
- Fly-in/ticker/alarm animations live in `ChessState` fields (render-only); the ONLY hook point is `_commit` (already the juice hub) and it only APPENDS to `this.flyIns`.
- Layout constants live in `config.js PANEL` — the painter reads them conceptually (same numbers, documented in the painter docstring); if a position moves, both change together.

---

### Task 1: Plumbing — `ui` asset group, `PANEL` config, chess-preview harness

**Files:**
- Modify: `src/gfx.js` (registry), `src/assets.js` (loader), `assets/sprites/manifest.json` (`"ui": {}`), `src/config.js` (PANEL block)
- Create: `tools/chess-preview.html`

**Interfaces:**
- Produces: `registerUi(key, img)` / `uiSprite(key)` in gfx.js (mirrors `registerRing`/`ringSprite`); manifest group `"ui": { "chesspanel": "ui/chesspanel.png" }` (flat key→file, missing = fallback); `PANEL` config (exact block below); harness at `tools/chess-preview.html` with URL params `?bare=1` (skip assets), `?low=1` (8s player clock → low-time FX), `?check=1` (loads a check position).

- [ ] **Step 1: Registry + loader.** gfx.js (next to registerRing): `export function registerUi(key, img) { (SPRITES.ui ||= {})[key] = img; }` / `export function uiSprite(key) { return (SPRITES.ui || {})[key]; }`. assets.js: same pattern as the `ring` group over `manifest.ui`. Manifest gains `"ui": {}`.
- [ ] **Step 2: `PANEL` config** (config.js, after `LIGHT`):

```js
// Chess-half broadcast panel (states/chess.js _broadcastPanel). All layout Ys
// are SCREEN coordinates; the painted chrome (assets/sprites/ui/chesspanel.png,
// blitted at (X,0)) carves its recesses at these same positions.
export const PANEL = {
  X: 383, W: 129, PAD: 6,
  HEADER_Y: 8,
  OPP_PORTRAIT: [389, 36],   // 44x44 slot (x,y)
  OPP_PLAQUE: [437, 38],     // name/ELO text block
  CLOCK_OPP_Y: 88,
  TRAY_OPP_Y: 124,
  BADGE_Y: 150,
  TRAY_YOU_Y: 168,
  CLOCK_YOU_Y: 196,
  YOU_PORTRAIT: [389, 232],
  YOU_PLAQUE: [437, 234],
  TICKER_Y: 284,
  FUSE_Y: 332, FUSE_X0: 391, FUSE_X1: 480, BELL: [492, 338],
  STATUS_Y: 424,
  CLOCK: { H: 30, LOW_S: 10, PULSE_HZ: 2.2, GLOW: 0.22 },
  TRAY: { H: 22, ICON: 13, PITCH: 14, X0: 391 },
  HP: { OPP: [409, 74], YOU: [409, 270], W: 88 },   // glove-bar fill origin + width
  FLY_MS: 450,
  TICKER_SLIDE_MS: 220,
};
```

- [ ] **Step 3: Harness** `tools/chess-preview.html` — mock game + real ChessState:

```html
<!DOCTYPE html><html><head><meta charset="utf-8"><title>PAWNCH chess preview</title>
<style>body{background:#181828;margin:12px}canvas{image-rendering:pixelated;width:768px;height:672px;border:1px solid #3a4a78}</style>
</head><body><canvas id="cv" width="512" height="448"></canvas>
<script type="module">
import { loadAssets } from '../src/assets.js';
import { FX } from '../src/gfx.js';
import { input } from '../src/input.js';
import * as Chess from '../src/chess/board.js';
import { ChessState } from '../src/states/chess.js';
import { OPPONENTS } from '../src/opponents.js';

const params = new URLSearchParams(location.search);
if (!params.has('bare')) await loadAssets('../assets/sprites');

const chess = params.has('check')
  ? Chess.loadFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')
  : (() => {                                   // 1.e4 d5 2.exd5 Qxd5 — two captures
      let s = Chess.newGame();
      const pgn = [];
      for (const [from, to] of [[52, 36], [11, 27], [36, 27], [3, 27]]) {
        const mv = Chess.legalMoves(s).find((m) => m.from === from && m.to === to);
        pgn.push(Chess.moveLabel(s, mv));
        s = Chess.applyMove(s, mv);
      }
      window.__pgn = pgn;
      return s;
    })();

const match = {
  mode: 'story', opponent: OPPONENTS[4], playerColor: Chess.WHITE,
  chess, round: 3, hp: { player: 62, enemy: 78 },
  clocks: { w: params.has('low') ? 8000 : 174000, b: 231000 },
  pgnMoves: window.__pgn || [], fightTrack: 0, movedThisHalf: {},
};
const game = { W: 512, H: 448, match, save: {}, input, fx: new FX(),
  doFreeze() {}, resolveChess() {}, changeState() {}, netFlow() {} };
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const st = new ChessState();
st.enter(game);
let last = performance.now();
(function frame(now) {
  const dt = Math.min(50, now - last); last = now;
  st.update(game, dt);
  game.fx.update();
  ctx.fillStyle = '#070a16'; ctx.fillRect(0, 0, 512, 448);
  st.draw(game, ctx);
  game.fx.draw(ctx);
  requestAnimationFrame(frame);
})(last);
</script></body></html>
```

(If `FX.update/draw` signatures differ, match `game.js`'s usage — check before wiring. `OPPONENTS[4]` = mid-roster fighter with name/elo/hue.)

- [ ] **Step 4:** Verify: harness renders the CURRENT text panel + board mid-game (2 captures played, SAN history real). `?check=1` shows the check highlight. Suite green. Commit: `git add src/gfx.js src/assets.js assets/sprites/manifest.json src/config.js tools/chess-preview.html && git commit -m "feat(ui): ui asset group, PANEL config, chess-preview QA harness"`

---

### Task 2: Paint the chrome (`tools/paint_ui.py` → `assets/sprites/ui/chesspanel.png`)

**Art spec (129×448, opaque; brushed-steel broadcast column, local coords = screen − (383,0)):**
- Backdrop: vertical INK1 column with a 2px STEEL0 left edge seam (x0–1), rivets (STEEL1 dots every 28px down both edges), subtle brushed texture (INK2 horizontal n2 streaks ~8%); a brand stripe across the very top y0–5: left half EMBER4, right half BLUE3, 1px GOLD1 divider.
- Portrait wells at local (6,36) and (6,232), 46×46: INK0 recess with a 1px STEEL1 inner bevel + GOLD0 corner brackets (3px L-shapes) — V5's portraits land inside; V4 draws silhouettes.
- Plaque zones right of each well (local x54–124, y38–70 / y234–266): a WOOD1 nameplate bar (x54–124, 12 tall) with GOLD0 pinline; below it the **glove HP row**: an 8×8 painted boxing glove (RED2 with RED1 shade + SPEC1 shine dot) at local (54, 70) and (54, 266), and an empty bar channel (INK0 with STEEL1 frame) from x66 to x122, 8 tall.
- Clock plates at local (4, 88) and (4, 196), 121×30: STEEL0 plate with 1px STEEL2 top bevel, corner screws (STEEL3), and an INK0 screen window inset (local x10–110, 20 tall) with faint scanline rows (INK1 every 3rd row).
- Tray recesses at local (4, 124) and (4, 168), 121×22: WOOD1 felt tray with WOOD0 slot divider ticks every 14px and a 1px GOLD0 lip.
- Advantage badge plate centered local (40, 150), 48×16: GOLD0 rim, INK0 face.
- Ticker recess local (4, 284), 121×42: INK0 glass with a STEEL1 frame and three faint row separators (INK1).
- Fuse channel local (8, 332): a WOOD3 rope-track groove from x8 to x97 (14 tall, INK0 channel with the rope painted as WOOD3/WOOD4 twist ticks), ending at a painted **bronze bell** at local (109, 338): GOLD1 dome (r7) with GOLD0 rim, INK0 clapper, mounted on a STEEL1 bracket.
- Status zone y420–448: plain column (code text).

- [ ] **Step 1:** `tools/paint_ui.py` (pawnch_palette import, PIECES = {'chesspanel': …}, OUT_DIR `assets/sprites/ui`) + paint + Read QA at 2× (opaque). Manifest: `"ui": { "chesspanel": "ui/chesspanel.png" }`. Aseprite master `assets/aseprite/ui-chesspanel.aseprite`.
- [ ] **Step 2:** Commit: `git add tools/paint_ui.py assets/sprites/ui assets/aseprite/ui-chesspanel.aseprite assets/sprites/manifest.json && git commit -m "feat(art): chess broadcast panel chrome — plates, trays, fuse track, bell"`

---

### Task 3: Broadcast core — chrome, clocks, portraits, status (with fallback)

**Files:**
- Modify: `src/states/chess.js`

**Interfaces:**
- Consumes: `uiSprite('chesspanel')`, `PANEL`, `additiveGlow` (import from lighting.js), existing `text/panel/drawPiece`.
- Produces: `_broadcastPanel(game, ctx)` dispatched from the existing `_sidePanel` call site: `this._sidePanel` body becomes `if (uiSprite('chesspanel')) return this._broadcastPanel(game, ctx); …legacy body unchanged…`. Also `_plateClock(ctx, y, label, ms, active, col)` and `_portraitSlot(ctx, x, y, side)` used by Tasks 4–5.

- [ ] **Step 1: Dispatch + header.** `_broadcastPanel`: blit chrome at `(PANEL.X, 0)`; header: `text 'PAWNCH'` scale 2 orange at (PANEL.X+PAD, PANEL.HEADER_Y), `ROUND m.round/TOTAL` + `CHESS HALF` scale 1 below, right-aligned era: keep left. Nameplates: opponent name + `CHESS <elo>` in the plaque zone (story mode; pvp shows 'OPPONENT'); 'YOU' in the lower plaque.
- [ ] **Step 2: Clock plates.** `_plateClock(ctx, y, label, ms, active, col)`: digits `m:ss` via `text(..., { scale: 3, color })` centered in the screen window; behind them `additiveGlow(cx, cy, 26, col, PANEL.CLOCK.GLOW * (active ? 1 : 0.4))`; label scale 1 above-left. LOW time (`s < PANEL.CLOCK.LOW_S`): digits red, plate pulses (`ctx.translate` scale `1 + 0.03*sin(t*2π*PULSE_HZ)` about plate center), 1px x-shake, and two steam puffs (`additiveGlow` drifting up from the plate corners, phase-cycled). Active side's plate also gets a 1px `col` frame stroke.
- [ ] **Step 3: Portrait placeholders.** `_portraitSlot(ctx, x, y, side)`: dark slot assumed painted; draw a bust silhouette (head circle r8 at center-top + shoulders trapezoid) in `mix(hue.body, '#000', .55)` for the opponent (this.oppHue) / `PAL.blueDark`-ish for YOU; a thin accent frame stroke in the side color. (V5 replaces the bust with real portraits — keep this function the single draw point.)
- [ ] **Step 4: Status.** Bottom: THINKING…/YOUR MOVE (existing logic) at `PANEL.STATUS_Y`.
- [ ] **Step 5:** Harness QA (populated panel + `?bare=1` = legacy text panel identical) + suite + commit: `git add src/states/chess.js && git commit -m "feat(chess): broadcast panel core — chrome, glowing clock plates, portrait slots"`

---

### Task 4: Captured-piece trays, advantage badge, capture fly-in

**Files:**
- Modify: `src/states/chess.js`

**Interfaces:**
- Produces: module-level `capturedBy(board)` → `{ byPlayerColorW: […], … }` — concretely: `captured(board)` returns `{ w: ['q','p',…], b: […] }` where `w` = black pieces white has taken (lowercase types, value-sorted desc). Fly-in state `this.flyIns = [{ pc, x, y, tx, ty, t }]`.

- [ ] **Step 1: Derivation** (pure, top of chess.js):

```js
// Captured pieces DERIVED from the board each frame (no model state): what's
// missing vs the starting set. Returns value-sorted lowercase type lists:
// w = black pieces White has taken, b = white pieces Black has taken.
const START_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const VAL = { q: 9, r: 5, b: 3, n: 3, p: 1 };
function captured(board) {
  const alive = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const pc of board) {
    if (!pc) continue;
    const t = pc.toLowerCase();
    if (t === 'k') continue;
    alive[pc === pc.toUpperCase() ? 'w' : 'b'][t]++;
  }
  const out = { w: [], b: [] };
  for (const t of ['q', 'r', 'b', 'n', 'p']) {
    for (let i = 0; i < START_COUNTS[t] - alive.b[t]; i++) out.w.push(t);  // missing black = taken by white
    for (let i = 0; i < START_COUNTS[t] - alive.w[t]; i++) out.b.push(t);
  }
  return out;
}
```

(Note: promotions can make counts negative — clamp with `Math.max(0, …)` on each push count.)

- [ ] **Step 2: Trays.** In `_broadcastPanel`: `const cap = captured(m.chess.board);` — the OPPONENT'S tray shows what the opponent has taken (= your pieces) and vice versa, mapped through `m.playerColor`. Icons: `drawPiece(ctx, type-cased, x, y, PANEL.TRAY.ICON, isWhitePiece, { clean: true, shadow: false })` along the tray at `TRAY.X0 + i * TRAY.PITCH` (two rows if > 8: second row offset +? — tray is 22 tall; cap at 8 icons + `+N` overflow text).
- [ ] **Step 3: Badge.** Existing `Chess.material` diff → text `+N` scale 2 (green if player ahead, red behind, 'EVEN' dim scale 1) centered on the badge plate at `PANEL.BADGE_Y`.
- [ ] **Step 4: Fly-in.** `enter()`: `this.flyIns = [];`. In `_commit`, inside the capture branch: capture victim = `this.preState.board[a.mv.to]` (for `ep`: the pawn is `this.preState.turn === 'w' ? 'p' : 'P'`); push `{ pc, x: tx, y: ty, tx: PANEL.TRAY.X0 + 40, ty: (victim belongs to player ? PANEL.TRAY_OPP_Y : PANEL.TRAY_YOU_Y) + 10, t: 0 }`. In `update()`: advance `f.t += dt`, on `t >= PANEL.FLY_MS`: remove, `audio.sfx.select()` click + `game.fx.spark(f.tx, f.ty, PAL.gold, 6)`. In `draw()` (after `_sidePanel`): each flyIn draws `drawPiece` at eased position (`e = 1 - (1-k)^3`), size lerping `SQ-6 → TRAY.ICON`, slight arc (`-sin(kπ)*14`).
- [ ] **Step 5:** Harness QA: the mocked `exd5/Qxd5` game shows a pawn in Black's tray + a pawn in White's; play a live capture in the harness (mouse works!) to see the fly-in. Suite + commit: `git add src/states/chess.js && git commit -m "feat(chess): captured-piece trays, advantage badge, capture fly-in"`

---

### Task 5: Fuse timer, move ticker, check alarm + vignette, winner spotlight, HP gloves

**Files:**
- Modify: `src/states/chess.js`

- [ ] **Step 1: Fuse.** Progress `k = 1 - halfTime / totalHalfMs` (capture `this.halfTotal = this.halfTime` at enter). Burnt track: overlay `rgba(7,10,22,0.55)` from FUSE_X0 to `fx = lerp(FUSE_X0, FUSE_X1, k)`; flame tip via `flame(fx, FUSE_Y+6, 3, …)` (import from… `flame` is scenery-local — inline a mini 2-gradient flame or reuse `additiveGlow` + 2 rects; use additiveGlow(gold, 0.5) + a 2×3 EMBER core rect). Sparks (`game.fx.parts` pushes) when `halfTime < 10000`; when expired the bell gets a gold `additiveGlow` flash (`sin(t*20)` gated).
- [ ] **Step 2: Ticker.** Track `this.tickerLen = m.pgnMoves?.length || 0` at enter; in draw, if length grew, set `this.tickerSlide = PANEL.TICKER_SLIDE_MS` (decay in update). Render last 3 SAN strings bottom-up in the recess: newest at top row sliding in from the right by `slide` fraction (alpha ramp), older rows dimmer (`PAL.text` → `PAL.textDim` → 40%). Prefix a piece glyph: `drawPiece(ctx, san[0] matches [NBRQK] ? letter : 'P', …, 10, moverIsWhite, {clean:true})` — mover alternates from `m.chess.fullmove/turn` (row index parity vs current turn).
- [ ] **Step 3: Check alarm + vignette.** When `Chess.inCheck(m.chess)`: the CHECKED side is `m.chess.turn`; its portrait slot gets a red pulsing 2px frame (`0.5+0.5*sin(t*10)`); the BOARD gets a screen-edge vignette: four edge-gradient strips (each 26px deep, `rgba(255,59,83, 0.10 + 0.06*sin(t*8))` fading inward) drawn in `draw()` right after the board restore, gated to the board region.
- [ ] **Step 4: Winner spotlight.** In phase `'ended'` with `m.lastChessResult?.winner`: `additiveGlow` (28px, gold, 0.35) pulsing over the winner's portrait slot + a 1px gold frame.
- [ ] **Step 5: HP gloves.** Fill the painted bar channels: `PANEL.HP.OPP/YOU` origin + `W` width, fill `w * hp/100` in orange/blue (2px inner margin), matching the painted glove icons.
- [ ] **Step 6:** Harness QA (`?low=1` → heartbeat clock + steam; `?check=1` → alarm + vignette; fuse burns as halfTime drains; ticker slides on a live move) + suite + commit: `git add src/states/chess.js && git commit -m "feat(chess): fuse timer, move ticker, check alarm, winner spotlight, HP gloves"`

---

### Task 6: Sweep + docs + checkpoint

- [ ] Suite green; zero-asset boot (legacy text panel identical — screenshot compare via harness `?bare=1`); full boot console clean (~219 sprites); live-game spot check headless (title boot).
- [ ] Gallery: harness shots (normal / low / check) → send to user.
- [ ] Spec V4 row → DONE; CLAUDE.md tour touch (broadcast panel + chess-preview harness); memory (next = V5 portraits, harness ready). Commit → merge main (ff-only) → suite → push → delete branch.
