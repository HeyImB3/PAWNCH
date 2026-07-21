#!/usr/bin/env python3
"""Paint the SPOOKY WOODS arena layers (visual overhaul V3). Usage:
  tools/.venv/bin/python tools/paint_woods.py far|mid|near|all

Moonlit forest amphitheater — Gus Gambit's arena. Cold moonlight from above,
warm candle pools below; everything else near-black silhouette (Art Bible v2).

Geometry contract with src/config.js SCENERY.SCENES.woods.L:
  moon (392,30) r11 · candle cluster anchors
  (70,118)(128,132)(196,140)(316,140)(384,132)(442,118)(60,90)(452,90) ·
  fog band y128-166 (code-drawn).
"""
import math
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, INK2, STEEL0, STEEL1, STEEL3, STEEL4,
    GREEN0, GREEN1, GOLD0, WOOD0, WOOD1, WOOD2, SPEC1, n2,
)

W, H = 512, 170
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'arenas', 'woods')

MOON = (392, 30)
CANDLES = [(70, 118), (128, 132), (196, 140), (316, 140), (384, 132), (442, 118), (60, 90), (452, 90)]

# ---- FAR: deep forest darkness, back trunks, the moon -----------------------
def paint_far():
    im = Image.new('RGB', (W, H))
    p = im.load()
    for y in range(H):
        for x in range(W):
            # near-black vertical gradient with a whisper of depth
            c = INK0 if y < 100 or n2(x, y, 70) > (y - 100) / 70.0 * 0.6 else INK1
            # canopy-gap sky slivers up top (cold steel dither)
            if y < 22 and n2(x // 3, y // 3, 71) < 0.05:
                c = STEEL0
            p[x, y] = c
    # back rank of thin trunks
    tx = 10
    while tx < W - 10:
        w = 6 + int(n2(tx, 0, 72) * 9)
        lean = (n2(tx, 1, 73) - 0.5) * 0.15
        for y in range(0, H):
            cx = tx + int(lean * y)
            for dx in range(w):
                if 0 <= cx + dx < W:
                    p[cx + dx, y] = INK1
            # moss dither at the base
            if y > 140 and n2(cx, y, 74) < 0.2:
                p[min(W - 1, cx + int(n2(y, cx, 75) * w)), y] = GREEN0
        tx += 34 + int(n2(tx, 2, 76) * 24)
    # the moon, partly bitten by a crossing branch
    mx, my = MOON
    for dy in range(-15, 16):
        for dx in range(-15, 16):
            d2 = dx * dx + dy * dy
            x, y = mx + dx, my + dy
            if not (0 <= x < W and 0 <= y < H):
                continue
            if d2 <= 49:
                p[x, y] = SPEC1
            elif d2 <= 121:
                p[x, y] = STEEL4
            elif d2 <= 225 and n2(dx, dy, 77) < 0.35:
                p[x, y] = STEEL3
    for x in range(mx - 20, mx + 24):           # branch silhouette across it
        y = my - 2 + int(math.sin(x * 0.2) * 2)
        for dy in range(3):
            if 0 <= x < W:
                p[x, y + dy] = INK1
    return im

# ---- MID: great trunks, branch arch, congregation, candle stumps ------------
def paint_mid():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # two GREAT gnarled trunks flanking the scene
    for (x0, x1, flip) in ((28, 66, 0), (446, 484, 1)):
        for y in range(8, H):
            # trunk edges wander; roots flare at the base
            wob = int(math.sin(y * 0.12 + x0) * 3)
            flare = max(0, (y - 148) // 3) * 2
            xl, xr = x0 + wob - flare, x1 + wob + flare
            for x in range(xl, xr):
                c = WOOD1
                # bark ridges: wavy vertical ink strokes
                if (x + int(math.sin(y * 0.25) * 2)) % 7 < 2:
                    c = INK1
                if x < xl + 2 or x >= xr - 2:
                    c = INK0                              # dark contour
                put(x, y, c)
        # knot hole
        kx, ky = (x0 + x1) // 2, 70 + (30 if flip else 0)
        for dy in range(-6, 7):
            for dx in range(-4, 5):
                if (dx / 4.0) ** 2 + (dy / 6.0) ** 2 <= 1:
                    put(kx + dx, ky + dy, INK0)
        # moss on the trunk base
        for y in range(140, H):
            for x in range(x0 - 6, x1 + 6):
                if n2(x, y, 78) < 0.15:
                    put(x, y, GREEN0 if n2(x, y, 79) < 0.7 else GREEN1)
    # branch arch crossing from the left trunk
    for x in range(60, 300):
        k = (x - 60) / 240.0
        y = 14 + int(math.sin(k * math.pi) * 20)
        th = 5 - int(k * 2)
        for dy in range(th):
            put(x, y + dy, WOOD1 if dy < th - 1 else INK1)
        if n2(x, 0, 80) < 0.08:                           # twigs
            for ty in range(4):
                put(x, y - ty, INK1)
    # hooded congregation: two rows of robed silhouettes. Hoods are INK1 with
    # INK0 face-shadow so they read against the near-black forest (the
    # ink-on-ink lesson from the beach fronds).
    for (row_y, pitch) in ((124, 18), (140, 16)):
        for hx in range(80, 432, pitch):
            jit = int(n2(hx, row_y, 81) * 5) - 2
            cx, cy = hx + jit, row_y + int(n2(hx, row_y, 82) * 3)
            hw = 4 + (n2(hx, row_y, 83) < 0.4)
            # rounded hood down to shoulders (narrow trapezoid, gaps between)
            for dy in range(0, 15):
                grow = min(dy // 4, 2)
                for dx in range(-hw - grow, hw + grow + 1):
                    if dy == 0 and abs(dx) > hw - 2:
                        continue
                    edge = abs(dx) >= hw + grow - 1 or dy < 2
                    put(cx + dx, cy + dy, INK1 if edge else INK0)
            # deep hood opening (pitch black inside)
            for dy in range(3, 7):
                for dx in range(-2, 3):
                    put(cx + dx, cy + dy, INK0)
            if n2(hx, row_y, 84) < 0.6:                   # moonlit hood-edge rim
                for k in range(3):
                    put(cx - hw + k, cy + 1 - (k > 0), GREEN1)
            put(cx, cy + 10, GOLD0)                       # candle-in-hands ember
    # candle clusters on stumps (UNLIT — code adds the flames)
    for (cx, cy) in CANDLES:
        for dx in range(-7, 8):                           # stump base
            for dy in range(0, 5):
                if abs(dx) - 7 + dy <= 0:
                    put(cx + dx, cy + dy, WOOD1 if dy else WOOD2)
        n = 2 + int(n2(cx, cy, 85) * 3)
        for i in range(n):                                # wax stubs
            wx = cx - 4 + i * 4 + int(n2(cx + i, cy, 86) * 2)
            wh = 3 + int(n2(cx, cy + i, 87) * 4)
            for dy in range(wh):
                put(wx, cy - dy, SPEC1 if n2(wx, dy, 88) < 0.7 else STEEL4)
                put(wx + 1, cy - dy, STEEL4)
    return im

# ---- NEAR: massive foreground branch + hanging moss + candle jars -----------
def paint_near():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # twisted branch across the top, forking twice
    def limb(x0, y0, x1, y1, th):
        steps = max(abs(x1 - x0), 1)
        for i in range(steps):
            k = i / steps
            x = x0 + (x1 - x0) * k
            y = y0 + (y1 - y0) * k + math.sin(k * 6.0 + x0) * 3
            t2 = max(1, int(th * (1 - k * 0.4)))
            for dy in range(t2):
                c = INK0 if 0 < dy < t2 - 1 else INK1
                put(int(x), int(y) + dy, c)
    limb(0, 6, 512, 14, 12)
    limb(180, 12, 300, 2, 5)
    limb(360, 14, 430, 4, 4)
    # hanging moss curtains from the branch underside
    for mx in range(6, W, 9):
        if n2(mx, 0, 89) < 0.35:
            continue
        ln = 8 + int(n2(mx, 1, 90) * 14)
        top = 16 + int(n2(mx, 2, 91) * 6)
        for k in range(ln):
            if n2(mx, k, 92) < 0.15:
                continue                                  # ragged gaps
            x = mx + int(math.sin(k * 0.4 + mx) * 1.5)
            put(x, top + k, GREEN0 if n2(x, k, 93) < 0.75 else GREEN1)
    # two hanging candle jars (unlit; code glows them) — clear of the moon
    for (jx, jl) in ((110, 18), (300, 24)):
        for k in range(jl):                               # wire
            put(jx, 12 + k, STEEL1)
        jy = 12 + jl
        for dy in range(8):                               # jar outline
            for dx in range(-3, 4):
                edge = abs(dx) == 3 or dy in (0, 7)
                if edge:
                    put(jx + dx, jy + dy, GOLD0)
        put(jx, jy + 5, STEEL4)                           # wick stub
    return im

PIECES = {
    'far': (paint_far, 'far.png'),
    'mid': (paint_mid, 'mid.png'),
    'near': (paint_near, 'near.png'),
}

def main():
    which = sys.argv[1] if len(sys.argv) > 1 else 'all'
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, (fn, fname) in PIECES.items():
        if which not in ('all', name):
            continue
        out = os.path.join(OUT_DIR, fname)
        fn().save(out)
        print(f'painted {name} -> {out}')

if __name__ == '__main__':
    main()
