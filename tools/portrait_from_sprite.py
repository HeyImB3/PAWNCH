#!/usr/bin/env python3
"""Build the 44x44 face-tile portraits FROM the authored fighter sprites, so
chess/round-break/match-end faces match the models (visual polish pass
2026-07-21). Replaces the painted faces from tools/paint_portraits.py — that
tool still owns _overlays/damage*.png. Usage:
  tools/.venv/bin/python tools/portrait_from_sprite.py [slug|all] [--audit]

Expressions map to POSES (fighters wear different faces per pose):
  neutral/pleased -> idle · concerned/upset/wince -> hurt ·
  shock/dejected -> stagger · smirk/beaming/grin3 -> special
A missing pose file, or a pose in the slug's bad=() -> falls back to idle.

RIG CONTRACT (mirrored in src/portrait.js — do not drift): 44x44, head cx=22,
crown y5, chin y31, eye band y17-21 (blink bar x12 y16 w20 h6). We anchor on
EYES and CHIN: scale = (31-19)/(chin-eyeY); tall hats crop at the tile top
like a tight broadcast shot.

FACE gives per-slug head geometry in SPRITE px measured on front_idle (hand-tuned
via --audit; an un-tuned slug falls back to the HEAD_K alpha-bbox estimate):
eyeY/chin/cx set the idle head and every pose reuses it, with optional per-pose
shift={pose:(dx,dy)} translations, per-pose pose={pose:dict(eyeY,chin,cx)} FULL
overrides (for a pose whose head is a different size), and bad=(poses,) to force
idle. --audit writes tools/_portrait_audit.png (checkerboard, 2x, rows=slugs) —
judge THAT, never the raw PNGs (the Read tool renders alpha as white).
"""
import os
import sys
from PIL import Image

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, '..', 'assets', 'sprites', 'boxers')
OUT = os.path.join(HERE, '..', 'assets', 'sprites', 'portraits')
S, RIG_EYE, RIG_CHIN = 44, 19.0, 31.0
FEET = 190

SLUGS = ['player', 'patty', 'gus', 'rosa', 'kid', 'bishop', 'queen',
         'iron', 'tal', 'magnus', 'pawnchion']
EXPR_POSE = {'neutral': 'idle', 'pleased': 'idle',
             'concerned': 'hurt', 'upset': 'hurt', 'wince': 'hurt',
             'shock': 'stagger', 'dejected': 'stagger',
             'smirk': 'special', 'beaming': 'special', 'grin3': 'special'}

# head-fraction fallback for an un-tuned slug (only used when FACE has no entry).
HEAD_K = {'patty': 0.30, 'kid': 0.28, 'gus': 0.26, 'player': 0.24,
          'rosa': 0.24, 'bishop': 0.24, 'queen': 0.24, 'tal': 0.24,
          'magnus': 0.24, 'iron': 0.26, 'pawnchion': 0.26}

# Per-slug head geometry, ALL in front_idle sprite px, hand-measured at 9x with a
# pixel ruler. Keys:
#   eyeY/chin/cx  — the idle head; the base for EVERY pose (the head barely moves
#                   between poses, so we reuse it and correct exceptions below).
#   shift={pose:(dx,dy)} — translate the crop for a pose whose head sits elsewhere
#                   (a duck lowers dy, a turn moves dx). Same head SIZE as idle.
#   pose={pose:dict(eyeY=,chin=,cx=)} — a FULL per-pose override for a pose whose
#                   head is a different SIZE (a lean-in special), so its own
#                   eye->chin sets the scale. Wins over shift's base.
#   bad=(pose,)   — a pose too occluded/tilted to use; falls back to idle.
FACE = {
    'player':    dict(eyeY=72, chin=85,  cx=68,
                      shift={'special': (-8, -18)}),
    'patty':     dict(eyeY=109, chin=127, cx=66),
    'gus':       dict(eyeY=61, chin=76,  cx=88,
                      shift={'hurt': (-48, 3), 'special': (-36, 10)}),
    'rosa':      dict(eyeY=90, chin=103, cx=70,
                      shift={'stagger': (-15, 1), 'special': (-8, -10)},
                      bad=('hurt',)),   # hurt: head tilts so far the rook crown fills the tile -> idle
    'kid':       dict(eyeY=84, chin=98,  cx=78,
                      shift={'hurt': (-8, -4), 'special': (-19, -14)}),
    'bishop':    dict(eyeY=24, chin=38,  cx=64,
                      shift={'hurt': (-24, 33), 'stagger': (-24, 10)},
                      bad=('special',)),   # special: skull buried in the dark raised-arm cape -> idle
    'queen':     dict(eyeY=79, chin=93,  cx=72,
                      shift={'hurt': (0, 3)},
                      pose={'special': dict(eyeY=51, chin=71, cx=52)}),
    'iron':      dict(eyeY=35, chin=47,  cx=62,
                      shift={'hurt': (-7, 40), 'stagger': (-4, 32),
                             'special': (-2, 9)}),
    'tal':       dict(eyeY=70, chin=85,  cx=66,
                      shift={'hurt': (-18, -2), 'special': (-21, -5)}),
    'magnus':    dict(eyeY=63, chin=80,  cx=70,
                      shift={'hurt': (8, -2), 'special': (-18, -6)}),
    'pawnchion': dict(eyeY=55, chin=71,  cx=68,
                      shift={'hurt': (0, 23), 'special': (-16, -12)}),
}


def bbox_and_cx(im):
    a = im.getchannel('A')
    l, t2, r, b = a.getbbox()
    # head center x = centroid of opaque pixels in the crown rows
    tot = n = 0
    px = a.load()
    for yy in range(t2, min(t2 + 12, b)):
        for xx in range(l, r):
            if px[xx, yy] > 16:
                tot += xx
                n += 1
    return t2, (tot // max(1, n))


def geometry(slug, pose, im):
    """Resolve eyeY/chin/cx (sprite px) for this slug+pose.

    Base geometry is the hand-measured idle head (FACE[slug]); the alpha-bbox
    head-fraction estimate is only a fallback for an un-tuned slug. Non-idle
    poses REUSE the idle head position — across poses the head barely moves, it's
    the GLOVES that fly around, so anchoring on the alpha-bbox top would chase a
    raised glove off the face. Poses whose head genuinely shifts (a duck, a
    thrown-back stagger, an angled special) are corrected with an explicit
    shift={'pose': (dx, dy)}; hopeless ones (a glove fully across the face) use
    bad=(pose,) to fall back to idle.
    """
    t2, acx = bbox_and_cx(im)
    f = FACE.get(slug, {})
    po = f.get('pose', {}).get(pose)
    if po:                                       # full per-pose override (own scale)
        g = dict(eyeY=float(po['eyeY']), chin=float(po['chin']), cx=po.get('cx', acx))
    elif 'eyeY' in f:                            # reuse the measured idle head
        g = dict(eyeY=float(f['eyeY']), chin=float(f['chin']), cx=f.get('cx', acx))
    else:                                        # un-tuned slug: alpha-bbox estimate
        face_h = (FEET - t2) * HEAD_K[slug]
        g = dict(eyeY=t2 + face_h * 0.55, chin=t2 + face_h, cx=acx)
    dx, dy = f.get('shift', {}).get(pose, (0, 0))
    g['eyeY'] += dy
    g['chin'] += dy
    g['cx'] += dx
    return g


def crop_face(slug, pose):
    path = os.path.join(SRC, slug, f'front_{pose}.png')
    if not os.path.exists(path) or pose in FACE.get(slug, {}).get('bad', ()):
        pose = 'idle'
        path = os.path.join(SRC, slug, 'front_idle.png')
    im = Image.open(path).convert('RGBA')
    g = geometry(slug, pose, im)
    s = (RIG_CHIN - RIG_EYE) / max(1.0, g['chin'] - g['eyeY'])   # rig px per sprite px
    side = S / s
    left = g['cx'] - side / 2
    top = g['eyeY'] - RIG_EYE / s
    tile = im.crop((round(left), round(top), round(left + side), round(top + side)))
    tile = tile.resize((S, S), Image.LANCZOS)
    # kill LANCZOS alpha fringe
    d = tile.load()
    for yy in range(S):
        for xx in range(S):
            r2, g2, b2, a2 = d[xx, yy]
            if a2 < 24:
                d[xx, yy] = (0, 0, 0, 0)
    return tile


def checker(w, h, s=8):
    im = Image.new('RGB', (w, h))
    p = im.load()
    for yy in range(h):
        for xx in range(w):
            p[xx, yy] = (150, 60, 150) if (xx // s + yy // s) % 2 else (60, 60, 70)
    return im


def main():
    which = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else 'all'
    slugs = SLUGS if which == 'all' else [which]
    tiles = {}
    for slug in slugs:
        os.makedirs(os.path.join(OUT, slug), exist_ok=True)
        for expr, pose in EXPR_POSE.items():
            tile = crop_face(slug, pose)
            tile.save(os.path.join(OUT, slug, f'{expr}.png'))
            tiles[(slug, expr)] = tile
        print(f'portraits <- sprites: {slug}')
    if '--audit' in sys.argv:
        exprs = list(EXPR_POSE)
        cell = S * 2 + 4
        im = checker(40 + cell * len(exprs), cell * len(slugs))
        for r2, slug in enumerate(slugs):
            for c2, expr in enumerate(exprs):
                t3 = tiles[(slug, expr)].resize((S * 2, S * 2), Image.NEAREST)
                im.paste(t3, (42 + c2 * cell, 2 + r2 * cell), t3)
        im.save(os.path.join(HERE, '_portrait_audit.png'))
        print('audit -> tools/_portrait_audit.png  (rows: ' + ', '.join(slugs) + ')')


if __name__ == '__main__':
    main()
