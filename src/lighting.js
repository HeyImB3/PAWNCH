// Additive-light helpers over crisp pixels — the hi-bit "glow pass" (Art Bible
// v2 rule 6). Presentation-only; every function draws and restores state.
import { LIGHT, RING, PAL } from './config.js';
import { withA } from './gfx.js';

// FX intensity (Settings VIDEO tab): 'low' halves particle counts and drops
// the costliest passes. Set once at boot + on toggle (game.js / settings.js).
let _fxLow = false;
export function setFxLow(low) { _fxLow = !!low; }
export function fxLow() { return _fxLow; }

export function additiveGlow(ctx, x, y, r, color, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withA(color, a)); g.addColorStop(1, withA(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function spotCone(ctx, { cx, topY, floorY, topHalfW, botHalfW, color, alpha }) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, topY, 0, floorY);
  g.addColorStop(0, withA(color, alpha)); g.addColorStop(1, withA(color, alpha * 0.25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - topHalfW, topY); ctx.lineTo(cx + topHalfW, topY);
  ctx.lineTo(cx + botHalfW, floorY); ctx.lineTo(cx - botHalfW, floorY);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// darkness with a soft transparent hole — the knockdown dim
export function dimHole(ctx, W, H, cx, cy, holeR, alpha) {
  const g = ctx.createRadialGradient(cx, cy, holeR * 0.45, cx, cy, Math.max(W, H));
  g.addColorStop(0, 'rgba(3,4,10,0)'); g.addColorStop(0.55, `rgba(3,4,10,${alpha})`);
  g.addColorStop(1, `rgba(3,4,10,${alpha})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

export function tintWash(ctx, W, H, color, alpha) {
  if (alpha <= 0) return;
  ctx.fillStyle = withA(color, alpha); ctx.fillRect(0, 0, W, H);
}

// faint flipped reflection on the glossy mat: run drawCb mirrored about feetY
export function reflect(ctx, feetY, drawCb) {
  if (_fxLow) return;                       // the priciest pass — dropped on LOW
  const R = RING.REFLECT;
  ctx.save();
  ctx.translate(0, feetY); ctx.scale(1, -R.SQUASH); ctx.translate(0, -feetY);
  ctx.globalAlpha = R.ALPHA;
  drawCb();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// the knockdown spotlight: dim world + cone + drifting dust motes. k = 0..1.
export function spotlightMoment(ctx, W, H, cx, cy, k, t = performance.now() / 1000) {
  if (k <= 0) return;
  const S = LIGHT.SPOT;
  dimHole(ctx, W, H, cx, cy, S.HOLE_R, S.DIM * k);
  spotCone(ctx, { cx, topY: 0, floorY: cy + 40, topHalfW: S.TOP_HALF_W, botHalfW: S.HOLE_R * 0.8, color: PAL.gold, alpha: S.CONE_ALPHA * k });
  if (_fxLow) return;
  for (let i = 0; i < 8; i++) {   // dust motes drifting down the beam
    const mx = cx + Math.sin(t * 0.7 + i * 2.4) * (14 + i * 6);
    const my = ((t * 26 + i * 53) % (cy + 30));
    ctx.fillStyle = `rgba(255,231,168,${0.25 * k})`; ctx.fillRect(mx | 0, my | 0, 1, 1);
  }
}

// Per-scene key light on sprites: draw into a scratch canvas, tint the drawn
// pixels with a directional gradient (sun side -> transparent), blit back.
// Cheap pilot of a true edge-rim; reads as directional golden-hour light.
// NOTE: drawCb receives the SCRATCH context — draw with it, not the outer ctx.
let _rimCv = null;
export function withRim(ctx, W, H, key, drawCb) {
  if (!key) return drawCb(ctx);
  const cv = (_rimCv ||= document.createElement('canvas'));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, W, H);
  drawCb(c);
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(0, 0, W * LIGHT.RIM.SPAN, 0);
  g.addColorStop(0, withA(key.color, key.alpha * LIGHT.RIM.SCALE));
  g.addColorStop(1, withA(key.color, 0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.restore();
  ctx.drawImage(cv, 0, 0);
}

// press-row camera flashes: short white pops with a glow halo
export class Flashbulbs {
  constructor() { this.pops = []; }
  burst(n) {
    if (_fxLow) n = Math.ceil(n / 2);
    const pts = RING.PRESS_FLASH_POINTS;
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[(Math.random() * pts.length) | 0];
      this.pops.push({
        x: x + (Math.random() - 0.5) * LIGHT.FLASH.SCATTER,
        y: y + (Math.random() - 0.5) * 10,
        life: LIGHT.FLASH.LIFE_MS * (0.6 + Math.random() * 0.8),
        max: LIGHT.FLASH.LIFE_MS, delay: Math.random() * 260,
      });
    }
  }
  update(dt) {
    for (const p of this.pops) { if (p.delay > 0) p.delay -= dt; else p.life -= dt; }
    this.pops = this.pops.filter((p) => p.life > 0);
  }
  draw(ctx) {
    for (const p of this.pops) {
      if (p.delay > 0) continue;
      const k = p.life / p.max;
      additiveGlow(ctx, p.x, p.y, 14, '#ffffff', 0.5 * k);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
      ctx.fillRect((p.x - 1) | 0, (p.y - 1) | 0, 3, 3);
    }
  }
}
