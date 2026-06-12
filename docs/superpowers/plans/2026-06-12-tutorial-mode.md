# PAWNCH Tutorial Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TUTORIAL main-menu option that opens a two-tile select screen (CHESS / FIGHT), each launching a short, beginner-focused, freeze-frame-guided tutorial for that half.

**Architecture:** Three new self-contained states (`tutorial`, `tutorialChess`, `tutorialBox`) plus a shared `TeachSequence` freeze-frame component and a procedural `glove()` gfx helper. They reuse existing primitives (the `Chess` board module, `piece()` art, the real `BoxingMatch` sim) but never touch `game.js`'s match/resolve/round logic or the live `ChessState`/`BoxingState`. Spec: `docs/superpowers/specs/2026-06-12-tutorial-mode-design.md`.

**Tech Stack:** Vanilla ES modules, no build step, no dependencies. Canvas 2D rendering through `src/gfx.js`. **No automated test suite exists** — verification is by running the game (`npm run dev`) and exercising the change, watching the console for `[PAWNCH] frame error:`. Two debug handles are exposed: `window.PAWNCH` (live `Game`) and `window.CHESS`.

**Conventions (Golden Rules):** no deps/build; tune via `config.js`; colors from `PAL`; draw via `gfx.js` with `imageSmoothingEnabled` off; match logic stays in `game.js`; the boxing anti-mash parry rules stay intact; small focused self-contained modules.

**Dev server note:** `node` is provided via `fnm` in this environment. If `npm run dev` can't find node, prefix PATH: `export PATH="$HOME/.fnm/node-versions/v24.16.0/installation/bin:$PATH"`. `npm run dev` serves at http://localhost:5173 — **click or press a key once** (browser autoplay) before audio plays.

---

## File Structure

**Create:**
- `src/teach.js` — `TeachSequence`: a queue of freeze-frame teaching windows; while one is active the owning state freezes its sim and only Enter advances. Used by both tutorials.
- `src/states/tutorial.js` — `TutorialState`: the two-tile select screen.
- `src/states/tutorialchess.js` — `TutorialChessState`: the guided scripted opening.
- `src/states/tutorialbox.js` — `TutorialBoxState`: the staged boxing lessons.

**Modify:**
- `src/config.js` — add glove palette colors to `PAL`; add a `TUTORIAL` block.
- `src/gfx.js` — add the `glove()` helper (procedural, sprite-overridable).
- `src/boxing.js` — add one additive optional `onBlock(side)` hook.
- `src/game.js` — register the three new states in the `STATES` map.
- `src/states/title.js` — add the `TUTORIAL` menu item.
- `assets/sprites/manifest.example.json` — document the optional `boxers.glove` key.

**Task order** (each leaves the game runnable; states are verified via `window.PAWNCH.changeState(...)` before the menu is wired):
1. Config foundation → 2. `glove()` → 3. `TeachSequence` → 4. Chess tutorial → 5. `onBlock` hook → 6. Boxing tutorial → 7. Tile screen → 8. Menu wiring.

---

### Task 1: Config foundation (palette + TUTORIAL block)

**Files:**
- Modify: `src/config.js` (PAL block, and append a `TUTORIAL` export)

- [ ] **Step 1: Add glove colors to `PAL`**

In `src/config.js`, inside `export const PAL = { ... }`, find the `red:` line in the brand/neutrals area:

```js
  red:        '#ff3b53',
```

Add these four lines immediately after it (procedural-glove palette; Golden Rule 3 — no hardcoded hex in draw code):

```js
  red:        '#ff3b53',
  // procedural boxing-glove placeholder (tutorial FIGHT tile)
  gloveShade: '#a01020',   // right-side shadow on the red glove
  gloveHi:    '#ff9a9a',   // upper-left highlight
  gloveCuff:  '#ffd9c8',   // wrist cuff band
  gloveInner: '#2a0a0e',   // the dark inside of the cuff opening
```

- [ ] **Step 2: Append the `TUTORIAL` config block**

At the END of `src/config.js`, add:

```js
// ---- Tutorial mode -----------------------------------------------------
// A harmless sparring dummy for the boxing tutorial — easier than Patty
// (d=0.05) by construction: very long telegraphs/recovery (huge openings),
// tiny damage, never parries, no signature/special. PRACTICE_AGGRESSION is
// dialed up only during the read-and-react lessons so it reliably feeds a
// readable punch to block / dodge / parry.
export const TUTORIAL = {
  DUMMY: {
    telegraphMs: 1000, recoverMs: 900, aggression: 0.30, comboChance: 0,
    dodgeSkill: 0.05, guardChance: 0.15, punchDmg: 4, feintChance: 0,
    highChance: 0.5, parrySkill: 0,
    signature: { name: 'WIND-UP', dmg: 6, telegraphMs: 1300, chance: 0 },
    special: null,
  },
  PRACTICE_AGGRESSION: 0.9,
};
```

- [ ] **Step 3: Verify it loads**

Run: `npm run dev`, open http://localhost:5173, open the browser console.
Type: `PAWNCH` and press Enter.
Expected: the `Game` object prints, no `[PAWNCH] frame error:` in the console (a syntax error in config would break the whole module graph and leave a blank page).

- [ ] **Step 4: Commit**

```bash
git add src/config.js
git commit -m "feat(tutorial): add glove palette + TUTORIAL config block"
```

---

### Task 2: Procedural `glove()` gfx helper

**Files:**
- Modify: `src/gfx.js` (add `glove()` after the `withA()` helper, ~line 476)
- Modify: `assets/sprites/manifest.example.json` (document the optional key)

- [ ] **Step 1: Add the `glove()` helper**

In `src/gfx.js`, find the `withA` export (around line 476):

```js
export function withA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
```

Immediately AFTER it, add:

```js
// 16-bit red boxing glove pointing UP, with the cuff opening (the inside)
// visible at the bottom. Procedural placeholder for the tutorial FIGHT tile; a
// registered sprite (assets manifest: boxers.glove) overrides it. Colors from PAL.
const GLOVE = [
  '......RRRR......',
  '....RRRRRRRR....',
  '...RRRRRRRRRR...',
  '...RRRRRRRRRR...',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRRTT',
  '..RRRRRRRRRRRTTT',
  '..RRRRRRRRRRRTTT',
  '..RRRRRRRRRRRRTT',
  '..RRRRRRRRRRRR..',
  '...RRRRRRRRRR...',
  '...RRRRRRRRRR...',
  '...WWWWWWWWWW...',
  '...WKKKKKKKKW...',
  '...WKKKKKKKKW...',
  '...WWWWWWWWWW...',
  '....WWWWWWWW....',
];
export function glove(ctx, cx, cy, size, { glow = 1 } = {}) {
  const img = SPRITES.boxers.glove;                 // future sprite wins
  if (img) {
    const h = size, w = h * (img.width / img.height);
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
    return;
  }
  const rows = GLOVE, ROWS = rows.length, COLS = rows[0].length;
  const s = Math.max(1, Math.round(size / ROWS));
  const w = COLS * s, h = ROWS * s;
  const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
  if (glow > 0) {                                   // warm halo
    const rad = size * 0.5;
    const gr = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
    gr.addColorStop(0, withA(PAL.red, 0.32 * glow)); gr.addColorStop(1, withA(PAL.red, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
  }
  const colOf = (ch, r, c) => {
    if (ch === 'W') return PAL.gloveCuff;
    if (ch === 'K') return PAL.gloveInner;
    if (c >= COLS - 4 && r < 13) return PAL.gloveShade;   // right-side shadow
    if (c < 4 && r < 6) return PAL.gloveHi;               // upper-left highlight
    return PAL.red;
  };
  // 1px ink outline
  ctx.fillStyle = PAL.ink;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (rows[r][c] !== '.') ctx.fillRect(x + c * s - 1, y + r * s - 1, s + 2, s + 2);
  // body
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = rows[r][c]; if (ch === '.') continue;
    ctx.fillStyle = colOf(ch, r, c);
    ctx.fillRect(x + c * s, y + r * s, s, s);
  }
}
```

- [ ] **Step 2: Document the optional sprite key**

In `assets/sprites/manifest.example.json`, in the `"boxers"` object, add a `"glove"` entry after `"back:idle"`:

```json
  "boxers": {
    "front:idle": "boxer_front_idle.png",
    "front:guard": "boxer_front_guard.png",
    "front:punchL": "boxer_front_punchL.png",
    "front:punchR": "boxer_front_punchR.png",
    "back:idle": "boxer_back_idle.png",
    "glove": "glove.png"
  },
```

- [ ] **Step 3: Verify the procedural glove draws**

Run: `npm run dev`, open the page, open the console. Paste this one-off draw onto the live canvas:

```js
glovetest = () => { const g = PAWNCH; const ctx = g.ctx; import('./src/gfx.js').then(m => m.glove(ctx, 256, 224, 160, {glow:1})); };
glovetest();
```

Expected: a chunky red boxing glove (thumb on the right, dark cuff opening at the bottom) renders on the canvas for one frame (the game loop will paint over it next frame — that's fine; we're confirming it draws without error). No console error.

- [ ] **Step 4: Commit**

```bash
git add src/gfx.js assets/sprites/manifest.example.json
git commit -m "feat(tutorial): add procedural glove() gfx helper (sprite-overridable)"
```

---

### Task 3: `TeachSequence` shared freeze-frame component

**Files:**
- Create: `src/teach.js`

- [ ] **Step 1: Create `src/teach.js`**

```js
// Shared "freeze time → show a window → press Enter to continue" teaching
// component used by both tutorial halves. While a step is active the owning
// state freezes its sim (checks `active`) and only ENTER (the `confirm` action)
// advances. Pure UI + a tiny queue — no gameplay logic of its own.

import { PAL } from './config.js';
import { panel, text } from './gfx.js';
import * as audio from './audio.js';

export class TeachSequence {
  constructor() {
    this.steps = [];   // queued { title, lines: string[], onShow?: () => void }
    this.cur = null;   // the window currently showing (or null)
    this.t = 0;        // drives the blinking prompt
  }

  // enqueue one or more teaching windows; shows the first immediately if idle.
  queue(steps) { for (const s of steps) this.steps.push(s); this._advance(); }

  get active() { return !!this.cur; }

  _advance() {
    if (this.cur) return;                 // a window is already showing
    this.cur = this.steps.shift() || null;
    if (this.cur && this.cur.onShow) this.cur.onShow();
  }

  // Call every frame while `active`. Returns true the frame the LAST queued
  // window is dismissed (i.e., the queue just emptied).
  update(game, dt) {
    this.t += dt / 1000;
    if (!this.cur) return false;
    if (game.input.pressed('confirm')) {
      audio.sfx.confirm();
      this.cur = null;
      this._advance();
      if (!this.cur) return true;
    }
    return false;
  }

  draw(game, ctx) {
    if (!this.cur) return;
    const W = game.W, H = game.H;
    ctx.fillStyle = 'rgba(7,10,22,0.62)'; ctx.fillRect(0, 0, W, H);   // dim the frozen scene
    const lines = this.cur.lines || [];
    const pw = 384, lh = 16;
    const ph = 44 + lines.length * lh + 22;
    const px = Math.round(W / 2 - pw / 2), py = Math.round(H / 2 - ph / 2);
    panel(ctx, px, py, pw, ph, { fill: PAL.panel, border: PAL.orange, border2: PAL.orangeDark, glow: true });
    text(ctx, this.cur.title, W / 2, py + 12, { scale: 2, color: PAL.gold, align: 'center', shadow: PAL.ink });
    let ly = py + 40;
    for (const ln of lines) { text(ctx, ln, W / 2, ly, { scale: 1, color: PAL.text, align: 'center' }); ly += lh; }
    if (Math.sin(this.t * 6) > -0.2) text(ctx, 'PRESS ENTER >', W / 2, py + ph - 16, { scale: 1, color: PAL.blueLite, align: 'center' });
  }
}
```

- [ ] **Step 2: Verify it imports cleanly**

Run: `npm run dev`, open the console.
Type: `import('./src/teach.js').then(m => console.log(typeof m.TeachSequence))`
Expected: prints `function`. No console error.

- [ ] **Step 3: Commit**

```bash
git add src/teach.js
git commit -m "feat(tutorial): add shared TeachSequence freeze-frame component"
```

---

### Task 4: `TutorialChessState` (guided opening) + register

**Files:**
- Create: `src/states/tutorialchess.js`
- Modify: `src/game.js` (import + STATES entry)

The scripted line (player = White, board index 0 = a8 … 63 = h1). Verified legal and sound; ends with the player +1 pawn after `7.Bxb5`:

`1.e4 e5  2.Nf3 Nc6  3.Bc4 Bc5  4.O-O Nf6  5.Re1 d6  6.Qe2 b5??  7.Bxb5`

Index map used below: e2=52,e4=36, g1=62,f3=45, f1=61,c4=34, e1=60(castleK to g1=62), f1=61→e1=60, d1=59→e2=52, c4=34→b5=25. Opponent: e7=12→e5=28, b8=1→c6=18, f8=5→c5=26, g8=6→f6=21, d7=11→d6=19, b7=9→b5=25.

- [ ] **Step 1: Create `src/states/tutorialchess.js`**

```js
// Guided chess tutorial: a fixed opening where the player drives every piece
// type once, the opponent plays slightly weak, a capture nets a clean pawn, and
// each piece type is taught by a freeze-frame on first use. Self-contained — its
// own Chess game, no clocks/HP/rounds/resolve (those live in game.js for real
// matches). Looks like the real half (same board geometry + piece() art).

import { PAL } from '../config.js';
import { text, panel, piece as drawPiece } from '../gfx.js';
import * as audio from '../audio.js';
import * as Chess from '../chess/board.js';
import { TeachSequence } from '../teach.js';

const SQ = 44, OX = 17, OY = 40, BOARD_PX = SQ * 8;   // identical to the real chess half

// scripted line: each entry is the required player move (from->to) with the
// freeze-frame shown on its first use, then the opponent's auto-reply (or null).
const LINE = [
  { from: 52, to: 36, teach: { title: 'PAWNS', lines: ['Pawns march forward one square', '(two on their very first move).', 'They CAPTURE one square diagonally.', 'Push your pawn to the lit square.'] }, reply: { from: 12, to: 28 } },
  { from: 62, to: 45, teach: { title: 'KNIGHTS', lines: ['Knights move in an L: two then one —', 'and they JUMP over anything between.', 'The only piece that can.', 'Develop your knight.'] }, reply: { from: 1, to: 18 } },
  { from: 61, to: 34, teach: { title: 'BISHOPS', lines: ['Bishops glide along diagonals,', 'as far as the path is clear.', 'Aim yours at the center.'] }, reply: { from: 5, to: 26 } },
  { from: 60, to: 62, teach: { title: 'THE KING / CASTLING', lines: ['The king steps ONE square any direction.', 'Castling is its special move: the king', 'slides two toward the rook and the rook', 'hops to its other side — king tucked safe.'] }, reply: { from: 6, to: 21 } },
  { from: 61, to: 60, teach: { title: 'ROOKS', lines: ['Rooks slide in straight lines —', 'along ranks and files.', 'Swing your rook to the open file.'] }, reply: { from: 11, to: 19 } },
  { from: 59, to: 52, teach: { title: 'THE QUEEN', lines: ['The strongest piece: she moves like a', 'rook AND a bishop — any distance, straight', 'or diagonal. Bring her into play.'] }, reply: { from: 9, to: 25 } },
  { from: 34, to: 25, teach: { title: 'CAPTURING', lines: ['Land on an enemy piece to capture it.', 'Your opponent just blundered a pawn —', 'take it and go a pawn ahead!'] }, reply: null },
];

const OUTRO = { title: 'THAT IS A WINNING HALF', lines: ['You are up a pawn with a strong position.', 'In a real match, CHECKMATE or running your', "opponent's clock to zero wins the chess half", 'instantly. Press Enter to finish.'] };

export class TutorialChessState {
  enter(game) {
    this.chess = Chess.newGame();
    this.idx = 0;
    this.cursor = 52;
    this.selected = -1;
    this.anim = null;            // { mv, piece, t, dur, white }
    this.t = 0;
    this.hintT = 0;
    this.phase = 'teach';        // teach | play | anim | reply | done
    this.outroShown = false;
    this.teach = new TeachSequence();
    audio.playFightTheme(0);
    this._beginStep();
  }

  _beginStep() {
    const step = LINE[this.idx];
    if (!step) { this._finish(); return; }
    if (step.teach) { this.teach.queue([step.teach]); this.phase = 'teach'; }
    else this.phase = 'play';
  }

  _finish() {
    if (this.outroShown) return;
    this.outroShown = true;
    this.phase = 'done';
    this.teach.queue([OUTRO]);
  }

  update(game, dt) {
    this.t += dt / 1000;
    if (this.hintT > 0) this.hintT -= dt;
    audio.playFightTheme(0);

    if (game.input.pressed('cancel')) { audio.sfx.select(); game.changeState('tutorial'); return; }

    if (this.teach.active) {                       // a window owns the screen — FREEZE
      const finished = this.teach.update(game, dt);
      if (finished && this.phase === 'done') { game.changeState('tutorial'); return; }
      if (finished && this.phase === 'teach') this.phase = 'play';
      return;
    }

    if (this.phase === 'anim' || this.phase === 'reply') { this._tickAnim(game, dt); return; }
    if (this.phase === 'play') this._playerInput(game);
  }

  _playerInput(game) {
    const i = game.input;
    let [r, c] = Chess.rc(this.cursor);
    if (i.pressed('up') && r > 0) { r--; audio.sfx.select(); }
    if (i.pressed('down') && r < 7) { r++; audio.sfx.select(); }
    if (i.pressed('left') && c > 0) { c--; audio.sfx.select(); }
    if (i.pressed('right') && c < 7) { c++; audio.sfx.select(); }
    this.cursor = r * 8 + c;
    const msq = this._squareAt(i.mouse.x, i.mouse.y);
    if (i.mPressed && msq >= 0) { this.cursor = msq; this._tryPick(game, msq); }
    if (i.pressed('confirm')) this._tryPick(game, this.cursor);
  }

  // accept ONLY the scripted move; gently reject anything else.
  _tryPick(game, sq) {
    const step = LINE[this.idx];
    if (this.selected === step.from && sq === step.to) { this._playerMove(game, step); return; }
    if (sq === step.from) { this.selected = step.from; audio.sfx.confirm(); return; }
    this.selected = -1; this.hintT = 1400; audio.sfx.select();
  }

  _playerMove(game, step) {
    const mv = this._findMove(step.from, step.to);
    if (!mv) return;
    this.selected = -1;
    this._startAnim(game, mv, 'anim');
  }

  _startAnim(game, mv, nextPhase) {
    const piece = this.chess.board[mv.from];
    this.anim = { mv, piece, t: 0, dur: 240, white: Chess.colorOf(piece) === Chess.WHITE };
    this.phase = nextPhase;
    const [sx, sy] = this._sqCenter(mv.from);
    game.fx.spark(sx, sy, this.anim.white ? PAL.blueLite : PAL.orangeLite, 5);
    audio.sfx.move();
  }

  _tickAnim(game, dt) {
    const a = this.anim; a.t += dt;
    if (a.t < a.dur) return;
    const cap = a.mv.flag === 'capture' || a.mv.flag === 'ep';
    const [tx, ty] = this._sqCenter(a.mv.to);
    if (cap) { game.fx.burst(tx, ty, PAL.orange, 14, 3); game.fx.ring(tx, ty, PAL.gold); game.fx.doShake(6); audio.sfx.capture(); }
    this.chess = Chess.applyMove(this.chess, a.mv);
    this.anim = null;
    if (this.phase === 'anim') {
      const step = LINE[this.idx];
      if (step.reply) { const rmv = this._findMove(step.reply.from, step.reply.to); this._startAnim(game, rmv, 'reply'); }
      else { this.idx++; this._beginStep(); }
    } else {                                        // 'reply' done
      this.idx++; this._beginStep();
    }
  }

  _findMove(from, to) { return Chess.legalMoves(this.chess).find((m) => m.from === from && m.to === to) || null; }

  // geometry — tutorial is always white-at-bottom (no flip)
  _sqXY(i) { const [r, c] = Chess.rc(i); return [OX + c * SQ, OY + r * SQ]; }
  _sqCenter(i) { const [x, y] = this._sqXY(i); return [x + SQ / 2, y + SQ / 2]; }
  _squareAt(x, y) {
    if (x < OX || x >= OX + BOARD_PX || y < OY || y >= OY + BOARD_PX) return -1;
    return Math.floor((y - OY) / SQ) * 8 + Math.floor((x - OX) / SQ);
  }
  _animPos(p) {
    const a = this.anim, [sx, sy] = this._sqCenter(a.mv.from), [tx, ty] = this._sqCenter(a.mv.to);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const hop = Math.sin(p * Math.PI) * 8;
    return [sx + (tx - sx) * e, sy + (ty - sy) * e - hop];
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    panel(ctx, OX - 8, OY - 8, BOARD_PX + 16, BOARD_PX + 16, { fill: PAL.boardEdge, border: PAL.orange, border2: PAL.orangeDark });
    for (let i = 0; i < 64; i++) {
      const [r, c] = Chess.rc(i), [x, y] = this._sqXY(i);
      ctx.fillStyle = (r + c) % 2 ? PAL.boardDark : PAL.boardLight;
      ctx.fillRect(x, y, SQ, SQ);
    }
    // highlight the required move
    if (this.phase === 'play') {
      const step = LINE[this.idx];
      if (step) {
        const [fx, fy] = this._sqXY(step.from);
        ctx.fillStyle = `rgba(43,108,255,${0.3 + 0.2 * Math.sin(this.t * 8)})`;
        ctx.fillRect(fx, fy, SQ, SQ);
        const [hx, hy] = this._sqCenter(step.to);
        const cap = !!this.chess.board[step.to];
        ctx.fillStyle = cap ? 'rgba(255,59,83,0.85)' : 'rgba(57,217,138,0.85)';
        ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (this.selected >= 0) { const [sx, sy] = this._sqXY(this.selected); ctx.fillStyle = 'rgba(43,108,255,0.45)'; ctx.fillRect(sx, sy, SQ, SQ); }
    // pieces (skip the one currently animating)
    const animFrom = this.anim ? this.anim.mv.from : -1;
    for (let i = 0; i < 64; i++) {
      if (i === animFrom) continue;
      const pc = this.chess.board[i];
      if (!pc) continue;
      const [cx, cy] = this._sqCenter(i);
      drawPiece(ctx, pc, cx, cy, SQ - 6, Chess.colorOf(pc) === Chess.WHITE, { t: this.t, phase: i * 0.7, glow: i === this.selected ? 1.8 : 1 });
    }
    if (this.anim) {
      const p = Math.min(1, this.anim.t / this.anim.dur);
      const [ax, ay] = this._animPos(p);
      drawPiece(ctx, this.anim.piece, ax, ay, SQ - 6, this.anim.white, { t: this.t, glow: 1.4 });
    }
    if (this.phase === 'play') {
      const [cx, cy] = this._sqXY(this.cursor);
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 8);
      ctx.strokeStyle = `rgba(255,210,74,${pulse})`; ctx.lineWidth = 2; ctx.strokeRect(cx + 1, cy + 1, SQ - 2, SQ - 2);
    }
    this._sidePanel(game, ctx);
    if (this.hintT > 0) {
      ctx.globalAlpha = Math.min(1, this.hintT / 400);
      text(ctx, 'MAKE THE HIGHLIGHTED MOVE', OX + BOARD_PX / 2, OY + BOARD_PX + 14, { scale: 1, color: PAL.gold, align: 'center', shadow: PAL.ink });
      ctx.globalAlpha = 1;
    }
    this.teach.draw(game, ctx);
  }

  _sidePanel(game, ctx) {
    const px = OX + BOARD_PX + 14;
    text(ctx, 'TUTORIAL', px, 12, { scale: 2, color: PAL.orange, shadow: PAL.ink });
    text(ctx, 'LEARN CHESS', px, 32, { scale: 1, color: PAL.blueLite });
    text(ctx, 'MOVE ' + Math.min(this.idx + 1, LINE.length) + '/' + LINE.length, px, 50, { scale: 1, color: PAL.textDim });
    text(ctx, 'ESC: BACK', px, game.H - 20, { scale: 1, color: PAL.textDim });
  }
}
```

- [ ] **Step 2: Register the state in `src/game.js`**

In `src/game.js`, after the existing state imports (after the `PauseOverlay` import, ~line 29), add:

```js
import { TutorialChessState } from './states/tutorialchess.js';
```

In the `STATES` map, add an entry (after `matchend:`):

```js
  matchend: MatchEndState,
  tutorialChess: TutorialChessState,
```

- [ ] **Step 3: Verify the chess tutorial end-to-end**

Run: `npm run dev`, open the page, press a key once (audio). In the console:
`PAWNCH.changeState('tutorialChess')`
Expected:
- A board identical in look to the real chess half appears, with a freeze-frame **PAWNS** window.
- Enter dismisses it; the e2 square pulses blue and e4 shows a green dot.
- Make the move (click the e2 pawn then e4, or cursor + Enter). The opponent replies automatically.
- Each subsequent piece type shows its window once; trying a non-highlighted move shows "MAKE THE HIGHLIGHTED MOVE" and does not advance.
- The line ends at **Bxb5** (a capture with fx), then a final window; Enter returns to a (not-yet-built) `tutorial` screen — for now it will error in console because `tutorial` isn't registered until Task 7. That's expected this task; press Esc instead to confirm Esc returns cleanly (it will also try `tutorial` — so until Task 7, verify the line/teaching only, and use `PAWNCH.changeState('title')` to leave).
- No `[PAWNCH] frame error:` during play.

- [ ] **Step 4: Commit**

```bash
git add src/states/tutorialchess.js src/game.js
git commit -m "feat(tutorial): add guided chess tutorial state"
```

---

### Task 5: Additive `onBlock` hook in the boxing sim

**Files:**
- Modify: `src/boxing.js` (`_strike` and `_playerContact`)

This is purely additive: real matches never pass `onBlock`, so behavior is unchanged. The anti-mash parry rules are untouched (Golden Rule 9).

- [ ] **Step 1: Fire `onBlock` in `_strike`**

In `src/boxing.js`, in `_strike`, find:

```js
    if (avoided === 'block') dmg *= (1 - BOX.BLOCK_REDUCTION);
    this._applyDamage(def, dmg, att);
    if (att.side === 'enemy') this._clearAtk(att);
    return false;
```

Replace the first line so the block fires the hook:

```js
    if (avoided === 'block') { dmg *= (1 - BOX.BLOCK_REDUCTION); this.hitHooks.onBlock?.(def.side); }
    this._applyDamage(def, dmg, att);
    if (att.side === 'enemy') this._clearAtk(att);
    return false;
```

- [ ] **Step 2: Fire `onBlock` in `_playerContact`**

In `src/boxing.js`, in `_playerContact`, find:

```js
    if (avoided === 'block') dmg *= (1 - BOX.BLOCK_REDUCTION);
    if (counter) { dmg *= 1.6; att.stars = Math.min(3, att.stars + 1); this.hitHooks.onCounter?.(att.side); }
```

Replace the first line:

```js
    if (avoided === 'block') { dmg *= (1 - BOX.BLOCK_REDUCTION); this.hitHooks.onBlock?.(def.side); }
    if (counter) { dmg *= 1.6; att.stars = Math.min(3, att.stars + 1); this.hitHooks.onCounter?.(att.side); }
```

- [ ] **Step 3: Verify a real fight still works**

Run: `npm run dev`. Start Story Mode → fight Patty. Block one of his punches by holding S.
Expected: blocking still reduces damage exactly as before; the fight plays normally; no console error. (We're confirming the additive hook didn't change real-match behavior.)

- [ ] **Step 4: Commit**

```bash
git add src/boxing.js
git commit -m "feat(tutorial): add additive onBlock hook to BoxingMatch"
```

---

### Task 6: `TutorialBoxState` (staged lessons) + register

**Files:**
- Create: `src/states/tutorialbox.js`
- Modify: `src/game.js` (import + STATES entry)

- [ ] **Step 1: Create `src/states/tutorialbox.js`**

```js
// Staged boxing tutorial: wraps the real BoxingMatch with a harmless dummy and
// teaches one skill at a time (jab -> hook -> block -> dodge -> parry -> free
// spar) via freeze-frame windows. Self-contained — no rounds/HP-carry/resolve.

import { PAL, BOX, TUTORIAL, FIGHTER } from '../config.js';
import { text, ring } from '../gfx.js';
import { drawFighter } from '../fighter.js';
import { drawScene, sceneFor } from '../scenery.js';
import * as audio from '../audio.js';
import { BoxingMatch } from '../boxing.js';
import { HERO_LOOK, DEFAULT_LOOK, HUE } from '../opponents.js';
import { TeachSequence } from '../teach.js';

const LESSONS = [
  { teach: { title: 'THE FIGHT', lines: ['Your opponent telegraphs every attack.', 'READ the tell, react, then punish.', 'This robot is a harmless sparring dummy.'] }, await: null, setup: null },
  { teach: { title: 'JAB', lines: ['Tap A or D for a quick jab to the body —', 'fast, low damage. Throw a jab now.'] }, await: 'jab', setup: null },
  { teach: { title: 'HOOK', lines: ['Tap Q or E for a hook to the head —', 'slower, but it hits much harder.', 'Throw a hook.'] }, await: 'hook', setup: null },
  { teach: { title: 'BLOCK', lines: ['Hold S to raise your guard — it chips', 'most of the damage. The robot will jab;', 'hold S to block it.'] }, await: 'block', setup: 'aggro' },
  { teach: { title: 'DODGE', lines: ['Tap Z / C to slip left or right, X to', 'duck a high shot. A dodge avoids ALL', 'damage. Slip the next punch.'] }, await: 'dodge', setup: 'aggro' },
  { teach: { title: 'THE PERFECT PARRY', lines: ['The key skill. RAISE guard (S) the instant', 'the punch lands — not early, not held.', 'Watch the glove flash + HIGH/LOW tell.', 'Parry a punch!'] }, await: 'parry', setup: 'aggro' },
  { teach: { title: "YOU'RE READY", lines: ['Spar freely — try a STAR punch (a hook', 'after a parry earns you a star).', 'Press ESC when you are done.'] }, await: null, setup: 'free' },
];

export class TutorialBoxState {
  enter(game) {
    this.game = game; this.t = 0; this.li = 0;
    this.flags = { jab: false, hook: false, block: false, dodge: false, parry: false };
    this.clearFx = 0;
    this.enemyLook = DEFAULT_LOOK; this.playerLook = HERO_LOOK;
    this.accent = HUE.green.body;
    this.sceneId = sceneFor({ mode: 'pvp' }, game.save);
    this.phase = 'teach';                 // teach | await | free
    this.teach = new TeachSequence();
    this.match = new BoxingMatch({
      mode: 'story',
      enemyParams: TUTORIAL.DUMMY,
      seconds: 99999,                     // no time pressure
      hooks: {
        onPunch: (side, kind) => { if (side === 'player') { if (kind === 'jab') this.flags.jab = true; else this.flags.hook = true; (kind === 'jab' ? audio.sfx.jab() : audio.sfx.hook()); } },
        onBlock: (side) => { if (side === 'player') this.flags.block = true; },
        onDodge: (side) => { if (side === 'player') { this.flags.dodge = true; audio.sfx.dodge(); } },
        onParry: (side) => { if (side === 'player') { this.flags.parry = true; audio.sfx.parry(); game.fx.doFlash(PAL.blueLite, 0.4); game.doFreeze(120); game.fx.burst(game.W / 2, game.H - 130, PAL.gold, 16, 3); } },
        onHit: (side, dmg) => { audio.sfx.hit(); const x = game.W / 2, y = side === 'player' ? game.H - 130 : 200; game.fx.burst(x, y, side === 'player' ? PAL.red : PAL.gold, 11, 3); game.doFreeze(28); },
      },
      onKO: () => {},                     // no stakes
      onTime: () => {},
    });
    audio.playFightTheme(0);
    this._beginLesson();
  }

  _beginLesson() {
    const L = LESSONS[this.li];
    if (!L) { this.game.changeState('tutorial'); return; }
    this.flags.jab = this.flags.hook = this.flags.block = this.flags.dodge = this.flags.parry = false;
    this.teach.queue([L.teach]);
    this.phase = 'teach';
  }

  _startPractice() {
    const L = LESSONS[this.li];
    // feed readable attacks during read-and-react lessons; otherwise stay docile.
    this.match.params = (L.setup === 'aggro' || L.setup === 'free')
      ? { ...TUTORIAL.DUMMY, aggression: TUTORIAL.PRACTICE_AGGRESSION }
      : TUTORIAL.DUMMY;
    if (L.setup === 'free') { this.phase = 'free'; return; }
    if (L.await) { this.phase = 'await'; return; }
    this.li++; this._beginLesson();       // intro: nothing to demonstrate
  }

  update(game, dt) {
    this.t += dt / 1000;
    if (this.clearFx > 0) this.clearFx -= dt;
    audio.playFightTheme(0);

    if (game.input.pressed('cancel')) { audio.sfx.select(); game.changeState('tutorial'); return; }

    if (this.teach.active) {              // frozen while a window shows
      if (this.teach.update(game, dt)) this._startPractice();
      return;
    }

    this.match.update(dt, game.input);
    // safety floor: the dummy can never down the player, and the player can never
    // end the tutorial by KO'ing the dummy — keeps the session purely lesson-driven.
    this.match.player.hp = Math.max(this.match.player.hp, 15);
    this.match.enemy.hp = Math.max(this.match.enemy.hp, 15);

    if (this.phase === 'await') {
      const L = LESSONS[this.li];
      if (this.flags[L.await]) { this.clearFx = 900; audio.sfx.confirm(); this.li++; this._beginLesson(); }
    }
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    drawScene(ctx, this.sceneId, { W, floorTop: 170, t: this.t, crowd: 0, accent: this.accent });
    ring(ctx, W, H, { floorTop: 170, accent: this.accent, crowd: 0 });
    const p = this.match.player, e = this.match.enemy;
    const em = mapPose(e);
    drawFighter(ctx, W / 2 + e.offset, FIGHTER.ENEMY_FEET_Y, FIGHTER.SIZE.enemy, this.enemyLook, em.pose, 1, this.t * 4, em.info);
    if (e.pose === 'windup') this._tell(ctx, e);
    const pm = mapPose(p);
    drawFighter(ctx, W / 2 + p.offset, FIGHTER.PLAYER_FEET_Y, FIGHTER.SIZE.player, this.playerLook, pm.pose, -1, this.t * 4, pm.info);

    this._bar(ctx, 14, 18, W - 28, e.hp / BOX.MAX_HP, PAL.orange);
    this._bar(ctx, 14, 30, W - 28, p.hp / BOX.MAX_HP, PAL.blue);

    const L = LESSONS[this.li];
    if (this.phase === 'await' && L && L.await) text(ctx, this._objective(L.await), W / 2, 52, { scale: 1, color: PAL.gold, align: 'center', shadow: PAL.ink });
    if (this.phase === 'free') text(ctx, 'FREE SPAR  -  ESC WHEN DONE', W / 2, 52, { scale: 1, color: PAL.green, align: 'center', shadow: PAL.ink });
    if (this.clearFx > 0) { ctx.globalAlpha = Math.min(1, this.clearFx / 300); text(ctx, 'NICE!', W / 2, H / 2 - 40, { scale: 4, color: PAL.green, align: 'center', shadow: PAL.ink }); ctx.globalAlpha = 1; }
    text(ctx, 'A/D JAB   Q/E HOOK   S BLOCK/PARRY   Z/C/X DODGE', W / 2, H - 18, { scale: 1, color: PAL.textDim, align: 'center' });
    this.teach.draw(game, ctx);
  }

  _objective(k) {
    return { jab: 'THROW A JAB (A/D)', hook: 'THROW A HOOK (Q/E)', block: 'BLOCK IT — HOLD S', dodge: 'DODGE — Z / C / X', parry: 'PARRY! TAP S AS IT LANDS' }[k] || '';
  }
  _bar(ctx, x, y, w, pct, col) {
    ctx.fillStyle = PAL.ink; ctx.fillRect(x - 1, y - 1, w + 2, 9);
    ctx.fillStyle = '#10162e'; ctx.fillRect(x, y, w, 7);
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, pct))), 7);
  }
  _tell(ctx, e) {
    const arrow = e.arm === 'L' ? '>' : '<';
    const col = e.kind === 'hook' ? PAL.orange : PAL.blueLite;
    text(ctx, arrow + ' ' + (e.target === 'high' ? 'HIGH' : 'LOW'), 18, 100, { scale: 2, color: col, shadow: PAL.ink });
  }
}

// Map a BoxingMatch fighter's sim pose to a fighter.js render pose + info
// (local copy of the mapping used by the real boxing state; keeps this state
// self-contained).
function mapPose(fr) {
  const p = fr.pose;
  const info = { arm: fr.arm || 'R', kind: fr.kind || 'jab', target: fr.target || 'high' };
  if (p === 'windup') return (fr.special || fr.kind === 'signature') ? { pose: 'special' } : { pose: 'windup', info };
  if (p === 'punch') return { pose: 'punch', info };
  if (p === 'stance') return { pose: 'special' };
  if (p === 'recover') return { pose: 'idle' };
  if (p === 'dodgeL' || p === 'dodgeR' || p === 'duck') return { pose: 'duck' };
  if (p === 'hurt') return { pose: 'hurt' };
  if (p === 'stun') return { pose: 'stagger' };
  if (p === 'down' || p === 'ko') return { pose: 'down' };
  if (p === 'guard') return { pose: 'guard' };
  return { pose: 'idle' };
}
```

- [ ] **Step 2: Register the state in `src/game.js`**

After the `TutorialChessState` import added in Task 4, add:

```js
import { TutorialBoxState } from './states/tutorialbox.js';
```

In the `STATES` map, after `tutorialChess:`, add:

```js
  tutorialChess: TutorialChessState,
  tutorialBox: TutorialBoxState,
```

- [ ] **Step 3: Verify the boxing tutorial end-to-end**

Run: `npm run dev`, press a key once. In the console: `PAWNCH.changeState('tutorialBox')`
Expected:
- The ring + both fighters render; a **THE FIGHT** window shows. Enter advances.
- **JAB**: pressing A or D completes it ("NICE!"), advances. **HOOK**: Q or E advances.
- **BLOCK**: the dummy throws slow telegraphed jabs (you'll see the HIGH/LOW tell top-left); holding S to block one advances.
- **DODGE**: tapping Z/C/X advances. **PARRY**: tapping S exactly as the punch lands triggers a gold flash + advances (early/held guard does not).
- **FREE SPAR**: you can punch the dummy freely; Esc returns to `tutorial` (until Task 7 that state doesn't exist — use `PAWNCH.changeState('title')` to leave for now).
- No `[PAWNCH] frame error:`, and the player is never knocked down.

- [ ] **Step 4: Commit**

```bash
git add src/states/tutorialbox.js src/game.js
git commit -m "feat(tutorial): add staged boxing tutorial state"
```

---

### Task 7: `TutorialState` tile-select screen + register

**Files:**
- Create: `src/states/tutorial.js`
- Modify: `src/game.js` (import + STATES entry)

- [ ] **Step 1: Create `src/states/tutorial.js`**

```js
// Tutorial tile-select: two big tiles — CHESS (celestial white king) and FIGHT
// (procedural red glove). Pick one to launch its tutorial. Self-contained;
// creates no match, so the in-game pause overlay never engages here.

import { PAL } from '../config.js';
import { text, panel, bgGradient, piece as drawPiece, glove, setPieceSet } from '../gfx.js';
import * as audio from '../audio.js';

export class TutorialState {
  enter(game) {
    this.t = 0;
    this.sel = 0;   // 0 = chess, 1 = fight
    this.tiles = [
      { id: 'tutorialChess', label: 'CHESS', fill: '#0e1430', accent: PAL.blue,   accent2: PAL.blueDark },
      { id: 'tutorialBox',   label: 'FIGHT', fill: '#160e16', accent: PAL.orange, accent2: PAL.orangeDark },
    ];
    audio.playTitleTheme();
  }

  update(game, dt) {
    this.t += dt / 1000;
    audio.playTitleTheme();
    const i = game.input;
    if (i.pressed('left')) { this.sel = 0; audio.sfx.select(); }
    if (i.pressed('right')) { this.sel = 1; audio.sfx.select(); }
    const hov = this._tileAt(game, i.mouse.x, i.mouse.y);
    if (hov >= 0) this.sel = hov;
    if (i.pressed('cancel')) { audio.sfx.select(); game.changeState('title'); return; }
    if (i.pressed('confirm') || (i.mPressed && hov >= 0)) {
      audio.sfx.confirm();
      game.changeState(this.tiles[this.sel].id);
    }
  }

  _geom(game) {
    const tw = 180, th = 200, gap = 32;
    return { tw, th, gap, x0: (game.W - (tw * 2 + gap)) / 2, ty: 132 };
  }
  _tileAt(game, mx, my) {
    const { tw, th, gap, x0, ty } = this._geom(game);
    for (let k = 0; k < 2; k++) { const x = x0 + k * (tw + gap); if (mx >= x && mx < x + tw && my >= ty && my < ty + th) return k; }
    return -1;
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    bgGradient(ctx, W, H, '#0a1130', '#05060c');
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 50; i++) ctx.fillRect((i * 97 + this.t * 6) % W, (i * 53) % H, 1, 1);

    text(ctx, 'TUTORIAL', W / 2, 30, { scale: 4, color: PAL.orange, align: 'center', shadow: PAL.ink });
    text(ctx, 'CHOOSE WHAT TO LEARN', W / 2, 80, { scale: 1, color: PAL.blueLite, align: 'center' });

    const { tw, th, gap, x0, ty } = this._geom(game);
    this.tiles.forEach((tile, k) => {
      const x = x0 + k * (tw + gap), on = k === this.sel;
      text(ctx, tile.label, x + tw / 2, ty - 28, { scale: 2, color: tile.accent, align: 'center', shadow: PAL.ink });
      panel(ctx, x, ty, tw, th, { fill: tile.fill, border: tile.accent, border2: tile.accent2, glow: on });
      if (on) {
        const pulse = 0.6 + 0.4 * Math.sin(this.t * 8);
        ctx.strokeStyle = `rgba(255,210,74,${pulse})`; ctx.lineWidth = 3; ctx.strokeRect(x - 3, ty - 3, tw + 6, th + 6);
        text(ctx, '>', x - 20, ty + th / 2 - 8, { scale: 2, color: PAL.gold, align: 'center' });
        text(ctx, '<', x + tw + 20, ty + th / 2 - 8, { scale: 2, color: PAL.gold, align: 'center' });
      }
      const cx = x + tw / 2, cy = ty + th / 2;
      if (k === 0) {
        // celestial white king (force the celestial set for this draw, then restore)
        setPieceSet('celestial');
        drawPiece(ctx, 'K', cx, cy - 12, 120, true, { t: this.t, glow: 1.4 });
        setPieceSet(game.save.settings.pieceSet || 'celestial');
      } else {
        glove(ctx, cx, cy + 4, 150, { glow: 1 });
      }
    });

    text(ctx, 'ARROWS / CLICK A TILE     ENTER SELECT     ESC BACK', W / 2, H - 30, { scale: 1, color: PAL.textDim, align: 'center' });
  }
}
```

- [ ] **Step 2: Register the state in `src/game.js`**

After the `TutorialBoxState` import added in Task 6, add:

```js
import { TutorialState } from './states/tutorial.js';
```

In the `STATES` map, after `tutorialBox:`, add:

```js
  tutorialBox: TutorialBoxState,
  tutorial: TutorialState,
```

- [ ] **Step 3: Verify the tile screen + routing**

Run: `npm run dev`, press a key once. In the console: `PAWNCH.changeState('tutorial')`
Expected:
- The option-B tile screen: "TUTORIAL" header, **CHESS** tile (blue glow, celestial fiery king nudged to center) and **FIGHT** tile (orange glow, red glove).
- Left/Right (and mouse hover) move the gold selection ring; Enter/click launches that tutorial.
- Finishing or pressing Esc inside either tutorial now returns here cleanly (round-trip works).
- Esc on the tile screen → title. No console error.

- [ ] **Step 4: Commit**

```bash
git add src/states/tutorial.js src/game.js
git commit -m "feat(tutorial): add two-tile tutorial select screen"
```

---

### Task 8: Wire `TUTORIAL` into the main menu

**Files:**
- Modify: `src/states/title.js` (`enter`)

- [ ] **Step 1: Add the menu item**

In `src/states/title.js`, in `enter()`, find:

```js
    this.items.push(
      { id: 'story', label: 'STORY MODE' },
      { id: 'multiplayer', label: 'MULTIPLAYER' },
      { id: 'settings', label: 'SETTINGS' },
    );
```

Replace with (TUTORIAL first among the always-present items, so newcomers land on it):

```js
    this.items.push(
      { id: 'tutorial', label: 'TUTORIAL' },
      { id: 'story', label: 'STORY MODE' },
      { id: 'multiplayer', label: 'MULTIPLAYER' },
      { id: 'settings', label: 'SETTINGS' },
    );
```

(The existing `update()` already does `game.changeState(id)` for any non-`continue` item, so `tutorial` routes automatically.)

- [ ] **Step 2: Verify the full path from the title**

Run: `npm run dev`, press a key once.
Expected:
- The title menu shows **TUTORIAL** (highlighted by default when there's no saved match).
- Selecting it opens the tile screen → CHESS plays the guided opening through `Bxb5` and returns; FIGHT plays jab→hook→block→dodge→parry→free spar and returns.
- Esc steps back out at each level (tutorial half → tile screen → title).
- Start a normal Story match afterward to confirm real matches are unaffected.
- No `[PAWNCH] frame error:` anywhere.

- [ ] **Step 3: Commit**

```bash
git add src/states/title.js
git commit -m "feat(tutorial): add TUTORIAL entry to the main menu"
```

---

## Self-Review

**1. Spec coverage:**
- Two-tile select screen (option B, celestial king + glove) → Task 7. ✓
- TUTORIAL menu item → Task 8. ✓
- Guided scripted chess opening, every piece type + capture + slight advantage, freeze-frame per type → Task 4 (`LINE`/`OUTRO`). ✓
- Looks like the real chess half (same `SQ/OX/OY`, `piece()` art) → Task 4. ✓
- Staged boxing lessons (jab→hook→block→dodge→parry→free spar) vs an easier-than-Patty dummy → Tasks 1 (`TUTORIAL.DUMMY`) + 6. ✓
- Freeze-time-until-Enter windows → Task 3 (`TeachSequence`), used by Tasks 4 & 6. ✓
- Procedural, sprite-overridable glove → Tasks 1 (PAL) + 2 (`glove()` + manifest). ✓
- Real match / resolve / online code untouched; additive `onBlock` only → Task 5. ✓
- No save bump, no roster entry, no real PNG (out of scope) → respected (no such changes in any task). ✓

**2. Placeholder scan:** No "TBD/TODO/handle edge cases" — every code step contains complete content. ✓

**3. Type/name consistency:** State keys `tutorial` / `tutorialChess` / `tutorialBox` are consistent across `game.js` registration, `TutorialState.tiles[].id`, and `changeState()` calls. `TeachSequence` API (`queue`, `active`, `update(game,dt)`, `draw(game,ctx)`) is used identically in both tutorials. Config keys `TUTORIAL.DUMMY` / `TUTORIAL.PRACTICE_AGGRESSION` and `PAL.glove*` match their uses. `glove()` and `onBlock` signatures match call sites. ✓

## Manual verification summary (no automated suite)

Run `npm run dev`; from the title: **TUTORIAL → CHESS** (play to `Bxb5`) and **TUTORIAL → FIGHT** (clear all five skills + free spar). Confirm Esc backs out at each level, a normal Story fight still plays unchanged, and the console shows no `[PAWNCH] frame error:`.
