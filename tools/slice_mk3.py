# One-off asset tool: slice the MK3 showcase sheet ("PREMIUM 16-BIT CHESS
# SPRITES — GALAXY & STAR EDITION") into the 12 transparent CELESTIAL piece PNGs
# the game loads (assets/sprites/celestial/wp.png .. bk.png).
#
#   python tools/slice_mk3.py           # write the 12 sprites + a QA montage
#   python tools/slice_mk3.py --probe   # just dump detected boxes onto a thumbnail
#
# The sheet sits on a near-WHITE background with two rows of 6 pieces:
#   top row    = ORANGE "star/sun" pieces -> the WHITE side  (wp..wk)
#   bottom row = BLUE "galaxy" pieces      -> the DARK side   (bp..bk)
# plus a title + a left-aligned label above each row (excluded by row/col
# detection). Per piece we flood-fill the white background inward from the cell
# border (keeping the piece + the colored part of its baked glow), keep the
# largest blob (drops detached floating sparkles), feather the edge, and
# tight-crop. The in-game renderer rescales each sprite to a per-type target
# HEIGHT (PIECE_TYPE_H in gfx.js), so tight per-piece crops are exactly right.
import sys, os
from collections import deque
from PIL import Image, ImageFilter

SRC = os.path.join('assets', 'sprites', 'MK3.png')
OUT = os.path.join('assets', 'sprites', 'celestial')
TYPES = ['p', 'n', 'b', 'r', 'q', 'k']   # column order: pawn knight bishop rook queen king
ROW_COLOR = ['w', 'b']                    # row 0 = orange/white side, row 1 = blue/dark side

F = 4              # downscale factor for fast band detection
LIGHT_T = 180      # min(r,g,b) >= this => background (white) pixel
NOTWHITE = 170     # min(r,g,b) <  this => "content" (for band detection)
PADX = 26          # horizontal margin around a detected piece column
PADY = 18          # vertical margin around a piece row (clamped off the labels)
MINW = 120         # a real piece column is at least this wide (drops sparkle specks)


def bands(proj, thr, minlen):
    out = []; inb = False; s = 0
    for i, v in enumerate(proj):
        if v > thr and not inb:
            inb = True; s = i
        elif v <= thr and inb:
            inb = False
            if i - s >= minlen: out.append((s, i - 1))
    if inb and len(proj) - s >= minlen:
        out.append((s, len(proj) - 1))
    return out


def detect(im):
    """Return (rows, others): rows = list of (y0,y1,[(x0,x1)*6]) full-res."""
    W, H = im.size
    sm = im.resize((W // F, H // F)); w, h = sm.size
    sp = sm.load()
    def content(x, y):
        r, g, b = sp[x, y][:3]
        return min(r, g, b) < NOTWHITE
    rowp = [sum(1 for x in range(w) if content(x, y)) / w for y in range(h)]
    rbR = bands(rowp, 0.04, 4)
    # the two TALLEST bands are the piece rows; the rest are title/label text
    piece_rows = sorted(sorted(rbR, key=lambda be: be[1] - be[0], reverse=True)[:2])
    others = [b for b in rbR if b not in piece_rows]
    rows = []
    for (s, e) in piece_rows:
        colp = [sum(1 for y in range(s, e + 1) if content(x, y)) / (e - s + 1) for x in range(w)]
        cb = [c for c in bands(colp, 0.06, 3) if (c[1] - c[0]) * F >= MINW]
        cols = [(cs * F, ce * F) for (cs, ce) in cb]
        rows.append((s * F, e * F, cols, [b[1] * F for b in others if b[1] < s]))
    return rows, others


def knockout(cell):
    """RGBA of just the piece: white background -> transparent, largest blob."""
    cell = cell.convert('RGB'); W, H = cell.size; px = cell.load()
    bg = bytearray(W * H); dq = deque()
    def light(x, y):
        r, g, b = px[x, y]; return min(r, g, b) >= LIGHT_T
    def seed(x, y):
        i = y * W + x
        if not bg[i] and light(x, y): bg[i] = 1; dq.append((x, y))
    for x in range(W): seed(x, 0); seed(x, H - 1)
    for y in range(H): seed(0, y); seed(W - 1, y)
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < W and 0 <= ny < H:
                i = ny * W + nx
                if not bg[i] and light(nx, ny): bg[i] = 1; dq.append((nx, ny))
    # foreground = not background-flooded; keep the largest connected blob
    seen = bytearray(W * H); best, best_n = [], 0
    for sy in range(H):
        for sx in range(W):
            i0 = sy * W + sx
            if bg[i0] or seen[i0]: continue
            comp, stack, seen[i0] = [], [(sx, sy)], 1
            while stack:
                x, y = stack.pop(); comp.append((x, y))
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0 <= nx < W and 0 <= ny < H:
                        j = ny * W + nx
                        if not bg[j] and not seen[j]: seen[j] = 1; stack.append((nx, ny))
            if len(comp) > best_n: best, best_n = comp, len(comp)
    alpha = Image.new('L', (W, H), 0); ap = alpha.load()
    for (x, y) in best: ap[x, y] = 255
    # No dilate: the white background was already flood-removed, so every kept
    # pixel is colored (piece/glow) — growing the mask would only re-introduce a
    # white rim. A light blur just feathers the binary edge.
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8))
    out = cell.convert('RGBA'); out.putalpha(alpha)
    bb = alpha.getbbox()
    return out.crop(bb) if bb else out


def run(probe=False):
    im = Image.open(SRC).convert('RGB'); W, H = im.size
    rows, others = detect(im)
    if probe:
        from PIL import ImageDraw
        d = ImageDraw.Draw(im)
        for (y0, y1, cols, labels) in rows:
            top = max(max(labels) + 6 if labels else 0, y0 - PADY)
            for (x0, x1) in cols:
                d.rectangle([max(0, x0 - PADX), top, min(W, x1 + PADX), min(H, y1 + PADY)], outline=(255, 0, 0), width=6)
        th = im.copy(); th.thumbnail((1100, 1100)); th.save(os.path.join('tools', '_mk3_probe.png'))
        print('probe -> tools/_mk3_probe.png'); return
    os.makedirs(OUT, exist_ok=True)
    full = Image.open(SRC).convert('RGB')
    tiles = []
    for ri, (y0, y1, cols, labels) in enumerate(rows):
        floor = max(labels) + 6 if labels else 0          # never cross the label above
        top = max(floor, y0 - PADY); bot = min(H, y1 + PADY)
        if len(cols) != 6:
            print('WARN row %d: found %d columns (expected 6)' % (ri, len(cols)))
        for ci, (x0, x1) in enumerate(cols[:6]):
            box = (max(0, x0 - PADX), top, min(W, x1 + PADX), bot)
            piece = knockout(full.crop(box))
            key = ROW_COLOR[ri] + TYPES[ci]
            piece.save(os.path.join(OUT, key + '.png'))
            print('%s -> %s  (%dx%d)' % (key, key + '.png', piece.size[0], piece.size[1]))
            tiles.append((key, piece))
    # QA montage on a checkerboard so transparency is obvious
    cw = max(p.width for _, p in tiles) + 16
    ch = max(p.height for _, p in tiles) + 16
    mont = Image.new('RGBA', (cw * 6, ch * 2), (0, 0, 0, 0))
    for idx, (key, p) in enumerate(tiles):
        r, c = idx // 6, idx % 6
        tile = Image.new('RGBA', (cw, ch))
        tp = tile.load()
        for yy in range(ch):
            for xx in range(cw):
                v = 70 if ((xx // 16 + yy // 16) % 2) else 120
                tp[xx, yy] = (v, v, v, 255)
        tile.alpha_composite(p, ((cw - p.width) // 2, ch - p.height - 8))
        mont.paste(tile, (c * cw, r * ch))
    mont.thumbnail((1200, 1200)); mont.convert('RGB').save(os.path.join('tools', '_mk3_montage.png'))
    print('wrote 12 sprites to', OUT, '+ QA montage tools/_mk3_montage.png')


if __name__ == '__main__':
    run(probe='--probe' in sys.argv)
