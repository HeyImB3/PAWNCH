// Title screen: big PAWNCH logo (Street-Fighter-ish), animated arcade
// backdrop, and the main menu. Plays the anthemic title theme.

import { PAL } from '../config.js';
import { text, logo, panel, bgGradient } from '../gfx.js';
import * as audio from '../audio.js';

const ITEMS = [
  { id: 'story', label: 'STORY MODE' },
  { id: 'multiplayer', label: 'MULTIPLAYER' },
  { id: 'settings', label: 'SETTINGS' },
];

export class TitleState {
  enter(game) {
    this.t = 0;
    this.sel = 0;
    this.started = false;
    audio.playTitleTheme();
  }

  update(game, dt) {
    this.t += dt / 1000;
    audio.playTitleTheme();
    const i = game.input;
    if (i.pressed('down')) { this.sel = (this.sel + 1) % ITEMS.length; audio.sfx.select(); }
    if (i.pressed('up')) { this.sel = (this.sel - 1 + ITEMS.length) % ITEMS.length; audio.sfx.select(); }
    if (i.pressed('confirm')) {
      audio.sfx.confirm();
      game.changeState(ITEMS[this.sel].id);
    }
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    // arcade backdrop: diagonal orange/blue beams + starfield
    bgGradient(ctx, W, H, '#0a1130', '#05060c');
    this._beams(ctx, W, H);
    this._stars(ctx, W, H);

    // logo
    logo(ctx, W / 2, 52, 11, this.t * 2.2);
    text(ctx, 'CHESS  BOXING', W / 2, 172, { scale: 2, color: PAL.blueLite, align: 'center', shadow: PAL.ink });

    // menu
    const baseY = 230;
    panel(ctx, W / 2 - 120, baseY - 16, 240, ITEMS.length * 34 + 16, { fill: PAL.panel, border: PAL.orange, border2: PAL.orangeDark });
    ITEMS.forEach((it, idx) => {
      const y = baseY + idx * 34;
      const on = idx === this.sel;
      if (on) {
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 8);
        ctx.fillStyle = `rgba(255,122,24,${0.25 + pulse * 0.25})`;
        ctx.fillRect(W / 2 - 110, y - 6, 220, 26);
        text(ctx, '>', W / 2 - 100, y, { scale: 2, color: PAL.orange });
        text(ctx, '<', W / 2 + 88, y, { scale: 2, color: PAL.orange });
      }
      text(ctx, it.label, W / 2, y, { scale: 2, color: on ? PAL.white : PAL.textDim, align: 'center', shadow: PAL.ink });
    });

    // footer
    const blink = (Math.sin(this.t * 4) > -0.3);
    if (blink) text(ctx, 'ARROWS = MOVE   ENTER = SELECT', W / 2, H - 40, { scale: 1, color: PAL.textDim, align: 'center' });
    text(ctx, game.usingStockfish ? 'STOCKFISH ONLINE' : 'OFFLINE AI', W / 2, H - 22, { scale: 1, color: game.usingStockfish ? PAL.green : PAL.textDim, align: 'center' });
    text(ctx, 'V0.1', 8, H - 16, { scale: 1, color: PAL.textDim });
  }

  _beams(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.10;
    for (let i = -2; i < 8; i++) {
      const x = (i * 90 + (this.t * 18) % 90);
      ctx.fillStyle = i % 2 ? PAL.blue : PAL.orange;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x - 40, H); ctx.lineTo(x - 80, H); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  _stars(ctx, W, H) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + this.t * (10 + (i % 5) * 6)) % W;
      const y = (i * 53) % H;
      const s = (i % 3) ? 1 : 2;
      ctx.globalAlpha = 0.3 + 0.4 * ((i % 4) / 4);
      ctx.fillRect(W - x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }
}
