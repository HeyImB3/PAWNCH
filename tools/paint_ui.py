#!/usr/bin/env python3
"""Paint the chess-half broadcast panel chrome (visual overhaul V4). Usage:
  tools/.venv/bin/python tools/paint_ui.py chesspanel|all

Writes assets/sprites/ui/chesspanel.png (129x448, opaque), blitted in-game at
(383,0). Every recess position mirrors src/config.js PANEL (screen coords =
local + (383,0)):
  portrait wells (6,36)/(6,232) 46x46 · plaques x54-124 · glove+bar rows at
  (54,70)/(54,266) with channel x66-122 · clock plates (4,88)/(4,196) 121x30
  with screen window x10-110 · trays (4,124)/(4,168) 121x22 · badge (40,150)
  48x16 · ticker (4,284) 121x42 · fuse channel x8-97 at y332 + bell (109,338).
"""
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, INK2, STEEL0, STEEL1, STEEL2, STEEL3,
    RED1, RED2, BLUE3, EMBER4, GOLD0, GOLD1,
    WOOD0, WOOD1, WOOD3, WOOD4, SPEC1, n2,
)

W, H = 129, 448
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'ui')

def paint_chesspanel():
    im = Image.new('RGB', (W, H))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = c
    def rect(x0, y0, w, h, c):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                put(x, y, c)
    def frame(x0, y0, w, h, c):
        for x in range(x0, x0 + w):
            put(x, y0, c); put(x, y0 + h - 1, c)
        for y in range(y0, y0 + h):
            put(x0, y, c); put(x0 + w - 1, y, c)
    # backdrop: brushed-steel column
    for y in range(H):
        for x in range(W):
            c = INK1
            if n2(x // 2, y, 300) < 0.08:
                c = INK2                                   # brushed streaks
            put(x, y, c)
    for y in range(H):                                     # left edge seam
        put(0, y, STEEL0); put(1, y, STEEL0)
    for y in range(14, H, 28):                             # edge rivets
        put(3, y, STEEL1); put(W - 3, y, STEEL1)
    # brand stripe top
    rect(0, 0, W // 2, 5, EMBER4)
    rect(W // 2 + 1, 0, W - W // 2 - 1, 5, BLUE3)
    for y in range(5):
        put(W // 2, y, GOLD1)
    # ---- portrait wells + gold corner brackets ----
    for wy in (36, 232):
        rect(6, wy, 46, 46, INK0)
        frame(6, wy, 46, 46, STEEL1)
        for (cx, cy, sx, sy) in ((7, wy + 1, 1, 1), (50, wy + 1, -1, 1), (7, wy + 44, 1, -1), (50, wy + 44, -1, -1)):
            for k in range(4):
                put(cx + k * sx, cy, GOLD0)
                put(cx, cy + k * sy, GOLD0)
    # ---- plaques + glove HP rows ----
    for py in (38, 234):
        rect(54, py, 70, 12, WOOD1)
        frame(54, py, 70, 12, GOLD0)
    for gy in (70, 266):
        # painted 8x8 boxing glove
        for dy in range(8):
            for dx in range(8):
                d = (dx - 3.5) ** 2 / 12 + (dy - 3.2) ** 2 / 9
                if d <= 1:
                    put(54 + dx, gy + dy, RED2)
        put(56, gy + 2, SPEC1)                             # shine
        rect(54, gy + 6, 3, 2, RED1)                       # cuff
        # HP bar channel
        rect(66, gy, 56, 8, INK0)
        frame(66, gy, 56, 8, STEEL1)
    # ---- clock plates with screen windows ----
    for cy in (88, 196):
        rect(4, cy, 121, 30, STEEL0)
        for x in range(4, 125):
            put(x, cy, STEEL2)                             # top bevel
        for (sx, sy) in ((6, cy + 2), (122, cy + 2), (6, cy + 27), (122, cy + 27)):
            put(sx, sy, STEEL3)                            # corner screws
        rect(10, cy + 6, 100, 20, INK0)                    # screen window
        for y in range(cy + 6, cy + 26, 3):
            for x in range(10, 110):
                if y % 3 == 0:
                    put(x, y, INK1)                        # scanlines
        frame(10, cy + 6, 100, 20, INK2)
    # ---- capture trays ----
    for ty in (124, 168):
        rect(4, ty, 121, 22, WOOD1)
        for x in range(4, 125):
            put(x, ty, GOLD0)                              # lip
        for x in range(18, 125, 14):
            for y in range(ty + 3, ty + 20):
                put(x, y, WOOD0)                           # slot dividers
    # ---- advantage badge plate ----
    rect(40, 150, 48, 16, INK0)
    frame(40, 150, 48, 16, GOLD0)
    # ---- ticker recess ----
    rect(4, 284, 121, 42, INK0)
    frame(4, 284, 121, 42, STEEL1)
    for ry in (297, 311):
        for x in range(6, 123):
            put(x, ry, INK1)                               # row separators
    # ---- fuse channel + bell ----
    rect(8, 330, 90, 14, INK0)
    frame(8, 330, 90, 14, STEEL1)
    for x in range(10, 96):                                # twisted rope
        c = WOOD3 if (x // 3) % 2 else WOOD4
        put(x, 336, c); put(x, 337, c)
        if x % 6 == 0:
            put(x, 335, WOOD3); put(x, 338, WOOD3)
    # the bronze bell on its bracket
    bx, by = 109, 338
    for dy in range(-7, 1):                                # dome
        half = int(7 * (1 - (abs(dy + 3.5) / 4.5) ** 2) ** 0.5) if dy > -7 else 2
        for dx in range(-half, half + 1):
            put(bx + dx, by + dy, GOLD1 if dy > -6 else GOLD0)
    for dx in range(-7, 8):
        put(bx + dx, by + 1, GOLD0)                        # rim
    put(bx, by + 3, INK0); put(bx, by + 2, INK0)           # clapper
    for dy in range(-10, -7):
        put(bx, by + dy, STEEL1)                           # bracket
    return im

PIECES = {'chesspanel': (paint_chesspanel, 'chesspanel.png')}

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
