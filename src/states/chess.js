// Chess half: render an 8-bit board, drive player input + the opponent AI,
// run the per-side clocks, animate moves with juice, and report the result
// back to the Game (checkmate / flag = decisive; timeout / draw = go box).

import { MATCH, PAL, CHESS } from '../config.js';
import { text, textWidth, panel, piece as drawPiece, boxer } from '../gfx.js';
import * as audio from '../audio.js';
import * as Chess from '../chess/board.js';
import { bestMove } from '../chess/engine.js';
import { HUE } from '../opponents.js';

// Board geometry. The board is enlarged to dominate the chess screen; the
// right-hand info panel slims to fit (clocks/material/HP all kept, just smaller).
const SQ = 44;
const OX = 17, OY = 40;          // board origin (left/right margins balanced ~9px each)
const BOARD_PX = SQ * 8;         // 352

export class ChessState {
  enter(game) {
    const m = game.match;
    this.m = m;
    // The chess game is CONTINUOUS across rounds: clocks were set once at match
    // start (game.startMatch) and persist, so we resume right where we left off.
    // Only the per-round wall-time window resets each chess half.
    this.halfTime = (MATCH.CHESS_HALF_SECONDS || MATCH.CHESS_SECONDS || 60) * 1000;
    this.t = 0;
    this.terminal = Chess.status(m.chess) !== 'ongoing'; // game already finished (e.g. drawn)?

    // board orientation. `targetFlip` is the logical orientation (black-at-bottom);
    // `this.flip` is what's actually drawn. In hotseat the drawn board eases to the
    // target each move via a card-flip (see _tickFlip); online/story always match.
    this.flip = this.targetFlip;
    this.flipAnim = null;                // { t, dur } while the board is turning around
    this.cursor = this.flip ? 11 : 52;   // start near the side-to-move's own pawns
    this.selected = -1;
    this.legalFrom = [];         // legal moves from selected square
    this.allLegal = Chess.legalMoves(m.chess);

    this.hoverSq = -1;           // square under the mouse
    this.drag = null;            // { from, px, py, vx, vy, scale, active, downX, downY }
    this.placeFx = null;         // { sq, t } settle bounce after a drop
    this.dropPending = false;    // a drag-drop promotion is being chosen

    this.phase = 'play';         // play | anim | aithink | ended | intro
    this.anim = null;
    this.preState = null;
    this.aiRequested = false;
    this.aiPending = null;       // {move, thinkMs}
    this.aiElapsed = 0;
    this.banner = m.round > 1 ? 'RESUME!' : 'FIGHT!';
    this.bannerT = 1.2;
    this.flagText = null;

    this.oppHue = m.mode === 'story' ? (HUE[m.opponent.hue] || HUE.red) : HUE.red;
    audio.playFightTheme(this.m.fightTrack);
  }

  // local hotseat: whoever is to move uses the shared keyboard.
  // online / story: local controls only the player's color.
  get myTurn() {
    if (this.m.mode === 'pvp' && !this.m.net) return true;
    return this.m.chess.turn === this.m.playerColor;
  }
  get remoteTurn() { return !!this.m.net && this.m.chess.turn !== this.m.playerColor; }
  get aiTurn() { return this.m.mode === 'story' && this.m.chess.turn !== this.m.playerColor; }
  // which color the local keyboard/mouse may move right now:
  // hotseat hands the shared controls to whoever is to move; otherwise it's the player's own color.
  get controlColor() { return (this.m.mode === 'pvp' && !this.m.net) ? this.m.chess.turn : this.m.playerColor; }

  // logical board orientation (black-at-bottom = true). In local hotseat the two
  // players share one mouse, so this follows the side to move (the drawn board then
  // animates to match — see _tickFlip). Online/story keep the local player's own
  // color facing them for the whole game.
  get targetFlip() {
    if (this.m.mode === 'pvp' && !this.m.net) return this.m.chess.turn === Chess.BLACK;
    return this.m.playerColor === Chess.BLACK;
  }

  // Esc opens the pause menu — but only when it isn't already busy doing
  // something Esc should back out of first (a selected piece, the promotion
  // picker) or resolving the half.
  canPause() {
    return (this.phase === 'play' || this.phase === 'aithink' || this.phase === 'anim') && this.selected < 0;
  }

  update(game, dt) {
    this.t += dt / 1000;
    if (this.bannerT > 0) this.bannerT -= dt / 1000;
    if (this.placeFx) { this.placeFx.t += dt; if (this.placeFx.t > 200) this.placeFx = null; }
    audio.playFightTheme(this.m.fightTrack);

    if (this.phase === 'ended') return;

    // the continuous game already concluded as a draw in an earlier round ->
    // nothing to play; head straight to boxing.
    if (this.terminal && this.bannerT <= 0) return this._endHalf(game);

    // half wall-clock
    this.halfTime -= dt;
    if (this.halfTime <= 0 && this.phase !== 'anim') return this._endHalf(game);

    // tick the side-to-move clock
    const side = this.m.chess.turn;
    if (this.phase === 'play' || this.phase === 'aithink') {
      this.m.clocks[side] -= dt;
      if (this.m.clocks[side] <= 0) return this._flag(game, side);
    }

    if (this.phase === 'anim') { this._tickAnim(game, dt); return; }
    if (this.phase === 'flip') { this._tickFlip(game, dt); return; }
    if (this.phase === 'promote') { this._promoInput(game); return; }

    if (this.remoteTurn) this._remoteTurn(game);
    else if (this.aiTurn) this._aiTurn(game, dt);
    else this._playerInput(game);
  }

  // online: apply a move relayed from the peer (rules are deterministic, so
  // replaying the same {from,to,flag,promo} yields an identical position).
  _remoteTurn(game) {
    const inbox = this.m.netInboxChess;
    if (inbox && inbox.length) {
      const mv = inbox.shift();
      this._startMove(game, mv, false);
    }
  }

  // ---- player ----------------------------------------------------------
  _playerInput(game) {
    const i = game.input;
    // keyboard cursor — arrows move relative to the player's view (works flipped too)
    let [vr, vc] = this._visRC(this.cursor);
    if (i.pressed('up') && vr > 0) { vr--; audio.sfx.select(); }
    if (i.pressed('down') && vr < 7) { vr++; audio.sfx.select(); }
    if (i.pressed('left') && vc > 0) { vc--; audio.sfx.select(); }
    if (i.pressed('right') && vc < 7) { vc++; audio.sfx.select(); }
    this.cursor = this._idxFromVis(vr, vc);
    if (i.pressed('cancel')) { this._deselect(); audio.sfx.select(); }
    if (i.pressed('confirm')) this._selectOrMove(game, this.cursor);
    // mouse / touch
    this._mouse(game);
  }

  _deselect() { this.selected = -1; this.legalFrom = []; this.drag = null; }

  // select a piece, or move the selected piece to `sq` (keyboard + click share this)
  _selectOrMove(game, sq) {
    const m = this.m, piece = m.chess.board[sq];
    if (this.selected === -1) {
      if (piece && Chess.colorOf(piece) === this.controlColor) {
        this.legalFrom = this.allLegal.filter((mv) => mv.from === sq);
        if (this.legalFrom.length) { this.selected = sq; audio.sfx.confirm(); } else audio.sfx.select();
      }
      return;
    }
    if (this.legalFrom.some((mv) => mv.to === sq)) return this._moveTo(game, sq, false);
    if (piece && Chess.colorOf(piece) === this.controlColor) {
      this.selected = sq; this.legalFrom = this.allLegal.filter((mv) => mv.from === sq); audio.sfx.confirm();
    } else this._deselect();
  }

  // mouse: hover, point-and-click, and drag-with-physics
  _mouse(game) {
    const i = game.input;
    const sq = this._squareAt(i.mouse.x, i.mouse.y);
    this.hoverSq = sq;

    if (i.mPressed && sq >= 0) {
      this.cursor = sq;
      const piece = this.m.chess.board[sq];
      if (piece && Chess.colorOf(piece) === this.controlColor) {
        // grab this piece (selects it AND starts a potential drag)
        this.selected = sq;
        this.legalFrom = this.allLegal.filter((mv) => mv.from === sq);
        const [cx, cy] = this._sqCenter(sq);
        this.drag = { from: sq, px: cx, py: cy, vx: 0, vy: 0, scale: 1, active: false, downX: i.mouse.x, downY: i.mouse.y };
        audio.sfx.confirm();
      } else if (this.selected >= 0 && this.legalFrom.some((mv) => mv.to === sq)) {
        this._moveTo(game, sq, false);               // click-to-move
      } else { this._deselect(); audio.sfx.select(); }
    }

    // drag physics: spring the held piece toward the cursor (lifted slightly)
    if (this.drag && i.mDown) {
      if (Math.hypot(i.mouse.x - this.drag.downX, i.mouse.y - this.drag.downY) > 5) this.drag.active = true;
      const tx = i.mouse.x, ty = i.mouse.y - 8;
      this.drag.vx = (this.drag.vx + (tx - this.drag.px) * 0.5) * 0.55;
      this.drag.vy = (this.drag.vy + (ty - this.drag.py) * 0.5) * 0.55;
      this.drag.px += this.drag.vx; this.drag.py += this.drag.vy;
      this.drag.scale += (1.3 - this.drag.scale) * 0.3;
    }

    if (i.mReleased && this.drag) {
      if (this.drag.active) {
        const dropSq = this._squareAt(i.mouse.x, i.mouse.y);
        if (dropSq >= 0 && this.legalFrom.some((mv) => mv.to === dropSq)) {
          this._moveTo(game, dropSq, true, this.drag.px, this.drag.py);
        } else { audio.sfx.select(); }          // failed drop: keep selection
      }
      this.drag = null;
    }
  }

  _moveTo(game, sq, viaDrag, fromX, fromY) {
    const candidates = this.legalFrom.filter((mv) => mv.to === sq);
    if (!candidates.length) return;
    if (candidates[0].promo) {
      this.promoCandidates = candidates; this.promoSel = 0; this.promoTo = sq;
      this.phase = 'promote'; this.dropPending = !!viaDrag; this.drag = null;
      audio.sfx.confirm(); return;
    }
    this._startMove(game, candidates[0], true, { drop: viaDrag, fromX, fromY });
  }

  // pixel coords -> board square index, or -1 if outside the board
  _squareAt(x, y) {
    if (x < OX || x >= OX + BOARD_PX || y < OY || y >= OY + BOARD_PX) return -1;
    const vc = Math.floor((x - OX) / SQ), vr = Math.floor((y - OY) / SQ);
    return this._idxFromVis(vr, vc);
  }

  // ---- promotion picker ------------------------------------------------
  _promoInput(game) {
    const i = game.input;
    if (i.pressed('left')) { this.promoSel = (this.promoSel + 3) % 4; audio.sfx.select(); }
    if (i.pressed('right')) { this.promoSel = (this.promoSel + 1) % 4; audio.sfx.select(); }
    if (i.pressed('cancel')) { this.phase = 'play'; this.promoCandidates = null; this._deselect(); this.dropPending = false; audio.sfx.select(); return; }
    // mouse: hover a cell to select, click to confirm
    const cellHit = this._promoCellAt(game, i.mouse.x, i.mouse.y);
    if (cellHit >= 0) this.promoSel = cellHit;
    if (i.pressed('confirm') || (i.mPressed && cellHit >= 0)) {
      const promo = ['q', 'r', 'b', 'n'][this.promoSel];
      const mv = this.promoCandidates.find((x) => x.promo === promo) || this.promoCandidates[0];
      this.phase = 'play'; this.promoCandidates = null; this.dropPending = false;
      audio.sfx.confirm();
      this._startMove(game, mv);
    }
  }
  _promoCellAt(game, x, y) {
    const cell = 46, pad = 8, w = 4 * cell + pad * 2;
    const x0 = Math.round(game.W / 2 - w / 2), y0 = 150, by = y0 + 24;
    if (y < by || y > by + cell - 4) return -1;
    const idx = Math.floor((x - (x0 + pad)) / cell);
    return idx >= 0 && idx < 4 && x >= x0 + pad ? idx : -1;
  }

  // ---- AI --------------------------------------------------------------
  _aiTurn(game, dt) {
    const m = this.m;
    if (!this.aiRequested) {
      this.aiRequested = true;
      this.aiElapsed = 0;
      this.phase = 'aithink';
      const elo = m.mode === 'story' ? m.opponent.elo : 1200;
      const fen = Chess.toFen(m.chess);
      bestMove(m.chess, { elo, fen }).then((res) => { this.aiPending = res; })
        .catch(() => { this.aiPending = { move: this.allLegal[0], thinkMs: 800 }; });
    }
    this.aiElapsed += dt;
    if (this.aiPending && this.aiElapsed >= this.aiPending.thinkMs) {
      const mv = this.aiPending.move;
      this.aiRequested = false; this.aiPending = null;
      if (!mv) return this._endHalf(game); // no legal move shouldn't happen (status covers it)
      this.phase = 'play';
      this._startMove(game, mv);
    }
  }

  // ---- move animation + commit ----------------------------------------
  _startMove(game, mv, local = true, opts = {}) {
    const m = this.m;
    // relay local moves to the online peer
    if (local && m.net) m.net.sendMove({ from: mv.from, to: mv.to, flag: mv.flag, promo: mv.promo || null });
    this.preState = m.chess;
    const piece = m.chess.board[mv.from];
    const capture = mv.flag === 'capture' || mv.flag === 'ep';
    const [sxc, syc] = this._sqCenter(mv.from);
    // a drag-drop animates from where you released; a click/keyboard move hops
    const startX = opts.drop && opts.fromX != null ? opts.fromX : sxc;
    const startY = opts.drop && opts.fromY != null ? opts.fromY : syc;
    this.anim = { mv, piece, t: 0, dur: opts.drop ? 150 : 240, capture, drop: !!opts.drop, startX, startY, white: Chess.colorOf(piece) === Chess.WHITE };
    this.phase = 'anim';
    this.selected = -1; this.legalFrom = []; this.drag = null;
    game.fx.spark(sxc, syc, this.anim.white ? PAL.blueLite : PAL.orangeLite, 5);
    audio.sfx.move();
  }

  _tickAnim(game, dt) {
    const a = this.anim;
    a.t += dt;
    const p = Math.min(1, a.t / a.dur);
    if (Math.random() < 0.5) {
      const [x, y] = this._animPos(p);
      game.fx.parts.push({ x, y, vx: 0, vy: 0, g: 0, life: 8, max: 8, color: a.white ? PAL.blue : PAL.orange, size: 2 });
    }
    if (p >= 1) this._commit(game);
  }

  _commit(game) {
    const m = this.m, a = this.anim;
    const [tx, ty] = this._sqCenter(a.mv.to);
    if (a.capture) { game.fx.burst(tx, ty, PAL.orange, 14, 3); game.fx.ring(tx, ty, PAL.gold); game.fx.doShake(6); audio.sfx.capture(); }
    else if (a.drop) { game.fx.ring(tx, ty, a.white ? PAL.blueLite : PAL.orangeLite, 16); game.fx.doShake(2); }
    this.placeFx = { sq: a.mv.to, t: 0 };          // settle bounce
    (m.pgnMoves ||= []).push(Chess.moveLabel(this.preState, a.mv)); // SAN for PGN
    const moved = this.preState.turn;
    m.chess = Chess.applyMove(this.preState, a.mv);
    m.clocks[moved] += (MATCH.CHESS_INCREMENT_MS || 0); // Fischer increment keeps the continuous clock alive
    this.anim = null;
    this.allLegal = Chess.legalMoves(m.chess);

    const st = Chess.status(m.chess);
    const justMovedColor = this.preState.turn;
    if (Chess.inCheck(m.chess) && st === 'ongoing') { audio.sfx.check(); game.fx.doFlash(PAL.red, 0.25); }

    if (st === 'checkmate') {
      // side to move is mated -> the mover wins
      const winnerColor = justMovedColor;
      const winner = winnerColor === m.playerColor ? 'player' : 'enemy';
      this._decide(game, winner, 'checkmate');
      return;
    }
    if (st === 'stalemate' || st === 'fifty' || st === 'material') {
      // chess drawn this game -> no chess winner; go to boxing
      this._endHalf(game);
      return;
    }
    // hotseat just handed control to the other side: if the board needs to turn
    // around, play the card-flip (which re-homes the cursor at its midpoint);
    // otherwise resume play immediately.
    if (this.flip !== this.targetFlip) { this.flipAnim = { t: 0, dur: 360 }; this.phase = 'flip'; }
    else this.phase = 'play';
  }

  // ---- endings ---------------------------------------------------------
  _flag(game, side) {
    const winnerColor = side === Chess.WHITE ? Chess.BLACK : Chess.WHITE;
    const winner = winnerColor === this.m.playerColor ? 'player' : 'enemy';
    this.flagText = (side === this.m.playerColor ? 'YOU' : 'OPPONENT') + ' FLAGGED';
    this._decide(game, winner, 'flag');
  }
  _decide(game, winner, reason) {
    this.phase = 'ended';
    audio.sfx.win();
    game.fx.doFlash(winner === 'player' ? PAL.blue : PAL.orange, 0.5);
    setTimeout(() => game.resolveChess({ decisive: true, winner, reason }), 900);
  }
  _endHalf(game) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    audio.sfx.bell();
    setTimeout(() => game.resolveChess({ decisive: false, winner: null, reason: 'time' }), 600);
  }

  // ---- geometry helpers ------------------------------------------------
  // board index <-> on-screen row/col, honoring the player's orientation (flip = black at bottom)
  _visRC(i) { const [r, c] = Chess.rc(i); return this.flip ? [7 - r, 7 - c] : [r, c]; }
  _idxFromVis(vr, vc) { const r = this.flip ? 7 - vr : vr, c = this.flip ? 7 - vc : vc; return r * 8 + c; }
  _sqXY(i) { const [vr, vc] = this._visRC(i); return [OX + vc * SQ, OY + vr * SQ]; }
  _sqCenter(i) { const [x, y] = this._sqXY(i); return [x + SQ / 2, y + SQ / 2]; }
  // returns the CENTER of the animated piece at progress p
  _animPos(p) {
    const a = this.anim;
    const sx = a.startX, sy = a.startY;
    const [tx, ty] = this._sqCenter(a.mv.to);
    if (a.drop) {
      const e = 1 - Math.pow(1 - p, 3);       // ease-out, no hop (it's being set down)
      return [sx + (tx - sx) * e, sy + (ty - sy) * e];
    }
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const hop = Math.sin(p * Math.PI) * 8;    // little travel arc
    return [sx + (tx - sx) * ease, sy + (ty - sy) * ease - hop];
  }

  // ---- board flip (hotseat card-flip) ----------------------------------
  // squash the board edge-on, swap orientation at the thin midpoint so the turn
  // never visibly "pops", then expand into the new view. Input is locked for the
  // brief duration (phase 'flip').
  _tickFlip(game, dt) {
    const f = this.flipAnim;
    f.t += dt;
    if (this.flip !== this.targetFlip && f.t >= f.dur / 2) {
      this.flip = this.targetFlip;            // swap while the board is edge-on
      this.cursor = this.flip ? 11 : 52;      // re-home the keyboard cursor to the new side
      audio.sfx.select();                     // soft tick at the turnover
    }
    if (f.t >= f.dur) { this.flipAnim = null; this.phase = 'play'; }
  }

  // horizontal squash factor for the flip (1 = face-on, ~0 = edge-on)
  _flipScaleX() {
    if (!this.flipAnim) return 1;
    const p = Math.min(1, this.flipAnim.t / this.flipAnim.dur);
    return Math.max(0.04, Math.abs(Math.cos(p * Math.PI)));
  }

  // ---- draw ------------------------------------------------------------
  draw(game, ctx) {
    const W = game.W, H = game.H;
    const m = this.m;

    // card-flip: squash the whole board horizontally around its center while the
    // hotseat board turns around (scaleX 1 -> ~0 -> 1). Side panel/banner are drawn
    // after restore(), so they stay put.
    const flipSx = this._flipScaleX();
    const bcx = OX + BOARD_PX / 2;
    ctx.save();
    ctx.translate(bcx, 0); ctx.scale(flipSx, 1); ctx.translate(-bcx, 0);

    // board frame
    panel(ctx, OX - 8, OY - 8, BOARD_PX + 16, BOARD_PX + 16, { fill: PAL.boardEdge, border: PAL.orange, border2: PAL.orangeDark });

    // squares
    for (let i = 0; i < 64; i++) {
      const [r, c] = Chess.rc(i);
      const [x, y] = this._sqXY(i);
      ctx.fillStyle = (r + c) % 2 ? PAL.boardDark : PAL.boardLight;
      ctx.fillRect(x, y, SQ, SQ);
    }
    // selection + legal hints
    if (this.selected >= 0) {
      const [sx, sy] = this._sqXY(this.selected);
      ctx.fillStyle = 'rgba(43,108,255,0.45)'; ctx.fillRect(sx, sy, SQ, SQ);
      for (const mv of this.legalFrom) {
        const [hx, hy] = this._sqCenter(mv.to);
        const cap = mv.flag === 'capture' || mv.flag === 'ep';
        ctx.fillStyle = cap ? 'rgba(255,59,83,0.7)' : 'rgba(57,217,138,0.7)';
        if (cap) { ctx.fillRect(hx - SQ / 2 + 2, hy - SQ / 2 + 2, SQ - 4, 3); ctx.fillRect(hx - SQ / 2 + 2, hy + SQ / 2 - 5, SQ - 4, 3); }
        else { ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    // check highlight
    if (Chess.inCheck(m.chess)) {
      const ks = Chess.kingSquare(m.chess.board, m.chess.turn);
      const [kx, ky] = this._sqXY(ks);
      ctx.fillStyle = `rgba(255,59,83,${0.3 + 0.2 * Math.sin(this.t * 10)})`;
      ctx.fillRect(kx, ky, SQ, SQ);
    }

    // hover highlight (mouse)
    if (this.hoverSq >= 0 && this.phase === 'play' && this.myTurn) {
      const [hx, hy] = this._sqXY(this.hoverSq);
      ctx.fillStyle = 'rgba(255,210,74,0.16)'; ctx.fillRect(hx, hy, SQ, SQ);
    }

    // pieces (centered, magical), skipping any held/animated piece
    const animFrom = this.anim ? this.anim.mv.from : -1;
    const dragFrom = this.drag ? this.drag.from : -1;
    for (let i = 0; i < 64; i++) {
      if (i === animFrom || i === dragFrom) continue;
      const pc = (this.anim ? this.preState.board : m.chess.board)[i];
      if (!pc) continue;
      const [cx, cy] = this._sqCenter(i);
      // settle bounce on a freshly placed piece
      let lift = 0;
      if (this.placeFx && this.placeFx.sq === i) lift = -Math.sin((1 - this.placeFx.t / 200) * Math.PI) * 4;
      const glow = i === this.selected ? 1.8 : 1;
      drawPiece(ctx, pc, cx, cy, SQ - 6, Chess.colorOf(pc) === Chess.WHITE, { t: this.t, phase: i * 0.7, lift, glow });
    }
    // animated piece (hop/drop)
    if (this.anim) {
      const p = Math.min(1, this.anim.t / this.anim.dur);
      const [ax, ay] = this._animPos(p);
      drawPiece(ctx, this.anim.piece, ax, ay, SQ - 6, this.anim.white, { t: this.t, glow: 1.4 });
    }
    // dragged piece (held in hand, lifted + enlarged)
    if (this.drag && this.drag.active) {
      const pc = m.chess.board[this.drag.from];
      if (pc) drawPiece(ctx, pc, this.drag.px, this.drag.py, (SQ - 6) * this.drag.scale, Chess.colorOf(pc) === Chess.WHITE, { t: this.t, glow: 2 });
    }

    // keyboard cursor
    if (this.phase === 'play' && this.myTurn) {
      const [cx, cy] = this._sqXY(this.cursor);
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 8);
      ctx.strokeStyle = `rgba(255,210,74,${pulse})`; ctx.lineWidth = 2;
      ctx.strokeRect(cx + 1, cy + 1, SQ - 2, SQ - 2);
    }
    ctx.restore();   // end card-flip squash

    this._sidePanel(game, ctx);
    this._controls(game, ctx);
    if (this.phase === 'promote') this._promoPicker(game, ctx);
    this._banner(game, ctx);
  }

  // slim one-line controls reminder tucked under the board (non-distracting).
  _controls(game, ctx) {
    const line = 'ARROWS MOVE   ENTER SELECT   ESC BACK   MOUSE DRAG/CLICK';
    const cx = OX + BOARD_PX / 2;
    const y = OY + BOARD_PX + 14;            // just below the board frame
    const w = textWidth(line, 1) + 16, h = 16;
    const x = Math.round(cx - w / 2);
    ctx.fillStyle = 'rgba(7,10,22,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(58,74,120,0.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    text(ctx, line, cx, y + 5, { scale: 1, color: PAL.textDim, align: 'center' });
  }

  _promoPicker(game, ctx) {
    const pieces = ['q', 'r', 'b', 'n'];
    const cell = 46, pad = 8;
    const w = pieces.length * cell + pad * 2;
    const x0 = Math.round(game.W / 2 - w / 2), y0 = 150;
    // dim the scene
    ctx.fillStyle = 'rgba(7,10,22,0.62)'; ctx.fillRect(0, 0, game.W, game.H);
    panel(ctx, x0, y0, w, cell + pad * 2 + 22, { fill: PAL.panel, border: PAL.orange, border2: PAL.orangeDark, glow: true });
    text(ctx, 'PROMOTE TO', game.W / 2, y0 + 6, { scale: 1, color: PAL.orangeLite, align: 'center' });
    const white = this.m.playerColor === Chess.WHITE;
    pieces.forEach((pc, i) => {
      const bx = x0 + pad + i * cell, by = y0 + 24;
      const on = i === this.promoSel;
      if (on) { ctx.fillStyle = 'rgba(255,210,74,0.30)'; ctx.fillRect(bx, by, cell - 4, cell - 4); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2; ctx.strokeRect(bx, by, cell - 4, cell - 4); }
      drawPiece(ctx, white ? pc.toUpperCase() : pc, bx + (cell - 4) / 2, by + (cell - 4) / 2, cell - 12, white, { t: this.t, phase: i });
    });
    text(ctx, 'ARROWS  ENTER  (ESC CANCEL)', game.W / 2, y0 + cell + pad + 12, { scale: 1, color: PAL.textDim, align: 'center' });
  }

  _sidePanel(game, ctx) {
    const W = game.W, m = this.m;
    const px = OX + BOARD_PX + 14, pw = W - px - 9;    // 383 / 120: slim column beside the bigger board
    // header
    text(ctx, 'PAWNCH', px, 12, { scale: 2, color: PAL.orange, shadow: PAL.ink });
    text(ctx, 'ROUND ' + m.round + '/' + MATCH.TOTAL_ROUNDS, px, 32, { scale: 1, color: PAL.textDim });
    text(ctx, 'CHESS HALF', px, 44, { scale: 1, color: PAL.blueLite });

    // clocks (smaller than before to fit the slim column, but still the focal info)
    const myColor = m.playerColor, oppColor = myColor === Chess.WHITE ? Chess.BLACK : Chess.WHITE;
    this._clock(ctx, px, 60, pw, 'OPPONENT', m.clocks[oppColor], m.chess.turn === oppColor, PAL.orange);
    this._clock(ctx, px, 114, pw, 'YOU', m.clocks[myColor], m.chess.turn === myColor, PAL.blue);

    // material
    const mat = Chess.material(m.chess.board);
    const myMat = myColor === Chess.WHITE ? mat.diff : -mat.diff;
    const my = 176;
    text(ctx, 'MATERIAL', px, my, { scale: 1, color: PAL.textDim });
    const sign = myMat > 0 ? '+' : '';
    text(ctx, myMat === 0 ? 'EVEN' : sign + myMat, px, my + 13, { scale: 2, color: myMat > 0 ? PAL.green : myMat < 0 ? PAL.red : PAL.textDim });

    // half timer + turn
    const hy = my + 44;
    text(ctx, 'HALF ENDS', px, hy, { scale: 1, color: PAL.textDim });
    text(ctx, Math.ceil(Math.max(0, this.halfTime) / 1000) + 'S', px, hy + 13, { scale: 2, color: PAL.gold });

    // mini portraits of fighters' HP carried into boxing
    const by = hy + 44;
    text(ctx, 'CARRIED HP', px, by, { scale: 1, color: PAL.textDim });
    this._hpBar(ctx, px, by + 13, pw, m.hp.player, PAL.blue, 'YOU');
    this._hpBar(ctx, px, by + 31, pw, m.hp.enemy, PAL.orange, 'OPP');

    if (this.phase === 'aithink') {
      const dots = '.'.repeat(1 + (Math.floor(this.t * 3) % 3));
      text(ctx, 'THINKING' + dots, px, game.H - 24, { scale: 1, color: PAL.orangeLite });
    } else if (this.myTurn && this.phase === 'play') {
      text(ctx, 'YOUR MOVE', px, game.H - 24, { scale: 1, color: PAL.blueLite });
    }
  }

  _clock(ctx, x, y, w, label, ms, active, col) {
    const h = 48;
    panel(ctx, x, y, w, h, { fill: active ? PAL.panel2 : PAL.panel, border: active ? col : PAL.line, border2: PAL.ink });
    text(ctx, label, x + 7, y + 7, { scale: 1, color: active ? PAL.white : PAL.textDim });
    const s = Math.max(0, ms / 1000);
    const mm = Math.floor(s / 60), ss = Math.floor(s % 60);
    const str = mm + ':' + String(ss).padStart(2, '0');
    const low = s < 10;
    text(ctx, str, x + 7, y + 20, { scale: 3, color: low ? PAL.red : active ? col : PAL.textDim, shadow: PAL.ink });
  }

  _hpBar(ctx, x, y, w, hp, col, label) {
    text(ctx, label, x, y, { scale: 1, color: PAL.textDim });
    const bx = x + 30, bw = w - 30;
    ctx.fillStyle = PAL.ink; ctx.fillRect(bx - 1, y - 1, bw + 2, 10);
    ctx.fillStyle = '#10162e'; ctx.fillRect(bx, y, bw, 8);
    ctx.fillStyle = col; ctx.fillRect(bx, y, Math.round(bw * Math.max(0, hp) / 100), 8);
  }

  _banner(game, ctx) {
    if (this.bannerT > 0) {
      const a = Math.min(1, this.bannerT / 0.3);
      ctx.globalAlpha = a;
      text(ctx, this.banner, game.W / 2, game.H / 2 - 20, { scale: 5, color: PAL.orange, align: 'center', shadow: PAL.ink });
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'ended') {
      let msg = this.flagText || (this.m.lastChessResult?.decisive ? 'CHECKMATE!' : 'TIME!');
      const col = this.m.lastChessResult?.winner === 'player' ? PAL.blue : PAL.orange;
      panel(ctx, game.W / 2 - 150, game.H / 2 - 34, 300, 60, { fill: PAL.panel, border: col, border2: PAL.ink });
      text(ctx, msg, game.W / 2, game.H / 2 - 14, { scale: 3, color: col, align: 'center', shadow: PAL.ink });
    }
  }
}
