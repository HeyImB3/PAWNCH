// Arena scenery: one animated boxing-half backdrop per Story fighter, plus a
// built-in CLASSIC ring (reproduces the old gfx.ring() backdrop exactly). Each
// scene's draw(ctx, p) is a PURE function of time `t` and `crowd` (0..1, flares
// on big hits) — no retained state — so it's cheap and resume-safe. Story forces
// the opponent's arena; multiplayer reads the player's selected, unlocked arena.
//
// All colors/knobs come from SCENERY in config.js (Golden Rules 2 & 3); brand
// colors come from PAL. Zero image assets (Golden Rule 5).

import { SCENERY, PAL } from './config.js';
import { text, mix, mixA, withA, shade, lerp } from './gfx.js';

const TAU = Math.PI * 2;
// deterministic pseudo-random in [0,1) — stable element placement without state
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
// global ambient speed knob
const A = () => SCENERY.ANIM;

// ---- shared scene helpers ---------------------------------------------------
// vertical backdrop gradient across the scene region (y 0..h)
function sky(ctx, W, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const n = stops.length;
  stops.forEach((c, i) => g.addColorStop(n === 1 ? 0 : i / (n - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
}
// a row of chunky crowd "heads"; optional vertical wave + brightness flare
function crowdRow(ctx, W, y, h, count, color, t, opt = {}) {
  const { wave = 0, speed = 0, phase = 0.5, sz = 3, alpha = 0.55, flare = 0 } = opt;
  ctx.globalAlpha = Math.min(1, alpha + flare);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = (i / count) * W + hash(i * 1.7 + phase) * (W / count) * 0.5;
    const dy = wave ? Math.sin(t * speed * A() + i * phase) * wave : 0;
    ctx.fillRect(x | 0, (y + dy) | 0, sz, h);
  }
  ctx.globalAlpha = 1;
}
// twinkling point
function twinkle(ctx, x, y, s, color, t, phase) {
  ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 * A() + phase));
  ctx.fillStyle = color; ctx.fillRect(x | 0, y | 0, s, s); ctx.globalAlpha = 1;
}
// flickering flame with a soft glow (teardrop)
function flame(ctx, x, y, s, t, phase, core, midC, glowC) {
  const f = 1 + 0.18 * Math.sin(t * 9 * A() + phase);
  const gr = ctx.createRadialGradient(x, y, 0, x, y, s * 2.6 * f);
  gr.addColorStop(0, withA(glowC, 0.5)); gr.addColorStop(1, withA(glowC, 0));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, s * 2.6 * f, 0, TAU); ctx.fill();
  ctx.fillStyle = midC; ctx.beginPath(); ctx.ellipse(x, y, s * 0.6, s * f, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = core; ctx.beginPath(); ctx.ellipse(x, y, s * 0.3, s * 0.6 * f, 0, 0, TAU); ctx.fill();
}
// horizontal drift with wrap over [-margin, W+margin]
function drift(t, speed, W, margin, offset) {
  const span = W + margin * 2;
  return (((t * speed * A() + offset) % span) + span) % span - margin;
}
// radial glow blob
function glow(ctx, x, y, r, color, a) {
  if (a <= 0) return;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, withA(color, a)); gr.addColorStop(1, withA(color, 0));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

// ---- scene registry ---------------------------------------------------------
// id -> { draw(ctx, { W, floorTop, t, crowd, accent }) }
export const SCENES = {};

// CLASSIC — verbatim port of the old gfx.ring() backdrop, so nothing regresses.
function classicScene(ctx, p) {
  const { W, floorTop, accent, crowd } = p;
  const g = ctx.createLinearGradient(0, 0, 0, floorTop);
  g.addColorStop(0, mix('#070b1e', accent, 0.16)); g.addColorStop(1, '#10152b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, floorTop);
  for (const [sx, col] of [[W * 0.28, PAL.orange], [W * 0.72, accent]]) {
    const gr = ctx.createLinearGradient(sx, 0, sx, floorTop);
    gr.addColorStop(0, mixA(col, 0.18 + crowd * 0.15)); gr.addColorStop(1, mixA(col, 0));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(sx - 10, 0); ctx.lineTo(sx + 10, 0); ctx.lineTo(sx + 70, floorTop); ctx.lineTo(sx - 70, floorTop); ctx.closePath(); ctx.fill();
  }
  for (let band = 0; band < 3; band++) {
    const by = 12 + band * 26, bh = 22, sz = 2 + band;
    ctx.fillStyle = `rgba(${200 + band * 18},${205},${230},${0.10 + band * 0.05 + crowd * 0.45})`;
    for (let i = 0; i < 26; i++) { const cx2 = ((i * 41 + band * 13) % W); ctx.fillRect(cx2, by + ((i * 7) % bh), sz, sz); }
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(accent, crowd * 0.22); ctx.fillRect(0, 0, W, floorTop); }
}
SCENES.classic = { draw: classicScene };

// ---- public API -------------------------------------------------------------
// draw a scene by id; unknown / not-yet-implemented ids fall back to CLASSIC
export function drawScene(ctx, id, p) { (SCENES[id] || SCENES.classic).draw(ctx, p); }

// which arena to render for a match. Story = opponent's arena (forced);
// multiplayer (local + online) = the player's selected, unlocked arena.
export function sceneFor(match, save) {
  if (match?.mode === 'story' && match.opponent) {
    return SCENERY.OPPONENT_SCENES[match.opponent.index] || 'classic';
  }
  const a = save?.settings?.arena || 'classic';
  if (a === 'classic') return 'classic';
  return save?.unlocks?.arenas?.[a] ? a : 'classic';
}

// arena ids the player can pick in Settings: CLASSIC (always) + unlocked, roster order
export function availableArenas(save) {
  const unlocked = save?.unlocks?.arenas || {};
  return ['classic', ...SCENERY.OPPONENT_SCENES.filter((id) => unlocked[id])];
}
