// PAWNCH graphics toolkit: a 5x7 pixel bitmap font, UI panels, the big
// arcade-fighter logo, chess-piece glyphs, boxer sprites, the ring, and a
// small particle/fx system. All drawn procedurally to the canvas so the game
// is asset-free — but if Aseprite art is registered (see assets.js) it's
// blitted instead of the procedural fallback.

import { PAL, AURA, PIECE_FX } from './config.js';

// ---- Aseprite sprite registry -----------------------------------------
// assets.js loads optional PNGs and registers them here keyed by name. Draw
// helpers below prefer a registered image and otherwise return false so the
// procedural art runs. Boxer keys: `${front|back}:${pose}`. Piece keys:
// `${w|b}${type}` e.g. 'wq', 'bn'.
// Pieces are grouped into named SETS (e.g. 'celestial', 'arcane'); each set is a
// full {wp..bk} map and exactly one is active at a time (chosen via settings /
// unlock). The active set's NAME also picks the magic theme (see SET_THEME +
// PIECE_FX) even when its images are absent, so the procedural fallback matches.
const SPRITES = { boxers: {}, pieceSets: {} };
let activePieceSet = 'celestial';
const SET_THEME = { celestial: 'celestial', arcane: 'arcane' };

export function registerSprite(group, key, img) { (SPRITES[group] ||= {})[key] = img; }
export function registerPiece(set, key, img) { (SPRITES.pieceSets[set] ||= {})[key] = img; }
export function setPieceSet(name) { if (SET_THEME[name]) activePieceSet = name; return activePieceSet; }
export function hasSprites() { return Object.keys(SPRITES.boxers).length + Object.values(SPRITES.pieceSets).reduce((n, s) => n + Object.keys(s).length, 0) > 0; }


// Per-type on-board height as a fraction of a king's; the cleaned sprites are
// tight-cropped so the source's (inconsistent) heights don't matter — we scale
// every sprite to a target height here, so a white king == a black king.
const PIECE_TYPE_H = { k: 1.00, q: 0.95, b: 0.87, n: 0.90, r: 0.80, p: 0.72 };
const PIECE_BASE = 1.34;   // king height = size * PIECE_BASE (fills the square + a touch)

// A soft glow that follows the piece's SILHOUETTE (instead of a flat disc): a
// blurred, tinted copy of the sprite drawn additively behind it. The tinted
// silhouette is cached on the image (one glow color per piece).
function silhouetteGlow(ctx, img, x, y, w, h, color, alpha) {
  if (alpha <= 0) return;
  const sil = tintedSilhouette(img, color);
  const pad = Math.max(2, Math.round(h * 0.07));   // grow slightly so the glow spills past the edge
  const blur = Math.max(2, Math.round(h * 0.06));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.filter = `blur(${blur}px)`;                  // soft halo hugging the shape
  ctx.drawImage(sil, x - pad, y - pad, w + pad * 2, h + pad * 2);
  ctx.restore();
}
function tintedSilhouette(img, color) {
  if (img.__sil && img.__silColor === color) return img.__sil;
  if (typeof document === 'undefined') return img;   // headless: glow the sprite itself
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';          // keep alpha, replace color
  g.fillStyle = color;
  g.fillRect(0, 0, cv.width, cv.height);
  img.__sil = cv; img.__silColor = color;
  return cv;
}

function drawPieceSprite(ctx, type, cx, cy, size, white, opts = {}) {
  const ty = type.toLowerCase();
  const img = (SPRITES.pieceSets[activePieceSet] || {})[(white ? 'w' : 'b') + ty];
  if (!img) return false;
  const h = size * PIECE_BASE * (PIECE_TYPE_H[ty] || 0.9);
  const w = h * (img.width / img.height);
  const { t: time = 0, phase = 0, glow = 1 } = opts;
  const bob = Math.sin(time * 2 + phase) * size * 0.018;     // gentle idle float
  const cyy = cy + size * 0.03 - bob;                        // rest the base on the square
  const ix = Math.round(cx - w / 2), iy = Math.round(cyy - h / 2), iw = Math.round(w), ih = Math.round(h);
  // faint contact shadow so the piece sits on the square
  ctx.fillStyle = 'rgba(7,10,22,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cyy + h * 0.46, w * 0.30, size * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // soft light glow that hugs the piece silhouette (replaces the old flat disc)
  if (glow > 0) {
    const spec = pieceFxSpec(white);
    const pulse = 0.5 + 0.5 * Math.sin(time * 2 + phase);
    silhouetteGlow(ctx, img, ix, iy, iw, ih, spec.halo, spec.haloA * glow * (1.4 + 0.5 * pulse));
  }
  // orbiting motes / sun-rays behind the piece
  pieceAura(ctx, cx, cyy, size, white, time, phase, glow, 'back');
  ctx.drawImage(img, ix, iy, iw, ih);
  // sparkles / front half of the swirl (drawn over the piece)
  pieceAura(ctx, cx, cyy, size, white, time, phase, glow, 'front');
  return true;
}

// Blit ONLY the registered piece image (no aura/float/shadow), centered at
// (cx,cy) at a given pixel height `h`. Returns false if no sprite is loaded —
// callers can then fall back to the procedural glyph. Used for the coin engraving.
export function pieceSprite(ctx, type, white, cx, cy, h) {
  const img = (SPRITES.pieceSets[activePieceSet] || {})[(white ? 'w' : 'b') + type.toLowerCase()];
  if (!img) return false;
  const w = h * (img.width / img.height);
  ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
  return true;
}

// Animated magic around a piece during the chess half. The flavor depends on the
// ACTIVE piece set + the piece color (see PIECE_FX in config.js): the default
// CELESTIAL set gives white pieces a warm "sun" radiance and dark pieces a cool
// "galaxy/supernova" swirl; the unlockable ARCANE set keeps the original purple
// swirl (dark) + celestial-blue twinkle (white). Kept low-alpha and tight so it
// reads as atmosphere over the art's own glow. `layer` is 'back' (behind the
// sprite) or 'front' (over it) so motes orbit in 3D.
const TAU = Math.PI * 2;
function pieceFxSpec(white) {
  const theme = SET_THEME[activePieceSet] || 'celestial';
  return (PIECE_FX[theme] || PIECE_FX.celestial)[white ? 'white' : 'dark'];
}
function pieceAura(ctx, cx, cy, size, white, t, phase, glow, layer) {
  if (glow <= 0) return;
  const cyA = cy - size * 0.05;                 // center the aura on the piece body
  const spec = pieceFxSpec(white);
  // The soft back glow now HUGS the sprite silhouette (see silhouetteGlow in
  // drawPieceSprite) instead of a flat disc; here we only add the orbiting
  // motes / glints / sun-rays / embers on top.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';     // additive glow
  (AURA_FX[spec.kind] || AURA_FX.swirl)(ctx, cx, cyA, size, t, phase, glow, layer);
  ctx.restore();
}

// The four magic flavors. Each draws the per-frame motes/glints for one `layer`
// ('back' behind the piece, 'front' over it); the soft halo is handled above.
const AURA_FX = {
  // ARCANE white — twinkling celestial star-glints orbiting slowly.
  glints(ctx, cx, cyA, size, t, phase, glow, layer) {
    if (layer !== 'front') return;
    const N = AURA.glintCount;
    for (let i = 0; i < N; i++) {
      const ang = t * 0.5 + phase + i * (TAU / N);
      const px = cx + Math.cos(ang) * size * AURA.glintOrbitX;
      const py = cyA + Math.sin(ang) * size * AURA.glintOrbitY;
      let tw = Math.sin(t * 2.3 + phase * 1.3 + i * 1.9);
      tw = tw > 0 ? tw * tw * tw : 0;            // sharp blink
      if (tw > 0.03) starGlint(ctx, px, py, size * AURA.glintSize * (0.5 + tw), tw * 0.85 * glow, PAL.glintCore, PAL.glint);
    }
  },
  // ARCANE dark — purple/magenta motes swirling in 3D + rising embers.
  swirl(ctx, cx, cyA, size, t, phase, glow, layer) {
    const N = AURA.moteCount;
    for (let i = 0; i < N; i++) {
      const ang = t * 1.6 + phase + i * (TAU / N);
      const depth = (Math.sin(ang) + 1) / 2;     // 1 = near (front), 0 = far (back)
      if ((depth >= 0.5) !== (layer === 'front')) continue;
      const px = cx + Math.cos(ang) * size * AURA.moteOrbitX;
      const py = cyA + Math.sin(ang) * size * AURA.moteOrbitY;
      const r = (0.6 + 0.7 * depth) * size * AURA.moteSize;
      glowDot(ctx, px, py, r, i % 2 ? PAL.moteMagenta : PAL.moteViolet, (0.18 + 0.28 * depth) * glow);
    }
    if (layer === 'front') for (let j = 0; j < 2; j++) {
      const u = (t * 0.5 + phase * 0.3 + j * 0.5) % 1;
      const px = cx + Math.sin(u * TAU + j * 2) * size * AURA.emberSway;
      const py = cyA + size * 0.30 - u * size * AURA.emberRise;
      glowDot(ctx, px, py, size * 0.032, PAL.ember, Math.sin(u * Math.PI) * 0.22 * glow);
    }
  },
  // CELESTIAL white — "magic of the sun": a faint rotating ray-burst behind the
  // piece, twinkling gold sparks + a couple of rising warm embers in front.
  sun(ctx, cx, cyA, size, t, phase, glow, layer) {
    if (layer === 'back') {
      const rays = 8, rot = t * 0.25 + phase;
      ctx.lineWidth = Math.max(1, size * 0.03);
      for (let i = 0; i < rays; i++) {
        const a = rot + i * (TAU / rays);
        const len = size * (0.32 + 0.05 * Math.sin(t * 2 + i));
        ctx.strokeStyle = withA(PAL.sunFlare, 0.06 * glow);
        ctx.beginPath(); ctx.moveTo(cx, cyA); ctx.lineTo(cx + Math.cos(a) * len, cyA + Math.sin(a) * len); ctx.stroke();
      }
      return;
    }
    const N = AURA.glintCount;
    for (let i = 0; i < N; i++) {
      const ang = t * 0.6 + phase + i * (TAU / N);
      const px = cx + Math.cos(ang) * size * AURA.glintOrbitX;
      const py = cyA + Math.sin(ang) * size * AURA.glintOrbitY;
      let tw = Math.sin(t * 2.6 + phase * 1.3 + i * 1.7);
      tw = tw > 0 ? tw * tw * tw : 0;
      if (tw > 0.03) starGlint(ctx, px, py, size * AURA.glintSize * (0.5 + tw), tw * 0.8 * glow, PAL.sunCore, PAL.sunFlare);
    }
    for (let j = 0; j < 2; j++) {
      const u = (t * 0.45 + phase * 0.3 + j * 0.5) % 1;
      const px = cx + Math.sin(u * TAU + j * 2) * size * AURA.emberSway;
      const py = cyA + size * 0.26 - u * size * AURA.emberRise * 0.9;
      glowDot(ctx, px, py, size * 0.03, PAL.sunEmber, Math.sin(u * Math.PI) * 0.20 * glow);
    }
  },
  // CELESTIAL dark — "magic of supernovas & galaxies": star-motes orbiting on a
  // flattened galactic disc (front/back 3D split) + a couple of distant twinkles.
  galaxy(ctx, cx, cyA, size, t, phase, glow, layer) {
    const N = AURA.moteCount + 1;
    for (let i = 0; i < N; i++) {
      const ang = t * 1.2 + phase + i * (TAU / N);
      const depth = (Math.sin(ang) + 1) / 2;
      if ((depth >= 0.5) !== (layer === 'front')) continue;
      const px = cx + Math.cos(ang) * size * AURA.moteOrbitX * 1.15;
      const py = cyA + Math.sin(ang) * size * AURA.moteOrbitY * 0.8;
      const r = (0.5 + 0.8 * depth) * size * AURA.moteSize;
      glowDot(ctx, px, py, r, i % 2 ? PAL.galaxyStar : PAL.galaxyNebula, (0.16 + 0.26 * depth) * glow);
    }
    if (layer === 'front') for (let i = 0; i < 2; i++) {
      const ang = t * 0.4 + phase * 1.7 + i * 2.3;
      const px = cx + Math.cos(ang) * size * 0.30;
      const py = cyA + Math.sin(ang * 1.3) * size * 0.24;
      let tw = Math.sin(t * 3 + i * 2.1); tw = tw > 0 ? tw * tw : 0;
      if (tw > 0.04) starGlint(ctx, px, py, size * 0.05 * (0.5 + tw), tw * 0.7 * glow, PAL.galaxyCore, PAL.galaxyStar);
    }
  },
};

function glowDot(ctx, x, y, r, hex, a) {
  if (a <= 0) return;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, withA(hex, a));
  gr.addColorStop(1, withA(hex, 0));
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function starGlint(ctx, x, y, s, a, core = PAL.glintCore, line = PAL.glint) {
  glowDot(ctx, x, y, s * 0.9, core, a * 0.9);   // soft core
  ctx.strokeStyle = withA(line, a);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x, y + s * 1.6);
  ctx.moveTo(x - s * 1.6, y); ctx.lineTo(x + s * 1.6, y);
  ctx.stroke();
}

// ---- 5x7 bitmap font ---------------------------------------------------
const F = {
  A:['01110','10001','10001','11111','10001','10001','10001'],
  B:['11110','10001','11110','10001','10001','10001','11110'],
  C:['01110','10001','10000','10000','10000','10001','01110'],
  D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','11110','10000','10000','10000','11111'],
  F:['11111','10000','11110','10000','10000','10000','10000'],
  G:['01110','10001','10000','10111','10001','10001','01110'],
  H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['01110','00100','00100','00100','00100','00100','01110'],
  J:['00111','00010','00010','00010','10010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'],
  L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'],
  N:['10001','11001','10101','10011','10001','10001','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'],
  Q:['01110','10001','10001','10001','10101','10010','01101'],
  R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'],
  T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110'],
  V:['10001','10001','10001','10001','10001','01010','00100'],
  W:['10001','10001','10001','10101','10101','11011','10001'],
  X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'],
  Z:['11111','00010','00100','01000','10000','10000','11111'],
  '0':['01110','10011','10101','10101','11001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00110','01000','10000','11111'],
  '3':['11111','00010','00100','00010','00001','10001','01110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','11110','00001','00001','10001','01110'],
  '6':['00110','01000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00010','01100'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
  '.':['00000','00000','00000','00000','00000','01100','01100'],
  ',':['00000','00000','00000','00000','00000','00100','01000'],
  '!':['00100','00100','00100','00100','00100','00000','00100'],
  '?':['01110','10001','00010','00100','00100','00000','00100'],
  ':':['00000','01100','01100','00000','01100','01100','00000'],
  '-':['00000','00000','00000','11111','00000','00000','00000'],
  '+':['00000','00100','00100','11111','00100','00100','00000'],
  '/':['00001','00010','00100','00100','00100','01000','10000'],
  "'":['00100','00100','00100','00000','00000','00000','00000'],
  '(':['00010','00100','01000','01000','01000','00100','00010'],
  ')':['01000','00100','00010','00010','00010','00100','01000'],
  '#':['01010','11111','01010','01010','11111','01010','00000'],
  '%':['11001','11010','00100','01011','10011','00000','00000'],
  '*':['00000','10101','01110','11111','01110','10101','00000'],
  '=':['00000','00000','11111','00000','11111','00000','00000'],
  '<':['00010','00100','01000','10000','01000','00100','00010'],
  '>':['01000','00100','00010','00001','00010','00100','01000'],
  '&':['01100','10010','10010','01100','10101','10010','01101'],
};

// Draw text. scale = pixel size. Returns width in px.
export function text(ctx, str, x, y, { scale = 2, color = PAL.text, align = 'left', shadow = null, spacing = 1 } = {}) {
  str = String(str).toUpperCase();
  const cw = (5 + spacing) * scale;
  const w = str.length * cw - spacing * scale;
  let ox = x;
  if (align === 'center') ox = x - w / 2;
  if (align === 'right') ox = x - w;
  ox = Math.round(ox);
  if (shadow) drawStr(ctx, str, ox + scale, Math.round(y) + scale, scale, shadow, spacing);
  drawStr(ctx, str, ox, Math.round(y), scale, color, spacing);
  return w;
}
function drawStr(ctx, str, x, y, scale, color, spacing) {
  ctx.fillStyle = color;
  let ox = x;
  for (const ch of str) {
    const g = F[ch] || F['?'];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let c = 0; c < 5; c++) if (row[c] === '1') ctx.fillRect(ox + c * scale, y + r * scale, scale, scale);
    }
    ox += (5 + spacing) * scale;
  }
}
export function textWidth(str, scale = 2, spacing = 1) {
  return String(str).length * (5 + spacing) * scale - spacing * scale;
}

// ---- UI primitives -----------------------------------------------------
export function panel(ctx, x, y, w, h, { fill = PAL.panel, border = PAL.blue, border2 = PAL.blueDark, glow = false } = {}) {
  if (glow) { ctx.fillStyle = 'rgba(43,108,255,0.10)'; ctx.fillRect(x - 6, y - 6, w + 12, h + 12); }
  ctx.fillStyle = border2; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = border;  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = fill;    ctx.fillRect(x, y, w, h);
}

export function barH(ctx, x, y, w, h, pct, { fill = PAL.green, back = '#10162e', border = PAL.ink } = {}) {
  ctx.fillStyle = border; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
  const fw = Math.max(0, Math.round(w * Math.max(0, Math.min(1, pct))));
  ctx.fillStyle = fill; ctx.fillRect(x, y, fw, h);
  // segmented sheen
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, fw, Math.max(1, h / 3 | 0));
}

// ---- big logo ----------------------------------------------------------
// "PAWNCH" rendered as a chunky, forward-leaning, beveled arcade-fighter logo
// (an original wordmark that EVOKES the early-'90s fighting-game look — not a
// copy of any real game's trademarked logo). Warm gold->orange->red metallic
// gradient, bright chrome top highlight, thick black outline, blue brand rim,
// bold drop shadow, an upward arch, and a chiseled 3D bevel on every block.
// Pixel-crisp (per-row integer italic shear).
const LOGO_GRAD = ['#fff3c8', '#ffe070', '#ffbe33', '#ff8a1e', '#f4600f', '#cf3c08', '#9c2402'];

export function logo(ctx, cx, y, scale = 11, wobble = 0) {
  const word = 'PAWNCH';
  const s = scale;
  const shear = 0.34;                          // italic lean (top pushed right)
  const cw = (5 + 1) * s;                       // glyph cell incl. 1-col gap
  const totalW = word.length * cw - s;
  const maxShear = Math.round(6 * s * shear);
  const ox = cx - totalW / 2 - maxShear / 2;    // center accounting for the lean
  const mid = (word.length - 1) / 2;
  for (let i = 0; i < word.length; i++) {
    // upward marquee arch: ends sit lower than the middle
    const arch = Math.round(s * 0.9 * Math.pow((i - mid) / mid, 2));
    const bob = Math.round(Math.sin(wobble + i * 0.6) * s * 0.35);
    bevelGlyph(ctx, word[i], ox + i * cw, y + arch + bob, s, shear);
  }
}

// shift x per glyph-row for the italic lean (integer px -> stays pixelated)
const shearPx = (r, s, shear) => Math.round((6 - r) * s * shear);

function bevelGlyph(ctx, ch, x, y, s, shear) {
  const g = F[ch] || F['?'];
  const out = Math.max(2, Math.round(s / 4));   // black outline thickness
  const rim = Math.max(1, Math.round(s / 6));   // blue brand rim thickness
  const bev = Math.max(1, Math.round(s / 4));   // bevel thickness
  const px = (c, r) => Math.round(x + c * s + shearPx(r, s, shear));
  const py = (r) => Math.round(y + r * s);
  const each = (fn) => { for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '1') fn(c, r); };

  // 1) bold drop shadow (down-right)
  ctx.fillStyle = '#120500';
  const sh = Math.round(s * 0.55);
  each((c, r) => ctx.fillRect(px(c, r) + sh, py(r) + sh, s, s));

  // 2) blue brand rim (widest), then thick black outline on top of it
  ctx.fillStyle = PAL.blue;
  each((c, r) => ctx.fillRect(px(c, r) - out - rim, py(r) - out - rim, s + (out + rim) * 2, s + (out + rim) * 2));
  ctx.fillStyle = PAL.ink;
  each((c, r) => ctx.fillRect(px(c, r) - out, py(r) - out, s + out * 2, s + out * 2));

  // 3) beveled metallic face with the warm gold->orange->red gradient
  each((c, r) => {
    const base = LOGO_GRAD[r];
    const X = px(c, r), Y = py(r);
    ctx.fillStyle = base; ctx.fillRect(X, Y, s, s);
    // bright chrome top + left highlight
    ctx.fillStyle = shade(base, 70);
    ctx.fillRect(X, Y, s, bev);
    ctx.fillRect(X, Y, bev, s);
    // deep bottom + right shadow
    ctx.fillStyle = shade(base, -70);
    ctx.fillRect(X, Y + s - bev, s, bev);
    ctx.fillRect(X + s - bev, Y, bev, s);
  });
}

// lighten/darken a #rrggbb hex by amt (-255..255)
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v) => Math.max(0, Math.min(255, v));
  const r = cl(((n >> 16) & 255) + amt), g = cl(((n >> 8) & 255) + amt), b = cl((n & 255) + amt);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ---- chess piece glyphs (8 wide x 11 tall pixel art) -------------------
// Taller, more recognizable Staunton-ish silhouettes. '1' = body.
const PIECE = {
  p:['00111100','01111110','01111110','00111100','00111100','01111110','01111110','00111100','01111110','11111111','11111111'],
  n:['00011000','00111100','01111100','11111110','11011110','00111110','00111100','01111110','01111110','11111111','11111111'],
  b:['00011000','00111100','00111100','00011000','00111100','00111100','00111100','00111100','01111110','11111111','11111111'],
  r:['10100101','11111111','11111111','01111110','00111100','00111100','00111100','01111110','01111110','11111111','11111111'],
  q:['01000010','10100101','11111111','01111110','00111100','00111100','01111110','01111110','01111110','11111111','11111111'],
  k:['00011000','00011000','01111110','00011000','00111100','00111100','01111110','01111110','01111110','11111111','11111111'],
};

// Draw a piece centered at (cx,cy) sized to ~`size` px tall, with a magical
// glow, gentle float, and a shimmer. `t`+`phase` desync the animation per
// square; `lift` raises it (selection/drag); `glow` controls the aura.
export function piece(ctx, type, cx, cy, size, white, { t = 0, phase = 0, lift = 0, glow = 1, shadow = true, clean = false } = {}) {
  if (!clean && drawPieceSprite(ctx, type, cx, cy - lift, size, white, { t, phase, glow })) return; // asset override (skip when exporting)
  const g = PIECE[type.toLowerCase()];
  const ROWS = g.length, COLS = 8;
  const s = Math.max(1, Math.round(size / ROWS));
  const w = COLS * s, h = ROWS * s;
  const bob = Math.sin(t * 2.2 + phase) * (size * 0.045);
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2 - lift - bob);

  const aura = pieceFxSpec(white).halo;   // match the active set's magic theme
  const body = white ? '#f3e6cf' : '#27304f';
  const bodySh = white ? '#cbb38c' : '#171d33';
  const hi = white ? '#ffffff' : '#586494';

  // magical aura
  if (glow > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + phase);
    const rad = size * (AURA.haloRadius + AURA.haloPulse * pulse);
    const gr = ctx.createRadialGradient(cx, cy - lift, 1, cx, cy - lift, rad);
    gr.addColorStop(0, withA(aura, (0.10 + 0.18 * pulse) * glow));
    gr.addColorStop(1, withA(aura, 0));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(cx, cy - lift, rad, 0, Math.PI * 2); ctx.fill();
  }
  // floating ground shadow (shrinks as it lifts; skipped for clean export)
  if (shadow) {
    const shA = Math.max(0.05, 0.28 - lift * 0.012);
    ctx.fillStyle = `rgba(0,0,0,${shA})`;
    ctx.fillRect(Math.round(cx - w * 0.32), Math.round(cy + h * 0.42), Math.round(w * 0.64), Math.max(1, Math.round(s * 0.7)));
  }

  const fill = (col, test) => {
    ctx.fillStyle = col;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (g[r][c] === '1' && test(r, c)) ctx.fillRect(x + c * s, y + r * s, s, s);
  };
  // outline (expand)
  ctx.fillStyle = PAL.ink;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (g[r][c] === '1') ctx.fillRect(x + c * s - 1, y + r * s - 1, s + 2, s + 2);
  // body + shading + top highlight
  fill(body, () => true);
  fill(bodySh, (r, c) => c >= 5);            // right-side shadow
  fill(hi, (r) => r < 3);                     // top highlight (crown/head)
  // shimmer sparkle that travels up the piece
  const spk = (Math.sin(t * 4 + phase) + 1) / 2;
  const sr = Math.floor(spk * (ROWS - 1));
  for (let c = 0; c < COLS; c++) if (g[sr]?.[c] === '1') { ctx.fillStyle = `rgba(255,255,255,${0.5 * glow})`; ctx.fillRect(x + c * s, y + sr * s, s, Math.max(1, s / 2)); break; }
}

export function withA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }


// ---- particle / fx system ---------------------------------------------
export class FX {
  constructor() { this.parts = []; this.shake = 0; this.flash = 0; this.flashColor = '#fff'; }
  burst(x, y, color, n = 12, speed = 2.4, life = 28) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random();
      const sp = speed * (0.5 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, g: 0.12, life, max: life, color, size: 2 + (Math.random() * 2 | 0) });
    }
  }
  spark(x, y, color, n = 6) { this.burst(x, y, color, n, 3.2, 18); }
  ring(x, y, color, life = 20) { this.parts.push({ ring: true, x, y, r: 2, vr: 2.2, life, max: life, color }); }
  doShake(amt) { this.shake = Math.max(this.shake, amt); }
  doFlash(color = '#fff', amt = 0.6) { this.flash = amt; this.flashColor = color; }
  update() {
    for (const p of this.parts) {
      if (p.ring) { p.r += p.vr; }
      else { p.x += p.vx; p.y += p.vy; p.vy += p.g; }
      p.life--;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    this.shake *= 0.82; if (this.shake < 0.3) this.shake = 0;
    this.flash *= 0.86; if (this.flash < 0.02) this.flash = 0;
  }
  draw(ctx) {
    for (const p of this.parts) {
      const a = p.life / p.max;
      ctx.globalAlpha = a;
      if (p.ring) { ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.fillStyle = p.color; ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size); }
    }
    ctx.globalAlpha = 1;
  }
  drawFlash(ctx, w, h) {
    if (this.flash > 0) { ctx.globalAlpha = this.flash; ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  }
  shakeOffset() { return this.shake ? [(Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake] : [0, 0]; }
}

// ---- shared scene bits -------------------------------------------------
export function bgGradient(ctx, w, h, top = PAL.ink2, bottom = PAL.ink) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// Boxing ring: perspective floor, ropes, corner posts, crowd glow.
// `accent` tints the arena per-opponent; `crowd` (0..1) flares the crowd on big hits.
export function ring(ctx, W, H, { floorTop = 150, accent = PAL.blue, crowd = 0 } = {}) {
  // The arena BACKDROP (gradient, spotlights, tiered crowd, accent wash) now lives
  // in scenery.js (the `classic` scene) so each opponent can swap it out. ring()
  // draws ONLY the physical ring over the chosen scene. `accent` still tints the
  // ropes/posts/emblem below; `crowd` is kept in the signature (unused here now).

  // ring apron (front skirt) + canvas floor
  ctx.fillStyle = mix(PAL.ringFloor, '#000', 0.35);
  ctx.fillRect(0, floorTop, W, 10);
  ctx.fillStyle = PAL.ringFloor;
  ctx.beginPath();
  ctx.moveTo(W * 0.16, floorTop + 8); ctx.lineTo(W * 0.84, floorTop + 8);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.ringFloor2;
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6, t1 = (i + 0.5) / 6;
    const y0 = floorTop + 8 + (H - floorTop - 8) * t0, y1 = floorTop + 8 + (H - floorTop - 8) * t1;
    const xl0 = lerp(W * 0.16, 0, t0), xr0 = lerp(W * 0.84, W, t0);
    const xl1 = lerp(W * 0.16, 0, t1), xr1 = lerp(W * 0.84, W, t1);
    ctx.beginPath(); ctx.moveTo(xl0, y0); ctx.lineTo(xr0, y0); ctx.lineTo(xr1, y1); ctx.lineTo(xl1, y1); ctx.closePath(); ctx.fill();
  }
  // center canvas emblem (subtle)
  ctx.save(); ctx.globalAlpha = 0.10;
  ctx.strokeStyle = accent; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(W / 2, H - 70, 120, 34, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.12; text(ctx, 'PAWNCH', W / 2, H - 78, { scale: 2, color: accent, align: 'center' });
  ctx.restore();

  // ropes: 3, sagging in the middle, with highlight + a little color
  const ropeYs = [floorTop - 40, floorTop - 26, floorTop - 12];
  const ropeCols = [PAL.ringRope, '#f0f0f0', accent];
  ropeYs.forEach((ry, i) => {
    for (let x = 0; x <= W; x += 12) {
      const sag = Math.sin((x / W) * Math.PI) * 4;
      ctx.fillStyle = ropeCols[i]; ctx.fillRect(x, ry + sag, 13, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, ry + sag, 13, 1);
    }
  });

  // corner posts with turnbuckle pads + corner light
  for (const px of [8, W - 24]) {
    ctx.fillStyle = '#0e1430'; ctx.fillRect(px, floorTop - 52, 16, 66);            // post
    ctx.fillStyle = shade(accent, -20); ctx.fillRect(px - 1, floorTop - 52, 18, 4); // cap
    // turnbuckle pads at each rope height
    for (const ry of ropeYs) { ctx.fillStyle = accent; ctx.fillRect(px - 2, ry - 2, 20, 9); ctx.fillStyle = shade(accent, 35); ctx.fillRect(px - 2, ry - 2, 20, 2); }
    // corner light
    ctx.fillStyle = '#fff7d0'; ctx.fillRect(px + 5, floorTop - 56, 6, 6);
    ctx.fillStyle = mixA('#ffe680', 0.4); ctx.fillRect(px + 3, floorTop - 58, 10, 10);
  }
}
// blend two #rrggbb hex colors; t=0 -> a, t=1 -> b
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16 & 255)) * (1 - t) + (pb >> 16 & 255) * t);
  const g = Math.round(((pa >> 8 & 255)) * (1 - t) + (pb >> 8 & 255) * t);
  const bch = Math.round(((pa & 255)) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + bch).toString(16).slice(1);
}
export function mixA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${alpha})`;
}
export function lerp(a, b, t) { return a + (b - a) * t; }

// A little 8-bit chess table off in the corner (for the walk intro).
// An ornate carved-wood chess table with a gold-trimmed board shown in light
// perspective, a soft arcane glow, and a few standing pieces — polished flavor
// for the walk-up. `x,y` = front-left of the tabletop; the board recedes away.
export function chessTable(ctx, x, y, scale) {
  const s = scale, w = 8 * s, cx = x + w / 2;
  const lerp2 = (a, b, t) => a + (b - a) * t;
  const wood = '#4a3018', woodHi = '#6f4d29', woodSh = '#2c1c0d', woodDk = '#160d06';
  const gold = PAL.gold, goldHi = shade(gold, 45), brass = shade(gold, -95);

  // floor shadow
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(cx, y + 9.2 * s, w * 0.62, 2.3 * s, 0, 0, Math.PI * 2); ctx.fill();

  // turned/carved legs + stretcher bar
  const legW = 1.7 * s, legTop = y + 2.0 * s, legH = 6.4 * s;
  const drawLeg = (lx) => {
    ctx.fillStyle = woodSh; ctx.fillRect(lx, legTop, legW, legH);
    ctx.fillStyle = wood;   ctx.fillRect(lx, legTop, Math.max(1, legW * 0.45), legH);
    ctx.fillStyle = woodHi; ctx.fillRect(lx - 1, legTop + 1.2 * s, legW + 2, 0.55 * s);   // bulge
    ctx.fillStyle = woodHi; ctx.fillRect(lx - 1, legTop + 3.6 * s, legW + 2, 0.55 * s);   // bulge
    ctx.fillStyle = woodDk; ctx.fillRect(lx, legTop + legH - 0.7 * s, legW, 0.7 * s);
    ctx.fillStyle = brass;  ctx.fillRect(lx - 1, legTop + legH - 0.35 * s, legW + 2, 0.35 * s); // foot cap
  };
  const lx1 = cx - w * 0.34 - legW / 2, lx2 = cx + w * 0.34 - legW / 2;
  drawLeg(lx1); drawLeg(lx2);
  ctx.fillStyle = woodSh; ctx.fillRect(lx1 + legW, legTop + 4.0 * s, lx2 - lx1 - legW, 0.7 * s);
  ctx.fillStyle = wood;   ctx.fillRect(lx1 + legW, legTop + 4.0 * s, lx2 - lx1 - legW, 0.25 * s);

  // tabletop slab: front face + top highlight + gold trim
  const topY = y, topH = 1.9 * s, topX = x - 0.7 * s, topW = w + 1.4 * s;
  ctx.fillStyle = woodSh; ctx.fillRect(topX, topY, topW, topH);
  ctx.fillStyle = wood;   ctx.fillRect(topX, topY, topW, topH * 0.5);
  ctx.fillStyle = woodHi; ctx.fillRect(topX, topY, topW, Math.max(1, 0.4 * s));
  ctx.fillStyle = brass;  ctx.fillRect(topX, topY + topH - 0.4 * s, topW, Math.max(1, 0.4 * s));

  // arcane glow rising off the board
  const glowC = (cx, cy0, col, rad) => {
    const g = ctx.createRadialGradient(cx, cy0, 1, cx, cy0, rad);
    g.addColorStop(0, withA(col, 0.18)); g.addColorStop(1, withA(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy0, rad, 0, Math.PI * 2); ctx.fill();
  };
  glowC(cx, topY - 2.4 * s, PAL.blueLite, w * 0.72);

  // ---- board in light perspective (near = wide/low, far = narrow/high) ----
  const nearW = w, farW = w * 0.66, depth = 4.4 * s, y0 = topY - 0.3 * s;
  const edge = (t) => { const ww = lerp2(nearW, farW, t); return { ww, yy: y0 - depth * t, xl: cx - ww / 2 }; };
  const a = edge(0), b = edge(1), fm = 0.8 * s;

  // ornate frame (dark wood trapezoid + gold inline + corner studs)
  ctx.beginPath();
  ctx.moveTo(a.xl - fm, a.yy + fm); ctx.lineTo(a.xl + a.ww + fm, a.yy + fm);
  ctx.lineTo(b.xl + b.ww + fm * 0.7, b.yy - fm); ctx.lineTo(b.xl - fm * 0.7, b.yy - fm);
  ctx.closePath();
  ctx.fillStyle = woodDk; ctx.fill();
  ctx.strokeStyle = gold; ctx.lineWidth = Math.max(1, 0.18 * s); ctx.stroke();

  // checker cells, slightly darkened with depth
  for (let r = 0; r < 8; r++) {
    const e0 = edge(r / 8), e1 = edge((r + 1) / 8);
    const dep = Math.round(-26 * ((r + 0.5) / 8));
    for (let c = 0; c < 8; c++) {
      const base = (r + c) % 2 ? PAL.boardDark : PAL.boardLight;
      ctx.fillStyle = shade(base, dep);
      ctx.beginPath();
      ctx.moveTo(e0.xl + e0.ww * (c / 8), e0.yy);
      ctx.lineTo(e0.xl + e0.ww * ((c + 1) / 8), e0.yy);
      ctx.lineTo(e1.xl + e1.ww * ((c + 1) / 8), e1.yy);
      ctx.lineTo(e1.xl + e1.ww * (c / 8), e1.yy);
      ctx.closePath(); ctx.fill();
    }
  }
  // brass corner studs
  const stud = (sx, sy) => { ctx.fillStyle = gold; ctx.fillRect(sx - 1.2, sy - 1.2, 2.4, 2.4); ctx.fillStyle = goldHi; ctx.fillRect(sx - 1.2, sy - 1.2, 1.1, 1.1); };
  stud(a.xl - fm, a.yy + fm); stud(a.xl + a.ww + fm, a.yy + fm);
  stud(b.xl - fm * 0.7, b.yy - fm); stud(b.xl + b.ww + fm * 0.7, b.yy - fm);

  // ---- a few standing pieces for life (near = bigger) ----
  const drawPawn = (col, row, light) => {
    const t = (row + 0.5) / 8, e = edge(t);
    const px = e.xl + e.ww * ((col + 0.5) / 8);
    const py = lerp2(e.yy, edge((row + 1) / 8).yy, 0.5);
    const sz = lerp2(1.6, 1.0, t) * s * 0.5;
    const body = light ? '#f0e3c8' : '#2a2340', hi = light ? '#ffffff' : '#6058a0';
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(px, py + sz * 0.95, sz * 0.7, sz * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(px - sz * 0.62, py + sz); ctx.lineTo(px + sz * 0.62, py + sz);
    ctx.lineTo(px + sz * 0.26, py - sz * 0.15); ctx.lineTo(px - sz * 0.26, py - sz * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(px, py - sz * 0.46, sz * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hi; ctx.fillRect(px - sz * 0.32, py - sz * 0.62, Math.max(1, sz * 0.22), Math.max(1, sz * 0.22));
  };
  drawPawn(2, 1, true); drawPawn(5, 0, true); drawPawn(3, 6, false); drawPawn(6, 5, false);
}

// scanline overlay for CRT vibe
export function scanlines(ctx, w, h, alpha = 0.08) {
  ctx.globalAlpha = alpha; ctx.fillStyle = '#000';
  for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
  ctx.globalAlpha = 1;
}
