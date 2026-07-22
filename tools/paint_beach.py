#!/usr/bin/env python3
"""Paint the BEACH arena layers (visual overhaul V2 pilot) — deterministic,
per-pixel, master-palette-only. Usage:
  tools/.venv/bin/python tools/paint_beach.py far|mid|near|all

Writes assets/sprites/arenas/beach/{far,mid,near}.png (512x170 each — the
backdrop region above floorTop=170). Art direction: BACKLIT GOLDEN HOUR — the
sky/sun are the brightest elements; everything terrestrial is a warm-rimmed
silhouette, so the fighters keep the contrast band (Art Bible v2 rule 8).

Geometry contract with src/config.js SCENERY.SCENES.beach.L:
  sun center (150,78) · horizon y92 · waterline y118 ·
  torch bowls (88,96)(190,104)(322,104)(424,96) ·
  lantern wire anchors (36,52)(256,40)(470,52), sag 8.
"""
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, INK2, BLUE0, BLUE1, EMBER1, EMBER2, EMBER3, EMBER4,
    GOLD0, GOLD1, GOLD2, GOLD3, GOLD4,
    WOOD0, WOOD1, WOOD2, WOOD3, WOOD4, SPEC1, n2,
)

W, H = 512, 170
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'arenas', 'beach')

SUN = (150, 78)
HORIZON = 92
WATERLINE = 118

# ---- FAR: dusk sky, backlit clouds, sun, sea (opaque) -----------------------
SKY_BANDS = [(14, INK0), (34, BLUE0), (52, EMBER1), (68, EMBER2), (80, EMBER3), (91, GOLD1)]
CLOUDS = [(90, 26, 120, 6), (330, 40, 150, 8), (210, 56, 90, 5), (420, 20, 100, 5)]

def sky_color(x, y):
    """Banded dusk gradient with n2-dithered, wobbled transitions."""
    prev_top = 0
    for i, (bot, col) in enumerate(SKY_BANDS):
        wob = (n2(x // 9, i, 41) - 0.5) * 4
        if y <= bot + wob:
            # dither the last ~5 rows into the NEXT band's color
            if i + 1 < len(SKY_BANDS):
                nxt = SKY_BANDS[i + 1][1]
                depth = (bot + wob) - y
                if depth < 5 and n2(x, y, 42) < (5 - depth) / 5.0 * 0.55:
                    return nxt
            return col
        prev_top = bot
    return SKY_BANDS[-1][1]

def paint_far():
    im = Image.new('RGB', (W, H))
    p = im.load()
    for y in range(H):
        for x in range(W):
            if y < HORIZON:
                p[x, y] = sky_color(x, y)
            elif y == HORIZON:
                # horizon line: hot near the sun, ember elsewhere
                p[x, y] = GOLD2 if 120 <= x <= 180 and x % 3 else EMBER3
            else:
                # sea: dusk gradient deepening off the horizon + horizontal
                # wave strokes + the sun's glitter lane (solid tapering core
                # with dashed shimmer — coherent runs, never lone pixels)
                d = y - HORIZON
                band = d + (n2(x // 7, y, 43) - 0.5) * 3
                if band < 4:
                    c = BLUE1
                elif band < 8:
                    c = BLUE1 if n2(x // 3, y, 44) < (8 - band) / 4.0 * 0.6 else BLUE0
                elif band < 18:
                    c = BLUE0
                else:
                    c = INK1 if n2(x // 3, y, 44) < (band - 18) / 8.0 else BLUE0
                row_h = 3 + int(n2(0, y, 45) * 3)
                if y % row_h == 0 and n2(x // 9, y, 46) < 0.45:
                    c = EMBER2 if (d < 7 and n2(x // 9, y, 47) < 0.5) else INK1
                half = 8.0 + d * 1.05          # narrow at the sun, widening down
                u = abs(x - SUN[0]) / half
                if u < 1.0:
                    core, lite = (GOLD2, GOLD1) if d < 6 else (GOLD1, EMBER4) if d < 14 else (EMBER4, EMBER3)
                    if u < 0.45:               # solid core + brighter dash rows
                        c = core if (y % 2 == 0 and n2(x // 5, y, 48) < 0.7) else lite
                    elif n2(x // 4, y, 49) < (1.0 - u) * 0.9:
                        c = lite               # dithered soft edge in 4px runs
                p[x, y] = c
    # backlit stratus clouds (lens silhouettes, gold under-rims)
    for (cx, cy, cw, ch) in CLOUDS:
        for dy in range(-ch // 2, ch // 2 + 1):
            # per-row width falloff -> lens shape, jittered edges
            k = 1 - (abs(dy) / (ch / 2 + 0.001)) ** 2
            half = int(cw / 2 * k + (n2(cx, dy, 47) - 0.5) * 6)
            if half <= 0:
                continue
            for x in range(cx - half, cx + half):
                y = cy + dy
                if 0 <= x < W and 0 <= y < HORIZON:
                    p[x, y] = INK1
        # gold under-rim on the sun-facing lower-left edge
        for x in range(cx - cw // 2, cx - cw // 6):
            y = cy + ch // 2
            if 0 <= x < W and 0 <= y < HORIZON and n2(x, y, 48) < 0.65:
                p[x, y] = GOLD2
    # sun disc (code adds the live glow)
    for dy in range(-14, 15):
        for dx in range(-14, 15):
            d2 = dx * dx + dy * dy
            if d2 <= 81:
                p[SUN[0] + dx, SUN[1] + dy] = GOLD4
            elif d2 <= 196:
                p[SUN[0] + dx, SUN[1] + dy] = GOLD3
            elif d2 <= 256 and n2(dx, dy, 49) < 0.4:
                x, y = SUN[0] + dx, SUN[1] + dy
                if y < HORIZON:
                    p[x, y] = GOLD2                       # dither halo ring
    # distant headland, right side, ember rim on its sun side
    for x in range(400, W):
        top = HORIZON - int((x - 400) / 112.0 * 8)
        for y in range(top, HORIZON):
            p[x, y] = INK1
        if top < HORIZON:
            p[x, top] = EMBER2 if n2(x, 0, 50) < 0.7 else INK1
    return im

# ---- MID: sand, driftwood bleachers, palm trunks, unlit torches -------------
TORCHES = [(88, 96), (190, 104), (322, 104), (424, 96)]
WIRE = [(36, 52), (470, 52)]     # one palm-to-palm span
WIRE_SAG = 12

def paint_mid():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    # sand (waterline down), lit from the left
    for y in range(WATERLINE, H):
        for x in range(W):
            c = WOOD2
            if x < 300 and n2(x, y, 51) < 0.25:
                c = WOOD3                                 # sun streaks
            if n2(x, y, 52) < 0.08:
                c = INK1                                  # shadow speckle
            if y <= WATERLINE + 4:
                if n2(x, y, 53) < 0.3:
                    c = GOLD2                             # wet-sand shimmer
                elif n2(x, y, 54) < 0.12:
                    c = SPEC1                             # static foam dot
            put(x, y, c)
    # driftwood bleachers flanking the ring (center stays clear)
    for (x0, x1) in ((8, 160), (352, 504)):
        for tier, ty in enumerate((146, 132)):
            for y in range(ty, ty + 12):
                for x in range(x0 + tier * 10, x1 - tier * 10):
                    c = WOOD1
                    if y == ty:
                        c = WOOD3                         # lit plank edge
                    if (x - x0) % 22 == 0:
                        c = WOOD0                         # plank gap
                    put(x, y, c)
            # seated crowd silhouettes on this tier (spaced so heads READ)
            for hx in range(x0 + tier * 10 + 6, x1 - tier * 10 - 4, 12):
                jit = int(n2(hx, ty, 55) * 4) - 2
                cx, cy = hx + jit, ty - 5 + int(n2(hx, ty, 56) * 4) - 1
                r = 3 + (n2(hx, ty, 57) < 0.35)
                for dy in range(-r, r + 1):
                    for dx in range(-r + 1, r):
                        if dx * dx + dy * dy <= r * r:
                            put(cx + dx, cy + dy, INK1)
                for dy in range(r, r + 4):                # narrow shoulders
                    for dx in range(-r, r + 1):
                        put(cx + dx, cy + dy, INK1)
                if n2(hx, ty, 58) < 0.6:                  # backlit crown rim (left)
                    put(cx - r + 1, cy - r + 1, GOLD0)
                    put(cx - r + 2, cy - r, GOLD0)
                    put(cx - r, cy - r + 2, GOLD0)
                if n2(hx, ty, 59) < 0.12:                 # a raised arm
                    for dy in range(1, 7):
                        put(cx + r, cy - r - dy, INK1)
    # palm trunks curving outward (fronds live in near.png)
    for (bx, curve) in ((36, -1), (470, 1)):
        for y in range(40, 141):
            k = (y - 40) / 100.0
            cx = bx + int(curve * (1 - k) * (1 - k) * 10)
            for dx in range(-3, 4):
                put(cx + dx, y, INK1)
            put(cx - 3, y, EMBER1)                        # sun-side rim
            if y % 9 == 0:                                # ring notches
                for dx in range(-3, 4):
                    put(cx + dx, y, WOOD0 if abs(dx) < 3 else INK1)
    # tiki torches: pole + wrap + UNLIT bowl (code adds flame())
    for (tx, ty) in TORCHES:
        for y in range(ty, ty + 44):
            for dx in range(-1, 2):
                put(tx + dx, y, WOOD1)
        for wy in range(ty + 6, ty + 40, 8):              # cross-wrap ticks
            for dx in range(-2, 3):
                put(tx + dx, wy, WOOD2)
        for dx in range(-4, 5):                           # bowl cup
            for dy in range(0, 5):
                if abs(dx) - 4 + dy <= 0:
                    put(tx + dx, ty - 5 + dy, INK1)
        for dx in range(-2, 3):
            put(tx + dx, ty - 4, WOOD0)                   # bowl interior
    # lantern wire: one sagging palm-to-palm span (code hangs the lanterns)
    (ax, ay), (bx, by) = WIRE
    steps = abs(bx - ax)
    for i in range(steps + 1):
        u = i / steps
        x = ax + (bx - ax) * u
        y = ay + (by - ay) * u + __import__('math').sin(u * 3.14159) * WIRE_SAG
        put(int(x), int(y), INK2)
    return im

# ---- NEAR: overhanging frond framing (top corners only) ---------------------
def paint_near():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = (*c, 255)
    import math as _m
    def frond(ox, oy, dx, dy, ln, wid):
        """A palm frond: thick tapered spine + swept-back leaflets both sides."""
        mag = _m.hypot(dx, dy)
        ux, uy = dx / mag, dy / mag              # along the spine
        px_, py_ = -uy, ux                       # perpendicular
        droop = 0.0
        for i in range(ln):
            k = i / ln
            droop += 0.012                       # tip bends downward
            x = ox + ux * i
            y = oy + uy * i + droop * i * 0.5
            # spine (2px, tapering to 1)
            sw = 2 if k < 0.5 else 1
            for s in range(sw):
                put(int(x + px_ * s), int(y + py_ * s), INK0)
            # leaflets every 2 steps, shrinking toward the tip, swept back
            if i % 2 == 0 and i > 3:
                llen = max(2, int(wid * 2.6 * (1 - k)) + 2)
                for side in (-1, 1):
                    if n2(i, side, 63 + ox) < 0.06:
                        continue                  # missing leaflet (ragged)
                    for j in range(llen):
                        jx = x + (px_ * side + ux * 0.55) * j
                        jy = y + (py_ * side + uy * 0.55) * j + j * 0.18
                        c = INK0 if j < llen * 0.6 else INK1
                        # underside leaflets catch the low sun (rim from below)
                        if side == 1 and j > llen * 0.4 and n2(i, j, 64) < 0.5:
                            c = EMBER2 if n2(i, j, 66) < 0.4 else EMBER1
                        put(int(jx), int(jy), c)
    def canopy(cx, cy, rx, ry, salt):
        """Serrated canopy mass at a corner. The sun sits BELOW the fronds, so
        the underside edge catches a warm ember rim (that's what makes the
        silhouette read against the near-black top sky)."""
        for y in range(max(0, cy - ry), cy + ry):
            for x in range(max(0, cx - rx), min(W, cx + rx)):
                dx, dy = (x - cx) / rx, (y - cy) / ry
                d = dx * dx + dy * dy
                bite = (n2(x // 3, y // 3, salt) - 0.5) * 0.5
                dd = d + bite
                if dd < 1.0:
                    if dd > 0.72 and dy > 0:              # sunlit underside rim
                        c = EMBER2 if n2(x, y, salt + 1) < 0.55 else EMBER1
                    elif d < 0.6:
                        c = INK0
                    else:
                        c = INK1
                    put(x, y, c)
    # left cluster: corner mass + blades fanning down-right
    canopy(-10, 0, 85, 42, 65)
    for (ox, oy, ddx, ddy, ln, wd) in [
        (-4, 2, 1.8, 0.42, 96, 5), (2, -2, 1.5, 0.62, 88, 5), (10, 6, 1.2, 0.34, 80, 4),
        (-2, 14, 1.9, 0.22, 82, 4), (20, -2, 0.9, 0.55, 62, 4), (32, 2, 0.6, 0.48, 48, 3),
        (6, 20, 1.4, 0.5, 70, 4), (26, 12, 1.0, 0.4, 58, 3), (-2, 28, 1.6, 0.12, 60, 3),
        (14, -4, 1.7, 0.72, 74, 4), (0, 8, 2.1, 0.32, 88, 4), (38, 6, 0.75, 0.6, 52, 3),
    ]:
        frond(ox, oy, ddx, ddy, ln, wd)
    # hanging coconuts under the left canopy
    for (cx, cy) in ((62, 40), (74, 35)):
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                if dx * dx + dy * dy <= 16:
                    put(cx + dx, cy + dy, INK1)
        for dy in range(-3, 2):
            put(cx - 4, cy + dy, EMBER1)                  # left rim
    # right cluster: corner mass + blades fanning down-left
    canopy(520, -2, 80, 38, 66)
    for (ox, oy, ddx, ddy, ln, wd) in [
        (515, 0, -1.7, 0.4, 92, 5), (508, -3, -1.4, 0.6, 82, 5), (502, 8, -1.1, 0.3, 74, 4),
        (512, 16, -1.8, 0.18, 76, 4), (492, 0, -0.8, 0.52, 56, 3),
        (506, 22, -1.5, 0.35, 66, 4), (486, 8, -1.0, 0.28, 52, 3),
        (500, -4, -1.6, 0.66, 70, 4), (511, 26, -2.0, 0.24, 72, 3),
    ]:
        frond(ox, oy, ddx, ddy, ln, wd)
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
