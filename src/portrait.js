// Living face-tile portraits (visual overhaul V5). A PortraitFace turns match
// context into an expression: a BASELINE mood driven by material advantage
// (eases in), brief REACTION pops on captures/checks (squash-bounce + emote
// glyph), idle blinks, and persistent battle-damage overlays (match.damage
// tiers — round heals never fix a face). Rig geometry is standardized across
// every character (see tools/paint_portraits.py), so blinks/emotes/overlays
// draw at fixed positions. Fallback with no art: the V4 bust silhouette.
import { PORTRAIT, PAL } from './config.js';
import { portraitSprite, mix, withA } from './gfx.js';

export const EXPRESSIONS = ['neutral', 'pleased', 'smirk', 'beaming', 'concerned',
  'upset', 'dejected', 'wince', 'shock', 'grin3'];

// battle-damage score -> overlay tier (0 = clean)
export function damageTier(score) {
  const T = PORTRAIT.TIERS;
  let tier = 0;
  for (let i = 0; i < T.length; i++) if (score >= T[i]) tier = i + 1;
  return tier;
}

// material diff (this side's perspective) -> baseline expression
function baselineFor(diff) {
  if (diff >= 6) return 'beaming';
  if (diff >= 3) return 'smirk';
  if (diff >= 1) return 'pleased';
  if (diff <= -6) return 'dejected';
  if (diff <= -3) return 'upset';
  if (diff <= -1) return 'concerned';
  return 'neutral';
}

const REACT_EXPR = { joy: 'beaming', anger: 'upset', shock: 'shock', smug: 'smirk' };

// deterministic-ish hash for blink scheduling (render-side only)
const h1 = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

export class PortraitFace {
  // hue: a HUE entry ({body, trim, skin}) — used for the fallback bust,
  // the blink eyelid tone, and emote tinting.
  constructor({ slug = null, hue }) {
    this.slug = slug;
    this.hue = hue;
    this.material = 0;
    this.baseline = 'neutral';
    this.easeT = 0;            // ms since baseline changed (drives a soft cross-pop)
    this.reaction = null;      // { kind, t }
    this.forced = null;        // force(expr) override (matchend etc)
    this.t = 0;
    this.blinkAt = 1500 + h1((slug || 'x').length + 1) * 3000;
    this.blinkT = 0;           // >0 while the lids are down
  }

  setMaterial(diff) {
    const b = baselineFor(diff);
    if (b !== this.baseline) { this.baseline = b; this.easeT = 0; }
    this.material = diff;
  }

  react(kind) { this.reaction = { kind, t: 0 }; }
  force(expr) { this.forced = expr; }

  update(dt) {
    this.t += dt;
    this.easeT += dt;
    if (this.reaction) {
      this.reaction.t += dt;
      if (this.reaction.t >= PORTRAIT.REACT_MS) this.reaction = null;
    }
    // blink scheduling
    if (this.blinkT > 0) this.blinkT -= dt;
    else if (this.t >= this.blinkAt) {
      this.blinkT = 120;
      const [a, b] = PORTRAIT.BLINK_S;
      this.blinkAt = this.t + (a + h1(this.t) * (b - a)) * 1000;
    }
  }

  // current expression + pop scale
  _state(tier) {
    let expr = this.forced || (this.reaction ? REACT_EXPR[this.reaction.kind] : this.baseline);
    if (expr === 'beaming' && tier >= 3) expr = 'grin3';   // the missing-tooth grin
    let pop = 1;
    if (this.reaction) {
      const k = this.reaction.t / PORTRAIT.REACT_MS;
      if (k < 0.18) pop = 1 - 0.12 * Math.sin((k / 0.18) * Math.PI);       // squash
      else if (k < 0.45) pop = 1 + 0.15 * Math.sin(((k - 0.18) / 0.27) * Math.PI); // overshoot
    } else if (this.easeT < PORTRAIT.EASE_MS) {
      pop = 1 + 0.05 * Math.sin((this.easeT / PORTRAIT.EASE_MS) * Math.PI); // soft baseline pop
    }
    return { expr, pop };
  }

  // draw the 44x44 face at (x,y); tier = damage overlay level 0..3
  draw(ctx, x, y, { tier = 0 } = {}) {
    const { expr, pop } = this._state(tier);
    const img = portraitSprite(this.slug, expr) || portraitSprite(this.slug, 'neutral');
    const cx = x + 22, cy = y + 22;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(pop, 2 - pop); ctx.translate(-cx, -cy);   // squash-bounce
    if (img) {
      ctx.drawImage(img, x, y);
      // idle blink: lids (skin tone) over the standardized eye rows
      const calm = expr === 'neutral' || expr === 'pleased' || expr === 'smirk' || expr === 'concerned';
      if (this.blinkT > 0 && calm) {
        ctx.fillStyle = this.hue.skin;
        ctx.fillRect(x + 12, y + 16, 20, 6);
      }
      const ov = tier > 0 ? portraitSprite('_overlays', 'damage' + tier) : null;
      if (ov) ctx.drawImage(ov, x, y);
    } else {
      this._bust(ctx, x, y);
    }
    ctx.restore();
    // emote glyphs ride OUTSIDE the pop transform so they stay crisp
    if (this.reaction) this._emote(ctx, x, y, this.reaction);
  }

  // V4's bust silhouette — the zero-asset fallback
  _bust(ctx, x, y) {
    const cx = x + 22, cy = y + 22;
    ctx.fillStyle = mix(this.hue.body, '#000000', 0.55);
    ctx.beginPath(); ctx.arc(cx, cy - 6, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 15, y + 43); ctx.quadraticCurveTo(cx, y + 20, cx + 15, y + 43);
    ctx.closePath(); ctx.fill();
  }

  _emote(ctx, x, y, r) {
    const k = r.t / PORTRAIT.REACT_MS;
    const a = k < 0.15 ? k / 0.15 : k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
    ctx.globalAlpha = a;
    if (r.kind === 'anger') {
      // red vein: two angry chevrons at the temple
      ctx.fillStyle = PAL.red;
      for (const [dx, dy] of [[0, 0], [3, 0], [0, 3], [3, 3]]) {
        ctx.fillRect(x + 34 + dx, y + 6 + dy, 2, 2);
      }
    } else if (r.kind === 'shock') {
      // sweat drop sliding down
      const sy = y + 9 + k * 8;
      ctx.fillStyle = PAL.blueLite;
      ctx.fillRect(x + 35, sy | 0, 2, 3);
      ctx.fillRect(x + 35.5 | 0, (sy - 1) | 0, 1, 1);
    } else {
      // joy/smug: a gold sparkle twinkling
      const s = 1 + Math.floor((r.t / 120) % 2);
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(x + 9 - s, y + 7, s * 2 + 1, 1);
      ctx.fillRect(x + 9, y + 7 - s, 1, s * 2 + 1);
    }
    ctx.globalAlpha = 1;
  }
}
