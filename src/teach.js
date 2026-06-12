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
