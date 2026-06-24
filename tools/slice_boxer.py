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
POSE_H.update({"special": 1.22, "duck": 0.80, "down": 0.60})
# Per-fighter standing body height (px on the 216-tall canvas) so silhouettes differ
# in-game: Patty is a pudgeball, Bishop towers, Iron is a monster. Default TARGET_BODY_H.
BODY_H = {
    "patty": 112, "gus": 150, "rosa": 150, "kid": 146, "bishop": 182,
    "queen": 164, "iron": 186, "tal": 150, "magnus": 156, "pawnchion": 172,
}

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
    # Remove ENCLOSED background pockets: soft (white) regions the border flood
    # couldn't reach. The tricky part: the gap trapped between raised arms IS
    # background (drop it), but white CLOTHING (trunks, boots, trim) and the white
    # eye-shine are also enclosed white -- and must be KEPT. Size alone can't tell
    # them apart, so a large pocket is only dropped when it looks like trapped
    # background: bright/uniform white AND bordered by body (not dark). Shaded
    # white (clothing has folds) and dark-bordered white (eye-shine) are kept.
    ENCLOSED_MIN = 24
    BRIGHT = 244            # min(r,g,b) >= this == pure bright (background-like)
    pseen = bytearray(W * H)
    for sy in range(H):
        for sx in range(W):
            i0 = sy * W + sx
            if bg[i0] or pseen[i0] or not soft(sx, sy): continue
            comp, st, pseen[i0] = [(sx, sy)], [(sx, sy)], 1
            while st:
                x, y = st.pop()
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0 <= nx < W and 0 <= ny < H:
                        j = ny * W + nx
                        if not bg[j] and not pseen[j] and soft(nx, ny):
                            pseen[j] = 1; st.append((nx, ny)); comp.append((nx, ny))
            if len(comp) < ENCLOSED_MIN:
                continue                                  # glints/teeth/specks -> keep
            # Trapped background is PURE/uniform bright white; clothing is SHADED
            # (folds, off-white, darker tones). Drop only the pure ones. (Border
            # darkness is NOT used: a bg gap between dark-robed arms is dark-bordered
            # too -- and real eye-shine is always small, so it's size-exempt above.)
            bright = sum(1 for (x, y) in comp if min(px[x, y]) >= BRIGHT)
            if bright / len(comp) >= 0.90:                # pure white -> trapped bg -> drop
                for (x, y) in comp: bg[y * W + x] = 1
            # else: shaded -> clothing/detail -> KEEP
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

def place(body, pose, body_h=TARGET_BODY_H):
    w, h = body.size
    scale = (body_h * POSE_H.get(pose, 1.0)) / h
    scale = min(scale, (CW * 0.98) / w)      # never wider than the canvas (wide fighters fit)
    if pose == "down":
        scale = min(scale, (CW * 0.95) / w)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    if nh > CH - 2:                          # never taller than the canvas
        scale *= (CH - 2) / nh
        nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    body = body.resize((nw, nh), Image.LANCZOS)
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
        frame = place(body, pose, BODY_H.get(slug, TARGET_BODY_H))
        frame.save(os.path.join(out_dir, "front_%s.png" % pose))
        tiles.append((pose, frame))
        print("front_%s.png (%dx%d, body %dpx)" % (pose, frame.size[0], frame.size[1], body.size[1]))
    _montage(tiles, slug)
    print("wrote %d frames + tools/_%s_montage.png" % (len(tiles), slug))


def _montage(tiles, slug):
    cols = 7; rows = (len(tiles) + cols - 1) // cols
    mont = Image.new("RGBA", (CW * cols, CH * rows), (0, 0, 0, 0))
    for i, (key, f) in enumerate(tiles):
        bg = Image.new("RGBA", (CW, CH)); bp = bg.load()
        for yy in range(CH):
            for xx in range(CW):
                v = 70 if ((xx // 12 + yy // 12) % 2) else 120
                bp[xx, yy] = (v, v, v, 255)
        bg.alpha_composite(f)
        mont.paste(bg, ((i % cols) * CW, (i // cols) * CH))
    mont.save(os.path.join("tools", "_%s_montage.png" % slug))


def run_player(slug="player"):
    """Slice the player's facing-prefixed raws (back_<pose>.png / front_<pose>.png)."""
    raw = os.path.join("assets", "sprites", "_src", slug)
    out_dir = os.path.join("assets", "sprites", "boxers", slug)
    os.makedirs(out_dir, exist_ok=True)
    keys = sorted(os.path.splitext(f)[0] for f in os.listdir(raw)
                  if f.endswith(".png") and not f.startswith("_"))
    tiles = []
    for key in keys:
        pose = key.split("_", 1)[1] if "_" in key else key   # 'back_jabL' -> 'jabL'
        body = knockout(Image.open(os.path.join(raw, key + ".png")))
        frame = place(body, pose, BODY_H.get(slug, TARGET_BODY_H))
        frame.save(os.path.join(out_dir, key + ".png"))
        tiles.append((key, frame))
        print("%s.png (%dx%d, body %dpx)" % (key, frame.size[0], frame.size[1], body.size[1]))
    _montage(tiles, slug)
    print("wrote %d frames + tools/_%s_montage.png" % (len(tiles), slug))

if __name__ == "__main__":
    slug = sys.argv[1] if len(sys.argv) > 1 else "pawnchion"
    (run_player if slug == "player" else run)(slug)
