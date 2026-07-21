#!/usr/bin/env python3
"""Paint the PAWNCH ring kit (visual overhaul V1) — deterministic, per-pixel,
master-palette-only. Usage:
  tools/.venv/bin/python tools/paint_ring.py mat|all

Writes assets/sprites/ring/<piece>.png. Every color comes from
assets/aseprite/pawnch-master.gpl (hex constants below mirror it). The output
is hand-tuned hi-bit pixel art per docs/ART_BIBLE.md v2 — this script IS the
editable master recipe; .aseprite files are derived from its output.

Geometry contract (screen space, floorTop=170): mat.png blits at (0,170);
trapezoid top edge (82,8)->(430,8) widening to (0,278)/(512,278) in ASSET
space (asset y = screen y - 170). See docs/superpowers/plans/
2026-07-20-visual-overhaul-v1-ring.md Task 5.
"""
import math
import os
import sys
from PIL import Image

# ---- master palette (mirrors pawnch-master.gpl) -----------------------------
INK0, INK1, INK2 = (7, 10, 22), (13, 18, 38), (20, 26, 51)
STEEL0, STEEL1, STEEL2, STEEL3, STEEL4 = (38, 48, 79), (58, 74, 120), (90, 111, 160), (142, 160, 207), (205, 214, 255)
MAT0, MAT1, MAT2, MAT3, MAT4, MAT5 = (14, 20, 48), (27, 35, 68), (42, 53, 102), (61, 74, 133), (85, 99, 168), (126, 136, 191)
GOLD0, GOLD1, GOLD2, GOLD3 = (140, 90, 18), (201, 150, 42), (255, 210, 74), (255, 231, 168)
BLUE1 = (19, 53, 127)
WOOD1, WOOD2, WOOD3 = (44, 28, 13), (74, 48, 24), (111, 77, 41)

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'ring')

# deterministic hash noise in [0,1) — stable art, no RNG state
def n2(x, y, salt=0):
    h = math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
    return h - math.floor(h)

# ---- the MAT (512x278, opaque) ----------------------------------------------
W, H = 512, 278
TOP = 8            # apron band is rows 0..TOP-1
def x_left(y):  return 82.0 * (1.0 - (y - TOP) / 270.0)
def x_right(y): return 430.0 + 82.0 * ((y - TOP) / 270.0)

SEAM_YS = [53, 98, 143, 188, 233]
V_SEAMS = [((170, TOP), (85, 277)), ((342, TOP), (427, 277))]

def v_seam_x(seg, y):
    (x1, y1), (x2, y2) = seg
    return x1 + (x2 - x1) * (y - y1) / (y2 - y1)

def worn_d(x, y):
    """Perturbed elliptical distance for the worn center (lens on the floor)."""
    dx, dy = (x - 256) / 82.0, (y - 198) / 27.0
    d = dx * dx + dy * dy
    # organic boundary: low-frequency noise wobbles the rim
    wob = (n2(x // 7, y // 5, 3) - 0.5) * 0.55
    return d + wob

def emblem_px(x, y):
    """Return a palette color if (x,y) is part of the printed emblem, else None.
    Ellipse ring + 12 sun-ray stubs + crowned pawn, centered (256,206)."""
    dx, dy = (x - 256) / 118.0, (y - 206) / 32.0
    d = math.sqrt(dx * dx + dy * dy)
    # ring band — two-tone (overhead light catches the far half)
    if 0.90 <= d <= 1.0:
        return GOLD1 if y < 206 else GOLD0
    # inner printed circle framing the pawn
    if 0.55 <= d <= 0.60:
        return MAT1
    # sun rays: thin stubs just outside the ring at every 30 degrees
    if 1.05 <= d <= 1.18:
        ang = math.degrees(math.atan2(dy, dx)) % 30.0
        if ang < 2.5 or ang > 27.5:
            return GOLD0
    # crowned pawn silhouette (perspective-squashed), centered 256,206.
    # DARK print so it reads against the light worn canvas behind it.
    px, py = x - 256, y - 206
    if -9 <= px <= 9 and -11 <= py <= -5 and (px / 9.0) ** 2 + ((py + 8) / 5.0) ** 2 <= 1:
        return MAT1                                   # head (squashed ball)
    if -7 <= px <= 7 and -5 <= py <= -3:
        return MAT1                                   # collar
    if -5 - (py + 2) * 0.35 <= px <= 5 + (py + 2) * 0.35 and -3 <= py <= 7:
        return MAT1                                   # flaring body
    if -12 <= px <= 12 and 7 <= py <= 10:
        return MAT1                                   # base
    if -13 <= px <= 13 and py == 11:
        return MAT0                                   # base contact shadow
    # crown: three spikes above the head
    if -8 <= px <= 8 and -15 <= py <= -11:
        k = abs((px + 8) % 8 - 4)
        if (-py - 11) <= (4 - k) + 1:
            return GOLD1
    return None

def paint_mat():
    im = Image.new('RGB', (W, H))
    p = im.load()
    for y in range(H):
        for x in range(W):
            if y < TOP:
                # ---- apron band: mat1, gold stitch rows, darkened ends ----
                c = MAT1
                if y in (1, 6) and x % 10 < 4:
                    c = GOLD1 if 46 <= x <= 466 else GOLD0
                if (x < 46 or x > 466) and n2(x, y, 9) < 0.5:
                    c = MAT0
                p[x, y] = c
                continue
            xl, xr = x_left(y), x_right(y)
            if x < xl or x > xr:
                # ---- ringside void: near-black, faint depth speckle ----
                c = INK0
                if n2(x, y, 1) < 0.04:
                    c = INK1
                p[x, y] = c
                continue
            # ---- canvas base + woven texture ----
            c = MAT2
            if n2(x, y, 2) < 0.04:                       # weave fleck
                c = MAT1
            elif (x + (y // 2)) % 4 == 0 and n2(x, y, 4) < 0.10:
                c = MAT1                                  # faint thread lines
            # far-edge light (overhead key light catches the far canvas)
            if y < 30 and n2(x, y, 5) < (30 - y) / 30.0 * 0.5:
                c = MAT3
            # near-corner falloff
            if y > 248 and n2(x, y, 6) < (y - 248) / 30.0 * 0.4:
                c = MAT1
            # side-edge falloff (canvas curls down toward the apron sides)
            edge = min(x - xl, xr - x)
            if edge < 10 and n2(x, y, 7) < (10 - edge) / 10.0 * 0.5:
                c = MAT1
            # ---- worn sparring center (lens, organic rim) ----
            d = worn_d(x, y)
            if d < 1.0:
                c = MAT3
                if d < 0.30 and n2(x, y, 8) < 0.7:
                    c = MAT4
                if d < 0.2 and n2(x, y, 10) < 0.04:
                    c = MAT5                              # rare canvas shine
                if n2(x, y, 11) < 0.06:
                    c = MAT2                              # specks of clean canvas
            # ---- printed emblem (under seams/scuffs, over wear) ----
            e = emblem_px(x, y)
            if e is not None:
                # the print sits ON worn canvas: gentle ink-wear speckle only
                if n2(x, y, 13) < 0.10:
                    c = MAT3 if d < 1.0 else MAT2         # ink flake
                else:
                    c = e
            # ---- seams: shadow line + catch-light below ----
            on_seam = y in SEAM_YS
            below_seam = (y - 1) in SEAM_YS
            for seg in V_SEAMS:
                sx = v_seam_x(seg, y)
                if abs(x - sx) < 0.6:
                    on_seam = True
                elif 0.6 <= x - sx < 1.6:
                    below_seam = True
            if on_seam:
                c = MAT1
            elif below_seam and n2(x, y, 14) < 0.4:
                c = MAT3
            p[x, y] = c

    # ---- scuff streaks: short strokes converging toward the camera ----
    for i in range(8):
        sx = 140 + n2(i, 1, 20) * 230
        sy = 130 + n2(i, 2, 21) * 120
        ln = 7 + int(n2(i, 3, 22) * 12)
        slope = (n2(i, 4, 23) - 0.5) * 1.4
        wide = n2(i, 6, 25) < 0.4
        col = MAT0 if n2(i, 5, 24) < 0.5 else MAT1
        for k in range(ln):
            x = int(sx + slope * k)
            y = int(sy + k)
            if 0 <= x < W and TOP <= y < H and x_left(y) < x < x_right(y):
                p[x, y] = col
                if wide and x + 1 < W:
                    p[x + 1, y] = col

    # gold glints on the emblem ring (<=6 px, top-light side)
    for gx, gy in [(174, 194), (256, 175), (338, 196), (216, 180), (298, 179)]:
        if emblem_px(gx, gy) == GOLD0:
            p[gx, gy] = GOLD2
    return im

# ---- POST (30x84, transparent bg) — blitted at screen (8, floorTop-60) -----
# Rows: 0..6 lamp housing (unlit; code adds the glow), 7..10 cap, 11..76 shaft,
# 77..83 base plate standing on the mat. Cool steel ramp, blue arena rim-light
# on the inner (right) edge, riveted.
def paint_post():
    im = Image.new('RGBA', (30, 84), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        p[x, y] = (*c, 255)
    # lamp housing
    for y in range(0, 7):
        for x in range(11, 20):
            put(x, y, GOLD0 if y in (0, 6) or x in (11, 19) else GOLD1)
    put(15, 3, GOLD3)                          # lens center (glows in-engine)
    # cap
    for y in range(7, 11):
        for x in range(8, 23):
            put(x, y, STEEL3 if y == 7 else STEEL2 if y == 8 else STEEL1)
    # shaft with cylinder shading
    for y in range(11, 77):
        for x in range(10, 21):
            if x == 10: c = INK2
            elif x == 11: c = STEEL0
            elif x <= 14: c = STEEL1
            elif x <= 17: c = STEEL2
            elif x <= 19: c = STEEL1
            else: c = INK2
            put(x, y, c)
        put(20, y, BLUE1 if y % 3 else (31, 79, 192))   # arena-side rim light
    # rivets down the center line
    for ry in range(16, 75, 12):
        put(15, ry, STEEL3)
        put(15, ry + 1, INK1)
    # base plate
    for y in range(77, 84):
        w0 = 10 - (y - 77)
        for x in range(w0, 30 - w0):
            put(x, y, STEEL0 if y == 77 else INK2)
    return im

# ---- PAD (24x11, grayscale ramp, transparent corners) — accent-tinted in-code
def paint_pad():
    im = Image.new('RGBA', (24, 11), (0, 0, 0, 0))
    p = im.load()
    SPEC1 = (232, 242, 255)
    for y in range(11):
        for x in range(24):
            # rounded pill: cut the corners
            cx = 0 if 3 <= x <= 20 else (3 - x if x < 3 else x - 20)
            cy = abs(y - 5)
            if cx * cx + (cy * cy) / 2.2 > 9:
                continue
            if y <= 1: c = STEEL3
            elif y <= 4: c = SPEC1 if 2 <= y <= 3 and 4 <= x <= 19 else STEEL3
            elif y <= 7: c = STEEL2
            else: c = STEEL1
            if x in (2, 21) or y in (0, 10):
                c = STEEL1                      # soft edge
            p[x, y] = (*c, 255)
    return im

# ---- STOOL (40x44, transparent) — blue corner seat, wood legs, towel -------
def paint_stool():
    im = Image.new('RGBA', (40, 44), (0, 0, 0, 0))
    p = im.load()
    BLUE3, BLUE4 = (43, 108, 255), (90, 138, 255)
    def put(x, y, c):
        p[x, y] = (*c, 255)
    # seat (rounded slab)
    for y in range(8, 17):
        for x in range(2, 38):
            if (x in (2, 37)) and y in (8, 16):
                continue
            c = BLUE4 if y == 8 else BLUE3 if y <= 13 else BLUE1
            put(x, y, c)
    # legs + cross brace
    for lx in (5, 18, 31):
        for y in range(17, 43):
            put(lx, y, WOOD2)
            put(lx + 1, y, WOOD3)
            put(lx + 2, y, WOOD1)
    for x in range(6, 34):
        put(x, 30, WOOD1)
    # towel draped over the seat's right edge: a strip lying ON the seat,
    # folding at the edge, hanging down in soft vertical folds
    SPEC1, TS = (232, 242, 255), STEEL3
    for y in range(6, 9):                       # lying on the seat
        for x in range(28, 37):
            put(x, y, SPEC1 if y > 6 else TS)
    for y in range(9, 26):                      # hanging drop with folds
        sway = 1 if y > 18 else 0
        for x in range(29 + sway, 38 + sway):
            if x >= 40:
                continue
            k = (x - 29) % 4
            c = STEEL1 if k == 3 else TS if k == 2 else SPEC1
            if y >= 24 and (x % 3 == 0):        # ragged hem
                continue
            put(x, y, c)
    # towel contact shadow on the seat
    for x in range(28, 38):
        put(x, 9, STEEL1)
    return im

# ---- PRESS (512x56, transparent middle) — ringside press-row silhouettes ---
# Clusters only in x0..150 and x362..512; middle stays clear of the player.
def paint_press():
    im = Image.new('RGBA', (512, 56), (0, 0, 0, 0))
    p = im.load()
    def put(x, y, c):
        if 0 <= x < 512 and 0 <= y < 56:
            p[x, y] = (*c, 255)
    def desk(x0, x1, taper):
        # taper: 'r' steps the desk lower toward its right end, 'l' toward left
        for y in range(42, 56):
            for x in range(x0, x1):
                inner = (x1 - x) if taper == 'r' else (x - x0)
                if inner < 24 and y < 42 + (24 - inner) // 3:
                    continue
                put(x, y, STEEL0 if y == 42 or (inner < 24 and y == 42 + (24 - inner) // 3) else INK1)
    def head(cx, cy, r):
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    put(x, y, INK0)
        put(cx - r // 2, cy - r // 2, INK1)     # faint crown highlight
    def shoulders(cx, y0, w, h):
        for y in range(y0, y0 + h):
            grow = (y - y0) // 2
            for x in range(cx - w // 2 - grow, cx + w // 2 + grow):
                put(x, y, INK0)
    def camera(cx, cy):
        for y in range(cy, cy + 7):
            for x in range(cx, cx + 10):
                put(x, y, STEEL0 if y > cy else INK1)
        put(cx + 11, cy + 3, STEEL3)            # lens
        put(cx + 12, cy + 3, STEEL1)
        for x in range(cx + 2, cx + 6):
            put(x, cy - 1, INK2)                # flash unit
    # left cluster: two photographers + a laptop journalist
    desk(0, 150, "r")
    head(28, 26, 6); shoulders(28, 32, 14, 10)
    camera(38, 24)
    head(74, 22, 7); shoulders(74, 29, 16, 13)
    camera(85, 20)
    head(122, 27, 6); shoulders(122, 33, 14, 9)
    for y in range(34, 41):                     # laptop screen glow (on the desk)
        for x in range(103, 112):
            put(x, y, (90, 138, 255) if y > 34 and x > 103 else STEEL0)
    # right cluster: commentator pair + camera + boom mic dipping in
    desk(362, 512, "l")
    head(388, 25, 6); shoulders(388, 31, 15, 11)
    camera(398, 22)
    head(452, 23, 7); shoulders(452, 30, 16, 12)
    head(492, 27, 5); shoulders(492, 32, 12, 10)
    for k in range(40):                         # boom pole
        x, y = 508 - k, 4 + k // 2
        put(x, y, INK1); put(x, y + 1, INK0)
    for y in range(24, 31):                     # mic head + foam
        for x in range(464, 471):
            put(x, y, INK0)
    put(467, 25, STEEL0)
    return im

PIECES = {
    'mat': (paint_mat, 'mat.png'),
    'post': (paint_post, 'post.png'),
    'pad': (paint_pad, 'pad.png'),
    'stool': (paint_stool, 'stool.png'),
    'press': (paint_press, 'press.png'),
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
