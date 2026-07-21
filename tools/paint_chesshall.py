#!/usr/bin/env python3
"""Paint the GRAND CHESS HALL arena layers (visual overhaul V3 finale). Usage:
  tools/.venv/bin/python tools/paint_chesshall.py far|mid|near|all

Magnus's arena — a championship gala: rose window with a knight roundel,
marble columns, chandeliers, a formal audience, velvet drapes, and the framed
wall-board whose LIVE position is drawn by src/scenery.js from the match.

Geometry contract with src/config.js SCENERY.SCENES.chesshall.L:
  wall-board frame x48-92/y34-78, playing field 32x32 at (54,40), 4px cells ·
  chandeliers (180,26)(332,26) · rose window center (256,44) r34.
"""
import math
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, STEEL1, STEEL2, STEEL3, STEEL4, MAT1, MAT4,
    RED1, RED2, BLUE4, GREEN2, GOLD0, GOLD1, GOLD2, SPEC1,
    WOOD0, WOOD1, WOOD2, n2,
)

W, H = 512, 170
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'arenas', 'chesshall')

WINDOW = (256, 44)
CHANDELIERS = [(125, 26), (387, 26)]
BOARD = (54, 40)     # playing-field top-left; frame is (48,34)-(92,78)

KNIGHT_ROUNDEL = [   # small knight silhouette for the window center
    '..##..',
    '.####.',
    '######',
    '#..###',
    '...###',
    '..####',
    '.#####',
    '.#####',
]

def paint_far():
    im = Image.new('RGB', (W, H))
    p = im.load()
    for y in range(H):
        for x in range(W):
            if y < 96:
                c = MAT1
            elif y == 96:
                c = GOLD0                                   # trim rail
            else:
                c = WOOD1
                if x % 38 < 2:
                    c = WOOD0                               # panel lines
            p[x, y] = c
    # the great ROSE WINDOW: stone ring, 8 glass wedges, knight roundel
    wx, wy = WINDOW
    PANES = [RED2, BLUE4, GOLD2, GREEN2]
    for dy in range(-36, 37):
        for dx in range(-36, 37):
            d = math.hypot(dx, dy)
            x, y = wx + dx, wy + dy
            if not (0 <= x < W and 0 <= y < H):
                continue
            if 32 <= d <= 36:
                p[x, y] = STEEL2                            # stone ring
            elif 10 <= d < 32:
                ang = (math.degrees(math.atan2(dy, dx)) + 360) % 360
                wedge = int(ang / 45)
                if ang % 45 < 3:
                    p[x, y] = INK1                          # lead lines
                else:
                    col = PANES[wedge % len(PANES)]
                    p[x, y] = col if n2(x, y, 250) < 0.7 else MAT1
            elif d < 10:
                p[x, y] = GOLD1 if d > 8 else MAT1          # center roundel rim
    for ry, row in enumerate(KNIGHT_ROUNDEL):               # knight silhouette
        for rx, cell in enumerate(row):
            if cell == '#':
                p[wx - 3 + rx, wy - 4 + ry] = INK1
    # two tall slit windows flanking
    for sx in (120, 392):
        for y in range(24, 84):
            for x in range(sx - 5, sx + 6):
                if abs(x - sx) == 5 or y in (24, 83):
                    p[x, y] = STEEL2
                elif n2(x, y, 251) < 0.6:
                    p[x, y] = BLUE4
    return im

def paint_mid():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # four marble columns with gold capitals and bases
    for cx in (70, 180, 332, 442):
        for y in range(0, H):
            for dx in range(-8, 9):
                c = STEEL3
                if dx < -4:
                    c = STEEL4                              # lit left edge
                if n2(cx + dx, y // 3, 252) < 0.06:
                    c = MAT4                                # marble veining
                put(cx + dx, y, c)
        for y in range(18, 25):                             # capital
            for dx in range(-10, 11):
                put(cx + dx, y, GOLD1 if y in (18, 24) else GOLD0)
        for y in range(150, 159):                           # base
            for dx in range(-10, 11):
                put(cx + dx, y, GOLD0 if y == 150 else STEEL2)
    # chandeliers (candles unlit; code glows + flames)
    for (hx, hy) in CHANDELIERS:
        for y in range(0, hy - 8):
            put(hx, y, STEEL1)                              # chain
        for a in range(0, 360, 12):                         # double gold rings
            for r in (10, 6):
                rx = hx + int(math.cos(math.radians(a)) * r)
                ry = hy + int(math.sin(math.radians(a)) * r * 0.5)
                put(rx, ry, GOLD1)
        for k in (-8, 0, 8):                                # candle stubs
            put(hx + k, hy - 4, SPEC1)
            put(hx + k, hy - 3, SPEC1)
    # the WALL-BOARD: heavy wood frame + empty checker field (code = position)
    bx, by = BOARD
    for y in range(by - 6, by + 38):
        for x in range(bx - 6, bx + 38):
            put(x, y, WOOD2)
    for y in range(by - 2, by + 34):
        for x in range(bx - 2, bx + 34):
            put(x, y, GOLD1 if x in (bx - 2, bx + 33) or y in (by - 2, by + 33) else WOOD2)
    for r in range(8):
        for c2 in range(8):
            col = MAT1 if (r + c2) % 2 else WOOD1
            for yy in range(4):
                for xx in range(4):
                    put(bx + c2 * 4 + xx, by + r * 4 + yy, col)
    # gilded mirror on the right wall (balances the board)
    mx, my = 426, 40
    for y in range(my - 6, my + 38):
        for x in range(mx - 6, mx + 38):
            put(x, y, WOOD2)
    for y in range(my, my + 32):
        for x in range(mx, mx + 32):
            c = STEEL4
            if abs((x - mx) - (y - my)) < 3:
                c = SPEC1                                   # glint streak
            put(x, y, c)
    # formal audience: tuxedos + gowns, two rows
    GOWNS = [RED2, BLUE4, GREEN2, GOLD1]
    for (row_y, pitch) in ((136, 16), (150, 14)):
        for hx in range(64, 450, pitch):
            jit = int(n2(hx, row_y, 253) * 5) - 2
            cx, cy = hx + jit, row_y + int(n2(hx, row_y, 254) * 3)
            gown = n2(hx, row_y, 255) < 0.45
            body = GOWNS[int(n2(hx, row_y, 256) * len(GOWNS))] if gown else INK0
            for dy in range(0, 12):                         # shoulders/torso
                grow = min(dy // 3, 2)
                for dx in range(-4 - grow, 5 + grow):
                    put(cx + dx, cy + dy, body)
            if not gown:                                    # shirt front
                put(cx, cy + 2, SPEC1); put(cx, cy + 3, SPEC1); put(cx, cy + 4, SPEC1)
            for dy in range(-5, 0):                         # head / updo
                for dx in range(-3, 4):
                    if dx * dx + (dy + 2) ** 2 <= 7:
                        put(cx + dx, cy + dy, INK1)
            if gown and n2(hx, row_y, 257) < 0.5:
                put(cx, cy - 6, GOLD2)                      # tiara glint
    # parquet floor hint
    for y in range(164, H):
        for x in range(W):
            put(x, y, WOOD2 if (x // 6 + y) % 2 else WOOD1)
    return im

def paint_near():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # velvet drape swags from both top corners with gold cords + tassels
    for (x0, x1, sgn) in ((0, 175, 1), (511, 337, -1)):
        ln = abs(x1 - x0)
        for i in range(ln):
            u = i / ln
            x = x0 + sgn * i
            depth = int(math.sin(u * math.pi * 0.5) * 34)
            # scalloped bottom edge
            scallop = int(abs(math.sin(u * 9)) * 7)
            for y in range(0, 36 - depth + scallop):
                c = RED1
                if (y + i // 3) % 7 < 2:
                    c = RED2                                # fold highlights
                put(int(x), y, c)
        # gold cord + tassel at the gather point
        gx = x0 + sgn * int(ln * 0.82)
        for y in range(0, 34):
            put(gx, y, GOLD1)
        for dy in range(6):                                 # tassel
            for dx in range(-1 - dy // 3, 2 + dy // 3):
                put(gx + dx, 34 + dy, GOLD0 if dy < 4 else GOLD1)
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
