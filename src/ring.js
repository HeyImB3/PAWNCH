// The physical ring as a stateful view: painted kit pieces (mat/post/pad/stool/
// press) when loaded, per-piece procedural fallback otherwise, plus DYNAMIC
// ropes (src/ropes.js waves), accent-tinted turnbuckle pads, and fight-memory
// mat decals. Presentation-only — owns no gameplay state.
import { RING, PAL } from './config.js';
import { ringSprite, ring as legacyRing, mix, shade, mixA } from './gfx.js';
import { ropeOffset, pruneImpulses } from './ropes.js';

export class RingView {
  constructor({ floorTop = 170 } = {}) {
    this.floorTop = floorTop;
    this.impulses = [];
    this.decals = [];
    this.t = 0;
    this._padTint = null;      // offscreen accent-tinted pad cache
    this._padAccent = null;
  }
  impact(x, mag = 1) { this.impulses.push({ x, t0: this.t, mag: Math.min(1, mag) }); }
  addDecal(x, y, kind = 'scuff') {
    this.decals.push({ x, y, kind, r: 3 + Math.random() * 5, a: Math.random() * Math.PI });
    if (this.decals.length > RING.DECALS.MAX) this.decals.shift();
  }
  clearDecals() { this.decals = []; }
  update(dt) { this.t += dt; this.impulses = pruneImpulses(this.impulses, this.t, RING.ROPES); }

  draw(ctx, W, H, { accent = PAL.blue, crowd = 0, stool = false } = {}) {
    const ft = this.floorTop;
    const mat = ringSprite('mat');
    if (!mat) {
      // zero-asset path: the legacy ring, untouched and pixel-identical — do NOT
      // layer dynamic ropes/pads over it (double-draw ghosting).
      legacyRing(ctx, W, H, { floorTop: ft, accent, crowd });
      return;
    }
    ctx.drawImage(mat, 0, ft);
    // accent band along the apron strip (painted neutral; opponent hue here)
    ctx.fillStyle = mixA(accent, 0.28); ctx.fillRect(0, ft + 2, W, 4);
    this._drawDecals(ctx);
    this._ropes(ctx, W, accent);
    this._posts(ctx, W, accent);
    if (stool) { const st = ringSprite('stool'); if (st) ctx.drawImage(st, 10, ft - 20); }
  }

  // press row is drawn SEPARATELY (in front of the fighters) by the caller
  drawPress(ctx, W, H) {
    const press = ringSprite('press');
    if (press) ctx.drawImage(press, 0, H - press.height);
  }

  _drawDecals(ctx) {
    for (const d of this.decals) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
      if (d.kind === 'sweat') {
        ctx.globalAlpha = RING.DECALS.SWEAT_ALPHA; ctx.fillStyle = PAL.blueLite;
        ctx.beginPath(); ctx.ellipse(0, 0, d.r * 0.5, d.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = RING.DECALS.SCUFF_ALPHA; ctx.fillStyle = PAL.ink;
        ctx.fillRect(-d.r, -1, d.r * 2, 2);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  _ropes(ctx, W, accent) {
    const C = RING.ROPES, ft = this.floorTop;
    const ropes = [
      { y: ft - 40, body: PAL.orange, hi: PAL.gold },
      { y: ft - 26, body: '#e8f2ff', hi: PAL.white },
      { y: ft - 12, body: accent, hi: mix(accent, '#ffffff', 0.5) },
    ];
    ropes.forEach((r, i) => {
      for (let x = 0; x <= W; x += 8) {
        const off = ropeOffset(x, W, this.t, this.impulses, C, i * 1.7);
        const y = Math.round(r.y + off);
        ctx.fillStyle = shade(r.body, -35); ctx.fillRect(x, y + 2, 9, 1);   // under-shade
        ctx.fillStyle = r.body; ctx.fillRect(x, y, 9, 2);                   // body
        ctx.fillStyle = r.hi; ctx.fillRect(x, y, 9, 1);                     // top highlight
      }
    });
  }

  _posts(ctx, W, accent) {
    const ft = this.floorTop, post = ringSprite('post');
    const ropeYs = [ft - 40, ft - 26, ft - 12];
    for (const side of [0, 1]) {
      const flip = side === 1;
      if (post) {
        ctx.save();
        if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
        ctx.drawImage(post, 8, ft - 60);
        ctx.restore();
      } else {                // painted mat but no post sprite: legacy post bits
        const px = flip ? W - 24 : 8;
        ctx.fillStyle = '#0e1430'; ctx.fillRect(px, ft - 52, 16, 66);
        ctx.fillStyle = shade(accent, -20); ctx.fillRect(px - 1, ft - 52, 18, 4);
      }
      const pad = this._tintedPad(accent);
      for (const ry of ropeYs) {
        const off = ropeOffset(flip ? W - 2 : 2, W, this.t, this.impulses, RING.ROPES, 0);
        const px = flip ? W - 24 : 8;
        if (pad) ctx.drawImage(pad, px - 2, Math.round(ry + off) - 3);
        else { ctx.fillStyle = accent; ctx.fillRect(px - 2, Math.round(ry + off) - 2, 20, 9); }
      }
    }
  }

  // pad.png is painted in grayscale; tint it once per accent via source-atop
  _tintedPad(accent) {
    const pad = ringSprite('pad');
    if (!pad) return null;
    if (this._padAccent !== accent) {
      const cv = (this._padTint ||= document.createElement('canvas'));
      cv.width = pad.width; cv.height = pad.height;
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      c.drawImage(pad, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = mixA(accent, 0.55); c.fillRect(0, 0, cv.width, cv.height);
      c.globalCompositeOperation = 'source-over';
      this._padAccent = accent;
    }
    return this._padTint;
  }
}
