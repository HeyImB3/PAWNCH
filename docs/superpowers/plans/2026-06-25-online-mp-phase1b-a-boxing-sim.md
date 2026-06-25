# Online Multiplayer — Phase 1B-A: Deterministic Boxing Sim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `src/sim/box.js` — a deterministic, seeded, serializable port of the Punch-Out-style boxing sim (`BoxingMatch`) — and prove it bit-identical across runs with headless tests, so it can later drive lockstep online play.

**Architecture:** Faithful port of `src/boxing.js` into `src/sim/box.js` with exactly three determinism changes and one removal: (1) a seeded PRNG (`src/sim/rng.js`) replaces every `Math.random`; (2) player-punch contact resolves via a per-fighter `contactT` tick countdown instead of `setTimeout`; (3) the sim advances on a caller-supplied fixed `dt` (the live game will pass `SIM.TICK_MS`); and the old first-to-zero online relay (`isNet`/`send`/`inbox`/`_processRemoteBox`) is removed (lockstep replaces it). A `snapshotBox()` exports the plain sim state for hashing. **This plan is purely additive** — it creates a new file and tests only; the live game keeps using `src/boxing.js`. Wiring `states/boxing.js` onto this sim happens in Phase 1B-C (with the loop-level fixed-step + input adapter).

**Tech Stack:** Vanilla JavaScript ES modules, no build step, no dependencies. Headless tests via macOS JavaScriptCore (`osascript`).

## Global Constraints

From `CLAUDE.md`, the design spec (`docs/superpowers/specs/2026-06-25-online-multiplayer-design.md`), and the Phase 1A carry-forward.

- **No build step, no dependencies, no framework.** Vanilla ES modules only.
- **No Node/npm on the dev machine.** Verification of record is headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` → `[TESTS] N passed, 0 failed`, non-zero exit on failure. The browser page (`tools/test/index.html`) is an optional human cross-check.
- **Sim import boundary:** a `src/sim/*` file may import only `../config.js` and sibling `src/sim/*` files (the headless runner can't resolve `gfx`/`audio`/DOM). `box.js` imports exactly `../config.js` (for `BOX`) and `./rng.js`.
- **Determinism:** no `Math.random`, `Date.now`, `performance.now`, `new Date()`, `setTimeout`, or wall-clock reliance inside `src/sim/box.js`. All randomness comes from the seeded rng held on the match. The sim advances by the `dt` the caller passes (fixed `SIM.TICK_MS` in lockstep).
- **Faithful port — no gameplay re-tuning.** Mechanics, constants (`BOX`), parry/AI/knockdown behavior, and damage numbers must match `src/boxing.js` exactly. The ONLY behavior change is removing the broken online relay path.
- **Headless concat names must be unique.** The headless runner concatenates every `*.test.js` into ONE eval scope, so top-level `const`/`let`/`class`/`function` names must not collide across test files. `clock.test.js` already declares `const TICK`; `box.test.js` must use `STEP_MS` instead, and its other top-level helper names (`viewFor`, `makeMatch`, `DUMMY`, `AGG`, `scriptedLog`, `runHashes`) are chosen to be unique.
- **Tune from `src/config.js`** (no new magic numbers beyond what the port faithfully carries from `boxing.js`).
- **Commits** end with the two standard trailers:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01W79S4wsgidziRj2QHrf5G1
  ```
- **Branch:** all work on `online-multiplayer` (create it from `main` if it doesn't exist: `git checkout -b online-multiplayer`).

## File Structure

- Create: `src/sim/box.js` — the deterministic boxing sim. Exports `BoxingMatch` (class), `DEFAULT_PARAMS` (object), `snapshotBox(match)` (plain-state serializer). Imports only `../config.js` + `./rng.js`.
- Create: `src/sim/box.test.js` — headless tests (smoke/correctness in Task 1, determinism in Task 2).
- Modify: `tools/test/index.html` — add the `box.test.js` import.
- Modify: `tools/test/run-headless.js` — add `'src/sim/box.js'` to `MODULES` (after `'src/sim/hash.js'`; it imports `hash`-free but the test imports `hashHex`, so `hash.js` must already be earlier — it is) and `'src/sim/box.test.js'` to `TESTS`.

**Interfaces (what later phases rely on):**
- `new BoxingMatch(opts)` where `opts = { mode:'story'|'pvp', enemyParams, onKO, onTime, startHP?, hooks?, seconds?, seed }`. `seed` (uint32) seeds the sim's rng.
- `match.update(dt, controls)` — advance one step by `dt` ms; `controls` is any object exposing `pressed(action)` and `isDown(action)`.
- Public sim fields used by the renderer/tests: `match.player`, `match.enemy` (fighter objects), `match.ai`, `match.timeLeft`, `match.over`, `match.result`, `match.maxCombo`, `match.rng`.
- `snapshotBox(match) -> plain object` (excludes `opts`/`hooks`; includes `rng`) for hashing and rollback.
- `DEFAULT_PARAMS` — the fallback enemy params (used for PvP and as an AI safety net).

---

### Task 1: Deterministic boxing sim + smoke/serialization tests

**Files:**
- Create: `src/sim/box.js`
- Create: `src/sim/box.test.js`
- Modify: `tools/test/index.html`, `tools/test/run-headless.js`

**Interfaces:**
- Consumes: `BOX` from `../config.js`; `newRng`, `rngFloat` from `./rng.js`; the test runner from `../../tools/test/runner.js`.
- Produces: `BoxingMatch`, `DEFAULT_PARAMS`, `snapshotBox` (see interface list above).

- [ ] **Step 1: Write the failing test**

Create `src/sim/box.test.js`:

```js
import { suite, test, assert, assertEqual } from '../../tools/test/runner.js';
import { BoxingMatch, DEFAULT_PARAMS, snapshotBox } from './box.js';

suite('box');

// NOTE: STEP_MS, not TICK — clock.test.js already declares `const TICK` at top
// level and the headless runner concatenates all test files into one scope.
const STEP_MS = 1000 / 60;
const viewFor = (fr = { p: [], h: [] }) => ({ pressed: (a) => fr.p.includes(a), isDown: (a) => fr.h.includes(a) });
const makeMatch = (seed, params) =>
  new BoxingMatch({ mode: 'story', enemyParams: params, seed, hooks: {}, onKO() {}, onTime() {}, seconds: 60 });
// an inert opponent: never attacks, dodges, parries, or guards — so a player punch lands cleanly.
const DUMMY = { ...DEFAULT_PARAMS, aggression: 0, dodgeSkill: 0, parrySkill: 0, guardChance: 0,
  signature: { name: 'x', dmg: 1, telegraphMs: 600, chance: 0 } };

test('constructs and advances the round clock (story)', () => {
  const m = makeMatch(1, DEFAULT_PARAMS);
  for (let t = 0; t < 120; t++) m.update(STEP_MS, viewFor());
  assert(m.timeLeft < 60000, 'round clock should have ticked down');
  assert(!m.over, 'should not be over after ~2s');
});

test('constructs and runs in pvp mode with no inputs (no damage)', () => {
  const m = new BoxingMatch({ mode: 'pvp', enemyParams: DEFAULT_PARAMS, seed: 2, hooks: {}, onKO() {}, onTime() {}, seconds: 60 });
  for (let t = 0; t < 60; t++) m.update(STEP_MS, viewFor());
  assert(m.player.hp === 100 && m.enemy.hp === 100, 'pvp with no inputs -> nobody acts -> no damage');
});

test('player jab lands via the contactT countdown (~4 ticks, no setTimeout)', () => {
  const m = makeMatch(7, DUMMY);
  const hp0 = m.enemy.hp;
  m.update(STEP_MS, viewFor({ p: ['jabR'], h: [] }));   // throw at tick 0 -> contactT = 60ms
  let landedTick = -1;
  for (let k = 1; k <= 10; k++) { m.update(STEP_MS, viewFor()); if (m.enemy.hp < hp0 && landedTick < 0) landedTick = k; }
  assert(m.enemy.hp < hp0, 'jab should land on the inert dummy');
  assertEqual(landedTick, 4);                           // 60ms / 16.667ms -> 4 ticks
});

test('snapshotBox is plain and JSON-stable, excludes opts/hooks', () => {
  const m = makeMatch(3, DEFAULT_PARAMS);
  for (let t = 0; t < 50; t++) m.update(STEP_MS, viewFor());
  const snap = snapshotBox(m);
  assertEqual(JSON.stringify(snap), JSON.stringify(JSON.parse(JSON.stringify(snap))));
  assert(!('hooks' in snap) && !('opts' in snap), 'snapshot must exclude non-serializable opts/hooks');
});
```

- [ ] **Step 2: Register the new files and run to verify it fails**

Add to `tools/test/index.html` after the replay import:

```html
    import '../../src/sim/box.test.js';
```

In `tools/test/run-headless.js`, add `'src/sim/box.js'` to `MODULES` (after `'src/sim/replay.js'`) and `'src/sim/box.test.js'` to `TESTS`.

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected: it FAILS with `cannot read src/sim/box.js` and `exit=1`. This is the red state.

- [ ] **Step 3: Write the implementation**

Create `src/sim/box.js` with EXACTLY this content (a faithful determinization of `src/boxing.js` — verify by diffing against it; the only logic changes are the seeded rng, the `contactT` countdown, and the removal of the `isNet` relay):

```js
// PAWNCH boxing — DETERMINISTIC sim (Phase 1B-A).
//
// A pure, seeded, serializable port of the Punch-Out-style duel. Advanced by a
// FIXED tick (the caller passes SIM.TICK_MS each step), all randomness comes
// from a seeded rng held in the match (NEVER Math.random), and player-punch
// contact resolves via a tick countdown (contactT) instead of setTimeout — so
// two clients seeded identically and fed the same inputs stay bit-identical.
// The old first-to-zero online relay is gone; lockstep replaces it.
//
// Sim boundary rule: imports ONLY config + sibling sim modules.

import { BOX } from '../config.js';
import { newRng, rngFloat } from './rng.js';

export const DEFAULT_PARAMS = {
  telegraphMs: 600, recoverMs: 400, aggression: 0.4, comboChance: 0.3,
  dodgeSkill: 0.3, guardChance: 0.3, punchDmg: 12, feintChance: 0.2,
  highChance: 0.5, parrySkill: 0,
  signature: { name: 'HAYMAKER', dmg: 24, telegraphMs: 750, chance: 0.08 },
};

function makeFighter(side) {
  return {
    side,
    hp: BOX.MAX_HP,
    stamina: 100,
    pose: 'idle',
    poseT: 0,
    arm: null,
    kind: null,
    target: 'high',
    special: null,
    unblockable: false,
    dmgOverride: null,
    recoverOverride: null,
    stars: 0,
    flash: 0,
    parryT: 0,
    parryLockT: 0,
    starFx: 0,
    offset: 0,
    duckY: 0,
    downCount: 0,
    knockdowns: 0,
    getUpCharge: 0,
    getUpTapFx: 0,
    combo: 0, comboTimer: 0,
    landedThisWindup: false,
    contactT: 0,          // ms until a thrown player-punch lands (replaces setTimeout)
    contactKind: null,    // 'jab'|'hook'|'star' of the pending contact
  };
}

export class BoxingMatch {
  // opts: { mode, enemyParams, onKO, onTime, startHP, hooks, seconds, seed }
  constructor(opts) {
    this.opts = opts;
    this.rng = newRng((opts.seed >>> 0) || 1);
    this.player = makeFighter('player');
    this.enemy = makeFighter('enemy');
    if (opts.startHP) {
      this.player.hp = opts.startHP.player;
      this.enemy.hp = opts.startHP.enemy;
    }
    this.params = opts.enemyParams || DEFAULT_PARAMS;
    this.timeLeft = (opts.seconds ?? 60) * 1000;
    this.over = false;
    this.result = null;
    this.maxCombo = 0;
    this.ai = { state: 'wait', t: this._rand(600, 1400), feint: false, seq: [], specialCd: 2600, parryCd: 0 };
    this.hitHooks = opts.hooks || {};
  }

  _rand(a, b) { return a + rngFloat(this.rng) * (b - a); }

  update(dt, controls) {
    if (this.over) return;
    this._handleGetUpInput(controls);
    this._tickFighter(this.player, dt);
    this._tickFighter(this.enemy, dt);

    const counting = this.player.pose === 'down' || this.enemy.pose === 'down';
    if (!counting) this.timeLeft -= dt;

    if (this.player.pose !== 'down' && this.enemy.pose !== 'down') {
      this._handlePlayer(controls, dt);
      if (this.opts.mode === 'pvp') this._handlePlayer2(controls, dt);
      else this._enemyAI(dt);
    }

    this._checkKO();
    if (!this.over && this.timeLeft <= 0) { this.over = true; this.result = null; this.opts.onTime?.(); }
  }

  _tickFighter(fr, dt) {
    // pending player-punch contact (tick countdown; was a setTimeout)
    if (fr.contactT > 0) {
      fr.contactT -= dt;
      if (fr.contactT <= 0) {
        fr.contactT = 0;
        const k = fr.contactKind; fr.contactKind = null;
        const def = fr === this.player ? this.enemy : this.player;
        if (!this.over) this._playerContact(fr, def, k);
      }
    }

    if (fr.flash > 0) fr.flash -= dt;
    if (fr.starFx > 0) fr.starFx -= dt;
    if (fr.comboTimer > 0) { fr.comboTimer -= dt; if (fr.comboTimer <= 0) fr.combo = 0; }

    if (fr.parryLockT > 0) fr.parryLockT = Math.max(0, fr.parryLockT - dt);
    if (fr.parryT > 0) {
      fr.parryT -= dt;
      if (fr.parryT <= 0) {
        fr.parryT = 0;
        fr.parryLockT = BOX.PARRY.LOCKOUT_MS;
        this._drain(fr, BOX.PARRY.WHIFF_STAMINA);
      }
    }

    if (fr.poseT > 0) {
      fr.poseT -= dt;
      if (fr.pose === 'dodgeL') fr.offset = -14;
      else if (fr.pose === 'dodgeR') fr.offset = 14;
      else if (fr.pose === 'duck') fr.duckY = 14;
      if (fr.poseT <= 0) this._resolvePose(fr);
    } else {
      fr.offset *= 0.7; fr.duckY *= 0.7;
    }

    if (fr.pose === 'idle' || fr.pose === 'guard') fr.stamina = Math.min(100, fr.stamina + dt * 0.022);

    if (fr.pose === 'down') {
      fr.downCount += dt / 1000;
      if (fr.getUpTapFx > 0) fr.getUpTapFx -= dt;
      const idx = this._fallIdx(fr);
      if (this._autoGetUp(fr)) fr.getUpCharge = Math.min(1, fr.getUpCharge + (BOX.GET_UP.AI_CHARGE_PER_SEC[idx] ?? 0.6) * dt / 1000);
      if (fr.getUpCharge >= 1) { this._getUp(fr); return; }
      fr.getUpCharge = Math.max(0, fr.getUpCharge - (BOX.GET_UP.DECAY_PER_SEC[idx] ?? 0.3) * dt / 1000);
      if (fr.downCount >= BOX.GET_UP_COUNT) this._finishKO(fr);
    }
  }

  _koThreshold() { return BOX.KNOCKDOWNS_TO_KO; }
  _fallIdx(fr) { return Math.min(Math.max(fr.knockdowns, 1), 2) - 1; }
  _autoGetUp(fr) {
    if (this.opts.mode === 'pvp') return false;
    return fr.side === 'enemy';
  }

  _handleGetUpInput(c) {
    const p = this.player;
    if (p.pose === 'down' && c.pressed('confirm')) this._chargeGetUp(p);
    if (this.opts.mode === 'pvp') {
      const e = this.enemy;
      if (e.pose === 'down' && c.pressed('p2_getup')) this._chargeGetUp(e);
    }
  }
  _chargeGetUp(fr) {
    const add = BOX.GET_UP.CHARGE_PER_TAP[this._fallIdx(fr)] ?? 0.08;
    fr.getUpCharge = Math.min(1, fr.getUpCharge + add);
    fr.getUpTapFx = 140;
    this.hitHooks.onGetUpTap?.(fr.side, fr.getUpCharge);
  }

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
      const wasFeint = fr.side === 'enemy' && this.ai.feint;
      const parried = this._strike(fr);
      if (parried) { this._stagger(fr); return; }
      if (wasFeint) {
        fr.pose = 'recover'; fr.poseT = this._recoverMs(fr); fr.recoverOverride = null;
      } else {
        fr.pose = 'punch'; fr.poseT = BOX.PUNCH_HOLD_MS;
      }
    } else if (prev === 'punch') {
      fr.pose = 'recover';
      fr.poseT = this._recoverMs(fr);
      fr.recoverOverride = null;
    } else if (prev === 'stance') {
      fr.pose = 'idle';
    } else {
      fr.pose = 'idle'; fr.arm = null; fr.kind = null;
      fr.special = null; fr.unblockable = false; fr.dmgOverride = null;
    }
  }
  _recoverMs(fr) {
    if (fr.recoverOverride != null) return fr.recoverOverride;
    const base = fr.side === 'enemy' ? this.params.recoverMs : BOX.PLAYER_RECOVER;
    return base * (fr.stamina < 30 ? 1.5 : 1);
  }

  _handlePlayer(c, dt) {
    const p = this.player;
    if (this._busy(p)) return;
    if (c.pressed('dodgeL')) return this._dodge(p, 'L');
    if (c.pressed('dodgeR')) return this._dodge(p, 'R');
    if (c.pressed('duck')) return this._duck(p);
    this._guard(p, c.isDown('block'), c.pressed('block'));
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
    this._guard(p, c.isDown('p2_block'), c.pressed('p2_block'));
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
  }
  _duck(fr) {
    fr.pose = 'duck'; fr.poseT = BOX.DUCK_TIME; this._drain(fr, 9);
    this.hitHooks.onDodge?.(fr.side);
  }

  _guard(fr, held, raised) {
    if (raised && fr.parryLockT <= 0) fr.parryT = BOX.PARRY.WINDOW_MS;
    if (held) fr.pose = 'guard';
    else if (fr.pose === 'guard') fr.pose = 'idle';
  }

  _tryParry(att, def) {
    if (att.unblockable) return false;
    if (def.pose !== 'guard' || def.parryT <= 0) return false;
    def.parryT = 0;
    def.parryLockT = BOX.PARRY.LOCKOUT_MS;
    this.hitHooks.onParry?.(def.side);
    return true;
  }

  _stagger(fr) {
    this._clearAtk(fr);
    fr.pose = 'stun'; fr.poseT = BOX.PARRY.STUN_MS;
    fr.arm = null; fr.kind = null; fr.combo = 0; fr.comboTimer = 0;
    if (fr.side === 'enemy') { this.ai.seq = []; this.ai.t = this._rand(250, 500); }
  }

  _enemyPunishCombo() {
    const P = this.params;
    const hits = (P.parrySkill || 0) >= 0.7 ? 3 : 2;
    const dmg = Math.max(4, Math.round(P.punchDmg * 0.7));
    const seq = [];
    let arm = rngFloat(this.rng) < 0.5 ? 'L' : 'R';
    for (let i = 0; i < hits; i++) {
      const last = i === hits - 1;
      seq.push({
        arm, target: rngFloat(this.rng) < 0.5 ? 'high' : 'low',
        kind: last ? 'hook' : 'jab',
        telegraphMs: 190, dmg: last ? Math.round(dmg * 1.3) : dmg,
        recover: last ? 420 : 130, special: null,
      });
      arm = arm === 'L' ? 'R' : 'L';
    }
    this.ai.seq = seq;
  }

  _playerPunch(att, def, arm, kind) {
    if (kind === 'hook' && att.stars > 0) { kind = 'star'; att.stars--; att.starFx = 320; this.hitHooks.onStar?.(att.side); }
    att.pose = 'punch'; att.arm = arm; att.kind = kind;
    att.target = kind === 'jab' ? 'low' : 'high';
    att.poseT = kind === 'jab' ? BOX.PLAYER_JAB_WINDUP : BOX.PLAYER_HOOK_WINDUP;
    att.landedThisWindup = false;
    this._drain(att, kind === 'jab' ? 7 : kind === 'hook' ? 14 : 0);
    this.hitHooks.onPunch?.(att.side, kind);
    att.contactT = kind === 'jab' ? 60 : 140;   // was setTimeout(60|140)
    att.contactKind = kind;
  }

  _playerContact(att, def, kind) {
    if (att.landedThisWindup) return;
    att.landedThisWindup = true;
    if (def.pose === 'stance') { this.hitHooks.onMiss?.(att.side); this._stancePunish(def, att); return; }
    if (this._tryParry(att, def)) {
      this._stagger(att);
      if (def === this.enemy && this.opts.mode !== 'pvp') this._enemyPunishCombo();
      return;
    }
    const avoided = this._defended(att, def);
    if (avoided === 'dodge') { this.hitHooks.onMiss?.(att.side); return; }
    const counter = def.pose === 'recover';
    let dmg = kind === 'jab' ? BOX.PLAYER_JAB_DMG : kind === 'hook' ? BOX.PLAYER_HOOK_DMG : BOX.STAR_DMG;
    dmg *= staminaMult(att);
    if (avoided === 'block') { dmg *= (1 - BOX.BLOCK_REDUCTION); this.hitHooks.onBlock?.(def.side); }
    if (counter) { dmg *= 1.6; att.stars = Math.min(3, att.stars + 1); this.hitHooks.onCounter?.(att.side); }
    this._applyDamage(def, dmg, att);
  }

  _stancePunish(src, victim) {
    const dmg = this.params.special?.dmg ?? 18;
    this.ai.seq = [];
    src.pose = 'punch'; src.arm = src.arm || 'R'; src.kind = 'special'; src.poseT = 200;
    this._applyDamage(victim, dmg, { side: src.side, kind: 'special' });
    this.hitHooks.onCounter?.(src.side);
    this.ai.specialCd = this.params.special?.cooldownMs ?? 5000;
  }

  _enemyAI(dt) {
    const e = this.enemy, P = this.params;
    if (this._busy(e)) return;
    this.ai.t -= dt;
    if (this.ai.specialCd > 0) this.ai.specialCd -= dt;
    if (this.ai.parryCd > 0) this.ai.parryCd -= dt;

    if (this.ai.seq.length) { this._enemyStep(this.ai.seq.shift()); return; }

    if (this.ai.t > 0) return;

    if (this.player.pose === 'punch' && this.ai.parryCd <= 0 && rngFloat(this.rng) < (P.parrySkill || 0)) {
      this._clearAtk(e);
      e.pose = 'guard'; e.parryT = BOX.PARRY.AI_WINDOW_MS;
      this.ai.parryCd = BOX.PARRY.AI_COOLDOWN_MS;
      this.ai.t = this._rand(220, 420);
      return;
    }

    if (this.player.pose === 'punch' && rngFloat(this.rng) < P.dodgeSkill) {
      this._dodge(e, rngFloat(this.rng) < 0.5 ? 'L' : 'R');
      this.ai.t = this._rand(280, 560);
      return;
    }
    if (rngFloat(this.rng) < P.aggression) {
      const sp = P.special;
      if (sp && this.ai.specialCd <= 0 && rngFloat(this.rng) < (sp.chance ?? 0.6)) {
        this.ai.seq = buildSpecial(sp, this.rng);
        this.ai.specialCd = sp.cooldownMs ?? 5000;
        if (this.ai.seq.length) { this._enemyStep(this.ai.seq.shift()); return; }
      }
      const arm = rngFloat(this.rng) < 0.5 ? 'L' : 'R';
      const high = rngFloat(this.rng) < P.highChance;
      this._clearAtk(e);
      e.arm = arm; e.target = high ? 'high' : 'low'; e.pose = 'windup';
      this._drain(e, 8);
      if (rngFloat(this.rng) < P.signature.chance) {
        e.kind = 'signature'; e.poseT = P.signature.telegraphMs; this.ai.feint = false;
      } else {
        e.kind = rngFloat(this.rng) < 0.35 ? 'hook' : 'jab';
        e.poseT = P.telegraphMs * (e.kind === 'hook' ? 1.25 : 1);
        this.ai.feint = rngFloat(this.rng) < P.feintChance;
      }
      this.hitHooks.onWindup?.(arm, e.kind, e.target, null);
      this.ai.t = this._rand(380, 860);
    } else {
      e.pose = rngFloat(this.rng) < P.guardChance ? 'guard' : 'idle';
      this.ai.t = this._rand(480, 1150);
    }
  }

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
    this.ai.t = this._rand(560, 980);
  }

  _clearAtk(e) { e.special = null; e.unblockable = false; e.dmgOverride = null; e.recoverOverride = null; }

  _strike(att) {
    const def = att.side === 'enemy' ? this.player : this.enemy;
    if (att.side === 'enemy' && this.ai.feint) { this.ai.feint = false; this._clearAtk(att); return false; }
    if (this._tryParry(att, def)) return true;
    const avoided = this._defended(att, def);
    if (avoided === 'dodge') { this.hitHooks.onDodge?.(def.side); this._clearAtk(att); return false; }
    let dmg = att.dmgOverride != null ? att.dmgOverride
            : att.kind === 'signature' ? this.params.signature.dmg
            : att.kind === 'hook' ? this.params.punchDmg * 1.4
            : this.params.punchDmg;
    dmg *= staminaMult(att);
    if (avoided === 'block') { dmg *= (1 - BOX.BLOCK_REDUCTION); this.hitHooks.onBlock?.(def.side); }
    this._applyDamage(def, dmg, att);
    if (att.side === 'enemy') this._clearAtk(att);
    return false;
  }

  _defended(att, def) {
    const correctDodge =
      (att.arm === 'L' && def.pose === 'dodgeR') || (att.arm === 'R' && def.pose === 'dodgeL');
    const jabLeniency = att.kind === 'jab' && (def.pose === 'dodgeL' || def.pose === 'dodgeR');
    const duckBeatsHigh = def.pose === 'duck' && att.target === 'high';
    if (correctDodge || jabLeniency || duckBeatsHigh) return 'dodge';
    if (def.pose === 'guard' && !att.unblockable) return 'block';
    return null;
  }

  _applyDamage(def, dmg, att) {
    dmg = Math.max(1, Math.round(dmg));
    def.hp = Math.max(0, def.hp - dmg);
    def.flash = 140;
    if (def.pose !== 'guard' && def.pose !== 'stun') { def.pose = 'hurt'; def.poseT = 220; }
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

  _busy(fr) {
    return ['windup', 'punch', 'recover', 'dodgeL', 'dodgeR', 'duck', 'hurt', 'down', 'ko', 'stance', 'stun'].includes(fr.pose) && fr.poseT > 0;
  }

  _checkKO() {
    for (const fr of [this.player, this.enemy]) {
      if (fr.hp <= 0 && fr.pose !== 'down' && fr.pose !== 'ko') {
        fr.knockdowns++;
        if (fr.knockdowns >= this._koThreshold()) { this._finishKO(fr); continue; }
        fr.pose = 'down'; fr.poseT = 0; fr.downCount = 0; fr.getUpCharge = 0; fr.getUpTapFx = 0;
        this.hitHooks.onKnockdown?.(fr.side, fr.knockdowns);
      }
    }
  }
  _finishKO(fr) {
    if (this.over) return;
    fr.pose = 'ko';
    this.over = true;
    this.result = fr.side === 'player' ? 'enemy' : 'player';
    this.hitHooks.onKO?.(this.result);
    this.opts.onKO?.(this.result);
  }
}

function buildSpecial(sp, rng) {
  const A = () => (rngFloat(rng) < 0.5 ? 'L' : 'R');
  const t = sp.type;
  if (t === 'flurry') {
    const n = sp.hits || 3, steps = []; let arm = A();
    for (let i = 0; i < n; i++) {
      steps.push({ arm, target: rngFloat(rng) < 0.5 ? 'high' : 'low', kind: 'jab',
        telegraphMs: sp.telegraphMs, dmg: sp.dmg, special: sp.name, recover: i === n - 1 ? 520 : (sp.gapMs || 150) });
      arm = arm === 'L' ? 'R' : 'L';
    }
    return steps;
  }
  if (t === 'feint') {
    const arm = A();
    return [
      { arm, target: 'high', kind: 'jab', telegraphMs: sp.telegraphMs, feint: true, special: sp.name, recover: 130 },
      { arm: arm === 'L' ? 'R' : 'L', target: 'high', kind: 'hook', telegraphMs: Math.round(sp.telegraphMs * 0.55), dmg: sp.dmg, special: sp.name, recover: 600 },
    ];
  }
  if (t === 'lowhigh') {
    const arm = A(), lowFirst = sp.lowFirst !== false;
    return [
      { arm, target: lowFirst ? 'low' : 'high', kind: 'jab', telegraphMs: sp.telegraphMs, dmg: Math.round(sp.dmg * 0.55), special: sp.name, recover: sp.gapMs || 160 },
      { arm, target: lowFirst ? 'high' : 'low', kind: 'hook', telegraphMs: Math.round(sp.telegraphMs * 0.7), dmg: sp.dmg, special: sp.name, recover: 560 },
    ];
  }
  if (t === 'charge') {
    return [{ arm: A(), target: 'high', kind: 'signature', telegraphMs: sp.telegraphMs, dmg: sp.dmg, special: sp.name, recover: 720 }];
  }
  if (t === 'unblockable') {
    return [{ arm: A(), target: sp.target || 'high', kind: 'signature', telegraphMs: sp.telegraphMs, dmg: sp.dmg, unblockable: true, special: sp.name, recover: 640 }];
  }
  if (t === 'counterstance') {
    return [
      { stance: true, durationMs: sp.telegraphMs, special: sp.name },
      { arm: A(), target: 'high', kind: 'hook', telegraphMs: Math.round(sp.telegraphMs * 0.45), dmg: sp.dmg, special: sp.name, recover: 600 },
    ];
  }
  if (t === 'checkmate') {
    const arm = A();
    return [
      { arm, target: 'high', kind: 'jab', telegraphMs: Math.round(sp.telegraphMs * 0.7), feint: true, special: sp.name, recover: 120 },
      { arm: arm === 'L' ? 'R' : 'L', target: 'high', kind: 'signature', telegraphMs: sp.telegraphMs, dmg: sp.dmg, unblockable: true, special: sp.name, recover: 680 },
    ];
  }
  return [];
}

function staminaMult(fr) { return fr.stamina < 25 ? 0.55 : fr.stamina < 50 ? 0.8 : 1; }

// Plain serializable snapshot of the sim state (for hashing / desync detection
// and, later, rollback). Excludes opts/hooks (non-serializable side effects).
export function snapshotBox(m) {
  const f = (fr) => ({ ...fr });
  return {
    player: f(m.player), enemy: f(m.enemy),
    ai: { ...m.ai, seq: m.ai.seq.map((s) => ({ ...s })) },
    timeLeft: m.timeLeft, over: m.over, result: m.result, maxCombo: m.maxCombo,
    rng: { ...m.rng },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 35 passed, 0 failed
exit=0
```

(31 prior + 4 box.) Optional browser cross-check: title `✓ 35 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/sim/box.js src/sim/box.test.js tools/test/index.html tools/test/run-headless.js
git commit -m "feat(sim): deterministic boxing sim (src/sim/box.js) — seeded, tick-driven port"
```

---

### Task 2: Determinism proof tests

**Files:**
- Modify: `src/sim/box.test.js`

**Interfaces:**
- Consumes: `BoxingMatch`, `DEFAULT_PARAMS`, `snapshotBox` from `./box.js` (Task 1); `hashHex` from `./hash.js`; `assertDeepEqual` from the runner; the `STEP_MS`/`viewFor`/`makeMatch`/`DUMMY` helpers already declared in `box.test.js` Task 1.
- Produces: nothing later tasks consume (these are leaf tests).

- [ ] **Step 1: Write the failing test**

In `src/sim/box.test.js`, change the imports at the top to add `assertDeepEqual` and `hashHex`:

```js
import { suite, test, assert, assertEqual, assertDeepEqual } from '../../tools/test/runner.js';
import { BoxingMatch, DEFAULT_PARAMS, snapshotBox } from './box.js';
import { hashHex } from './hash.js';
```

Then append these helpers and tests to the END of `src/sim/box.test.js`:

```js
// a lively opponent that uses every AI branch: baseline attacks, reactive
// parry/dodge, feints, signature, and a multi-step flurry special.
const AGG = { ...DEFAULT_PARAMS, aggression: 0.9, dodgeSkill: 0.3, parrySkill: 0.4, guardChance: 0.4, feintChance: 0.3,
  signature: { name: 'HAY', dmg: 24, telegraphMs: 600, chance: 0.15 },
  special: { type: 'flurry', name: 'STORM', dmg: 8, telegraphMs: 300, chance: 0.8, cooldownMs: 1500, hits: 3 } };

function scriptedLog(n) {
  const log = [];
  for (let t = 0; t < n; t++) {
    const f = { p: [], h: [] };
    if (t % 30 === 5) f.p.push('jabR');
    if (t % 30 === 15) f.p.push('hookL');
    if (t % 40 === 20) { f.p.push('block'); f.h.push('block'); }
    if (t % 50 === 25) f.p.push('dodgeL');
    log.push(f);
  }
  return log;
}
function runHashes(seed, params, log) {
  const m = makeMatch(seed, params);
  const hs = [hashHex(snapshotBox(m))];
  for (let t = 0; t < log.length; t++) { m.update(STEP_MS, viewFor(log[t])); hs.push(hashHex(snapshotBox(m))); }
  return { m, hs };
}

test('same seed + same inputs -> identical per-tick hashes (AI + specials)', () => {
  const log = scriptedLog(240);
  const a = runHashes(20250625, AGG, log);
  const b = runHashes(20250625, AGG, log);
  assertDeepEqual(a.hs, b.hs);
});

test('different seeds diverge', () => {
  const log = scriptedLog(240);
  const a = runHashes(20250625, AGG, log);
  const c = runHashes(99999, AGG, log);
  assert(a.hs.some((h, i) => h !== c.hs[i]), 'different seeds should produce different play');
});

test('a knockdown / get-up sequence is deterministic', () => {
  // player hammers an inert dummy -> knockdowns + auto-get-up; must replay identically.
  const hammer = Array.from({ length: 900 }, () => ({ p: ['hookR'], h: [] }));
  const a = runHashes(123, DUMMY, hammer);
  const b = runHashes(123, DUMMY, hammer);
  assertDeepEqual(a.hs, b.hs);
  assert(a.m.enemy.knockdowns >= 1, 'the hammering should have caused at least one knockdown');
});
```

- [ ] **Step 2: Run to verify it fails**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected: it FAILS — the new tests reference `hashHex`/`assertDeepEqual`/`AGG`/`runHashes`. Before you save the additions the suite is still 35; after you add the tests but if anything is mistyped the headless run reports the failing test name and `exit=1`. (If you wrote the additions correctly the first time, you will go straight to the green state in Step 3 — that is fine; the determinism assertions are the real gate.)

- [ ] **Step 3: Confirm green**

Run headless: `osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"`
Expected:

```
[TESTS] 38 passed, 0 failed
exit=0
```

(35 prior + 3 determinism.) The passing "same seed -> identical per-tick hashes" test over 240 ticks of full AI behavior is the core proof that `src/sim/box.js` is deterministic.

- [ ] **Step 4: Commit**

```bash
git add src/sim/box.test.js
git commit -m "test(sim): prove the boxing sim is deterministic (per-tick hash replay)"
```

---

## Verification (whole plan)

Headless (verification of record), from the repo root:

```bash
osascript -l JavaScript tools/test/run-headless.js "$PWD"; echo "exit=$?"
```

Expected: `[TESTS] 38 passed, 0 failed` and `exit=0`.

Confirm the live game is unaffected (this plan only ADDS `src/sim/box.js` + tests; nothing imports it yet): open `http://localhost:5174/`, play a Story boxing half — it still runs on the old `src/boxing.js`, unchanged. No console `[PAWNCH] frame error:` lines.

## What this plan deliberately does NOT do (next: Phase 1B-B and 1B-C)

- It does NOT rewire `states/boxing.js` onto `src/sim/box.js`, delete `src/boxing.js`, or wire the loop-level fixed-step + edge-input adapter. That integration needs the `FixedStep` loop wiring and belongs to **Phase 1B-C**, which flips the live game onto the deterministic sims and removes the old code.
- It does NOT touch the chess clock/half (**Phase 1B-B**) or the flow/walk/round-break timeline (**Phase 1B-C**).
- No networking (Phase 2), rollback (Phase 3), rating server (Phase 4), or Steam wrapper (Phase 5). Rollback will reuse `snapshotBox` (and a future `restoreBox`) added here.

## Carry-forward to 1B-C / rollback (from the 1B-A whole-branch review)

The branch reviewed *Ready to merge: Yes* (38/38, faithful deterministic port). These are entry criteria for the phases that integrate it:

1. **Edge-input adapter MUST latch-and-consume (highest value).** `box.js`'s input handling assumes `pressed(action)` is true for exactly ONE tick. When 1B-C steps the sim N times per frame via `FixedStep`, the edge-triggered `pressed` from a single keypress must be delivered to exactly one sub-tick and then presented as `false` to the rest — otherwise one keypress can become multiple punches on a multi-sub-tick frame. Build the adapter to latch each press, hand it to one tick, and clear it. **Add a regression test:** hold a single `jabR` edge across 4 sub-ticks → assert exactly one punch / one damage application.
2. **`restoreBox` for rollback (Phase 3) needs more than the snapshot.** `snapshotBox` intentionally omits `opts` (`mode`/`seconds`/`seed`), `params`, and `hitHooks` (immutable or side-effects). `restoreBox(snapshot, opts)` must take `mode`/`params`/`hooks` from the live match, not the snapshot. Consider snapshotting `seed` so a replay is reproducible from a snapshot alone. Add a `restore(snapshot(m))` → N-ticks → hash-match round-trip test when it lands.
3. **Minor hardening (non-blocking):** `box.test.js` top-level helper names (`AGG`, `DUMMY`, …) share the headless concat scope — a `box_` prefix would harden against future collisions; and `opts.seed >>> 0 || 1` maps seed 0 → 1 (seed 0 and 1 play identically) — worth a caller-facing comment.
