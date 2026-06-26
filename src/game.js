// PAWNCH core: the game loop, a simple state machine, and the shared "match"
// model that the chess/boxing/walk/break states all read & mutate.
//
// WIN RULES (configurable in one place — see resolveChess / resolveBoxing):
//  - A round = chess half (then) boxing half.
//  - Win the chess OR the boxing and you win the WHOLE match immediately.
//      chess decisive: checkmate, or opponent flags (clock hits 0).
//      boxing decisive: KO.
//  - The chess game is ONE continuous game across rounds; clocks refill to
//    60s each round's chess half, and each half is capped to ~60s wall time.
//  - If neither side wins in 10 rounds, the higher chess material wins.

import { VIEW, MATCH, PAL, DEV } from './config.js';
import { input } from './input.js';
import * as audio from './audio.js';
import { FX, bgGradient, scanlines, text, textWidth, setPieceSet } from './gfx.js';
import { load, save } from './save.js';
import * as Chess from './chess/board.js';
import { FixedStep } from './sim/clock.js';
import { captureFrame, tickView } from './sim/inputview.js';

import { TitleState } from './states/title.js';
import { SettingsState } from './states/settings.js';
import { StoryState } from './states/story.js';
import { WalkState } from './states/walk.js';
import { ChessState } from './states/chess.js';
import { BoxingState } from './states/boxing.js';
import { RoundBreakState } from './states/roundbreak.js';
import { MatchEndState } from './states/matchend.js';
import { MultiplayerState } from './states/multiplayer.js';
import { PauseOverlay } from './states/pause.js';
import { TutorialChessState } from './states/tutorialchess.js';
import { TutorialBoxState } from './states/tutorialbox.js';
import { TutorialState } from './states/tutorial.js';

const STATES = {
  title: TitleState,
  settings: SettingsState,
  story: StoryState,
  multiplayer: MultiplayerState,
  walk: WalkState,
  chess: ChessState,
  boxing: BoxingState,
  roundbreak: RoundBreakState,
  matchend: MatchEndState,
  tutorialChess: TutorialChessState,
  tutorialBox: TutorialBoxState,
  tutorial: TutorialState,
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.W = VIEW.W; this.H = VIEW.H;
    this.input = input;
    input.attachPointer(canvas, this.W, this.H);
    this.audio = audio;
    this.fx = new FX();
    this.save = load();
    this.input.setBindings(this.save.settings.bindings);
    audio.setVolumes(this.save.settings.volume);
    setPieceSet(this.save.settings.pieceSet);   // apply the saved chess set

    this.state = null;
    this.stateName = null;
    this.match = null;       // active PAWNCH match (see startMatch)
    this.transition = 0;     // 0..1 wipe value
    this.transitionDir = 0;  // 1 = covering, -1 = revealing
    this.pendingState = null;

    this.freeze = 0;         // hit-stop timer (ms): pauses sim, keeps drawing
    this.toast = null;       // { msg, t } transient HUD message (e.g. mute toggle)

    this.paused = false;     // in-game pause overlay active? (freezes the half)
    this.pause = null;       // PauseOverlay instance while paused
    this.devSkipHold = 0;    // ms the hidden B+3 dev-skip combo has been held

    // accumulator that advances fixed-timestep (tick) states in whole SIM.TICK_MS
    // steps, decoupled from the display refresh rate (see update()).
    this.fixedStep = new FixedStep();

    this.last = performance.now();
    this._loop = this._loop.bind(this);
  }

  // brief hit-stop for impact (Punch-Out-style). Capped so it can't stall.
  doFreeze(ms) { this.freeze = Math.min(140, Math.max(this.freeze, ms)); }

  start() {
    this.setState('title');
    requestAnimationFrame(this._loop);
  }

  // ---- state machine ---------------------------------------------------
  setState(name, params = {}) {
    if (this.state?.exit) this.state.exit(this);
    const S = STATES[name];
    this.state = new S();
    this.stateName = name;
    this.fixedStep?.reset();   // clear any sub-tick remainder when the active state changes
    if (this.state.enter) this.state.enter(this, params);
  }

  // a quick orange wipe between states
  changeState(name, params = {}) {
    this.pendingState = { name, params };
    this.transitionDir = 1;
  }

  // ---- match lifecycle -------------------------------------------------
  startMatch(config) {
    // config: { mode:'story'|'pvp', opponent, playerColor }
    const playerColor = config.playerColor || Chess.WHITE;
    this.match = {
      mode: config.mode,
      opponent: config.opponent,           // story: roster entry; pvp: {name,...}
      net: config.net || null,
      playerColor,
      round: 1,
      // one continuous chess game + clocks for the whole match (persist across rounds)
      chess: Chess.newGame(),
      clocks: { w: MATCH.CHESS_SECONDS * 1000, b: MATCH.CHESS_SECONDS * 1000 },
      hp: { player: 100, enemy: 100 },
      fightTrack: (config.opponent?.index || 0) % 2,  // rotate in-match music per opponent
      over: false,
      winner: null,           // 'player'|'enemy'|'draw'
      reason: null,           // 'checkmate'|'flag'|'ko'|'material'|'draw'
      lastChessResult: null,  // for the round break screen
      pgnMoves: [],           // SAN move log for PGN export
    };
  }

  // Called by ChessState when the chess half ends.
  // result: { decisive:bool, winner:'player'|'enemy'|null, reason }
  // Online: only the authority (White) actually advances the match; it relays the
  // transition and the peer applies it via netInboxPhase (see _applyNetPhase). The
  // result is deterministic from synced state, so the peer just replays resolveChess.
  resolveChess(result, fromNet = false) {
    const m = this.match;
    if (m?.net && !fromNet) {
      if (!m.netAuthority) return;                 // peer waits for the authority's relay
      m.net.sendPhase('resolveChess', result);
    }
    m.lastChessResult = result;
    if (result.decisive) {
      m.over = true; m.winner = result.winner; m.reason = result.reason;
      this.changeState('matchend');
    } else {
      this.applyNoMovePenalty(result);
      this.changeState('boxing');
    }
  }

  // Skip-the-chess deterrent: a human side that made NO move during the chess
  // half has its HP capped at MATCH.NO_MOVE_HP_CAP for that round's boxing half
  // (no effect if it's already lower, so a hurt fighter isn't punished twice).
  // Only human-controlled sides are punished — the story AI always moves, and
  // shouldn't be penalized for simply not getting a turn before time ran out.
  // The hidden dev fast-forward (reason 'devskip') is exempt.
  applyNoMovePenalty(result) {
    if (result.reason === 'devskip') return;
    const m = this.match, moved = m.movedThisHalf;
    if (!moved) return;
    const cap = MATCH.NO_MOVE_HP_CAP;
    const sides = m.mode === 'pvp' ? ['player', 'enemy'] : ['player'];
    for (const side of sides) {
      if (!moved[side]) m.hp[side] = Math.min(m.hp[side], cap);
    }
  }

  // Called by BoxingState when the boxing half ends.
  // result: { decisive:bool, winner:'player'|'enemy'|null }
  // Online: authority-driven + relayed, same as resolveChess. The round/material
  // outcome and the round-heal are deterministic (heal is fixed online — see
  // applyRoundHeal), so the peer's replay lands on the identical state.
  resolveBoxing(result, fromNet = false) {
    const m = this.match;
    if (m?.net && !fromNet) {
      if (!m.netAuthority) return;                 // peer waits for the authority's relay
      m.net.sendPhase('resolveBoxing', result);
    }
    if (result.decisive) {
      m.over = true; m.winner = result.winner; m.reason = 'ko';
      this.changeState('matchend');
      return;
    }
    // round complete — match decided?
    if (m.round >= MATCH.TOTAL_ROUNDS) {
      const mat = Chess.material(m.chess.board);
      const playerDiff = m.playerColor === Chess.WHITE ? mat.diff : -mat.diff;
      m.over = true;
      m.reason = 'material';
      m.winner = playerDiff > 0 ? 'player' : playerDiff < 0 ? 'enemy' : 'draw';
      this.changeState('matchend');
    } else {
      m.round++;
      this.changeState('roundbreak');   // heals, then walks to board
    }
  }

  // Heal both fighters at the start of a new round (rounds 2..10).
  // Online uses a FIXED amount (the band's midpoint) so both clients heal
  // identically with no extra sync — Math.random() would desync carried HP.
  applyRoundHeal() {
    const amt = this.match?.net
      ? (MATCH.HEAL_MIN + MATCH.HEAL_MAX) / 2
      : MATCH.HEAL_MIN + Math.random() * (MATCH.HEAL_MAX - MATCH.HEAL_MIN);
    const heal = Math.round(100 * amt);
    this.match.hp.player = Math.min(100, this.match.hp.player + heal);
    this.match.hp.enemy = Math.min(100, this.match.hp.enemy + heal);
    return heal;
  }

  // ---- online authoritative timeline ----------------------------------
  // TODO(online-sync): KNOWN ISSUE / WIP — clients still drift (coin flip, chess
  // moves + half timer go out of sync). Deferred 2026-06-09. See docs/ONLINE_SYNC_TODO.md.
  // A flow transition (walk->chess, roundbreak->walk) routed through the
  // authority. Offline: a plain changeState. Online: the peer waits for the
  // relay; the authority changes state AND broadcasts it. Used by walk/roundbreak.
  netFlow(name, params = {}) {
    const m = this.match;
    if (m?.net) {
      if (!m.netAuthority) return;          // peer follows the authority's relay
      m.net.sendPhase('state', { name, params });
    }
    this.changeState(name, params);
  }

  // Drain authoritative transitions relayed from the peer's authority (called by
  // update on the non-authority client; the authority never receives its own).
  _drainNetPhase() {
    const m = this.match;
    if (!m?.net || m.netAuthority || !m.netInboxPhase) return;
    while (m.netInboxPhase.length) this._applyNetPhase(m.netInboxPhase.shift());
  }

  _applyNetPhase(msg) {
    switch (msg.phase) {
      case 'resolveChess':  this.resolveChess(this._flipResult(msg.payload), true); break;
      case 'resolveBoxing': this.resolveBoxing(this._flipResult(msg.payload), true); break;
      case 'state':         this.changeState(msg.payload.name, msg.payload.params); break;
    }
  }

  // 'player'/'enemy' in a result are relative to the SENDER, so a relayed decisive
  // result must be mirrored for us: the authority's player is our enemy. 'draw' and
  // null (timeout / round-advance) pass through; the material-end winner is
  // recomputed locally from the synced board, so flipping a null here is harmless.
  _flipResult(result) {
    if (!result) return result;
    const w = result.winner === 'player' ? 'enemy' : result.winner === 'enemy' ? 'player' : result.winner;
    return { ...result, winner: w };
  }

  // Authority -> peer clock snapshot. The peer snaps its display clocks to the
  // authoritative values so a refocused (un-frozen) tab self-corrects instead of
  // drifting. The authority ignores snapshots (it never receives its own).
  applyNetClock(msg) {
    const m = this.match;
    if (!m?.net || m.netAuthority) return;
    if (msg.clocks && this.stateName === 'chess') {
      m.clocks.w = msg.clocks.w; m.clocks.b = msg.clocks.b;
      if (this.state) this.state.halfTime = msg.halfLeft;
    } else if (msg.boxLeft != null && this.stateName === 'boxing' && this.state?.match) {
      this.state.match.timeLeft = msg.boxLeft;
    }
  }

  // Authority: broadcast the live clocks a few times a second so the peer stays
  // pinned to our timeline. Called from update while in chess/boxing.
  _broadcastNetClock(dt) {
    const m = this.match;
    if (!m?.net || !m.netAuthority) return;
    m._snapAccum = (m._snapAccum || 0) + dt;
    if (m._snapAccum < 200) return;          // ~5x/sec
    m._snapAccum = 0;
    if (this.stateName === 'chess' && this.state) {
      m.net.sendClock({ clocks: { w: m.clocks.w, b: m.clocks.b }, halfLeft: this.state.halfTime });
    } else if (this.stateName === 'boxing' && this.state?.match) {
      m.net.sendClock({ boxLeft: this.state.match.timeLeft });
    }
  }

  // Hidden developer shortcut (see DEV in config.js). Holding the combo keys
  // together for SKIP_HOLD_MS during a chess or boxing half fast-forwards to the
  // other half: chess -> boxing, boxing -> the next round's chess. Lets me test
  // the live build without playing a whole half. OFFLINE ONLY — disabled in any
  // online match (m.net) so it can't desync the other player; online dev tools
  // will be built separately.
  _devSkipUpdate(dt) {
    const holding = DEV.SKIP_COMBO.every((c) => this.input.isCodeDown(c));
    const live = this.transitionDir === 0 && !this.paused && !this.match?.net &&
                 (this.stateName === 'chess' || this.stateName === 'boxing');
    if (!holding || !live) { this.devSkipHold = 0; return; }
    this.devSkipHold += dt;
    if (this.devSkipHold < DEV.SKIP_HOLD_MS) return;
    this.devSkipHold = 0;
    if (this.stateName === 'chess') {
      this.state.phase = 'ended';     // stop the half re-resolving during the wipe
      this.resolveChess({ decisive: false, winner: null, reason: 'devskip' });
    } else {
      this.state.ended = true;
      this.resolveBoxing({ decisive: false, winner: null });
    }
  }

  persist() { save(this.save); }

  // ---- pause overlay + save / continue --------------------------------
  openPause() { this.paused = true; this.pause = new PauseOverlay(); }
  closePause() { this.paused = false; this.pause = null; }

  // pause is allowed only mid chess/boxing, offline, and when the active state
  // isn't mid-something Esc should back out of first (e.g. a chess selection)
  _canPauseNow() {
    if (this.transitionDir !== 0) return false;
    if (this.stateName !== 'chess' && this.stateName !== 'boxing') return false;
    if (this.match?.net) return false;
    if (this.state?.canPause && !this.state.canPause(this)) return false;
    return true;
  }

  // serialize the live match so it can be resumed later (chess via FEN)
  snapshotMatch(half) {
    const m = this.match;
    return {
      v: 1,
      mode: m.mode,
      opponent: m.opponent,          // plain data (story roster entry or { name })
      playerColor: m.playerColor,
      round: m.round,
      fen: Chess.toFen(m.chess),
      clocks: { ...m.clocks },
      hp: { ...m.hp },
      fightTrack: m.fightTrack,
      pgnMoves: (m.pgnMoves || []).slice(),
      half,                          // 'chess' | 'boxing'
    };
  }

  hasSavedMatch() { return !!(this.save && this.save.savedMatch); }

  // pause menu -> "Save & Quit": park the match, then cut to the title
  saveMatchAndExit() {
    if (this.match) { this.save.savedMatch = this.snapshotMatch(this.stateName); this.persist(); }
    this.match = null;
    this.closePause();
    this.setState('title');          // instant (no wipe) so the old half can't tick a dead match
  }

  // title -> "Continue": rebuild the parked match and drop back into its half
  continueSavedMatch() {
    const s = this.save?.savedMatch;
    if (!s) return;
    this.match = {
      mode: s.mode,
      opponent: s.opponent,
      net: null,
      playerColor: s.playerColor,
      round: s.round,
      chess: Chess.loadFen(s.fen),
      clocks: { ...s.clocks },
      hp: { ...s.hp },
      fightTrack: s.fightTrack || 0,
      over: false, winner: null, reason: null, lastChessResult: null,
      pgnMoves: s.pgnMoves ? [...s.pgnMoves] : [],
    };
    this.save.savedMatch = null;     // single slot: consumed on continue
    this.persist();
    this.changeState(s.half === 'boxing' ? 'boxing' : 'chess');
  }

  // ---- main loop -------------------------------------------------------
  _loop(t) {
    let dt = t - this.last;
    this.last = t;
    if (dt > 60) dt = 60; // clamp big stalls
    try {
      this.update(dt);
      this.draw();
    } catch (e) {
      // never let one bad frame kill the loop
      console.error('[PAWNCH] frame error:', e);
    }
    this.input.endFrame();
    requestAnimationFrame(this._loop);
  }

  update(dt) {
    // first input resumes audio (browser autoplay policy)
    if (this.input.consumeAnyKey()) audio.resume();

    // hidden dev shortcut: hold B+3 mid-half to fast-forward to the other half
    this._devSkipUpdate(dt);

    // online: apply authoritative flow transitions relayed from the peer, and (as
    // the authority) keep broadcasting the live clocks. Done before the hit-stop
    // early-return so the timeline stays in sync even mid freeze. No-op offline.
    this._drainNetPhase();
    this._broadcastNetClock(dt);

    // paused: the in-game pause overlay owns everything; the half is frozen
    if (this.paused) { this.pause.update(this, dt); return; }

    // open the pause menu (Esc) — only mid chess/boxing, offline (see _canPauseNow)
    if (this.input.pressed('cancel') && this._canPauseNow()) { audio.sfx.select(); this.openPause(); return; }

    // global: M toggles music mute (with a now-playing toast)
    if (this.input.pressedCode('KeyM')) {
      const muted = audio.toggleMusicMute();
      const np = audio.nowPlaying();
      this.toast = { msg: muted ? 'MUSIC OFF' : 'MUSIC ON' + (np ? ' · ' + np.toUpperCase() : ''), t: 1600 };
    }
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    // hit-stop: hold the sim for a few frames, but keep particles/fx alive
    if (this.freeze > 0) { this.freeze -= dt; this.fx.update(); return; }
    // Fixed-timestep states (the deterministic, online-ready sims) implement
    // tick(game, input): advance them in whole SIM.TICK_MS ticks, with edge
    // inputs latched to exactly one tick (see inputview) so a single press can't
    // double-fire across sub-ticks. Menus and not-yet-migrated states stay on
    // update(dt). A state may implement BOTH (tick = sim, update = render timers).
    if (this.state?.tick) {
      const { ticks } = this.fixedStep.advance(dt);
      if (ticks > 0) {
        const frame = captureFrame(this.input, this.state.tickActions || []);
        for (let i = 0; i < ticks; i++) this.state.tick(this, tickView(frame, i === 0));
      }
    }
    if (this.state?.update) this.state.update(this, dt);
    this.fx.update();

    // transition wipe
    if (this.transitionDir === 1) {
      this.transition += dt / 220;
      if (this.transition >= 1) {
        this.transition = 1;
        const p = this.pendingState; this.pendingState = null;
        if (p) this.setState(p.name, p.params);
        this.transitionDir = -1;
      }
    } else if (this.transitionDir === -1) {
      this.transition -= dt / 220;
      if (this.transition <= 0) { this.transition = 0; this.transitionDir = 0; }
    }
  }

  draw() {
    const ctx = this.ctx;
    const [sx, sy] = this.fx.shakeOffset();
    ctx.save();
    ctx.translate(sx, sy);
    bgGradient(ctx, this.W, this.H);
    if (this.state?.draw) this.state.draw(this, ctx);
    this.fx.draw(ctx);
    this.fx.drawFlash(ctx, this.W, this.H);
    ctx.restore();

    // in-game pause menu draws over the frozen half
    if (this.paused && this.pause) this.pause.draw(this, ctx);

    if (this.save.settings.scanlines) scanlines(ctx, this.W, this.H);
    this._drawNetStatus(ctx);
    this._drawToast(ctx);
    this._drawTransition(ctx);
  }

  _drawToast(ctx) {
    if (!this.toast) return;
    const a = Math.min(1, this.toast.t / 300);
    const w = textWidth(this.toast.msg, 1) + 16;
    const x = this.W - w - 8, y = 8;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(7,10,22,0.85)'; ctx.fillRect(x, y, w, 16);
    ctx.fillStyle = PAL.orange; ctx.fillRect(x, y, 3, 16);
    text(ctx, this.toast.msg, x + 8, y + 5, { scale: 1, color: PAL.text });
    ctx.globalAlpha = 1;
  }

  _drawNetStatus(ctx) {
    const s = this.match?.netStatus;
    if (!s) return;
    const w = textWidth(s.msg, 1) + 20;
    const x = this.W / 2 - w / 2;
    ctx.fillStyle = 'rgba(7,10,22,0.85)';
    ctx.fillRect(x, 2, w, 16);
    ctx.fillStyle = s.color; ctx.fillRect(x, 2, w, 2);
    text(ctx, s.msg, this.W / 2, 8, { scale: 1, color: s.color, align: 'center' });
  }

  _drawTransition(ctx) {
    if (this.transition <= 0) return;
    const h = this.H * this.transition;
    ctx.fillStyle = PAL.orange;
    ctx.fillRect(0, 0, this.W, h);
    ctx.fillStyle = PAL.blue;
    ctx.fillRect(0, this.H - h, this.W, h);
  }
}
