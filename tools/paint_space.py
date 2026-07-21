#!/usr/bin/env python3
"""Paint the DEEP SPACE arena layers (visual overhaul V3 batch 2). Usage:
  tools/.venv/bin/python tools/paint_space.py far|mid|near|all

Iron Endgame's arena — an orbital platform: ringed gas giant, gear machinery
(housings painted, spoke wheels rotate in code), pistons, astronaut gallery.

Geometry contract with src/config.js SCENERY.SCENES.space.L:
  planet (400,60) r38 · gear hubs (40,54) r14 and (40,96) r10 ·
  piston slots (468,40,h30)(486,52,h24) · beacons (120,14)(392,14) ·
  viewport strip y132-154 · floaters (150,108)(350,100).
"""
import math
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, INK2, STEEL0, STEEL1, STEEL2, STEEL3, MAT1, MAT2, MAT3, MAT4,
    BLUE1, BLUE3, BLUE4, RED1, RED2, GREEN2, GOLD0, GOLD1, SPEC1, n2,
)

W, H = 512, 170
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'arenas', 'space')

PLANET = (400, 60)
GEARS = [(40, 54, 14), (40, 96, 10)]
PISTONS = [(468, 40, 30), (486, 52, 24)]
BEACONS = [(120, 14), (392, 14)]
FLOATERS = [(150, 108), (350, 100)]

def paint_far():
    im = Image.new('RGB', (W, H))
    p = im.load()
    for y in range(H):
        for x in range(W):
            c = INK0
            r = n2(x, y, 200)
            if r < 0.002:
                c = SPEC1                                  # rare bright star
            elif r < 0.008:
                c = STEEL3                                 # common faint star
            # nebula wash lower-left
            if x < 220 and y > 90 and n2(x // 3, y // 3, 201) < 0.22 - (x / 220) * 0.1:
                c = MAT2 if n2(x, y, 202) < 0.75 else RED1
            p[x, y] = c
    px0, py0 = PLANET
    R = 38
    # ring BEHIND (upper half) first
    def ring_px(x, y):
        dx, dy = (x - px0) / 62.0, (y - py0) / 14.0
        d = dx * dx + dy * dy
        if 0.72 <= d <= 1.0:
            return STEEL3 if d > 0.88 else GOLD1
        return None
    for y in range(py0 - 16, py0):
        for x in range(px0 - 64, px0 + 65):
            if not (0 <= x < W and 0 <= y < H):
                continue
            c = ring_px(x, y)
            if c is not None:
                p[x, y] = c
    # the banded gas giant
    for dy in range(-R, R + 1):
        for dx in range(-R, R + 1):
            if dx * dx + dy * dy > R * R:
                continue
            x, y = px0 + dx, py0 + dy
            if not (0 <= x < W and 0 <= y < H):
                continue
            band = (dy + R + int(math.sin(dx * 0.12) * 3)) // 9 % 4
            c = (MAT3, MAT4, BLUE1, STEEL1)[band]
            if n2(x, y, 203) < 0.06:
                c = MAT2                                   # turbulence flecks
            if dx > R * 0.35:                              # terminator shadow
                c = MAT1 if n2(x, y, 204) < 0.8 else c
            p[x, y] = c
    # ring IN FRONT (lower half)
    for y in range(py0, py0 + 17):
        for x in range(px0 - 64, px0 + 65):
            if not (0 <= x < W and 0 <= y < H):
                continue
            c = ring_px(x, y)
            if c is not None:
                p[x, y] = c
    # tiny cratered moon
    for dy in range(-5, 6):
        for dx in range(-5, 6):
            if dx * dx + dy * dy <= 25:
                p[330 + dx, 26 + dy] = STEEL2
    p[329, 25] = STEEL1; p[332, 28] = STEEL1
    return im

def paint_mid():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # --- LEFT machinery column: gear housings + pipes + hazard edge ---
    for y in range(0, H):                                  # column slab
        for x in range(0, 72):
            if x > 64:
                c = GOLD0 if (y // 6) % 2 else INK0        # hazard stripe edge
            else:
                c = INK1 if n2(x, y, 205) < 0.9 else INK0
            put(x, y, c)
    for (gx, gy, gr) in GEARS:                             # gear ring housings
        for dy in range(-gr - 5, gr + 6):
            for dx in range(-gr - 5, gr + 6):
                d = math.hypot(dx, dy)
                x, y = gx + dx, gy + dy
                if gr + 1 <= d <= gr + 4:
                    # toothed ring: gaps every ~30 degrees
                    ang = math.degrees(math.atan2(dy, dx)) % 30
                    put(x, y, INK0 if ang < 8 else STEEL1)
                elif gr - 1 <= d < gr + 1:
                    put(x, y, STEEL2)                      # inner race
                elif d < gr - 1:
                    put(x, y, INK0)                        # empty center (code wheel)
        for a in range(0, 360, 90):                        # rivets on the housing
            rx = gx + int(math.cos(math.radians(a)) * (gr + 4))
            ry = gy + int(math.sin(math.radians(a)) * (gr + 4))
            put(rx, ry, STEEL3)
    for (vx, vy0, vy1) in ((14, 0, 40), (26, 120, 170), (54, 0, 30)):  # pipes
        for y in range(vy0, vy1):
            put(vx, y, STEEL0); put(vx + 1, y, STEEL1); put(vx + 2, y, STEEL0)
    # --- RIGHT machinery column: piston slots + radar + cables ---
    for y in range(0, H):
        for x in range(440, W):
            if x < 447:
                c = GOLD0 if (y // 6) % 2 else INK0        # hazard stripe edge
            else:
                c = INK1 if n2(x, y, 206) < 0.9 else INK0
            put(x, y, c)
    for (px2, top, sh) in PISTONS:                         # piston cylinder slots
        for y in range(top - 2, top + sh + 2):
            for x in range(px2 - 3, px2 + 7):
                edge = x in (px2 - 3, px2 + 6) or y in (top - 2, top + sh + 1)
                put(x, y, STEEL0 if edge else INK0)
    # radar dish on a pivot
    for a in range(-50, 51, 4):                            # dish arc
        rx = 476 + int(math.cos(math.radians(a + 90)) * 12)
        ry = 22 + int(math.sin(math.radians(a + 90)) * 8) - 8
        put(rx, ry, STEEL2); put(rx + 1, ry, STEEL2)
    put(476, 22, STEEL1); put(476, 23, STEEL1); put(476, 24, STEEL1)  # pivot
    for k in range(6):                                     # cable bundle
        put(452 + k, 100 + (k % 3), INK2)
        put(452 + k, 108 + (k % 2), INK2)
    # --- overhead spine truss with beacons + lamp housings ---
    for x in range(60, 451):
        put(x, 8, STEEL0); put(x, 9, INK1); put(x, 20, STEEL0); put(x, 21, INK1)
        if x % 24 == 0:
            put(x, 12, STEEL1)                             # bolts
    for bx in range(60, 411, 40):                          # X-braces
        for k in range(10):
            put(bx + k * 4, 10 + k, INK1)
            put(bx + 40 - k * 4, 10 + k, INK1)
    for (bx2, by2) in BEACONS:                             # beacon domes (unlit)
        for dy in range(-4, 1):
            half = int(5 * math.sqrt(max(0, 1 - (dy / 4.5) ** 2)))
            for dx in range(-half, half + 1):
                put(bx2 + dx, by2 + dy, RED1)
        for dx in range(-5, 6):
            put(bx2 + dx, by2 + 1, STEEL1)                 # base collar
    for lx in (180, 260, 340):                             # work-lamp housings
        for dx in range(-3, 4):
            for dy in range(3):
                put(lx + dx, 22 + dy, GOLD0 if dy < 2 else GOLD1)
    # --- astronaut gallery: hull deck + viewport + crew ---
    for y in range(128, H):
        for x in range(W):
            c = STEEL0
            if (x + (y // 8) * 13) % 34 == 0 or y % 8 == 7:
                c = INK1                                   # panel seams
            if n2(x, y, 207) < 0.02:
                c = STEEL1                                 # rivet glints
            put(x, y, c)
    for y in range(132, 155):                              # viewport glass
        for x in range(76, 436):
            put(x, y, INK0 if n2(x, y, 208) < 0.97 else INK1)
    for x in range(74, 438):                               # viewport frame
        put(x, 131, STEEL2); put(x, 155, STEEL2)
    SUITS = [BLUE3, RED2, GOLD1, GREEN2]
    for hx in range(84, 429, 24):                          # crew inside
        jit = int(n2(hx, 0, 209) * 6) - 3
        cx, cy = hx + jit, 144 + int(n2(hx, 1, 210) * 4)
        suit = SUITS[int(n2(hx, 2, 211) * len(SUITS))]
        for dy in range(0, 8):                             # suit torso
            for dx in range(-3, 4):
                put(cx + dx, cy + dy, suit)
        for dy in range(-5, 0):                            # helmet
            for dx in range(-3, 4):
                if dx * dx + (dy + 2) ** 2 <= 9:
                    put(cx + dx, cy + dy, SPEC1)
        put(cx - 1, cy - 3, BLUE4); put(cx, cy - 3, BLUE4)  # visor glint
        if n2(hx, 3, 212) < 0.3:                           # a waving arm
            put(cx + 4, cy - 1, suit); put(cx + 5, cy - 2, suit)
    # two floating astronauts OUTSIDE, tethered
    for (ax, ay) in FLOATERS:
        for k in range(ay, 128, 2):                        # tether line
            put(ax + (128 - k) // 8, k, STEEL1)
        for dy in range(0, 7):                             # suit
            for dx in range(-3, 4):
                put(ax + dx, ay + dy, SPEC1 if dy < 2 else STEEL3)
        for dy in range(-4, 0):                            # helmet
            for dx in range(-2, 3):
                if dx * dx + (dy + 2) ** 2 <= 5:
                    put(ax + dx, ay + dy, SPEC1)
        put(ax, ay - 2, BLUE4)                             # visor
        put(ax - 4, ay + 5, STEEL1); put(ax + 4, ay + 5, STEEL1)  # thruster pods
    return im

def paint_near():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # heavy corner truss braces with hazard chevrons
    for (x0, sgn) in ((0, 1), (511, -1)):
        for i in range(120):
            x = x0 + sgn * i
            y = int(i * 0.32)
            for th in range(8):
                c = INK0 if 1 < th < 6 else STEEL0
                put(x, y + th, c)
            if i % 16 < 6:                                 # chevrons on inner edge
                put(x, y + 8, GOLD0)
                put(x, y + 9, INK0)
        for i in range(0, 120, 20):                        # rivets
            put(x0 + sgn * i, int(i * 0.32) + 4, STEEL3)
    # dangling power cable with plug head
    for k in range(46):
        x = 511 - k
        y = 2 + int(k * 0.85)
        put(x, y, INK1)
        if k % 9 == 4:
            put(x, y + 1, STEEL1)
    put(465, 41, STEEL2); put(465, 42, STEEL2)             # plug head
    put(464, 43, GOLD1); put(466, 43, GOLD1)               # prongs
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
