// Guided chess tutorial: a fixed opening where the player drives every piece
// type once, the opponent plays slightly weak, a capture nets a clean pawn, and
// each piece type is taught by a freeze-frame on first use. Self-contained — its
// own Chess game, no clocks/HP/rounds/resolve (those live in game.js for real
// matches). Looks like the real half (same board geometry + piece() art).

import { PAL } from '../config.js';
import { text, panel, piece as drawPiece } from '../gfx.js';
import * as audio from '../audio.js';
import * as Chess from '../chess/board.js';
import { TeachSequence } from '../teach.js';

const SQ = 44, OX = 17, OY = 40, BOARD_PX = SQ * 8;   // identical to the real chess half

// scripted line: each entry is the required player move (from->to) with the
// freeze-frame shown on its first use, then the opponent's auto-reply (or null).
const LINE = [
  { from: 52, to: 36, teach: { title: 'PAWNS', lines: ['Pawns march forward one square', '(two on their very first move).', 'They CAPTURE one square diagonally.', 'Push your pawn to the lit square.'] }, reply: { from: 12, to: 28 } },
  { from: 62, to: 45, teach: { title: 'KNIGHTS', lines: ['Knights move in an L: two then one —', 'and they JUMP over anything between.', 'The only piece that can.', 'Develop your knight.'] }, reply: { from: 1, to: 18 } },
  { from: 61, to: 34, teach: { title: 'BISHOPS', lines: ['Bishops glide along diagonals,', 'as far as the path is clear.', 'Aim yours at the center.'] }, reply: { from: 5, to: 26 } },
  { from: 60, to: 62, teach: { title: 'THE KING / CASTLING', lines: ['The king steps ONE square any direction.', 'Castling is its special move: the king', 'slides two toward the rook and the rook', 'hops to its other side — king tucked safe.'] }, reply: { from: 6, to: 21 } },
  { from: 61, to: 60, teach: { title: 'ROOKS', lines: ['Rooks slide in straight lines —', 'along ranks and files.', 'Swing your rook to the open file.'] }, reply: { from: 11, to: 19 } },
  { from: 59, to: 52, teach: { title: 'THE QUEEN', lines: ['The strongest piece: she moves like a', 'rook AND a bishop — any distance, straight', 'or diagonal. Bring her into play.'] }, reply: { from: 9, to: 25 } },
  { from: 34, to: 25, teach: { title: 'CAPTURING', lines: ['Land on an enemy piece to capture it.', 'Your opponent just blundered a pawn —', 'take it and go a pawn ahead!'] }, reply: null },
];

const OUTRO = { title: 'THAT IS A WINNING HALF', lines: ['You are up a pawn with a strong position.', 'In a real match, CHECKMATE or running your', "opponent's clock to zero wins the chess half", 'instantly. Press Enter to finish.'] };

export class TutorialChessState {
  enter(game) {
    this.chess = Chess.newGame();
    this.idx = 0;
    this.cursor = 52;
    this.selected = -1;
    this.anim = null;            // { mv, piece, t, dur, white }
    this.t = 0;
    this.hintT = 0;
    this.phase = 'teach';        // teach | play | anim | reply | done
    this.outroShown = false;
    this.teach = new TeachSequence();
    audio.playFightTheme(0);
    this._beginStep();
  }

  _beginStep() {
    const step = LINE[this.idx];
    if (!step) { this._finish(); return; }
    if (step.teach) { this.teach.queue([step.teach]); this.phase = 'teach'; }
    else this.phase = 'play';
  }

  _finish() {
    if (this.outroShown) return;
    this.outroShown = true;
    this.phase = 'done';
    this.teach.queue([OUTRO]);
  }

  update(game, dt) {
    this.t += dt / 1000;
    if (this.hintT > 0) this.hintT -= dt;
    audio.playFightTheme(0);

    if (game.input.pressed('cancel')) { audio.sfx.select(); game.changeState('tutorial'); return; }

    if (this.teach.active) {                       // a window owns the screen — FREEZE
      const finished = this.teach.update(game, dt);
      if (finished && this.phase === 'done') { game.changeState('tutorial'); return; }
      if (finished && this.phase === 'teach') this.phase = 'play';
      return;
    }

    if (this.phase === 'anim' || this.phase === 'reply') { this._tickAnim(game, dt); return; }
    if (this.phase === 'play') this._playerInput(game);
  }

  _playerInput(game) {
    const i = game.input;
    let [r, c] = Chess.rc(this.cursor);
    if (i.pressed('up') && r > 0) { r--; audio.sfx.select(); }
    if (i.pressed('down') && r < 7) { r++; audio.sfx.select(); }
    if (i.pressed('left') && c > 0) { c--; audio.sfx.select(); }
    if (i.pressed('right') && c < 7) { c++; audio.sfx.select(); }
    this.cursor = r * 8 + c;
    const msq = this._squareAt(i.mouse.x, i.mouse.y);
    if (i.mPressed && msq >= 0) { this.cursor = msq; this._tryPick(game, msq); }
    if (i.pressed('confirm')) this._tryPick(game, this.cursor);
  }

  // accept ONLY the scripted move; gently reject anything else.
  _tryPick(game, sq) {
    const step = LINE[this.idx];
    if (this.selected === step.from && sq === step.to) { this._playerMove(game, step); return; }
    if (sq === step.from) { this.selected = step.from; audio.sfx.confirm(); return; }
    this.selected = -1; this.hintT = 1400; audio.sfx.select();
  }

  _playerMove(game, step) {
    const mv = this._findMove(step.from, step.to);
    if (!mv) return;
    this.selected = -1;
    this._startAnim(game, mv, 'anim');
  }

  _startAnim(game, mv, nextPhase) {
    const piece = this.chess.board[mv.from];
    this.anim = { mv, piece, t: 0, dur: 240, white: Chess.colorOf(piece) === Chess.WHITE };
    this.phase = nextPhase;
    const [sx, sy] = this._sqCenter(mv.from);
    game.fx.spark(sx, sy, this.anim.white ? PAL.blueLite : PAL.orangeLite, 5);
    audio.sfx.move();
  }

  _tickAnim(game, dt) {
    const a = this.anim; a.t += dt;
    if (a.t < a.dur) return;
    const cap = a.mv.flag === 'capture' || a.mv.flag === 'ep';
    const [tx, ty] = this._sqCenter(a.mv.to);
    if (cap) { game.fx.burst(tx, ty, PAL.orange, 14, 3); game.fx.ring(tx, ty, PAL.gold); game.fx.doShake(6); audio.sfx.capture(); }
    this.chess = Chess.applyMove(this.chess, a.mv);
    this.anim = null;
    if (this.phase === 'anim') {
      const step = LINE[this.idx];
      if (step.reply) { const rmv = this._findMove(step.reply.from, step.reply.to); this._startAnim(game, rmv, 'reply'); }
      else { this.idx++; this._beginStep(); }
    } else {                                        // 'reply' done
      this.idx++; this._beginStep();
    }
  }

  _findMove(from, to) { return Chess.legalMoves(this.chess).find((m) => m.from === from && m.to === to) || null; }

  // geometry — tutorial is always white-at-bottom (no flip)
  _sqXY(i) { const [r, c] = Chess.rc(i); return [OX + c * SQ, OY + r * SQ]; }
  _sqCenter(i) { const [x, y] = this._sqXY(i); return [x + SQ / 2, y + SQ / 2]; }
  _squareAt(x, y) {
    if (x < OX || x >= OX + BOARD_PX || y < OY || y >= OY + BOARD_PX) return -1;
    return Math.floor((y - OY) / SQ) * 8 + Math.floor((x - OX) / SQ);
  }
  _animPos(p) {
    const a = this.anim, [sx, sy] = this._sqCenter(a.mv.from), [tx, ty] = this._sqCenter(a.mv.to);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const hop = Math.sin(p * Math.PI) * 8;
    return [sx + (tx - sx) * e, sy + (ty - sy) * e - hop];
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    panel(ctx, OX - 8, OY - 8, BOARD_PX + 16, BOARD_PX + 16, { fill: PAL.boardEdge, border: PAL.orange, border2: PAL.orangeDark });
    for (let i = 0; i < 64; i++) {
      const [r, c] = Chess.rc(i), [x, y] = this._sqXY(i);
      ctx.fillStyle = (r + c) % 2 ? PAL.boardDark : PAL.boardLight;
      ctx.fillRect(x, y, SQ, SQ);
    }
    // highlight the required move
    if (this.phase === 'play') {
      const step = LINE[this.idx];
      if (step) {
        const [fx, fy] = this._sqXY(step.from);
        ctx.fillStyle = `rgba(43,108,255,${0.3 + 0.2 * Math.sin(this.t * 8)})`;
        ctx.fillRect(fx, fy, SQ, SQ);
        const [hx, hy] = this._sqCenter(step.to);
        const cap = !!this.chess.board[step.to];
        ctx.fillStyle = cap ? 'rgba(255,59,83,0.85)' : 'rgba(57,217,138,0.85)';
        ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (this.selected >= 0) { const [sx, sy] = this._sqXY(this.selected); ctx.fillStyle = 'rgba(43,108,255,0.45)'; ctx.fillRect(sx, sy, SQ, SQ); }
    // pieces (skip the one currently animating)
    const animFrom = this.anim ? this.anim.mv.from : -1;
    for (let i = 0; i < 64; i++) {
      if (i === animFrom) continue;
      const pc = this.chess.board[i];
      if (!pc) continue;
      const [cx, cy] = this._sqCenter(i);
      drawPiece(ctx, pc, cx, cy, SQ - 6, Chess.colorOf(pc) === Chess.WHITE, { t: this.t, phase: i * 0.7, glow: i === this.selected ? 1.8 : 1 });
    }
    if (this.anim) {
      const p = Math.min(1, this.anim.t / this.anim.dur);
      const [ax, ay] = this._animPos(p);
      drawPiece(ctx, this.anim.piece, ax, ay, SQ - 6, this.anim.white, { t: this.t, glow: 1.4 });
    }
    if (this.phase === 'play') {
      const [cx, cy] = this._sqXY(this.cursor);
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 8);
      ctx.strokeStyle = `rgba(255,210,74,${pulse})`; ctx.lineWidth = 2; ctx.strokeRect(cx + 1, cy + 1, SQ - 2, SQ - 2);
    }
    this._sidePanel(game, ctx);
    if (this.hintT > 0) {
      ctx.globalAlpha = Math.min(1, this.hintT / 400);
      text(ctx, 'MAKE THE HIGHLIGHTED MOVE', OX + BOARD_PX / 2, OY + BOARD_PX + 14, { scale: 1, color: PAL.gold, align: 'center', shadow: PAL.ink });
      ctx.globalAlpha = 1;
    }
    this.teach.draw(game, ctx);
  }

  _sidePanel(game, ctx) {
    const px = OX + BOARD_PX + 14;
    text(ctx, 'TUTORIAL', px, 12, { scale: 2, color: PAL.orange, shadow: PAL.ink });
    text(ctx, 'LEARN CHESS', px, 32, { scale: 1, color: PAL.blueLite });
    text(ctx, 'MOVE ' + Math.min(this.idx + 1, LINE.length) + '/' + LINE.length, px, 50, { scale: 1, color: PAL.textDim });
    text(ctx, 'ESC: BACK', px, game.H - 20, { scale: 1, color: PAL.textDim });
  }
}
