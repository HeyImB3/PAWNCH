#!/usr/bin/env python3
"""Paint the MEGA STADIUM arena layers (visual overhaul V3 finale). Usage:
  tools/.venv/bin/python tools/paint_stadium.py far|mid|near|all

THE PAWNCHION's arena — the colossal championship bowl: dense colorful crowd
tiers (code sweeps the WAVE over them), the jumbotron (code draws the LIVE
round number), letter cards, pyro nozzles, brand flags.

Geometry contract with src/config.js SCENERY.SCENES.stadium.L:
  jumbotron screen x216-296/y16-48 · pyro (140,152)(372,152) ·
  searchlight pivots (70,6)(442,6) · tiers y58-88 / 92-122 / 126-156 ·
  letter cards centered x186-326 in the middle tier.
"""
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, STEEL0, STEEL1, STEEL3, MAT1, BLUE1, BLUE3, BLUE4,
    RED2, RED3, GREEN2, GOLD0, GOLD1, GOLD2, EMBER3, EMBER4, SPEC1,
    WOOD1, n2,
)

W, H = 512, 170
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'arenas', 'stadium')

TIERS = [(58, 88), (92, 122), (126, 156)]
CROWD_COLS = [RED2, RED3, BLUE3, BLUE4, GOLD1, GOLD2, GREEN2, EMBER4, SPEC1]

F35 = {  # letters for the card block
    'P': ['###', '#.#', '###', '#..', '#..'],
    'A': ['###', '#.#', '###', '#.#', '#.#'],
    'W': ['#.#', '#.#', '#.#', '###', '#.#'],
    'N': ['#.#', '###', '###', '#.#', '#.#'],
    'C': ['###', '#..', '#..', '#..', '###'],
    'H': ['#.#', '#.#', '###', '#.#', '#.#'],
}

def paint_far():
    im = Image.new('RGB', (W, H))
    p = im.load()
    for y in range(H):
        for x in range(W):
            c = INK0
            if y < 14 and n2(x, y, 260) < 0.01:
                c = SPEC1                                  # night-sky stars
            p[x, y] = c
    # roof band with light-bank housings + searchlight turrets
    for y in range(14, 27):
        for x in range(W):
            p[x, y] = INK1 if y > 15 else STEEL0
    for lx in range(30, W - 20, 60):                       # light banks (unlit)
        for k in range(4):
            if lx + k * 5 + 1 < W:
                p[lx + k * 5, 18] = GOLD0
                p[lx + k * 5 + 1, 18] = GOLD0
                p[lx + k * 5, 19] = GOLD0
    for tx in (70, 442):                                   # searchlight turrets
        for dy in range(-6, 1):
            for dx in range(-4, 5):
                if abs(dx) + abs(dy) < 7:
                    p[tx + dx, 12 + dy] = STEEL1
    # topmost distant tier: micro-crowd flecks
    for y in range(27, 56):
        for x in range(W):
            c = MAT1
            if n2(x, y, 261) < 0.30:
                c = CROWD_COLS[int(n2(x, y, 262) * len(CROWD_COLS))]
                # dim the far crowd one notch: halve toward MAT1
                c = ((c[0] + MAT1[0]) // 2, (c[1] + MAT1[1]) // 2, (c[2] + MAT1[2]) // 2)
            p[x, y] = c
    return im

def paint_mid():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # crowd tier bands: dense colorful spectator blocks
    for ti, (ty0, ty1) in enumerate(TIERS):
        for y in range(ty0, ty1):
            for x in range(W):
                put(x, y, MAT1)
        # step shadow + rail
        for x in range(W):
            put(x, ty0 - 2, INK0); put(x, ty0 - 1, INK0)
            if x % 3:
                put(x, ty0, BLUE1)
        blocky = 2 + ti                                    # bigger blocks up front
        pitch = 4 + ti
        for row_y in range(ty0 + 3, ty1 - blocky, blocky + 2):
            for hx in range(0, W, pitch):
                jit = int(n2(hx, row_y, 263) * 3) - 1
                col = CROWD_COLS[int(n2(hx, row_y, 264) * len(CROWD_COLS))]
                for yy in range(blocky):
                    for xx in range(blocky - 1):
                        put(hx + jit + xx, row_y + yy, col)
    # the LETTER-CARD block in the middle tier: P-A-W-N-C-H
    word = 'PAWNCH'
    cw, ch = 20, 16
    x0 = (W - len(word) * (cw + 2)) // 2
    y0 = 98
    for li, chr2 in enumerate(word):
        cx = x0 + li * (cw + 2)
        for yy in range(ch):
            for xx in range(cw):
                put(cx + xx, y0 + yy, EMBER3)
        sc = 2
        gx = cx + (cw - 3 * sc) // 2
        gy = y0 + (ch - 5 * sc) // 2
        for ry, row in enumerate(F35[chr2]):
            for rx, cell in enumerate(row):
                if cell == '#':
                    for yy in range(sc):
                        for xx in range(sc):
                            put(gx + rx * sc + xx, gy + ry * sc + yy, GOLD2)
    # the JUMBOTRON: heavy frame + struts + dead screen + brand plate
    for y in range(8, 57):
        for x in range(208, 305):
            edge = x < 212 or x > 300 or y < 12 or y > 52
            put(x, y, STEEL0 if edge else INK1)
    for y in range(16, 49):                                # screen interior
        for x in range(216, 297):
            put(x, y, INK0)
    for (bx, by) in ((210, 10), (300, 10), (210, 52), (300, 52)):
        put(bx, by, STEEL3)                                # corner bolts
    for sx in (224, 288):                                  # struts to the roof
        for y in range(0, 8):
            put(sx, y, INK1); put(sx + 1, y, INK1)
    for x in range(236, 277):                              # PAWNCH plate below
        put(x, 57, GOLD1); put(x, 58, GOLD0)
    # pyro nozzles + confetti-cannon poles
    for (px2, py2) in ((140, 152), (372, 152)):
        for k in range(8):
            put(px2 - 3 + k // 2, py2 + 4 - k, STEEL0)     # angled tube
        put(px2, py2 - 4, INK0)                            # mouth
    for cx in (30, 482):
        for y in range(120, 156):
            put(cx, y, WOOD1); put(cx + 1, y, WOOD1)
        for dy in range(6):                                # barrel
            for dx in range(-2, 4):
                put(cx + dx, 114 + dy, EMBER4)
    return im

def paint_near():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    import math
    # two big brand flags waving in from the top corners
    for (x0, reach, field, blob, sgn) in ((0, 150, EMBER4, GOLD2, 1), (511, 366, BLUE4, SPEC1, -1)):
        ln = abs(reach - x0)
        for i in range(ln):
            u = i / ln
            x = x0 + sgn * i
            y = 2 + u * 12 + math.sin(u * 7.0) * (2 + u * 6)
            th = max(3, int(13 * (1 - u * 0.45)))
            for dy in range(th):
                c = field
                if dy in (0, th - 1):
                    c = INK1                               # dark edge
                put(int(x), int(y) + dy, c)
        # pawn-silhouette blob on the field
        bx = x0 + sgn * int(ln * 0.3)
        by = 8
        for dy in range(-3, 1):
            for dx in range(-2, 3):
                if dx * dx + (dy + 1) ** 2 <= 4:
                    put(bx + dx, by + dy, blob)
        for dx in range(-3, 4):
            put(bx + dx, by + 1, blob)
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
