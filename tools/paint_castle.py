#!/usr/bin/env python3
"""Paint the SKY CASTLE arena layers (visual overhaul V3 batch 2). Usage:
  tools/.venv/bin/python tools/paint_castle.py far|mid|near|all

Queen Quake's arena — bright daylight majesty: a floating keep with a
waterfall pouring off its island, a royal parapet crowd with trumpeters,
streaming banners. The only DAYLIGHT arena — sky is the value ceiling.

Geometry contract with src/config.js SCENERY.SCENES.castle.L:
  waterfall sheet x330-345 / y95-168, mist base (338,164) ·
  trumpeters (84,138)(428,138) · keep banner poles (210,24)(300,18).
"""
import math
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK1, STEEL0, STEEL1, STEEL2, STEEL3, STEEL4, MAT1, MAT3,
    BLUE2, BLUE4, BLUE5, BLUE6, RED2, RED3, GREEN1, GREEN2,
    GOLD1, GOLD2, EMBER4, SPEC1, n2,
)

W, H = 512, 170
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'arenas', 'castle')

FALL_X0, FALL_X1, FALL_Y0, FALL_Y1 = 330, 345, 95, 168
TRUMPETERS = [(84, 138), (428, 138)]

SKY_BANDS = [(50, BLUE2), (100, BLUE4), (169, BLUE6)]

def sky_color(x, y):
    for i, (bot, col) in enumerate(SKY_BANDS):
        wob = (n2(x // 12, i, 170) - 0.5) * 6
        if y <= bot + wob:
            if i + 1 < len(SKY_BANDS):
                nxt = SKY_BANDS[i + 1][1]
                depth = (bot + wob) - y
                if depth < 6 and n2(x, y, 171) < (6 - depth) / 6.0 * 0.5:
                    return nxt
            return col
    return SKY_BANDS[-1][1]

def lens(p, cx, cy, cw, ch, salt, core, body, under):
    """A puffy cloud: stacked jittered lens rows, bright top, flat underside."""
    for dy in range(-ch // 2, ch // 2 + 1):
        k = 1 - (abs(dy) / (ch / 2 + 0.001)) ** 2
        half = int(cw / 2 * k + (n2(cx, dy, salt) - 0.5) * 8)
        if half <= 0:
            continue
        for x in range(cx - half, cx + half):
            y = cy + dy
            if 0 <= x < W and 0 <= y < H:
                if dy < -ch // 4:
                    p[x, y] = core
                elif dy >= ch // 2 - 1:
                    p[x, y] = under
                else:
                    p[x, y] = body

def paint_far():
    im = Image.new('RGB', (W, H))
    p = im.load()
    for y in range(H):
        for x in range(W):
            p[x, y] = sky_color(x, y)
    # big cumulus stacks
    lens(p, 90, 48, 130, 22, 172, SPEC1, STEEL4, STEEL3)
    lens(p, 60, 40, 80, 14, 173, SPEC1, STEEL4, STEEL3)
    lens(p, 420, 34, 150, 20, 174, SPEC1, STEEL4, STEEL3)
    lens(p, 250, 120, 110, 16, 175, SPEC1, STEEL4, STEEL3)
    lens(p, 480, 130, 90, 14, 176, SPEC1, STEEL4, STEEL3)
    # two tiny distant floating islets
    for (ix, iy, iw) in ((60, 92, 30), (470, 72, 24)):
        for dy in range(0, 8):
            half = int(iw / 2 * (1 - (dy / 8.0) ** 1.5))
            for dx in range(-half, half):
                if 0 <= ix + dx < W:
                    p[ix + dx, iy + dy] = STEEL1
        for dx in range(-iw // 2, iw // 2):
            if n2(dx, ix, 177) < 0.6 and 0 <= ix + dx < W:
                p[ix + dx, iy] = GREEN1
    return im

def paint_mid():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # --- the floating island rock (x150-360, y95-135) + hanging roots ---
    for y in range(95, 136):
        k = (y - 95) / 41.0
        xl = 150 + int(k * k * 70) + int((n2(3, y, 178) - 0.5) * 8)
        xr = 360 - int(k * k * 60) + int((n2(7, y, 179) - 0.5) * 8)
        for x in range(xl, xr):
            c = STEEL1
            if n2(x, y, 180) < 0.25:
                c = STEEL0                                 # shadow speckle
            if y < 100 and n2(x, y, 194) < 0.4:
                c = STEEL2                                 # sunlit top zone
            if n2(x // 3, y // 3, 181) < 0.05:
                c = MAT3                                   # cracks
            put(x, y, c)
    for x in range(152, 358, 3):                           # grass lip
        if n2(x, 0, 182) < 0.75:
            put(x, 95, GREEN2 if n2(x, 1, 183) < 0.4 else GREEN1)
            if n2(x, 2, 184) < 0.3:
                put(x, 94, GREEN1)
    for ri in range(8):                                    # hanging roots
        rx = 165 + int(n2(ri, 0, 185) * 180)
        rl = 4 + int(n2(ri, 1, 186) * 12)
        for k in range(rl):
            put(rx + int(math.sin(k * 0.5 + ri) * 1.5), 135 + k, MAT1)
    # --- the keep on top (y20-95) ---
    # central hall
    for y in range(52, 96):
        for x in range(218, 294):
            c = STEEL2
            if x < 224 and n2(x, y, 187) < 0.5:
                c = STEEL3                                 # lit left face
            put(x, y, c)
    for (wx, wy) in ((232, 62), (250, 58), (268, 62), (240, 78), (260, 78)):
        for dy in range(6):                                # arrow slits
            put(wx, wy + dy, INK1)
    for x in range(214, 298):                              # hall roofline
        put(x, 50, GOLD1); put(x, 51, STEEL1)
    # two round towers with conical roofs
    for (tx, tw, ty) in ((186, 30, 32), (296, 34, 26)):
        for y in range(ty + 14, 96):
            for x in range(tx, tx + tw):
                c = STEEL2
                if x < tx + 5 and n2(x, y, 188) < 0.5:
                    c = STEEL3
                put(x, y, c)
        for dy in range(14):                               # conical roof
            half = int(tw / 2 * dy / 14)
            for dx in range(-half, half + 1):
                put(tx + tw // 2 + dx, ty + dy, RED3 if dx < 0 else RED2)
        put(tx + tw // 2, ty - 1, GOLD2)                   # finial
        put(tx + tw // 2, ty - 2, GOLD2)
        for (wx2, wy2) in ((tx + tw // 2 - 1, ty + 22), (tx + tw // 2 + 3, ty + 34)):
            put(wx2, wy2, INK1); put(wx2, wy2 + 1, INK1)
    # keep banners flying from the two poles (painted mid-wave)
    for (px2, py2, col, trim) in ((210, 24, EMBER4, GOLD2), (300, 18, BLUE4, SPEC1)):
        for k in range(10):                                # pole
            put(px2, py2 + k, STEEL1)
        for fx in range(14):                               # swallow-tail banner
            wave = int(math.sin(fx * 0.6) * 2)
            for fy in range(5 - (fx > 9) * 2):
                if fx > 11 and fy == 2:
                    continue                               # tail notch
                put(px2 + 1 + fx, py2 + 1 + fy + wave, col if fy else trim)
    # --- the waterfall sheet (code animates foam over it) ---
    for y in range(FALL_Y0, FALL_Y1 + 1):
        for x in range(FALL_X0, FALL_X1 + 1):
            r = n2(x, y, 189)
            c = BLUE5 if r < 0.6 else (SPEC1 if r < 0.75 else BLUE4)
            put(x, y, c)
    # --- royal parapet + noble crowd + trumpeters (y126-170) ---
    for y in range(140, H):                                # parapet wall
        for x in range(W):
            c = STEEL1
            if y == 140:
                c = STEEL3
            elif (y - 140) % 7 == 6:
                c = STEEL0                                 # mortar course
            elif (x + ((y - 140) // 7) * 11) % 22 == 0:
                c = STEEL0                                 # offset brick joints
            put(x, y, c)
    for x in range(0, W, 22):                              # crenellations
        for dx in range(12):
            for dy in range(8):
                put(x + dx, 132 + dy, STEEL1 if dy else STEEL3)
    # noble spectators between the merlons
    HATS = [RED3, BLUE4, GOLD2, GREEN2, EMBER4]
    for hx in range(16, W, 22):
        jit = int(n2(hx, 0, 190) * 4) - 2
        cx, cy = hx + jit, 128 + int(n2(hx, 1, 191) * 3)
        for dy in range(-2, 3):                            # face
            for dx in range(-2, 3):
                if dx * dx + dy * dy <= 5:
                    put(cx + dx, cy + dy, STEEL4)
        hat = HATS[int(n2(hx, 2, 192) * len(HATS))]
        if n2(hx, 3, 193) < 0.4:
            for k in range(5):                             # hennin cone
                put(cx - 2 + k // 2, cy - 3 - k, hat)
        else:
            for dx in range(-3, 4):                        # flat cap
                put(cx + dx, cy - 3, hat)
    # trumpeters at the ends (code glints them on crowd spikes)
    for (tx2, ty2), inner in zip(TRUMPETERS, (1, -1)):
        for dy in range(0, 12):                            # tabard figure
            for dx in range(-3, 4):
                put(tx2 + dx, ty2 - 6 + dy, INK1)
        for dy in range(-3, 1):                            # head
            for dx in range(-2, 3):
                if dx * dx + (dy + 1) ** 2 <= 4:
                    put(tx2 + dx, ty2 - 9 + dy, STEEL4)
        for k in range(9):                                 # long horn angled up-out
            put(tx2 + (3 + k) * inner, ty2 - 10 - k // 2, GOLD1)
        put(tx2 + 12 * inner, ty2 - 15, GOLD2)             # bell mouth
        put(tx2 + 12 * inner, ty2 - 14, GOLD2)
    return im

def paint_near():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # two long streaming swallow-tail banners from the top corners
    for (x0, reach, col, trim, sgn) in ((0, 155, RED3, GOLD2, 1), (511, 360, BLUE4, SPEC1, -1)):
        ln = abs(reach - x0)
        for i in range(ln):
            u = i / ln
            x = x0 + sgn * i
            y = 4 + u * 18 + math.sin(u * 9.0) * (3 + u * 5)
            th = max(2, int(9 * (1 - u * 0.5)))
            notch = u > 0.85 and abs(math.sin(u * 40)) < 0.4
            for dy in range(th):
                if notch and th // 3 < dy < 2 * th // 3:
                    continue                               # swallow-tail split
                c = trim if dy in (0, th - 1) else col
                put(int(x), int(y) + dy, c)
    # gold sparkle motes near the banners
    for (mx, my) in ((60, 34), (120, 28), (420, 30), (470, 38), (250, 12)):
        put(mx, my, GOLD2)
        put(mx + 1, my, GOLD2)
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
