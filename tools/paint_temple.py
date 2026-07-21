#!/usr/bin/env python3
"""Paint the MOUNTAIN TEMPLE arena layers (visual overhaul V3 batch 2). Usage:
  tools/.venv/bin/python tools/paint_temple.py far|mid|near|all

Bishop Bruiser's arena — a twilight monastery: carved bishop statues, snow
peaks, a great gong (code rings it at every round start), monk rows with
candle bowls, prayer flags.

Geometry contract with src/config.js SCENERY.SCENES.temple.L:
  gong (256,46) r16 · incense burners (150,132)(362,132) ·
  stone lanterns (96,120)(416,120) · monk bowls y142 pitch 22 x116-396.
"""
import math
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, INK2, STEEL1, STEEL2, STEEL3, STEEL4,
    MAT1, MAT2, MAT3, RED2, RED4, GREEN2, BLUE4,
    GOLD0, GOLD1, GOLD2, EMBER3, EMBER4, WOOD0, WOOD1, WOOD2, WOOD4, SPEC1, n2,
)

W, H = 512, 170
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'arenas', 'temple')

GONG = (256, 46)
BURNERS = [(150, 132), (362, 132)]
LANTERNS = [(96, 120), (416, 120)]

SKY_BANDS = [(34, MAT1), (62, MAT2), (86, MAT3)]

def sky_color(x, y):
    for i, (bot, col) in enumerate(SKY_BANDS):
        wob = (n2(x // 10, i, 150) - 0.5) * 5
        if y <= bot + wob:
            if i + 1 < len(SKY_BANDS):
                nxt = SKY_BANDS[i + 1][1]
                depth = (bot + wob) - y
                if depth < 5 and n2(x, y, 151) < (5 - depth) / 5.0 * 0.5:
                    return nxt
            return col
    return SKY_BANDS[-1][1]

def paint_far():
    im = Image.new('RGB', (W, H))
    p = im.load()
    for y in range(H):
        for x in range(W):
            c = sky_color(x, y) if y < 86 else MAT3
            # rosy glow band above the peaks
            if 74 <= y <= 92 and n2(x, y, 152) < 0.30 - abs(y - 83) * 0.03:
                c = RED4
            p[x, y] = c
    # back range: snowcapped ridge
    for x in range(W):
        top = 64 + int(math.sin(x * 0.021) * 10 + math.sin(x * 0.007 + 2) * 12)
        for y in range(max(0, top), H):
            p[x, y] = STEEL1
        for dy in range(4):                                # dithered snowcap
            y = top + dy
            if 0 <= y < H and n2(x, dy, 153) < 0.8 - dy * 0.22:
                p[x, y] = SPEC1 if dy < 2 else STEEL4
    # front range: dark ridge
    for x in range(W):
        top = 96 + int(math.sin(x * 0.016 + 5) * 9 + math.sin(x * 0.005) * 8)
        for y in range(max(0, top), H):
            p[x, y] = MAT1
    # tiny pagoda silhouette on the front ridge
    px0, py0 = 430, 96 + int(math.sin(430 * 0.016 + 5) * 9 + math.sin(430 * 0.005) * 8) - 16
    for (ry, half) in ((0, 2), (3, 4), (6, 5), (9, 6), (12, 7)):
        for dx in range(-half, half + 1):
            p[min(W - 1, px0 + dx), max(0, py0 + ry)] = INK1
        for yy in range(ry + 1, ry + 3):
            for dx in range(-half + 2, half - 1):
                p[min(W - 1, px0 + dx), max(0, py0 + yy)] = INK1
    # thin static cloud wisps
    for (cx, cy, cw) in ((120, 52, 90), (340, 62, 110), (240, 44, 60)):
        for dy in range(-2, 3):
            half = int(cw / 2 * (1 - (abs(dy) / 3.0) ** 2))
            for x in range(cx - half, cx + half):
                if 0 <= x < W and n2(x, cy + dy, 154) < 0.22:
                    p[x, cy + dy] = STEEL4
    return im

def paint_mid():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # shrine platform strip behind the ring
    for y in range(126, H):
        for x in range(W):
            c = WOOD2
            if (x + y // 4) % 26 == 0:
                c = WOOD0                                  # plank gaps
            if y < 129:
                c = WOOD4 if n2(x, y, 155) < 0.5 else WOOD2  # lit edge
            if y > 162:
                c = STEEL1 if n2(x, y, 156) < 0.6 else INK1  # stone base
            put(x, y, c)
    # TWO carved bishop statues flanking: cleft mitre with a gold band,
    # stepped shoulders, robe fold lines, and a held crozier — the details
    # that make them read as BISHOPS instead of obelisks.
    for (x0, x1, inner) in ((28, 72, 1), (440, 484, -1)):
        cx = (x0 + x1) // 2
        # shoulders (y64-74, widest) then robe tapering DOWN to a capped base
        for y in range(64, H):
            if y < 74:
                halfw = 15 + (y - 64)                      # shoulder flare
            else:
                halfw = min(24, 17 + (y - 74) // 14)       # gentle robe spread
            for dx in range(-halfw, halfw + 1):
                x = cx + dx
                c = STEEL2
                if dx * inner > halfw - 5:
                    c = STEEL1                             # inner shadow side
                elif dx * inner < -(halfw - 4) and n2(x, y, 157) < 0.45:
                    c = STEEL3                             # outer lit planes
                put(x, y, c)
        # vertical robe fold lines
        for fold in (-10, -3, 5, 12):
            for y in range(78, H):
                if n2(fold, y, 161) < 0.8:
                    put(cx + fold + int(math.sin(y * 0.05) * 2), y, STEEL1)
        # head (narrower than shoulders — the step is what sells the figure)
        for y in range(46, 64):
            for dx in range(-7, 8):
                c = STEEL2
                if dx * inner > 3:
                    c = STEEL1
                put(cx + dx, y, c)
        # CLEFT MITRE with a gold base band
        for y in range(26, 46):
            k = (y - 26) / 20.0
            half = int(3 + k * 7)
            for dx in range(-half, half + 1):
                if abs(dx) <= 1 and y < 38:
                    continue                               # the cleft
                c = STEEL3 if dx * inner < 0 else STEEL2
                put(cx + dx, y, c)
        for dx in range(-10, 11):                          # gold band at mitre base
            put(cx + dx, 44, GOLD1)
            put(cx + dx, 45, GOLD0)
        put(cx - 4 * inner, 53, INK1)                      # closed eye line
        put(cx - 3 * inner, 53, INK1)
        # prayer scarf draped at the neck
        for dx in range(-12, 13):
            put(cx + dx, 66, GOLD1)
            put(cx + dx, 67, RED2)
        for k in range(10):                                # scarf tail
            put(cx + 9 * inner, 68 + k, RED2 if k % 3 else GOLD1)
        # the crozier: a staff held on the outer side, gold crook at top
        sx2 = cx - 19 * inner
        for y in range(38, 150):
            put(sx2, y, WOOD2)
            put(sx2 + 1, y, WOOD1)
        for (hx, hy) in ((0, -2), (1, -4), (2, -6), (2, -8), (1, -10), (0, -11), (-1, -10)):
            put(sx2 - hx * inner, 38 + hy, GOLD1)          # the hook curl
            put(sx2 - hx * inner, 39 + hy, GOLD0)
        # a stone hand gripping the staff
        for dy in range(3):
            for dx in range(3):
                put(sx2 - 1 + dx, 92 + dy, STEEL3)
        # cracks
        for y in range(30, H):
            for dx in (-9, 3, 8):
                if n2(cx + dx, y, 158) < 0.05:
                    put(cx + dx, y, MAT3)
    # THE GREAT GONG: wood frame + bronze disc (code rings it)
    gx, gy = GONG
    for (fx, ) in ((gx - 26,), (gx + 26,)):                # frame posts
        for y in range(24, 70):
            put(fx, y, WOOD1); put(fx + 1, y, WOOD1); put(fx + 2, y, WOOD0)
    for x in range(gx - 28, gx + 29):                      # top beam
        put(x, 22, WOOD1); put(x, 23, WOOD1); put(x, 24, WOOD0)
    put(gx - 8, 25, STEEL1); put(gx + 8, 25, STEEL1)       # hanging cords
    put(gx - 6, 27, STEEL1); put(gx + 6, 27, STEEL1)
    for dy in range(-16, 17):                              # bronze disc
        for dx in range(-16, 17):
            d2 = dx * dx + dy * dy
            if d2 <= 256:
                c = GOLD1
                if d2 > 196:
                    c = GOLD0                              # rim
                elif d2 <= 25:
                    c = EMBER3                             # boss center
                elif dx - dy > 8 and n2(dx, dy, 159) < 0.5:
                    c = GOLD2                              # top-left sheen
                put(gx + dx, gy + dy, c)
    # monk row with bowls (bowls unlit; code adds flames)
    for bx in range(116, 397, 22):
        jit = int(n2(bx, 0, 160) * 4) - 2
        cx2, cy2 = bx + jit, 142
        for dy in range(0, 12):                            # seated robe
            grow = min(dy // 3, 3)
            for dx in range(-4 - grow, 5 + grow):
                put(cx2 + dx, cy2 + dy, WOOD1)
        for dy in range(-5, 1):                            # bald head
            for dx in range(-3, 4):
                if dx * dx + (dy + 2) ** 2 <= 9:
                    put(cx2 + dx, cy2 + dy, WOOD4)
        put(cx2 - 3, cy2 - 4, GOLD0)                       # candle-lit crown rim
        put(cx2 - 2, cy2 - 5, GOLD0)
        for dx in range(-2, 3):                            # bowl in lap
            put(cx2 + dx, cy2 + 5, STEEL1)
        put(cx2 - 2, cy2 + 4, STEEL3); put(cx2 + 2, cy2 + 4, STEEL3)
    # stone lanterns (hollow glows in code)
    for (lx, ly) in LANTERNS:
        for dy in range(10, 22):                           # pillar
            put(lx - 1, ly + dy - 10, STEEL1); put(lx, ly + dy - 10, STEEL2); put(lx + 1, ly + dy - 10, STEEL1)
        for dx in range(-4, 5):                            # light box
            for dy in range(-4, 1):
                edge = abs(dx) == 4 or dy in (-4, 0)
                put(lx + dx, ly + dy, STEEL1 if edge else INK0)
        for dx in range(-5, 6):                            # roof cap
            put(lx + dx, ly - 5, STEEL2)
        put(lx - 5, ly - 4, STEEL1); put(lx + 5, ly - 4, STEEL1)
    # incense burners (bronze pots; code smokes them)
    for (sx, sy) in BURNERS:
        for dy in range(0, 7):
            half = 5 - abs(dy - 3)
            for dx in range(-half, half + 1):
                put(sx + dx, sy + dy, GOLD0 if dy < 2 else WOOD1)
        put(sx - 4, sy + 7, WOOD0); put(sx + 4, sy + 7, WOOD0)  # feet
        put(sx, sy - 1, INK1)                              # mouth
    return im

def paint_near():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    FLAGS = [EMBER4, GOLD2, BLUE4, GREEN2, SPEC1]
    # prayer-flag strings from both top corners
    for (x0, x1, y0, y1) in ((0, 185, 6, 26), (512, 330, 4, 24)):
        steps = abs(x1 - x0)
        sgn = 1 if x1 > x0 else -1
        for i in range(steps):
            u = i / steps
            x = x0 + sgn * i
            y = y0 + (y1 - y0) * math.sin(u * math.pi / 2)
            put(int(x), int(y), INK2)
            if i % 14 == 6:                                # a flag
                col = FLAGS[(i // 14) % len(FLAGS)]
                for fy in range(1, 9):
                    for fx in range(6):
                        if fy > 6 and (fx + fy) % 2 == 0:
                            continue                       # ragged fly-end
                        put(int(x) + fx * sgn, int(y) + fy, col)
                for fx in range(6):                        # darker bottom edge
                    put(int(x) + fx * sgn, int(y) + 8, INK2)
    # temple eave corner, top-left, with a wind-bell
    for x in range(0, 46):
        y = 8 - x // 8
        for dy in range(4):
            put(x, y + dy, WOOD1 if dy < 3 else WOOD0)
    for k in range(4):                                     # upturned tip
        put(46 + k, 2 - k // 2, WOOD1)
    put(40, 12, STEEL1); put(40, 13, STEEL1)               # bell cord
    for dy in range(4):                                    # small bronze bell
        for dx in range(-2 - dy // 2, 3 + dy // 2):
            put(40 + dx, 14 + dy, GOLD0)
    put(40, 19, GOLD1)                                     # clapper
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
