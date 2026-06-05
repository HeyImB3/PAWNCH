// Story mode = a campaign fight-select gallery. The ladder unlocks in order:
// you can fight the next UNBEATEN opponent (a gold-highlighted silhouette) or
// REPLAY any you've already beaten (full-color portrait + name). Opponents
// further up the ladder stay locked silhouettes until you reach them. Beating
// the current opponent reveals their portrait and unlocks the next one, so the
// roster lights up one fighter at a time. A NEW GAME button wipes progress.
//
// Progress model (single source of truth = save.storyProgress, the count of
// opponents beaten, i.e. the index of the current challenge):
//   idx <  progress -> BEATEN  (unlocked, full color, replayable)
//   idx === progress -> CURRENT (the next fight: selectable, still a silhouette)
//   idx >  progress -> LOCKED  (silhouette, not selectable yet)

import { PAL } from '../config.js';
import { text, textWidth, panel, portrait } from '../gfx.js';
import * as audio from '../audio.js';
import { OPPONENTS, HUE } from '../opponents.js';
import { tossColor } from '../chess/board.js';

// 5x2 grid of portrait buttons + a virtual RESET focus target after the grid.
const COLS = 5, CELL_W = 86, CELL_H = 92, GAP_X = 10, ROW_H = 132, TOP = 52;
const N = OPPONENTS.length;
const RESET = N;                     // cursor sentinel for the NEW GAME button
const ROWS = Math.ceil(N / COLS);

// progress is the ONLY state that drives the screen — keep it a sane integer
// even if the save was tampered with, so the first fight is always startable.
function clampProgress(v) {
  v = Math.floor(Number(v));
  if (!Number.isFinite(v)) v = 0;
  return Math.max(0, Math.min(N, v));
}

function cellRect(W, idx) {
  const gridW = COLS * CELL_W + (COLS - 1) * GAP_X;
  const startX = Math.round((W - gridW) / 2);
  const col = idx % COLS, row = (idx / COLS) | 0;
  return { x: startX + col * (CELL_W + GAP_X), y: TOP + row * ROW_H, w: CELL_W, h: CELL_H };
}
function resetRect(W) { return { x: Math.round((W - 170) / 2), y: 384, w: 170, h: 20 }; }
function confirmRects(W, H) {
  const ph = 140, py = (H - ph) / 2, bw = 90, bh = 28, gap = 24;
  const bx = Math.round((W - (bw * 2 + gap)) / 2), by = py + ph - 42;
  return [{ x: bx, y: by, w: bw, h: bh, label: 'YES' }, { x: bx + bw + gap, y: by, w: bw, h: bh, label: 'NO' }];
}
const within = (r, mx, my) => mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h;

export class StoryState {
  enter(game, params = {}) {
    this.t = 0;
    this.progress = clampProgress(game.save.storyProgress);
    this.allDone = this.progress >= N;
    this.reveal = Number.isInteger(params.reveal) ? params.reveal : -1;  // portrait to flash gold
    this.cursor = this.allDone ? Math.max(0, Math.min(N - 1, this.reveal))
                               : Math.min(this.progress, N - 1);          // land on the current fight
    this._col = this.cursor % COLS;       // remembered column for vertical nav
    this._mx = -1; this._my = -1;         // last pointer pos (detect real moves)
    this.confirmReset = false;            // NEW GAME confirmation sub-mode
    this.confirmSel = 1;                  // default to NO

    // celebratory sparkle on the fighter you just unlocked
    if (this.reveal >= 0 && this.reveal < N) {
      const r = cellRect(game.W, this.reveal);
      game.fx.burst(r.x + r.w / 2, r.y + r.h / 2, PAL.gold, 20, 2.6, 36);
      game.fx.ring(r.x + r.w / 2, r.y + r.h / 2, PAL.gold, 28);
    }
  }

  // a fighter is BEATEN (replayable), the CURRENT challenge, or LOCKED.
  _status(idx) {
    const beaten = idx < this.progress;
    const current = !this.allDone && idx === this.progress;
    return { beaten, current, locked: !beaten && !current };
  }

  _select(game, idx) {
    if (this._status(idx).locked) { audio.sfx.select(); return; }   // can't fight a locked foe yet
    audio.sfx.confirm();
    game.startMatch({ mode: 'story', opponent: OPPONENTS[idx], playerColor: tossColor() });
    game.changeState('walk');
  }

  _openReset() { this.confirmReset = true; this.confirmSel = 1; audio.sfx.select(); }

  _applyReset(game, sel) {
    audio.sfx.confirm();
    if (sel === 0) {                       // YES — wipe campaign progress
      game.save.storyProgress = 0;
      game.persist();
      this.progress = 0; this.allDone = false; this.reveal = -1; this.cursor = 0; this._col = 0;
    }
    this.confirmReset = false;
  }

  // vertical movement across the grid rows + the trailing RESET row, keeping
  // the current column. Wraps row0 -> row1 -> RESET -> row0.
  _vMove(dir) {
    let row;
    if (this.cursor === RESET) row = ROWS;
    else { row = (this.cursor / COLS) | 0; this._col = this.cursor % COLS; }
    row = (row + dir + (ROWS + 1)) % (ROWS + 1);
    if (row === ROWS) return RESET;
    return Math.min(N - 1, row * COLS + this._col);
  }

  update(game, dt) {
    this.t += dt / 1000;
    const i = game.input;
    const moved = i.mouse.x !== this._mx || i.mouse.y !== this._my;
    this._mx = i.mouse.x; this._my = i.mouse.y;

    // --- NEW GAME confirmation overlay owns all input while open ---
    if (this.confirmReset) {
      const rects = confirmRects(game.W, game.H);
      if (i.mouse.over && (moved || i.mPressed)) {
        for (let k = 0; k < rects.length; k++) if (within(rects[k], i.mouse.x, i.mouse.y)) {
          if (this.confirmSel !== k) { this.confirmSel = k; if (moved) audio.sfx.select(); }
          if (i.mPressed) this._applyReset(game, k);
          break;
        }
      }
      if (i.pressed('left') || i.pressed('right')) { this.confirmSel ^= 1; audio.sfx.select(); }
      if (i.pressed('cancel')) { this.confirmReset = false; audio.sfx.confirm(); return; }
      if (i.pressed('confirm')) this._applyReset(game, this.confirmSel);
      return;
    }

    // --- pointer: hover to focus, click to act ---
    if (i.mouse.over && (moved || i.mPressed)) {
      let hit = false;
      for (let idx = 0; idx < N; idx++) {
        if (within(cellRect(game.W, idx), i.mouse.x, i.mouse.y)) {
          if (idx !== this.cursor) { this.cursor = idx; this._col = idx % COLS; if (moved) audio.sfx.select(); }
          if (i.mPressed) this._select(game, idx);
          hit = true; break;
        }
      }
      if (!hit && within(resetRect(game.W), i.mouse.x, i.mouse.y)) {
        if (this.cursor !== RESET) { this.cursor = RESET; if (moved) audio.sfx.select(); }
        if (i.mPressed) this._openReset();
      }
    }

    // --- keyboard / pad ---
    if (i.pressed('cancel')) { audio.sfx.confirm(); game.changeState('title'); return; }
    if (this.cursor < N) {                 // left/right only move within the grid
      if (i.pressed('right')) { this.cursor = (this.cursor + 1) % N; this._col = this.cursor % COLS; audio.sfx.select(); }
      if (i.pressed('left'))  { this.cursor = (this.cursor - 1 + N) % N; this._col = this.cursor % COLS; audio.sfx.select(); }
    }
    if (i.pressed('down')) { this.cursor = this._vMove(1); audio.sfx.select(); }
    if (i.pressed('up'))   { this.cursor = this._vMove(-1); audio.sfx.select(); }
    if (i.pressed('confirm')) { this.cursor === RESET ? this._openReset() : this._select(game, this.cursor); }
  }

  draw(game, ctx) {
    const W = game.W, H = game.H, t = this.t;
    text(ctx, 'STORY MODE', W / 2, 14, { scale: 2, color: PAL.orange, align: 'center', shadow: PAL.ink });
    text(ctx, this.allDone ? 'CHAMPION  -  REPLAY ANY FIGHT' : 'CHOOSE YOUR CHALLENGER',
      W / 2, 36, { scale: 1, color: this.allDone ? PAL.gold : PAL.blueLite, align: 'center' });

    for (let idx = 0; idx < N; idx++) this._drawCell(ctx, game, idx, t);
    this._drawInfo(ctx, W, t);
    this._drawReset(ctx, W);
    text(ctx, 'ARROWS MOVE    ENTER SELECT    ESC BACK', W / 2, H - 12, { scale: 1, color: PAL.textDim, align: 'center' });

    if (this.confirmReset) this._drawConfirm(ctx, W, H);
  }

  _drawCell(ctx, game, idx, t) {
    const o = OPPONENTS[idx];
    const r = cellRect(game.W, idx);
    const s = this._status(idx);
    const sel = idx === this.cursor;

    // frame: green = beaten, gold = current, orange = focused, dim = locked
    let border = PAL.line;
    if (s.beaten) border = PAL.green;
    if (s.current) border = PAL.gold;
    if (sel) border = PAL.orange;
    panel(ctx, r.x, r.y, r.w, r.h, { fill: PAL.ink, border, border2: PAL.ink });

    portrait(ctx, r.x, r.y, r.w, r.h, HUE[o.hue] || HUE.player, { silhouette: !s.beaten, t: t + idx });

    // ladder-number badge
    text(ctx, '#' + (idx + 1), r.x + 4, r.y + 4, { scale: 1, color: s.beaten ? PAL.white : PAL.textDim, shadow: PAL.ink });

    // big "?" over an unbeaten bust (pulses gold on the current challenger)
    if (!s.beaten) {
      ctx.globalAlpha = s.current ? 0.55 + 0.45 * Math.sin(t * 5) : 0.5;
      text(ctx, '?', r.x + r.w / 2, r.y + r.h / 2 - 14, { scale: 4, color: s.current ? PAL.gold : PAL.line, align: 'center', shadow: PAL.ink });
      ctx.globalAlpha = 1;
    }
    // darken a locked cell
    if (s.locked) { ctx.fillStyle = 'rgba(7,10,22,0.40)'; ctx.fillRect(r.x, r.y, r.w, r.h); }

    // focused: pulsing orange wash
    if (sel) {
      const p = 0.5 + 0.5 * Math.sin(t * 8);
      ctx.fillStyle = `rgba(255,122,24,${0.10 + 0.12 * p})`;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // just-unlocked gold flash (fades over ~1.8s)
    if (idx === this.reveal) {
      const k = Math.max(0, 1 - t / 1.8);
      if (k > 0) {
        ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3;
        ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); ctx.restore();
      }
    }

    // name (revealed) / status label under the button
    const ny = r.y + r.h + 5;
    if (s.beaten) text(ctx, o.name, r.x + r.w / 2, ny, { scale: 1, color: sel ? PAL.white : PAL.text, align: 'center', shadow: PAL.ink });
    else if (s.current) text(ctx, 'NEXT', r.x + r.w / 2, ny, { scale: 1, color: PAL.gold, align: 'center', shadow: PAL.ink });
    else text(ctx, 'LOCKED', r.x + r.w / 2, ny, { scale: 1, color: PAL.textDim, align: 'center' });
  }

  _drawInfo(ctx, W, t) {
    const x = 30, y = 294, w = W - 60, h = 80;
    panel(ctx, x, y, w, h, { fill: PAL.panel, border: PAL.blueDark, border2: PAL.ink });

    if (this.cursor >= N) {              // NEW GAME focused — describe the reset
      text(ctx, 'NEW GAME', x + 12, y + 12, { scale: 2, color: PAL.orange, shadow: PAL.ink });
      text(ctx, 'WIPE ALL STORY PROGRESS AND', x + 12, y + 40, { scale: 1, color: PAL.textDim });
      text(ctx, 'START THE CAMPAIGN FROM FIGHT #1.', x + 12, y + 56, { scale: 1, color: PAL.textDim });
      const a = 'ENTER = RESET';
      text(ctx, a, x + w - 12 - textWidth(a, 1), y + h - 16, { scale: 1, color: PAL.red });
      return;
    }

    const o = OPPONENTS[this.cursor];
    const s = this._status(this.cursor);
    text(ctx, s.beaten ? o.name : '? ? ?', x + 12, y + 12,
      { scale: 2, color: s.beaten ? PAL.white : s.current ? PAL.gold : PAL.textDim, shadow: PAL.ink });
    text(ctx, 'CHESS RATING ' + o.elo, x + 12, y + 38, { scale: 1, color: PAL.blueLite });
    const flavor = s.beaten ? '"' + o.tag + '"'
      : s.current ? 'A NEW CHALLENGER STEPS UP!' : 'WIN THE EARLIER FIGHTS TO UNLOCK';
    text(ctx, flavor, x + 12, y + 54, { scale: 1, color: PAL.textDim });

    const tally = Math.min(this.progress, N) + '/' + N + ' DEFEATED';
    text(ctx, tally, x + w - 12 - textWidth(tally, 1), y + 12, { scale: 1, color: PAL.green });

    let action = 'LOCKED', acol = PAL.red;
    if (s.beaten) { action = 'ENTER = REMATCH'; acol = PAL.green; }
    else if (s.current) { action = 'ENTER = FIGHT!'; acol = PAL.orange; }
    ctx.globalAlpha = s.locked ? 1 : 0.6 + 0.4 * Math.sin(t * 6);
    text(ctx, action, x + w - 12 - textWidth(action, 1), y + h - 16, { scale: 1, color: acol });
    ctx.globalAlpha = 1;
  }

  _drawReset(ctx, W) {
    const r = resetRect(W), on = this.cursor === RESET;
    panel(ctx, r.x, r.y, r.w, r.h, { fill: on ? PAL.blueDark : PAL.panel, border: on ? PAL.orange : PAL.line, border2: PAL.ink });
    if (on) { const p = 0.5 + 0.5 * Math.sin(this.t * 8); ctx.fillStyle = `rgba(255,122,24,${0.10 + 0.12 * p})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
    text(ctx, 'NEW GAME', r.x + r.w / 2, r.y + 7, { scale: 1, color: on ? PAL.white : PAL.textDim, align: 'center', shadow: PAL.ink });
  }

  _drawConfirm(ctx, W, H) {
    ctx.fillStyle = 'rgba(7,10,22,0.80)'; ctx.fillRect(0, 0, W, H);
    const pw = 360, ph = 140, px = (W - pw) / 2, py = (H - ph) / 2;
    panel(ctx, px, py, pw, ph, { fill: PAL.panel, border: PAL.orange, border2: PAL.orangeDark, glow: true });
    text(ctx, 'RESET ALL PROGRESS?', W / 2, py + 20, { scale: 2, color: PAL.orange, align: 'center', shadow: PAL.ink });
    text(ctx, 'THIS CANNOT BE UNDONE.', W / 2, py + 50, { scale: 1, color: PAL.textDim, align: 'center' });
    text(ctx, 'YOU WILL RESTART FROM FIGHT #1.', W / 2, py + 66, { scale: 1, color: PAL.textDim, align: 'center' });
    confirmRects(W, H).forEach((rc, idx) => {
      const on = this.confirmSel === idx;
      panel(ctx, rc.x, rc.y, rc.w, rc.h, { fill: on ? PAL.blueDark : PAL.panel, border: on ? PAL.orange : PAL.line, border2: PAL.ink });
      text(ctx, rc.label, rc.x + rc.w / 2, rc.y + 7, { scale: 2, color: on ? PAL.white : PAL.textDim, align: 'center', shadow: PAL.ink });
    });
  }
}
