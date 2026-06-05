// In-game pause overlay. Opened with Esc during a chess or boxing half (see
// Game.update / Game._canPauseNow). It draws OVER the frozen half — the live
// state is never torn down, so Resume continues exactly where you paused.
//
// Options: Resume, Settings (reuses the main-menu SettingsState, but returns
// here instead of to the title), and Save & Quit (parks the match so the title
// screen can offer "Continue").

import { PAL } from '../config.js';
import { text, panel } from '../gfx.js';
import * as audio from '../audio.js';
import { SettingsState } from './settings.js';

const ITEMS = [
  { id: 'resume', label: 'RESUME' },
  { id: 'settings', label: 'SETTINGS' },
  { id: 'save', label: 'SAVE & QUIT' },
];

export class PauseOverlay {
  constructor() {
    this.t = 0;
    this.sel = 0;
    this.settings = null;   // a hosted SettingsState while the sub-screen is open
  }

  update(game, dt) {
    this.t += dt / 1000;

    // while Settings is open it owns input until it calls our returnTo callback
    if (this.settings) { this.settings.update(game, dt); return; }

    const i = game.input;
    if (i.pressed('down')) { this.sel = (this.sel + 1) % ITEMS.length; audio.sfx.select(); }
    if (i.pressed('up')) { this.sel = (this.sel - 1 + ITEMS.length) % ITEMS.length; audio.sfx.select(); }
    if (i.pressed('cancel')) { audio.sfx.confirm(); game.closePause(); return; }   // Esc = resume

    if (i.pressed('confirm')) {
      const id = ITEMS[this.sel].id;
      if (id === 'resume') { audio.sfx.confirm(); game.closePause(); }
      else if (id === 'settings') {
        audio.sfx.confirm();
        this.settings = new SettingsState();
        this.settings.enter(game, { returnTo: () => { this.settings = null; this.sel = 0; } });
      } else if (id === 'save') {
        audio.sfx.confirm();
        game.saveMatchAndExit();
      }
    }
  }

  draw(game, ctx) {
    const W = game.W, H = game.H;

    // Settings sub-screen: hide the frozen half behind it, then draw it
    if (this.settings) {
      ctx.fillStyle = 'rgba(7,10,22,0.92)'; ctx.fillRect(0, 0, W, H);
      this.settings.draw(game, ctx);
      return;
    }

    // dim the frozen half so the menu reads clearly
    ctx.fillStyle = 'rgba(7,10,22,0.6)'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSED', W / 2, 92, { scale: 4, color: PAL.orange, align: 'center', shadow: PAL.ink });

    const baseY = 188;
    panel(ctx, W / 2 - 120, baseY - 16, 240, ITEMS.length * 34 + 16, { fill: PAL.panel, border: PAL.orange, border2: PAL.orangeDark });
    ITEMS.forEach((it, idx) => {
      const y = baseY + idx * 34;
      const on = idx === this.sel;
      if (on) {
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 8);
        ctx.fillStyle = `rgba(255,122,24,${0.25 + pulse * 0.25})`;
        ctx.fillRect(W / 2 - 110, y - 6, 220, 26);
        text(ctx, '>', W / 2 - 100, y, { scale: 2, color: PAL.orange });
        text(ctx, '<', W / 2 + 88, y, { scale: 2, color: PAL.orange });
      }
      text(ctx, it.label, W / 2, y, { scale: 2, color: on ? PAL.white : PAL.textDim, align: 'center', shadow: PAL.ink });
    });
    text(ctx, 'ESC RESUMES', W / 2, H - 38, { scale: 1, color: PAL.textDim, align: 'center' });
  }
}
