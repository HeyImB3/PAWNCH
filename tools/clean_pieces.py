#!/usr/bin/env python3
"""One-shot cleanup for the hand-drawn chess sprites in assets/sprites/.

The exported PNGs are contaminated: the black pieces carry a baked-in (opaque)
purple aura plus stray "shelf rod" / grid-line junk from the source sheet, and
all 12 sit on a big transparent canvas with lots of margin. The in-game renderer
scales pieces by IMAGE HEIGHT, so we must crop every piece with ONE common box
to keep their relative heights (a pawn shorter than a queen).

Pipeline per sprite:
  1. Build a "piece body" mask = opaque pixels that are clearly the piece
     (very dark, OR low-green magenta/pink highlights). The baked aura is a
     lighter purple with a substantial green channel, so it's excluded.
  2. Keep the largest connected body blob (drops far-flung junk).
  3. Dilate the body mask a little and keep only original pixels inside it.
     This preserves interior pixels (no holes) while erasing the surrounding
     aura halo and the rods/grid that live out in the margins.
  4. Tight-crop each piece to its OWN content (+ a small symmetric margin), so
     every PNG is just that piece centered. The source draws black pieces
     taller than white and with inconsistent per-piece heights, so we do NOT
     trust source heights: the renderer rescales each sprite to a per-type
     target height (white king == black king on the board). Tight crops give
     the renderer a clean content box to work from.

White pieces are already clean silhouettes, so step 1's mask is essentially
"all opaque pixels" for them and the result is just a tidy crop.

Outputs to assets/sprites/_clean/ for inspection; nothing is overwritten here.
"""
import os, glob
from collections import deque
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')
OUT = os.path.join(SRC, '_clean')
os.makedirs(OUT, exist_ok=True)

KEYS = ['wp','wn','wb','wr','wq','wk','bp','bn','bb','br','bq','bk']
ALPHA = 40           # opaque-ish threshold
DILATE = 7           # px to grow the body mask before keeping pixels
MARGIN = 6           # transparent margin around the final common crop


def body_mask(im):
    """Return a bytearray mask of 'definitely piece body' pixels."""
    W, H = im.size
    px = im.load()
    m = bytearray(W * H)
    white = True  # decided by caller via filename; here treat generically
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < ALPHA:
                continue
            mx = max(r, g, b)
            # dark body / outline, OR saturated magenta highlight (low green).
            # the baked aura is lighter purple with green >= ~70, so excluded.
            if mx < 90 or g < 70:
                m[y * W + x] = 1
    return m, W, H


def white_mask(im):
    """White pieces are clean; keep every opaque pixel."""
    W, H = im.size
    px = im.load()
    m = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            if px[x, y][3] >= ALPHA:
                m[y * W + x] = 1
    return m, W, H


def largest_blob(mask, W, H):
    seen = bytearray(W * H)
    best = None; best_n = 0
    for s in range(W * H):
        if mask[s] and not seen[s]:
            q = deque([s]); seen[s] = 1; cnt = 0; cells = []
            while q:
                j = q.popleft(); cnt += 1; cells.append(j)
                x = j % W; y = j // W
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                    nx, ny = x+dx, y+dy
                    if 0 <= nx < W and 0 <= ny < H:
                        k = ny*W+nx
                        if mask[k] and not seen[k]:
                            seen[k] = 1; q.append(k)
            if cnt > best_n:
                best_n = cnt; best = cells
    out = bytearray(W * H)
    if best:
        for j in best:
            out[j] = 1
    return out


def dilate(mask, W, H, r):
    out = bytearray(mask)
    for _ in range(r):
        cur = bytearray(out)
        for y in range(H):
            row = y * W
            for x in range(W):
                if cur[row + x]:
                    continue
                if (x and cur[row+x-1]) or (x+1<W and cur[row+x+1]) or \
                   (y and cur[row-W+x]) or (y+1<H and cur[row+W+x]):
                    out[row + x] = 1
    return out


def bbox(mask, W, H):
    minx=W; miny=H; maxx=0; maxy=0; any_=False
    for y in range(H):
        row=y*W
        for x in range(W):
            if mask[row+x]:
                any_=True
                if x<minx:minx=x
                if x>maxx:maxx=x
                if y<miny:miny=y
                if y>maxy:maxy=y
    return (minx,miny,maxx,maxy) if any_ else None


for key in KEYS:
    im = Image.open(os.path.join(SRC, key + '.png')).convert('RGBA')
    W, H = im.size
    if key[0] == 'w':
        m, _, _ = white_mask(im)
    else:
        m, _, _ = body_mask(im)
    m = largest_blob(m, W, H)
    keep = dilate(m, W, H, DILATE)
    # erase everything outside the kept region
    src = im.load()
    out = Image.new('RGBA', (W, H), (0,0,0,0))
    op = out.load()
    for y in range(H):
        row=y*W
        for x in range(W):
            if keep[row+x]:
                op[x, y] = src[x, y]
    bb = bbox(keep, W, H)
    # tight per-piece crop with a small symmetric margin (piece stays centered)
    x0=max(0,bb[0]-MARGIN); y0=max(0,bb[1]-MARGIN)
    x1=min(W,bb[2]+MARGIN+1); y1=min(H,bb[3]+MARGIN+1)
    crop = out.crop((x0,y0,x1,y1))
    crop.save(os.path.join(OUT, key + '.png'))
    print(f'{key}: content {bb[2]-bb[0]+1}x{bb[3]-bb[1]+1}  -> crop {crop.size[0]}x{crop.size[1]}')
print('wrote 12 cleaned sprites to', OUT)
