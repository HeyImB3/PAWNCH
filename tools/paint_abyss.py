#!/usr/bin/env python3
"""Paint the UNDERWATER ABYSS arena layers (visual overhaul V3 finale). Usage:
  tools/.venv/bin/python tools/paint_abyss.py far|mid|near|all

Tal Tempest's arena — a bioluminescent trench: downwelling light, glowing
rock walls, an anglerfish lurking, a dome gallery of merfolk and divers.

Geometry contract with src/config.js SCENERY.SCENES.abyss.L:
  vents (120,158)(390,154) · lure tip (452,78) · dome viewport y130-158 ·
  kelp roots x 62/88/424/452 (near layer; code sways it).
"""
import math
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, STEEL0, STEEL3, MAT0, MAT1, MAT3,
    BLUE0, BLUE1, BLUE4, GREEN1, GREEN2, RED2, EMBER5, SPEC1, n2,
)

W, H = 512, 170
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'arenas', 'abyss')

VENTS = [(120, 158), (390, 154)]
LURE = (452, 78)

def paint_far():
    im = Image.new('RGB', (W, H))
    p = im.load()
    for y in range(H):
        k = y / H
        for x in range(W):
            # depth gradient: faint light above, black-blue below
            if k < 0.25:
                c = BLUE1 if n2(x, y, 220) < 0.5 - k else BLUE0
            elif k < 0.65:
                c = BLUE0 if n2(x, y, 221) < 0.9 - (k - 0.25) else MAT0
            else:
                c = MAT0
            if n2(x, y, 222) < 0.004:
                c = SPEC1                                  # marine snow
            p[x, y] = c
    # downwelling light shafts
    for (sx, sw) in ((180, 40), (300, 28)):
        for y in range(0, 110):
            for x in range(sx - sw // 2, sx + sw // 2):
                spread = (x - sx) / (sw / 2)
                if n2(x, y, 223) < 0.10 * (1 - abs(spread)) * (1 - y / 110):
                    p[x, y] = BLUE4
    # trench walls closing in both sides, with bio-dots
    for y in range(H):
        wl = 70 - int(n2(0, y // 4, 224) * 26) - y // 8
        wr = 442 + int(n2(1, y // 4, 225) * 26) + y // 8
        for x in range(0, max(0, wl)):
            p[x, y] = INK1 if n2(x, y, 226) < 0.9 else INK0
        for x in range(min(W, wr), W):
            p[x, y] = INK1 if n2(x, y, 227) < 0.9 else INK0
        if n2(2, y, 228) < 0.25 and wl > 4:
            p[wl - 2, y] = GREEN1                          # wall bio-dots
        if n2(3, y, 229) < 0.25 and wr < W - 4:
            p[wr + 1, y] = GREEN1
    # a distant school of tiny fish
    for i in range(22):
        fx = 220 + int(n2(i, 0, 230) * 70) + int(math.sin(i * 0.8) * 18)
        fy = 45 + int(n2(i, 1, 231) * 34)
        for k in range(3):
            if 0 <= fx + k < W:
                p[fx + k, fy] = STEEL3
    return im

def paint_mid():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # rocky outcrops flanking the floor
    for (x0, x1) in ((60, 150), (360, 450)):
        for bi in range(4):
            bx = x0 + int(n2(bi, x0, 232) * (x1 - x0 - 30))
            by = 128 + int(n2(bi, x0 + 1, 233) * 26)
            br = 10 + int(n2(bi, x0 + 2, 234) * 14)
            for dy in range(-br // 2, br // 2 + 1):
                for dx in range(-br, br + 1):
                    if (dx / br) ** 2 + (dy / (br / 2)) ** 2 <= 1:
                        c = INK1 if n2(bx + dx, by + dy, 235) < 0.8 else MAT1
                        put(bx + dx, by + dy, c)
            for dx in range(-br + 2, br - 2):              # algae rim upper-left
                if n2(dx, bi, 236) < 0.5:
                    put(bx + dx - 1, by - br // 2, GREEN1)
    # vent chimneys (code bubbles from the mouths)
    for (vx, vy) in VENTS:
        for dy in range(0, 26):
            half = 3 + dy // 5
            for dx in range(-half, half + 1):
                y = vy - 26 + dy + 26                      # base at vy..vy+? build downward
        for dy in range(-26, 0):
            half = 3 + (-dy) // 6
            for dx in range(-half, half + 1):
                c = INK1
                if n2(vx + dx, vy + dy, 237) < 0.15:
                    c = MAT3                               # mineral streaks
                put(vx + dx, vy + dy, c)
        for dx in range(-2, 3):
            put(vx + dx, vy - 26, INK0)                    # dark mouth
    # THE ANGLERFISH lurking upper-right — bio-lit rim so it READS against
    # the dark water (the ink-on-ink lesson, again)
    ax, ay = 455, 80
    for dy in range(-12, 13):                              # bulky body
        for dx in range(-28, 20):
            d = (dx / 26.0) ** 2 + (dy / 12.0) ** 2
            if d <= 1:
                c = INK1
                if d > 0.82 and dy < 0:
                    c = STEEL0                             # cold dorsal rim
                elif dy > 5 and n2(ax + dx, ay + dy, 238) < 0.7:
                    c = MAT3                               # pale belly
                put(ax + dx, ay + dy, c)
    for dx in range(-24, 12, 4):                           # bio-dots along the flank
        if n2(dx, 0, 243) < 0.6:
            put(ax + dx, ay - 2, GREEN1)
    for k in range(10):                                    # open jaw + teeth
        put(ax - 28 + k, ay + 2 + k // 2, INK0)
        if k % 3 == 0:
            put(ax - 26 + k, ay + 3 + k // 2, SPEC1)       # needle teeth
    for dy in range(-6, -2):                               # tail fin
        put(ax + 20 - dy, ay + dy + 2, INK1)
        put(ax + 21 - dy, ay + dy + 2, INK1)
    put(ax - 12, ay - 5, STEEL3); put(ax - 11, ay - 5, SPEC1)  # pale eye
    # lure stalk arcing forward to the anchor tip
    for k in range(16):
        u = k / 15.0
        sx = ax - 18 - int(u * (ax - 18 - LURE[0]))
        sy = ay - 12 - int(math.sin(u * math.pi) * 10) - int(u * (ay - 12 - LURE[1]))
        put(sx, sy, INK1)
    # observation dome gallery behind the ring
    for y in range(126, H):
        for x in range(W):
            if p[x, y][3]:
                continue                                   # keep rocks/vents in front
            c = STEEL0
            if x % 26 < 2:
                c = INK1                                   # hull ribs
            put(x, y, c)
    for y in range(130, 159):                              # viewport glass
        for x in range(80, 432):
            put(x, y, INK0 if n2(x, y, 239) < 0.97 else INK1)
    for x in range(78, 434):
        put(x, 129, STEEL3); put(x, 159, STEEL3)           # frame
    # merfolk + diver spectators inside
    for i, hx in enumerate(range(92, 425, 21)):
        jit = int(n2(hx, 0, 240) * 5) - 2
        cx, cy = hx + jit, 146 + int(n2(hx, 1, 241) * 5)
        if i % 2:                                          # diver: helmet + visor
            for dy in range(-4, 1):
                for dx in range(-3, 4):
                    if dx * dx + (dy + 2) ** 2 <= 8:
                        put(cx + dx, cy + dy, SPEC1)
            put(cx - 1, cy - 2, BLUE4); put(cx, cy - 2, BLUE4)
            for dy in range(1, 7):
                for dx in range(-3, 4):
                    put(cx + dx, cy + dy, STEEL0)
        else:                                              # merfolk: finned head
            for dy in range(-3, 1):
                for dx in range(-3, 4):
                    if dx * dx + (dy + 1) ** 2 <= 7:
                        put(cx + dx, cy + dy, GREEN2)
            put(cx - 4, cy - 3, GREEN1); put(cx + 4, cy - 3, GREEN1)  # ear fins
            for dy in range(1, 7):
                for dx in range(-2, 3):
                    put(cx + dx, cy + dy, GREEN1)
    return im

def paint_near():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # tall kelp stalks (whole layer sways in code)
    for (rx, ph) in ((62, 0.0), (88, 1.4), (424, 0.7), (452, 2.2)):
        for y in range(H - 1, -1, -1):
            k = (H - y) / H
            x = rx + int(math.sin(k * 5 + ph) * (4 + k * 8))
            put(x, y, GREEN1)
            put(x + 1, y, GREEN1)
            if y % 8 == 2:                                 # blades
                side = 1 if (y // 8) % 2 else -1
                for b in range(1, 6):
                    put(x + side * b + 1, y - b // 2, GREEN2 if b > 3 else GREEN1)
    # coral overhangs in the top corners (antler branches)
    def coral(ox, oy, sgn):
        def branch(x, y, dx, dy, ln, th):
            for i in range(ln):
                px2 = int(x + dx * i)
                py2 = int(y + dy * i)
                for t2 in range(th):
                    put(px2, py2 + t2, RED2 if n2(px2, py2, 242) < 0.7 else EMBER5)
        branch(ox, oy, sgn * 1.6, 0.5, 26, 3)
        branch(ox + sgn * 18, oy + 8, sgn * 1.1, 0.9, 16, 2)
        branch(ox + sgn * 10, oy + 3, sgn * 0.7, 1.2, 12, 2)
        branch(ox + sgn * 30, oy + 12, sgn * 1.4, 0.3, 14, 2)
    coral(2, 2, 1)
    coral(509, 4, -1)
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
