// Boxing half: renders the ring + both fighters and drives the BoxingMatch
// sim. KO = decisive (win the whole match). Time out = round continues.
//
// Shows: per-opponent ring backdrop, a sliding intro nameplate, HP + stamina
// bars, the star count, a combo counter, an attack TELL during enemy windups
// (side + HIGH/LOW + a SIGNATURE warning), and hit-stop/crowd juice.

import { MATCH, PAL, BOX, SIM } from '../config.js';
import { FIGHTER } from '../config.js';
import { text, textWidth, panel, barH } from '../gfx.js';
import { RingView } from '../ring.js';
import { drawFighter } from '../fighter.js';
import { drawSpecialFx } from '../specialfx.js';
import { drawScene, sceneFor } from '../scenery.js';
import * as audio from '../audio.js';
import { BoxingMatch, DEFAULT_PARAMS } from '../sim/box.js';
import { OPPONENTS, HUE, HERO_LOOK, DEFAULT_LOOK } from '../opponents.js';
import { material, WHITE } from '../chess/board.js';

// Get-up bar gradient: a chunky 16-bit ramp from electric blue (empty/left) into
// a saturated brand orange that dominates the upper half (full/right). Only a
// brief light seam bridges the two — no washed-out white core. rampColor(t) snaps
// t (0..1) to a discrete band for that stepped, retro look.
const GETUP_GRAD = ['#2b6cff', '#3f7bff', '#6fa0ff', '#ffb05a', '#ff9a3a', '#ff8a2e', '#ff7a18', '#ff7a18', '#f4600f', '#ff7a18'];
function rampColor(t) {
  const r = GETUP_GRAD;
  return r[Math.max(0, Math.min(r.length - 1, Math.floor(t * r.length)))];
}

// Every input the boxing sim reads (P1 + P2 hotseat). The loop captures exactly
// these once per frame and latches their edges to one sub-tick (see inputview).
const BOX_INPUTS = [
  'jabL', 'jabR', 'hookL', 'hookR', 'dodgeL', 'dodgeR', 'duck', 'block', 'confirm',
  'p2_jabL', 'p2_jabR', 'p2_hookL', 'p2_hookR', 'p2_dodgeL', 'p2_dodgeR', 'p2_duck', 'p2_block', 'p2_getup',
];

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
    this.tellPopT = 0;         // attack-tell banner pop-in timer (set on each windup)
    this.specialFxT = 0;       // strike-phase timer (s) for the boss special spectacle
    this.oppHue = m.mode === 'story' ? (HUE[m.opponent.hue] || HUE.red) : HUE.red;
    this.enemyLook = (m.mode === 'story' && m.opponent?.look) ? m.opponent.look : DEFAULT_LOOK;
    this.playerLook = HERO_LOOK;
    this.accent = this.oppHue.body;
    this.sceneId = sceneFor(m, game.save);   // story: opponent arena; pvp: player's pick
    this.ringView = new RingView({ floorTop: 170 });  // fresh mat each boxing half
    // a brightened copy of the opponent's theme — flickered onto them while they
    // wind up a SPECIAL (Punch-Out-style tell), plus a red "staggered" palette.
    this.flareHue = { body: lighten(this.oppHue.body, 0.55), trim: lighten(this.oppHue.trim, 0.45), skin: lighten(this.oppHue.skin, 0.4) };
    this.redHue = { body: PAL.red, trim: '#7a0e1c', skin: '#ff9a9a' };

    // STORY uses the opponent's tuned boxing kit; PVP/online use the default.
    // Guard the story path: a malformed or older saved opponent can lack `boxing`
    // (the sim also defaults internally, but this keeps the nameplate sane too).
    const params = (m.mode === 'story' && m.opponent?.boxing) ? m.opponent.boxing : DEFAULT_PARAMS;
    this.match = new BoxingMatch({
      mode: m.mode === 'pvp' ? 'pvp' : 'story',
      enemyParams: params,
      seconds: MATCH.BOXING_SECONDS,
      startHP: { player: m.hp.player, enemy: m.hp.enemy },
      // seed the deterministic sim. Offline uses fresh entropy per fight; online
      // will set m.boxSeed from the shared match seed (1B-C flow / Phase 2).
      seed: m.boxSeed != null ? m.boxSeed : Math.floor(Math.random() * 0x100000000),
      hooks: {
        onPunch: (side, kind) => { if (side === 'player') (kind === 'jab' ? audio.sfx.jab() : audio.sfx.hook()); },
        onWindup: (arm, kind, target, special) => { this.tellPopT = 0.2; if (kind === 'signature' || special) { audio.sfx.check(); this.sigWarnT = 0.6; } },
        onHit: (side, dmg, kind) => {
          audio.sfx.hit();
          // rope shockwave from the impact (render-only juice)
          this.ringView.impact(game.W / 2 + (side === 'player' ? this.match.player.offset : this.match.enemy.offset), Math.min(1, dmg / 16));
          const [x, y] = side === 'player' ? [game.W / 2, game.H - 130] : [game.W / 2, 200];
          game.fx.burst(x, y, side === 'player' ? PAL.red : PAL.gold, dmg > 14 ? 18 : 11, 3);
          const fz = (kind === 'signature' || kind === 'star') ? 130 : kind === 'hook' ? 90 : 50;
          game.doFreeze(fz);
          game.fx.doShake(Math.min(13, dmg));
          this.crowd = Math.min(1, this.crowd + (dmg > 15 ? 0.65 : 0.3));
          if (side === 'player') game.fx.doFlash(PAL.red, 0.22);
          if (dmg > 12) game.fx.ring(x, y, side === 'player' ? PAL.red : '#ffffff');   // impact pop (Feel B)
          if (side === 'enemy' && dmg > 14) game.fx.doFlash('#ffffff', 0.12);           // crunch when YOU land a big one
          // a boss SPECIAL signature landing = the big spectacle: trigger the strike FX + amplify.
          if (side === 'player' && this.match.enemy.special) {
            this.specialFxT = 0.6;     // every special type fires its spectacle
            if (kind === 'signature') { game.doFreeze(140); game.fx.doShake(17); game.fx.doFlash('#fff', 0.5); }
          }
        },
        onDodge: (side) => {   // a quick whoosh of dust on a slip (Feel C)
          audio.sfx.dodge();
          const [x, y] = side === 'player' ? [game.W / 2, game.H - 130] : [game.W / 2, 200];
          game.fx.burst(x, y, '#cdd6ff', 7, 2.4, 13);
        },
        onParry: (side) => {
          // a clean parry: star twinkle, a bright flash, a beat of hit-stop, and a
          // gold star burst over the parrier — they just earned a free opening.
          audio.sfx.parry();
          game.fx.doFlash(side === 'player' ? PAL.blueLite : PAL.gold, 0.4);
          game.doFreeze(120);
          this.crowd = 1;
          const [x, y] = side === 'player' ? [game.W / 2, game.H - 130] : [game.W / 2, 150];
          game.fx.burst(x, y, PAL.gold, 16, 3); game.fx.ring(x, y, PAL.gold);
        },
        onCounter: () => { audio.sfx.check(); game.fx.doFlash(PAL.gold, 0.38); game.fx.doShake(11); game.doFreeze(120); },   // crunchier counter (Feel B)
        onStar: () => audio.sfx.confirm(),
        onCombo: (side, n) => { if (side === 'player') this.comboFlash = 0.7; },
        onKnockdown: () => { audio.sfx.ko(); game.fx.doShake(16); game.fx.doFlash('#fff', 0.6); game.doFreeze(120); this.crowd = 1; this.ringView.impact(game.W / 2, 1); },
        onGetUpTap: (side, charge) => { if (side === 'player') { audio.sfx.getup(charge); this.crowd = Math.min(1, this.crowd + 0.05); } },
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

  // Render-only timers (cosmetic — not part of the deterministic sim).
  update(game, dt) {
    this.t += dt / 1000;
    if (this.bannerT > 0) this.bannerT -= dt / 1000;
    if (this.comboFlash > 0) this.comboFlash -= dt / 1000;
    if (this.sigWarnT > 0) this.sigWarnT -= dt / 1000;
    if (this.tellPopT > 0) this.tellPopT -= dt / 1000;
    if (this.specialFxT > 0) this.specialFxT -= dt / 1000;
    this.nameT = Math.min(1, this.nameT + dt / 1000 / 0.4);
    this.crowd = Math.max(0, this.crowd - dt / 1000 * 1.2);
    this.ringView.update(dt);
    audio.playFightTheme(this.m.fightTrack);
  }

  // The deterministic sim. The game loop calls this in whole SIM.TICK_MS ticks
  // (see game.js); `input` is a per-tick view (pressed/isDown) with edge presses
  // latched to one tick (inputview), so a single keypress can't double-fire.
  get tickActions() { return BOX_INPUTS; }
  tick(game, input) {
    if (!this.ended) this.match.update(SIM.TICK_MS, input);
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    drawScene(ctx, this.sceneId, { W, floorTop: 170, t: this.t, crowd: this.crowd, accent: this.accent });
    this.ringView.draw(ctx, W, H, { accent: this.accent, crowd: this.crowd });

    const p = this.match.player, e = this.match.enemy;

    // opponent (center, facing camera)
    const ex = W / 2 + e.offset;
    // boss SPECIAL spectacle (chess-themed): a back layer behind the fighter + a front layer over both.
    const spSlug = this.enemyLook.sprite;
    const spActive = (!!e.special && (e.pose === 'windup' || e.pose === 'stance')) || this.specialFxT > 0;
    const spO = spActive ? { W, H, ex, feetY: FIGHTER.ENEMY_FEET_Y, t: this.t, accent: this.accent,
      phase: this.specialFxT > 0 ? 'strike' : 'charge',
      k: this.specialFxT > 0 ? Math.min(1, 1 - this.specialFxT / 0.6) : 1 } : null;
    if (spO) drawSpecialFx(ctx, spSlug, { ...spO, layer: 'back' });
    const eFlaring = (e.special || e.kind === 'signature') && (e.pose === 'windup' || e.pose === 'stance') && Math.floor(this.t * 18) % 2 === 0;
    let eLook = this.enemyLook;
    if (e.pose === 'stun') eLook = Math.floor(this.t * 12) % 2 ? { ...this.enemyLook, hue: this.redHue } : this.enemyLook;
    else if (eFlaring) eLook = { ...this.enemyLook, hue: this.flareHue };
    if (e.flash > 0 && Math.floor(this.t * 30) % 2) ctx.globalAlpha = 0.6;
    const em = mapPose(e);
    drawFighter(ctx, ex, FIGHTER.ENEMY_FEET_Y, FIGHTER.SIZE.enemy, eLook, em.pose, 1, this.t * 4, em.info);
    ctx.globalAlpha = 1;
    if (e.pose === 'stun') this._stunFx(ctx, ex, FIGHTER.ENEMY_FEET_Y - 150);

    // attack TELL during enemy windup, or a "don't punch!" warning during a counter stance
    if (e.pose === 'windup') this._tell(ctx, e);
    else if (e.pose === 'stance') this._stanceWarn(ctx, e);

    // player (foreground, from behind)
    const pxs = W / 2 + p.offset;
    let pLook = (p.pose === 'stun' && Math.floor(this.t * 12) % 2) ? { ...this.playerLook, hue: this.redHue } : this.playerLook;
    if (p.starFx > 0) {
      ctx.globalAlpha = 0.5 * (p.starFx / 320);
      ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(pxs, FIGHTER.PLAYER_FEET_Y - 150, 70, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (p.flash > 0 && Math.floor(this.t * 30) % 2) ctx.globalAlpha = 0.6;
    const pm = mapPose(p);
    drawFighter(ctx, pxs, FIGHTER.PLAYER_FEET_Y, FIGHTER.SIZE.player, pLook, pm.pose, -1, this.t * 4, pm.info);
    ctx.globalAlpha = 1;
    if (p.pose === 'stun') this._stunFx(ctx, pxs, FIGHTER.PLAYER_FEET_Y - 150);

    if (spO) drawSpecialFx(ctx, spSlug, { ...spO, layer: 'front' });
    this.ringView.drawPress(ctx, W, H);
    this._hud(game, ctx);
    this._nameplate(game, ctx);
    this._banner(game, ctx);
  }

  // Attack TELL — a punchy 16-bit arcade banner up in the air to the LEFT of the
  // ring (clear of the centered round/timer and the fighter). It POPS in on each
  // windup (overshoot then settle) and shakes on big moves. SPECIAL / signature
  // banners are themed to the FIGHTER'S color scheme (this.accent); only the
  // danger cue (SLIP IT!) stays a warning color. Plain jabs/hooks keep their
  // functional blue/orange so the player can still read the punch type at a glance.
  _tell(ctx, e) {
    const special = !!e.special;
    const big = e.kind === 'signature' || special;
    if (big && Math.sin(this.t * 24) <= 0) return;   // big moves blink the whole banner
    const arrow = e.arm === 'L' ? '>' : '<';         // which side the shot swings from
    const dir = arrow + ' ' + (e.target === 'high' ? 'HIGH' : 'LOW');
    const lines = [];
    if (big) {
      const lite = lighten(this.accent, 0.5);        // readable text in the fighter's hue
      const name = e.special || 'HAYMAKER';
      lines.push({ s: name + ' !!', c: lite, sh: PAL.ink });
      lines.push({ s: dir + ' !!', c: lite, sh: PAL.ink });
      if (e.unblockable) lines.push({ s: 'SLIP IT!', c: PAL.gold, sh: PAL.ink });
      this._tellBanner(ctx, lines, this.accent, true);
    } else {
      const col = e.kind === 'hook' ? PAL.orange : PAL.blueLite;
      lines.push({ s: dir, c: col, sh: PAL.ink });
      this._tellBanner(ctx, lines, col, false);
    }
  }

  // a counter-stance boss is reading you — warn the player NOT to throw a punch.
  // Themed to the fighter too, with the action cue kept red for legibility.
  _stanceWarn(ctx, e) {
    if (Math.sin(this.t * 18) <= 0) return;
    this._tellBanner(ctx, [
      { s: (e.special || 'COUNTER') + ' !!', c: lighten(this.accent, 0.5), sh: PAL.ink },
      { s: "DON'T PUNCH!", c: PAL.red, sh: PAL.ink },
    ], this.accent, true);
  }

  // draws the shared tell banner: a chunky outlined plate of stacked text lines,
  // anchored upper-left "in the air", scaled by the pop timer (overshoot->settle)
  // and shaken for big moves. `accent` tints the frame; `big` adds glow + shake.
  _tellBanner(ctx, lines, accent, big) {
    const sc = 2, lh = 20, pad = 7;
    let wmax = 0;
    for (const ln of lines) wmax = Math.max(wmax, textWidth(ln.s, sc));
    const bw = wmax + pad * 2, bh = lines.length * lh + pad * 2 - 2;
    const bx = 14, by = 100;                                  // up in the air, left of the ring
    const pop = Math.max(0, this.tellPopT) / 0.2;            // 1 -> 0
    const scale = 1 + pop * 0.32;                             // pop-in overshoot
    const shake = big ? Math.round(Math.sin(this.t * 38) * 2) : 0;
    ctx.save();
    const ox = bx + bw / 2, oy = by + bh / 2;
    ctx.translate(ox + shake, oy); ctx.scale(scale, scale); ctx.translate(-ox, -oy);
    // big moves get the chunky outlined plate; ordinary jabs/hooks just pop the
    // text so the screen doesn't flash a box on every single punch.
    if (big) panel(ctx, bx, by, bw, bh, { fill: 'rgba(7,10,22,0.82)', border: accent, border2: PAL.ink, glow: true });
    let ly = by + pad - 2;
    for (const ln of lines) { text(ctx, ln.s, bx + pad, ly, { scale: sc, color: ln.c, shadow: ln.sh }); ly += lh; }
    ctx.restore();
  }

  // dizzy stars orbiting a staggered (parried) fighter's head — the classic
  // arcade "stunned" tell, paired with the red flicker on the sprite itself.
  _stunFx(ctx, cx, cy) {
    for (let i = 0; i < 3; i++) {
      const a = this.t * 7 + i * (Math.PI * 2 / 3);
      text(ctx, '*', cx + Math.cos(a) * 18, cy + Math.sin(a) * 7, { scale: 2, color: PAL.gold, align: 'center', shadow: PAL.ink });
    }
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

    // the ref's count + the mash-to-rise power bar on a downed fighter. If BOTH
    // go down together (a simultaneous knockdown), stack the gauges instead of
    // letting them overlap — YOU on top, the opponent below, each shrunk to fit.
    const downP = p.pose === 'down', downE = e.pose === 'down';
    if (downP && downE) {
      this._getUpMeter(game, ctx, p, { cy: game.H / 2 - 96, scale: 0.72 });
      this._getUpMeter(game, ctx, e, { cy: game.H / 2 + 96, scale: 0.72 });
    } else {
      if (downP) this._getUpMeter(game, ctx, p);
      if (downE) this._getUpMeter(game, ctx, e);
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

  // ---- GET-UP minigame: the mash-to-rise power bar on a downed fighter ----
  // 16-bit arcade gauge: a dim plate, the ref's flashing count, the fall label,
  // and a segmented charge bar that lights orange->gold->green as you fill it,
  // with a leading-segment flicker, a per-tap white flash + scale pop, and a
  // shake/glow as it nears full. The CPU fills its own bar automatically.
  _getUpMeter(game, ctx, fr, opt = {}) {
    const W = game.W, H = game.H, cx = W / 2;
    const cy = opt.cy ?? H / 2;                 // shifted when two gauges are stacked
    const sc = opt.scale ?? 1;                  // shrunk to fit when both fighters are down
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    const you = fr.side === 'player';
    const charge = fr.getUpCharge;
    const remaining = Math.max(0, BOX.GET_UP_COUNT - fr.downCount);
    const urgent = remaining <= 4;
    const tap = Math.max(0, fr.getUpTapFx) / 140;          // 1 -> 0 fade after a mash
    const full = charge >= 0.86;

    // dim plate behind the gauge so it reads over the busy ring
    ctx.fillStyle = 'rgba(7,10,22,0.55)';
    ctx.fillRect(cx - 178, cy - 104, 356, 196);

    // the ref's count — flashes red, strobes white when the count runs short
    const n = Math.ceil(remaining);
    const countCol = urgent && Math.floor(this.t * 8) % 2 ? PAL.white : PAL.red;
    text(ctx, n + '', cx, cy - 92, { scale: 7, color: countCol, align: 'center', shadow: PAL.ink });

    // which fall this is (1st easy, 2nd hard + final warning)
    const fallLbl = fr.knockdowns >= 2 ? '2ND DOWN  -  LAST CHANCE!' : '1ST DOWN';
    text(ctx, fallLbl, cx, cy - 14, { scale: 1, color: fr.knockdowns >= 2 ? PAL.red : PAL.gold, align: 'center', shadow: PAL.ink });

    // prompt: a human fighter mashes (you, or a downed P2 in hotseat); the CPU
    // just struggles up on its own.
    const human = you || this.m.mode === 'pvp';
    if (human) {
      const blink = Math.sin(this.t * 16) > 0;
      const lbl = full ? 'RISE!!' : (you ? 'MASH  SPACE!' : 'P2: MASH  NUM +');
      text(ctx, lbl, cx, cy + 2, { scale: 2, color: full ? PAL.green : (blink ? PAL.gold : PAL.white), align: 'center', shadow: PAL.ink });
    } else {
      const name = (this.m.mode === 'story' ? this.m.opponent.name : 'RIVAL').split(' ')[0];
      text(ctx, name + ' STRUGGLES UP...', cx, cy + 2, { scale: 1, color: PAL.orangeLite, align: 'center', shadow: PAL.ink });
    }

    // --- the charge bar: a glitchy 16-bit blue->orange gradient that crackles
    // with more electric sparks + static the fuller it gets ---
    const segs = 24, gap = 2, bw = 288, bh = 22;
    const barY = cy + 32, bx = cx - bw / 2;
    const glitch = charge;                                    // 0..1 chaos level rises with fill
    // a per-tap scale pop + a tremble that grows toward full
    const pop = 1 + tap * 0.06;
    const shake = Math.round(Math.sin(this.t * 40) * (0.4 + glitch * 2));
    ctx.save();
    ctx.translate(cx + shake, barY + bh / 2);
    ctx.scale(pop, pop);
    ctx.translate(-cx, -(barY + bh / 2));

    panel(ctx, bx - 5, barY - 5, bw + 10, bh + 10,
      { fill: PAL.ink2, border: rampColor(charge), border2: PAL.ink, glow: charge > 0.4 });
    const sw = (bw - (segs - 1) * gap) / segs;
    const litCount = charge * segs;
    for (let i = 0; i < segs; i++) {
      const sx = bx + i * (sw + gap);
      const pos = i / (segs - 1);                             // FIXED gradient: 0 = blue (left) .. 1 = orange (right)
      const lit = i < litCount;
      const lead = i === Math.floor(litCount);
      // glitch jitter: lit cells shiver a pixel up/down, more often near full
      const jit = lit && Math.random() < glitch * 0.5 ? (Math.random() < 0.5 ? -2 : 2) : 0;
      let col;
      if (lit) {
        col = rampColor(pos);                                 // reveal the blue->orange gradient
        if (Math.random() < glitch * 0.12) col = PAL.white;            // occasional electric static pop
        else if (Math.random() < glitch * 0.12) col = rampColor(Math.random()); // gradient glitch
        else if (tap > 0 && Math.random() < tap) col = PAL.white;      // tap-flash ripple
      } else if (lead && Math.floor(this.t * 24) % 2) {
        col = rampColor(pos);                                 // leading cell flickers in its hue
      } else {
        col = '#1a2238';                                      // empty cell
      }
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(sx), barY + jit, Math.ceil(sw), bh);
    }
    // glitchy horizontal tear — a bright displaced scanline that skips around
    if (glitch > 0.25 && Math.random() < glitch * 0.5) {
      const ty = barY + (Math.random() * bh | 0);
      ctx.fillStyle = Math.random() < 0.5 ? PAL.white : rampColor(Math.random());
      ctx.fillRect(bx, ty, Math.round(bw * charge), 1);
    }
    // glassy top sheen over the filled run
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(bx, barY, Math.round(bw * charge), 4);
    ctx.restore();

    // electric sparks + crackling static around the frame — denser as it fills
    this._sparks(ctx, bx - 5, barY - 5, bw + 10, bh + 10, charge);

    // bouncing pixel mash-chevrons under the bar (human masher only; '^' isn't
    // in the bitmap font, so they're hand-drawn)
    if (human && !full) {
      const bob = Math.round(Math.abs(Math.sin(this.t * 10)) * 4);
      const chy = barY + bh + 10 - bob;
      for (const dx of [-30, 0, 30]) {
        this._chevron(ctx, cx + dx, chy + 2, PAL.ink);   // shadow
        this._chevron(ctx, cx + dx, chy, PAL.gold);
      }
    }
    ctx.restore();   // close the stacked-layout transform
  }

  // a chunky pixel "^" (up chevron), apex centered on cx
  _chevron(ctx, cx, y, col) {
    const u = 2;
    ctx.fillStyle = col;
    for (let r = 0; r < 5; r++) {
      ctx.fillRect(cx - (r + 1) * u, y + r * u, u, u);   // left arm
      ctx.fillRect(cx + r * u, y + r * u, u, u);         // right arm
    }
  }

  // crackling electric sparks + static hugging the charge-bar frame. `q` (0..1)
  // is the fill level: more static specks and longer/more frequent bolts as it
  // climbs. Sparks take their hue from the gradient at their x (blue L -> orange R).
  _sparks(ctx, x, y, w, h, q) {
    if (q < 0.06) return;
    // static specks scattered just outside the frame edges
    const dots = Math.floor(q * 22);
    for (let i = 0; i < dots; i++) {
      let px, py;
      if (Math.random() < 0.5) {                              // top/bottom bands
        px = x + Math.random() * w;
        py = Math.random() < 0.5 ? y - 2 - Math.random() * 9 : y + h + 1 + Math.random() * 9;
      } else {                                                // left/right bands
        px = Math.random() < 0.5 ? x - 2 - Math.random() * 9 : x + w + 1 + Math.random() * 9;
        py = y + Math.random() * h;
      }
      ctx.fillStyle = Math.random() < 0.4 ? PAL.white : rampColor((px - x) / w);
      const s = 1 + (Math.random() * 2 | 0);
      ctx.fillRect(px | 0, py | 0, s, s);
    }
    // jagged bolts arcing off the top/bottom edges
    const bolts = Math.floor(q * 5);
    for (let i = 0; i < bolts; i++) {
      const top = Math.random() < 0.5;
      let px = x + Math.random() * w, py = top ? y : y + h;
      const dir = top ? -1 : 1;
      const steps = 5 + (Math.random() * 5 | 0);
      for (let s = 0; s < steps; s++) {
        ctx.fillStyle = Math.random() < 0.45 ? PAL.white : rampColor((px - x) / w);
        const sz = 1 + (Math.random() * 1.7 | 0);
        ctx.fillRect(px | 0, py | 0, sz, sz);
        px += Math.random() * 6 - 3;
        py += dir * (1.5 + Math.random() * 3);
      }
    }
  }

  // Always-on controls cards in the bottom corners. SOLO shows one hint; HOTSEAT
  // shows a clean, color-coded reference so both players can always see their keys:
  // P1 on the left (blue, like the HP HUD), P2 on the right (orange) — the numpad
  // cluster. Rows are [key, action] so they render as two aligned columns.
  _controls(game, ctx) {
    if (this.m.mode !== 'pvp') {
      // Solo story: player one uses the SAME left-hand kit as hotseat fighter 1
      // (Z/C dodge, X duck) — the arrows still work too (shared bindings), but the
      // card mirrors the hotseat P1 reference so the two modes read identically.
      this._ctrlBox(game, ctx, 6, 'CONTROLS', PAL.blueLite,
        [['A/D', 'JAB'], ['Q/E', 'HOOK'], ['Z/C', 'DODGE'], ['X', 'DUCK'], ['S', 'BLK/PARRY'], ['SPACE', 'GET UP']]);
      return;
    }
    // P1 (left player): left-hand cluster, Z/X/C dodge/duck so they stay left.
    this._ctrlBox(game, ctx, 6, 'P1', PAL.blueLite,
      [['A/D', 'JAB'], ['Q/E', 'HOOK'], ['Z/C', 'DODGE'], ['X', 'DUCK'], ['S', 'BLK/PARRY'], ['SPACE', 'GET UP']]);
    // P2 (right player): mirrored numpad cluster (N = numpad); + = get up.
    // Hotseat only — online players each control their own side from one keyboard,
    // so the P2 numpad card is irrelevant on the remote client.
    if (!this.m.net) {
      this._ctrlBox(game, ctx, game.W - 94, 'P2', PAL.orangeLite,
        [['N4/6', 'JAB'], ['N7/9', 'HOOK'], ['N1/3', 'DODGE'], ['N2', 'DUCK'], ['N5', 'BLK/PARRY'], ['N +', 'GET UP']]);
    }
  }

  // a clean controls card: an accent-colored title bar (P1 blue / P2 orange),
  // then key|action rows in two aligned columns (key tinted, action dimmed).
  _ctrlBox(game, ctx, x, title, accent, rows) {
    const lh = 11, padX = 6, headH = 10, w = 92;
    const h = headH + 4 + rows.length * lh + 4;
    const y = game.H - h - 4;
    // plate + accent frame
    ctx.fillStyle = 'rgba(7,10,22,0.66)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // title bar (label reads dark over the bright accent)
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, w, headH);
    text(ctx, title, x + padX, y + 2, { scale: 1, color: PAL.ink });
    // key (accent) + action (dim) columns
    rows.forEach(([key, act], i) => {
      const ry = y + headH + 4 + i * lh;
      text(ctx, key, x + padX, ry, { scale: 1, color: accent });
      text(ctx, act, x + padX + 30, ry, { scale: 1, color: PAL.textDim });
    });
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
      const special = this.m.opponent.boxing?.special?.name || DEFAULT_PARAMS.signature.name;
      text(ctx, 'CHESS ' + this.m.opponent.elo + '   SPECIAL: ' + special, x + 12, y + 32, { scale: 1, color: PAL.orangeLite });
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

// blend a #rrggbb color toward white by t (0..1) — used for the special-windup
// "flare" flicker so an opponent flashes a brightened version of their theme.
function lighten(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => Math.round(v + (255 - v) * t);
  return '#' + ((1 << 24) + (m(r) << 16) + (m(g) << 8) + m(b)).toString(16).slice(1);
}

// Map a BoxingMatch fighter's sim state to a fighter.js render pose + info.
// This is where jab finally renders differently from hook, and where a boss
// SPECIAL / signature wind-up shows the fighter's unique special pose.
function mapPose(fr) {
  const p = fr.pose;
  const info = { arm: fr.arm || 'R', kind: fr.kind || 'jab', target: fr.target || 'high' };
  if (p === 'windup') return (fr.special || fr.kind === 'signature') ? { pose: 'special' } : { pose: 'windup', info };
  if (p === 'punch')  return { pose: 'punch', info };
  if (p === 'stance') return { pose: 'special' };          // counter-stance boss move
  if (p === 'recover') return { pose: 'idle' };
  if (p === 'dodgeL' || p === 'dodgeR' || p === 'duck') return { pose: 'duck' };
  if (p === 'hurt')  return { pose: 'hurt' };
  if (p === 'stun')  return { pose: 'stagger' };
  if (p === 'down' || p === 'ko') return { pose: 'down' };
  if (p === 'guard') return { pose: 'guard' };
  return { pose: 'idle' };
}
