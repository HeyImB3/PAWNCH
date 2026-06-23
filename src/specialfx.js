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

// ---- shared helpers for the roster spectacles -------------------------------
function dim(ctx, W, H, a) { ctx.fillStyle = withA('#05060e', a); ctx.fillRect(0, 0, W, H); }
function halo(ctx, x, y, r, hex, a) {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, withA(hex, a)); g.addColorStop(1, withA(hex, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function shock(ctx, x, y, p, color, maxR = 280) {
  const rr = 24 + p * maxR;
  ctx.strokeStyle = withA(color, (1 - p) * 0.9); ctx.lineWidth = 9 * (1 - p) + 1;
  ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
  ctx.strokeStyle = withA('#ffffff', (1 - p) * 0.55); ctx.lineWidth = 3 * (1 - p) + 0.5;
  ctx.beginPath(); ctx.arc(x, y, rr * 0.66, 0, TAU); ctx.stroke();
}
function scatter(ctx, x, y, p, n = 8, spread = 170) {
  const T = ['p', 'n', 'b', 'r', 'q', 'k'];
  for (let i = 0; i < n; i++) {
    const a = i * (TAU / n) + 0.4, d = p * spread;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p * 1.2);
    piece(ctx, T[i % 6], x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6 - p * 40, 22, i % 2 === 0, { t: 0, glow: 0, shadow: false });
    ctx.restore();
  }
}
function stamp(ctx, W, H, word, p, color) {
  const sc = p < 0.22 ? 7 - (p / 0.22) * 3 : 4;
  ctx.globalAlpha = Math.min(1, (1 - p) * 2.6);
  text(ctx, word, W / 2, H * 0.32, { scale: Math.max(2, Math.round(sc)), color, align: 'center', shadow: PAL.ink });
  ctx.globalAlpha = 1;
}

// PATTY — PAWN STORM: a goofy swarm of little pawns rush up at the player.
registerSpecialFx('patty', (ctx, o) => {
  const { W, H, ex, feetY, t, phase, k, layer } = o, C = '#ff7a18';
  if (phase === 'charge') {
    if (layer === 'back') { dim(ctx, W, H, 0.24 * k); halo(ctx, ex, feetY - 80, 95 * k, C, 0.18 * k); }
    else for (let i = 0; i < 10; i++) {
      const u = (t * 0.8 + i * 0.1) % 1, px = ex + (i - 5) * 16 + Math.sin(t * 4 + i) * 6, py = H - 8 - u * (H - feetY + 50);
      ctx.save(); ctx.globalAlpha = (1 - u) * 0.85 * k; piece(ctx, 'p', px, py, 17, true, { t: 0, glow: 0, shadow: false }); ctx.restore();
    }
    return;
  }
  if (layer === 'front') { shock(ctx, ex, feetY - 70, k, C, 200); scatter(ctx, ex, feetY - 70, k, 10, 150); stamp(ctx, W, H, 'PAWN STORM', k, C); }
});

// GUS — GAMBIT: he sacrifices a piece (it floats up and pops), then strikes.
registerSpecialFx('gus', (ctx, o) => {
  const { W, H, ex, feetY, t, phase, k, layer } = o, C = '#39d98a';
  if (phase === 'charge') {
    if (layer === 'back') dim(ctx, W, H, 0.20 * k);
    else {
      const u = (t * 0.7) % 1;
      ctx.save(); ctx.globalAlpha = (1 - u) * k; piece(ctx, 'p', ex, feetY - 60 - u * 80, 22 * (1 + u * 0.4), true, { t: 0, glow: 0, shadow: false }); ctx.restore();
      for (let i = 0; i < 5; i++) { const a = t * 2 + i * 1.3; ctx.fillStyle = withA('#fff3c0', 0.6 * k); ctx.fillRect(ex + Math.cos(a) * 30, feetY - 70 + Math.sin(a) * 24, 2, 2); }
    }
    return;
  }
  if (layer === 'front') { shock(ctx, ex, feetY - 70, k, C, 230); scatter(ctx, ex, feetY - 70, k, 6, 150); stamp(ctx, W, H, 'GAMBIT', k, C); }
});

// ROSA — ROOK ROLL: a giant stone rook charges down the file in a cloud of dust.
registerSpecialFx('rosa', (ctx, o) => {
  const { W, H, ex, feetY, t, phase, k, layer } = o, C = '#ff3b53';
  if (phase === 'charge') {
    if (layer === 'back') {
      dim(ctx, W, H, 0.30 * k);
      ctx.save(); ctx.globalAlpha = 0.16 * k; piece(ctx, 'r', ex, feetY - 110, 230 * k, false, { t: 0, glow: 0, shadow: false }); ctx.restore();
      ctx.strokeStyle = withA('#b9a48a', 0.4 * k); ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const yy = feetY - 20 - i * 18 + ((t * 60) % 18); ctx.beginPath(); ctx.moveTo(ex - 70, yy); ctx.lineTo(ex - 20, yy); ctx.stroke(); }
    }
    return;
  }
  if (layer === 'front') { shock(ctx, ex, feetY - 60, k, C, 300); scatter(ctx, ex, feetY - 60, k, 7, 180); stamp(ctx, W, H, 'ROOK ROLL', k, C); }
});

// KID — FORK: two glowing fork-reticles (head + body) + crackling lightning.
registerSpecialFx('kid', (ctx, o) => {
  const { W, H, ex, feetY, t, phase, k, layer } = o, C = '#ffe070';
  const reticle = (x, y, r) => {
    ctx.strokeStyle = withA(C, 0.9 * k); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r + Math.sin(t * 8) * 2, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r - 4, y); ctx.lineTo(x + r + 4, y); ctx.moveTo(x, y - r - 4); ctx.lineTo(x, y + r + 4); ctx.stroke();
  };
  if (phase === 'charge') {
    if (layer === 'back') dim(ctx, W, H, 0.22 * k);
    else {
      reticle(ex - 4, feetY - 150, 16); reticle(ex + 30, feetY - 70, 16);
      ctx.strokeStyle = withA(C, 0.8 * k); ctx.lineWidth = 2; let px = ex - 30, py = feetY - 40;
      ctx.beginPath(); ctx.moveTo(px, py); for (let i = 0; i < 6; i++) { px += 12; py -= 18; ctx.lineTo(px + (i % 2 ? 6 : -6), py); } ctx.stroke();
    }
    return;
  }
  if (layer === 'front') {
    shock(ctx, ex, feetY - 90, k, C, 240);
    for (let i = 0; i < 6; i++) { const a = i * (TAU / 6) + 0.3; ctx.strokeStyle = withA(C, (1 - k) * 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex, feetY - 90); ctx.lineTo(ex + Math.cos(a) * k * 150, feetY - 90 + Math.sin(a) * k * 110); ctx.stroke(); }
    stamp(ctx, W, H, 'FORK', k, C);
  }
});

// BISHOP — DIAGONAL DRIVE: a bright holy diagonal beam sweeps across the ring.
registerSpecialFx('bishop', (ctx, o) => {
  const { W, H, t, phase, k, layer } = o, C = '#9a5cff';
  if (phase === 'charge') {
    if (layer === 'back') dim(ctx, W, H, 0.34 * k);
    else {
      ctx.save(); ctx.globalAlpha = (0.35 + 0.3 * Math.sin(t * 6)) * k;
      ctx.strokeStyle = C; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, 0); ctx.stroke();
      ctx.strokeStyle = withA('#fff', 0.6 * k); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, 0); ctx.stroke(); ctx.restore();
    }
    return;
  }
  if (layer === 'front') {
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = C; ctx.lineWidth = 14 * (1 - k) + 2;
    ctx.beginPath(); ctx.moveTo(0, H * (1 - k)); ctx.lineTo(W * k, 0); ctx.stroke(); ctx.restore();
    stamp(ctx, W, H, 'DIAGONAL', k, C);
  }
});

// QUEEN — QUAKE: the floor cracks open in a radial quake under a regal aura.
registerSpecialFx('queen', (ctx, o) => {
  const { W, H, ex, feetY, t, phase, k, layer } = o, C = '#ff6ab0';
  if (phase === 'charge') {
    if (layer === 'back') { dim(ctx, W, H, 0.22 * k); halo(ctx, ex, feetY - 90, 110 * k, C, 0.20 * k); }
    else { ctx.save(); ctx.globalAlpha = 0.18 * k; piece(ctx, 'q', ex, feetY - 120, 200 * k, false, { t: 0, glow: 0, shadow: false }); ctx.restore(); }
    return;
  }
  if (layer === 'front') {
    ctx.strokeStyle = withA('#1a0e16', 1 - k); ctx.lineWidth = 3 * (1 - k) + 1;
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2.6, d = k * 240;
      ctx.beginPath(); ctx.moveTo(ex, feetY);
      for (let s = 1; s <= 4; s++) ctx.lineTo(ex + Math.cos(a) * d * s / 4 + (s % 2 ? 5 : -5), feetY + Math.abs(Math.sin(a)) * d * 0.12 * s / 4);
      ctx.stroke();
    }
    shock(ctx, ex, feetY, k, C, 260); stamp(ctx, W, H, 'QUAKE', k, C);
  }
});

// IRON — ZUGZWANG SLAM: grinding gears + steam, then a heavy iron shockwave.
registerSpecialFx('iron', (ctx, o) => {
  const { W, H, ex, feetY, t, phase, k, layer } = o, C = '#8fa0c0', HOT = '#ff7a18';
  const gear = (x, y, r, rot) => {
    ctx.strokeStyle = withA('#b08040', 0.5 * k); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = rot + i * (TAU / 8); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5)); ctx.stroke(); }
  };
  if (phase === 'charge') {
    if (layer === 'back') { dim(ctx, W, H, 0.30 * k); gear(ex - 42, feetY - 130, 22, t * 2); gear(ex + 42, feetY - 150, 16, -t * 3); halo(ctx, ex, feetY - 90, 80 * k, HOT, 0.14 * k); }
    else for (let i = 0; i < 4; i++) { const u = (t * 0.5 + i * 0.25) % 1; ctx.fillStyle = withA('#cfd6e6', (1 - u) * 0.35 * k); ctx.beginPath(); ctx.arc(ex + (i - 2) * 24, feetY - 60 - u * 70, 6 + u * 18, 0, TAU); ctx.fill(); }
    return;
  }
  if (layer === 'front') { shock(ctx, ex, feetY - 50, k, C, 300); scatter(ctx, ex, feetY - 50, k, 6, 150); stamp(ctx, W, H, 'ZUGZWANG', k, '#cfd6e6'); }
});

// TAL — SAC ATTACK: a hypnotic teal spiral, chess pieces sacrificed into the storm.
registerSpecialFx('tal', (ctx, o) => {
  const { W, H, ex, feetY, t, phase, k, layer } = o, C = '#1fc8d0';
  if (phase === 'charge') {
    if (layer === 'back') { dim(ctx, W, H, 0.30 * k); halo(ctx, ex, feetY - 90, 100 * k, C, 0.20 * k); }
    else {
      const cy = feetY - 90;
      for (let i = 0; i < 14; i++) { const a = t * 2.4 + i * (TAU / 14), rr = 20 + (i / 14) * 60; ctx.fillStyle = withA(i % 3 ? C : '#bff7fa', 0.7 * k); ctx.fillRect(ex + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.6, 2, 2); }
      for (let i = 0; i < 3; i++) { const a = -t * 1.6 + i * 2.1; ctx.save(); ctx.globalAlpha = 0.55 * k; piece(ctx, ['n', 'b', 'r'][i], ex + Math.cos(a) * 70, cy + Math.sin(a) * 42, 20, false, { t: 0, glow: 0, shadow: false }); ctx.restore(); }
    }
    return;
  }
  if (layer === 'front') { shock(ctx, ex, feetY - 90, k, C, 260); scatter(ctx, ex, feetY - 90, k, 10, 190); stamp(ctx, W, H, 'SACRIFICE', k, C); }
});

// MAGNUS — ENDGAME CRUSH: cold calculation; a lock-on grid, then one precise flash.
registerSpecialFx('magnus', (ctx, o) => {
  const { W, H, ex, feetY, t, phase, k, layer } = o, C = '#ffd24a';
  const tx = W / 2, ty = H - 130;
  if (phase === 'charge') {
    if (layer === 'back') dim(ctx, W, H, 0.30 * k);
    else {
      ctx.strokeStyle = withA(C, 0.5 * k); ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(ex, feetY - 100); ctx.lineTo(tx + i * 16, ty); ctx.stroke(); }
      const r = 26 + Math.sin(t * 5) * 3; ctx.strokeStyle = withA(C, 0.9 * k); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tx, ty, r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx - r - 5, ty); ctx.lineTo(tx + r + 5, ty); ctx.moveTo(tx, ty - r - 5); ctx.lineTo(tx, ty + r + 5); ctx.stroke();
    }
    return;
  }
  if (layer === 'front') {
    ctx.globalAlpha = Math.max(0, 1 - k * 2); ctx.fillStyle = withA('#ffffff', 0.4); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    shock(ctx, ex, feetY - 80, k, C, 200); stamp(ctx, W, H, 'ENDGAME', k, C);
  }
});
