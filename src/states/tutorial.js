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
