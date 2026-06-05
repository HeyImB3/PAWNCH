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

// Fallback enemy AI params. Used for PVP / online enemies (which have no story
// difficulty curve) and as a safety net whenever a match is built without valid
// `enemyParams` — e.g. a malformed or older saved STORY opponent missing its
// `boxing` block. Without this the AI would read `undefined.aggression` in
// `_enemyAI` and throw every single frame.
export const DEFAULT_PARAMS = {
  telegraphMs: 600, recoverMs: 400, aggression: 0.4, comboChance: 0.3,
  dodgeSkill: 0.3, guardChance: 0.3, punchDmg: 12, feintChance: 0.2,
  highChance: 0.5, signature: { name: 'HAYMAKER', dmg: 24, telegraphMs: 750, chance: 0.08 },
};

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
    special: null,        // name of the boss SPECIAL currently winding up (for tell/render)
    unblockable: false,   // current attack ignores guard (must be slipped/ducked)
    dmgOverride: null,    // per-attack damage (specials), else null = use kind defaults
    recoverOverride: null,// per-attack recover window (specials), else null = default
    stars: 0,
    flash: 0,             // hit flash timer
    starFx: 0,            // star-punch glow timer
    offset: 0,            // lateral lean (dodge) for render
    duckY: 0,
    downCount: 0,         // seconds elapsed in the current count (resets each knockdown)
    knockdowns: 0,        // how many times this fighter has hit the canvas (best-of-3)
    getUpCharge: 0,       // 0..1 get-up power bar (mash to fill before the count ends)
    getUpTapFx: 0,        // brief pop animation timer on each mash (ms)
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
    this.params = opts.enemyParams || DEFAULT_PARAMS;  // never let the AI read undefined params
    this.timeLeft = (opts.seconds ?? 60) * 1000;
    this.over = false;
    this.result = null;
    this.maxCombo = 0;
    // seq = a queued boss SPECIAL (multi-step). specialCd gates how often the
    // boss move can fire, so it reads as a deliberate, learnable pattern.
    this.ai = { state: 'wait', t: rand(600, 1400), feint: false, seq: [], specialCd: 2600 };
    this.hitHooks = opts.hooks || {};

    // online relay (beta): each client owns its OWN fighter's HP.
    this.isNet = !!opts.send;
    this.send = opts.send || (() => {});
    this.inbox = opts.inbox || null;
  }

  // ---- public update ---------------------------------------------------
  update(dt, controls) {
    if (this.over) return;
    // get-up minigame: a downed human mashes BEFORE the tick advances the count,
    // so this frame's taps count toward beating it.
    this._handleGetUpInput(controls);
    this._tickFighter(this.player, dt);
    this._tickFighter(this.enemy, dt);

    // the round clock STOPS while anyone is on the canvas (the ref's count is
    // its own clock) — faithful to boxing and keeps 10s counts from eating the half.
    const counting = this.player.pose === 'down' || this.enemy.pose === 'down';
    if (!counting) this.timeLeft -= dt;

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
      if (fr.getUpTapFx > 0) fr.getUpTapFx -= dt;
      const idx = this._fallIdx(fr);
      // the CPU opponent claws its own way up (offline story).
      if (this._autoGetUp(fr)) fr.getUpCharge = Math.min(1, fr.getUpCharge + (BOX.GET_UP.AI_CHARGE_PER_SEC[idx] ?? 0.6) * dt / 1000);
      // rise the instant the bar is full — checked BEFORE decay so a tap that
      // tops it off this frame isn't immediately bled back under the line.
      if (fr.getUpCharge >= 1) { this._getUp(fr); return; }
      // otherwise the bar always bleeds — you must out-mash the decay to fill it.
      fr.getUpCharge = Math.max(0, fr.getUpCharge - (BOX.GET_UP.DECAY_PER_SEC[idx] ?? 0.3) * dt / 1000);
      if (fr.downCount >= BOX.GET_UP_COUNT) this._finishKO(fr); // counted out
    }
  }

  // online relay is first-to-zero (beta); offline uses best-of-3.
  _koThreshold() { return this.isNet ? 1 : BOX.KNOCKDOWNS_TO_KO; }
  // which difficulty step the current fall is on: 0 = 1st fall, 1 = 2nd fall.
  _fallIdx(fr) { return Math.min(Math.max(fr.knockdowns, 1), 2) - 1; }
  // true for a downed fighter the CPU controls (and so auto-charges its bar).
  _autoGetUp(fr) {
    if (this.isNet || this.opts.mode === 'pvp') return false; // remote/P2 down ends instantly or is human-mashed
    return fr.side === 'enemy';
  }

  // a downed human charges their own get-up bar by mashing: you (Space/confirm)
  // or, in hotseat, the downed P2 (their guard key). Each tap is one push.
  _handleGetUpInput(c) {
    const p = this.player;
    if (p.pose === 'down' && c.pressed('confirm')) this._chargeGetUp(p);
    if (this.opts.mode === 'pvp') {
      const e = this.enemy;
      if (e.pose === 'down' && (c.pressed('p2_block') || c.pressed('p2_jabL') || c.pressed('p2_jabR'))) this._chargeGetUp(e);
    }
  }
  _chargeGetUp(fr) {
    const add = BOX.GET_UP.CHARGE_PER_TAP[this._fallIdx(fr)] ?? 0.08;
    fr.getUpCharge = Math.min(1, fr.getUpCharge + add);
    fr.getUpTapFx = 140;
    this.hitHooks.onGetUpTap?.(fr.side, fr.getUpCharge);
  }

  // a fighter survives the count on a non-final knockdown: back to their feet
  // with a chunk of HP restored, ready to keep swinging.
  _getUp(fr) {
    fr.hp = Math.max(fr.hp, BOX.GET_UP_HP);
    fr.stamina = Math.max(fr.stamina, 60);
    fr.pose = 'idle'; fr.poseT = 0; fr.arm = null; fr.kind = null;
    fr.downCount = 0; fr.combo = 0; fr.comboTimer = 0;
    fr.getUpCharge = 0; fr.getUpTapFx = 0;
    this.hitHooks.onGetUp?.(fr.side, fr.knockdowns);
  }

  _resolvePose(fr) {
    const prev = fr.pose;
    if (prev === 'windup') {
      this._strike(fr);
      fr.pose = 'recover';
      fr.poseT = this._recoverMs(fr);
      fr.recoverOverride = null;         // consumed
    } else if (prev === 'punch') {
      fr.pose = 'recover';
      fr.poseT = this._recoverMs(fr);
      fr.recoverOverride = null;
    } else if (prev === 'stance') {
      fr.pose = 'idle';                  // held the stance; the follow-up is queued in seq
    } else {
      fr.pose = 'idle'; fr.arm = null; fr.kind = null;
      fr.special = null; fr.unblockable = false; fr.dmgOverride = null;
    }
  }
  _recoverMs(fr) {
    if (fr.recoverOverride != null) return fr.recoverOverride; // specials set their own opening
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
    // a counter-stance boss reads the punch and PUNISHES it — patience beats it.
    if (def.pose === 'stance') { this.hitHooks.onMiss?.(att.side); this._stancePunish(def, att); return; }
    const avoided = this._defended(att, def);
    if (avoided === 'dodge') { this.hitHooks.onMiss?.(att.side); return; }
    const counter = def.pose === 'recover';
    let dmg = kind === 'jab' ? BOX.PLAYER_JAB_DMG : kind === 'hook' ? BOX.PLAYER_HOOK_DMG : BOX.STAR_DMG;
    dmg *= staminaMult(att);
    if (avoided === 'block') dmg *= (1 - BOX.BLOCK_REDUCTION);
    if (counter) { dmg *= 1.6; att.stars = Math.min(3, att.stars + 1); this.hitHooks.onCounter?.(att.side); }
    this._applyDamage(def, dmg, att);
  }

  // the enemy was baited into a counter stance: parry the player's punch and
  // crack them for the special's damage. Spends the special (cancels the seq).
  _stancePunish(src, victim) {
    const dmg = this.params.special?.dmg ?? 18;
    this.ai.seq = [];
    src.pose = 'punch'; src.arm = src.arm || 'R'; src.kind = 'special'; src.poseT = 200;
    this._applyDamage(victim, dmg, { side: src.side, kind: 'special' });
    this.hitHooks.onCounter?.(src.side);
    this.ai.specialCd = this.params.special?.cooldownMs ?? 5000;
  }

  // ---- enemy AI --------------------------------------------------------
  _enemyAI(dt) {
    const e = this.enemy, P = this.params;
    if (this._busy(e)) return;
    this.ai.t -= dt;
    if (this.ai.specialCd > 0) this.ai.specialCd -= dt;

    // mid-special: fire the next queued step the instant the previous one's
    // recovery ends (the recover window IS the gap between hits).
    if (this.ai.seq.length) { this._enemyStep(this.ai.seq.shift()); return; }

    if (this.ai.t > 0) return;

    // reactive slip when the player commits to a punch
    if (this.player.pose === 'punch' && Math.random() < P.dodgeSkill) {
      this._dodge(e, Math.random() < 0.5 ? 'L' : 'R');
      this.ai.t = rand(280, 560);
      return;
    }
    if (Math.random() < P.aggression) {
      // boss SPECIAL — themed, off-cooldown, occasional: the move to learn.
      const sp = P.special;
      if (sp && this.ai.specialCd <= 0 && Math.random() < (sp.chance ?? 0.6)) {
        this.ai.seq = buildSpecial(sp);
        this.ai.specialCd = sp.cooldownMs ?? 5000;
        if (this.ai.seq.length) { this._enemyStep(this.ai.seq.shift()); return; }
      }
      // baseline attack
      const arm = Math.random() < 0.5 ? 'L' : 'R';
      const high = Math.random() < P.highChance;
      this._clearAtk(e);
      e.arm = arm; e.target = high ? 'high' : 'low'; e.pose = 'windup';
      this._drain(e, 8);
      if (Math.random() < P.signature.chance) {
        e.kind = 'signature'; e.poseT = P.signature.telegraphMs; this.ai.feint = false;
      } else {
        e.kind = Math.random() < 0.35 ? 'hook' : 'jab';
        e.poseT = P.telegraphMs * (e.kind === 'hook' ? 1.25 : 1);
        this.ai.feint = Math.random() < P.feintChance;
      }
      this.hitHooks.onWindup?.(arm, e.kind, e.target, null);
      this.ai.t = rand(380, 860);
    } else {
      e.pose = Math.random() < P.guardChance ? 'guard' : 'idle';
      this.ai.t = rand(480, 1150);
    }
  }

  // execute one step of a queued special (an attack, or a counter stance).
  _enemyStep(step) {
    const e = this.enemy;
    this._clearAtk(e);
    if (step.stance) {
      e.pose = 'stance'; e.poseT = step.durationMs; e.special = step.special;
      this.ai.feint = false;
      this.hitHooks.onWindup?.(null, 'stance', 'high', step.special);
    } else {
      e.pose = 'windup'; e.arm = step.arm; e.kind = step.kind; e.target = step.target;
      e.poseT = step.telegraphMs;
      e.special = step.special || null;
      e.unblockable = !!step.unblockable;
      e.dmgOverride = step.dmg != null ? step.dmg : null;
      e.recoverOverride = step.recover != null ? step.recover : null;
      this._drain(e, step.stamina ?? 7);
      this.ai.feint = !!step.feint;
      this.hitHooks.onWindup?.(step.arm, e.kind, e.target, e.special);
    }
    // pause AFTER the special resolves (ignored mid-seq, where the seq check runs first)
    this.ai.t = rand(560, 980);
  }

  _clearAtk(e) { e.special = null; e.unblockable = false; e.dmgOverride = null; e.recoverOverride = null; }

  _strike(att) {
    const def = att.side === 'enemy' ? this.player : this.enemy;
    if (att.side === 'enemy' && this.ai.feint) { this.ai.feint = false; this._clearAtk(att); return; }
    const avoided = this._defended(att, def);
    if (avoided === 'dodge') { this.hitHooks.onDodge?.(def.side); this._clearAtk(att); return; }
    let dmg = att.dmgOverride != null ? att.dmgOverride
            : att.kind === 'signature' ? this.params.signature.dmg
            : att.kind === 'hook' ? this.params.punchDmg * 1.4
            : this.params.punchDmg;
    dmg *= staminaMult(att);
    if (avoided === 'block') dmg *= (1 - BOX.BLOCK_REDUCTION);
    this._applyDamage(def, dmg, att);
    if (att.side === 'enemy') this._clearAtk(att);
  }

  // returns 'dodge' (fully avoided), 'block' (reduced), or null (clean hit)
  _defended(att, def) {
    const correctDodge =
      (att.arm === 'L' && def.pose === 'dodgeR') || (att.arm === 'R' && def.pose === 'dodgeL');
    const jabLeniency = att.kind === 'jab' && (def.pose === 'dodgeL' || def.pose === 'dodgeR');
    const duckBeatsHigh = def.pose === 'duck' && att.target === 'high';
    if (correctDodge || jabLeniency || duckBeatsHigh) return 'dodge';
    if (def.pose === 'guard' && !att.unblockable) return 'block'; // unblockables must be slipped
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
    return ['windup', 'punch', 'recover', 'dodgeL', 'dodgeR', 'duck', 'hurt', 'down', 'ko', 'stance'].includes(fr.pose) && fr.poseT > 0;
  }

  _checkKO() {
    for (const fr of [this.player, this.enemy]) {
      if (fr.hp <= 0 && fr.pose !== 'down' && fr.pose !== 'ko') {
        fr.knockdowns++;
        // the FINAL fall is an automatic TKO — straight to the canvas, no get-up
        // bar, no count. Earlier falls start the mash-to-rise minigame.
        if (fr.knockdowns >= this._koThreshold()) { this._finishKO(fr); continue; }
        fr.pose = 'down'; fr.poseT = 0; fr.downCount = 0; fr.getUpCharge = 0; fr.getUpTapFx = 0;
        this.hitHooks.onKnockdown?.(fr.side, fr.knockdowns);
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

// Translate an opponent's themed `special` definition into a sequence of attack
// steps. Each step is one telegraphed move; the player learns the pattern + its
// counter (the comments below). The final step carries a long `recover` = the
// punish window you earn for surviving it.
function buildSpecial(sp) {
  const A = () => (Math.random() < 0.5 ? 'L' : 'R');
  const t = sp.type;
  if (t === 'flurry') {
    // a rapid string of jabs — dodge/duck each hit in rhythm.
    const n = sp.hits || 3, steps = []; let arm = A();
    for (let i = 0; i < n; i++) {
      steps.push({ arm, target: Math.random() < 0.5 ? 'high' : 'low', kind: 'jab',
        telegraphMs: sp.telegraphMs, dmg: sp.dmg, special: sp.name, recover: i === n - 1 ? 520 : (sp.gapMs || 150) });
      arm = arm === 'L' ? 'R' : 'L';
    }
    return steps;
  }
  if (t === 'feint') {
    // fakes one side, then the real shot lands from the OTHER side, faster.
    const arm = A();
    return [
      { arm, target: 'high', kind: 'jab', telegraphMs: sp.telegraphMs, feint: true, special: sp.name, recover: 130 },
      { arm: arm === 'L' ? 'R' : 'L', target: 'high', kind: 'hook', telegraphMs: Math.round(sp.telegraphMs * 0.55), dmg: sp.dmg, special: sp.name, recover: 600 },
    ];
  }
  if (t === 'lowhigh') {
    // a two-target combo: defend the body shot, then the head shot (or reverse).
    const arm = A(), lowFirst = sp.lowFirst !== false;
    return [
      { arm, target: lowFirst ? 'low' : 'high', kind: 'jab', telegraphMs: sp.telegraphMs, dmg: Math.round(sp.dmg * 0.55), special: sp.name, recover: sp.gapMs || 160 },
      { arm, target: lowFirst ? 'high' : 'low', kind: 'hook', telegraphMs: Math.round(sp.telegraphMs * 0.7), dmg: sp.dmg, special: sp.name, recover: 560 },
    ];
  }
  if (t === 'charge') {
    // a long, ground-shaking wind-up — slip it for a huge free punish.
    return [{ arm: A(), target: 'high', kind: 'signature', telegraphMs: sp.telegraphMs, dmg: sp.dmg, special: sp.name, recover: 720 }];
  }
  if (t === 'unblockable') {
    // guard won't save you — you MUST slip or duck it.
    return [{ arm: A(), target: sp.target || 'high', kind: 'signature', telegraphMs: sp.telegraphMs, dmg: sp.dmg, unblockable: true, special: sp.name, recover: 640 }];
  }
  if (t === 'counterstance') {
    // reads you: punch during the stance and you eat a counter. Wait it out, then slip the crush.
    return [
      { stance: true, durationMs: sp.telegraphMs, special: sp.name },
      { arm: A(), target: 'high', kind: 'hook', telegraphMs: Math.round(sp.telegraphMs * 0.45), dmg: sp.dmg, special: sp.name, recover: 600 },
    ];
  }
  if (t === 'checkmate') {
    // the champion's finisher: a feint into an unblockable slam.
    const arm = A();
    return [
      { arm, target: 'high', kind: 'jab', telegraphMs: Math.round(sp.telegraphMs * 0.7), feint: true, special: sp.name, recover: 120 },
      { arm: arm === 'L' ? 'R' : 'L', target: 'high', kind: 'signature', telegraphMs: sp.telegraphMs, dmg: sp.dmg, unblockable: true, special: sp.name, recover: 680 },
    ];
  }
  return [];
}

function rand(a, b) { return a + Math.random() * (b - a); }
function staminaMult(fr) { return fr.stamina < 25 ? 0.55 : fr.stamina < 50 ? 0.8 : 1; }

function setTimeoutContact(match, att, def, kind) {
  const delay = kind === 'jab' ? 60 : 140;
  setTimeout(() => { if (!match.over) match._playerContact(att, def, kind); }, delay);
}
