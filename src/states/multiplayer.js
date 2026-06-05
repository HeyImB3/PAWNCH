// Multiplayer hub: LOCAL hotseat (fully playable now) and ONLINE (connects to
// the bundled WebSocket server, matchmakes, then plays with deterministic
// chess-move relay + local-authority boxing relay).

import { PAL } from '../config.js';
import { text, panel } from '../gfx.js';
import * as audio from '../audio.js';
import { NetClient } from '../net.js';
import { WHITE, BLACK } from '../chess/board.js';

export class MultiplayerState {
  enter(game) {
    this.t = 0;
    this.mode = 'menu';          // menu | connecting | queue | error
    this.sel = 0;
    this.items = ['LOCAL HOTSEAT', 'ONLINE MATCH', 'BACK'];
    this.msg = '';
    this.net = null;
  }

  update(game, dt) {
    this.t += dt / 1000;
    const i = game.input;

    if (this.mode === 'menu') {
      if (i.pressed('down')) { this.sel = (this.sel + 1) % this.items.length; audio.sfx.select(); }
      if (i.pressed('up')) { this.sel = (this.sel - 1 + this.items.length) % this.items.length; audio.sfx.select(); }
      if (i.pressed('cancel')) { audio.sfx.confirm(); game.changeState('title'); }
      if (i.pressed('confirm')) {
        audio.sfx.confirm();
        if (this.sel === 0) this._startLocal(game);
        else if (this.sel === 1) this._startOnline(game);
        else game.changeState('title');
      }
    } else if (this.mode === 'connecting' || this.mode === 'queue') {
      if (i.pressed('cancel')) { this.net?.leave(); this.net = null; this.mode = 'menu'; }
    } else if (this.mode === 'error') {
      if (i.pressed('confirm') || i.pressed('cancel')) this.mode = 'menu';
    }
  }

  _startLocal(game) {
    game.startMatch({
      mode: 'pvp',
      opponent: { name: 'PLAYER 2', boxing: null },
      playerColor: WHITE,
    });
    game.changeState('walk');
  }

  async _startOnline(game) {
    this.mode = 'connecting';
    this.msg = 'CONNECTING...';
    this.net = new NetClient();
    try {
      await this.net.connect();
      this.mode = 'queue';
      this.msg = 'WAITING FOR OPPONENT...';
      this.net.on('matched', (m) => this._onMatched(game, m));
      this.net.on('opponentLeft', () => { this.mode = 'error'; this.msg = 'OPPONENT LEFT'; });
      this.net.queue('PLAYER');
    } catch (e) {
      this.mode = 'error';
      this.msg = 'NO SERVER FOUND. RUN: NPM RUN SERVER';
    }
  }

  _onMatched(game, m) {
    const myColor = m.color === 'b' ? BLACK : WHITE;
    game.startMatch({
      mode: 'pvp',
      opponent: { name: m.oppName || 'RIVAL', boxing: null },
      playerColor: myColor,
      net: this.net,
    });
    // shared inboxes used by chess/boxing states for relayed events
    game.match.netInboxChess = [];
    game.match.netInboxBox = [];
    game.match.netStatus = null;     // null | {msg, color} -> drawn as a banner
    this.net.on('move', (msg) => game.match.netInboxChess.push(msg.move));
    this.net.on('box', (msg) => game.match.netInboxBox.push(msg.action));
    // connection lifecycle -> a global status banner (see Game.draw)
    const set = (msg, color) => { if (game.match) game.match.netStatus = msg ? { msg, color } : null; };
    this.net.on('opponentDisconnected', () => set('OPPONENT DROPPED — HOLDING...', '#ffd24a'));
    this.net.on('reconnecting', (d) => set('RECONNECTING (' + d.attempt + ')...', '#ffd24a'));
    this.net.on('reconnected', () => set('RECONNECTED!', '#39d98a'));
    this.net.on('opponentReturned', () => set('OPPONENT RETURNED!', '#39d98a'));
    this.net.on('opponentLeft', () => set('OPPONENT LEFT — NO CONTEST', '#ff3b53'));
    this.net.on('gaveup', () => set('CONNECTION LOST', '#ff3b53'));
    game.changeState('walk');
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    text(ctx, 'MULTIPLAYER', W / 2, 40, { scale: 3, color: PAL.orange, align: 'center', shadow: PAL.ink });

    if (this.mode === 'menu') {
      panel(ctx, W / 2 - 140, 150, 280, 150, { fill: PAL.panel, border: PAL.blue, border2: PAL.blueDark });
      this.items.forEach((it, idx) => {
        const y = 170 + idx * 40;
        const on = idx === this.sel;
        if (on) text(ctx, '>', W / 2 - 110, y, { scale: 2, color: PAL.orange });
        text(ctx, it, W / 2, y, { scale: 2, color: on ? PAL.white : PAL.textDim, align: 'center', shadow: PAL.ink });
      });
      text(ctx, 'LOCAL: SHARED KEYBOARD, P1 VS P2', W / 2, 330, { scale: 1, color: PAL.textDim, align: 'center' });
      text(ctx, 'ONLINE: NEEDS THE PAWNCH SERVER RUNNING', W / 2, 348, { scale: 1, color: PAL.textDim, align: 'center' });
    } else {
      const dots = '.'.repeat(1 + (Math.floor(this.t * 3) % 3));
      text(ctx, this.mode === 'error' ? this.msg : this.msg + dots, W / 2, H / 2, { scale: 1.5, color: this.mode === 'error' ? PAL.red : PAL.blueLite, align: 'center' });
      text(ctx, this.mode === 'error' ? 'PRESS ENTER' : 'ESC TO CANCEL', W / 2, H / 2 + 40, { scale: 1, color: PAL.textDim, align: 'center' });
    }
  }
}
