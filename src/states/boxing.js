// Boxing half: renders the ring + both fighters and drives the BoxingMatch
// sim. KO = decisive (win the whole match). Time out = round continues.
//
// Shows: per-opponent ring backdrop, a sliding intro nameplate, HP + stamina
// bars, the star count, a combo counter, an attack TELL during enemy windups
// (side + HIGH/LOW + a SIGNATURE warning), and hit-stop/crowd juice.

import { MATCH, PAL, BOX } from '../config.js';
import { text, panel, ring, boxer, barH } from '../gfx.js';
import * as audio from '../audio.js';
import { BoxingMatch, DEFAULT_PARAMS } from '../boxing.js';
import { OPPONENTS, HUE } from '../opponents.js';
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

    // STORY uses the opponent's tuned boxing kit; PVP/online use the default.
    // Guard the story path: a malformed or older saved opponent can lack `boxing`
    // (the sim also defaults internally, but this keeps the nameplate sane too).
    const params = (m.mode === 'story' && m.opponent?.boxing) ? m.opponent.boxing : DEFAULT_PARAMS;
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

    // the ref's count + the mash-to-rise power bar on a downed fighter
    for (const fr of [p, e]) {
      if (fr.pose === 'down') this._getUpMeter(game, ctx, fr);
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
  _getUpMeter(game, ctx, fr) {
    const W = game.W, H = game.H, cx = W / 2, cy = H / 2;
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
      this._ctrlBox(game, ctx, 6, 'CONTROLS', PAL.blueLite,
        [['A/D', 'JAB'], ['Q/E', 'HOOK'], ['< >', 'DODGE'], ['v', 'DUCK'], ['S', 'GUARD'], ['SPACE', 'GET UP']]);
      return;
    }
    // P1 (left player): left-hand cluster, Z/X/C dodge/duck so they stay left.
    this._ctrlBox(game, ctx, 6, 'P1', PAL.blueLite,
      [['A/D', 'JAB'], ['Q/E', 'HOOK'], ['Z/C', 'DODGE'], ['X', 'DUCK'], ['S', 'GUARD'], ['SPACE', 'GET UP']]);
    // P2 (right player): mirrored numpad cluster (N = numpad); + = get up.
    this._ctrlBox(game, ctx, game.W - 92, 'P2', PAL.orangeLite,
      [['N4/6', 'JAB'], ['N7/9', 'HOOK'], ['N1/3', 'DODGE'], ['N2', 'DUCK'], ['N5', 'GUARD'], ['N +', 'GET UP']]);
  }

  // a clean controls card: an accent-colored title bar (P1 blue / P2 orange),
  // then key|action rows in two aligned columns (key tinted, action dimmed).
  _ctrlBox(game, ctx, x, title, accent, rows) {
    const lh = 11, padX = 6, headH = 10, w = 88;
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
