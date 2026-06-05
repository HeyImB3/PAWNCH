// Boxing half: renders the ring + both fighters and drives the BoxingMatch
// sim. KO = decisive (win the whole match). Time out = round continues.
//
// Shows: per-opponent ring backdrop, a sliding intro nameplate, HP + stamina
// bars, the star count, a combo counter, an attack TELL during enemy windups
// (side + HIGH/LOW + a SIGNATURE warning), and hit-stop/crowd juice.

import { MATCH, PAL, BOX } from '../config.js';
import { text, panel, ring, boxer, barH } from '../gfx.js';
import * as audio from '../audio.js';
import { BoxingMatch } from '../boxing.js';
import { OPPONENTS, HUE } from '../opponents.js';
import { material, WHITE } from '../chess/board.js';

export class BoxingState {
  enter(game) {
    const m = game.match;
    this.m = m;
    this.t = 0;
    this.bannerT = 1.4;
    this.ended = false;
    this.crowd = 0;
    this.comboFlash = 0;
    this.nameT = 0;            // intro nameplate slide
    this.sigWarnT = 0;         // signature warning flash
    this.oppHue = m.mode === 'story' ? (HUE[m.opponent.hue] || HUE.red) : HUE.red;
    this.accent = this.oppHue.body;

    const params = m.mode === 'story' ? m.opponent.boxing : DEFAULT_PVP_PARAMS;
    this.match = new BoxingMatch({
      mode: m.mode === 'pvp' ? 'pvp' : 'story',
      enemyParams: params,
      seconds: MATCH.BOXING_SECONDS,
      startHP: { player: m.hp.player, enemy: m.hp.enemy },
      send: m.net ? (action) => m.net.sendBox(action) : null,
      inbox: m.net ? (m.netInboxBox ||= []) : null,
      hooks: {
        onPunch: (side, kind) => { if (side === 'player') (kind === 'jab' ? audio.sfx.jab() : audio.sfx.hook()); },
        onWindup: (arm, kind, target, special) => { if (kind === 'signature' || special) { audio.sfx.check(); this.sigWarnT = 0.6; } },
        onHit: (side, dmg, kind) => {
          audio.sfx.hit();
          const [x, y] = side === 'player' ? [game.W / 2, game.H - 130] : [game.W / 2, 200];
          game.fx.burst(x, y, side === 'player' ? PAL.red : PAL.gold, dmg > 14 ? 18 : 11, 3);
          const fz = (kind === 'signature' || kind === 'star') ? 120 : kind === 'hook' ? 70 : 32;
          game.doFreeze(fz);
          game.fx.doShake(Math.min(13, dmg));
          this.crowd = Math.min(1, this.crowd + (dmg > 15 ? 0.65 : 0.3));
          if (side === 'player') game.fx.doFlash(PAL.red, 0.22);
        },
        onDodge: () => audio.sfx.dodge(),
        onCounter: () => { audio.sfx.check(); game.fx.doFlash(PAL.gold, 0.3); game.doFreeze(90); },
        onStar: () => audio.sfx.confirm(),
        onCombo: (side, n) => { if (side === 'player') this.comboFlash = 0.7; },
        onKnockdown: () => { audio.sfx.ko(); game.fx.doShake(16); game.fx.doFlash('#fff', 0.6); game.doFreeze(120); this.crowd = 1; },
        onGetUp: () => { audio.sfx.bell(); this.crowd = 1; },
      },
      onKO: (winner) => this._finish(game, { decisive: true, winner }),
      onTime: () => this._finish(game, { decisive: false, winner: null }),
    });

    // --- chess->boxing crossover: material lead grants the leader stars ---
    this.lead = m.mode === 'pvp' ? 0 : leadFor(m);
    const grant = Math.min(3, Math.floor(Math.abs(this.lead) / 3));
    this.edgeText = null;
    if (grant > 0) {
      const who = this.lead > 0 ? this.match.player : this.match.enemy;
      who.stars = grant;
      this.edgeText = (this.lead > 0 ? 'YOUR' : (m.opponent?.name || 'RIVAL').split(' ')[0] + "'S") +
        ' EDGE +' + Math.abs(this.lead) + '  >  ' + grant + (grant > 1 ? ' STARS' : ' STAR');
    }

    audio.playFightTheme(this.m.fightTrack);
  }

  _finish(game, result) {
    if (this.ended) return;
    this.ended = true;
    this.m.hp.player = this.match.player.hp;
    this.m.hp.enemy = this.match.enemy.hp;
    audio.sfx.bell();
    setTimeout(() => game.resolveBoxing(result), 1100);
  }

  // Esc opens the pause menu — but not while a KO/timeout is resolving.
  canPause() { return !this.ended; }

  update(game, dt) {
    this.t += dt / 1000;
    if (this.bannerT > 0) this.bannerT -= dt / 1000;
    if (this.comboFlash > 0) this.comboFlash -= dt / 1000;
    if (this.sigWarnT > 0) this.sigWarnT -= dt / 1000;
    this.nameT = Math.min(1, this.nameT + dt / 1000 / 0.4);
    this.crowd = Math.max(0, this.crowd - dt / 1000 * 1.2);
    audio.playFightTheme(this.m.fightTrack);
    if (!this.ended) this.match.update(dt, game.input);
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    ring(ctx, W, H, { floorTop: 170, accent: this.accent, crowd: this.crowd });

    const p = this.match.player, e = this.match.enemy;

    // opponent (center, facing camera)
    const eMap = { idle: 'idle', guard: 'guard', stance: 'guard', windup: e.arm === 'L' ? 'windupL' : 'windupR', punch: e.arm === 'L' ? 'punchL' : 'punchR', recover: 'idle', hurt: 'hurt', dodgeL: 'idle', dodgeR: 'idle', duck: 'idle', down: 'down', ko: 'down' };
    const ex = W / 2 + e.offset, ey = 150 + e.duckY;
    if (e.flash > 0 && Math.floor(this.t * 30) % 2) ctx.globalAlpha = 0.6;
    boxer(ctx, ex, ey, 5.2, this.oppHue, eMap[e.pose] || 'idle', 1, this.t * 4);
    ctx.globalAlpha = 1;

    // attack TELL during enemy windup, or a "don't punch!" warning during a counter stance
    if (e.pose === 'windup') this._tell(ctx, ex, e);
    else if (e.pose === 'stance') this._stanceWarn(ctx, ex, e);

    // player (foreground, from behind)
    const pMap = { idle: 'idle', guard: 'guard', windup: 'guard', punch: p.arm === 'L' ? 'punchL' : 'punchR', recover: 'idle', hurt: 'hurt', dodgeL: 'idle', dodgeR: 'idle', duck: 'idle', down: 'down', ko: 'down' };
    const pxs = W / 2 + p.offset, pys = H - 118 + p.duckY;
    if (p.starFx > 0) { // star uppercut glow
      ctx.globalAlpha = 0.5 * (p.starFx / 320);
      ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(pxs, pys - 20, 70, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (p.flash > 0 && Math.floor(this.t * 30) % 2) ctx.globalAlpha = 0.6;
    boxer(ctx, pxs, pys, 6.5, HUE.player, pMap[p.pose] || 'idle', -1, this.t * 4);
    ctx.globalAlpha = 1;

    this._hud(game, ctx);
    this._nameplate(game, ctx);
    this._banner(game, ctx);
  }

  _tell(ctx, ex, e) {
    const special = !!e.special;
    const big = e.kind === 'signature' || special;  // big = blinking red warning
    const col = big ? PAL.red : e.kind === 'hook' ? PAL.orange : PAL.blueLite;
    const blink = big ? (Math.sin(this.t * 24) > 0) : true;
    if (!blink) return;
    const y = 126;  // below the center HUD (round/timer), above the fighter's head
    // side arrow (it's coming from the attacker's arm side)
    const arrow = e.arm === 'L' ? '>' : '<';
    const lbl = (e.target === 'high' ? 'HIGH ' : 'LOW ') + (big ? '!!' : '');
    text(ctx, arrow, ex + (e.arm === 'L' ? -34 : 26), y, { scale: 2, color: col });
    text(ctx, lbl, ex, y, { scale: 1, color: col, align: 'center', shadow: PAL.ink });
    // name the incoming boss move (or the generic haymaker), + a SLIP! cue if unblockable
    const name = e.special || (e.kind === 'signature' ? 'HAYMAKER' : null);
    if (name) text(ctx, name + (e.unblockable ? ' - SLIP!' : ''), ex, y - 14, { scale: 1, color: PAL.red, align: 'center', shadow: PAL.ink });
  }

  // a counter-stance boss is reading you — warn the player NOT to throw a punch.
  _stanceWarn(ctx, ex, e) {
    if (Math.sin(this.t * 18) <= 0) return;
    text(ctx, e.special || 'COUNTER', ex, 112, { scale: 1, color: PAL.gold, align: 'center', shadow: PAL.ink });
    text(ctx, "DON'T PUNCH!", ex, 126, { scale: 1, color: PAL.red, align: 'center', shadow: PAL.ink });
  }

  _hud(game, ctx) {
    const W = game.W, m = this.m;
    const e = this.match.enemy, p = this.match.player;
    const oppName = m.mode === 'story' ? m.opponent.name : 'PLAYER 2';
    // opponent
    text(ctx, oppName, 14, 8, { scale: 1, color: PAL.orangeLite, shadow: PAL.ink });
    barH(ctx, 14, 20, W - 28, 11, e.hp / BOX.MAX_HP, { fill: PAL.orange });
    barH(ctx, 14, 32, W - 28, 4, e.stamina / 100, { fill: PAL.orangeLite, back: '#2a1500' });
    // player
    text(ctx, 'YOU', 14, 42, { scale: 1, color: PAL.blueLite, shadow: PAL.ink });
    barH(ctx, 14, 54, W - 28, 11, p.hp / BOX.MAX_HP, { fill: PAL.blue });
    barH(ctx, 14, 66, W - 28, 4, p.stamina / 100, { fill: PAL.blueLite, back: '#0a1430' });

    // round + timer
    text(ctx, 'ROUND ' + m.round, W / 2, 78, { scale: 1, color: PAL.textDim, align: 'center' });
    const secs = Math.ceil(Math.max(0, this.match.timeLeft) / 1000);
    text(ctx, secs + '', W / 2, 90, { scale: 2, color: secs <= 10 ? PAL.red : PAL.gold, align: 'center', shadow: PAL.ink });

    // stars
    for (let i = 0; i < p.stars; i++) text(ctx, '*', 16 + i * 16, 80, { scale: 2, color: PAL.gold });

    // combo counter
    if (p.combo >= 2 && p.comboTimer > 0) {
      const pop = this.comboFlash > 0 ? 1 + this.comboFlash : 1;
      ctx.save(); ctx.translate(W - 70, 100); ctx.scale(pop, pop);
      text(ctx, p.combo + ' HIT', 0, -6, { scale: 2, color: PAL.gold, align: 'center', shadow: PAL.ink });
      text(ctx, 'COMBO', 0, 12, { scale: 1, color: PAL.orangeLite, align: 'center' });
      ctx.restore();
    }

    // knockdown tally pips (best-of-3) next to each fighter's name
    this._kdPips(ctx, W - 14, 10, e.knockdowns, PAL.orange);
    this._kdPips(ctx, W - 14, 44, p.knockdowns, PAL.blue);

    // the ref's 10-count on a downed fighter
    for (const fr of [p, e]) {
      if (fr.pose === 'down') {
        const n = Math.min(BOX.GET_UP_COUNT, Math.ceil(fr.downCount));
        const last = fr.knockdowns >= BOX.KNOCKDOWNS_TO_KO;
        text(ctx, n + '', W / 2, game.H / 2 - 20, { scale: 8, color: PAL.red, align: 'center', shadow: PAL.ink });
        const lbl = fr.side === 'player' ? 'GET UP!' : 'DOWN!';
        text(ctx, lbl, W / 2, game.H / 2 + 40, { scale: 2, color: PAL.white, align: 'center', shadow: PAL.ink });
        text(ctx, 'KNOCKDOWN ' + fr.knockdowns + ' / ' + BOX.KNOCKDOWNS_TO_KO + (last ? '  — FINAL!' : ''),
          W / 2, game.H / 2 + 64, { scale: 1, color: last ? PAL.red : PAL.gold, align: 'center', shadow: PAL.ink });
      }
    }

    this._controls(game, ctx);
  }

  // best-of-3 knockdown pips: filled = falls taken, the last one is the KO.
  _kdPips(ctx, rightX, y, count, col) {
    const n = BOX.KNOCKDOWNS_TO_KO, s = 7, gap = 3;
    const x0 = rightX - (n * s + (n - 1) * gap);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (s + gap);
      ctx.fillStyle = PAL.ink; ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
      ctx.fillStyle = i < count ? (i === n - 1 ? PAL.red : col) : '#26304f';
      ctx.fillRect(x, y, s, s);
    }
  }

  // small, always-on controls diagram tucked into the bottom corner(s).
  _controls(game, ctx) {
    // foreground player (you / P1)
    this._ctrlBox(game, ctx, 6, this.m.mode === 'pvp' ? 'P1' : 'CONTROLS',
      ['A/D JAB', 'Q/E HOOK', '< / > DODGE', 'v DUCK', 'S GUARD'], 'left');
    // hotseat opponent (P2) gets their own cluster on the right
    if (this.m.mode === 'pvp') {
      this._ctrlBox(game, ctx, game.W - 84, 'P2',
        ['F/H JAB', 'T/U HOOK', 'G/J DODGE', 'B DUCK', 'V GUARD'], 'right');
    }
  }

  _ctrlBox(game, ctx, x, title, rows, align) {
    const lh = 9, w = 78;
    const h = (rows.length + 1) * lh + 8;
    const y = game.H - h - 4;
    ctx.fillStyle = 'rgba(7,10,22,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(58,74,120,0.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    text(ctx, title, x + 5, y + 5, { scale: 1, color: PAL.textDim });
    rows.forEach((r, i) => text(ctx, r, x + 5, y + 5 + (i + 1) * lh, { scale: 1, color: PAL.textDim }));
  }

  // sliding lower-third "tale of the tape" nameplate at the intro
  _nameplate(game, ctx) {
    if (this.t > 3) return;
    const W = game.W;
    const slide = 1 - Math.pow(1 - this.nameT, 3);
    const fade = this.t > 2.4 ? Math.max(0, 1 - (this.t - 2.4) / 0.6) : 1;
    ctx.globalAlpha = fade;
    const y = 250;
    const x = -200 + slide * (W / 2 - 150 + 200);
    panel(ctx, x, y, 300, 56, { fill: PAL.panel, border: this.accent, border2: PAL.ink });
    const name = this.m.mode === 'story' ? this.m.opponent.name : 'PLAYER 2';
    text(ctx, name, x + 12, y + 8, { scale: 2, color: PAL.white, shadow: PAL.ink });
    if (this.m.mode === 'story') {
      text(ctx, 'CHESS ' + this.m.opponent.elo + '   SPECIAL: ' + this.m.opponent.boxing.special.name, x + 12, y + 32, { scale: 1, color: PAL.orangeLite });
    }
    if (this.edgeText) text(ctx, this.edgeText, x + 12, y + 44, { scale: 1, color: this.lead > 0 ? PAL.green : PAL.red });
    ctx.globalAlpha = 1;
  }

  _banner(game, ctx) {
    if (this.bannerT > 0) {
      const a = Math.min(1, this.bannerT / 0.4);
      ctx.globalAlpha = a;
      text(ctx, 'BOX!', game.W / 2, game.H / 2 - 30, { scale: 6, color: PAL.orange, align: 'center', shadow: PAL.ink });
      ctx.globalAlpha = 1;
    }
  }
}

// material lead from the player's perspective (+ = player ahead)
function leadFor(m) {
  const mat = material(m.chess.board);
  return m.playerColor === WHITE ? mat.diff : -mat.diff;
}

const DEFAULT_PVP_PARAMS = {
  telegraphMs: 600, recoverMs: 400, aggression: 0.4, comboChance: 0.3,
  dodgeSkill: 0.3, guardChance: 0.3, punchDmg: 12, feintChance: 0.2,
  highChance: 0.5, signature: { name: 'HAYMAKER', dmg: 24, telegraphMs: 750, chance: 0.08 },
};
