// Arena scenery: one animated boxing-half backdrop per Story fighter, plus a
// built-in CLASSIC ring (reproduces the old gfx.ring() backdrop exactly). Each
// scene's draw(ctx, p) is a PURE function of time `t` and `crowd` (0..1, flares
// on big hits) — no retained state — so it's cheap and resume-safe. Story forces
// the opponent's arena; multiplayer reads the player's selected, unlocked arena.
//
// All colors/knobs come from SCENERY in config.js (Golden Rules 2 & 3); brand
// colors come from PAL. Zero image assets (Golden Rule 5).

import { SCENERY, PAL } from './config.js';
import { text, mix, mixA, withA, shade, lerp, arenaLayers, piece } from './gfx.js';
import { additiveGlow, spotCone } from './lighting.js';

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

// CLASSIC v2 — painted truss/crowd layer + live light: breathing lamp cones,
// drifting smoke haze, phone-light twinkles in the tiers, crowd flare wash.
SCENES.classic.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd, accent } = p; const C = SCENERY.SCENES.classic;
  sky(ctx, W, floorTop, ['#070a16', '#0d1226']);
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  for (const lx of C.lampXs) {                       // truss lamps: glow + cones
    const breathe = 0.85 + 0.15 * Math.sin(t * 1.3 + lx);
    additiveGlow(ctx, lx, C.lampY, 10, C.cone, 0.5 * breathe);
    spotCone(ctx, { cx: lx, topY: C.lampY, floorY: floorTop, topHalfW: 5, botHalfW: 34, color: C.cone, alpha: C.coneA * breathe + crowd * 0.04 });
  }
  for (let i = 0; i < 2; i++)                        // smoke haze through the beams
    additiveGlow(ctx, drift(t, 4 + i * 3, W, 60, i * 200), 34 + i * 22, 46, C.haze, 0.05);
  for (let i = 0; i < C.phoneN; i++)                 // phone-light pinpricks
    twinkle(ctx, hash(i) * W, floorTop * (0.45 + 0.4 * hash(i + 3)), 1, C.phone, t * C.twinkleHz, i * 1.9);
  if (layers.near) ctx.drawImage(layers.near, 0, 0);
  if (crowd > 0.01) { ctx.fillStyle = mixA(accent, crowd * 0.16); ctx.fillRect(0, 0, W, floorTop); }
};

// ---- public API -------------------------------------------------------------
// draw a scene by id; unknown / not-yet-implemented ids fall back to CLASSIC.
// A scene may define drawLayered(ctx, p, layers) — used when painted arena
// layers (far/mid/near PNGs) are registered for it; otherwise its procedural
// draw() runs, so the game still works with zero image assets.
export function drawScene(ctx, id, p) {
  const scene = SCENES[id] || SCENES.classic;
  const layers = arenaLayers(id);
  if (layers && scene.drawLayered) return scene.drawLayered(ctx, p, layers);
  scene.draw(ctx, p);
}

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

// ---- the ten fighter arenas -------------------------------------------------
// Each draws only the backdrop region (y ~0..floorTop); ring() draws over the
// lower band. Pure functions of t + crowd; colors/knobs come from SCENERY.SCENES.

// TROPICAL BEACH (Patty) — gentle sun, rolling surf, swaying palms, sand crowd.
function beachScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.beach;
  sky(ctx, W, floorTop, C.sky);
  const horizon = floorTop * 0.5;
  const sx = W * 0.22, sy = horizon * 0.5;
  glow(ctx, sx, sy, 40, C.sunGlow, 0.5 + 0.1 * Math.sin(t * 1.5));
  ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, TAU); ctx.fill();
  ctx.fillStyle = C.sea; ctx.fillRect(0, horizon, W, floorTop * 0.18);
  ctx.fillStyle = C.seaHi;
  for (let x = 0; x < W; x += 8) ctx.fillRect(x, horizon + 4 + Math.sin(t * 2 + x * 0.05) * 2, 5, 1);
  ctx.fillStyle = C.sand; ctx.fillRect(0, horizon + floorTop * 0.18, W, floorTop);
  crowdRow(ctx, W, floorTop - 14, 8, C.crowdN, C.crowd, t, { wave: 1.5, speed: 2, alpha: 0.5, flare: crowd * SCENERY.CROWD_FLARE });
  for (let i = 0; i < C.palms; i++) {
    const px = W * (0.18 + i * 0.62), base = floorTop - 10;
    const swayX = Math.sin(t * 1.2 * A() + i) * 5;
    ctx.strokeStyle = C.palm; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(px, base); ctx.quadraticCurveTo(px + swayX * 0.5, base - 22, px + swayX, base - 40); ctx.stroke();
    ctx.fillStyle = C.leaf;
    for (let a = -2; a <= 2; a++) { ctx.beginPath(); ctx.ellipse(px + swayX, base - 42, 16, 4, a * 0.5 + Math.sin(t + a) * 0.05, 0, TAU); ctx.fill(); }
  }
}
SCENES.beach = { draw: beachScene };

// angled god-ray quad (additive) — beach-local helper
function godRay(ctx, x0, y0, x1, y1, w0, w1, color, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, withA(color, a)); g.addColorStop(1, withA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0 - w0, y0); ctx.lineTo(x0 + w0, y0);
  ctx.lineTo(x1 + w1, y1); ctx.lineTo(x1 - w1, y1);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// point along the beach's single sagging lantern wire (k = 0..1)
function wireAt(anchors, sag, k) {
  const [ax, ay] = anchors[0], [bx, by] = anchors[1];
  return [ax + (bx - ax) * k, ay + (by - ay) * k + Math.sin(k * Math.PI) * sag];
}

// TROPICAL BEACH v2 — painted golden hour + living light. Pure fn of t/crowd.
SCENES.beach.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.beach, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // sun: breathing glow + wide horizon bloom
  const breathe = 0.5 + 0.08 * Math.sin(t * 1.1);
  additiveGlow(ctx, L.sun[0], L.sun[1], L.sunGlowR, C.sunGlow, breathe);
  additiveGlow(ctx, L.sun[0], L.horizonY, 70, L.bloomCol, 0.16);
  // god-rays fanning from the sun (slow shimmer)
  L.rays.forEach(([x0, y0, x1, fy, a], i) => {
    const sh = 0.75 + 0.25 * Math.sin(t * 0.7 + i * 2.1);
    godRay(ctx, x0, y0, x1, Math.min(fy, floorTop), L.rayW[0], L.rayW[1], L.rayCol, a * sh);
  });
  // water sparkle in the sun path
  for (let i = 0; i < L.sparkleN; i++) {
    const sx = L.sparkleX[0] + hash(i) * (L.sparkleX[1] - L.sparkleX[0]);
    twinkle(ctx, sx, L.horizonY + 2 + hash(i + 5) * 22, 1, L.sparkleCol, t * 3, i * 1.7);
  }
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // rolling surf foam over the waterline
  ctx.fillStyle = L.foamCol;
  for (let x = 0; x < W; x += 7) {
    const fy = L.foamY + Math.sin(t * L.foamSpeed + x * 0.045) * L.foamAmp;
    if (hash(x) < 0.75) ctx.fillRect(x, fy | 0, 4, 1);
  }
  // tiki flames in the painted bowls
  L.torches.forEach(([tx, ty], i) => flame(ctx, tx, ty - 7, 5, t, i * 1.9, C.sun, '#ff9a18', '#ffb24a'));
  // swinging string lanterns along the painted wire
  for (let i = 0; i < L.lanternN; i++) {
    const k = (i + 0.5) / L.lanternN;
    const [lx, ly] = wireAt(L.wire, L.wireSag, k);
    const sway = Math.sin(t * 1.3 + i * 1.1) * 2;
    additiveGlow(ctx, lx + sway, ly + 5, 8, L.lantGlow, 0.35 + crowd * 0.2);
    ctx.fillStyle = L.lantBody; ctx.fillRect((lx + sway - 1) | 0, (ly + 2) | 0, 3, 4);
    ctx.fillStyle = L.lantCore; ctx.fillRect((lx + sway) | 0, (ly + 3) | 0, 1, 2);
  }
  // beach ball arcing over the left bleachers
  const bk = (t * 0.35) % 1, bx = L.ballX[0] + (L.ballX[1] - L.ballX[0]) * bk;
  const by = L.ballY - Math.abs(Math.sin(bk * Math.PI * 3)) * 16;
  ctx.fillStyle = L.ballCol; ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = L.ballHi; ctx.fillRect((bx - 1) | 0, (by - 3) | 0, 2, 2);
  // rare event: a crab scuttles across the sand (deterministic t-schedule)
  const cph = t % L.crabPeriod;
  if (cph < L.crabDur) {
    const cx = -8 + (W + 16) * (cph / L.crabDur), cy = L.crabY + Math.sin(t * 14);
    ctx.fillStyle = L.crabCol;
    ctx.fillRect(cx | 0, cy | 0, 5, 3);
    ctx.fillRect((cx - 1) | 0, (cy + 1) | 0, 1, 1); ctx.fillRect((cx + 5) | 0, (cy + 1) | 0, 1, 1); // claws
    const leg = Math.floor(t * 10) % 2;
    ctx.fillRect((cx + (leg ? 0 : 2)) | 0, (cy + 3) | 0, 1, 1); ctx.fillRect((cx + (leg ? 3 : 4)) | 0, (cy + 3) | 0, 1, 1);
  }
  // near fronds with a gentle wind sway (whole-layer drift; the canopies hug
  // the corners so the 1px edge sliver never reads)
  if (layers.near) {
    ctx.save();
    ctx.translate(Math.sin(t * L.frondHz) * L.frondSway, 0);
    ctx.drawImage(layers.near, 0, 0);
    ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.14); ctx.fillRect(0, 0, W, floorTop); }
};

// SPOOKY WOODS (Gus Gambit) — dark trunks, bobbing candles, fireflies, hooded crowd.
function woodsScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.woods;
  sky(ctx, W, floorTop, C.sky);
  ctx.fillStyle = C.trunk;
  for (let i = 0; i < C.trunkN; i++) {
    const x = (i + 0.5) / C.trunkN * W + (hash(i) - 0.5) * 30, w = 10 + hash(i + 3) * 14;
    ctx.fillRect(x - w / 2, floorTop * (0.1 + hash(i + 1) * 0.1), w, floorTop);
  }
  crowdRow(ctx, W, floorTop - 16, 16, C.crowdN, C.crowd, t, { wave: 1, speed: 1.4, sz: 5, alpha: 0.85, flare: crowd * 0.2 });
  for (let i = 0; i < C.candleN; i++) {
    const cx = (i + 0.5) / C.candleN * W + Math.sin(t * 0.6 + i) * 10;
    const cy = floorTop * (0.25 + 0.45 * hash(i + 7)) + Math.sin(t * 1.6 * A() + i * 1.3) * 6;
    flame(ctx, cx, cy, 5, t, i * 1.7, C.fireCore, C.fireMid, C.fireGlow);
  }
  for (let i = 0; i < C.flyN; i++) {
    const fx = drift(t, 6 + i, W, 10, i * 70), fy = floorTop * (0.3 + 0.5 * hash(i + 2)) + Math.sin(t * 2 + i) * 8;
    twinkle(ctx, fx, fy, 2, C.fly, t, i * 2.1);
  }
}
SCENES.woods = { draw: woodsScene };

// SPOOKY WOODS v2 — painted moonlit amphitheater + living light: candle pools,
// rolling fog, fireflies, a moon shaft, and eyes that blink open in the dark.
SCENES.woods.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.woods, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // moon glow + one broad shaft slanting down-left through the canopy
  additiveGlow(ctx, L.moon[0], L.moon[1], L.moonGlowR, L.shaftCol, 0.4 + 0.06 * Math.sin(t * 0.9));
  godRay(ctx, L.moon[0], L.moon[1], L.moon[0] - 120, floorTop, 8, 52, L.shaftCol, L.shaftAlpha);
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // candle flames on every painted cluster (the warm pools of light)
  L.candles.forEach(([cx, cy], i) =>
    flame(ctx, cx, cy - 2, 4, t, i * 1.7, C.fireCore, C.fireMid, C.fireGlow));
  // rolling ground fog: broad drifting glows hugging the floor band
  for (let i = 0; i < L.fogN; i++) {
    const fx = drift(t, 3 + i * 2, W, 90, i * 170);
    const fy = L.fogY[0] + (L.fogY[1] - L.fogY[0]) * hash(i + 2);
    additiveGlow(ctx, fx, fy, 60, L.fogCol, 0.07);
  }
  // fireflies wandering between the trunks
  for (let i = 0; i < L.flyN; i++) {
    const fx = drift(t, 5 + i, W, 12, i * 60);
    const fy = 60 + hash(i + 3) * 80 + Math.sin(t * 1.8 + i) * 6;
    twinkle(ctx, fx, fy, 2, L.flyCol, t * 2, i * 2.3);
  }
  // RARE: pairs of eyes blink open in the dark, then vanish
  const eph = t % L.eyesPeriod;
  if (eph < L.eyesDur) {
    const k = Math.sin((eph / L.eyesDur) * Math.PI);           // fade in-out
    const cycle = Math.floor(t / L.eyesPeriod);                // new spots each time
    for (let i = 0; i < L.eyesN; i++) {
      const ex = 60 + hash(cycle * 7 + i) * (W - 120);
      const ey = 40 + hash(cycle * 13 + i + 3) * 70;
      ctx.globalAlpha = k;
      ctx.fillStyle = L.eyesCol;
      ctx.fillRect(ex | 0, ey | 0, 2, 2); ctx.fillRect((ex + 6) | 0, ey | 0, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
  // near branch + moss with a slow sway, then the jar candle glows on top
  if (layers.near) {
    ctx.save();
    ctx.translate(Math.sin(t * L.mossHz) * L.mossSway, 0);
    ctx.drawImage(layers.near, 0, 0);
    ctx.restore();
  }
  L.jars.forEach(([jx, jy], i) => {
    flame(ctx, jx, jy, 3, t, i * 2.6, C.fireCore, C.fireMid, C.fireGlow);
  });
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.10); ctx.fillRect(0, 0, W, floorTop); }
};

// CYBERPUNK STREET (Rosa Rookrush) — building silhouettes, neon, rain, sidewalk crowd.
function cyberScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.cyber;
  sky(ctx, W, floorTop, C.sky);
  ctx.fillStyle = C.bld;
  for (let i = 0; i < C.bldN; i++) {
    const w = W / C.bldN, x = i * w, h = floorTop * (0.5 + 0.45 * hash(i + 1));
    ctx.fillRect(x + 2, floorTop - h, w - 4, h);
  }
  for (let i = 0; i < 6; i++) {
    const col = C.neon[i % C.neon.length], bx = (i * 97 % (W - 50)) + 6, by = 12 + (i * 37 % 70);
    const on = (Math.sin(t * 7 * A() + i * 2) > -0.4) ? 1 : 0.35;
    glow(ctx, bx + 22, by + 12, 30, col, 0.4 * on);
    ctx.globalAlpha = on; ctx.fillStyle = col; ctx.fillRect(bx, by, 44, 24); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = C.rain; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const rx = (i * 53 + (t * 200 * A()) % W) % W, ry = (i * 41 + (t * 300 * A())) % floorTop;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 9);
  }
  ctx.stroke();
  crowdRow(ctx, W, floorTop - 12, 10, C.crowdN, C.crowd, t, { wave: 1.5, speed: 2.5, alpha: 0.55, flare: crowd * SCENERY.CROWD_FLARE });
}
SCENES.cyber = { draw: cyberScene };

// CYBERPUNK STREET v2 — painted neon canyon + living light: sign flicker,
// glitching holo-rook billboard, steam, circling drones, rain, and a rare
// monorail crossing. `crowd` spikes to 1 on knockdowns (boxing), so the whole
// street SURGES on the big moments — the "neon surge + drone swarm" beat.
SCENES.cyber.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.cyber, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // RARE: a monorail train crosses the far viaduct (lit window strip)
  const tph = t % L.trainPeriod;
  if (tph < L.trainDur) {
    const tx = -80 + (W + 160) * (tph / L.trainDur);
    for (let c2 = 0; c2 < L.trainCars; c2++) {
      const cx = tx - c2 * 22;
      ctx.fillStyle = '#0d1226'; ctx.fillRect(cx | 0, L.railY - 6, 20, 5);
      ctx.fillStyle = L.trainWin;
      for (let wdx = 2; wdx < 18; wdx += 4) ctx.fillRect((cx + wdx) | 0, L.railY - 5, 2, 2);
    }
    additiveGlow(ctx, tx, L.railY - 4, 16, L.trainWin, 0.2);
  }
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  const surge = 1 + crowd * 0.6;
  // HOTEL ROOK sign: flickers between half-dead and blazing
  const on = Math.sin(t * 7) > -0.35 ? 1 : 0.3;
  additiveGlow(ctx, L.sign[0], L.sign[1], 34, L.neonM, 0.4 * on * surge);
  additiveGlow(ctx, L.sign[0], L.sign[1] + 30, 24, L.neonM, 0.25 * on * surge);
  // holographic ROOK on the billboard: ghostly glyph, scanline glitches
  const gj = hash(Math.floor(t * 9)) < 0.18 ? (hash(Math.floor(t * 9) + 1) - 0.5) * 6 : 0;
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 3);
  piece(ctx, 'R', L.billboard[0] + gj, L.billboard[1], 30, true, { t, glow: 2, shadow: false, clean: true });
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = L.neonC;                                 // holo scanlines
  for (let sy = L.billboard[1] - 16; sy < L.billboard[1] + 16; sy += 3)
    ctx.fillRect(L.billboard[0] - 22, sy + (Math.floor(t * 20) % 3), 44, 1);
  ctx.restore();
  additiveGlow(ctx, L.billboard[0], L.billboard[1], 30, L.neonC, 0.22 * surge);
  // steam vents: rising cool-lit puffs
  L.steam.forEach(([sx, sy], i) => {
    const k = (t * 0.6 + i * 0.5) % 1;
    additiveGlow(ctx, sx + Math.sin(t + i) * 3, sy - k * 26, 8 + k * 10, '#8ea0cf', 0.16 * (1 - k));
  });
  // camera drones: circling lights with blink + tiny search cones — they
  // orbit faster and dive lower when the crowd surges (knockdowns)
  for (let i = 0; i < L.droneN; i++) {
    const dx = W / 2 + Math.cos(t * 0.5 * surge + i * Math.PI) * (150 + i * 40 - crowd * 40);
    const dy = 40 + crowd * 22 + Math.sin(t * 0.8 * surge + i * 2) * 14;
    ctx.fillStyle = '#26304f'; ctx.fillRect(dx | 0, dy | 0, 4, 2);
    ctx.fillStyle = Math.floor(t * 4 + i) % 2 ? '#ff3b53' : L.neonC;
    ctx.fillRect((dx + 1) | 0, (dy - 1) | 0, 1, 1);
    spotCone(ctx, { cx: dx + 2, topY: dy + 2, floorY: dy + 34, topHalfW: 1, botHalfW: 8, color: L.neonC, alpha: 0.06 });
  }
  // rain: streaks angling down-left
  ctx.strokeStyle = C.rain; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < L.rainN; i++) {
    const rx = (i * 53 + (t * 240) % W) % W, ry = (i * 41 + t * 340) % floorTop;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 9);
  }
  ctx.stroke();
  if (layers.near) ctx.drawImage(layers.near, 0, 0);
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.14); ctx.fillRect(0, 0, W, floorTop); }
};

// DREAM WORLD (Kid Knightmare) — hue-shifting pastel sky, floating shapes, spectres.
function dreamScene(ctx, p) {
  const { W, floorTop, t } = p; const C = SCENERY.SCENES.dream;
  const k = (Math.sin(t * 0.2) + 1) / 2;
  sky(ctx, W, floorTop, [mix(C.sky[0], C.sky[3], k), C.sky[1], mix(C.sky[2], C.sky[0], k)]);
  for (let i = 0; i < 3; i++) {
    const cx = drift(t, 4 + i * 2, W, 40, i * 160), cy = floorTop * (0.2 + 0.2 * i);
    ctx.fillStyle = C.cloud; ctx.beginPath(); ctx.ellipse(cx, cy, 40, 12, 0, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const x = (i + 0.5) / 4 * W + Math.sin(t * 0.5 + i) * 12, y = floorTop * (0.3 + 0.3 * hash(i + 5)) + Math.sin(t * 1.2 + i) * 8;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.6 + i); ctx.fillStyle = C.shape;
    if (i % 2) ctx.fillRect(-7, -7, 14, 14); else { ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, 7); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  for (let i = 0; i < C.starN; i++) twinkle(ctx, hash(i) * W, hash(i + 1) * floorTop * 0.7, 2, C.star, t, i * 1.3);
  for (let i = 0; i < C.ghostN; i++) {
    const gx = drift(t, 8 + i * 2, W, 16, i * 90), gy = floorTop - 14 + Math.sin(t * 1.5 + i) * 4;
    ctx.fillStyle = C.ghost; ctx.beginPath();
    ctx.moveTo(gx - 6, gy + 10); ctx.lineTo(gx - 6, gy - 6); ctx.arc(gx, gy - 6, 6, Math.PI, 0); ctx.lineTo(gx + 6, gy + 10); ctx.closePath(); ctx.fill();
  }
}
SCENES.dream = { draw: dreamScene };

// DREAM WORLD v2 — painted pastel dream + living light: hue-cycling wash,
// aurora shimmer, stardust falls, shooting stars, a floating knight bust,
// and the rare counting sheep. The whole mid layer drifts — it's a dream.
SCENES.dream.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.dream, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // hue-cycling dream wash over the sky (rotating through three tints)
  const hk = (t * L.hueHz) % 1, hi = Math.floor(hk * L.hueCycle.length);
  const hcol = L.hueCycle[hi % L.hueCycle.length];
  ctx.fillStyle = mixA(hcol, L.hueA * (0.5 + 0.5 * Math.sin(hk * Math.PI * 2 * L.hueCycle.length)));
  ctx.fillRect(0, 0, W, floorTop);
  // aurora shimmer: slow drifting light blobs over the painted ribbons
  for (let i = 0; i < 3; i++) {
    const ax = drift(t, 6 + i * 3, W, 40, i * 150);
    additiveGlow(ctx, ax, (L.auroraY[0] + L.auroraY[1]) / 2, 30, i % 2 ? '#8af0c0' : '#b8d0ff', 0.07);
  }
  // stardust falling off the floating islands
  L.falls.forEach(([fx2, fy2], i) => {
    for (let k = 0; k < 5; k++) {
      const fy3 = fy2 + ((t * 14 + k * 9 + i * 5) % 34);
      twinkle(ctx, fx2 + Math.sin(t + k) * 3, fy3, 1, '#ffe7a8', t * 2, k * 1.3 + i);
    }
  });
  // shooting star: brief diagonal streak on a t-schedule
  const sph = t % L.shootPeriod;
  if (sph < L.shootDur) {
    const cyc = Math.floor(t / L.shootPeriod);
    const sx = 60 + hash(cyc) * (W - 160) + sph * 120, sy = 10 + hash(cyc + 2) * 30 + sph * 46;
    ctx.strokeStyle = 'rgba(255,246,216,' + (1 - sph / L.shootDur).toFixed(3) + ')';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 14, sy - 6); ctx.stroke();
  }
  // the whole mid layer floats (bust, stairway, spectres — it's a dream)
  ctx.save();
  ctx.translate(0, Math.sin(t * L.bustHz * Math.PI * 2) * L.bustBob);
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  ctx.restore();
  // RARE: the counting sheep bounces across
  const shp = t % L.sheepPeriod;
  if (shp < L.sheepDur) {
    const sx = -12 + (W + 24) * (shp / L.sheepDur);
    const sy = L.sheepY - Math.abs(Math.sin(shp * Math.PI * 4)) * 18;
    ctx.fillStyle = '#e8f2ff';                              // fluffy body
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.arc(sx - 4, sy + 1, 3, 0, Math.PI * 2); ctx.arc(sx + 4, sy + 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#26304f';                              // face + legs
    ctx.fillRect((sx + 5) | 0, (sy - 3) | 0, 3, 3);
    ctx.fillRect((sx - 3) | 0, (sy + 4) | 0, 1, 2); ctx.fillRect((sx + 2) | 0, (sy + 4) | 0, 1, 2);
  }
  if (layers.near) {
    ctx.save();
    ctx.translate(Math.sin(t * L.wispHz) * L.wispSway, 0);
    ctx.drawImage(layers.near, 0, 0);
    ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.12); ctx.fillRect(0, 0, W, floorTop); }
};

// MOUNTAIN TEMPLE (Bishop Bruiser) — twilight peaks, pillared shrine, monks, flags.
function templeScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.temple;
  sky(ctx, W, floorTop, C.sky);
  for (let i = 0; i < 2; i++) { const cx = drift(t, 5 + i * 3, W, 50, i * 200); ctx.fillStyle = C.cloud; ctx.beginPath(); ctx.ellipse(cx, floorTop * (0.2 + i * 0.2), 46, 8, 0, 0, TAU); ctx.fill(); }
  const peak = (x, w, h, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, floorTop); ctx.lineTo(x + w / 2, floorTop - h); ctx.lineTo(x + w, floorTop); ctx.closePath(); ctx.fill(); };
  peak(-20, 160, floorTop * 0.7, C.peak2); peak(W - 140, 170, floorTop * 0.8, C.peak2);
  const bx = W / 2 - 70, bw = 140, baseY = floorTop - 40;
  ctx.fillStyle = C.stone; ctx.fillRect(bx, baseY, bw, 40);
  ctx.fillStyle = C.stoneHi; for (let i = 0; i < 4; i++) ctx.fillRect(bx + 12 + i * 36, baseY, 8, 40);
  ctx.fillStyle = C.roof; ctx.beginPath(); ctx.moveTo(bx - 14, baseY); ctx.lineTo(W / 2, baseY - 30); ctx.lineTo(bx + bw + 14, baseY); ctx.closePath(); ctx.fill();
  crowdRow(ctx, W, floorTop - 12, 8, C.monkN, C.monk, t, { wave: 0.8, speed: 1, sz: 5, alpha: 0.8, flare: crowd * 0.2 });
  for (let i = 0; i < 8; i++) {
    const fx = W * 0.2 + i * (W * 0.6 / 8), fy = 24 + Math.sin(i) * 4, flutter = 0.6 + 0.4 * Math.sin(t * 4 * A() + i);
    ctx.fillStyle = C.flag[i % C.flag.length]; ctx.fillRect(fx, fy, 12 * flutter, 8);
  }
}
SCENES.temple = { draw: templeScene };

// MOUNTAIN TEMPLE v2 — painted twilight monastery + living light: the GONG
// rings at every round start (t resets per boxing half), candle bowls burn
// down the monk row, incense rises, a crane glides the peaks.
SCENES.temple.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.temple, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  for (let i = 0; i < L.cloudN; i++)                     // drifting twilight cloud glows
    additiveGlow(ctx, drift(t, 4 + i * 2, W, 60, i * 160), 56 + i * 8, 40, '#cdd6ff', 0.05);
  // RARE: a crane glides across the peaks
  const cph = t % L.cranePeriod;
  if (cph < L.craneDur) {
    const cx = -16 + (W + 32) * (cph / L.craneDur), cy = 58 + Math.sin(cph * 2) * 5;
    const wing = Math.sin(t * 6) * 4;
    ctx.strokeStyle = L.craneCol; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - wing); ctx.lineTo(cx, cy); ctx.lineTo(cx + 7, cy - wing);
    ctx.moveTo(cx, cy); ctx.lineTo(cx + 5, cy + 1);      // trailing legs
    ctx.stroke();
  }
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // THE GONG rings at every round start: warm shimmer + expanding rings
  if (t < L.gongS) {
    const k = t / L.gongS;
    additiveGlow(ctx, L.gong[0], L.gong[1], L.gongR * 2, '#ffd24a', 0.5 * (1 - k));
    for (let r = 0; r < 2; r++) {
      ctx.strokeStyle = withA('#ffe7a8', (1 - k) * (0.5 - r * 0.2));
      ctx.lineWidth = 2 - r;
      ctx.beginPath(); ctx.arc(L.gong[0], L.gong[1], L.gongR + 4 + k * (26 + r * 14), 0, Math.PI * 2); ctx.stroke();
    }
  }
  // stone-lantern glows + monk candle bowls
  L.lanterns.forEach(([lx, ly], i) => additiveGlow(ctx, lx, ly, 12, L.fireGlow, 0.35 + 0.05 * Math.sin(t * 2 + i)));
  for (let bx = L.bowls.x0; bx <= L.bowls.x1; bx += L.bowls.pitch)
    flame(ctx, bx, L.bowls.y - 2, 3, t, bx * 0.13, L.fireCore, L.fireMid, L.fireGlow);
  // incense: thin rising smoke wisps
  L.burners.forEach(([sx, sy], i) => {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.25 + k * 0.33 + i * 0.5) % 1;
      additiveGlow(ctx, sx + Math.sin(t * 0.8 + k * 2 + i) * (3 + ph * 8), sy - ph * 54, 5 + ph * 7, L.smokeCol, 0.10 * (1 - ph));
    }
  });
  if (layers.near) {
    ctx.save(); ctx.translate(Math.sin(t * L.flagHz) * L.flagSway, 0);
    ctx.drawImage(layers.near, 0, 0); ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.10); ctx.fillRect(0, 0, W, floorTop); }
};

// SKY CASTLE (Queen Quake) — bright sky, parallax clouds, floating keep, banners, birds.
function castleScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.castle;
  sky(ctx, W, floorTop, C.sky);
  for (let i = 0; i < C.cloudN; i++) {
    const cx = drift(t, 3 + i * 2, W, 60, i * 130), cy = floorTop * (0.12 + 0.22 * hash(i + 1));
    ctx.fillStyle = C.cloud; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(cx, cy, 50, 14, 0, 0, TAU); ctx.ellipse(cx + 26, cy + 4, 30, 10, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  const bob = Math.sin(t * 0.8 * A()) * 4, midY = floorTop * 0.5 + bob;
  for (const tx of [W / 2 - 64, W / 2 + 40]) {
    ctx.fillStyle = C.tower; ctx.fillRect(tx, midY - 30, 24, 70);
    ctx.fillStyle = C.roof; ctx.beginPath(); ctx.moveTo(tx - 4, midY - 30); ctx.lineTo(tx + 12, midY - 50); ctx.lineTo(tx + 28, midY - 30); ctx.closePath(); ctx.fill();
    const fl = 0.6 + 0.4 * Math.sin(t * 4 + tx); ctx.fillStyle = C.banner; ctx.fillRect(tx + 12, midY - 50, 8 * fl, 12);
  }
  ctx.fillStyle = C.keep; ctx.fillRect(W / 2 - 34, midY - 10, 68, 50);
  ctx.fillStyle = shade(C.keep, -30); ctx.fillRect(W / 2 - 8, midY + 14, 16, 26);
  crowdRow(ctx, W, midY + 42, 6, C.crowdN, C.crowd, t, { wave: 1, speed: 2, sz: 3, alpha: 0.6, flare: crowd * SCENERY.CROWD_FLARE });
  for (let i = 0; i < 3; i++) {
    const bx = W / 2 + Math.cos(t * 0.8 + i * 2) * 90, by = floorTop * 0.3 + Math.sin(t * 0.8 + i * 2) * 20;
    ctx.strokeStyle = C.bird; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(bx - 4, by); ctx.lineTo(bx, by - 2 - Math.sin(t * 8 + i)); ctx.lineTo(bx + 4, by); ctx.stroke();
  }
}
SCENES.castle = { draw: castleScene };

// DEEP SPACE (Iron Endgame) — starfield, ringed planet, nebula, astronaut gallery.
function spaceScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.space;
  const g = ctx.createRadialGradient(W * 0.7, floorTop * 0.3, 4, W * 0.5, floorTop * 0.5, W * 0.8);
  g.addColorStop(0, C.core); g.addColorStop(1, C.edge); ctx.fillStyle = g; ctx.fillRect(0, 0, W, floorTop);
  for (let i = 0; i < C.starN; i++) twinkle(ctx, hash(i) * W, hash(i + 9) * floorTop * 0.85, 1 + (hash(i + 3) > 0.8 ? 1 : 0), C.star, t, i);
  glow(ctx, drift(t, 3, W, 60, 0), floorTop * 0.55, 70, C.neb, 0.22 + 0.06 * Math.sin(t));
  const px = W * 0.74, py = floorTop * 0.32;
  const pg = ctx.createRadialGradient(px - 6, py - 6, 2, px, py, 26);
  pg.addColorStop(0, C.planet[0]); pg.addColorStop(0.6, C.planet[1]); pg.addColorStop(1, C.planet[2]);
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 24, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.ring; ctx.lineWidth = 3; ctx.save(); ctx.translate(px, py); ctx.rotate(-0.3); ctx.scale(1, 0.32); ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.stroke(); ctx.restore();
  ctx.fillStyle = C.gallery; ctx.fillRect(0, floorTop - 24, W, 24);
  for (let i = 0; i < C.astN; i++) {
    const ax = (i + 0.5) / C.astN * W, ay = floorTop - 14 + Math.sin(t * 1.5 * A() + i * 1.7) * 4;
    glow(ctx, ax, ay, 7, C.ast, 0.4 + crowd * 0.4);
    ctx.fillStyle = C.ast; ctx.fillRect(ax - 4, ay - 6, 8, 12); ctx.fillStyle = C.planet[1]; ctx.fillRect(ax - 2, ay - 4, 4, 3);
  }
}
SCENES.space = { draw: spaceScene };

// UNDERWATER CAVE (Tal Tempest) — teal depths, rock walls, little fires, jellyfish, bubbles.
function abyssScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.abyss;
  sky(ctx, W, floorTop, C.sky);
  ctx.globalAlpha = 0.12; ctx.fillStyle = C.jelly[1];
  for (let x = 0; x < W; x += 16) ctx.fillRect(x, 6 + Math.sin(t * 2 + x * 0.04) * 4, 8, 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.rock;
  ctx.beginPath(); ctx.moveTo(0, floorTop); ctx.lineTo(0, floorTop * 0.5); ctx.lineTo(70, floorTop); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W, floorTop); ctx.lineTo(W, floorTop * 0.4); ctx.lineTo(W - 84, floorTop); ctx.closePath(); ctx.fill();
  for (let i = 0; i < C.fireN; i++) flame(ctx, 24 + i * 18, floorTop - 18 - i * 4, 5, t, i * 2, C.fireCore, C.fireMid, C.fireGlow);
  for (let i = 0; i < C.jellyN; i++) {
    const jx = (i + 0.5) / C.jellyN * W + Math.sin(t + i) * 14;
    const jy = floorTop - ((t * 18 * A() + i * 40) % (floorTop + 20));
    const col = C.jelly[i % C.jelly.length];
    glow(ctx, jx, jy, 16, col, 0.5 + crowd * 0.3);
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(jx, jy, 9, 7, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
    for (let k = -2; k <= 2; k++) { ctx.moveTo(jx + k * 3, jy); ctx.lineTo(jx + k * 3 + Math.sin(t * 3 + k) * 2, jy + 10); }
    ctx.stroke();
  }
  for (let i = 0; i < C.bubN; i++) {
    const bx = hash(i) * W, by = floorTop - ((t * 30 * A() + i * 25) % (floorTop + 10));
    ctx.fillStyle = C.bub; ctx.beginPath(); ctx.arc(bx, by, 1.5 + hash(i + 1) * 1.5, 0, TAU); ctx.fill();
  }
}
SCENES.abyss = { draw: abyssScene };

// GRAND CHESS HALL (Magnus) — tall windows, columns, chandeliers, rows of boards.
function chesshallScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.chesshall;
  sky(ctx, W, floorTop, C.sky);
  ctx.fillStyle = C.win;
  for (let i = 0; i < 4; i++) { const x = 24 + i * (W - 48) / 4; ctx.fillRect(x, 8, 26, 70); }
  ctx.fillStyle = C.col;
  for (const x of [70, W / 2 - 7, W - 84]) ctx.fillRect(x, 0, 14, floorTop);
  for (let i = 0; i < C.chandN; i++) {
    const cx = (i + 0.5) / C.chandN * W, cy = 14 + Math.sin(t * 1.5 * A() + i) * 3;
    ctx.strokeStyle = shade(C.chand, -60); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, cy); ctx.stroke();
    glow(ctx, cx, cy, 14, C.chand, 0.5); ctx.fillStyle = C.chand; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < C.headN; i++) {
    const tx = 30 + i * (W - 60) / (C.headN - 1), ty = floorTop - 22;
    ctx.fillStyle = C.tableTop; ctx.fillRect(tx - 14, ty, 28, 4);
    ctx.fillStyle = C.table; ctx.fillRect(tx - 14, ty + 4, 28, 8);
    ctx.fillStyle = C.piece; ctx.fillRect(tx - 3, ty - 6, 2, 6); ctx.fillRect(tx + 1, ty - 6, 2, 6);
    const hx = tx + Math.sin(t * 1.2 + i) * 2;
    ctx.fillStyle = C.head; ctx.beginPath(); ctx.arc(hx, ty - 12, 4, 0, TAU); ctx.fill();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(C.chand, crowd * 0.12); ctx.fillRect(0, 0, W, floorTop); }
}
SCENES.chesshall = { draw: chesshallScene };

// MEGA STADIUM (THE PAWNCHION) — packed tiers doing the WAVE, lights, jumbotron, confetti.
function stadiumScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.stadium;
  sky(ctx, W, floorTop, C.sky);
  for (const lx of [W * 0.12, W * 0.88]) {
    const on = 0.7 + 0.3 * Math.sin(t * 3 + lx);
    glow(ctx, lx, 8, 22, C.light, 0.5 * on);
    ctx.fillStyle = C.light; ctx.globalAlpha = on; ctx.fillRect(lx - 5, 2, 10, 8); ctx.globalAlpha = 1;
  }
  for (let band = 0; band < C.tierN; band++) {
    const y = 18 + band * 16, h = 14;
    for (let i = 0; i < 64; i++) {
      const x = i / 64 * W, dy = Math.sin(t * 3 * A() - i * 0.35 + band * 0.5) * 4;
      ctx.fillStyle = C.tiers[(i + band) % C.tiers.length];
      ctx.globalAlpha = Math.min(1, 0.6 + crowd * SCENERY.CROWD_FLARE);
      ctx.fillRect(x | 0, (y + dy) | 0, 6, h);
    }
  }
  ctx.globalAlpha = 1;
  const jx = W / 2 - 36, jy = 14;
  ctx.fillStyle = C.jumboFrame; ctx.fillRect(jx - 3, jy - 3, 78, 42);
  ctx.fillStyle = C.jumbo; ctx.fillRect(jx, jy, 72, 36);
  glow(ctx, W / 2, jy + 18, 40, C.tiers[1], 0.18);
  text(ctx, 'PAWNCH', W / 2, jy + 12, { scale: 1, color: C.tiers[0], align: 'center' });
  text(ctx, 'CHAMP', W / 2, jy + 24, { scale: 1, color: C.tiers[2], align: 'center' });
  for (let i = 0; i < 18; i++) {
    const cx = hash(i) * W, cy = (t * 40 * A() + i * 30) % floorTop;
    ctx.fillStyle = C.conf[i % C.conf.length]; ctx.fillRect(cx, cy, 3, 5);
  }
  ctx.fillStyle = C.floor; ctx.fillRect(0, floorTop - 18, W, 18);
}
SCENES.stadium = { draw: stadiumScene };
