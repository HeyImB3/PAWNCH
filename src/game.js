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

import { VIEW, MATCH, PAL } from './config.js';
import { input } from './input.js';
import * as audio from './audio.js';
import { FX, bgGradient, scanlines, text, textWidth } from './gfx.js';
import { load, save } from './save.js';
import * as Chess from './chess/board.js';

import { TitleState } from './states/title.js';
import { SettingsState } from './states/settings.js';
import { StoryState } from './states/story.js';
import { WalkState } from './states/walk.js';
import { ChessState } from './states/chess.js';
import { BoxingState } from './states/boxing.js';
import { RoundBreakState } from './states/roundbreak.js';
import { MatchEndState } from './states/matchend.js';
import { MultiplayerState } from './states/multiplayer.js';

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

    this.state = null;
    this.stateName = null;
    this.match = null;       // active PAWNCH match (see startMatch)
    this.transition = 0;     // 0..1 wipe value
    this.transitionDir = 0;  // 1 = covering, -1 = revealing
    this.pendingState = null;

    this.freeze = 0;         // hit-stop timer (ms): pauses sim, keeps drawing
    this.toast = null;       // { msg, t } transient HUD message (e.g. mute toggle)

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
  resolveChess(result) {
    const m = this.match;
    m.lastChessResult = result;
    if (result.decisive) {
      m.over = true; m.winner = result.winner; m.reason = result.reason;
      this.changeState('matchend');
    } else {
      this.changeState('boxing');
    }
  }

  // Called by BoxingState when the boxing half ends.
  // result: { decisive:bool, winner:'player'|'enemy'|null }
  resolveBoxing(result) {
    const m = this.match;
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
  applyRoundHeal() {
    const amt = MATCH.HEAL_MIN + Math.random() * (MATCH.HEAL_MAX - MATCH.HEAL_MIN);
    const heal = Math.round(100 * amt);
    this.match.hp.player = Math.min(100, this.match.hp.player + heal);
    this.match.hp.enemy = Math.min(100, this.match.hp.enemy + heal);
    return heal;
  }

  persist() { save(this.save); }

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
    // global: M toggles music mute (with a now-playing toast)
    if (this.input.pressedCode('KeyM')) {
      const muted = audio.toggleMusicMute();
      const np = audio.nowPlaying();
      this.toast = { msg: muted ? 'MUSIC OFF' : 'MUSIC ON' + (np ? ' · ' + np.toUpperCase() : ''), t: 1600 };
    }
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    // hit-stop: hold the sim for a few frames, but keep particles/fx alive
    if (this.freeze > 0) { this.freeze -= dt; this.fx.update(); return; }
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
