// Staged boxing tutorial: wraps the real BoxingMatch with a harmless dummy and
// teaches one skill at a time (jab -> hook -> block -> dodge -> parry -> free
// spar) via freeze-frame windows. Self-contained — no rounds/HP-carry/resolve.

import { PAL, BOX, TUTORIAL, FIGHTER } from '../config.js';
import { text, ring } from '../gfx.js';
import { drawFighter } from '../fighter.js';
import { drawScene, sceneFor } from '../scenery.js';
import * as audio from '../audio.js';
import { BoxingMatch } from '../sim/box.js';
import { HERO_LOOK, DEFAULT_LOOK, HUE } from '../opponents.js';
import { TeachSequence } from '../teach.js';

const LESSONS = [
  { teach: { title: 'THE FIGHT', lines: ['Your opponent telegraphs every attack.', 'READ the tell, react, then punish.', 'This robot is a harmless sparring dummy.'] }, await: null, setup: null },
  { teach: { title: 'JAB', lines: ['Tap A or D for a quick jab to the body —', 'fast, low damage. Throw a jab now.'] }, await: 'jab', setup: null },
  { teach: { title: 'HOOK', lines: ['Tap Q or E for a hook to the head —', 'slower, but it hits much harder.', 'Throw a hook.'] }, await: 'hook', setup: null },
  { teach: { title: 'BLOCK', lines: ['Hold S to raise your guard — it chips', 'most of the damage. The robot will jab;', 'hold S to block it.'] }, await: 'block', setup: 'aggro' },
  { teach: { title: 'DODGE', lines: ['Tap Z / C to slip left or right, X to', 'duck a high shot. A dodge avoids ALL', 'damage. Slip the next punch.'] }, await: 'dodge', setup: 'aggro' },
  { teach: { title: 'THE PERFECT PARRY', lines: ['The key skill. RAISE guard (S) the instant', 'the punch lands — not early, not held.', 'Watch the glove flash + HIGH/LOW tell.', 'Parry a punch!'] }, await: 'parry', setup: 'aggro' },
  { teach: { title: "YOU'RE READY", lines: ['Spar freely — try a STAR punch (a hook', 'after a parry earns you a star).', 'Press ESC when you are done.'] }, await: null, setup: 'free' },
];

const HP_FLOOR = 15;   // tutorial safety: neither fighter can be KO'd (a KO would freeze the lesson flow)

export class TutorialBoxState {
  enter(game) {
    this.game = game; this.t = 0; this.li = 0;
    this.flags = { jab: false, hook: false, block: false, dodge: false, parry: false };
    this.clearFx = 0;
    this.enemyLook = DEFAULT_LOOK; this.playerLook = HERO_LOOK;
    this.accent = HUE.green.body;
    this.sceneId = sceneFor({ mode: 'pvp' }, game.save);
    this.phase = 'teach';                 // teach | await | free
    this.teach = new TeachSequence();
    this.match = new BoxingMatch({
      mode: 'story',
      enemyParams: TUTORIAL.DUMMY,
      seconds: 99999,                     // no time pressure
      seed: Math.floor(Math.random() * 0x100000000),
      hooks: {
        onPunch: (side, kind) => { if (side === 'player') { if (kind === 'jab') this.flags.jab = true; else this.flags.hook = true; (kind === 'jab' ? audio.sfx.jab() : audio.sfx.hook()); } },
        onBlock: (side) => { if (side === 'player') this.flags.block = true; },
        onDodge: (side) => { if (side === 'player') { this.flags.dodge = true; audio.sfx.dodge(); } },
        onParry: (side) => { if (side === 'player') { this.flags.parry = true; audio.sfx.parry(); game.fx.doFlash(PAL.blueLite, 0.4); game.doFreeze(120); game.fx.burst(game.W / 2, game.H - 130, PAL.gold, 16, 3); } },
        onHit: (side, dmg) => { audio.sfx.hit(); const x = game.W / 2, y = side === 'player' ? game.H - 130 : 200; game.fx.burst(x, y, side === 'player' ? PAL.red : PAL.gold, 11, 3); game.doFreeze(28); this.match.player.hp = Math.max(this.match.player.hp, HP_FLOOR); this.match.enemy.hp = Math.max(this.match.enemy.hp, HP_FLOOR); },
      },
      onKO: () => {},                     // no stakes
      onTime: () => {},
    });
    audio.playFightTheme(0);
    this._beginLesson();
  }

  _beginLesson() {
    const L = LESSONS[this.li];
    if (!L) { this.game.changeState('tutorial'); return; }
    this.flags.jab = this.flags.hook = this.flags.block = this.flags.dodge = this.flags.parry = false;
    this.teach.queue([L.teach]);
    this.phase = 'teach';
  }

  _startPractice() {
    const L = LESSONS[this.li];
    // feed readable attacks during read-and-react lessons; otherwise stay docile.
    this.match.params = (L.setup === 'aggro' || L.setup === 'free')
      ? { ...TUTORIAL.DUMMY, aggression: TUTORIAL.PRACTICE_AGGRESSION }
      : TUTORIAL.DUMMY;
    if (L.setup === 'free') { this.phase = 'free'; return; }
    if (L.await) { this.phase = 'await'; return; }
    this.li++; this._beginLesson();       // intro: nothing to demonstrate
  }

  update(game, dt) {
    this.t += dt / 1000;
    if (this.clearFx > 0) this.clearFx -= dt;
    audio.playFightTheme(0);

    if (game.input.pressed('cancel')) { audio.sfx.select(); game.changeState('tutorial'); return; }

    if (this.teach.active) {              // frozen while a window shows
      if (this.teach.update(game, dt)) this._startPractice();
      return;
    }

    this.match.update(dt, game.input);
    // safety floor: the dummy can never down the player, and the player can never
    // end the tutorial by KO'ing the dummy — keeps the session purely lesson-driven.
    this.match.player.hp = Math.max(this.match.player.hp, HP_FLOOR);
    this.match.enemy.hp = Math.max(this.match.enemy.hp, HP_FLOOR);

    if (this.phase === 'await') {
      const L = LESSONS[this.li];
      if (this.flags[L.await]) { this.clearFx = 900; audio.sfx.confirm(); this.li++; this._beginLesson(); }
    }
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    drawScene(ctx, this.sceneId, { W, floorTop: 170, t: this.t, crowd: 0, accent: this.accent });
    ring(ctx, W, H, { floorTop: 170, accent: this.accent, crowd: 0 });
    const p = this.match.player, e = this.match.enemy;
    const em = mapPose(e);
    drawFighter(ctx, W / 2 + e.offset, FIGHTER.ENEMY_FEET_Y, FIGHTER.SIZE.enemy, this.enemyLook, em.pose, 1, this.t * 4, em.info);
    if (e.pose === 'windup') this._tell(ctx, e);
    const pm = mapPose(p);
    drawFighter(ctx, W / 2 + p.offset, FIGHTER.PLAYER_FEET_Y, FIGHTER.SIZE.player, this.playerLook, pm.pose, -1, this.t * 4, pm.info);

    this._bar(ctx, 14, 18, W - 28, e.hp / BOX.MAX_HP, PAL.orange);
    this._bar(ctx, 14, 30, W - 28, p.hp / BOX.MAX_HP, PAL.blue);

    const L = LESSONS[this.li];
    if (this.phase === 'await' && L && L.await) text(ctx, this._objective(L.await), W / 2, 52, { scale: 1, color: PAL.gold, align: 'center', shadow: PAL.ink });
    if (this.phase === 'free') text(ctx, 'FREE SPAR  -  ESC WHEN DONE', W / 2, 52, { scale: 1, color: PAL.green, align: 'center', shadow: PAL.ink });
    if (this.clearFx > 0) { ctx.globalAlpha = Math.min(1, this.clearFx / 300); text(ctx, 'NICE!', W / 2, H / 2 - 40, { scale: 4, color: PAL.green, align: 'center', shadow: PAL.ink }); ctx.globalAlpha = 1; }
    text(ctx, 'A/D JAB   Q/E HOOK   S BLOCK/PARRY   Z/C/X DODGE', W / 2, H - 18, { scale: 1, color: PAL.textDim, align: 'center' });
    this.teach.draw(game, ctx);
  }

  _objective(k) {
    return { jab: 'THROW A JAB (A/D)', hook: 'THROW A HOOK (Q/E)', block: 'BLOCK IT — HOLD S', dodge: 'DODGE — Z / C / X', parry: 'PARRY! TAP S AS IT LANDS' }[k] || '';
  }
  _bar(ctx, x, y, w, pct, col) {
    ctx.fillStyle = PAL.ink; ctx.fillRect(x - 1, y - 1, w + 2, 9);
    ctx.fillStyle = '#10162e'; ctx.fillRect(x, y, w, 7);
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, pct))), 7);
  }
  _tell(ctx, e) {
    const arrow = e.arm === 'L' ? '>' : '<';
    const col = e.kind === 'hook' ? PAL.orange : PAL.blueLite;
    text(ctx, arrow + ' ' + (e.target === 'high' ? 'HIGH' : 'LOW'), 18, 100, { scale: 2, color: col, shadow: PAL.ink });
  }
}

// Map a BoxingMatch fighter's sim pose to a fighter.js render pose + info
// (local copy of the mapping used by the real boxing state; keeps this state
// self-contained).
function mapPose(fr) {
  const p = fr.pose;
  const info = { arm: fr.arm || 'R', kind: fr.kind || 'jab', target: fr.target || 'high' };
  if (p === 'windup') return (fr.special || fr.kind === 'signature') ? { pose: 'special' } : { pose: 'windup', info };
  if (p === 'punch') return { pose: 'punch', info };
  if (p === 'stance') return { pose: 'special' };
  if (p === 'recover') return { pose: 'idle' };
  if (p === 'dodgeL' || p === 'dodgeR' || p === 'duck') return { pose: 'duck' };
  if (p === 'hurt') return { pose: 'hurt' };
  if (p === 'stun') return { pose: 'stagger' };
  if (p === 'down' || p === 'ko') return { pose: 'down' };
  if (p === 'guard') return { pose: 'guard' };
  return { pose: 'idle' };
}
