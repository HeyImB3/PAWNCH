// Story mode: shows the ladder + a VS card for the next opponent, then
// kicks off the match (walk -> chess -> boxing -> ...).

import { PAL } from '../config.js';
import { text, panel, boxer } from '../gfx.js';
import * as audio from '../audio.js';
import { OPPONENTS, HUE } from '../opponents.js';
import { WHITE } from '../chess/board.js';

export class StoryState {
  enter(game) {
    this.t = 0;
    this.progress = Math.min(game.save.storyProgress, OPPONENTS.length - 1);
    this.opp = OPPONENTS[this.progress];
    this.allDone = game.save.storyProgress >= OPPONENTS.length;
    this.sel = 0; // 0 = fight, 1 = back
  }

  update(game, dt) {
    this.t += dt / 1000;
    const i = game.input;
    if (this.allDone) {
      if (i.pressed('confirm') || i.pressed('cancel')) game.changeState('title');
      return;
    }
    if (i.pressed('up') || i.pressed('down')) { this.sel ^= 1; audio.sfx.select(); }
    if (i.pressed('cancel')) { audio.sfx.confirm(); game.changeState('title'); }
    if (i.pressed('confirm')) {
      if (this.sel === 1) { audio.sfx.confirm(); game.changeState('title'); return; }
      audio.sfx.confirm();
      game.startMatch({ mode: 'story', opponent: this.opp, playerColor: WHITE });
      game.changeState('walk');
    }
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    text(ctx, 'STORY MODE', W / 2, 18, { scale: 2, color: PAL.orange, align: 'center', shadow: PAL.ink });

    if (this.allDone) {
      text(ctx, 'YOU ARE THE', W / 2, 150, { scale: 3, color: PAL.blueLite, align: 'center', shadow: PAL.ink });
      text(ctx, 'PAWNCHION!', W / 2, 190, { scale: 4, color: PAL.orange, align: 'center', shadow: PAL.ink });
      text(ctx, 'ALL 10 OPPONENTS DEFEATED', W / 2, 250, { scale: 1, color: PAL.textDim, align: 'center' });
      text(ctx, 'PRESS ENTER', W / 2, H - 40, { scale: 1, color: PAL.textDim, align: 'center' });
      return;
    }

    // ladder strip
    const lx = 24, ly = 44;
    OPPONENTS.forEach((o, idx) => {
      const x = lx + idx * 46;
      const beaten = idx < game.save.storyProgress;
      const cur = idx === this.progress;
      panel(ctx, x, ly, 38, 30, { fill: cur ? PAL.blueDark : PAL.panel, border: cur ? PAL.orange : beaten ? PAL.green : PAL.line, border2: PAL.ink });
      text(ctx, (idx + 1) + '', x + 19, ly + 4, { scale: 1, color: cur ? PAL.white : beaten ? PAL.green : PAL.textDim, align: 'center' });
      text(ctx, o.elo + '', x + 19, ly + 16, { scale: 1, color: PAL.textDim, align: 'center' });
    });

    // VS card
    const cardY = 96;
    panel(ctx, 40, cardY, W - 80, 220, { fill: PAL.panel, border: PAL.orange, border2: PAL.orangeDark, glow: true });

    // player (left)
    boxer(ctx, 120, cardY + 150, 4, HUE.player, this.t % 2 < 1 ? 'idle' : 'guard', 1, this.t * 4);
    text(ctx, 'YOU', 120, cardY + 170, { scale: 2, color: PAL.blueLite, align: 'center', shadow: PAL.ink });

    // opponent (right)
    const o = this.opp;
    boxer(ctx, W - 120, cardY + 150, 4, HUE[o.hue] || HUE.player, 'idle', 1, this.t * 4 + 1);
    text(ctx, '#' + (this.progress + 1), W / 2, cardY + 18, { scale: 2, color: PAL.gold, align: 'center', shadow: PAL.ink });

    // big VS
    const pulse = 1 + 0.08 * Math.sin(this.t * 6);
    ctx.save(); ctx.translate(W / 2, cardY + 80); ctx.scale(pulse, pulse);
    text(ctx, 'VS', 0, -16, { scale: 4, color: PAL.orange, align: 'center', shadow: PAL.ink });
    ctx.restore();

    text(ctx, o.name, W / 2, cardY + 150, { scale: 2, color: PAL.white, align: 'center', shadow: PAL.ink });
    text(ctx, 'CHESS RATING ' + o.elo, W / 2, cardY + 174, { scale: 1, color: PAL.blueLite, align: 'center' });
    text(ctx, '"' + o.tag + '"', W / 2, cardY + 192, { scale: 1, color: PAL.textDim, align: 'center' });

    // menu
    const opts = ['FIGHT!', 'BACK'];
    opts.forEach((label, idx) => {
      const y = 336 + idx * 26;
      const on = idx === this.sel;
      if (on) text(ctx, '>', W / 2 - 70, y, { scale: 2, color: PAL.orange });
      text(ctx, label, W / 2, y, { scale: 2, color: on ? PAL.white : PAL.textDim, align: 'center', shadow: PAL.ink });
    });
  }
}
