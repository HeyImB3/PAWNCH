# Visual Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four approved visual fixes from `docs/superpowers/specs/2026-07-21-visual-polish-fixes-design.md`: no rope impact waves, a glossy beach sun lane, a real stadium crowd + neon PAWNCH signboard, and sprite-true portraits/selection cards.

**Architecture:** PAWNCH is vanilla ES modules, no build step, one 2D canvas. Arena backdrops are deterministic PNG layers painted by `tools/paint_*.py` (master palette only) and animated by pure `drawLayered` functions in `src/scenery.js` with knobs in `src/config.js` `SCENERY.SCENES.<id>.L`. Portraits are 44×44 PNGs loaded by manifest into `portraitSprite()`; a new offline tool regenerates them from the authored fighter sprites. Story cards render via `drawPortrait` in `src/fighter.js`.

**Tech Stack:** Vanilla JS (ES modules, no deps), Python 3 + Pillow in `tools/.venv`, JSC headless test runner (`osascript`), Chrome headless for page screenshots.

## Global Constraints

- **No build step, no npm dependencies, no framework** (Golden Rule 1).
- **All tuning knobs and scene colors live in `src/config.js`** — no magic numbers in draw code (Golden Rule 2).
- **Painted layers use `tools/pawnch_palette.py` colors ONLY** — never invent RGB values or arithmetic-derive new colors in painters (Art Bible v2).
- **The game must still run with zero image files** — every sprite path keeps its procedural fallback (Golden Rule 5).
- **Scene `draw`/`drawLayered` stay PURE functions of `t`/`crowd`** — no `Math.random()`, no retained state; deterministic `hash(n)`/`t % PERIOD` scheduling only.
- **Never judge transparent PNGs with the Read tool** (it renders alpha as white) — use checkerboard/dark-bg composite images written by the tools.
- **Heavy per-frame loops go through `fxN()`** so FX LOW halves them.
- **Rig contract**: portraits are 44×44, head cx=22, crown y5, chin y31, eye band y17–21; `src/portrait.js` draws the blink bar at `(x+12, y+16, 20, 6)` and damage overlays on these boxes. `src/portrait.js` must NOT change.
- Verification suite: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` must end `0 failed`; `node --check <file>` for every touched JS file.
- Dev server for page QA: `python3 tools/devserver.py 5174` (no-cache), pages under `http://localhost:5174/tools/...`.
- Commit after every task; messages follow the repo's `type(scope): summary` style.

---

### Task 1: Remove rope impact waves from gameplay

**Files:**
- Modify: `src/states/boxing.js:88` (onHit) and `src/states/boxing.js:128` (onKnockdown)

**Interfaces:**
- Consumes: `RingView.impact(x, mag)` from `src/ring.js` — the API and `src/ropes.js` math stay intact (arena-preview's IMPACT button and `ropes.test.js` still use them).
- Produces: gameplay that never feeds rope impulses. No signature changes.

- [ ] **Step 1: Remove the per-punch impulse**

In `src/states/boxing.js`, inside the `onHit` hook, delete these two lines (the comment loses its "rope shockwave +" prefix):

```js
          // rope shockwave + press flashes + a mat decal (render-only juice)
          this.ringView.impact(game.W / 2 + (side === 'player' ? this.match.player.offset : this.match.enemy.offset), Math.min(1, dmg / 16));
```

and replace with:

```js
          // press flashes + a mat decal (render-only juice)
```

(The `this.flash.burst(...)` line and everything after it stay exactly as they are.)

- [ ] **Step 2: Remove the knockdown impulse**

Still in `src/states/boxing.js`, in the `onKnockdown` hook (one long line), delete only the fragment `this.ringView.impact(game.W / 2, 1); ` — the line keeps `audio.sfx.ko()`, shake, flash, freeze, `this.crowd = 1`, `this.flash.burst(LIGHT.FLASH.KNOCKDOWN)`, and the damage-score tail unchanged:

```js
        onKnockdown: (side) => { audio.sfx.ko(); game.fx.doShake(16); game.fx.doFlash('#fff', 0.6); game.doFreeze(120); this.crowd = 1; this.flash.burst(LIGHT.FLASH.KNOCKDOWN); if (side) (this.m.damage ||= { player: 0, enemy: 0 })[side] += PORTRAIT.KD_SCORE; },
```

- [ ] **Step 3: Verify no gameplay callers remain**

Run: `grep -rn "\.impact(" src/ tools/arena-preview.html`
Expected: matches ONLY in `src/ring.js` (the definition/update) and `tools/arena-preview.html` (the QA button). Zero matches under `src/states/`.

- [ ] **Step 4: Syntax + unit suite**

Run: `node --check src/states/boxing.js` → no output.
Run: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` → ends `[TESTS] N passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/states/boxing.js
git commit -m "fix(ring): punches and knockdowns no longer ripple the ropes (idle sway + sag only)"
```

---

### Task 2: Repaint the beach sea + glossy sun lane

**Files:**
- Modify: `tools/paint_beach.py` (palette import + the sea branch in `paint_far()`)
- Regenerate: `assets/sprites/arenas/beach/far.png` (mid/near untouched)

**Interfaces:**
- Consumes: `tools/pawnch_palette.py` colors + `n2(x, y, salt)` noise.
- Produces: a repainted `far.png`. Geometry unchanged: `SUN=(150,78)`, `HORIZON=92`, `WATERLINE=118` — Task 3's live glints assume the lane half-width formula `8 + d*1.05` px at depth `d = y - HORIZON`.

- [ ] **Step 1: Add BLUE1 to the palette import**

In `tools/paint_beach.py`, change the import to include `BLUE1`:

```python
from pawnch_palette import (
    INK0, INK1, INK2, BLUE0, BLUE1, EMBER1, EMBER2, EMBER3, EMBER4,
    GOLD0, GOLD1, GOLD2, GOLD3, GOLD4,
    WOOD0, WOOD1, WOOD2, WOOD3, WOOD4, SPEC1, n2,
)
```

- [ ] **Step 2: Replace the sea branch in `paint_far()`**

Find this block (the `else:` arm of the per-pixel loop):

```python
            else:
                # sea: deep dusk water + wave strokes + the sun path
                c = BLUE0
                row_h = 5 + int(n2(0, y, 43) * 4)
                if (y + int(n2(x // 13, y // 3, 44) * 2)) % row_h == 0:
                    c = INK1                              # wave stroke
                # sun path: warm sparkle column widening/fading downward
                half = 22 + (y - HORIZON) // 3
                if abs(x - SUN[0]) < half:
                    fade = 0.2 - (y - HORIZON) * 0.0018
                    if n2(x, y, 45) < max(0.04, fade):
                        c = GOLD1 if n2(x, y, 46) < 0.5 else EMBER4
                p[x, y] = c
```

Replace with:

```python
            else:
                # sea: dusk gradient deepening off the horizon + horizontal
                # wave strokes + the sun's glitter lane (solid tapering core
                # with dashed shimmer — coherent runs, never lone pixels)
                d = y - HORIZON
                band = d + (n2(x // 7, y, 43) - 0.5) * 3
                if band < 4:
                    c = BLUE1
                elif band < 8:
                    c = BLUE1 if n2(x // 3, y, 44) < (8 - band) / 4.0 * 0.6 else BLUE0
                elif band < 18:
                    c = BLUE0
                else:
                    c = INK1 if n2(x // 3, y, 44) < (band - 18) / 8.0 else BLUE0
                row_h = 3 + int(n2(0, y, 45) * 3)
                if y % row_h == 0 and n2(x // 9, y, 46) < 0.45:
                    c = EMBER2 if (d < 7 and n2(x // 9, y, 47) < 0.5) else INK1
                half = 8.0 + d * 1.05          # narrow at the sun, widening down
                u = abs(x - SUN[0]) / half
                if u < 1.0:
                    core, lite = (GOLD2, GOLD1) if d < 6 else (GOLD1, EMBER4) if d < 14 else (EMBER4, EMBER3)
                    if u < 0.45:               # solid core + brighter dash rows
                        c = core if (y % 2 == 0 and n2(x // 5, y, 48) < 0.7) else lite
                    elif n2(x // 4, y, 49) < (1.0 - u) * 0.9:
                        c = lite               # dithered soft edge in 4px runs
                p[x, y] = c
```

- [ ] **Step 3: Regenerate the far layer**

Run: `tools/.venv/bin/python tools/paint_beach.py far`
Expected: `painted far -> .../assets/sprites/arenas/beach/far.png`

- [ ] **Step 4: Visual check (far.png is opaque RGB — Read is truthful here)**

Write and run a crop helper, then Read the output image:

```bash
tools/.venv/bin/python -c "
from PIL import Image
im = Image.open('assets/sprites/arenas/beach/far.png').convert('RGB')
im.crop((0, 60, 512, 130)).resize((1024, 140), Image.NEAREST).save('tools/_beach_sea_check.png')
print('ok')"
```

Read `tools/_beach_sea_check.png`. Acceptance: the lane is a *continuous* tapering column (no lone pixels), brightest gold near the sun fading to ember; the sea shows a lighter blue band under the horizon deepening downward; wave strokes are horizontal dashes. If the lane edge looks hard, widen the dither zone (raise the `0.45` core cutoff toward `0.55`); if it's too dim, raise the dash probabilities.

- [ ] **Step 5: Commit**

```bash
git add tools/paint_beach.py assets/sprites/arenas/beach/far.png tools/_beach_sea_check.png
git commit -m "polish(beach): glossy tapering sun lane + dusk sea gradient (was per-pixel speckle)"
```

---

### Task 3: Beach live glints on the sun lane

**Files:**
- Modify: `src/config.js` (`SCENERY.SCENES.beach.L`)
- Modify: `src/scenery.js` (`SCENES.beach.drawLayered` sparkle block)

**Interfaces:**
- Consumes: painted lane geometry from Task 2 (`horizonY: 92`, `sun: [150, 78]`, lane half-width `8 + d*1.05`); helpers `fxN`, `hash` (top of scenery.js).
- Produces: config knobs `L.glintN, L.glintSpeed, L.glintSpan, L.glintHalf, L.glintCol` (replacing `L.sparkleN, L.sparkleX, L.sparkleCol`).

- [ ] **Step 1: Swap the config knobs**

In `src/config.js` `SCENERY.SCENES.beach.L`, replace the line

```js
        sparkleN: 12, sparkleX: [124, 176],
```

with

```js
        glintN: 3, glintSpeed: 0.07, glintSpan: 24, glintHalf: [8, 1.05],
```

and in the beach `L` FX-colors line replace `sparkleCol: '#ffe7a8'` with `glintCol: '#ffe7a8'`.

- [ ] **Step 2: Replace the sparkle loop in `SCENES.beach.drawLayered`**

In `src/scenery.js`, replace:

```js
  // water sparkle in the sun path
  for (let i = 0; i < fxN(L.sparkleN); i++) {
    const sx = L.sparkleX[0] + hash(i) * (L.sparkleX[1] - L.sparkleX[0]);
    twinkle(ctx, sx, L.horizonY + 2 + hash(i + 5) * 22, 1, L.sparkleCol, t * 3, i * 1.7);
  }
```

with:

```js
  // slow glitter drifting down the painted sun lane (coherent horizontal
  // glints — the lane itself is painted; these just make it feel alive)
  for (let i = 0; i < fxN(L.glintN); i++) {
    const k = (((t * L.glintSpeed + i / L.glintN) % 1) + 1) % 1;   // 0..1 down the lane
    const gy = L.horizonY + 2 + k * L.glintSpan;
    const half = L.glintHalf[0] + (gy - L.horizonY) * L.glintHalf[1];
    const gx = L.sun[0] + (hash(i * 3.1) - 0.5) * half * 1.1;
    const fade = Math.sin(k * Math.PI) * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 2.4)));
    ctx.globalAlpha = 0.55 * fade;
    ctx.fillStyle = L.glintCol;
    ctx.fillRect((gx - 2) | 0, gy | 0, 5, 1);
    ctx.globalAlpha = 1;
  }
```

- [ ] **Step 3: Verify no stale knob references**

Run: `grep -n "sparkleN\|sparkleX\|sparkleCol" src/` → no matches.
Run: `node --check src/scenery.js && node --check src/config.js` → no output.

- [ ] **Step 4: Screenshot QA**

Start the server (`python3 tools/devserver.py 5174`, background) and screenshot:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --screenshot=tools/_beach_live_check.png --window-size=1100,700 --virtual-time-budget=4000 "http://localhost:5174/tools/arena-preview.html?scene=beach"
```

Read `tools/_beach_live_check.png`: the lane should read glossy with 2–3 subtle bright glints; also load `?scene=beach&fxlow=1` (glints halve) and `?bare=1` (procedural fallback unchanged, no errors).

- [ ] **Step 5: Commit**

```bash
git add src/config.js src/scenery.js
git commit -m "polish(beach): 2-3 slow drifting lane glints replace the 12-twinkle noise"
```

---

### Task 4: Stadium crowd repaint + painted neon PAWNCH signboard

**Files:**
- Modify: `tools/paint_stadium.py` (palette import, docstring geometry, `paint_far()` dim, `paint_mid()` crowd + sign)
- Regenerate: `assets/sprites/arenas/stadium/far.png`, `assets/sprites/arenas/stadium/mid.png` (near untouched)

**Interfaces:**
- Consumes: `pawnch_palette` colors, `n2`, existing `TIERS = [(58, 88), (92, 122), (126, 156)]`, `F35` letter font (3×5 glyphs).
- Produces: sign geometry that Task 5's config `L.sign` MUST mirror exactly: board `x=166, y=93, w=180, h=28` (frame is 2px, so the interior is 24px tall); letters at `lx0=200, ly=97`, scale `4` (12×20 px glyphs — they must fit the interior), pitch `20`.

- [ ] **Step 1: Expand the palette import**

Replace the import in `tools/paint_stadium.py` with:

```python
from pawnch_palette import (
    INK0, INK1, STEEL0, STEEL1, STEEL3, MAT1, BLUE1, BLUE3, BLUE4, BLUE6,
    RED1, RED2, RED3, RED4, GREEN1, GREEN2, GOLD0, GOLD1, GOLD2, GOLD3,
    EMBER1, EMBER2, EMBER3, EMBER4, EMBER5, EMBER6, EMBER7, SPEC1,
    WOOD1, WOOD2, WOOD3, WOOD4, WOOD5, n2,
)
```

- [ ] **Step 2: Update the docstring geometry contract**

In the module docstring, replace the line `letter cards centered x186-326 in the middle tier.` with `neon PAWNCH board x166-346 / y93-121 (letters 12x20 @ lx0=200 pitch 20).`

- [ ] **Step 3: Dim the far micro-crowd one more notch**

In `paint_far()`, change the far-tier fleck mix from halving toward MAT1:

```python
                c = ((c[0] + MAT1[0]) // 2, (c[1] + MAT1[1]) // 2, (c[2] + MAT1[2]) // 2)
```

to weighting MAT1 double (deeper recede):

```python
                c = ((c[0] + 2 * MAT1[0]) // 3, (c[1] + 2 * MAT1[1]) // 3, (c[2] + 2 * MAT1[2]) // 3)
```

- [ ] **Step 4: Add spectator/decor helpers above `paint_mid()`**

Insert before `def paint_mid():`:

```python
# ---- crowd figures ----------------------------------------------------------
# palette pairs (lit, shadow) per shirt — ramp neighbours, never math-derived
SHIRTS = [(RED3, RED1), (BLUE4, BLUE1), (GOLD2, GOLD0), (GREEN2, GREEN1),
          (EMBER5, EMBER2), (BLUE6, BLUE3), (RED4, RED2), (EMBER4, EMBER2)]
SKINS = [WOOD2, WOOD3, WOOD4, WOOD5, EMBER7]
SKINS_DIM = [WOOD2, WOOD3, WOOD4]          # back tier reads darker

def spectator(put, x, y, h, seed, raised=False, dim=False):
    """One crowd figure. (x, y) = feet-line center; h = total height in px.
    Head (varied skin) + shirt with a shadowed right side + optional cheer
    arms; ~60% get a dark hair cap."""
    skin = (SKINS_DIM if dim else SKINS)[int(n2(x, seed, 270) * (len(SKINS_DIM) if dim else len(SKINS)))]
    lit, shad = SHIRTS[int(n2(x, seed, 271) * len(SHIRTS))]
    if dim:
        lit = shad                          # back tier: shadow tone all over
    hw = max(1, h // 3)
    head_h = max(2, h // 3)
    for yy in range(y - (h - head_h), y):                  # torso
        for xx in range(x - hw, x + hw + 1):
            put(xx, yy, lit if xx <= x else shad)
    for yy in range(y - h, y - (h - head_h)):              # head
        for xx in range(x - hw + 1, x + hw):
            put(xx, yy, skin)
    if n2(x, seed, 272) < 0.6:                             # hair cap
        for xx in range(x - hw + 1, x + hw):
            put(xx, y - h, INK1)
    if raised:                                             # painted cheer arms
        for sx2 in (x - hw - 1, x + hw + 1):
            put(sx2, y - h + 1, skin)
            put(sx2, y - h + 2, lit)

def crowd_decor(put):
    """A few flags + foam fingers sprinkled through the tiers."""
    for (dx2, dti) in [(60, 0), (150, 1), (240, 0), (330, 2), (420, 1), (480, 2)]:
        ty0, ty1 = TIERS[dti]
        dy2 = ty0 + 8 + int(n2(dx2, dti, 275) * 8)
        if n2(dx2, dti, 276) < 0.5:                        # flag on a stick
            for k in range(4):
                put(dx2, dy2 - k, WOOD1)
            for yy in range(2):
                for xx in range(4):
                    put(dx2 + 1 + xx, dy2 - 4 + yy,
                        EMBER4 if n2(xx, yy, 277) < 0.7 else GOLD2)
        else:                                              # foam finger
            for yy in range(3):
                for xx in range(2):
                    put(dx2 + xx, dy2 - yy, GOLD2)
            put(dx2, dy2 - 3, GOLD3)

# ---- the NEON SIGNBOARD (geometry contract: config L.sign) ------------------
SIGN = dict(x=166, y=93, w=180, h=28, lx0=200, ly=97, sc=4, pitch=20)

def neon_board(put):
    x0b, y0b, wb, hb = SIGN['x'], SIGN['y'], SIGN['w'], SIGN['h']
    # painted ember glow spill onto the crowd around the board
    for yy in range(y0b - 4, y0b + hb + 5):
        for xx in range(x0b - 6, x0b + wb + 7):
            if x0b <= xx < x0b + wb and y0b <= yy < y0b + hb:
                continue
            dxh = max(x0b - xx, xx - (x0b + wb) + 1, 0)
            dyh = max(y0b - yy, yy - (y0b + hb) + 1, 0)
            dd = dxh + dyh
            if dd <= 5 and n2(xx, yy, 278) < (6 - dd) / 6.0 * 0.55:
                put(xx, yy, EMBER1 if dd > 2 else EMBER2)
    # board face + steel frame + contact shadow + mounting struts
    for yy in range(y0b, y0b + hb):
        for xx in range(x0b, x0b + wb):
            edge = xx < x0b + 2 or xx >= x0b + wb - 2 or yy < y0b + 2 or yy >= y0b + hb - 2
            put(xx, yy, STEEL0 if edge else INK0)
    for xx in range(x0b + 2, x0b + wb - 2):
        put(xx, y0b + hb, INK0)
        if xx % 40 < 2:
            for yy in range(y0b + hb, min(y0b + hb + 4, H)):
                put(xx, yy, INK1)
    # PAWNCH in neon tubes: GOLD2 core with an EMBER3 rim on stroke edges
    sc2 = SIGN['sc']
    for li, ch2 in enumerate('PAWNCH'):
        gx = SIGN['lx0'] + li * SIGN['pitch']
        cells = {(rx, ry) for ry, rowg in enumerate(F35[ch2])
                 for rx, cell in enumerate(rowg) if cell == '#'}
        for (rx, ry) in cells:
            for yy in range(sc2):
                for xx in range(sc2):
                    ex = (xx == 0 and (rx - 1, ry) not in cells) or \
                         (xx == sc2 - 1 and (rx + 1, ry) not in cells)
                    ey = (yy == 0 and (rx, ry - 1) not in cells) or \
                         (yy == sc2 - 1 and (rx, ry + 1) not in cells)
                    put(gx + rx * sc2 + xx, SIGN['ly'] + ry * sc2 + yy,
                        EMBER3 if (ex or ey) else GOLD2)
```

- [ ] **Step 5: Replace the block-crowd + letter cards in `paint_mid()`**

Inside `paint_mid()`, keep the per-tier floor fill, step shadow and rail exactly as they are, but DELETE (a) the `blocky`/`pitch` spectator-block loop and (b) the entire `# the LETTER-CARD block in the middle tier: P-A-W-N-C-H` section (from `word = 'PAWNCH'` through the end of its glyph loop). In their place, after the tier floor/rail loop, add:

```python
    # crowd tiers: rows of real spectators (back rows paint first, front
    # rows overlap them); ~12% empty seats, ~15% pre-raised cheer arms
    FIG_H = [5, 7, 9]                                      # top -> front tier
    for ti, (ty0, ty1) in enumerate(TIERS):
        fh = FIG_H[ti]
        for ri, row_y in enumerate(range(ty0 + fh + 2, ty1 - 1, fh - 1)):
            for hx in range(2, W, fh + 1):
                if n2(hx, row_y, 273) < 0.12:
                    continue
                jit = int(n2(hx, row_y, 263) * 3) - 1
                spectator(put, hx + jit, row_y, fh, ti * 100 + ri,
                          raised=n2(hx, row_y, 274) < 0.15, dim=(ti == 0))
    crowd_decor(put)
    neon_board(put)
```

(Note: `neon_board` paints AFTER the crowd so the board and its glow sit on top of the middle-tier spectators — that's what "mounted on the facade" looks like from the ring.)

- [ ] **Step 6: Regenerate far + mid**

Run: `tools/.venv/bin/python tools/paint_stadium.py far && tools/.venv/bin/python tools/paint_stadium.py mid`
Expected: two `painted ... -> ...png` lines.

- [ ] **Step 7: Visual check on a dark composite (mid.png has alpha — do NOT Read it raw)**

```bash
tools/.venv/bin/python -c "
from PIL import Image
mid = Image.open('assets/sprites/arenas/stadium/mid.png').convert('RGBA')
far = Image.open('assets/sprites/arenas/stadium/far.png').convert('RGBA')
bg = Image.new('RGB', mid.size, (7, 10, 22)); bg.paste(far, (0, 0), far); bg.paste(mid, (0, 0), mid)
bg.crop((0, 50, 512, 170)).resize((1024, 240), Image.NEAREST).save('tools/_stadium_check.png')
print('ok')"
```

Read `tools/_stadium_check.png`. Acceptance: tiers read as *people* (heads + shirts + shadow sides, some raised arms, a few flags/foam fingers), figures grow toward the front tier; the PAWNCH board is large (180px wide), letters read as glowing tubes with an ember rim, ember glow dithers onto neighboring crowd, struts + contact shadow ground it. If figures blur together, raise the seat pitch (`fh + 1` → `fh + 2`); if the sign glow reads harsh, lower the `0.55` spill probability.

- [ ] **Step 8: Commit**

```bash
git add tools/paint_stadium.py assets/sprites/arenas/stadium/far.png assets/sprites/arenas/stadium/mid.png tools/_stadium_check.png
git commit -m "polish(stadium): real spectator crowd + big painted neon PAWNCH signboard"
```

---

### Task 5: Stadium live layer — physical WAVE arms, living neon sign, phone lights

**Files:**
- Modify: `src/config.js` (`SCENERY.SCENES.stadium.L` additions)
- Modify: `src/scenery.js` (`SCENES.stadium.drawLayered`)

**Interfaces:**
- Consumes: Task 4's painted geometry (board `x=166,y=93,w=180,h=28`, letters `lx0=200, ly=97`, pitch 20, glyphs 12×20); helpers `fxN`, `hash`, `twinkle`, `mixA`, `additiveGlow(ctx, x, y, r, color, alpha)`.
- Produces: config knobs `L.sign{...}, L.armN, L.armLift, L.armCols, L.phoneN, L.phoneCol`.

- [ ] **Step 1: Add the knobs to `SCENERY.SCENES.stadium.L`**

In `src/config.js`, inside the stadium `L` object (after the `confCols` line), add:

```js
        sign: { x: 166, y: 93, w: 180, h: 28, lx0: 200, ly: 97, pitch: 20,
                neon: '#ffd24a', neonHi: '#fff6d8', flickerPeriod: 19, flickerDur: 1.1 },
        armN: 14, armLift: 7, armCols: ['#f2b07a', '#c8a888', '#9a7140', '#6f4d29'],
        phoneN: 10, phoneCol: '#b8d0ff',
```

- [ ] **Step 2: Make the WAVE physical (cheering arms)**

In `src/scenery.js` `SCENES.stadium.drawLayered`, directly after the existing WAVE band block's `ctx.restore();`, add:

```js
  // physical WAVE: cheering arms pop up where the light band crosses each tier
  L.tiers.forEach(([ty0, ty1], ti) => {
    const span = W + L.waveW * 2;
    const x0 = ((t * L.waveSpeed + ti * 60) % span) - L.waveW;
    for (let a2 = 0; a2 < fxN(L.armN); a2++) {
      const ax = x0 + (hash(a2 * 7.3 + ti) - 0.5) * L.waveW * 1.4;
      if (ax < -2 || ax > W + 2) continue;
      const lift = Math.max(0, 1 - Math.abs(ax - x0) / L.waveW);
      if (lift <= 0.1) continue;
      const seatY = ty0 + 6 + hash(a2 * 3.7 + ti * 9) * (ty1 - ty0 - 12);
      const ah = Math.round(2 + lift * L.armLift);
      ctx.fillStyle = L.armCols[(a2 + ti) % L.armCols.length];
      ctx.fillRect(ax | 0, (seatY - ah) | 0, 1, ah);                 // arm
      ctx.fillRect((ax - 1) | 0, (seatY - ah - 2) | 0, 2, 2);        // fist
    }
  });
```

- [ ] **Step 3: Bring the neon sign alive**

Still in `drawLayered`, after the searchlights block (before `// THE LIVE JUMBOTRON`), add:

```js
  // THE NEON SIGN: breathing glow, a rare half-dead flicker, letter-chase on surges
  const SG = L.sign;
  const flick = (t % SG.flickerPeriod) < SG.flickerDur ? (Math.floor(t * 30) % 2 ? 0.15 : 0.7) : 1;
  const pulse = (0.75 + 0.25 * Math.sin(t * 1.7)) * flick;
  additiveGlow(ctx, SG.x + SG.w / 2, SG.y + SG.h / 2, SG.w * 0.45, SG.neon, 0.16 * pulse + crowd * 0.10);
  if (crowd > 0.5) {
    const li = Math.floor(t * 10) % 6;
    const lx2 = SG.lx0 + li * SG.pitch;
    ctx.fillStyle = mixA(SG.neonHi, 0.35);
    ctx.fillRect(lx2 - 2, SG.ly - 2, 16, 24);
    additiveGlow(ctx, lx2 + 6, SG.ly + 10, 18, SG.neonHi, 0.5);
  }
```

- [ ] **Step 4: Phone lights in the upper tiers**

After the confetti loop in the same function, add:

```js
  // phone lights twinkling in the upper tiers
  for (let i = 0; i < fxN(L.phoneN); i++) {
    const px3 = hash(i * 11.7) * W, py3 = 58 + hash(i * 5.3) * 60;
    twinkle(ctx, px3 | 0, py3 | 0, 1, L.phoneCol, t, i * 2.2);
  }
```

- [ ] **Step 5: Syntax + screenshot QA**

Run: `node --check src/scenery.js && node --check src/config.js` → no output.
With the dev server up:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --screenshot=tools/_stadium_live_check.png --window-size=1100,700 --virtual-time-budget=4000 "http://localhost:5174/tools/arena-preview.html?scene=stadium&crowd=80"
```

Read `tools/_stadium_live_check.png`: arms visible along the wave band, sign glowing, letter-chase active at crowd 80. Also check `?scene=stadium&fxlow=1` (halved arms/phones, no errors), `?bare=1` (procedural fallback intact), `?perf=1` (frame time comparable to before).

- [ ] **Step 6: Commit**

```bash
git add src/config.js src/scenery.js
git commit -m "feat(stadium): physical WAVE cheer arms + living neon sign (pulse/flicker/chase) + phone lights"
```

---

### Task 6: Sprite-true portraits — `tools/portrait_from_sprite.py`

**Files:**
- Create: `tools/portrait_from_sprite.py`
- Regenerate: `assets/sprites/portraits/<slug>/*.png` for all 11 slugs (`player patty gus rosa kid bishop queen iron tal magnus pawnchion`) — `_overlays/` untouched
- Create: `tools/_portrait_audit.png` (checkerboard audit montage)
- Modify: `CLAUDE.md` (two portrait references)

**Interfaces:**
- Consumes: `assets/sprites/boxers/<slug>/front_<pose>.png` (150×216, feet at y190). Player has only `front_guard/idle/special/walk`.
- Produces: 44×44 RGBA PNGs named exactly `neutral pleased smirk beaming concerned upset dejected wince shock grin3` per slug — the filenames `src/portrait.js` + `assets/sprites/manifest.json` already load. **No JS changes.**

- [ ] **Step 1: Write the tool**

Create `tools/portrait_from_sprite.py`:

```python
#!/usr/bin/env python3
"""Build the 44x44 face-tile portraits FROM the authored fighter sprites, so
chess/round-break/match-end faces match the models (visual polish pass
2026-07-21). Replaces the painted faces from tools/paint_portraits.py — that
tool still owns _overlays/damage*.png. Usage:
  tools/.venv/bin/python tools/portrait_from_sprite.py [slug|all] [--audit]

Expressions map to POSES (fighters wear different faces per pose):
  neutral/pleased -> idle · concerned/upset/wince -> hurt ·
  shock/dejected -> stagger · smirk/beaming/grin3 -> special
Missing pose file or a slug listed in BAD -> falls back to idle.

RIG CONTRACT (mirrored in src/portrait.js — do not drift): 44x44, head cx=22,
crown y5, chin y31, eye band y17-21 (blink bar x12 y16 w20 h6). We anchor on
EYES and CHIN: scale = (31-19)/(chin-eyeY); tall hats crop at the tile top
like a tight broadcast shot.

FACE gives per-slug head geometry in SPRITE px measured on front_idle
(auto-estimated from the alpha bbox, then hand-tuned via --audit): eyeY, chin,
cx; optional per-pose (dx, dy) shifts; optional bad=(poses,) to force idle.
--audit writes tools/_portrait_audit.png (checkerboard, 2x, rows=slugs) —
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

# eyeY/chin/cx in sprite px on front_idle. shift={'pose': (dx, dy)} moves the
# crop for poses whose head sits elsewhere; bad=(poses,) forces idle for that
# slug. Values below are FIRST GUESSES from head-fraction heuristics — iterate
# with --audit until every face is framed (eyes in the y17-21 band).
HEAD_K = {'patty': 0.30, 'kid': 0.28, 'gus': 0.26, 'player': 0.24,
          'rosa': 0.24, 'bishop': 0.24, 'queen': 0.24, 'tal': 0.24,
          'magnus': 0.24, 'iron': 0.26, 'pawnchion': 0.26}
FACE = {}          # slug -> dict(eyeY=, chin=, cx=, shift={}, bad=())  overrides


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
    """Resolve eyeY/chin/cx for this slug+pose (auto + FACE overrides)."""
    t2, acx = bbox_and_cx(im)
    face_h = (FEET - t2) * HEAD_K[slug]
    g = dict(eyeY=t2 + face_h * 0.55, chin=t2 + face_h, cx=acx)
    g.update({k: v for k, v in FACE.get(slug, {}).items()
              if k in ('eyeY', 'chin', 'cx') and pose == 'idle'})
    # per-pose nudge (heads move between poses)
    dx, dy = FACE.get(slug, {}).get('shift', {}).get(pose, (0, 0))
    if pose != 'idle' and slug in FACE and 'eyeY' in FACE[slug]:
        # reuse the tuned idle geometry, re-anchored on this pose's bbox top
        it2 = bbox_and_cx(Image.open(os.path.join(SRC, slug, 'front_idle.png')).convert('RGBA'))[0]
        off = t2 - it2
        g = dict(eyeY=FACE[slug]['eyeY'] + off, chin=FACE[slug]['chin'] + off,
                 cx=FACE[slug].get('cx', acx))
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
```

- [ ] **Step 2: First run + audit**

Run: `tools/.venv/bin/python tools/portrait_from_sprite.py all --audit`
Expected: 11 `portraits <- sprites: <slug>` lines + the audit line.

- [ ] **Step 3: Iterate the FACE table against the audit**

Read `tools/_portrait_audit.png` (checkerboard makes alpha honest). For every slug whose face is mis-framed — eyes outside the y17–21 band (in the 2× montage: 34–42px from each tile's top), chin floating high, or head off-center — add a `FACE['<slug>'] = dict(eyeY=…, chin=…, cx=…)` override with sprite-pixel measurements (crop the source sprite with PIL at 4× to measure if needed). For poses whose head is tilted/glove-occluded beyond use, add `bad=('special',)` etc.; for heads that just shift, add `shift={'hurt': (dx, dy)}`. Re-run Step 2 and re-Read until **every row shows the same character as the fighter sprite, framed like a broadcast headshot, with eyes in the band**. Expect 2–4 iterations; player's hurt/stagger columns will show idle (only 4 front poses exist) — that's correct.

- [ ] **Step 4: Blink-bar sanity + in-situ QA**

With the dev server up, screenshot the portrait grid and the chess panel:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --screenshot=tools/_portrait_page_check.png --window-size=1100,900 --virtual-time-budget=4000 "http://localhost:5174/tools/portrait-preview.html"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --screenshot=tools/_chess_panel_check.png --window-size=1100,700 --virtual-time-budget=4000 "http://localhost:5174/tools/chess-preview.html"
```

Read both: expressions swap correctly, damage overlays sit on the faces, the broadcast panel frames the new heads. (Blinks are timing-dependent — verify the skin-tone bar isn't jarring by watching the live preview once during the final sweep.)

- [ ] **Step 5: Update the two CLAUDE.md references**

In `CLAUDE.md`: in the V4+V5 architecture bullet, change `Portrait art: tools/paint_portraits.py (one 44×44 face RIG, all 11 characters; …)` to `Portrait art: tools/portrait_from_sprite.py (44×44 faces cropped from the fighter sprites; expressions map to poses) + tools/paint_portraits.py for the damage _overlays; the rig contract is mirrored in portrait.js — change both together.` In Common tasks → "Tune portraits / battle damage", change `Expressions & faces: tools/paint_portraits.py` to `Expressions & faces: tools/portrait_from_sprite.py (crops the fighter sprites; per-slug FACE table)`.

- [ ] **Step 6: Commit**

```bash
git add tools/portrait_from_sprite.py assets/sprites/portraits tools/_portrait_audit.png CLAUDE.md
git commit -m "feat(portraits): 44x44 faces now cropped from the fighter sprites (expression->pose map); matches the models"
```

---

### Task 7: Story-mode cards show the real fighter sprites

**Files:**
- Modify: `src/fighter.js` (`drawPortrait` + two new module-private helpers)

**Interfaces:**
- Consumes: `boxerSprite(set, key)` from `src/gfx.js` — pose keys are `'front:idle'` (colon-joined `face:pose`); `look.sprite` slug from `opponents.js`; existing `newCv`, `mixHex`, `FEET` (=190) in fighter.js.
- Produces: unchanged signature `drawPortrait(ctx, x, y, w, h, look, { silhouette, t })` — `src/states/story.js` needs no edits. No sprite registered → the existing procedural path runs (zero-asset rule).

- [ ] **Step 1: Add the sprite bust path**

In `src/fighter.js`, change the top of `drawPortrait` to divert to the sprite path when authored art exists:

```js
export function drawPortrait(ctx, x, y, w, h, look, { silhouette=false, t=0 } = {}){
  const spr = look?.sprite ? boxerSprite(look.sprite, 'front:idle') : null;
  if (spr) return spritePortrait(ctx, x, y, w, h, look, spr, silhouette);
  const { lined, geom: g } = render(look, 'idle', t*3, 1, null);
  // ... (existing body unchanged from here)
```

Then add below `drawPortrait` (before `mixHex`):

```js
// authored-sprite bust for the roster cards: head -> mid-chest crop of the
// fighter's real front_idle, over the same studio-gradient backdrop.
function spritePortrait(ctx, x, y, w, h, look, spr, silhouette){
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  const bg=ctx.createLinearGradient(x,y,x,y+h);
  bg.addColorStop(0, silhouette ? '#1b2344' : mixHex(look.hue.body,'#0a1024',0.55));
  bg.addColorStop(1,'#070a16'); ctx.fillStyle=bg; ctx.fillRect(x,y,w,h);
  const b = bustBox(spr);
  const scale = Math.min(w/b.w, h/b.h)*1.06;
  const dw=b.w*scale, dh=b.h*scale;
  const dx=x+(w-dw)/2, dy=y+h*0.06;
  if(silhouette){
    const [sil,sc]=newCv(b.w,b.h);
    sc.drawImage(spr, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    sc.globalCompositeOperation='source-in'; sc.fillStyle='#0a1022'; sc.fillRect(0,0,b.w,b.h);
    ctx.drawImage(sil, dx, dy, dw, dh);
    ctx.fillStyle='rgba(140,165,225,0.10)'; ctx.fillRect(x,y,w,2);
  } else {
    ctx.drawImage(spr, b.x, b.y, b.w, b.h, dx, dy, dw, dh);
  }
  ctx.restore();
}

// head -> mid-chest box from the sprite's alpha (cached per image): top of
// the opaque bbox down 52% of the way to the feet line, width from those rows
const bustCache = new Map();
function bustBox(spr){
  if (bustCache.has(spr)) return bustCache.get(spr);
  const [cv,c2]=newCv(spr.width,spr.height); c2.drawImage(spr,0,0);
  const a=c2.getImageData(0,0,spr.width,spr.height).data;
  let top=0;
  outer: for (let yy=0; yy<spr.height; yy++)
    for (let xx=0; xx<spr.width; xx++)
      if (a[(yy*spr.width+xx)*4+3]>16){ top=yy; break outer; }
  const bot=Math.min(spr.height, top+Math.round((FEET-top)*0.52));
  let left=spr.width, right=0;
  for (let yy=top; yy<bot; yy++)
    for (let xx=0; xx<spr.width; xx++)
      if (a[(yy*spr.width+xx)*4+3]>16){ if(xx<left)left=xx; if(xx>right)right=xx; }
  const box={ x:left, y:Math.max(0,top-4), w:Math.max(1,right-left+1), h:bot-Math.max(0,top-4) };
  bustCache.set(spr, box); return box;
}
```

- [ ] **Step 2: Syntax + fallback check**

Run: `node --check src/fighter.js` → no output.
Confirm the zero-asset path: with the dev server up, `arena-preview.html?bare=1` still loads without console errors (it exercises the no-sprites registry), and `drawPortrait`'s procedural body is unchanged below the early return.

- [ ] **Step 3: In-game visual check**

With the dev server up, open `http://localhost:5174/` in a headed browser (or ask the owner): Story Mode select shows the real fighters as bust crops on beaten/current cells and dark silhouettes with "?" on unbeaten ones (Story is dev-unlocked on localhost, so REPLAY any cell to spot-check several fighters). Gloves-at-chest poses should crop cleanly at mid-chest; if a fighter's bust sits too low in the cell, tune the single `0.52` bust-depth constant.

- [ ] **Step 4: Commit**

```bash
git add src/fighter.js
git commit -m "feat(story): roster cards show the authored fighter sprites (bust crop; procedural fallback intact)"
```

---

### Task 8: Full verification sweep

**Files:** none (verification only; fix-forward anything found, amend the relevant task's commit style)

- [ ] **Step 1: Unit suite** — `osascript -l JavaScript tools/test/run-headless.js "$PWD"` → `0 failed`.
- [ ] **Step 2: Syntax net** — `for f in src/states/boxing.js src/scenery.js src/config.js src/fighter.js; do node --check $f; done` → silent.
- [ ] **Step 3: Harness matrix** (dev server up; screenshot + Read each):
  - `arena-preview.html?scene=beach`, `?scene=beach&fxlow=1`, `?scene=stadium&crowd=80`, `?scene=stadium&down=1`, `?scene=stadium&perf=1`, `?bare=1`
  - `portrait-preview.html`, `chess-preview.html`, `fighter-preview.html`
- [ ] **Step 4: Owner playthrough checklist** (report, don't self-certify): start a Story match vs Patty — beach water reads glossy; punch flurries produce NO rope waves; knockdown produces NO rope wave; chess half shows sprite-true faces reacting on captures; round break/match end portraits match; Story select shows sprite cards. Then REPLAY the Pawnchion: crowd reads as people, WAVE raises arms, neon sign glows/flickers and chases on a knockdown.
- [ ] **Step 5: Update memory** — note in the visual-overhaul memory file that the polish pass (ropes/beach/stadium/portraits) shipped.
