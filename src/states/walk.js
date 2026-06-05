// "Walk to the board" flair (3-5s): the two fighters stroll from the ring
// over to the chess table in the corner before the chess half begins.

import { MATCH, PAL } from '../config.js';
import { text, ring, chessTable, boxer } from '../gfx.js';
import * as audio from '../audio.js';
import { HUE } from '../opponents.js';

export class WalkState {
  enter(game) {
    this.t = 0;
    this.dur = MATCH.WALK_SECONDS;
    audio.playFightTheme();
    const m = game.match;
    this.oppHue = m.mode === 'story' ? (HUE[m.opponent.hue] || HUE.player) : HUE.red;
    this.round = m.round;
  }

  update(game, dt) {
    this.t += dt / 1000;
    audio.playFightTheme();
    if (this.t >= this.dur || game.input.pressed('confirm')) {
      game.changeState('chess');
    }
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    ring(ctx, W, H, { accent: this.oppHue.body });

    // chess table sits in the lower-left corner
    const tableX = 70, tableY = H - 70;
    chessTable(ctx, tableX, tableY, 7);

    // walk progress (ease-out)
    const p = Math.min(1, this.t / (this.dur - 0.4));
    const ease = 1 - Math.pow(1 - p, 2);

    // player walks from right-center toward the table (left)
    const pStartX = W * 0.62, pEndX = tableX + 40;
    const px = lerp(pStartX, pEndX, ease);
    const py = H - 78;
    const step = this.t * 9;
    boxer(ctx, px, py, 4, HUE.player, p < 0.98 ? 'walk' : 'idle', 1, step);

    // opponent walks from far right toward the other side of the table
    const oStartX = W * 0.86, oEndX = tableX + 90;
    const ox = lerp(oStartX, oEndX, ease);
    boxer(ctx, ox, py - 6, 4, this.oppHue, p < 0.98 ? 'walk' : 'idle', 1, step + 1.5);

    // banner
    text(ctx, 'ROUND ' + this.round, W / 2, 24, { scale: 3, color: PAL.orange, align: 'center', shadow: PAL.ink });
    text(ctx, 'TAKE YOUR SEATS...', W / 2, 60, { scale: 2, color: PAL.blueLite, align: 'center', shadow: PAL.ink });
    text(ctx, 'CHESS', W / 2, 90, { scale: 1, color: PAL.textDim, align: 'center' });

    if (this.t > this.dur - 1) {
      const blink = Math.sin(this.t * 12) > 0;
      if (blink) text(ctx, 'GET READY', W / 2, H - 30, { scale: 2, color: PAL.gold, align: 'center', shadow: PAL.ink });
    }
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
