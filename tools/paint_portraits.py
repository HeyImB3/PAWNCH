#!/usr/bin/env python3
"""Paint the face-tile portrait sets (visual overhaul V5). Usage:
  tools/.venv/bin/python tools/paint_portraits.py [slug|overlays|all]

ONE standardized 44x44 face rig draws every character: fixed feature boxes
(rig contract, mirrored in src/portrait.js — blinks/emotes/overlays rely on
these) + a per-character parameter dict seeded from src/opponents.js LOOKS.

RIG CONTRACT: head cx=22, crown y5, chin ~y31 · eyes L(13,17)-(19,21)
R(25,17)-(31,21) · brows y13-15 · nose (21,22)-(23,24) · mouth (15,25)-(29,29)
· bust y31-43. Damage overlays (_overlays/damage1..3.png) target these boxes.

Expressions: neutral pleased smirk beaming concerned upset dejected wince
shock grin3. `neutral` inherits the character's resting mouth flavor, so
personality survives even at rest.
"""
import math
import os
import sys
from PIL import Image

from pawnch_palette import (
    INK0, INK1, STEEL1, STEEL3, MAT1, MAT3,
    RED1, RED2, RED4, GOLD0, GOLD1, GOLD2, SPEC0, SPEC1,
    BLUE1, BLUE3, EMBER4, WOOD1, n2,
)

S = 44
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'portraits')
EXPRESSIONS = ['neutral', 'pleased', 'smirk', 'beaming', 'concerned',
               'upset', 'dejected', 'wince', 'shock', 'grin3']

def hx(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def ramp(skin):
    """3-tone skin ramp: shadow (cool), base, light (warm)."""
    return (mix(skin, (60, 50, 90), 0.35), skin, mix(skin, (255, 245, 220), 0.30))

# ---- character parameters (identities from src/opponents.js LOOKS) ----------
CHARS = {
    'player':    dict(skin='#f2b07a', hue='#2b6cff', trim='#13357f', jaw='round',
                      hair='short', hairCol='#241a12', gear='headband', rest='grin', brows='hopeful', mods=[]),
    'patty':     dict(skin='#f2b07a', hue='#ff7a18', trim='#c14d00', jaw='chub',
                      hair='none', hairCol='#000000', gear='pawnDomeShort', rest='grin', brows='hopeful', mods=['cheekDab']),
    'gus':       dict(skin='#e8a878', hue='#39d98a', trim='#1f7a4d', jaw='gaunt',
                      hair='none', hairCol='#000000', gear='pawnDomeTall', rest='smirk', brows='cocked', mods=[]),
    'rosa':      dict(skin='#d99a6a', hue='#ff3b53', trim='#a01020', jaw='round',
                      hair='side', hairCol='#7a0c18', gear='rookChimney', rest='grin', brows='angryV', mods=[]),
    'kid':       dict(skin='#f2b07a', hue='#2b6cff', trim='#13357f', jaw='round',
                      hair='none', hairCol='#000000', gear='knightVisor', rest='smirk', brows='cocked', mods=[]),
    'bishop':    dict(skin='#caa0e0', hue='#9a5cff', trim='#4a2a8a', jaw='gaunt',
                      hair='none', hairCol='#000000', gear='mitre', rest='flat', brows='flatHeavy', mods=[]),
    'queen':     dict(skin='#f2b07a', hue='#ff6ab0', trim='#a02060', jaw='round',
                      hair='long', hairCol='#2a1030', gear='coronet', rest='lipstick', brows='angryV', mods=['hooded', 'cheekMark']),
    'iron':      dict(skin='#c8a888', hue='#8fa0c0', trim='#4a5570', jaw='square',
                      hair='none', hairCol='#000000', gear='rookStub', rest='flat', brows='bar', mods=['darkEyes']),
    'tal':       dict(skin='#e8b888', hue='#1fc8d0', trim='#0a6a70', jaw='gaunt',
                      hair='mane', hairCol='#101418', gear='none', rest='smirk', brows='angryV', mods=['widowPeak', 'catchlight', 'stubble']),
    'magnus':    dict(skin='#f2b07a', hue='#ffd24a', trim='#a07810', jaw='heavy',
                      hair='sideSwept', hairCol='#7a5836', gear='kingCrown', rest='smirk', brows='flatHeavy', mods=['hooded', 'stubble']),
    'pawnchion': dict(skin='#f2c090', hue='#ff7a18', trim='#2b6cff', jaw='square',
                      hair='none', hairCol='#000000', gear='amalgam', rest='flat', brows='bar', mods=['glint']),
}

# ---- rig drawing ------------------------------------------------------------
def draw_face(ch, expr):
    P = CHARS[ch]
    skin = hx(P['skin'])
    sh, base, lt = ramp(skin)
    hue, trim = hx(P['hue']), hx(P['trim'])
    hair = hx(P['hairCol'])
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = im.load()
    def put(x, y, c):
        if 0 <= x < S and 0 <= y < S:
            px[int(x), int(y)] = (*c, 255)
    droop = 1 if expr == 'dejected' else 0     # everything sags a pixel

    # ---- bust: shoulders + collar ----
    for y in range(31, S):
        spread = min(20, 8 + (y - 31) * 2)
        for x in range(22 - spread, 22 + spread + 1):
            c = hue
            if y == 31 + (0 if x % 2 else 1):
                c = trim                        # collar seam
            if x < 22 - spread + 2 or x > 22 + spread - 2:
                c = trim
            put(x, y, c)
    for y in range(27, 33):                     # neck
        for x in range(18, 27):
            put(x, y, sh if x < 20 else base)

    # ---- head ----
    JAW = {'round': (12, 31), 'chub': (13, 31), 'gaunt': (10, 31), 'square': (12, 32), 'heavy': (13, 32)}
    hw, chin = JAW[P['jaw']]
    for y in range(5 + droop, chin + droop):
        k = (y - 5) / (chin - 5)
        if k < 0.35:
            half = int(hw * math.sqrt(max(0, 1 - ((0.35 - k) / 0.38) ** 2)))
        elif k < 0.75:
            half = hw
        else:
            kk = (k - 0.75) / 0.25
            half = int(hw * (1 - kk * (0.55 if P['jaw'] in ('round', 'chub') else 0.35)))
            if P['jaw'] in ('square', 'heavy'):
                half = max(half, hw - 3)
        for x in range(22 - half, 22 + half + 1):
            c = base
            if x < 22 - half + 3:
                c = sh                          # left shadow (light from右? key light left→ light LEFT: flip)
            if x > 22 + half - 3:
                c = sh
            if 22 - half + 2 <= x <= 22 - half + 5 and y < 24:
                c = lt                          # lit left cheek plane
            put(x, y + 0, c)
    for (ex, ey) in ((22 - hw - 1, 18), (22 + hw + 1, 18)):   # ears
        for dy in range(-2, 3):
            put(ex, ey + dy + droop, base)
            put(ex + (1 if ex > 22 else -1), ey + dy + droop, sh)

    # ---- mouth (box 15..29 x 25..29) ----
    my = 26 + droop
    lip = hx('#c22037') if P['rest'] == 'lipstick' else sh
    def mouth_flat():
        for x in range(18, 27):
            put(x, my + 1, mix(sh, (0, 0, 0), 0.3))
        if P['rest'] == 'lipstick':
            for x in range(18, 27):
                put(x, my, lip); put(x, my + 2, lip)
    def mouth_smile(depth=1):
        for x in range(17, 28):
            dy = depth if 19 <= x <= 25 else 0
            put(x, my + 1 - dy + depth, mix(sh, (0, 0, 0), 0.3))
    def mouth_smirk():
        for i, x in enumerate(range(17, 27)):
            put(x, my + 1 - (i // 4), mix(sh, (0, 0, 0), 0.3))
    def mouth_grin(gap=False):
        for y in range(my - 1, my + 3):
            for x in range(17, 28):
                put(x, y, (20, 8, 10))
        for x in range(18, 27):                 # teeth row
            put(x, my, SPEC1)
        if gap:
            put(21, my, (20, 8, 10)); put(22, my, (20, 8, 10))
        if P['rest'] == 'lipstick':
            for x in range(17, 28):
                put(x, my - 2, lip); put(x, my + 3, lip)
    def mouth_frown(deep=False):
        d = 2 if deep else 1
        for x in range(17, 28):
            dy = d if 19 <= x <= 25 else 0
            put(x, my + dy, mix(sh, (0, 0, 0), 0.3))
    def mouth_grit():
        for y in range(my, my + 2):
            for x in range(17, 28):
                put(x, y, SPEC1)
        for x in range(18, 27, 2):
            put(x, my, sh); put(x + 1, my + 1, sh)
        for x in range(17, 28):
            put(x, my - 1, mix(sh, (0, 0, 0), 0.3)); put(x, my + 2, mix(sh, (0, 0, 0), 0.3))
    def mouth_O():
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if dx * dx + dy * dy <= 5:
                    put(22 + dx, my + 1 + dy, (20, 8, 10))
        if P['rest'] == 'lipstick':
            for dy in range(-3, 4):
                for dx in range(-3, 4):
                    if 5 < dx * dx + dy * dy <= 9:
                        put(22 + dx, my + 1 + dy, lip)
    REST = {'grin': lambda: mouth_smile(1), 'smirk': mouth_smirk, 'flat': mouth_flat, 'lipstick': mouth_flat}
    MOUTH = {
        'neutral': REST[P['rest']], 'pleased': lambda: mouth_smile(1),
        'smirk': mouth_smirk, 'beaming': lambda: mouth_grin(False),
        'concerned': mouth_flat, 'upset': lambda: mouth_frown(False),
        'dejected': lambda: mouth_frown(True), 'wince': mouth_grit,
        'shock': mouth_O, 'grin3': lambda: mouth_grin(True),
    }
    MOUTH[expr]()

    # ---- nose ----
    put(21, 23 + droop, sh); put(22, 23 + droop, sh); put(22, 24 + droop, sh)

    # ---- eyes (boxes L 13-19, R 25-31 at y17-21) ----
    eyeCol = hx('#2a2a30') if 'darkEyes' in P['mods'] else (30, 24, 20)
    ey = 18 + droop
    def eye_open(cx0, wide=False, squint=False):
        w = 4 if wide else 3
        h = 4 if wide else (2 if squint else 3)
        for dy in range(h):
            for dx in range(w):
                put(cx0 + dx, ey - 1 + dy, SPEC1 if wide else mix(SPEC1, base, 0.25))
        put(cx0 + w // 2, ey, eyeCol)
        put(cx0 + w // 2, ey + (1 if wide else 0), eyeCol)
        if 'catchlight' in P['mods'] or 'glint' in P['mods']:
            put(cx0 + w // 2 + 1, ey - 1, GOLD2 if 'glint' in P['mods'] else SPEC0)
        if 'hooded' in P['mods'] and not wide:
            for dx in range(w + 1):
                put(cx0 + dx - 0, ey - 2, sh)   # heavy lid
    def eye_closed(cx0, droopy=False):
        for dx in range(4):
            put(cx0 + dx, ey + (dx // 2 if droopy else 0), sh)
    def eye_happy(cx0):
        for dx in range(4):
            put(cx0 + dx, ey - (1 if 0 < dx < 3 else 0), sh)
    def eye_squeeze(cx0, flip):
        for i in range(3):
            put(cx0 + (i if not flip else 2 - i), ey - 1 + i, sh)
            put(cx0 + 1 + (i if flip else 2 - i), ey - 1 + i, sh)
    EYES = {
        'neutral': lambda c, f: eye_open(c), 'pleased': lambda c, f: eye_open(c),
        'smirk': lambda c, f: eye_open(c, squint=True), 'beaming': lambda c, f: eye_happy(c),
        'concerned': lambda c, f: eye_open(c), 'upset': lambda c, f: eye_open(c, squint=True),
        'dejected': lambda c, f: eye_closed(c, droopy=True), 'wince': eye_squeeze,
        'shock': lambda c, f: eye_open(c, wide=True), 'grin3': lambda c, f: eye_happy(c),
    }
    EYES[expr](14, False)
    EYES[expr](26, True)

    # ---- brows (y13-15): expression pose x character weight ----
    weight = 2 if P['brows'] in ('flatHeavy', 'bar') else 1
    by = 14 + droop
    POSE = {
        'neutral': 0, 'pleased': 0, 'smirk': 0, 'beaming': -2, 'concerned': 1,
        'upset': 2, 'dejected': 3, 'wince': 2, 'shock': -3, 'grin3': -2,
    }[expr]
    def brow(x0, x1, flip):
        for i, x in enumerate(range(x0, x1)):
            k = i / max(1, x1 - x0 - 1)
            if POSE == 0:
                dy = 0
                if P['brows'] == 'hopeful':
                    dy = -1 if 0.2 < k < 0.8 else 0
                if P['brows'] == 'cocked' and not flip:
                    dy = -1
                if P['brows'] == 'angryV':
                    dy = int(k * 2) if not flip else int((1 - k) * 2)
            elif POSE < 0:
                dy = POSE + (1 if 0.2 < k < 0.8 else 0) * 0
            elif POSE == 1:
                dy = int((1 - k) * 2) if not flip else int(k * 2)   # inner-up (sad)
            elif POSE == 2:
                dy = int(k * 2) if not flip else int((1 - k) * 2)   # inner-down (angry)
            else:
                dy = 2                                               # droop
            for w in range(weight):
                put(x, by + dy + w, hair if P['hair'] != 'none' else INK1)
    if P['brows'] == 'bar' and POSE in (0, 1):
        for x in range(14, 31):
            for w in range(2):
                put(x, by + w, INK1)
    else:
        brow(14, 20, False)
        brow(25, 31, True)

    # ---- mods on the face ----
    if 'stubble' in P['mods']:
        for y in range(24 + droop, 30 + droop):
            for x in range(13, 32):
                if n2(x, y, ord(ch[0])) < 0.25 and px[x, y][3] and px[x, y][:3] in (base, sh):
                    put(x, y, mix(base, (20, 16, 14), 0.45))
    if 'cheekDab' in P['mods']:
        put(15, 22, mix(base, (255, 80, 80), 0.5)); put(16, 22, mix(base, (255, 80, 80), 0.5))
        put(29, 22, mix(base, (255, 80, 80), 0.5)); put(30, 22, mix(base, (255, 80, 80), 0.5))
    if 'cheekMark' in P['mods']:
        put(29, 23 + droop, (40, 20, 30))

    # ---- hair ----
    if P['hair'] == 'short':
        for y in range(4, 12):
            for x in range(10, 35):
                if (x - 22) ** 2 / 150 + (y - 12) ** 2 / 60 <= 1:
                    put(x, y + droop, hair)
    elif P['hair'] == 'side':
        for y in range(4, 13):
            for x in range(9, 34):
                if (x - 20) ** 2 / 160 + (y - 13) ** 2 / 70 <= 1:
                    put(x, y + droop, hair)
        for y in range(13, 22):                 # side fall
            put(9, y + droop, hair); put(10, y + droop, hair)
    elif P['hair'] == 'long':
        for y in range(4, 12):
            for x in range(9, 36):
                if (x - 22) ** 2 / 170 + (y - 12) ** 2 / 60 <= 1:
                    put(x, y + droop, hair)
        for y in range(12, 30):                 # falls both sides
            for dx in range(3):
                put(8 + dx, y + droop, hair)
                put(33 + dx, y + droop, hair)
    elif P['hair'] == 'mane':                   # Tal: wild upswept storm mane
        # solid swept base first, then spikes rising out of it
        for y in range(5, 12):
            for x in range(10, 35):
                if (x - 22) ** 2 / 170 + (y - 12) ** 2 / 55 <= 1:
                    put(x, y + droop, hair)
        for i in range(7):
            bx0 = 12 + i * 3
            ln = 3 + int(n2(i, 0, 77) * 4)
            for k in range(ln):
                put(bx0 + k // 2, 5 - k + droop, hair)
                put(bx0 + 1 + k // 2, 5 - k + droop, mix(hair, (90, 111, 160), 0.25))
    elif P['hair'] == 'sideSwept':
        for y in range(4, 12):
            for x in range(10, 35):
                if (x - 24) ** 2 / 160 + (y - 12) ** 2 / 55 <= 1:
                    put(x, y + droop, hair)
        for i in range(8):                      # sweep strands
            put(11 + i, 6 + i // 3 + droop, mix(hair, SPEC1, 0.2))
    if 'widowPeak' in P['mods']:
        for k in range(3):
            put(21 + k // 2, 11 + k + droop, hair); put(23 - k // 2, 11 + k + droop, hair)

    # ---- headgear ----
    g = P['gear']
    if g == 'headband':
        for x in range(10, 35):
            put(x, 12 + droop, hue); put(x, 13 + droop, hue)
        put(34, 14 + droop, trim); put(35, 15 + droop, trim)   # knot tail
    elif g in ('pawnDomeShort', 'pawnDomeTall'):
        top = 1 if g == 'pawnDomeTall' else 4
        for y in range(top, 12):
            k = (y - top) / (12 - top)
            half = int(13 * math.sqrt(max(0.05, 1 - (1 - k) ** 2)))
            for x in range(22 - half, 22 + half + 1):
                c = hue if 22 - half + 2 < x < 22 + half - 2 else trim
                put(x, y + droop, c)
        put(21, top - 1 + droop, trim); put(22, top - 1 + droop, hue); put(23, top - 1 + droop, trim)  # nub
        for x in range(22 - 13, 22 + 14):
            put(x, 12 + droop, trim)            # brim
    elif g == 'rookChimney':
        for y in range(3, 12):
            for x in range(9, 36):
                c = hue if 11 < x < 33 else trim
                if y < 6 and ((x - 9) // 5) % 2 == 1:
                    continue                    # crenellation gaps
                put(x, y + droop, c)
        for x in range(9, 36):
            put(x, 12 + droop, trim)
    elif g == 'knightVisor':
        for y in range(3, 13):
            k = (y - 3) / 9
            half = int(14 * math.sqrt(max(0.05, 1 - (1 - k) ** 2)))
            for x in range(22 - half, 22 + half + 1):
                put(x, y + droop, hx('#8fa0c0') if 22 - half + 1 < x < 22 + half - 1 else hx('#4a5570'))
        for y in range(13, 19):                 # short nose guard (clears the nose)
            put(22, y + droop, hx('#8fa0c0'))
        for k in range(5):                      # tiny mane crest
            put(22, 2 - 0 + droop - k // 2, hue)
            put(23, 3 + droop - k // 2, hue)
    elif g == 'mitre':
        for y in range(-1, 12):
            k = max(0, y + 1) / 13
            half = int(4 + k * 9)
            for x in range(22 - half, 22 + half + 1):
                if abs(x - 22) <= 1 and y < 8:
                    continue                    # the cleft
                put(x, y + droop, hue if abs(x - 22) > 2 else trim)
        for x in range(13, 32):
            put(x, 12 + droop, GOLD1); put(x, 11 + droop, GOLD0)
    elif g == 'coronet':
        for x in range(11, 34):
            put(x, 11 + droop, GOLD1); put(x, 12 + droop, GOLD0)
        for sx in (12, 17, 22, 27, 32):         # spikes
            for k in range(4 if sx == 22 else 3):
                put(sx, 10 - k + droop, GOLD1)
            put(sx, (6 if sx == 22 else 7) + droop, hx('#ff6ab0'))  # jewels
    elif g == 'rookStub':
        for y in range(5, 13):
            for x in range(10, 35):
                put(x, y + droop, hx('#8fa0c0') if 12 < x < 32 else hx('#4a5570'))
        for x in range(12, 34, 5):
            put(x, 8 + droop, STEEL3)           # rivets
        for x in range(10, 35):
            put(x, 13 + droop, hx('#4a5570'))
    elif g == 'kingCrown':
        for x in range(12, 33):
            put(x, 7 + droop, GOLD1); put(x, 8 + droop, GOLD0)
        for sx in (13, 22, 31):
            for k in range(3):
                put(sx, 6 - k + droop, GOLD1)
            put(sx, 4 + droop, hx('#c22037') if sx == 22 else hx('#2b6cff'))
    elif g == 'amalgam':                        # champ: pawn dome wearing a crown
        for y in range(2, 12):
            k = (y - 2) / 10
            half = int(13 * math.sqrt(max(0.05, 1 - (1 - k) ** 2)))
            for x in range(22 - half, 22 + half + 1):
                put(x, y + droop, hue if 22 - half + 2 < x < 22 + half - 2 else trim)
        for x in range(14, 31):
            put(x, 3 + droop, GOLD1)
        for sx in (15, 22, 29):
            for k in range(3):
                put(sx, 2 - k + droop, GOLD1)
            put(sx, 0 + droop, hx('#2b6cff'))
        for x in range(9, 36):
            put(x, 12 + droop, trim)

    return im

# ---- global damage overlays (rig-aligned) -----------------------------------
def draw_overlay(tier):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = im.load()
    def put(x, y, c, a=255):
        if 0 <= x < S and 0 <= y < S:
            px[int(x), int(y)] = (*c, a)
    BRUISE = (96, 40, 96)
    # tier 1: cheek bruise + small brow cut
    for y in range(21, 27):
        for x in range(27, 34):
            if n2(x, y, 91) < 0.55:
                put(x, y, BRUISE, 150)
    put(14, 12, RED2); put(15, 13, RED2); put(16, 12, RED2)
    if tier >= 2:
        # butterfly bandage on the left brow
        for x in range(12, 20):
            put(x, 12, SPEC1); put(x, 13, STEEL3)
        put(14, 11, SPEC1); put(17, 11, SPEC1)
        put(14, 14, SPEC1); put(17, 14, SPEC1)
        # under-eye swelling (right) + lip cut
        for x in range(25, 32):
            put(x, 22, BRUISE, 120); put(x, 23, BRUISE, 90)
        put(24, 28, RED2); put(25, 29, RED2)
    if tier >= 3:
        # black-eye ring around the right eye + nose plaster
        for (dx, dy) in ((-1, -2), (0, -3), (1, -3), (2, -3), (3, -2), (4, -1), (4, 0),
                          (4, 1), (3, 2), (2, 3), (1, 3), (0, 3), (-1, 2), (-2, 1), (-2, 0), (-2, -1)):
            put(28 + dx, 19 + dy, (40, 30, 60), 200)
        for x in range(19, 26):
            put(x, 22, SPEC1); put(x, 23, STEEL3); put(x, 24, SPEC1)
        # deeper cheek bruising
        for y in range(20, 28):
            for x in range(26, 35):
                if n2(x, y, 93) < 0.35:
                    put(x, y, (70, 26, 70), 170)
    return im

def main():
    which = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if which in ('all', 'overlays'):
        d = os.path.join(OUT_DIR, '_overlays')
        os.makedirs(d, exist_ok=True)
        for t in (1, 2, 3):
            draw_overlay(t).save(os.path.join(d, f'damage{t}.png'))
        print('painted overlays')
    for slug in CHARS:
        if which not in ('all', slug):
            continue
        d = os.path.join(OUT_DIR, slug)
        os.makedirs(d, exist_ok=True)
        for expr in EXPRESSIONS:
            draw_face(slug, expr).save(os.path.join(d, f'{expr}.png'))
        print(f'painted {slug} (10 expressions)')

if __name__ == '__main__':
    main()
