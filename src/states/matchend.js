// Match end: WIN / LOSE / DRAW screen. In story mode a win advances progress
// and offers "Ready for the next opponent?"; a loss offers a rematch.

import { PAL, SCENERY } from '../config.js';
import { text, panel, boxer, logo } from '../gfx.js';
import * as audio from '../audio.js';
import { OPPONENTS, HUE } from '../opponents.js';
import { tossColor } from '../chess/board.js';

export class MatchEndState {
  enter(game) {
    this.t = 0;
    this.m = game.match;
    this.win = this.m.winner === 'player';
    this.isDraw = this.m.winner === 'draw';
    this.story = this.m.mode === 'story';
    this.sel = 0;

    if (this.story && this.win) {
      // advance progress (don't exceed roster length). `advanced` is false when
      // this was a REPLAY of an already-beaten opponent (progress unchanged).
      const prev = game.save.storyProgress;
      game.save.storyProgress = Math.min(OPPONENTS.length, Math.max(game.save.storyProgress, this.m.opponent.index + 1));
      this.advanced = game.save.storyProgress > prev;
      this.lastOpponent = this.m.opponent.index >= OPPONENTS.length - 1;
      // Beating THE PAWNCHION unlocks the ARCANE chess set (pick it in Settings).
      this.unlockedArcane = this.lastOpponent && !game.save.unlocks.arcanePieces;
      if (this.unlockedArcane) game.save.unlocks.arcanePieces = true;
      // Beating a fighter unlocks THEIR arena for multiplayer (idempotent on replays).
      const scene = SCENERY.OPPONENT_SCENES[this.m.opponent.index];
      this.unlockedArena = null;
      if (scene && !game.save.unlocks.arenas[scene]) {
        game.save.unlocks.arenas[scene] = true;
        this.unlockedArena = SCENERY.NAMES[scene];
      }
      game.persist();
    }
    this.options = this._buildOptions();
    if (this.win && !this.isDraw) audio.sfx.win(); else audio.sfx.ko();
  }

  _buildOptions() {
    if (!this.story) return ['REMATCH', 'MAIN MENU'];
    if (this.win) {
      if (this.lastOpponent) return ['SEE ENDING', 'MAIN MENU'];
      // a genuine ladder advance vs replaying an already-beaten fighter
      return [this.advanced ? 'NEXT OPPONENT' : 'FIGHT SELECT', 'MAIN MENU'];
    }
    return ['REMATCH', 'MAIN MENU'];
  }

  update(game, dt) {
    this.t += dt / 1000;
    const i = game.input;
    if (this.t < 1.2) return; // let the result land
    if (i.pressed('up') || i.pressed('down')) { this.sel ^= 1; audio.sfx.select(); }
    if (i.pressed('confirm')) {
      audio.sfx.confirm();
      const choice = this.options[this.sel];
      if (choice === 'MAIN MENU') return game.changeState('title');
      // back to the fight-select gallery; flash the portrait we just unlocked
      if (choice === 'SEE ENDING' || choice === 'NEXT OPPONENT' || choice === 'FIGHT SELECT')
        return game.changeState('story', { reveal: this.m.opponent.index });
      if (choice === 'REMATCH') {
        const opp = this.m.opponent;
        game.startMatch({ mode: this.m.mode, opponent: opp, playerColor: tossColor() });   // fresh coin toss each rematch
        return game.changeState('walk');
      }
    }
    // P = export the chess game as a .pgn file
    if (i.pressedCode('KeyP') && !this.exported) {
      this.exported = true;
      audio.sfx.confirm();
      downloadPGN(this.m);
    }
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    const big = this.isDraw ? 'DRAW' : this.win ? 'WINNER!' : 'K.O.';
    const col = this.isDraw ? PAL.gold : this.win ? PAL.blue : PAL.orange;

    // celebratory beams
    ctx.save(); ctx.globalAlpha = 0.12;
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? PAL.blue : PAL.orange;
      ctx.save(); ctx.translate(W / 2, 150); ctx.rotate(i * 0.4 + this.t * 0.4);
      ctx.fillRect(0, -8, 400, 16); ctx.restore();
    }
    ctx.restore();

    const bob = Math.sin(this.t * 4) * 4;
    text(ctx, big, W / 2, 60 + bob, { scale: 6, color: col, align: 'center', shadow: PAL.ink });

    // who
    const winnerIsPlayer = this.win;
    const hue = this.story && !winnerIsPlayer ? (HUE[this.m.opponent.hue] || HUE.red) : HUE.player;
    boxer(ctx, W / 2, 198, 5, hue, this.isDraw ? 'idle' : 'guard', 1, this.t * 6);

    // reason line
    const reasons = { checkmate: 'BY CHECKMATE', flag: 'ON THE CLOCK', ko: 'BY KNOCKOUT', material: 'ON MATERIAL', draw: 'EVEN MATERIAL' };
    text(ctx, reasons[this.m.reason] || '', W / 2, 282, { scale: 1, color: PAL.textDim, align: 'center' });

    if (this.story) {
      const label = this.win ? 'YOU BEAT ' + this.m.opponent.name : this.m.opponent.name + ' WINS';
      text(ctx, label, W / 2, 300, { scale: 1, color: PAL.text, align: 'center' });
    }

    // menu
    if (this.t > 1.2) {
      if (this.story && this.win && !this.lastOpponent)
        text(ctx, this.advanced ? 'READY FOR THE NEXT OPPONENT?' : 'BACK TO THE FIGHT SELECT', W / 2, 312, { scale: 1, color: PAL.orangeLite, align: 'center' });
      if (this.unlockedArcane)
        text(ctx, 'ARCANE CHESS SET UNLOCKED!', W / 2, 312, { scale: 1, color: PAL.gold, align: 'center' });
      if (this.unlockedArena)
        text(ctx, this.unlockedArena + ' ARENA UNLOCKED!', W / 2, 326, { scale: 1, color: PAL.green, align: 'center' });
      this.options.forEach((opt, idx) => {
        const y = 340 + idx * 28;
        const on = idx === this.sel;
        if (on) text(ctx, '>', W / 2 - 90, y, { scale: 2, color: PAL.orange });
        text(ctx, opt, W / 2, y, { scale: 2, color: on ? PAL.white : PAL.textDim, align: 'center', shadow: PAL.ink });
      });
      const pgnHint = this.exported ? 'PGN SAVED!' : 'P = EXPORT CHESS GAME (PGN)';
      if ((this.m.pgnMoves || []).length)
        text(ctx, pgnHint, W / 2, H - 16, { scale: 1, color: this.exported ? PAL.green : PAL.textDim, align: 'center' });
    }
  }
}

// Build a standard PGN string from the match's recorded SAN move log.
function buildPGN(m) {
  const oppName = m.mode === 'story' ? m.opponent.name : (m.opponent?.name || 'Rival');
  const white = m.playerColor === 'w' ? 'You' : oppName;
  const black = m.playerColor === 'w' ? oppName : 'You';
  const oppColor = m.playerColor === 'w' ? 'b' : 'w';
  let result = '*';
  if (m.reason === 'checkmate' || m.reason === 'flag') {
    const winColor = m.winner === 'player' ? m.playerColor : oppColor;
    result = winColor === 'w' ? '1-0' : '0-1';
  }
  const term = { checkmate: 'Checkmate', flag: 'Time forfeit', ko: 'Decided in the ring (KO)', material: 'Material count', draw: 'Drawn' }[m.reason] || 'Unfinished';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const tags = [
    `[Event "PAWNCH Story Match"]`, `[Site "PAWNCH"]`, `[Date "${date}"]`,
    `[White "${white}"]`, `[Black "${black}"]`, `[Result "${result}"]`,
    `[Termination "${term}"]`, m.mode === 'story' ? `[OpponentElo "${m.opponent.elo}"]` : null,
  ].filter(Boolean).join('\n');
  let body = '';
  (m.pgnMoves || []).forEach((san, i) => { if (i % 2 === 0) body += `${i / 2 + 1}. `; body += san + ' '; });
  body += result;
  return tags + '\n\n' + body.trim() + '\n';
}

function downloadPGN(m) {
  try {
    const pgn = buildPGN(m);
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pawnch_${new Date().toISOString().slice(0, 10)}.pgn`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { console.error('[PAWNCH] PGN export failed', e); }
}
