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

PIECES = {'mat': (paint_mat, 'mat.png')}

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
