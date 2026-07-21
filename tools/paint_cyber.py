#!/usr/bin/env python3
"""Paint the CYBERPUNK STREET arena layers (visual overhaul V3). Usage:
  tools/.venv/bin/python tools/paint_cyber.py far|mid|near|all

Rain-soaked neon canyon — Rosa Rookrush's arena. Signage painted UNLIT/dim;
src/scenery.js flickers and blooms it live. Uses the sanctioned NEON pair.

Geometry contract with src/config.js SCENERY.SCENES.cyber.L:
  ROOK sign board x30-58/y28-120 (glow center (44,74)) · billboard x196-316/
  y8-52 (holo center (256,30)) · steam nozzles (170,150)(352,146) ·
  monorail viaduct deck y58 · wet-walk strip y150-169.
"""
import math
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, INK2, STEEL0, STEEL1, STEEL3, MAT0, MAT1, MAT2,
    GOLD0, GOLD1, RED1, SPEC1, NEON_MAGENTA, NEON_CYAN, n2,
)

W, H = 512, 170
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'arenas', 'cyber')

F35 = {  # 3x5 mini font for signage
    'H': ['#.#', '#.#', '###', '#.#', '#.#'],
    'O': ['###', '#.#', '#.#', '#.#', '###'],
    'T': ['###', '.#.', '.#.', '.#.', '.#.'],
    'E': ['###', '#..', '###', '#..', '###'],
    'L': ['#..', '#..', '#..', '#..', '###'],
    'R': ['###', '#.#', '##.', '#.#', '#.#'],
    'K': ['#.#', '##.', '#..', '##.', '#.#'],
}

def glyph(put, ch, ox, oy, sc, col):
    for ry, row in enumerate(F35[ch]):
        for rx, cell in enumerate(row):
            if cell == '#':
                for yy in range(sc):
                    for xx in range(sc):
                        put(ox + rx * sc + xx, oy + ry * sc + yy, col)

# ---- FAR: tower canyon, windows, monorail viaduct ---------------------------
def paint_far():
    im = Image.new('RGB', (W, H))
    p = im.load()
    # sky slivers: ink with violet haze dither
    for y in range(H):
        for x in range(W):
            c = INK0
            if y < 40 and n2(x // 2, y // 2, 100) < 0.10:
                c = MAT1
            p[x, y] = c
    # back rank: pale-dark slabs, sparse dim windows
    tx = 0
    while tx < W:
        w = 46 + int(n2(tx, 0, 101) * 30)
        top = 8 + int(n2(tx, 1, 102) * 26)
        for y in range(top, H):
            for x in range(tx, min(W, tx + w)):
                p[x, y] = MAT0
                if x % 6 == 2 and y % 7 == 3 and n2(x, y, 103) < 0.30:
                    p[x, y] = GOLD0
        tx += w + 4
    # mid rank: darker slabs with CLUSTERED windows (dark masses, lit pockets),
    # so buildings read as silhouettes instead of a uniform dot field
    tx = 18
    while tx < W:
        w = 64 + int(n2(tx, 3, 104) * 34)
        top = 30 + int(n2(tx, 4, 105) * 34)
        bldK = n2(tx, 8, 121)                             # per-building liveliness
        for y in range(top, H):
            floorK = n2(tx, y // 6, 122)                  # whole floors go dark
            for x in range(tx, min(W, tx + w)):
                p[x, y] = INK0
                colK = n2((x - tx) // 5, tx, 123)         # dense/dead columns
                chance = 0.55 * bldK * (floorK > 0.45) * (colK > 0.35)
                if x % 5 == 1 and y % 6 == 2 and n2(x, y, 106) < chance:
                    r = n2(x, y, 107)
                    p[x, y] = GOLD1 if r < 0.6 else ((90, 138, 255) if r < 0.85 else NEON_CYAN)
        # roof: water tower or antenna
        rx = tx + w // 2
        if n2(tx, 5, 108) < 0.5:
            for dy in range(6):                           # water tower
                for dx in range(-4, 5):
                    if 0 <= rx + dx < W and top - 7 + dy >= 0:
                        p[rx + dx, top - 7 + dy] = STEEL0
        else:
            for dy in range(10):                          # antenna
                if top - dy - 1 >= 0 and rx < W:
                    p[rx, top - dy - 1] = STEEL0
        tx += w + 12
    # monorail viaduct crossing IN FRONT of the towers (the rare train runs on
    # it — it must stay visible, so it's painted after the tower ranks)
    for x in range(W):
        for dy in range(3):
            p[x, 58 + dy] = STEEL0 if dy == 0 else INK1
        if x % 46 == 10:                                  # pylons
            for y in range(61, min(H, 61 + 30)):
                p[x, y] = INK1
                if x + 1 < W:
                    p[x + 1, y] = INK1
    # distant blurry neon smudges on the mid towers
    for i in range(6):
        sx, sy = int(n2(i, 6, 109) * (W - 40)) + 12, 44 + int(n2(i, 7, 110) * 70)
        col = NEON_MAGENTA if i % 2 else NEON_CYAN
        for dy in range(4):
            for dx in range(9):
                if n2(sx + dx, sy + dy, 111) < 0.35:
                    p[min(W - 1, sx + dx), min(H - 1, sy + dy)] = col
    return im

# ---- MID: street flanks, ROOK sign, billboard, umbrella crowd, wet walk -----
STEAM = [(170, 150), (352, 146)]

def paint_mid():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # LEFT building face + the HOTEL ROOK vertical sign
    for y in range(0, H):
        for x in range(0, 70):
            c = INK1 if x > 62 else INK0
            if x % 12 < 2 and y % 16 < 6 and x < 60:
                c = MAT0                                  # dark window slots
            put(x, y, c)
    for y in range(28, 120):                              # sign board
        for x in range(30, 58):
            edge = x in (30, 57) or y in (28, 119)
            put(x, y, STEEL1 if edge else STEEL0)
    for i, ch in enumerate('HOTEL'):                      # tiny header
        glyph(put, ch, 32 + i * 5, 31, 1, SPEC1)
    for i, ch in enumerate('ROOK'):                       # big unlit neon letters
        glyph(put, ch, 38, 40 + i * 20, 4, NEON_MAGENTA)
    # dim the letters to "unlit" (60% knocked back to the board tone)
    for y in range(40, 120):
        for x in range(31, 57):
            if p[x, y][:3] == NEON_MAGENTA and n2(x, y, 112) < 0.6:
                put(x, y, (120, 40, 104))                 # dim magenta (mixed to board)
    # RIGHT building face: awning + hanging glyph signs
    for y in range(0, H):
        for x in range(442, W):
            c = INK1 if x < 448 else INK0
            if x % 14 < 2 and y % 18 < 7 and x > 452:
                c = MAT0
            put(x, y, c)
    for y in range(96, 108):                              # noodle awning stripes
        for x in range(444, 500):
            put(x, y, RED1 if ((x - 444) // 7) % 2 else SPEC1)
    for (sx, sy, col) in ((452, 40, NEON_CYAN), (486, 62, GOLD1)):
        for k in range(6):                                # hanger
            put(sx + 4, sy - k, STEEL0)
        for y in range(sy, sy + 16):                      # small sign board
            for x in range(sx, sx + 10):
                edge = x in (sx, sx + 9) or y in (sy, sy + 15)
                put(x, y, STEEL1 if edge else INK1)
        for dy in range(4, 12):                           # dim glyph blob
            for dx in range(2, 8):
                if n2(dx, dy, 113) < 0.5:
                    put(sx + dx, sy + dy, col)
    # CENTER-TOP billboard frame (dead screen; holo-rook is code)
    for y in range(8, 52):
        for x in range(196, 316):
            if y < 12 or y > 47 or x < 200 or x > 311:
                put(x, y, INK1)
            elif y < 14 or y > 45 or x < 202 or x > 309:
                put(x, y, STEEL0)
            else:
                put(x, y, INK0)
    for x in (216, 296):                                  # support struts
        for y in range(0, 8):
            put(x, y, INK1); put(x + 1, y, INK1)
    # overhead cables with hanging lamps
    for (y0, y1, sag) in ((22, 34, 10), (66, 58, 14), (88, 96, 8)):
        for x in range(70, 442):
            u = (x - 70) / 372.0
            y = y0 + (y1 - y0) * u + math.sin(u * math.pi) * sag
            put(x, int(y), INK2)
            if x % 62 == 30:
                put(x, int(y) + 1, GOLD0); put(x, int(y) + 2, GOLD1)
    # umbrella crowd on the back walk (heads hidden under caps)
    for (row_y, pitch) in ((132, 15), (144, 13)):
        for hx in range(78, 436, pitch):
            jit = int(n2(hx, row_y, 114) * 5) - 2
            cx, cy = hx + jit, row_y + int(n2(hx, row_y, 115) * 3)
            r = 6 + (n2(hx, row_y, 116) < 0.3)
            base = INK1 if n2(hx, row_y, 117) < 0.6 else MAT1
            for dy in range(-3, 1):                       # dome cap
                half = int(r * math.sqrt(max(0, 1 - (dy / 3.5) ** 2)))
                for dx in range(-half, half + 1):
                    put(cx + dx, cy + dy, base)
            if hx % 3 == 0:                               # neon rim on every third
                rim = NEON_MAGENTA if hx % 6 else NEON_CYAN
                for dx in range(-r + 1, r):
                    if n2(dx, hx, 118) < 0.6:
                        put(cx + dx, cy - 3, rim)
            put(cx, cy + 1, INK0); put(cx, cy + 2, INK0)  # pole
    # street furniture: hydrant + AC boxes + steam nozzles
    for dy in range(8):                                   # hydrant at x86
        for dx in range(-2, 3):
            put(86 + dx, 148 + dy, RED1)
    put(86, 146, RED1); put(84, 150, RED1); put(88, 150, RED1)
    for (ax, ay) in ((110, 70), (128, 40)):               # AC boxes on left face
        for dy in range(6):
            for dx in range(8):
                put(ax + dx, ay + dy, STEEL0 if dy < 1 else INK1)
    for (sx2, sy2) in STEAM:                              # vent nozzles
        for dx in range(-3, 4):
            put(sx2 + dx, sy2, STEEL0)
            put(sx2 + dx, sy2 + 1, INK1)
    # wet-walk strip with neon smear columns under lit elements
    for y in range(150, H):
        for x in range(W):
            put(x, y, INK1 if n2(x, y, 119) > 0.06 else INK2)
    smears = [(44, NEON_MAGENTA), (452, NEON_CYAN), (486, GOLD1), (100, GOLD0), (163, GOLD0), (225, GOLD0), (287, GOLD0)]
    for (sx3, col) in smears:
        for y in range(150, H):
            k = (y - 150) / 20.0
            for dx in range(-1, 2):
                if n2(sx3 + dx, y, 120) < 0.45 * (1 - k * 0.6):
                    put(sx3 + dx, y, col)
    return im

# ---- NEAR: dangling cables + fire-escape corner -----------------------------
def paint_near():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # dangling foreground cables from the top corners
    for (x0, x1, sag, th) in ((0, 160, 26, 2), (512, 380, 20, 2), (0, 90, 12, 1)):
        steps = abs(x1 - x0)
        sgn = 1 if x1 > x0 else -1
        for i in range(steps):
            u = i / steps
            x = x0 + sgn * i
            y = 2 + math.sin(u * math.pi * 0.5) * sag
            for dy in range(th):
                put(int(x), int(y) + dy, INK0)
            if i % 24 == 12:
                put(int(x), int(y) + th, STEEL0)          # glint
    # fire-escape platform corner, top-right
    for y in range(0, 34):
        for x in range(470, W):
            if y % 8 < 2:
                put(x, y, INK0)                           # grating bars
            elif x % 6 < 1:
                put(x, y, INK1)
    for x in range(470, W):
        put(x, 33, STEEL0)                                # lit edge
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
