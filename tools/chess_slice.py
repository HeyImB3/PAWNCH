# One-off asset tool: slice "CHESS PIECES MK2.jpg" into 12 transparent piece
# PNGs + a manifest.json that the game's assets.js auto-loads.
#
#   python tools/chess_slice.py          # generate sprites + manifest + QA montage
#   python tools/chess_slice.py --probe  # just overlay the detected cell grid
#
# Method: both rows sit on a LIGHT background (the black pieces only look dark
# because of their purple aura). So per cell we flood-fill the bright background
# inward from the border, keep the largest remaining blob (which drops the
# floating sparkles/speckles), feather the edge, then bottom-align every piece
# on one shared canvas so relative sizes + baselines stay correct in-game.
import sys, os, json
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

SRC = os.path.join('assets', 'sprites', 'CHESS PIECES MK2.jpg')
OUT = os.path.join('assets', 'sprites')
TYPES = ['p', 'n', 'b', 'r', 'q', 'k']  # column order: pawn knight bishop rook queen king

LEFT, RIGHT = 0.018, 0.986
ROWS = [('w', 0.225, 0.49), ('b', 0.585, 0.95)]
INSET = 0.07            # trim the cell frame before processing
LIGHT_T = 178           # min-channel above this = background (light) pixel
FILES = {}

def cell_box(W, H, top, bot, i):
    x0 = int((LEFT + (RIGHT - LEFT) * i / 6) * W)
    x1 = int((LEFT + (RIGHT - LEFT) * (i + 1) / 6) * W)
    return (x0, int(top * H), x1, int(bot * H))

def inset(box):
    x0, y0, x1, y1 = box
    dx, dy = int((x1 - x0) * INSET), int((y1 - y0) * INSET)
    return (x0 + dx, y0 + dy, x1 - dx, y1 - dy)

def is_light(p):
    return min(p[0], p[1], p[2]) >= LIGHT_T

def knockout(cell):
    """Return an RGBA image of just the piece (background transparent)."""
    cell = cell.convert('RGB')
    W, H = cell.size
    px = cell.load()
    bg = bytearray(W * H)            # 1 = background (bright, border-connected)
    dq = deque()
    def seed(x, y):
        i = y * W + x
        if not bg[i] and is_light(px[x, y]): bg[i] = 1; dq.append((x, y))
    for x in range(W): seed(x, 0); seed(x, H - 1)
    for y in range(H): seed(0, y); seed(W - 1, y)
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < W and 0 <= ny < H:
                i = ny * W + nx
                if not bg[i] and is_light(px[nx, ny]): bg[i] = 1; dq.append((nx, ny))
    # foreground = everything not flooded; keep only the largest blob
    seen = bytearray(W * H)
    best, best_n = [], 0
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
    alpha = Image.new('L', (W, H), 0)
    ap = alpha.load()
    for (x, y) in best: ap[x, y] = 255
    alpha = alpha.filter(ImageFilter.MinFilter(3))      # erode 1px: kill JPEG halo
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8)) # feather
    out = cell.convert('RGBA'); out.putalpha(alpha)
    return out.crop(alpha.getbbox())

def run():
    im = Image.open(SRC)
    W, H = im.size
    pieces = {}
    for (row, top, bot) in ROWS:
        for i, t in enumerate(TYPES):
            key = row + t
            pieces[key] = knockout(im.crop(inset(cell_box(W, H, top, bot, i))))
    # shared canvas: bottom-align every piece so bases + relative heights match
    pad = 12
    cw = max(p.width for p in pieces.values()) + pad * 2
    ch = max(p.height for p in pieces.values()) + pad * 2
    montage = Image.new('RGBA', (cw * 6, ch * 2))
    mdraw = ImageDraw.Draw(montage)
    for r, (row, _, _) in enumerate(ROWS):
        for i, t in enumerate(TYPES):
            key = row + t
            p = pieces[key]
            canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
            canvas.paste(p, ((cw - p.width) // 2, ch - p.height - pad), p)
            fn = key + '.png'
            canvas.save(os.path.join(OUT, fn)); FILES[key] = fn
            # QA montage on a checkerboard to expose transparency
            tile = Image.new('RGBA', (cw, ch))
            for yy in range(0, ch, 16):
                for xx in range(0, cw, 16):
                    c = 90 if ((xx // 16 + yy // 16) % 2) else 140
                    mdraw_tile = ImageDraw.Draw(tile); mdraw_tile.rectangle([xx, yy, xx+15, yy+15], fill=(c, c, c, 255))
            tile.alpha_composite(canvas)
            montage.paste(tile, (i * cw, r * ch))
    manifest = {"pieces": FILES}
    with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    montage.thumbnail((1000, 1000))
    montage.convert('RGB').save(os.path.join('tools', '_pieces_montage.png'))
    print('wrote 12 sprites + manifest.json; QA -> tools/_pieces_montage.png')

def probe():
    im = Image.open(SRC).convert('RGB'); W, H = im.size
    d = ImageDraw.Draw(im)
    for (row, top, bot) in ROWS:
        for i in range(6):
            d.rectangle(inset(cell_box(W, H, top, bot, i)), outline=(255, 0, 0), width=6)
    im.thumbnail((900, 900)); im.save(os.path.join('tools', '_slice_probe.png')); print('probe written')

if __name__ == '__main__':
    (probe if '--probe' in sys.argv else run)()
