// Settings: sound volumes, a controls diagram, and display options.

import { PAL } from '../config.js';
import { text, panel, barH, setPieceSet } from '../gfx.js';
import * as audio from '../audio.js';
import { DEFAULT_BINDINGS } from '../input.js';

// pretty-print a KeyboardEvent.code for the UI
function keyName(code) {
  if (!code) return '--';
  return code
    .replace('Key', '').replace('Digit', '').replace('Arrow', '')
    .replace('Left', ' L').replace('Right', ' R')
    .replace('ShiftL', 'SHIFT').replace('Space', 'SPACE').replace('Enter', 'ENTER')
    .replace('Escape', 'ESC').replace('Backspace', 'BKSP').toUpperCase();
}

export class SettingsState {
  enter(game, params = {}) {
    // Where BACK / Esc returns to: a state name (default 'title'), or a callback
    // (the in-game pause menu passes one so Settings returns to its overlay).
    this.returnTo = params.returnTo || 'title';
    this.tab = 0;             // 0 sound, 1 controls, 2 display
    this.sel = 0;
    this.tabs = ['SOUND', 'CONTROLS', 'DISPLAY'];
    this.capturing = null;    // action currently being rebound
    // remappable actions shown in the CONTROLS tab
    this.remap = [
      ['up', 'UP'], ['down', 'DOWN'], ['left', 'LEFT'], ['right', 'RIGHT'],
      ['confirm', 'CONFIRM'], ['cancel', 'CANCEL'],
      ['jabL', 'JAB L'], ['jabR', 'JAB R'], ['hookL', 'HOOK L'], ['hookR', 'HOOK R'],
      ['dodgeL', 'DODGE L'], ['dodgeR', 'DODGE R'], ['duck', 'DUCK'], ['block', 'GUARD'],
    ];
  }

  _rows(game) {
    if (this.tab === 0) return ['MASTER', 'MUSIC', 'SFX', 'BACK'];
    if (this.tab === 1) return [...this.remap.map((r) => r[0]), 'RESET', 'BACK'];
    return ['SCANLINES', 'SCALE', 'PIECES', 'BACK'];
  }

  update(game, dt) {
    const i = game.input;
    if (this.capturing) return; // waiting for a key to bind; input is swallowed
    const rows = this._rows(game);
    if (this.sel >= rows.length) this.sel = rows.length - 1;
    if (this.tab === 0) {
      if (i.pressed('left') && this.sel < rows.length - 1) this._adjust(game, -1);
      else if (i.pressed('right') && this.sel < rows.length - 1) this._adjust(game, +1);
    }
    if (this.tab === 2) {
      if (i.pressed('left')) this._adjust(game, -1);
      else if (i.pressed('right')) this._adjust(game, +1);
    }
    if (i.pressed('down')) { this.sel = (this.sel + 1) % rows.length; audio.sfx.select(); }
    if (i.pressed('up')) { this.sel = (this.sel - 1 + rows.length) % rows.length; audio.sfx.select(); }
    if (i.pressedCode('KeyE')) { this.tab = (this.tab + 1) % 3; this.sel = 0; audio.sfx.select(); }
    if (i.pressedCode('KeyQ')) { this.tab = (this.tab + 2) % 3; this.sel = 0; audio.sfx.select(); }
    if (i.pressed('confirm')) {
      const row = rows[this.sel];
      if (row === 'BACK') { audio.sfx.confirm(); game.persist(); this._back(game); }
      else if (row === 'RESET') { this._resetBindings(game); }
      else if (row === 'SCANLINES') { game.save.settings.scanlines = !game.save.settings.scanlines; audio.sfx.select(); }
      else if (row === 'SCALE') { this._cycleScale(game); }
      else if (row === 'PIECES') { this._cyclePieceSet(game); }
      else if (this.tab === 1) { this._beginRebind(game, row); }
    }
    if (i.pressed('cancel')) { audio.sfx.confirm(); game.persist(); this._back(game); }
  }

  _beginRebind(game, action) {
    this.capturing = action;
    audio.sfx.confirm();
    game.input.beginCapture((code) => {
      // Escape cancels; anything else becomes the new primary binding.
      if (code !== 'Escape') {
        game.save.settings.bindings[action] = [code];
        game.input.setBindings(game.save.settings.bindings);
        game.persist();
        audio.sfx.confirm();
      } else audio.sfx.select();
      this.capturing = null;
    });
  }

  _resetBindings(game) {
    game.save.settings.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    game.input.setBindings(game.save.settings.bindings);
    game.persist();
    audio.sfx.confirm();
  }

  // return to wherever Settings was opened from: a state name or a callback
  _back(game) {
    if (typeof this.returnTo === 'function') this.returnTo(game);
    else game.changeState(this.returnTo);
  }

  _adjust(game, dir) {
    const rows = this._rows(game);
    const row = rows[this.sel];
    const v = game.save.settings.volume;
    if (this.tab === 0) {
      if (row === 'MASTER') v.master = clamp(v.master + dir * 0.1);
      if (row === 'MUSIC') v.music = clamp(v.music + dir * 0.1);
      if (row === 'SFX') v.sfx = clamp(v.sfx + dir * 0.1);
      audio.setVolumes(v); audio.sfx.select();
    } else if (this.tab === 2) {
      if (row === 'SCANLINES') { game.save.settings.scanlines = !game.save.settings.scanlines; audio.sfx.select(); }
      if (row === 'SCALE') this._cycleScale(game);
      if (row === 'PIECES') this._cyclePieceSet(game);
    }
  }
  _cycleScale(game) {
    game.save.settings.scale = game.save.settings.scale === 'fit' ? 'integer' : 'fit';
    audio.sfx.select();
  }
  // Switch the active chess set. ARCANE is gated behind beating THE PAWNCHION;
  // while locked the row is inert (a soft blip, no change).
  _cyclePieceSet(game) {
    if (!game.save.unlocks.arcanePieces) { audio.sfx.select(); return; }
    const next = game.save.settings.pieceSet === 'arcane' ? 'celestial' : 'arcane';
    game.save.settings.pieceSet = next;
    setPieceSet(next);
    game.persist();
    audio.sfx.confirm();
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    text(ctx, 'SETTINGS', W / 2, 22, { scale: 3, color: PAL.orange, align: 'center', shadow: PAL.ink });

    // tab bar
    const tabW = 130, x0 = W / 2 - (tabW * 3) / 2;
    this.tabs.forEach((tname, i) => {
      const x = x0 + i * tabW;
      const on = i === this.tab;
      panel(ctx, x + 6, 56, tabW - 12, 24, { fill: on ? PAL.blueDark : PAL.panel, border: on ? PAL.blue : PAL.line, border2: PAL.ink });
      text(ctx, tname, x + tabW / 2, 62, { scale: 1, color: on ? PAL.white : PAL.textDim, align: 'center' });
    });
    text(ctx, 'Q / E  SWITCH TABS', W / 2, 90, { scale: 1, color: PAL.textDim, align: 'center' });

    panel(ctx, 60, 110, W - 120, H - 170, { fill: PAL.panel, border: PAL.orange, border2: PAL.orangeDark });
    if (this.tab === 0) this._sound(game, ctx);
    else if (this.tab === 1) this._controls(game, ctx);
    else this._display(game, ctx);

    text(ctx, 'ENTER SELECT   ESC BACK', W / 2, H - 26, { scale: 1, color: PAL.textDim, align: 'center' });
  }

  _sound(game, ctx) {
    const v = game.save.settings.volume;
    const rows = [['MASTER', v.master], ['MUSIC', v.music], ['SFX', v.sfx]];
    rows.forEach(([label, val], i) => {
      const y = 140 + i * 40;
      const on = this.sel === i;
      text(ctx, label, 90, y, { scale: 2, color: on ? PAL.white : PAL.textDim });
      barH(ctx, 230, y + 2, 160, 12, val, { fill: on ? PAL.orange : PAL.blue });
      text(ctx, Math.round(val * 100) + '', 410, y, { scale: 2, color: PAL.textDim });
    });
    const by = 140 + 3 * 40;
    text(ctx, 'BACK', 90, by, { scale: 2, color: this.sel === 3 ? PAL.white : PAL.textDim });
    text(ctx, 'ARROWS L/R ADJUST', 90, by + 36, { scale: 1, color: PAL.textDim });
  }

  _controls(game, ctx) {
    const W = game.W;
    const b = game.save.settings.bindings;
    text(ctx, 'REBIND: SELECT AN ACTION + PRESS ENTER, THEN A KEY', W / 2, 120, { scale: 1, color: PAL.orangeLite, align: 'center' });
    // two columns of 7 actions
    const colX = [80, W / 2 + 20];
    this.remap.forEach(([action, label], idx) => {
      const col = idx < 7 ? 0 : 1, row = idx % 7;
      const x = colX[col], y = 140 + row * 20;
      const on = this.sel === idx;
      if (on) { ctx.fillStyle = 'rgba(255,210,74,0.22)'; ctx.fillRect(x - 6, y - 3, W / 2 - 80, 18); }
      text(ctx, label, x, y, { scale: 1, color: on ? PAL.white : PAL.textDim });
      const cap = this.capturing === action;
      text(ctx, cap ? 'PRESS KEY' : keyName(b[action]?.[0]), x + 120, y, { scale: 1, color: cap ? PAL.green : on ? PAL.orange : PAL.text });
    });
    // RESET + BACK
    const ry = 140 + 7 * 20 + 12;
    const resetOn = this.sel === this.remap.length;
    const backOn = this.sel === this.remap.length + 1;
    text(ctx, (resetOn ? '> ' : '  ') + 'RESET DEFAULTS', W / 2, ry, { scale: 1, color: resetOn ? PAL.white : PAL.textDim, align: 'center' });
    text(ctx, (backOn ? '> ' : '  ') + 'BACK', W / 2, ry + 18, { scale: 2, color: backOn ? PAL.white : PAL.textDim, align: 'center' });
    text(ctx, 'BOXING TIP: DODGE THEN PUNCH = COUNTER -> STAR', W / 2, ry + 44, { scale: 1, color: PAL.textDim, align: 'center' });

    if (this.capturing) {
      ctx.fillStyle = 'rgba(7,10,22,0.7)'; ctx.fillRect(0, 0, W, game.H);
      text(ctx, 'PRESS A KEY FOR', W / 2, game.H / 2 - 24, { scale: 1, color: PAL.textDim, align: 'center' });
      const lbl = this.remap.find((r) => r[0] === this.capturing)?.[1] || this.capturing;
      text(ctx, lbl, W / 2, game.H / 2 - 6, { scale: 3, color: PAL.orange, align: 'center', shadow: PAL.ink });
      text(ctx, '(ESC TO CANCEL)', W / 2, game.H / 2 + 28, { scale: 1, color: PAL.textDim, align: 'center' });
    }
  }

  _display(game, ctx) {
    const W = game.W;
    const s = game.save.settings;
    const unlocked = !!game.save.unlocks.arcanePieces;
    const setLabel = s.pieceSet === 'arcane' ? 'ARCANE' : 'CELESTIAL';
    const rows = [
      ['SCANLINES', s.scanlines ? 'ON' : 'OFF', true],
      ['SCALE', s.scale === 'fit' ? 'FIT SCREEN' : 'INTEGER', true],
      ['PIECES', unlocked ? setLabel : 'LOCKED', unlocked],
    ];
    rows.forEach(([label, val, enabled], i) => {
      const y = 144 + i * 38;
      const on = this.sel === i;
      text(ctx, label, 100, y, { scale: 2, color: on ? PAL.white : PAL.textDim });
      text(ctx, val, 320, y, { scale: 2, color: enabled ? PAL.orange : PAL.line });
    });
    // hint line under the PIECES row
    text(ctx, unlocked ? 'CELESTIAL = SUN & GALAXY    ARCANE = CLASSIC SET'
                       : 'BEAT THE PAWNCHION TO UNLOCK THE ARCANE SET',
      W / 2, 144 + 3 * 38 - 2, { scale: 1, color: unlocked ? PAL.textDim : PAL.orangeLite, align: 'center' });
    const by = 144 + 3 * 38 + 16;
    text(ctx, 'BACK', 100, by, { scale: 2, color: this.sel === 3 ? PAL.white : PAL.textDim });
    text(ctx, 'ARROWS L/R OR ENTER TO TOGGLE', 100, by + 28, { scale: 1, color: PAL.textDim });
  }
}

function clamp(v) { return Math.max(0, Math.min(1, Math.round(v * 10) / 10)); }
