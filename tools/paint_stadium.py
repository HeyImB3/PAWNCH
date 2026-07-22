#!/usr/bin/env python3
"""Paint the MEGA STADIUM arena layers (visual overhaul V3 finale). Usage:
  tools/.venv/bin/python tools/paint_stadium.py far|mid|near|all

THE PAWNCHION's arena — the colossal championship bowl: dense colorful crowd
tiers (code sweeps the WAVE over them), the jumbotron (code draws the LIVE
round number), letter cards, pyro nozzles, brand flags.

Geometry contract with src/config.js SCENERY.SCENES.stadium.L:
  jumbotron screen x216-296/y16-48 · pyro (140,152)(372,152) ·
  searchlight pivots (70,6)(442,6) · tiers y58-88 / 92-122 / 126-156 ·
  neon PAWNCH board x166-346 / y93-121 (letters 12x20 @ lx0=200 pitch 20).
"""
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, STEEL0, STEEL1, STEEL3, MAT1, BLUE1, BLUE3, BLUE4, BLUE6,
    RED1, RED2, RED3, RED4, GREEN1, GREEN2, GOLD0, GOLD1, GOLD2, GOLD3,
    EMBER1, EMBER2, EMBER3, EMBER4, EMBER5, EMBER6, EMBER7, SPEC1,
    WOOD1, WOOD2, WOOD3, WOOD4, WOOD5, n2,
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
                # dim the far crowd one notch: weight MAT1 double (deeper recede)
                c = ((c[0] + 2 * MAT1[0]) // 3, (c[1] + 2 * MAT1[1]) // 3, (c[2] + 2 * MAT1[2]) // 3)
            p[x, y] = c
    return im

# ---- crowd figures ----------------------------------------------------------
# palette pairs (lit, shadow) per shirt — ramp neighbours, never math-derived
SHIRTS = [(RED3, RED1), (BLUE4, BLUE1), (GOLD2, GOLD0), (GREEN2, GREEN1),
          (EMBER5, EMBER2), (BLUE6, BLUE3), (RED4, RED2), (EMBER4, EMBER2)]
SKINS = [WOOD2, WOOD3, WOOD4, WOOD5, EMBER7]
SKINS_DIM = [WOOD2, WOOD3, WOOD4]          # back tier reads darker

def spectator(put, x, y, h, seed, raised=False, dim=False):
    """One crowd figure. (x, y) = feet-line center; h = total height in px.
    Head (varied skin) + shirt with a shadowed right side + optional cheer
    arms; ~60% get a dark hair cap."""
    skin = (SKINS_DIM if dim else SKINS)[int(n2(x, seed, 270) * (len(SKINS_DIM) if dim else len(SKINS)))]
    lit, shad = SHIRTS[int(n2(x, seed, 271) * len(SHIRTS))]
    if dim:
        lit = shad                          # back tier: shadow tone all over
    hw = max(1, h // 3)
    head_h = max(2, h // 3)
    for yy in range(y - (h - head_h), y):                  # torso
        for xx in range(x - hw, x + hw + 1):
            put(xx, yy, lit if xx <= x else shad)
    for yy in range(y - h, y - (h - head_h)):              # head
        for xx in range(x - hw + 1, x + hw):
            put(xx, yy, skin)
    if n2(x, seed, 272) < 0.6:                             # hair cap
        for xx in range(x - hw + 1, x + hw):
            put(xx, y - h, INK1)
    if raised:                                             # painted cheer arms
        for sx2 in (x - hw - 1, x + hw + 1):
            put(sx2, y - h + 1, skin)
            put(sx2, y - h + 2, lit)

def crowd_decor(put):
    """A few flags + foam fingers sprinkled through the tiers."""
    for (dx2, dti) in [(60, 0), (150, 1), (240, 0), (330, 2), (420, 1), (480, 2)]:
        ty0, ty1 = TIERS[dti]
        dy2 = ty0 + 8 + int(n2(dx2, dti, 275) * 8)
        if n2(dx2, dti, 276) < 0.5:                        # flag on a stick
            for k in range(4):
                put(dx2, dy2 - k, WOOD1)
            for yy in range(2):
                for xx in range(4):
                    put(dx2 + 1 + xx, dy2 - 4 + yy,
                        EMBER4 if n2(xx, yy, 277) < 0.7 else GOLD2)
        else:                                              # foam finger
            for yy in range(3):
                for xx in range(2):
                    put(dx2 + xx, dy2 - yy, GOLD2)
            put(dx2, dy2 - 3, GOLD3)

# ---- the NEON SIGNBOARD (geometry contract: config L.sign) ------------------
SIGN = dict(x=166, y=93, w=180, h=28, lx0=200, ly=97, sc=4, pitch=20)

def neon_board(put):
    x0b, y0b, wb, hb = SIGN['x'], SIGN['y'], SIGN['w'], SIGN['h']
    # painted ember glow spill onto the crowd around the board
    for yy in range(y0b - 4, y0b + hb + 5):
        for xx in range(x0b - 6, x0b + wb + 7):
            if x0b <= xx < x0b + wb and y0b <= yy < y0b + hb:
                continue
            dxh = max(x0b - xx, xx - (x0b + wb) + 1, 0)
            dyh = max(y0b - yy, yy - (y0b + hb) + 1, 0)
            dd = dxh + dyh
            if dd <= 5 and n2(xx, yy, 278) < (6 - dd) / 6.0 * 0.55:
                put(xx, yy, EMBER1 if dd > 2 else EMBER2)
    # board face + steel frame + contact shadow + mounting struts
    for yy in range(y0b, y0b + hb):
        for xx in range(x0b, x0b + wb):
            edge = xx < x0b + 2 or xx >= x0b + wb - 2 or yy < y0b + 2 or yy >= y0b + hb - 2
            put(xx, yy, STEEL0 if edge else INK0)
    for xx in range(x0b + 2, x0b + wb - 2):
        put(xx, y0b + hb, INK0)
        if xx % 40 < 2:
            for yy in range(y0b + hb, min(y0b + hb + 4, H)):
                put(xx, yy, INK1)
    # PAWNCH in neon tubes: GOLD2 core with an EMBER3 rim on stroke edges
    sc2 = SIGN['sc']
    for li, ch2 in enumerate('PAWNCH'):
        gx = SIGN['lx0'] + li * SIGN['pitch']
        cells = {(rx, ry) for ry, rowg in enumerate(F35[ch2])
                 for rx, cell in enumerate(rowg) if cell == '#'}
        for (rx, ry) in cells:
            for yy in range(sc2):
                for xx in range(sc2):
                    ex = (xx == 0 and (rx - 1, ry) not in cells) or \
                         (xx == sc2 - 1 and (rx + 1, ry) not in cells)
                    ey = (yy == 0 and (rx, ry - 1) not in cells) or \
                         (yy == sc2 - 1 and (rx, ry + 1) not in cells)
                    put(gx + rx * sc2 + xx, SIGN['ly'] + ry * sc2 + yy,
                        EMBER3 if (ex or ey) else GOLD2)

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
    # crowd tiers: rows of real spectators (back rows paint first, front
    # rows overlap them); ~12% empty seats, ~15% pre-raised cheer arms
    FIG_H = [5, 7, 9]                                      # top -> front tier
    for ti, (ty0, ty1) in enumerate(TIERS):
        fh = FIG_H[ti]
        for ri, row_y in enumerate(range(ty0 + fh + 2, ty1 - 1, fh - 1)):
            for hx in range(2, W, fh + 1):
                if n2(hx, row_y, 273) < 0.12:
                    continue
                jit = int(n2(hx, row_y, 263) * 3) - 1
                spectator(put, hx + jit, row_y, fh, ti * 100 + ri,
                          raised=n2(hx, row_y, 274) < 0.15, dim=(ti == 0))
    crowd_decor(put)
    neon_board(put)
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
