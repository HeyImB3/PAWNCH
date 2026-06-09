// "Walk to the board" flair (3-5s): the two fighters stroll from the ring
// over to the chess table in the corner before the chess half begins.

import { MATCH, PAL, FIGHTER } from '../config.js';
import { text, ring, chessTable, piece, pieceSprite } from '../gfx.js';
import { drawFighter } from '../fighter.js';
import * as audio from '../audio.js';
import { HUE, HERO_LOOK } from '../opponents.js';
import { WHITE } from '../chess/board.js';

export class WalkState {
  enter(game) {
    this.t = 0;
    this.dur = MATCH.WALK_SECONDS;
    audio.playFightTheme();
    const m = game.match;
    this.oppHue = m.mode === 'story' ? (HUE[m.opponent.hue] || HUE.player) : HUE.red;
    this.oppLook = (m.mode === 'story' && m.opponent?.look) ? m.opponent.look : { ...HERO_LOOK, hue: HUE.red };
    this.round = m.round;
    // a "coin toss" reveal of the seated colors — only at the start of a match
    this.tossT = 0;
    this.tossDur = this.round === 1 ? 2.4 : 0;
    this.tossSettled = false;
    this.playerColor = m.playerColor;
    this.mode = m.mode;
    this.isNet = !!m.net;
  }

  update(game, dt) {
    audio.playFightTheme();
    // hold the walk while the coin spins; let the player skip the reveal
    if (this.tossT < this.tossDur) {
      this.tossT += dt / 1000;
      if (game.input.pressed('confirm')) this.tossT = this.tossDur;
      if (!this.tossSettled && this.tossT >= this._settleAt()) {
        this.tossSettled = true;
        audio.sfx.confirm();
      }
      return;
    }
    this.t += dt / 1000;
    if (this.t >= this.dur || game.input.pressed('confirm')) {
      game.netFlow('chess');   // online: only the authority advances; the peer follows
    }
  }

  _settleAt() { return this.tossDur - 0.9; }

  draw(game, ctx) {
    const W = game.W, H = game.H;
    ring(ctx, W, H, { accent: this.oppHue.body });

    // chess table sits in the lower-left corner
    const tableX = 70, tableY = H - 70;
    chessTable(ctx, tableX, tableY, 7);

    // walk progress (ease-out)
    const p = Math.min(1, this.t / (this.dur - 0.4));
    const ease = 1 - Math.pow(1 - p, 2);

    // player walks from right-center toward the table (left)
    const pStartX = W * 0.62, pEndX = tableX + 40;
    const px = lerp(pStartX, pEndX, ease);
    const py = H - 78;
    const step = this.t * 9;
    drawFighter(ctx, px, py, FIGHTER.SIZE.walk, HERO_LOOK, p < 0.98 ? 'walk' : 'idle', 1, step);

    // opponent walks from far right toward the other side of the table
    const oStartX = W * 0.86, oEndX = tableX + 90;
    const ox = lerp(oStartX, oEndX, ease);
    drawFighter(ctx, ox, py, FIGHTER.SIZE.walk, this.oppLook, p < 0.98 ? 'walk' : 'idle', 1, step + 1.5);

    // coin-toss overlay owns the screen at match start; otherwise the walk banner
    if (this.tossT < this.tossDur) { this._drawToss(game, ctx); return; }

    // banner
    text(ctx, 'ROUND ' + this.round, W / 2, 24, { scale: 3, color: PAL.orange, align: 'center', shadow: PAL.ink });
    text(ctx, 'TAKE YOUR SEATS...', W / 2, 60, { scale: 2, color: PAL.blueLite, align: 'center', shadow: PAL.ink });
    text(ctx, 'CHESS', W / 2, 90, { scale: 1, color: PAL.textDim, align: 'center' });

    if (this.t > this.dur - 1) {
      const blink = Math.sin(this.t * 12) > 0;
      if (blink) text(ctx, 'GET READY', W / 2, H - 30, { scale: 2, color: PAL.gold, align: 'center', shadow: PAL.ink });
    }
  }

  // spinning coin that lands on the player's drawn side
  _drawToss(game, ctx) {
    const W = game.W, H = game.H, cx = W / 2, cy = H / 2 - 6, R = 40;
    ctx.fillStyle = 'rgba(7,10,22,0.66)'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'COIN TOSS', cx, 64, { scale: 3, color: PAL.orange, align: 'center', shadow: PAL.ink });

    const settled = this.tossT >= this._settleAt();
    let squash, face, tilt;
    if (!settled) {
      const ang = this.tossT * 17;                 // fast spin
      squash = Math.abs(Math.cos(ang));            // 1 = face-on, 0 = edge-on
      tilt = Math.sin(ang);                        // signed → which side the edge shows
      face = Math.cos(ang) >= 0 ? WHITE : 'b';      // flips faces as it tumbles
    } else {
      const s = Math.min(1, (this.tossT - this._settleAt()) / 0.4);
      squash = 1 - Math.pow(1 - s, 2) * 0.9;        // open from edge-on to the full face
      tilt = 0;
      face = this.playerColor;
    }
    // magic swirls around the coin — strong while it tumbles, a calm shimmer once settled
    const magic = settled ? 0.35 : Math.min(1, this.tossT * 5);
    this._coinMagic(ctx, cx, cy, R, this.tossT, magic, 'back');
    this._coin(ctx, cx, cy, R, Math.max(0.06, squash), face, tilt);
    this._coinMagic(ctx, cx, cy, R, this.tossT, magic, 'front');

    if (settled) {
      const [l1, l2] = this._tossLines();
      text(ctx, l1, cx, cy + R + 24, { scale: 2, color: PAL.gold, align: 'center', shadow: PAL.ink });
      text(ctx, l2, cx, cy + R + 48, { scale: 1, color: PAL.blueLite, align: 'center' });
      if (Math.sin(this.tossT * 10) > -0.3)
        text(ctx, 'PRESS ENTER', cx, H - 26, { scale: 1, color: PAL.textDim, align: 'center' });
    }
  }

  // A weathered 16-bit pirate doubloon with faked 3D thickness: as it turns you
  // see the foreshortened face slide aside and reveal the milled gold EDGE — the
  // classic pixel-art coin-flip trick. Face is orange (white) / blue (black);
  // the engraved pawn keeps its own piece color.
  _coin(ctx, cx, cy, r, squash, face, tilt = 0) {
    const white = face === WHITE;
    const rx  = Math.max(2, r * squash);   // face half-width (foreshortened)
    const side = Math.min(1, Math.abs(tilt));   // 0 face-on .. 1 edge-on
    const tau = r * 0.18;                   // coin half-thickness (px)
    const xf  = tau * tilt;                 // the visible face slides toward the spin
    const W   = rx + tau * side;            // outer silhouette half-width

    // gold rim tones (from brand gold) + the colored face
    const gold   = PAL.gold;
    const rimDk  = mix(gold, '#000000', 0.55);
    const rimMid = mix(gold, '#000000', 0.30);
    const reedDk = mix(gold, '#000000', 0.42);
    const goldHi = mix(gold, '#ffffff', 0.40);
    const field   = white ? PAL.orange : PAL.blue;
    const fieldDk = mix(field, '#000000', 0.32);

    // cast shadow on the floor (widest when face-on)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(cx, cy + r + 12, Math.max(3, W), 5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);

    // ---- the coin's 3D EDGE: a gold cylinder seen at the spin angle ----
    const body = ctx.createLinearGradient(-W, 0, W, 0);
    body.addColorStop(0, rimDk); body.addColorStop(0.5, gold); body.addColorStop(1, rimDk);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, W, r, 0, 0, Math.PI * 2); ctx.fill();
    // reeded (milled) vertical ticks wrapping the edge
    ctx.lineWidth = 1;
    const ticks = 20;
    for (let k = 0; k <= ticks; k++) {
      const fx = -W + (2 * W) * (k / ticks);
      const hy = r * Math.sqrt(Math.max(0, 1 - (fx / W) ** 2)) * 0.97;
      ctx.strokeStyle = k % 2 ? rimMid : reedDk;
      ctx.beginPath(); ctx.moveTo(fx, -hy); ctx.lineTo(fx, hy); ctx.stroke();
    }
    // sheen along the top of the cylinder
    ctx.strokeStyle = goldHi; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, W, r, 0, Math.PI * 1.04, Math.PI * 1.5); ctx.stroke();

    // ---- the foreshortened FACE, slid toward the viewer side, drawn over the edge ----
    ctx.save();
    ctx.translate(xf, 0);
    ctx.scale(Math.max(0.02, squash), 1);

    // gold rim ring around the face
    ctx.fillStyle = rimDk;  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rimMid; ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = goldHi; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r - 4, Math.PI * 0.78, Math.PI * 1.45); ctx.stroke();

    // colored field
    const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
    gr.addColorStop(0, mix(field, '#ffffff', 0.22));
    gr.addColorStop(0.7, field);
    gr.addColorStop(1, fieldDk);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r - 8, 0, Math.PI * 2); ctx.fill();

    // engraving only when the face is open enough to read
    if (squash > 0.34) {
      ctx.fillStyle = rimDk;
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * (r - 11), Math.sin(a) * (r - 11), 1.2, 0, Math.PI * 2); ctx.fill();
      }
      if (!pieceSprite(ctx, 'p', white, 0, 0, r * 1.18))
        piece(ctx, 'p', 0, 0, r * 0.86, white, { t: 0, glow: 0, shadow: false, clean: true });
      ctx.fillStyle = goldHi;
      const sx = r * 0.34, sy = -r * 0.42;
      ctx.fillRect(sx - 3, sy, 6, 1); ctx.fillRect(sx, sy - 3, 1, 6);
    }
    ctx.restore();   // face
    ctx.restore();   // coin
  }

  // Sparkle motes orbiting the coin on a flattened (3D-looking) ring, with short
  // trails. Split into 'back' (behind the coin) and 'front' layers so they swish
  // around it. Brand colors (orange/blue/gold).
  _coinMagic(ctx, cx, cy, r, t, intensity, layer) {
    if (intensity <= 0.02) return;
    const cols = [PAL.orange, PAL.gold, PAL.blueLite, PAL.blue, PAL.orangeLite];

    // soft aura glow behind the coin
    if (layer === 'back') {
      const aura = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.1);
      aura.addColorStop(0, withA(PAL.gold, 0.14 * intensity));
      aura.addColorStop(1, withA(PAL.gold, 0));
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2); ctx.fill();
    }

    const N = 8;
    for (let i = 0; i < N; i++) {
      const baseA = t * 3.4 + i * (Math.PI * 2 / N);
      for (let s = 0; s < 5; s++) {                 // trail segments
        const a = baseA - s * 0.14;
        const depth = Math.sin(a);                  // -1 (behind) .. +1 (front)
        if ((depth >= 0) !== (layer === 'front')) continue;
        const orbR = r * 1.2 + Math.sin(t * 1.7 + i) * r * 0.16;
        const x = cx + Math.cos(a) * orbR;
        const y = cy + depth * orbR * 0.40;         // flattened ring → orbits in "3D"
        const persp = 0.7 + 0.5 * ((depth + 1) / 2);
        const sz = (2.6 - s * 0.5) * persp * intensity;
        const al = (0.55 - s * 0.1) * intensity;
        if (sz <= 0 || al <= 0) continue;
        ctx.fillStyle = withA(cols[i % cols.length], al);
        ctx.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), Math.ceil(sz), Math.ceil(sz));
      }
    }
  }

  _tossLines() {
    const white = this.playerColor === WHITE;
    if (this.mode === 'pvp' && !this.isNet)
      return white ? ['PLAYER 1: WHITE', 'PLAYER 1 MOVES FIRST']
                   : ['PLAYER 1: BLACK', 'PLAYER 2 MOVES FIRST'];
    return white ? ['YOU PLAY WHITE', 'YOU MOVE FIRST']
                 : ['YOU PLAY BLACK', 'OPPONENT MOVES FIRST'];
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

// blend two #rrggbb colors (t=0 → a, t=1 → b)
function mix(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const r = Math.round((A >> 16 & 255) * (1 - t) + (B >> 16 & 255) * t);
  const g = Math.round((A >> 8 & 255) * (1 - t) + (B >> 8 & 255) * t);
  const c = Math.round((A & 255) * (1 - t) + (B & 255) * t);
  return `rgb(${r},${g},${c})`;
}
// #rrggbb -> rgba() string with the given alpha
function withA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${alpha})`;
}
