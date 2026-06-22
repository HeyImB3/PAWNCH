# Fighter Art Overhaul — Phase 1 (THE PAWNCHION) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace THE PAWNCHION's procedural mannequin with authored Gemini-generated sprite frames, blitted through the existing `drawFighter()` chokepoint with the procedural renderer preserved as the zero-asset fallback.

**Architecture:** A per-fighter `boxerSets` sprite registry (mirroring the existing chess `pieceSets`). Python tools call the Gemini image API to make one consistent pose-sheet, slice it into per-pose PNGs normalized to the procedural canvas geometry (so blitting is a drop-in), and the engine prefers a registered sprite per `(facing, pose)` else falls back to `render()`.

**Tech Stack:** Vanilla ES-module JS + Canvas2D (game, no build step); Python 3.9 + Pillow + stdlib `urllib` (dev-only sprite tools); Gemini image API (`gemini-2.5-flash-image` / `gemini-3-pro-image`).

**Verification model:** No automated test suite (CLAUDE.md). Verify by (a) running each Python tool and **viewing its output PNG/montage**, (b) a new `tools/fighter-preview.html` harness that renders every pose, and (c) the live game (`npm run dev`, console clean, `window.PAWNCH`). "Expected" in each step describes what you should see.

**Canonical naming (used across all tasks — do not drift):**
- Set slug: `pawnchion`
- Registry key: `` `${facing===-1?'back':'front'}:${spriteKey}` `` → e.g. `front:idle`
- File name: `front_idle.png` inside dir `assets/sprites/boxers/pawnchion/`
- `BOXER_POSE_KEYS` (grid reading order): `idle, guard, windupL, windupR, jabL, jabR, hookL, hookR, special, duck, hurt, stagger, down, walk`
- Sprite canvas = the procedural canvas: **150×216**, center column **75**, feet row **190** (mirrors `IW/IH/CX/FEET` in `src/fighter.js`).

---

## File Structure

**Create:**
- `tools/gemini_image.py` — minimal Gemini image-gen REST client (stdlib only).
- `tools/fighter_prompts.py` — art-direction prompts + pose order (the Pawnchion).
- `tools/gen_fighter.py` — orchestrates: prompt → Gemini → raw sheet on disk.
- `tools/slice_boxer.py` — slice a pose-sheet into normalized per-pose PNGs + QA montage.
- `tools/fighter-preview.html` — browser harness rendering all poses (QA).
- `assets/sprites/_src/pawnchion.png` — the raw generated sheet (committed, like `MK3.png`).
- `assets/sprites/boxers/pawnchion/front_*.png` — the 14 sliced frames.

**Modify:**
- `.gitignore` — ignore `tools/.venv/`.
- `src/gfx.js` — add `boxerSets` registry + `registerBoxer` + `boxerSprite`.
- `src/assets.js` — load `manifest.boxerSets`.
- `assets/sprites/manifest.json` — add the `boxerSets` entry.
- `src/fighter.js` — `drawFighter` prefers a registered sprite; add `boxerKey()` resolver.
- `src/opponents.js` — add `sprite` slug to the Pawnchion look (+ `HERO_LOOK`).

---

## Task 1: Dev tooling (Python venv)

**Files:**
- Modify: `.gitignore`
- Create: `tools/.venv/` (not committed)

- [ ] **Step 1: Create the venv and install deps**

```bash
cd /Users/ssmolak/Desktop/PAWNCH
python3 -m venv tools/.venv
tools/.venv/bin/pip install --quiet --upgrade pip Pillow
```

- [ ] **Step 2: Verify Pillow imports**

Run:
```bash
tools/.venv/bin/python -c "import PIL, urllib.request, json, base64; print('PIL', PIL.__version__)"
```
Expected: prints `PIL 10.x` (or similar). No ImportError.

- [ ] **Step 3: Ignore the venv**

Add to `.gitignore` (under the existing `# Local env` block):
```
# Python sprite-tool venv
tools/.venv/
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore(tools): add Python venv for sprite tooling, gitignore it"
```

---

## Task 2: Gemini image client

**Files:**
- Create: `tools/gemini_image.py`

- [ ] **Step 1: Write the client**

```python
#!/usr/bin/env python3
# Minimal Gemini image-generation client (REST, stdlib only).
# Reads GEMINI_API_KEY from the environment or the repo .env.
#
#   tools/.venv/bin/python tools/gemini_image.py "a red boxing glove, 16-bit pixel art" out.png
#   ... --model gemini-3-pro-image --ref reference.png
import sys, os, json, base64, urllib.request, urllib.error

API = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODEL = "gemini-2.5-flash-image"

def load_key():
    k = os.environ.get("GEMINI_API_KEY")
    if k:
        return k
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = os.path.join(root, ".env")
    if os.path.exists(env):
        for line in open(env):
            line = line.strip()
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("GEMINI_API_KEY not found (env or .env)")

def generate(prompt, out_path, model=DEFAULT_MODEL, refs=None):
    key = load_key()
    parts = [{"text": prompt}]
    for r in (refs or []):
        with open(r, "rb") as f:
            parts.append({"inlineData": {"mimeType": "image/png",
                          "data": base64.b64encode(f.read()).decode()}})
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["IMAGE"]}}
    url = f"{API}/{model}:generateContent?key={key}"
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=240)
    except urllib.error.HTTPError as e:
        # If a model rejects IMAGE-only, retry with TEXT+IMAGE.
        msg = e.read().decode()[:800]
        if e.code == 400 and "responseModalities" in msg:
            body["generationConfig"]["responseModalities"] = ["TEXT", "IMAGE"]
            req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=240)
        else:
            raise SystemExit(f"HTTP {e.code}: {msg}")
    data = json.loads(resp.read())
    for p in data["candidates"][0]["content"]["parts"]:
        if "inlineData" in p:
            png = base64.b64decode(p["inlineData"]["data"])
            with open(out_path, "wb") as f:
                f.write(png)
            print(f"wrote {out_path} ({len(png)} bytes) via {model}")
            return out_path
    raise SystemExit("no image part in response: " + json.dumps(data)[:800])

def _parse(argv):
    model, refs, rest = DEFAULT_MODEL, [], []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--model": model = argv[i + 1]; i += 2
        elif a == "--ref": refs.append(argv[i + 1]); i += 2
        else: rest.append(a); i += 1
    if len(rest) < 2:
        raise SystemExit("usage: gemini_image.py [--model M] [--ref img]... PROMPT OUT.png")
    return rest[0], rest[1], model, refs

if __name__ == "__main__":
    prompt, out, model, refs = _parse(sys.argv[1:])
    generate(prompt, out, model, refs)
```

- [ ] **Step 2: Smoke-test it (also confirms the IMAGE modality works on your key)**

Run:
```bash
cd /Users/ssmolak/Desktop/PAWNCH
tools/.venv/bin/python tools/gemini_image.py "a single red 16-bit pixel-art boxing glove on a plain white background, bold black outline" /tmp/glove_test.png
```
Expected: prints `wrote /tmp/glove_test.png (… bytes) via gemini-2.5-flash-image`.

- [ ] **Step 3: View the smoke-test output**

Open `/tmp/glove_test.png` (view it). Expected: a recognizable pixel-art glove. If you get an HTTP 400 about `responseModalities`, the client already retries with `["TEXT","IMAGE"]`; if it still fails, switch `DEFAULT_MODEL` to `gemini-3-pro-image` and re-run.

- [ ] **Step 4: Commit**

```bash
git add tools/gemini_image.py
git commit -m "feat(tools): minimal Gemini image-gen REST client"
```

---

## Task 3: The Pawnchion prompt

**Files:**
- Create: `tools/fighter_prompts.py`

- [ ] **Step 1: Write the prompts module**

```python
# Art-direction prompts for fighter sprite sheets (see the design spec).
# POSE_ORDER MUST match slice_boxer's grid reading order.

POSE_ORDER = ["idle", "guard", "windupL", "windupR", "jabL", "jabR", "hookL",
              "hookR", "special", "duck", "hurt", "stagger", "down", "walk"]

STYLE = (
    "16-bit SNES-era boxing sprite in the style of classic Punch-Out, "
    "bold solid black outline, limited flat palette with only 2 to 3 shades per color, "
    "crisp pixel-art shading with NO gradients, NO anti-aliasing and NO blur, "
    "chunky exaggerated heavyweight proportions, strong readable silhouette, "
    "the full body from the top of the head down to the feet inside every cell, "
    "plain pure-white (#ffffff) background, no text, no labels, no drop shadow, "
    "each pose centered in its own cell."
)

GRID = (
    "Render as ONE sprite sheet: a clean even grid of 7 columns by 2 rows (14 cells), "
    "uniform cell size and spacing, the SAME identical character drawn in every cell, "
    "one pose per cell, in this exact reading order left-to-right then top-to-bottom: "
    "(1) standing idle, gloves up; (2) tight defensive guard, both gloves at the face; "
    "(3) winding up a LEFT punch with the left glove pulled back; "
    "(4) winding up a RIGHT punch with the right glove pulled back; "
    "(5) throwing a straight LEFT jab fully extended; "
    "(6) throwing a straight RIGHT jab fully extended; "
    "(7) throwing a LEFT hook; (8) throwing a RIGHT hook; "
    "(9) a huge signature wind-up, both arms loaded overhead for a boss finisher; "
    "(10) ducking low; (11) recoiling hurt with the head snapped back; "
    "(12) staggered and dazed, wobbling; (13) knocked down flat on the canvas; "
    "(14) walking forward. Keep the character's colors, costume and crown identical "
    "in all 14 cells."
)

FIGHTERS = {
    "pawnchion": (
        "THE PAWNCHION, the grand champion final boss of a chess-boxing game: a towering, "
        "intimidating heavyweight boxer-king. Bright orange boxing trunks and orange boxing "
        "gloves, royal-blue trim and championship belt, a fused golden chess-piece crown "
        "(an amalgam of king, queen and rook points) on his head, rook-tower armored "
        "pauldrons on both shoulders, a gold king-cross emblem on his chest, a confident "
        "menacing snarl and glinting eyes, warm tan skin. He must read as a genuine badass "
        "end boss, not a cute mascot."
    ),
}

def sheet_prompt(slug):
    return f"{FIGHTERS[slug]} {STYLE} {GRID}"
```

- [ ] **Step 2: Verify it composes**

Run:
```bash
tools/.venv/bin/python -c "from tools.fighter_prompts import sheet_prompt, POSE_ORDER; print(len(POSE_ORDER), 'poses'); print(sheet_prompt('pawnchion')[:120], '...')"
```
Expected: `14 poses` then the first 120 chars of the prompt. (If `tools` isn't importable, run from repo root or use `PYTHONPATH=.`.)

- [ ] **Step 3: Commit**

```bash
git add tools/fighter_prompts.py
git commit -m "feat(tools): Pawnchion sprite-sheet art-direction prompt"
```

---

## Task 4: Generate the Pawnchion sheet (curation gate)

**Files:**
- Create: `tools/gen_fighter.py`, `assets/sprites/_src/pawnchion.png`

- [ ] **Step 1: Write the generation orchestrator**

```python
#!/usr/bin/env python3
# Generate a fighter pose-sheet via Gemini and save the raw sheet to
# assets/sprites/_src/<slug>.png (committed, like MK3.png for the pieces).
#
#   tools/.venv/bin/python tools/gen_fighter.py pawnchion
#   ... --model gemini-3-pro-image
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fighter_prompts import sheet_prompt
from gemini_image import generate, DEFAULT_MODEL

def main(argv):
    model = DEFAULT_MODEL
    rest = []
    i = 0
    while i < len(argv):
        if argv[i] == "--model": model = argv[i + 1]; i += 2
        else: rest.append(argv[i]); i += 1
    if not rest:
        raise SystemExit("usage: gen_fighter.py SLUG [--model M]")
    slug = rest[0]
    out_dir = os.path.join("assets", "sprites", "_src")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, slug + ".png")
    generate(sheet_prompt(slug), out, model=model)
    print("sheet ->", out)

if __name__ == "__main__":
    main(sys.argv[1:])
```

- [ ] **Step 2: Generate the sheet**

Run:
```bash
cd /Users/ssmolak/Desktop/PAWNCH
tools/.venv/bin/python tools/gen_fighter.py pawnchion
```
Expected: writes `assets/sprites/_src/pawnchion.png`.

- [ ] **Step 3: View & curate (THIS IS THE ART-DIRECTOR GATE)**

Open `assets/sprites/_src/pawnchion.png` (view it). Check: 14 distinct poses on a 7×2 grid, ONE consistent character, white background, bold outline, badass champion read. **If it's not great, regenerate** — re-run Step 2 (each call re-rolls), and/or bake off models:
```bash
tools/.venv/bin/python tools/gen_fighter.py pawnchion --model gemini-3-pro-image
tools/.venv/bin/python tools/gen_fighter.py pawnchion --model imagen-4.0-ultra-generate-001
```
Iterate prompt wording in `tools/fighter_prompts.py` until the sheet clears the bar. **Get user sign-off on the chosen sheet before continuing.**

- [ ] **Step 4: Commit the chosen sheet + orchestrator**

```bash
git add tools/gen_fighter.py assets/sprites/_src/pawnchion.png
git commit -m "feat(art): generate THE PAWNCHION pose-sheet (Gemini)"
```

---

## Task 5: Slice the sheet into normalized frames

**Files:**
- Create: `tools/slice_boxer.py`
- Create: `assets/sprites/boxers/pawnchion/front_*.png` (output)

- [ ] **Step 1: Write the slicer**

```python
#!/usr/bin/env python3
# Slice a fighter pose-sheet into per-pose PNGs, normalized so the game can blit
# them through drawFighter() with no per-frame jitter.
#
# Approach: the sheet is an even ROWS x COLS grid (default 2 x 7). For each cell:
#   1) crop the cell, 2) flood-fill the white background to transparent from the
#   borders (keep the largest blob -> the fighter), 3) tight-crop to the body.
# Then ALL frames are placed on a common 150x216 canvas at a SINGLE shared scale
# (derived from the idle frame) with feet on row 190 and the body centered on
# column 75 -> identical geometry to src/fighter.js (IW/IH/CX/FEET).
#
#   tools/.venv/bin/python tools/slice_boxer.py pawnchion            # 2x7 grid
#   tools/.venv/bin/python tools/slice_boxer.py pawnchion --rows 2 --cols 7
import sys, os
from collections import deque
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fighter_prompts import POSE_ORDER
from PIL import Image, ImageFilter

# Target canvas geometry — MUST match src/fighter.js IW, IH, CX, FEET.
CW, CH, CX, FEET = 150, 216, 75, 190
TARGET_BODY_H = 150     # idle body height in px on the canvas (head..feet ~ rows 40..190)
WHITE_T = 196           # min(r,g,b) >= this AND low saturation => background
SAT_T = 0.18            # saturation >= this => keep (colored body even if light)

def knockout(cell):
    """RGBA of just the body: flood the near-white background to transparent from
    the borders, keep the largest connected blob, feather, tight-crop."""
    cell = cell.convert("RGB"); W, H = cell.size; px = cell.load()
    bg = bytearray(W * H); dq = deque()
    def soft(x, y):
        r, g, b = px[x, y]
        mn, mx = min(r, g, b), max(r, g, b)
        sat = 0 if mx == 0 else (mx - mn) / mx
        return mn >= WHITE_T and sat < SAT_T          # pale & unsaturated => background
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
    out = cell.convert("RGBA"); out.putalpha(alpha)
    bb = alpha.getbbox()
    return out.crop(bb) if bb else out

def place(body, scale):
    """Scale `body` by `scale`, paste on a CWxCH transparent canvas with feet on
    row FEET and horizontal center on column CX."""
    w, h = body.size
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    body = body.resize((nw, nh), Image.NEAREST)
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    x = CX - nw // 2
    y = FEET - nh
    canvas.alpha_composite(body, (max(0, x), max(0, y)))
    return canvas

def run(slug, rows, cols):
    src = os.path.join("assets", "sprites", "_src", slug + ".png")
    out_dir = os.path.join("assets", "sprites", "boxers", slug)
    os.makedirs(out_dir, exist_ok=True)
    sheet = Image.open(src).convert("RGB"); SW, SH = sheet.size
    cw, ch = SW // cols, SH // rows
    if rows * cols < len(POSE_ORDER):
        print("WARN grid %dx%d < %d poses" % (rows, cols, len(POSE_ORDER)))
    bodies = []
    for idx, key in enumerate(POSE_ORDER):
        r, c = idx // cols, idx % cols
        cell = sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        bodies.append((key, knockout(cell)))
    # shared scale from the idle frame so every frame uses the same proportions
    idle = dict(bodies)["idle"]
    scale = TARGET_BODY_H / idle.size[1]
    tiles = []
    for key, body in bodies:
        frame = place(body, scale)
        path = os.path.join(out_dir, "front_%s.png" % key)
        frame.save(path)
        tiles.append((key, frame))
        print("front_%s.png  (%dx%d)" % (key, frame.size[0], frame.size[1]))
    # QA montage on a checkerboard
    cols_m = 7
    rows_m = (len(tiles) + cols_m - 1) // cols_m
    mont = Image.new("RGBA", (CW * cols_m, CH * rows_m), (0, 0, 0, 0))
    for i, (key, f) in enumerate(tiles):
        bg = Image.new("RGBA", (CW, CH))
        bp = bg.load()
        for yy in range(CH):
            for xx in range(CW):
                v = 70 if ((xx // 12 + yy // 12) % 2) else 120
                bp[xx, yy] = (v, v, v, 255)
        bg.alpha_composite(f)
        mont.paste(bg, ((i % cols_m) * CW, (i // cols_m) * CH))
    mont.save(os.path.join("tools", "_%s_montage.png" % slug))
    print("wrote %d frames + tools/_%s_montage.png" % (len(tiles), slug))

if __name__ == "__main__":
    a = sys.argv[1:]
    slug = a[0] if a and not a[0].startswith("-") else "pawnchion"
    rows = int(a[a.index("--rows") + 1]) if "--rows" in a else 2
    cols = int(a[a.index("--cols") + 1]) if "--cols" in a else 7
    run(slug, rows, cols)
```

- [ ] **Step 2: Run the slicer**

Run:
```bash
cd /Users/ssmolak/Desktop/PAWNCH
tools/.venv/bin/python tools/slice_boxer.py pawnchion
```
Expected: prints 14 `front_<pose>.png (150x216)` lines + the montage path. No `WARN`.

- [ ] **Step 3: View the QA montage**

Open `tools/_pawnchion_montage.png` (view it). Expected: 14 clean cutouts on the checkerboard, backgrounds fully knocked out, all standing poses share a baseline/scale. **Tune if needed:** if backgrounds remain, lower `WHITE_T` / raise `SAT_T`; if the model didn't make an even grid, pass `--rows/--cols` or re-generate (Task 4) with a firmer grid instruction.

- [ ] **Step 4: Commit the frames + slicer**

```bash
git add tools/slice_boxer.py assets/sprites/boxers/pawnchion/
git commit -m "feat(art): slice THE PAWNCHION into 14 normalized sprite frames"
```

---

## Task 6: `boxerSets` registry in gfx.js

**Files:**
- Modify: `src/gfx.js:18-25`

- [ ] **Step 1: Add the registry, register fn, and accessor**

In `src/gfx.js`, change the registry declaration (currently line 18):
```js
const SPRITES = { boxers: {}, pieceSets: {} };
```
to:
```js
const SPRITES = { boxers: {}, boxerSets: {}, pieceSets: {} };
```
Then add these two exports next to `registerSprite` (after line 22):
```js
// Per-fighter boxer sprite sets (mirrors pieceSets). `set` is a fighter slug
// (e.g. 'pawnchion'); `key` is `${front|back}:${pose}` e.g. 'front:idle'.
export function registerBoxer(set, key, img) { (SPRITES.boxerSets[set] ||= {})[key] = img; }
export function boxerSprite(set, key) { return set ? (SPRITES.boxerSets[set] || {})[key] : undefined; }
```

- [ ] **Step 2: Verify it parses (no app behavior change yet)**

Run:
```bash
node --check src/gfx.js 2>/dev/null && echo "gfx.js OK" || echo "node --check unavailable; will verify in-browser at Task 11"
```
Expected: `gfx.js OK` (or the fallback message if Node isn't on PATH).

- [ ] **Step 3: Commit**

```bash
git add src/gfx.js
git commit -m "feat(gfx): per-fighter boxerSets sprite registry"
```

---

## Task 7: Load `boxerSets` from the manifest

**Files:**
- Modify: `src/assets.js:21`, `src/assets.js:34-62`
- Modify: `assets/sprites/manifest.json`

- [ ] **Step 1: Import `registerBoxer` and add the pose-key list**

In `src/assets.js`, change the import (line 21):
```js
import { registerSprite, registerPiece } from './gfx.js';
```
to:
```js
import { registerSprite, registerPiece, registerBoxer } from './gfx.js';
```
Then add, next to `PIECE_KEYS` (after line 23):
```js
const BOXER_POSE_KEYS = ['idle', 'guard', 'windupL', 'windupR', 'jabL', 'jabR',
  'hookL', 'hookR', 'special', 'duck', 'hurt', 'stagger', 'down', 'walk'];
const BOXER_FACINGS = ['front', 'back'];
```

- [ ] **Step 2: Load the sets inside `loadAssets`**

In `src/assets.js`, after the `pieceSets` loading block (the `await Promise.all(...manifest.pieceSets...)` ending at line 54), insert:
```js
  // boxer sets: slug -> sub-dir of `${facing}_${pose}.png` (any missing file stays procedural)
  await Promise.all(Object.entries(manifest.boxerSets || {}).map(([set, dir]) =>
    Promise.all(BOXER_FACINGS.flatMap((face) => BOXER_POSE_KEYS.map(async (pose) => {
      try { registerBoxer(set, `${face}:${pose}`, await loadImage(`${base}/${dir}/${face}_${pose}.png`)); count++; }
      catch { /* a set may supply only some poses/facings; that's fine */ }
    })))));
```

- [ ] **Step 3: Register the set in the manifest**

Replace `assets/sprites/manifest.json` contents with:
```json
{
  "pieceSets": {
    "celestial": "celestial",
    "arcane": "arcane"
  },
  "boxerSets": {
    "pawnchion": "boxers/pawnchion"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/assets.js assets/sprites/manifest.json
git commit -m "feat(assets): load per-fighter boxerSets from the manifest"
```

---

## Task 8: `drawFighter` prefers the sprite

**Files:**
- Modify: `src/fighter.js:5` (import), `src/fighter.js:316-323` (`drawFighter`)

- [ ] **Step 1: Import the accessor**

In `src/fighter.js`, change line 5:
```js
import { shade } from './gfx.js';
```
to:
```js
import { shade, boxerSprite } from './gfx.js';
```

- [ ] **Step 2: Add the pose→key resolver above `drawFighter`**

Insert this just before the `drawFighter` export (before line 319):
```js
// Map the engine's (facing,pose,info) to a boxer-set registry key.
// facing: 1=front (opponents), -1=back (player). info: {arm:'L'|'R', kind:'jab'|'hook'|'signature'}.
function boxerKey(facing, pose, info) {
  const side = facing === -1 ? 'back' : 'front';
  const arm = info?.arm === 'L' ? 'L' : 'R';
  let k;
  if (info?.kind === 'signature') k = 'special';
  else if (pose === 'windup') k = 'windup' + arm;
  else if (pose === 'punch') k = (info?.kind === 'hook' ? 'hook' : 'jab') + arm;
  else k = pose;                       // idle,guard,special,duck,hurt,stagger,down,walk
  return `${side}:${k}`;
}
```

- [ ] **Step 3: Prefer the sprite in `drawFighter`**

Replace the body of `drawFighter` (lines 319-323) with:
```js
export function drawFighter(ctx, x, y, size, look, pose='idle', facing=1, step=0, info=null){
  const dx = Math.round(x - CX*size), dy = Math.round(y - FEET*size);
  const dw = Math.round(IW*size), dh = Math.round(IH*size);
  const img = look?.sprite ? boxerSprite(look.sprite, boxerKey(facing, pose, info)) : null;
  if (img) { ctx.drawImage(img, dx, dy, dw, dh); return; }   // authored sprite (geometry matches IW/IH/CX/FEET)
  const { lined } = render(look, pose, step, facing, info);   // procedural fallback
  ctx.drawImage(lined, dx, dy, dw, dh);
}
```
(`drawPortrait` is unchanged — story-select busts stay procedural until Phase 4.)

- [ ] **Step 4: Verify it parses**

Run:
```bash
node --check src/fighter.js 2>/dev/null && echo "fighter.js OK" || echo "will verify in-browser at Task 11"
```
Expected: `fighter.js OK` (or fallback message).

- [ ] **Step 5: Commit**

```bash
git add src/fighter.js
git commit -m "feat(fighter): drawFighter prefers registered boxer sprite, else procedural"
```

---

## Task 9: Tag the Pawnchion look with its slug

**Files:**
- Modify: `src/opponents.js:152-153` (`HERO_LOOK`), `src/opponents.js:159-168` (`OPPONENTS` map)

- [ ] **Step 1: Add a per-fighter sprite slug to resolved looks**

In `src/opponents.js`, add a slug table after `LOOKS` (after line 149):
```js
// Fighter index -> boxer sprite-set slug (matches assets/sprites/boxers/<slug>).
// Only fighters with authored art need an entry; the rest stay procedural.
const SPRITE_SLUG = { 9: 'pawnchion' };
```
Then in the `OPPONENTS = ROSTER.map(...)` block, change the `look:` line (line 167):
```js
  look: { ...(LOOKS[i] || {}), hue: HUE[o.hue] || HUE.red },   // resolved palette for the renderer
```
to:
```js
  look: { ...(LOOKS[i] || {}), hue: HUE[o.hue] || HUE.red, sprite: SPRITE_SLUG[i] },
```

- [ ] **Step 2: Reserve the player's slug (no art yet → stays procedural)**

Change `HERO_LOOK` (lines 152-153) to add `sprite: 'player'`:
```js
export const HERO_LOOK = { hue: HUE.player, hgt:1.06, shoulder:1.05, waist:0.8, sprite: 'player',
  headgear:'none', special:{name:'UPPERCUT',frame:'uppercut'}, face:{brows:'hopeful',mouth:'grin'} };
```
(No `boxers/player/` art exists yet, so `boxerSprite('player', …)` returns undefined and the player renders procedurally — correct until Phase 3.)

- [ ] **Step 3: Verify it parses**

Run:
```bash
node --check src/opponents.js 2>/dev/null && echo "opponents.js OK" || echo "will verify in-browser at Task 11"
```
Expected: `opponents.js OK` (or fallback message).

- [ ] **Step 4: Commit**

```bash
git add src/opponents.js
git commit -m "feat(opponents): tag THE PAWNCHION look with its sprite slug"
```

---

## Task 10: Browser preview harness (primary visual QA)

**Files:**
- Create: `tools/fighter-preview.html`

- [ ] **Step 1: Write the harness** (mirrors `tools/scenery-preview.html`)

```html
<!doctype html>
<meta charset="utf-8">
<title>PAWNCH — fighter preview</title>
<style>body{background:#0a0e1c;margin:0;font:14px monospace;color:#cdd}
  canvas{image-rendering:pixelated;background:#111730;margin:6px;border:1px solid #243}
  .cell{display:inline-block;text-align:center;color:#9ab}</style>
<h3 style="color:#fc8">THE PAWNCHION — sprite (top) vs player procedural (bottom)</h3>
<div id="root"></div>
<script type="module">
import { loadAssets } from '../src/assets.js';
import { drawFighter } from '../src/fighter.js';
import { OPPONENTS, HERO_LOOK } from '../src/opponents.js';

// (pose, info) pairs exercising every boxer key.
const POSES = [
  ['idle',null],['guard',null],
  ['windup',{arm:'L'}],['windup',{arm:'R'}],
  ['punch',{arm:'L',kind:'jab'}],['punch',{arm:'R',kind:'jab'}],
  ['punch',{arm:'L',kind:'hook'}],['punch',{arm:'R',kind:'hook'}],
  ['special',null],['duck',null],['hurt',null],['stagger',null],['down',null],['walk',null],
];
const SIZE = 1.1, W = 180, H = 240;

function strip(look, facing, title){
  const wrap = document.createElement('div');
  const h = document.createElement('div'); h.textContent = title; h.style.color='#fc8'; wrap.appendChild(h);
  for (const [pose, info] of POSES){
    const c = document.createElement('div'); c.className='cell';
    const cv = document.createElement('canvas'); cv.width=W; cv.height=H;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
    drawFighter(ctx, W/2, H-24, SIZE, look, pose, facing, 8, info);
    const lab = document.createElement('div'); lab.textContent = pose+(info?.arm?(':'+info.arm+(info.kind?'/'+info.kind:'')):'');
    c.appendChild(cv); c.appendChild(lab); wrap.appendChild(c);
  }
  return wrap;
}

await loadAssets();
const root = document.getElementById('root');
root.appendChild(strip(OPPONENTS[9].look, 1, 'PAWNCHION (front, sprite)'));
root.appendChild(strip(HERO_LOOK, -1, 'PLAYER (back, procedural fallback)'));
</script>
```

- [ ] **Step 2: Serve and open the harness**

Run (background server):
```bash
cd /Users/ssmolak/Desktop/PAWNCH && python3 tools/devserver.py >/tmp/pawnch_dev.log 2>&1 &
sleep 1; echo "open http://localhost:8000/tools/fighter-preview.html"
```
(`tools/devserver.py` serves with no-cache headers; if it uses a different port, check `/tmp/pawnch_dev.log`.)

- [ ] **Step 3: View the harness**

Open `http://localhost:8000/tools/fighter-preview.html`. Expected:
- **Top strip (PAWNCHION):** the authored sprite in all 14 poses, feet aligned on a common baseline, correct scale, no jitter between poses, background transparent over the canvas color.
- **Bottom strip (PLAYER):** the procedural mannequin (no art yet) — proves the fallback path is intact.
- Browser console: no errors.

- [ ] **Step 4: Commit**

```bash
git add tools/fighter-preview.html
git commit -m "feat(tools): browser harness to preview fighter poses (sprite vs procedural)"
```

---

## Task 11: In-game verification

**Files:** none (verification only)

- [ ] **Step 1: Run the game**

Run:
```bash
cd /Users/ssmolak/Desktop/PAWNCH && npm run dev
```
Open `http://localhost:5173`, click once (audio gate).

- [ ] **Step 2: Reach a boxing half vs THE PAWNCHION**

The Pawnchion is roster index 9 (the last fight). Fastest path for QA without clearing the ladder: in the browser console use the debug handle —
```js
// confirm the champion's look is sprite-tagged
PAWNCH.match // inspect; the live Game + match are exposed (see CLAUDE.md)
```
If there's no quick jump, temporarily set the first Story fight to the champion: in `src/states/story.js` where it starts a match, pass opponent index `9` (revert after). Enter the **boxing half**.

Expected: THE PAWNCHION renders as the **authored sprite** (orange boxer-king), not the geometric mannequin. As he guards / winds up / throws / gets hit, the pose swaps through the sprite frames; the player (back view) is still procedural.

- [ ] **Step 3: Confirm the fallback is intact (Golden Rule 5)**

Temporarily rename the set dir and reload:
```bash
mv assets/sprites/boxers/pawnchion assets/sprites/boxers/_pawnchion_off
```
Expected: the champion silently reverts to the procedural mannequin, **no console errors**. Restore:
```bash
mv assets/sprites/boxers/_pawnchion_off assets/sprites/boxers/pawnchion
```

- [ ] **Step 4: Watch the console**

Expected throughout: no `[PAWNCH] frame error:` logs; `[PAWNCH] loaded N sprite(s)` shows the new boxer frames counted.

- [ ] **Step 5: Revert any temporary test edit** (e.g. the `story.js` index hack) and confirm `git status` is clean except intended files.

---

## Task 12: Tune placement/scale & finalize

**Files:** possibly `src/config.js` (`FIGHTER.SIZE.*`), `tools/slice_boxer.py` (`TARGET_BODY_H`)

- [ ] **Step 1: Compare sprite scale against the arena**

With the game running (Task 11) and the preview harness (Task 10), judge the champion's on-screen size vs the player and ring. The sprite height is set by `TARGET_BODY_H` in the slicer (canvas geometry) and `FIGHTER.SIZE.enemy` in `src/config.js` (blit scale).

- [ ] **Step 2: Adjust if needed (tuning stays in config — Golden Rule 2)**

- Too big/small overall → adjust `FIGHTER.SIZE.enemy` in `src/config.js`.
- Body proportion within the frame off → adjust `TARGET_BODY_H` in `tools/slice_boxer.py` and re-run `tools/slice_boxer.py pawnchion`.
Re-view in the harness after each change.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "tune(fighter): finalize THE PAWNCHION sprite scale/placement"
```

- [ ] **Step 4: Phase 1 done — summary**

THE PAWNCHION now renders as authored Gemini sprite art in the boxing half, with the procedural mannequin preserved as the zero-asset fallback. Pipeline (`gemini_image.py` → `gen_fighter.py` → `slice_boxer.py` → `boxerSets` → `drawFighter`) is reusable for Phases 2–4. Next: Phase 2 (rest of roster), Phase 3 (player back+front), Phase 4 (polish: idle breathe, walk cycle, portraits).

---

## Self-Review

**Spec coverage:**
- Proven Gemini→slice→manifest pipeline → Tasks 2,4,5,7. ✓
- Per-fighter `boxerSets` mirroring `pieceSets` → Tasks 6,7,9. ✓
- Pose→sprite-key resolver → Task 8 (`boxerKey`). ✓
- Fixed feet-anchored canvas (150×216, CX 75, FEET 190) killing jitter → Task 5 (`place`). ✓
- Procedural fallback preserved (Golden Rule 5) → Task 8 + verified Task 11 Step 3. ✓
- Tuning in config/PAL (Golden Rules 2/3) → Task 12. ✓
- THE PAWNCHION vertical slice first → whole plan. ✓
- Art-director curation gate (hybrid) → Task 4 Step 3. ✓
- Player needs back+front, opponents front-only → Task 9 Step 2 (player slug reserved, procedural until Phase 3). ✓

**Placeholder scan:** No TBD/TODO; all tool code is complete and runnable; the only "iterate" steps (Task 4 Step 3, Task 5 Step 3) are genuine human art-curation gates with concrete knobs, not deferred code. ✓

**Type/name consistency:** `registerBoxer`/`boxerSprite` (gfx) used identically in assets/fighter; registry key `${face}:${pose}` consistent across slicer filenames (`front_<pose>.png`), assets loader, and `boxerKey`; `BOXER_POSE_KEYS` (assets) == `POSE_ORDER` (prompts/slicer); canvas constants `150/216/75/190` shared between `slice_boxer.py` and `fighter.js`. ✓
