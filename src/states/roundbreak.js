// Between-round rest: both fighters recover 10-15% HP (the "make it back to
// your corner" heal), then we walk back to the board for the next round.

import { PAL, MATCH, FIGHTER } from '../config.js';
import { text, panel, barH } from '../gfx.js';
import { RingView } from '../ring.js';
import { PortraitFace, damageTier } from '../portrait.js';
import { material, WHITE } from '../chess/board.js';
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
    this.ringView = new RingView({ floorTop: 170 });
    // battle-worn faces beside the heal bars: mood from the chess material,
    // damage tiers from the fight so far (heals fix HP, never faces)
    const mat = this.m.chess ? material(this.m.chess.board) : { diff: 0 };
    const myMat = this.m.playerColor === WHITE ? mat.diff : -mat.diff;
    this.faces = {
      player: new PortraitFace({ slug: 'player', hue: HUE.player }),
      enemy: new PortraitFace({ slug: this.m.mode === 'story' ? this.m.opponent?.look?.sprite : null, hue: this.oppHue }),
    };
    this.faces.player.setMaterial(myMat);
    this.faces.enemy.setMaterial(-myMat);
    audio.sfx.bell();
  }

  update(game, dt) {
    this.t += dt / 1000;
    this.ringView.update(dt);
    this.faces.player.update(dt);
    this.faces.enemy.update(dt);
    if (this.t > 1 && (game.input.pressed('confirm') || this.t > 3.2)) {
      audio.sfx.confirm();
      game.netFlow('walk');   // online: only the authority advances; the peer follows
    }
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    this.ringView.draw(ctx, W, H, { accent: this.oppHue.body, stool: true });

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
    panel(ctx, W / 2 - 186, py - 10, 372, 90, { fill: PAL.panel, border: PAL.green, border2: PAL.ink });
    // battle-worn faces flanking the bars (damage tiers tell the fight's story)
    const dmg = (this.m.damage ||= { player: 0, enemy: 0 });
    this.faces.player.draw(ctx, W / 2 - 180, py - 4, { tier: damageTier(dmg.player) });
    this.faces.enemy.draw(ctx, W / 2 + 136, py + 30, { tier: damageTier(dmg.enemy) });
    text(ctx, 'YOU  +' + this.healed + '%', W / 2 - 130, py, { scale: 1, color: PAL.green });
    barH(ctx, W / 2 - 130, py + 14, 260, 12, ph / 100, { fill: PAL.blue });
    text(ctx, 'OPP  +' + this.healed + '%', W / 2 - 130, py + 36, { scale: 1, color: PAL.green });
    barH(ctx, W / 2 - 130, py + 50, 260, 12, eh / 100, { fill: PAL.orange });

    text(ctx, 'NEXT: ROUND ' + this.m.round + ' / ' + MATCH.TOTAL_ROUNDS, W / 2, py + 100, { scale: 1, color: PAL.textDim, align: 'center' });
    if (this.t > 1) {
      const blink = Math.sin(this.t * 8) > 0;
      if (blink) text(ctx, 'PRESS ENTER', W / 2, H - 28, { scale: 1, color: PAL.gold, align: 'center' });
    }
  }
}
function lerp(a, b, t) { return a + (b - a) * t; }
