// PAWNCH boxing — a Punch-Out-inspired duel sim.
//
// Loop of play: the opponent TELEGRAPHS an attack (a windup with a visible
// tell — side + HIGH/LOW target), you DODGE/DUCK/BLOCK in the window. A clean
// dodge leaves them open (recover) — punch them then for a COUNTER and earn a
// STAR. Spend a star on an uppercut for big damage. Jabs are fast/cheap, hooks
// slow/strong, and each opponent has a heavy SIGNATURE haymaker.
//
// Depth layers: STAMINA (drains on actions, regens idle, tired = weaker),
// HEAD/LOW targeting (duck beats high shots), and COMBO tracking.
//
// One side controls via player input; the other via AI (story) or a second
// input cluster / remote (multiplayer). Pure logic — the state drives drawing.

import { BOX } from './config.js';

function makeFighter(side) {
  return {
    side,                 // 'player' | 'enemy'
    hp: BOX.MAX_HP,
    stamina: 100,
    pose: 'idle',         // idle|guard|windup|punch|recover|dodgeL|dodgeR|duck|hurt|down|ko
    poseT: 0,             // ms remaining in transient pose
    arm: null,            // 'L' | 'R'
    kind: null,           // 'jab' | 'hook' | 'star' | 'signature'
    target: 'high',       // 'high' | 'low' (where an attack is aimed)
    stars: 0,
    flash: 0,             // hit flash timer
    starFx: 0,            // star-punch glow timer
    offset: 0,            // lateral lean (dodge) for render
    duckY: 0,
    downCount: 0,
    combo: 0, comboTimer: 0,
    landedThisWindup: false,
  };
}

export class BoxingMatch {
  // opts: { mode, enemyParams, onKO, onTime, startHP, hooks, send, inbox, seconds }
  constructor(opts) {
    this.opts = opts;
    this.player = makeFighter('player');
    this.enemy = makeFighter('enemy');
    if (opts.startHP) {
      this.player.hp = opts.startHP.player;
      this.enemy.hp = opts.startHP.enemy;
    }
    this.params = opts.enemyParams;
    this.timeLeft = (opts.seconds ?? 60) * 1000;
    this.over = false;
    this.result = null;
    this.maxCombo = 0;
    this.ai = { state: 'wait', t: rand(600, 1400), feint: false };
    this.hitHooks = opts.hooks || {};

    // online relay (beta): each client owns its OWN fighter's HP.
    this.isNet = !!opts.send;
    this.send = opts.send || (() => {});
    this.inbox = opts.inbox || null;
  }

  // ---- public update ---------------------------------------------------
  update(dt, controls) {
    if (this.over) return;
    this.timeLeft -= dt;
    this._tickFighter(this.player, dt);
    this._tickFighter(this.enemy, dt);

    if (this.isNet && this.inbox) this._processRemoteBox();

    if (this.player.pose !== 'down' && this.enemy.pose !== 'down') {
      this._handlePlayer(controls, dt);
      if (this.isNet) { /* enemy driven by relayed actions */ }
      else if (this.opts.mode === 'pvp') this._handlePlayer2(controls, dt);
      else this._enemyAI(dt);
    }

    this._checkKO();
    if (!this.over && this.timeLeft <= 0) { this.over = true; this.result = null; this.opts.onTime?.(); }
  }

  // ---- fighter timers --------------------------------------------------
  _tickFighter(fr, dt) {
    if (fr.flash > 0) fr.flash -= dt;
    if (fr.starFx > 0) fr.starFx -= dt;
    if (fr.comboTimer > 0) { fr.comboTimer -= dt; if (fr.comboTimer <= 0) fr.combo = 0; }

    if (fr.poseT > 0) {
      fr.poseT -= dt;
      if (fr.pose === 'dodgeL') fr.offset = -14;
      else if (fr.pose === 'dodgeR') fr.offset = 14;
      else if (fr.pose === 'duck') fr.duckY = 14;
      if (fr.poseT <= 0) this._resolvePose(fr);
    } else {
      fr.offset *= 0.7; fr.duckY *= 0.7;
    }

    // stamina regen when not committed to an action
    if (fr.pose === 'idle' || fr.pose === 'guard') fr.stamina = Math.min(100, fr.stamina + dt * 0.022);

    if (fr.pose === 'down') {
      fr.downCount += dt / 1000;
      if (fr.downCount >= BOX.GET_UP_COUNT) this._finishKO(fr);
    }
  }

  _resolvePose(fr) {
    const prev = fr.pose;
    if (prev === 'windup') {
      this._strike(fr);
      fr.pose = 'recover';
      fr.poseT = this._recoverMs(fr);
    } else if (prev === 'punch') {
      fr.pose = 'recover';
      fr.poseT = this._recoverMs(fr);
    } else {
      fr.pose = 'idle'; fr.arm = null; fr.kind = null;
    }
  }
  _recoverMs(fr) {
    const base = fr.side === 'enemy' ? this.params.recoverMs : BOX.PLAYER_RECOVER;
    return base * (fr.stamina < 30 ? 1.5 : 1); // tired = slower to recover
  }

  // ---- player offense / defense ---------------------------------------
  _handlePlayer(c, dt) {
    const p = this.player;
    if (this._busy(p)) return;
    if (c.pressed('dodgeL')) return this._dodge(p, 'L');
    if (c.pressed('dodgeR')) return this._dodge(p, 'R');
    if (c.pressed('duck')) return this._duck(p);
    if (c.isDown('block')) { p.pose = 'guard'; } else if (p.pose === 'guard') p.pose = 'idle';
    if (c.pressed('hookL')) return this._playerPunch(p, this.enemy, 'L', 'hook');
    if (c.pressed('hookR')) return this._playerPunch(p, this.enemy, 'R', 'hook');
    if (c.pressed('jabL')) return this._playerPunch(p, this.enemy, 'L', 'jab');
    if (c.pressed('jabR')) return this._playerPunch(p, this.enemy, 'R', 'jab');
  }
  _handlePlayer2(c, dt) {
    const p = this.enemy;
    if (this._busy(p)) return;
    if (c.pressed('p2_dodgeL')) return this._dodge(p, 'L');
    if (c.pressed('p2_dodgeR')) return this._dodge(p, 'R');
    if (c.pressed('p2_duck')) return this._duck(p);
    if (c.isDown('p2_block')) { p.pose = 'guard'; } else if (p.pose === 'guard') p.pose = 'idle';
    if (c.pressed('p2_hookL')) return this._playerPunch(p, this.player, 'L', 'hook');
    if (c.pressed('p2_hookR')) return this._playerPunch(p, this.player, 'R', 'hook');
    if (c.pressed('p2_jabL')) return this._playerPunch(p, this.player, 'L', 'jab');
    if (c.pressed('p2_jabR')) return this._playerPunch(p, this.player, 'R', 'jab');
  }

  _dodge(fr, side) {
    fr.pose = side === 'L' ? 'dodgeL' : 'dodgeR';
    fr.poseT = BOX.DODGE_TIME;
    this._drain(fr, 9);
    this.hitHooks.onDodge?.(fr.side);
    if (this.isNet && fr.side === 'player') this.send({ k: 'pose', pose: fr.pose });
  }
  _duck(fr) {
    fr.pose = 'duck'; fr.poseT = BOX.DUCK_TIME; this._drain(fr, 9);
    this.hitHooks.onDodge?.(fr.side);
    if (this.isNet && fr.side === 'player') this.send({ k: 'pose', pose: 'duck' });
  }

  _playerPunch(att, def, arm, kind) {
    // star punch: spend a star with a hook input while you have one
    if (kind === 'hook' && att.stars > 0) { kind = 'star'; att.stars--; att.starFx = 320; this.hitHooks.onStar?.(att.side); }
    att.pose = 'punch'; att.arm = arm; att.kind = kind;
    att.target = kind === 'jab' ? 'low' : 'high'; // jabs body, hooks/uppercuts head
    att.poseT = kind === 'jab' ? BOX.PLAYER_JAB_WINDUP : BOX.PLAYER_HOOK_WINDUP;
    att.landedThisWindup = false;
    this._drain(att, kind === 'jab' ? 7 : kind === 'hook' ? 14 : 0);
    this.hitHooks.onPunch?.(att.side, kind);
    if (this.isNet && att.side === 'player') { this.send({ k: 'punch', arm, kind }); return; }
    setTimeoutContact(this, att, def, kind);
  }

  _playerContact(att, def, kind) {
    if (att.landedThisWindup) return;
    att.landedThisWindup = true;
    const avoided = this._defended(att, def);
    if (avoided === 'dodge') { this.hitHooks.onMiss?.(att.side); return; }
    const counter = def.pose === 'recover';
    let dmg = kind === 'jab' ? BOX.PLAYER_JAB_DMG : kind === 'hook' ? BOX.PLAYER_HOOK_DMG : BOX.STAR_DMG;
    dmg *= staminaMult(att);
    if (avoided === 'block') dmg *= (1 - BOX.BLOCK_REDUCTION);
    if (counter) { dmg *= 1.6; att.stars = Math.min(3, att.stars + 1); this.hitHooks.onCounter?.(att.side); }
    this._applyDamage(def, dmg, att);
  }

  // ---- enemy AI --------------------------------------------------------
  _enemyAI(dt) {
    const e = this.enemy, P = this.params;
    if (this._busy(e)) return;
    this.ai.t -= dt;
    if (this.ai.t > 0) return;

    // reactive slip when the player commits to a punch
    if (this.player.pose === 'punch' && Math.random() < P.dodgeSkill) {
      this._dodge(e, Math.random() < 0.5 ? 'L' : 'R');
      this.ai.t = rand(300, 600);
      return;
    }
    if (Math.random() < P.aggression) {
      const arm = Math.random() < 0.5 ? 'L' : 'R';
      const high = Math.random() < P.highChance;
      e.arm = arm; e.target = high ? 'high' : 'low'; e.pose = 'windup';
      this._drain(e, 8);
      if (Math.random() < P.signature.chance) {
        e.kind = 'signature'; e.poseT = P.signature.telegraphMs; this.ai.feint = false;
      } else {
        e.kind = Math.random() < 0.35 ? 'hook' : 'jab';
        e.poseT = P.telegraphMs * (e.kind === 'hook' ? 1.25 : 1);
        this.ai.feint = Math.random() < P.feintChance;
      }
      this.hitHooks.onWindup?.(arm, e.kind, e.target);
      this.ai.t = rand(400, 900);
    } else {
      e.pose = Math.random() < P.guardChance ? 'guard' : 'idle';
      this.ai.t = rand(500, 1200);
    }
  }

  _strike(att) {
    const def = att.side === 'enemy' ? this.player : this.enemy;
    if (att.side === 'enemy' && this.ai.feint) { this.ai.feint = false; return; }
    const avoided = this._defended(att, def);
    if (avoided === 'dodge') { this.hitHooks.onDodge?.(def.side); return; }
    let dmg = att.kind === 'signature' ? this.params.signature.dmg
            : att.kind === 'hook' ? this.params.punchDmg * 1.4
            : this.params.punchDmg;
    dmg *= staminaMult(att);
    if (avoided === 'block') dmg *= (1 - BOX.BLOCK_REDUCTION);
    this._applyDamage(def, dmg, att);
  }

  // returns 'dodge' (fully avoided), 'block' (reduced), or null (clean hit)
  _defended(att, def) {
    const correctDodge =
      (att.arm === 'L' && def.pose === 'dodgeR') || (att.arm === 'R' && def.pose === 'dodgeL');
    const jabLeniency = att.kind === 'jab' && (def.pose === 'dodgeL' || def.pose === 'dodgeR');
    const duckBeatsHigh = def.pose === 'duck' && att.target === 'high';
    if (correctDodge || jabLeniency || duckBeatsHigh) return 'dodge';
    if (def.pose === 'guard') return 'block';
    return null;
  }

  _applyDamage(def, dmg, att) {
    dmg = Math.max(1, Math.round(dmg));
    def.hp = Math.max(0, def.hp - dmg);
    def.flash = 140;
    if (def.pose !== 'guard') { def.pose = 'hurt'; def.poseT = 220; }
    const attacker = att.side === 'player' ? this.player : att.side === 'enemy' ? this.enemy : null;
    if (attacker) this._registerHit(attacker);
    this.hitHooks.onHit?.(def.side, dmg, att.kind);
  }

  _registerHit(attacker) {
    attacker.combo = attacker.comboTimer > 0 ? attacker.combo + 1 : 1;
    attacker.comboTimer = 1600;
    this.maxCombo = Math.max(this.maxCombo, attacker.combo);
    if (attacker.combo >= 2) this.hitHooks.onCombo?.(attacker.side, attacker.combo);
  }

  _drain(fr, amt) { fr.stamina = Math.max(0, fr.stamina - amt); }

  // ---- online relay ----------------------------------------------------
  _processRemoteBox() {
    while (this.inbox.length) {
      const a = this.inbox.shift();
      if (a.k === 'pose') {
        this.enemy.pose = a.pose; this.enemy.poseT = a.pose === 'duck' ? BOX.DUCK_TIME : BOX.DODGE_TIME;
      } else if (a.k === 'punch') {
        this.enemy.pose = 'punch'; this.enemy.arm = a.arm; this.enemy.kind = a.kind; this.enemy.poseT = 200;
        const def = this.player;
        const avoided = this._defended({ arm: a.arm, kind: a.kind, target: a.kind === 'jab' ? 'low' : 'high' }, def);
        if (avoided === 'dodge') { this.hitHooks.onDodge?.('player'); }
        else {
          let dmg = a.kind === 'jab' ? 7 : a.kind === 'hook' ? 13 : 22;
          if (avoided === 'block') dmg *= (1 - BOX.BLOCK_REDUCTION);
          this._applyDamage(def, dmg, { side: 'enemy', kind: a.kind });
          this.send({ k: 'hp', hp: this.player.hp });
        }
      } else if (a.k === 'hp') {
        this.enemy.hp = a.hp;
      } else if (a.k === 'ko') {
        if (!this.over) { this.over = true; this.result = 'player'; this.hitHooks.onKO?.('player'); this.opts.onKO?.('player'); }
      }
    }
  }

  _busy(fr) {
    return ['windup', 'punch', 'recover', 'dodgeL', 'dodgeR', 'duck', 'hurt', 'down', 'ko'].includes(fr.pose) && fr.poseT > 0;
  }

  _checkKO() {
    for (const fr of [this.player, this.enemy]) {
      if (fr.hp <= 0 && fr.pose !== 'down' && fr.pose !== 'ko') {
        fr.pose = 'down'; fr.poseT = 0; fr.downCount = 0;
        this.hitHooks.onKnockdown?.(fr.side);
      }
    }
  }
  _finishKO(fr) {
    if (this.over) return;
    fr.pose = 'ko';
    if (this.isNet && fr.side === 'player') this.send({ k: 'ko' });
    this.over = true;
    this.result = fr.side === 'player' ? 'enemy' : 'player';
    this.hitHooks.onKO?.(this.result);
    this.opts.onKO?.(this.result);
  }
}

function rand(a, b) { return a + Math.random() * (b - a); }
function staminaMult(fr) { return fr.stamina < 25 ? 0.55 : fr.stamina < 50 ? 0.8 : 1; }

function setTimeoutContact(match, att, def, kind) {
  const delay = kind === 'jab' ? 60 : 140;
  setTimeout(() => { if (!match.over) match._playerContact(att, def, kind); }, delay);
}
