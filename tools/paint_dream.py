#!/usr/bin/env python3
"""Paint the DREAM WORLD arena layers (visual overhaul V3). Usage:
  tools/.venv/bin/python tools/paint_dream.py far|mid|near|all

Kid Knightmare's arena — a pastel night-dream: soft violet sky, auroras, a
colossal broken knight bust adrift, a stairway to nowhere, spectre crowd.

Geometry contract with src/config.js SCENERY.SCENES.dream.L:
  bust center (388,72) · stardust falls at island lips (120,96)(300,84) ·
  aurora bands y18-44 (painted; code shimmers over them).
"""
import math
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK1, STEEL1, STEEL2, STEEL3, STEEL4, MAT1, MAT2, MAT3, MAT4, MAT5,
    BLUE6, RED4, GREEN1, GREEN3, GOLD3, SPEC1, n2,
)

W, H = 512, 170
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'arenas', 'dream')

BUST = (388, 72)
FALLS = [(120, 96), (300, 84)]

# ---- FAR: pastel sky, auroras, dream-moon, floating islands -----------------
SKY_BANDS = [(40, MAT1), (86, MAT2), (128, MAT3), (169, MAT4)]

def sky_color(x, y):
    for i, (bot, col) in enumerate(SKY_BANDS):
        wob = (n2(x // 11, i, 130) - 0.5) * 6
        if y <= bot + wob:
            if i + 1 < len(SKY_BANDS):
                nxt = SKY_BANDS[i + 1][1]
                depth = (bot + wob) - y
                if depth < 6 and n2(x, y, 131) < (6 - depth) / 6.0 * 0.5:
                    return nxt
            return col
    return SKY_BANDS[-1][1]

def paint_far():
    im = Image.new('RGB', (W, H))
    p = im.load()
    for y in range(H):
        for x in range(W):
            c = sky_color(x, y)
            if n2(x, y, 132) < 0.008:                     # star dust
                c = SPEC1 if n2(x, y, 133) < 0.3 else BLUE6
            p[x, y] = c
    # aurora ribbons: two wavy dithered bands
    for (y0, col, amp, per) in ((22, GREEN3, 5, 0.045), (36, BLUE6, 4, 0.06)):
        for x in range(W):
            yc = y0 + math.sin(x * per) * amp
            for dy in range(-3, 4):
                y = int(yc + dy)
                if 0 <= y < H and n2(x, y, 134) < 0.32 - abs(dy) * 0.07:
                    p[x, y] = col
    # pale dream-moon with craters
    mx, my = 96, 34
    for dy in range(-19, 20):
        for dx in range(-19, 20):
            d2 = dx * dx + dy * dy
            x, y = mx + dx, my + dy
            if not (0 <= x < W and 0 <= y < H):
                continue
            if d2 <= 324:
                p[x, y] = STEEL4
    for (cx2, cy2, cr) in ((90, 28, 4), (104, 40, 3), (98, 33, 2)):
        for dy in range(-cr, cr + 1):
            for dx in range(-cr, cr + 1):
                if dx * dx + dy * dy <= cr * cr:
                    p[cx2 + dx, cy2 + dy] = MAT5
    # drifting cloud puffs (soft dither lenses)
    for (cx3, cy3, cw, ch) in ((200, 24, 70, 8), (430, 48, 90, 10), (60, 74, 60, 7)):
        for dy in range(-ch // 2, ch // 2 + 1):
            k = 1 - (abs(dy) / (ch / 2 + 0.001)) ** 2
            half = int(cw / 2 * k)
            for x in range(cx3 - half, cx3 + half):
                y = cy3 + dy
                if 0 <= x < W and 0 <= y < H and n2(x, y, 135) < 0.35:
                    p[x, y] = STEEL4
    # floating island silhouettes with grass lips + hanging roots
    for (ix, iy, iw) in ((FALLS[0][0], FALLS[0][1], 70), (FALLS[1][0], FALLS[1][1], 90)):
        for dy in range(0, 18):
            half = int(iw / 2 * (1 - (dy / 18.0) ** 1.6))
            for dx in range(-half, half):
                x, y = ix + dx, iy + dy
                if 0 <= x < W and 0 <= y < H:
                    p[x, y] = MAT1
        for dx in range(-iw // 2, iw // 2):               # grass lip
            if n2(dx, ix, 136) < 0.7:
                p[ix + dx, iy] = GREEN1
        for ri in range(4):                               # hanging roots
            rx = ix - iw // 3 + int(n2(ix, ri, 137) * iw * 0.66)
            for k in range(3 + int(n2(ri, ix, 138) * 5)):
                p[rx, min(H - 1, iy + 17 + k)] = MAT1
    return im

# ---- MID: knight bust, stairway to nowhere, spectre crowd -------------------
def paint_mid():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    bx, by = BUST                                          # center of the bust
    # colossal stone knight bust from a hand-authored stencil (facing LEFT):
    # ear -> brow -> protruding muzzle -> chin cutback -> neck -> chest.
    KNIGHT = [
        '.......##.....',
        '......#####...',
        '.....######...',
        '....########..',
        '...#########..',
        '..##########..',
        '.###########..',
        '############..',
        '#####..#####..',
        '###...######..',
        '......######..',
        '.....#######..',
        '....########..',
        '....#########.',
        '...##########.',
        '...###########',
        '..############',
        '..############',
        '.#############',
        '.#############',
    ]
    SC = 4
    ox, oy = bx - len(KNIGHT[0]) * SC // 2, by - len(KNIGHT) * SC // 2
    for ry, row in enumerate(KNIGHT):
        for rx, cell in enumerate(row):
            if cell != '#':
                continue
            # mane notches: bite the right (back) edge at three heights
            right_edge = rx + 1 >= len(row) or row[rx + 1] == '.'
            if right_edge and ry in (4, 5, 9, 10, 14, 15):
                continue
            for yy in range(SC):
                for xx in range(SC):
                    put(ox + rx * SC + xx, oy + ry * SC + yy, STEEL2)
    # shading pass: left planes lit, right side shadow, deep cracks
    for y in range(oy, oy + len(KNIGHT) * SC):
        for x in range(ox, ox + len(KNIGHT[0]) * SC):
            if not (0 <= x < W and 0 <= y < H) or p[x, y][3] == 0:
                continue
            if p[x, y][:3] != STEEL2:
                continue
            if x > bx + 6 and n2(x, y, 139) < 0.75:
                put(x, y, STEEL1)                          # shadow side
            elif x < bx - 8 and n2(x, y, 140) < 0.4:
                put(x, y, STEEL3)                          # lit planes
            if n2(x // 2, y // 2, 141) < 0.028:
                put(x, y, MAT3)                            # deep cracks
    # eye: a soft glowing socket on the head
    ey = oy + 6 * SC
    put(bx - 10, ey, MAT3); put(bx - 9, ey, GOLD3); put(bx - 8, ey, MAT3)
    # broken base underside + floating rubble beneath
    base_y = oy + len(KNIGHT) * SC
    for dx in range(-26, 28):
        if n2(dx, 0, 142) < 0.75:
            put(bx + dx, base_y, STEEL1)
        if n2(dx, 1, 147) < 0.35:
            put(bx + dx, base_y + 1, MAT3)
    for (rx2, ry2, rr) in ((bx - 16, base_y + 8, 3), (bx + 6, base_y + 12, 2), (bx + 20, base_y + 6, 2), (bx - 4, base_y + 16, 1)):
        for dy in range(-rr, rr + 1):
            for dx in range(-rr, rr + 1):
                if dx * dx + dy * dy <= rr * rr:
                    put(rx2 + dx, ry2 + dy, STEEL1)
    # stairway to nowhere: floating steps spiraling up
    steps = [(180, 140), (196, 128), (214, 118), (228, 104), (238, 90), (232, 76), (218, 66)]
    for i, (sx, sy) in enumerate(steps):
        w2 = 16 - i
        for dx in range(w2):
            put(sx + dx, sy, MAT4)                        # lit tread
            put(sx + dx, sy + 1, MAT3)
            put(sx + dx, sy + 2, MAT1)                    # riser shadow
    # spectre crowd: hovering ghost blobs in a loose row
    for hx in range(60, 440, 26):
        jit = int(n2(hx, 0, 143) * 8) - 4
        cx, cy = hx + jit, 140 + int(n2(hx, 1, 144) * 10)
        for dy in range(-4, 5):                           # rounded body
            half = int(4.5 * math.sqrt(max(0, 1 - (dy / 5.0) ** 2))) if dy < 2 else 4
            for dx in range(-half, half + 1):
                put(cx + dx, cy + dy, STEEL4)
        for dx in range(-4, 5):                           # wavy hem
            if (dx + cx) % 3 != 0:
                put(cx + dx, cy + 5, STEEL4)
        put(cx - 2, cy - 1, MAT4); put(cx + 1, cy - 1, MAT4)  # eyes
    return im

# ---- NEAR: dream-wisp corner framing + floating chess pieces ----------------
def paint_near():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # soft cloud streamers in the top corners (layered dither lenses)
    for (cx, cy, cw, ch, dens) in (
        (30, 8, 150, 14, 0.5), (70, 22, 120, 10, 0.35), (10, 34, 80, 8, 0.25),
        (482, 6, 140, 12, 0.5), (450, 20, 110, 9, 0.35), (500, 32, 70, 7, 0.25),
    ):
        for dy in range(-ch // 2, ch // 2 + 1):
            k = 1 - (abs(dy) / (ch / 2 + 0.001)) ** 2
            half = int(cw / 2 * k)
            for x in range(cx - half, cx + half):
                y = cy + dy
                if 0 <= x < W and 0 <= y < H and n2(x, y, 145) < dens:
                    put(x, y, SPEC1 if n2(x, y, 146) < 0.25 else STEEL4)
    # small floating chess-piece silhouettes near the corners
    def pawn(cx, cy):
        for dy in range(-3, 0):
            for dx in range(-2, 3):
                if dx * dx + (dy + 2) ** 2 <= 4:
                    put(cx + dx, cy + dy, MAT1)
        for dx in range(-2, 3):
            put(cx + dx, cy, MAT1)
        for dx in range(-3, 4):
            put(cx + dx, cy + 1, MAT1)
    def bishop(cx, cy):
        for dy in range(-6, 0):
            half = 1 if dy < -4 else 2
            for dx in range(-half, half + 1):
                put(cx + dx, cy + dy, MAT1)
        put(cx, cy - 7, MAT1)
        for dx in range(-3, 4):
            put(cx + dx, cy, MAT1)
    def knight(cx, cy):
        for dy in range(-6, 0):
            for dx in range(-2, 2):
                put(cx + dx, cy + dy, MAT1)
        put(cx - 3, cy - 5, MAT1); put(cx - 4, cy - 4, MAT1)  # muzzle
        for dx in range(-3, 4):
            put(cx + dx, cy, MAT1)
    pawn(36, 44); bishop(148, 30); knight(468, 42)
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
