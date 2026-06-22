#!/usr/bin/env python3
# Slice a fighter's per-pose raw images into normalized game frames.
#
# Reads assets/sprites/_src/<slug>/<pose>.png, knocks out the white background
# (flood-fill from the borders, keep the largest blob, feather), then places each
# body on a 150x216 canvas with the feet on row 190 and the body centered on
# column 75 -- identical geometry to src/fighter.js (IW/IH/CX/FEET) so the game
# blits it with no per-frame jitter. Per-pose height is set by POSE_H so all
# frames share one body scale. Also writes a checkerboard QA montage.
#
#   tools/.venv/bin/python tools/slice_boxer.py pawnchion
import sys, os
from collections import deque
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fighter_prompts import POSE_ORDER
from PIL import Image, ImageFilter

# Target canvas geometry -- MUST match src/fighter.js IW, IH, CX, FEET.
CW, CH, CX, FEET = 150, 216, 75, 190
TARGET_BODY_H = 150     # a standing fighter's body height in px on the canvas
WHITE_T = 196           # min(r,g,b) >= this AND low saturation => background
SAT_T = 0.18            # saturation >= this => keep (colored body even if light)
# Expected bbox height as a fraction of a standing fighter (tune from the montage).
POSE_H = {p: 1.0 for p in POSE_ORDER}
POSE_H.update({"special": 1.22, "duck": 0.80, "down": 0.42})

def knockout(im):
    """RGBA of just the body: flood the near-white background to transparent from
    the borders, keep the largest connected blob, feather, tight-crop."""
    im = im.convert("RGB"); W, H = im.size; px = im.load()
    bg = bytearray(W * H); dq = deque()
    def soft(x, y):
        r, g, b = px[x, y]; mn, mx = min(r, g, b), max(r, g, b)
        sat = 0 if mx == 0 else (mx - mn) / mx
        return mn >= WHITE_T and sat < SAT_T
    def seed(x, y):
        i = y * W + x
        if not bg[i] and soft(x, y): bg[i] = 1; dq.append((x, y))
    for x in range(W): seed(x, 0); seed(x, H - 1)
    for y in range(H): seed(0, y); seed(W - 1, y)
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < W and 0 <= ny < H:
                i = ny * W + nx
                if not bg[i] and soft(nx, ny): bg[i] = 1; dq.append((nx, ny))
    seen = bytearray(W * H); best, best_n = [], 0
    for sy in range(H):
        for sx in range(W):
            i0 = sy * W + sx
            if bg[i0] or seen[i0]: continue
            comp, st, seen[i0] = [], [(sx, sy)], 1
            while st:
                x, y = st.pop(); comp.append((x, y))
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0 <= nx < W and 0 <= ny < H:
                        j = ny * W + nx
                        if not bg[j] and not seen[j]: seen[j] = 1; st.append((nx, ny))
            if len(comp) > best_n: best, best_n = comp, len(comp)
    alpha = Image.new("L", (W, H), 0); ap = alpha.load()
    for (x, y) in best: ap[x, y] = 255
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    out = im.convert("RGBA"); out.putalpha(alpha)
    bb = alpha.getbbox()
    return out.crop(bb) if bb else out

def place(body, pose):
    w, h = body.size
    scale = (TARGET_BODY_H * POSE_H.get(pose, 1.0)) / h
    if pose == "down":                       # wide/short: clamp by width
        scale = min(scale, (CW * 0.95) / w)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    body = body.resize((nw, nh), Image.NEAREST)
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    canvas.alpha_composite(body, (CX - nw // 2, FEET - nh))
    return canvas

def run(slug):
    raw = os.path.join("assets", "sprites", "_src", slug)
    out_dir = os.path.join("assets", "sprites", "boxers", slug)
    os.makedirs(out_dir, exist_ok=True)
    tiles = []
    for pose in POSE_ORDER:
        src = os.path.join(raw, pose + ".png")
        if not os.path.exists(src):
            print("MISSING", src); continue
        body = knockout(Image.open(src))
        frame = place(body, pose)
        frame.save(os.path.join(out_dir, "front_%s.png" % pose))
        tiles.append((pose, frame))
        print("front_%s.png (%dx%d, body %dpx)" % (pose, frame.size[0], frame.size[1], body.size[1]))
    cols = 7; rows = (len(tiles) + cols - 1) // cols
    mont = Image.new("RGBA", (CW * cols, CH * rows), (0, 0, 0, 0))
    for i, (pose, f) in enumerate(tiles):
        bg = Image.new("RGBA", (CW, CH)); bp = bg.load()
        for yy in range(CH):
            for xx in range(CW):
                v = 70 if ((xx // 12 + yy // 12) % 2) else 120
                bp[xx, yy] = (v, v, v, 255)
        bg.alpha_composite(f)
        mont.paste(bg, ((i % cols) * CW, (i // cols) * CH))
    mont.save(os.path.join("tools", "_%s_montage.png" % slug))
    print("wrote %d frames + tools/_%s_montage.png" % (len(tiles), slug))

if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "pawnchion")
