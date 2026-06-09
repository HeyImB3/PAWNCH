// Between-round rest: both fighters recover 10-15% HP (the "make it back to
// your corner" heal), then we walk back to the board for the next round.

import { PAL, MATCH, FIGHTER } from '../config.js';
import { text, panel, ring, barH } from '../gfx.js';
import { drawFighter } from '../fighter.js';
import * as audio from '../audio.js';
import { HUE, HERO_LOOK } from '../opponents.js';

export class RoundBreakState {
  enter(game) {
    this.t = 0;
    this.m = game.match;
    this.before = { ...this.m.hp };
    this.healed = game.applyRoundHeal();
    this.after = { ...this.m.hp };
    this.oppHue = this.m.mode === 'story' ? (HUE[this.m.opponent.hue] || HUE.red) : HUE.red;
    this.oppLook = (this.m.mode === 'story' && this.m.opponent?.look) ? this.m.opponent.look : { ...HERO_LOOK, hue: HUE.red };
    audio.sfx.bell();
  }

  update(game, dt) {
    this.t += dt / 1000;
    if (this.t > 1 && (game.input.pressed('confirm') || this.t > 3.2)) {
      audio.sfx.confirm();
      game.netFlow('walk');   // online: only the authority advances; the peer follows
    }
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    ring(ctx, W, H, { floorTop: 170, accent: this.oppHue.body });

    text(ctx, 'ROUND ' + (this.m.round - 1) + ' DONE', W / 2, 30, { scale: 2, color: PAL.orange, align: 'center', shadow: PAL.ink });
    text(ctx, 'RECOVER...', W / 2, 60, { scale: 2, color: PAL.blueLite, align: 'center', shadow: PAL.ink });

    // fighters resting in their corners
    drawFighter(ctx, 110, H - 34, FIGHTER.SIZE.break, HERO_LOOK, 'idle', 1, this.t * 2);
    drawFighter(ctx, W - 110, H - 34, FIGHTER.SIZE.break, this.oppLook, 'idle', 1, this.t * 2 + 1);

    // animated heal bars
    const k = Math.min(1, this.t / 1.2);
    const py = 130;
    const ph = lerp(this.before.player, this.after.player, k);
    const eh = lerp(this.before.enemy, this.after.enemy, k);
    panel(ctx, W / 2 - 160, py - 10, 320, 90, { fill: PAL.panel, border: PAL.green, border2: PAL.ink });
    text(ctx, 'YOU  +' + this.healed + '%', W / 2 - 150, py, { scale: 1, color: PAL.green });
    barH(ctx, W / 2 - 150, py + 14, 300, 12, ph / 100, { fill: PAL.blue });
    text(ctx, 'OPP  +' + this.healed + '%', W / 2 - 150, py + 36, { scale: 1, color: PAL.green });
    barH(ctx, W / 2 - 150, py + 50, 300, 12, eh / 100, { fill: PAL.orange });

    text(ctx, 'NEXT: ROUND ' + this.m.round + ' / ' + MATCH.TOTAL_ROUNDS, W / 2, py + 100, { scale: 1, color: PAL.textDim, align: 'center' });
    if (this.t > 1) {
      const blink = Math.sin(this.t * 8) > 0;
      if (blink) text(ctx, 'PRESS ENTER', W / 2, H - 28, { scale: 1, color: PAL.gold, align: 'center' });
    }
  }
}
function lerp(a, b, t) { return a + (b - a) * t; }
