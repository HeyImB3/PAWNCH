// Per-fighter SPECIAL-move spectacle: a dramatic, chess-themed FX layer drawn over
// the ring while a boss unleashes their signature. Keyed by the fighter's sprite
// slug. Each effect draws a 'back' layer (behind the fighter: arena dim, a giant
// ghost piece, board glow) and a 'front' layer (over everything: shockwave, piece
// scatter, name stamp). This is the TEMPLATE every story boss plugs into — add a
// registerSpecialFx(slug, fn) entry per fighter as their art comes online.
import { PAL } from './config.js';
import { text, piece, withA } from './gfx.js';

const TAU = Math.PI * 2;
const FX = {};
export function registerSpecialFx(slug, fn) { FX[slug] = fn; }

// o = { W, H, ex, feetY, t, phase:'charge'|'strike', k, accent, layer:'back'|'front' }
//   phase 'charge' = winding up (k = 0..1 intensity ramp, pulses with t)
//   phase 'strike' = the blow just landed (k = 0..1 progress of the burst)
export function drawSpecialFx(ctx, slug, o) {
  const fn = slug && FX[slug];
  if (fn) fn(ctx, o);
}

// ---- THE PAWNCHION — CHECKMATE: dim the arena, raise a giant golden king and a lit
// board behind him; on impact, a gold shockwave + scattering pieces + a CHECKMATE stamp.
registerSpecialFx('pawnchion', (ctx, o) => {
  const { W, H, ex, feetY, t, phase, k, layer } = o;
  const GOLD = PAL.gold, bodyY = feetY - 95, kingY = feetY - 120;

  if (phase === 'charge') {
    const pulse = 0.6 + 0.4 * Math.sin(t * 8);
    if (layer === 'back') {
      ctx.fillStyle = withA('#05060e', 0.5 * k); ctx.fillRect(0, 0, W, H);     // arena dims
      for (let i = 0; i < 8; i++) {                                            // board ranks light up toward the player
        const yy = feetY + 6 + i * ((H - feetY) / 8);
        const lit = (Math.sin(t * 3 - i * 0.55) + 1) / 2;
        ctx.fillStyle = withA(GOLD, (0.05 + 0.08 * lit) * k); ctx.fillRect(0, yy | 0, W, 2);
      }
      const r = 130 * k * pulse;                                              // gold halo behind him
      const g = ctx.createRadialGradient(ex, bodyY, 4, ex, bodyY, r);
      g.addColorStop(0, withA(GOLD, 0.30 * k)); g.addColorStop(1, withA(GOLD, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, bodyY, r, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalAlpha = 0.18 * k * pulse;                          // a giant golden KING rises behind him
      piece(ctx, 'k', ex, kingY, 250 * k, true, { t, glow: 0, shadow: false });
      ctx.restore();
    } else {
      for (let i = 0; i < 12; i++) {                                          // rising gold embers
        const u = (t * 0.7 + i * 0.083) % 1;
        const a = i * (TAU / 12) + t * 0.6;
        const px = ex + Math.cos(a) * 50, py = bodyY + 50 - u * 150;
        ctx.fillStyle = withA(i % 2 ? '#fff3c0' : GOLD, (1 - u) * 0.7 * k);
        const s = 2 + (i % 3); ctx.fillRect(px | 0, py | 0, s, s);
      }
    }
    return;
  }

  // strike: k = 0..1 progress of the burst
  const p = k;
  if (layer === 'back') {
    ctx.fillStyle = withA('#ffffff', Math.max(0, 0.55 - p * 1.1)); ctx.fillRect(0, 0, W, H);  // impact whiteout, fading
    return;
  }
  const cy = feetY - 80;
  const rr = 24 + p * 280;                                                    // radial gold shockwave
  ctx.strokeStyle = withA(GOLD, (1 - p) * 0.9); ctx.lineWidth = 9 * (1 - p) + 1;
  ctx.beginPath(); ctx.arc(ex, cy, rr, 0, TAU); ctx.stroke();
  ctx.strokeStyle = withA('#ffffff', (1 - p) * 0.6); ctx.lineWidth = 3 * (1 - p) + 0.5;
  ctx.beginPath(); ctx.arc(ex, cy, rr * 0.66, 0, TAU); ctx.stroke();
  const types = ['p', 'n', 'b', 'r', 'q', 'k'];                              // chess pieces scatter out
  for (let i = 0; i < 8; i++) {
    const a = i * (TAU / 8) + 0.4, d = p * 170;
    const px = ex + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.6 - p * 40;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p * 1.2);
    piece(ctx, types[i % 6], px, py, 24, i % 2 === 0, { t, glow: 0, shadow: false });
    ctx.restore();
  }
  const sc = p < 0.22 ? 7 - (p / 0.22) * 3 : 4;                              // CHECKMATE stamp slams in big -> 4
  ctx.globalAlpha = Math.min(1, (1 - p) * 2.6);
  text(ctx, 'CHECKMATE', W / 2, H * 0.32, { scale: Math.max(2, Math.round(sc)), color: GOLD, align: 'center', shadow: PAL.ink });
  ctx.globalAlpha = 1;
});
