# Visual Overhaul V1 — Ring + Master Style Foundation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PAWNCH's minimal code-drawn boxing ring with a hand-painted hi-bit ring kit plus a living lighting/FX layer (physical ropes, mat reflections, fight-memory decals, press-row flashbulbs, knockdown spotlight), and establish the master palette + Art Bible v2 that all later phases follow.

**Architecture:** Modular painted PNG pieces (authored in Aseprite via pixel-mcp at native 512×448-scale resolution) are loaded through the existing `manifest.json` → `loadAssets()` pipeline and composed by a new stateful `RingView` (`src/ring.js`); a new `src/lighting.js` supplies additive glow / spotlight / dim / reflection helpers; pure rope-wave math lives in dependency-free `src/ropes.js` so it runs in the JSC headless test suite. Every piece falls back per-piece to the current procedural drawing, so the game still boots with zero image files.

**Tech Stack:** Vanilla ES modules, Canvas 2D, Aseprite via pixel-mcp MCP tools, JavaScriptCore headless tests (`osascript`), Python (tools/.venv PIL) for transparency QA.

## Global Constraints

- **No build step, no dependencies, no framework** (CLAUDE.md Golden Rule 1).
- **All tuning/colors in `src/config.js`** — new `RING` and `LIGHT` blocks, PAL additions; no magic numbers/hex in draw code (Golden Rules 2–3).
- **Presentation-only:** never import, modify, or read state back into `src/sim/*` or `src/chess/*` logic. FX randomness is render-side `Math.random()` only.
- **Zero-asset boot must keep working:** with `manifest.json` missing or any PNG absent, every piece falls back procedurally (Golden Rule 5).
- **Pixel discipline:** assets authored at native game resolution, 1:1 pixels, `imageSmoothingEnabled` stays false; no rotated/mixed-scale pixels (spec §1).
- **Readability beats spectacle:** fighters + attack tells keep the highest-contrast band; new FX must never obscure a windup tell (spec §6; Golden Rules 8–9).
- Ring geometry constants (screen space): `floorTop = 170` in fights; mat trapezoid top edge (82,178)→(430,178) widening to (0,448)/(512,448); ropes at y = 130/144/158 (+sag); posts at x=8 and x=488, y≈118–184; enemy feet y=304 at `W/2+offset`; player feet y=452.
- Test command: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` (expect `[TESTS] N passed, 0 failed`). Serve: `python3 tools/devserver.py` → http://localhost:5174.
- Commit after every task. Never commit `tools/_scratch/` previews.

**Deviation from spec, agreed rationale:** the far apron is an 8px strip in this camera — "embroidered PAWNCH apron" is physically impossible there, so ring branding lives on the **mat emblem**; the apron strip gets gold trim + a code-tinted accent band. Bunting belongs to arena near-layers (V2+).

---

### Task 1: Preflight, master palette, checker-QA tool, Art Bible v2

**Files:**
- Create: `assets/aseprite/pawnch-master.gpl`
- Create: `tools/check_alpha.py`
- Modify: `docs/ART_BIBLE.md` (prepend v2 section, keep history)

**Interfaces:**
- Produces: the master palette every art task imports (`pawnch-master.gpl`); `tools/.venv/bin/python tools/check_alpha.py <png> <out.png>` → checkerboard-composited preview readable by the Read tool (which lies about transparency otherwise).

- [ ] **Step 1: Verify pixel-mcp round-trip.** Load Aseprite tool schemas (ToolSearch "pixel-plugin aseprite" if deferred). Then: `create_canvas` 16×16 RGB → `fill_area` any color → `export_sprite` to the session scratchpad as `preflight.png` → Read it back. If the MCP errors (Aseprite not running), STOP and ask the user to launch the Steam Aseprite, then retry. Do not proceed until the round-trip works.

- [ ] **Step 2: Write the master palette file** `assets/aseprite/pawnch-master.gpl` (GIMP palette text format — committable/diffable, loads in Aseprite via `set_palette`/preset load):

```
GIMP Palette
Name: PAWNCH Master
Columns: 8
# Ramp 1 — ink / steel (cool neutrals)
  7  10  22	ink0
 13  18  38	ink1
 20  26  51	ink2
 38  48  79	steel0
 58  74 120	steel1
 90 111 160	steel2
142 160 207	steel3
205 214 255	steel4
# Ramp 2 — brand blue
 10  16  48	blue0
 19  53 127	blue1
 31  79 192	blue2
 43 108 255	blue3
 90 138 255	blue4
111 160 255	blue5
184 208 255	blue6
# Ramp 3 — brand ember / orange
 42  10  20	ember0
 87  21  40	ember1
140  35  24	ember2
193  77   0	ember3
255 122  24	ember4
255 154  58	ember5
255 176  90	ember6
255 217 168	ember7
# Ramp 4 — gold
140  90  18	gold0
201 150  42	gold1
255 210  74	gold2
255 231 168	gold3
255 246 216	gold4
# Ramp 5 — mat canvas (violet-blue)
 14  20  48	mat0
 27  35  68	mat1
 42  53 102	mat2
 61  74 133	mat3
 85  99 168	mat4
126 136 191	mat5
# Ramp 6 — red / danger
 64  16  30	red0
122  14  28	red1
194  32  55	red2
255  59  83	red3
255 138 150	red4
# Ramp 7 — wood / leather
 22  13   6	wood0
 44  28  13	wood1
 74  48  24	wood2
111  77  41	wood3
154 113  63	wood4
201 155  98	wood5
# Ramp 8 — green accent
 12  43  30	green0
 23  87  58	green1
 57 217 138	green2
138 240 192	green3
# Speculars (tiny glints only — never fills)
255 255 255	spec0
232 242 255	spec1
```

- [ ] **Step 3: Write `tools/check_alpha.py`** (transparency-honest QA — composites a PNG onto a magenta/gray checkerboard):

```python
#!/usr/bin/env python3
"""Composite a transparent PNG onto a checkerboard so the Read tool shows the
real cutout (Read renders alpha as white and lies). Usage:
  tools/.venv/bin/python tools/check_alpha.py in.png out.png [--scale N]"""
import sys
from PIL import Image

def main():
    src = Image.open(sys.argv[1]).convert('RGBA')
    out_path = sys.argv[2]
    scale = int(sys.argv[sys.argv.index('--scale') + 1]) if '--scale' in sys.argv else 2
    board = Image.new('RGBA', src.size)
    a, b = (255, 0, 255, 255), (140, 140, 140, 255)
    px = board.load()
    for y in range(src.height):
        for x in range(src.width):
            px[x, y] = a if ((x // 8 + y // 8) % 2 == 0) else b
    board.alpha_composite(src)
    board = board.resize((src.width * scale, src.height * scale), Image.NEAREST)
    board.convert('RGB').save(out_path)
    print(f'wrote {out_path} ({board.width}x{board.height})')

if __name__ == '__main__':
    main()
```

Verify: run it on the Step-1 preflight PNG, Read the output, confirm checkerboard shows.

- [ ] **Step 4: Art Bible v2.** Prepend a `## v2 — the PAWNCH Hi-Bit standard (2026-07-20)` section to `docs/ART_BIBLE.md` (keep the existing history below it) stating, verbatim from the spec §1: native-resolution authorship in Aseprite; `.aseprite`/`.gpl` masters in `assets/aseprite/`; the master palette is the only color source (per-scene sub-palettes derive from it); hue-shifted ramps (shadows cool, highlights warm, no pure-black/white fills, speculars only as glints); KOF-style cluster shading, minimal outlines; dither only as deliberate texture; declared key light per scene; additive glow pass over crisp pixels; motion doctrine (nothing fully still); QA gates = `check_alpha.py` checkerboard + `tools/arena-preview.html` (Task 3) + live game.

- [ ] **Step 5: Commit**

```bash
git add assets/aseprite/pawnch-master.gpl tools/check_alpha.py docs/ART_BIBLE.md
git commit -m "feat(art): master hi-bit palette, alpha-QA tool, Art Bible v2 (visual overhaul V1)"
```

---

### Task 2: Asset loader — `ring` + `arenas` manifest groups

**Files:**
- Modify: `src/gfx.js` (registry, near lines 22–29)
- Modify: `src/assets.js` (loader, after the boxerSets block ~line 63)
- Modify: `assets/sprites/manifest.json` (add empty-safe group entries)

**Interfaces:**
- Produces (from `gfx.js`): `registerRing(key, img)`, `ringSprite(key)` → `Image|undefined`; `registerArenaLayer(sceneId, layer, img)`, `arenaLayers(sceneId)` → `{far?, mid?, near?}|undefined`.
- Manifest shape: `"ring": { "mat": "ring/mat.png", ... }` (flat key→file) and `"arenas": { "classic": "arenas/classic" }` (sceneId→dir; loader tries `far.png`, `mid.png`, `near.png`, missing files skipped silently).

- [ ] **Step 1: Registries in `src/gfx.js`.** Next to `registerBoxer`/`boxerSprite` add:

```js
export function registerRing(key, img) { (SPRITES.ring ||= {})[key] = img; }
export function ringSprite(key) { return (SPRITES.ring || {})[key]; }
export function registerArenaLayer(sceneId, layer, img) { ((SPRITES.arenas ||= {})[sceneId] ||= {})[layer] = img; }
export function arenaLayers(sceneId) { return (SPRITES.arenas || {})[sceneId]; }
```

- [ ] **Step 2: Loader in `src/assets.js`.** Import the two register fns; add after the boxerSets block:

```js
const ARENA_LAYER_KEYS = ['far', 'mid', 'near'];
// ring kit: flat key -> file (any missing piece stays procedural)
await Promise.all(Object.entries(manifest.ring || {}).map(async ([key, file]) => {
  try { registerRing(key, await loadImage(`${base}/${file}`)); count++; }
  catch { /* piece stays procedural */ }
}));
// arena scenes: sceneId -> sub-dir of far/mid/near.png (any subset is fine)
await Promise.all(Object.entries(manifest.arenas || {}).map(([scene, dir]) =>
  Promise.all(ARENA_LAYER_KEYS.map(async (layer) => {
    try { registerArenaLayer(scene, layer, await loadImage(`${base}/${dir}/${layer}.png`)); count++; }
    catch { /* layer stays procedural */ }
  }))));
```

- [ ] **Step 3: Manifest entries.** Add to `assets/sprites/manifest.json`: `"ring": {}` and `"arenas": {}` (Tasks 5/6/11 fill them). Verify JSON stays valid: `python3 -c "import json;json.load(open('assets/sprites/manifest.json'))"`.

- [ ] **Step 4: Verify both paths.** `python3 tools/devserver.py` → load the game, console shows the usual `[PAWNCH] loaded N sprite(s)` with no errors and identical N (empty groups add nothing). Play one boxing half — pixel-identical to before.

- [ ] **Step 5: Commit**

```bash
git add src/gfx.js src/assets.js assets/sprites/manifest.json
git commit -m "feat(assets): ring + arena-layer manifest groups (empty for now, per-piece fallback)"
```

---

### Task 3: `tools/arena-preview.html` QA harness

**Files:**
- Create: `tools/arena-preview.html`

**Interfaces:**
- Consumes: `drawScene`/`sceneFor` (scenery.js), `ring` (gfx.js) — and later auto-upgrades: it feature-detects `src/ring.js` + `src/lighting.js` via dynamic `import()` and uses them when present, so this ONE file serves every later task without edits.
- Produces: browser page at `http://localhost:5174/tools/arena-preview.html` with controls: scene dropdown, crowd slider, IMPACT button, KNOCKDOWN toggle, DECALS button, `?bare=1` to skip `loadAssets()`.

- [ ] **Step 1: Write the harness** (mirror `tools/fighter-preview.html`'s standalone-page pattern):

```html
<!DOCTYPE html><html><head><meta charset="utf-8"><title>PAWNCH arena preview</title>
<style>body{background:#181828;color:#cdd6ff;font:12px monospace;margin:12px}
canvas{image-rendering:pixelated;width:768px;height:672px;border:1px solid #3a4a78}
.row{margin:6px 0}button,select{font:inherit}</style></head><body>
<div class="row">
  <select id="scene"></select>
  crowd <input id="crowd" type="range" min="0" max="100" value="0">
  <button id="impact">IMPACT</button>
  <label><input id="down" type="checkbox"> KNOCKDOWN</label>
  <button id="decals">+DECALS</button>
  <span id="mode"></span>
</div>
<canvas id="cv" width="512" height="448"></canvas>
<script type="module">
import { SCENERY, PAL, FIGHTER } from '../src/config.js';
import { ring } from '../src/gfx.js';
import { drawScene } from '../src/scenery.js';
import { loadAssets } from '../src/assets.js';
import { drawFighter } from '../src/fighter.js';
import { HERO_LOOK, DEFAULT_LOOK } from '../src/opponents.js';

const bare = new URLSearchParams(location.search).has('bare');
if (!bare) await loadAssets('../assets/sprites');
// feature-detect later modules so this harness never needs editing
let RingView = null, L = null;
try { ({ RingView } = await import('../src/ring.js')); } catch {}
try { L = await import('../src/lighting.js'); } catch {}
document.getElementById('mode').textContent =
  (bare ? ' [BARE] ' : ' [ASSETS] ') + (RingView ? '+ring.js ' : '') + (L ? '+lighting.js' : '');

const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const sceneSel = document.getElementById('scene');
for (const id of ['classic', ...SCENERY.OPPONENT_SCENES])
  sceneSel.add(new Option(SCENERY.NAMES[id] || id, id));
const rv = RingView ? new RingView({ floorTop: 170 }) : null;
const flash = L ? new L.Flashbulbs() : null;
document.getElementById('impact').onclick = () => {
  rv?.impact(120 + Math.random() * 272, 1);
  flash?.burst(6);
};
document.getElementById('decals').onclick = () => {
  for (let i = 0; i < 6; i++) rv?.addDecal(180 + Math.random() * 150, 330 + Math.random() * 80, Math.random() < 0.5 ? 'scuff' : 'sweat');
};
let last = performance.now();
(function frame(now) {
  const dt = Math.min(50, now - last); last = now;
  const t = now / 1000, crowd = document.getElementById('crowd').value / 100;
  const down = document.getElementById('down').checked;
  drawScene(ctx, sceneSel.value, { W: 512, floorTop: 170, t, crowd, accent: PAL.blue });
  rv?.update(dt); flash?.update(dt);
  if (rv) rv.draw(ctx, 512, 448, { accent: PAL.orange, crowd, t: now });
  else ring(ctx, 512, 448, { floorTop: 170, accent: PAL.orange, crowd });
  const ex = 256, px = 256;
  if (L) L.reflect(ctx, FIGHTER.ENEMY_FEET_Y, () =>
    drawFighter(ctx, ex, FIGHTER.ENEMY_FEET_Y, FIGHTER.SIZE.enemy, DEFAULT_LOOK, down ? 'down' : 'idle', 1, t * 4));
  drawFighter(ctx, ex, FIGHTER.ENEMY_FEET_Y, FIGHTER.SIZE.enemy, DEFAULT_LOOK, down ? 'down' : 'idle', 1, t * 4);
  drawFighter(ctx, px, FIGHTER.PLAYER_FEET_Y, FIGHTER.SIZE.player, HERO_LOOK, 'idle', -1, t * 4);
  if (L && down) L.spotlightMoment(ctx, 512, 448, ex, FIGHTER.ENEMY_FEET_Y - 40, 1);
  flash?.draw(ctx);
  requestAnimationFrame(frame);
})(last);
</script></body></html>
```

- [ ] **Step 2: Verify.** Serve, open `tools/arena-preview.html` — scenes cycle, legacy ring + two procedural/sprite fighters render, `[BARE]` mode works via `?bare=1`, no console errors. (IMPACT/KNOCKDOWN buttons are inert until later tasks — expected.)

- [ ] **Step 3: Commit**

```bash
git add tools/arena-preview.html
git commit -m "feat(tools): arena-preview QA harness (feature-detects ring.js/lighting.js)"
```

---

### Task 4: Rope physics math + headless tests (TDD)

**Files:**
- Create: `src/ropes.js` (pure, import-free — JSC-suite compatible)
- Create: `src/ropes.test.js`
- Modify: `tools/test/run-headless.js` (MODULES + TESTS arrays), `tools/test/index.html` (import list)

**Interfaces:**
- Produces: `ROPE_DEFAULTS` (config-shaped constants object), `ropeOffset(x, W, tMs, impulses, C, phase)` → px offset (sag + idle sway + impulse waves), `pruneImpulses(impulses, tMs, C)` → filtered array. Impulse = `{ x, t0, mag }` (pixel x, birth ms, strength 0..1].
- Note: `ROPE_DEFAULTS` lives here (not config.js) so the module stays import-free for JSC; `config.js` `RING.ROPES` (Task 7) spreads/overrides it — config remains the tuning surface.

- [ ] **Step 1: Write the failing tests** `src/ropes.test.js` (exact header convention of `src/sim/rng.test.js`):

```js
import { suite, test, assert } from '../tools/test/runner.js';
import { ropeOffset, pruneImpulses, ROPE_DEFAULTS } from './ropes.js';

suite('ropes');

test('quiet rope is bounded by sag + idle amplitude', () => {
  for (let x = 0; x <= 512; x += 32) {
    const y = ropeOffset(x, 512, 5000, []);
    assert(Math.abs(y) <= ROPE_DEFAULTS.SAG + ROPE_DEFAULTS.IDLE_AMP + 0.001, 'bounded at x=' + x);
  }
});

test('an impulse peaks near the impact then decays to ~quiet', () => {
  const im = [{ x: 256, t0: 1000, mag: 1 }];
  let peak = 0;
  for (let t = 1000; t < 1600; t += 16) peak = Math.max(peak, Math.abs(ropeOffset(256, 512, t, im) - ropeOffset(256, 512, t, [])));
  assert(peak > 3, 'wave should visibly move the rope, peak=' + peak);
  const late = Math.abs(ropeOffset(256, 512, 1000 + ROPE_DEFAULTS.DEAD_MS + 100, im) - ropeOffset(256, 512, 1000 + ROPE_DEFAULTS.DEAD_MS + 100, []));
  assert(late < 0.2, 'wave should die out, late=' + late);
});

test('impulse influence falls off with distance', () => {
  const im = [{ x: 100, t0: 0, mag: 1 }];
  let near = 0, far = 0;
  for (let t = 0; t < 500; t += 16) {
    near = Math.max(near, Math.abs(ropeOffset(110, 512, t, im) - ropeOffset(110, 512, t, [])));
    far = Math.max(far, Math.abs(ropeOffset(480, 512, t, im) - ropeOffset(480, 512, t, [])));
  }
  assert(near > far * 3, `near ${near} should dwarf far ${far}`);
});

test('pruneImpulses drops dead, keeps live', () => {
  const im = [{ x: 0, t0: 0, mag: 1 }, { x: 0, t0: 5000, mag: 1 }];
  const kept = pruneImpulses(im, 5000 + 10);
  assert(kept.length === 1 && kept[0].t0 === 5000, 'only the live impulse remains');
});
```

- [ ] **Step 2: Register + run to verify FAIL.** Add `'src/ropes.js'` to `MODULES` and `'src/ropes.test.js'` to `TESTS` in `tools/test/run-headless.js`; add `import '../../src/ropes.test.js';` to `tools/test/index.html` (keep the two in sync — the file says so). Run: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` → expect failure naming ropes (module missing).

- [ ] **Step 3: Implement `src/ropes.js`:**

```js
// Pure rope-wave math for the ring's three ropes: catenary sag + idle sway +
// traveling, damped impact waves. NO imports — this file also runs inside the
// JSC headless test suite (tools/test/run-headless.js). Tuning enters the game
// via config.js RING.ROPES (which starts from these defaults).
export const ROPE_DEFAULTS = {
  SAG: 4,          // px of catenary sag at mid-span
  IDLE_AMP: 0.7,   // px of idle sway
  IDLE_HZ: 0.35,   // idle sway speed (cycles/sec)
  WAVE_AMP: 9,     // px peak of a full-strength impulse wave
  WAVE_HZ: 7,      // wave oscillation speed
  WAVE_K: 0.035,   // spatial ripple frequency along the rope
  FALLOFF: 130,    // px distance falloff from the impact point
  DECAY_MS: 650,   // exponential time decay of a wave
  DEAD_MS: 2600,   // impulses older than this contribute ~nothing and are pruned
};

// Vertical offset (px, +down) of a rope at pixel x. `impulses` = [{x, t0, mag}].
export function ropeOffset(x, W, tMs, impulses, C = ROPE_DEFAULTS, phase = 0) {
  const sag = Math.sin((x / W) * Math.PI) * C.SAG;
  const idle = Math.sin((tMs / 1000) * C.IDLE_HZ * Math.PI * 2 + phase + x * 0.01) * C.IDLE_AMP;
  let wave = 0;
  for (let i = 0; i < impulses.length; i++) {
    const im = impulses[i];
    const age = tMs - im.t0;
    if (age < 0 || age > C.DEAD_MS) continue;
    const d = Math.abs(x - im.x);
    wave += C.WAVE_AMP * im.mag
      * Math.exp(-d / C.FALLOFF)
      * Math.exp(-age / C.DECAY_MS)
      * Math.sin((age / 1000) * C.WAVE_HZ * Math.PI * 2 - d * C.WAVE_K);
  }
  return sag + idle + wave;
}

export function pruneImpulses(impulses, tMs, C = ROPE_DEFAULTS) {
  return impulses.filter((im) => tMs - im.t0 <= C.DEAD_MS);
}
```

- [ ] **Step 4: Run tests to verify PASS.** Same command; expect `[TESTS] <previous+4> passed, 0 failed`. Also open `tools/test/index.html` in the browser once — green.

- [ ] **Step 5: Commit**

```bash
git add src/ropes.js src/ropes.test.js tools/test/run-headless.js tools/test/index.html
git commit -m "feat(ring): pure rope-wave physics with headless tests"
```

---

### Task 5: Paint the mat (`assets/sprites/ring/mat.png`)

**Files:**
- Create: `assets/sprites/ring/mat.png` (512×278, opaque)
- Create: `assets/aseprite/ring-mat.aseprite` (layered master, via `save_as`)
- Modify: `assets/sprites/manifest.json` (`"ring": { "mat": "ring/mat.png" }`)

**Interfaces:**
- Produces: `mat.png` blitted by RingView (Task 7) at screen (0,170). Asset-space = screen-y − 170.

**Art spec (paint with the pixel-art-professional techniques; palette = `pawnch-master.gpl` only):**
- Geometry: apron band rows y0–8 full-width; mat trapezoid from (82,8)/(430,8) to (0,278)/(512,278); the two upper-corner triangles OUTSIDE the trapezoid are ringside void — fill `ink0→ink1` vertical gradient (they read as darkness beside the ring).
- Apron band: `mat1` base, `gold1` running trim stitch (1px dashes), post-shadow darkening at both ends (`mat0`).
- Mat surface: `mat2` base; 6 perspective seam lines (converging exactly like the current code bands: edges lerp from x 82/430 at y8 to 0/512 at y278) drawn 1px `mat1`; worn lighter center — an irregular radial region around (256,190) stepping `mat3→mat4` with clustered (not noise) edges; sparse 2×2 weave dither `mat1`-on-`mat2` at ~8% density outside the worn zone; a few `mat0` scuff streaks angled toward camera.
- Emblem centered (256, 208): crowned-pawn silhouette inside a sunburst ring, footprint ≈ 240×68 ellipse, perspective-squashed. Colors: rays `gold0`, ring `gold1`, pawn body `mat4` with `gold1` crown, tiny `gold3` glints (≤6 px total). Keep LOW contrast vs the mat (it must read as printed-on-canvas, not float) — value distance from `mat2` stays small; no `spec0/1` here.
- Lighting: overhead key — subtle top-edge lightening (`mat3`) along the y8 edge, corners 1 step darker.

- [ ] **Step 1: Canvas + palette.** `create_canvas` 512×278 RGB; load/`set_palette` from the master GPL. Layers: `void`, `apron`, `mat-base`, `seams`, `wear`, `emblem`, `scuffs`.
- [ ] **Step 2: Block in** all geometry flat (fills + lines per spec above). `export_sprite` → `tools/_scratch/mat-block.png`; Read it; check geometry against the numbers (esp. trapezoid corners at x82/x430).
- [ ] **Step 3: Shade + texture pass** (worn center clusters, weave dither, seam shading, emblem ramp, apron stitch). Anti-alias only along the emblem curves (suggest_antialiasing / manual, same-ramp neighbors only).
- [ ] **Step 4: QA gate.** `save_as` → `assets/aseprite/ring-mat.aseprite`; flatten-export → `assets/sprites/ring/mat.png`. It's opaque so Read it directly at full size AND `--scale 2` via check_alpha (checker proves no stray transparency). Add the manifest entry. Open `tools/arena-preview.html`: the mat must sit under the legacy ropes/posts without seams at y170 or the screen edges; worn center visible but subtle; emblem readable but not floating. Iterate until it honestly reads as hand-painted hi-bit (unforgiving bar — see Art Bible v2).
- [ ] **Step 5: Commit**

```bash
git add assets/sprites/ring/mat.png assets/aseprite/ring-mat.aseprite assets/sprites/manifest.json
git commit -m "feat(art): hand-painted hi-bit ring mat + emblem (V1)"
```

---

### Task 6: Paint posts, turnbuckle pads, stool, press row

**Files:**
- Create: `assets/sprites/ring/post.png` (30×84, transparent bg), `assets/sprites/ring/pad.png` (24×11, GRAYSCALE ramp, transparent bg), `assets/sprites/ring/stool.png` (40×44, transparent), `assets/sprites/ring/press.png` (512×56, transparent except corner clusters)
- Create: matching `assets/aseprite/ring-*.aseprite` masters
- Modify: `assets/sprites/manifest.json` (add the four entries under `"ring"`)

**Interfaces:**
- Produces: `post.png` drawn at screen (8,110) left and mirrored at right so its outer edge lands at x=504 (RingView Task 7 blits with `scale(-1,1)`); `pad.png` painted in white→gray steps (`spec1/steel3/steel1`) so RingView tints it per-opponent via `source-atop`; anchor pads at rope ys 130/144/158; `stool.png` at the blue corner (screen ≈ (10,150)), drawn only when `opts.stool`; `press.png` bottom-anchored at (0, 392) with silhouette clusters ONLY in x0–150 and x362–512 (middle stays clear of the player).

**Art spec:** post = cool steel ramp (`ink2→steel2`), 2px cap `steel3`, rivet dots, 1px `blue1` rim-light on the arena side, small lamp housing on the cap (`gold1` housing, unlit — code adds the glow). Stool = wood ramp legs, `blue3` seat, towel fold `spec1`/`steel4` draped. Press = hunched photographer/commentator silhouettes in `ink0/ink1` with tiny `blue5` laptop-glow and `steel3` lens glints; shapes must read at a glance but stay near-black (they live in front of the bright mat).

- [ ] **Step 1: Paint `post.png` + `pad.png`** per spec (pad in pure grayscale steps — the tint pass supplies hue). QA each: check_alpha checkerboard → Read (cutout clean, no halo pixels), then preview harness.
- [ ] **Step 2: Paint `stool.png`**, same QA loop.
- [ ] **Step 3: Paint `press.png`**, same QA loop; verify the transparent middle (x150–362) is truly empty on the checkerboard.
- [ ] **Step 4: Manifest + verify.** Add `"post"`, `"pad"`, `"stool"`, `"press"` entries; reload preview (assets mode) — pieces don't draw yet (RingView lands next task) but the console must show 4 more sprites loaded and no errors.
- [ ] **Step 5: Commit**

```bash
git add assets/sprites/ring/*.png assets/aseprite/ring-post.aseprite assets/aseprite/ring-pad.aseprite assets/aseprite/ring-stool.aseprite assets/aseprite/ring-press.aseprite assets/sprites/manifest.json
git commit -m "feat(art): painted ring kit — posts, tintable pads, corner stool, press row"
```

---

### Task 7: `RingView` — compose the kit, physical ropes, integrate

**Files:**
- Create: `src/ring.js`
- Modify: `src/config.js` (add `RING` block), `src/states/boxing.js` (use RingView + impact hooks), `src/states/roundbreak.js`, `src/states/tutorialbox.js` (use RingView; roundbreak passes `stool: true`)

**Interfaces:**
- Consumes: `ringSprite` (gfx.js T2), `ropeOffset/pruneImpulses` (T4), `RING` config.
- Produces: `class RingView { constructor({floorTop = 170}); impact(x, mag); addDecal(x, y, kind); clearDecals(); update(dt); draw(ctx, W, H, {accent, crowd = 0, t = 0, stool = false}) }`. `t` is ms. Decal kinds: `'scuff' | 'sweat'`.
- `walk.js` intentionally keeps legacy `gfx.ring()` (distant table view).

- [ ] **Step 1: `RING` config block** in `src/config.js`:

```js
// Ring presentation (src/ring.js): rope physics, mat decals, reflections.
export const RING = {
  ROPES: { SAG: 4, IDLE_AMP: 0.7, IDLE_HZ: 0.35, WAVE_AMP: 9, WAVE_HZ: 7, WAVE_K: 0.035, FALLOFF: 130, DECAY_MS: 650, DEAD_MS: 2600 },
  DECALS: { MAX: 24, SCUFF_ALPHA: 0.16, SWEAT_ALPHA: 0.22 },
  REFLECT: { ALPHA: 0.13, SQUASH: 0.45 },
  PRESS_FLASH_POINTS: [[40, 418], [112, 410], [430, 414], [482, 420]], // lens xy on press.png row
};
```

- [ ] **Step 2: Write `src/ring.js`:**

```js
// The physical ring as a stateful view: painted kit pieces (mat/post/pad/stool/
// press) when loaded, per-piece procedural fallback otherwise, plus DYNAMIC
// ropes (src/ropes.js waves), accent-tinted turnbuckle pads, and fight-memory
// mat decals. Presentation-only — owns no gameplay state.
import { RING, PAL } from './config.js';
import { ringSprite, ring as legacyRing, mix, shade, mixA } from './gfx.js';
import { ropeOffset, pruneImpulses } from './ropes.js';

export class RingView {
  constructor({ floorTop = 170 } = {}) {
    this.floorTop = floorTop;
    this.impulses = [];
    this.decals = [];
    this.t = 0;
    this._padTint = null;      // offscreen accent-tinted pad cache
    this._padAccent = null;
  }
  impact(x, mag = 1) { this.impulses.push({ x, t0: this.t, mag: Math.min(1, mag) }); }
  addDecal(x, y, kind = 'scuff') {
    this.decals.push({ x, y, kind, r: 3 + Math.random() * 5, a: Math.random() * Math.PI });
    if (this.decals.length > RING.DECALS.MAX) this.decals.shift();
  }
  clearDecals() { this.decals = []; }
  update(dt) { this.t += dt; this.impulses = pruneImpulses(this.impulses, this.t, RING.ROPES); }

  draw(ctx, W, H, { accent = PAL.blue, crowd = 0, stool = false } = {}) {
    const ft = this.floorTop;
    const mat = ringSprite('mat');
    if (!mat) {
      // zero-asset path: the legacy ring, untouched and pixel-identical — do NOT
      // layer dynamic ropes/pads over it (double-draw ghosting).
      legacyRing(ctx, W, H, { floorTop: ft, accent, crowd });
      return;
    }
    ctx.drawImage(mat, 0, ft);
    // accent band along the apron strip (painted neutral; opponent hue here)
    ctx.fillStyle = mixA(accent, 0.28); ctx.fillRect(0, ft + 2, W, 4);
    this._drawDecals(ctx);
    this._ropes(ctx, W, accent);
    this._posts(ctx, W, accent);
    if (stool) { const st = ringSprite('stool'); if (st) ctx.drawImage(st, 10, ft - 20); }
  }

  // press row is drawn SEPARATELY (in front of the fighters) by the caller
  drawPress(ctx, W, H) {
    const press = ringSprite('press');
    if (press) ctx.drawImage(press, 0, H - press.height);
  }

  _drawDecals(ctx) {
    for (const d of this.decals) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
      if (d.kind === 'sweat') {
        ctx.globalAlpha = RING.DECALS.SWEAT_ALPHA; ctx.fillStyle = PAL.blueLite;
        ctx.beginPath(); ctx.ellipse(0, 0, d.r * 0.5, d.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = RING.DECALS.SCUFF_ALPHA; ctx.fillStyle = PAL.ink;
        ctx.fillRect(-d.r, -1, d.r * 2, 2);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  _ropes(ctx, W, accent) {
    const C = RING.ROPES, ft = this.floorTop;
    const ropes = [
      { y: ft - 40, body: PAL.orange, hi: PAL.gold },
      { y: ft - 26, body: '#e8f2ff', hi: PAL.white },
      { y: ft - 12, body: accent, hi: mix(accent, '#ffffff', 0.5) },
    ];
    ropes.forEach((r, i) => {
      for (let x = 0; x <= W; x += 8) {
        const off = ropeOffset(x, W, this.t, this.impulses, C, i * 1.7);
        const y = Math.round(r.y + off);
        ctx.fillStyle = shade(r.body, -35); ctx.fillRect(x, y + 2, 9, 1);   // under-shade
        ctx.fillStyle = r.body; ctx.fillRect(x, y, 9, 2);                   // body
        ctx.fillStyle = r.hi; ctx.fillRect(x, y, 9, 1);                     // top highlight
      }
    });
  }

  _posts(ctx, W, accent) {
    const ft = this.floorTop, post = ringSprite('post');
    const ropeYs = [ft - 40, ft - 26, ft - 12];
    for (const side of [0, 1]) {
      const flip = side === 1;
      if (post) {
        ctx.save();
        if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
        ctx.drawImage(post, 8, ft - 60);
        ctx.restore();
      } else {                // painted mat but no post sprite: legacy post bits
        const px = flip ? W - 24 : 8;
        ctx.fillStyle = '#0e1430'; ctx.fillRect(px, ft - 52, 16, 66);
        ctx.fillStyle = shade(accent, -20); ctx.fillRect(px - 1, ft - 52, 18, 4);
      }
      const pad = this._tintedPad(accent);
      for (const ry of ropeYs) {
        const off = ropeOffset(flip ? W - 2 : 2, W, this.t, this.impulses, RING.ROPES, 0);
        const px = flip ? W - 24 : 8;
        if (pad) ctx.drawImage(pad, px - 2, Math.round(ry + off) - 3);
        else { ctx.fillStyle = accent; ctx.fillRect(px - 2, Math.round(ry + off) - 2, 20, 9); }
      }
    }
  }

  // pad.png is painted in grayscale; tint it once per accent via source-atop
  _tintedPad(accent) {
    const pad = ringSprite('pad');
    if (!pad) return null;
    if (this._padAccent !== accent) {
      const cv = (this._padTint ||= document.createElement('canvas'));
      cv.width = pad.width; cv.height = pad.height;
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      c.drawImage(pad, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = mixA(accent, 0.55); c.fillRect(0, 0, cv.width, cv.height);
      c.globalCompositeOperation = 'source-over';
      this._padAccent = accent;
    }
    return this._padTint;
  }
}
```

- [ ] **Step 3: Integrate.** `boxing.js`: in `enter()` add `this.ringView = new RingView({ floorTop: 170 }); this.ringView.clearDecals();` — in `update()` call `this.ringView.update(dt);` — in `draw()` replace the `ring(ctx, …)` call (line ~167) with `this.ringView.draw(ctx, W, H, { accent: this.accent, crowd: this.crowd, t: this.t * 1000 });` and add `this.ringView.drawPress(ctx, W, H);` right after the player `drawFighter` call (before `_hud`). In the `onHit` hook add `this.ringView.impact(side === 'player' ? game.W / 2 + this.match.player.offset : game.W / 2 + this.match.enemy.offset, Math.min(1, dmg / 16));` and in `onKnockdown` add `this.ringView.impact(game.W / 2, 1);`. `roundbreak.js` / `tutorialbox.js`: swap `ring(…)` for a local `new RingView({floorTop:170})` (module-level instance is fine; roundbreak passes `stool: true`). Remove now-unused `ring` imports.
- [ ] **Step 4: Verify three ways.** (a) Preview harness: IMPACT ripples all three ropes, pads carry the accent, press row sits in the corners. (b) `?bare=1`: pixel-identical legacy ring (fallback intact). (c) Live game: full boxing half — ropes ripple on hits, no `[PAWNCH] frame error`, tutorial + round break still render.
- [ ] **Step 5: Commit**

```bash
git add src/ring.js src/config.js src/states/boxing.js src/states/roundbreak.js src/states/tutorialbox.js
git commit -m "feat(ring): RingView — painted kit + physical ropes + tinted pads, per-piece fallback"
```

---

### Task 8: `src/lighting.js` — glow, spotlight, reflections, flashbulbs

**Files:**
- Create: `src/lighting.js`
- Modify: `src/config.js` (add `LIGHT` block)

**Interfaces:**
- Consumes: `LIGHT`, `RING` config; `withA` from gfx.js.
- Produces: `additiveGlow(ctx, x, y, r, color, a)`; `spotCone(ctx, {cx, topY, floorY, topHalfW, botHalfW, color, alpha})`; `dimHole(ctx, W, H, cx, cy, holeR, alpha)`; `tintWash(ctx, W, H, color, alpha)` (unused in V1 game code — it ships for the V2 per-scene key-light wash); `reflect(ctx, feetY, drawCb)` (flip+squash+alpha around feetY); `spotlightMoment(ctx, W, H, cx, cy, k)` (composed dim+cone+motes, k 0..1 ease); `class Flashbulbs { burst(n); update(dt); draw(ctx) }` (burst positions come from `RING.PRESS_FLASH_POINTS`).
- **Deliberate deferral:** the spec §1/§6 fighter **rim-light** pass (offscreen `source-atop` masking) is deferred to V2, where the Beach pilot's declared key light gives it a real target — V1 ships glow/spotlight/reflection/flash only. Noted here so it isn't a silent gap.

- [ ] **Step 1: `LIGHT` config block:**

```js
// Lighting/FX presentation (src/lighting.js).
export const LIGHT = {
  SPOT: { EASE_MS: 240, DIM: 0.78, CONE_ALPHA: 0.22, TOP_HALF_W: 26, HOLE_R: 150 },
  FLASH: { LIFE_MS: 190, BIG_HIT: 5, KNOCKDOWN: 12, PARRY: 4, SCATTER: 60 },
};
```

- [ ] **Step 2: Write `src/lighting.js`:**

```js
// Additive-light helpers over crisp pixels — the hi-bit "glow pass" (spec §1).
// Presentation-only; every function draws and restores state.
import { LIGHT, RING, PAL } from './config.js';
import { withA } from './gfx.js';

export function additiveGlow(ctx, x, y, r, color, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withA(color, a)); g.addColorStop(1, withA(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function spotCone(ctx, { cx, topY, floorY, topHalfW, botHalfW, color, alpha }) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, topY, 0, floorY);
  g.addColorStop(0, withA(color, alpha)); g.addColorStop(1, withA(color, alpha * 0.25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - topHalfW, topY); ctx.lineTo(cx + topHalfW, topY);
  ctx.lineTo(cx + botHalfW, floorY); ctx.lineTo(cx - botHalfW, floorY);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// darkness with a soft transparent hole — the knockdown dim
export function dimHole(ctx, W, H, cx, cy, holeR, alpha) {
  const g = ctx.createRadialGradient(cx, cy, holeR * 0.45, cx, cy, Math.max(W, H));
  g.addColorStop(0, 'rgba(3,4,10,0)'); g.addColorStop(0.55, `rgba(3,4,10,${alpha})`);
  g.addColorStop(1, `rgba(3,4,10,${alpha})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

export function tintWash(ctx, W, H, color, alpha) {
  if (alpha <= 0) return;
  ctx.fillStyle = withA(color, alpha); ctx.fillRect(0, 0, W, H);
}

// faint flipped reflection on the glossy mat: run drawCb mirrored about feetY
export function reflect(ctx, feetY, drawCb) {
  const R = RING.REFLECT;
  ctx.save();
  ctx.translate(0, feetY); ctx.scale(1, -R.SQUASH); ctx.translate(0, -feetY);
  ctx.globalAlpha = R.ALPHA;
  drawCb();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// the knockdown spotlight: dim world + cone + drifting dust motes. k = 0..1.
export function spotlightMoment(ctx, W, H, cx, cy, k, t = performance.now() / 1000) {
  if (k <= 0) return;
  const S = LIGHT.SPOT;
  dimHole(ctx, W, H, cx, cy, S.HOLE_R, S.DIM * k);
  spotCone(ctx, { cx, topY: 0, floorY: cy + 40, topHalfW: S.TOP_HALF_W, botHalfW: S.HOLE_R * 0.8, color: PAL.gold, alpha: S.CONE_ALPHA * k });
  for (let i = 0; i < 8; i++) {   // dust motes drifting down the beam
    const mx = cx + Math.sin(t * 0.7 + i * 2.4) * (14 + i * 6);
    const my = ((t * 26 + i * 53) % (cy + 30));
    ctx.fillStyle = `rgba(255,231,168,${0.25 * k})`; ctx.fillRect(mx | 0, my | 0, 1, 1);
  }
}

// press-row camera flashes: short white pops with a glow halo
export class Flashbulbs {
  constructor() { this.pops = []; }
  burst(n) {
    const pts = RING.PRESS_FLASH_POINTS;
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[(Math.random() * pts.length) | 0];
      this.pops.push({
        x: x + (Math.random() - 0.5) * LIGHT.FLASH.SCATTER,
        y: y + (Math.random() - 0.5) * 10,
        life: LIGHT.FLASH.LIFE_MS * (0.6 + Math.random() * 0.8),
        max: LIGHT.FLASH.LIFE_MS, delay: Math.random() * 260,
      });
    }
  }
  update(dt) {
    for (const p of this.pops) { if (p.delay > 0) p.delay -= dt; else p.life -= dt; }
    this.pops = this.pops.filter((p) => p.life > 0);
  }
  draw(ctx) {
    for (const p of this.pops) {
      if (p.delay > 0) continue;
      const k = p.life / p.max;
      additiveGlow(ctx, p.x, p.y, 14, '#ffffff', 0.5 * k);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
      ctx.fillRect((p.x - 1) | 0, (p.y - 1) | 0, 3, 3);
    }
  }
}
```

- [ ] **Step 3: Verify in the harness.** Reload `tools/arena-preview.html` (it feature-detects lighting.js): IMPACT now also fires flashbulb pops at the press row; KNOCKDOWN toggle dims the arena with a gold cone + motes over the downed dummy; reflections appear under the enemy. `?bare=1` still clean.
- [ ] **Step 4: Commit**

```bash
git add src/lighting.js src/config.js
git commit -m "feat(fx): lighting layer — additive glow, spotlight moment, reflections, flashbulbs"
```

---

### Task 9: Wire the fight — reflections, decals, flashes, spotlight in `boxing.js`

**Files:**
- Modify: `src/states/boxing.js`

**Interfaces:**
- Consumes: `RingView` (T7), `reflect/spotlightMoment/Flashbulbs` (T8), `LIGHT` config.

- [ ] **Step 1: State.** In `enter()`: `this.flash = new Flashbulbs(); this.spotK = 0;` (import from `../lighting.js`; import `LIGHT` from config).
- [ ] **Step 2: Hooks.** In `onHit` (after the existing juice): `if (dmg > 12) this.flash.burst(LIGHT.FLASH.BIG_HIT);` and add a decal at the victim's feet: `this.ringView.addDecal(game.W / 2 + (side === 'player' ? this.match.player.offset : this.match.enemy.offset) + (Math.random() - 0.5) * 30, (side === 'player' ? 400 : FIGHTER.ENEMY_FEET_Y + 8) + Math.random() * 10, Math.random() < 0.5 ? 'scuff' : 'sweat');` In `onKnockdown`: `this.flash.burst(LIGHT.FLASH.KNOCKDOWN);` In `onParry`: `this.flash.burst(LIGHT.FLASH.PARRY);`
- [ ] **Step 3: Update.** In `update()`: `this.flash.update(dt);` and ease the spotlight: `const anyDown = this.match.player.pose === 'down' || this.match.enemy.pose === 'down'; this.spotK = Math.max(0, Math.min(1, this.spotK + (anyDown ? dt : -dt) / LIGHT.SPOT.EASE_MS));`
- [ ] **Step 4: Draw order** (surgical inserts into `draw()`):
  - after `this.ringView.draw(…)`: reflections — `reflect(ctx, FIGHTER.ENEMY_FEET_Y, () => drawFighter(ctx, ex2, FIGHTER.ENEMY_FEET_Y, FIGHTER.SIZE.enemy, this.enemyLook, mapPose(e).pose, 1, this.t * 4, mapPose(e).info));` (compute `ex2 = W/2 + e.offset` before; skip the player reflection — his feet are off-screen at 452).
  - after the special-front FX line (`drawSpecialFx … 'front'`): `if (this.spotK > 0) { const d = p.pose === 'down' ? p : e; const dx = W / 2 + d.offset, dy = d.side === 'player' ? game.H - 120 : FIGHTER.ENEMY_FEET_Y - 40; spotlightMoment(ctx, W, game.H, dx, dy, this.spotK); }`
  - then `this.ringView.drawPress(ctx, W, game.H); this.flash.draw(ctx);` (press + flashes in front of fighters, behind the HUD).
- [ ] **Step 5: Verify live.** Play a story fight to a knockdown (dev skip combo B+3 if needed): big hits pop flashes + leave decals; the knockdown dims the world and spot-lights the downed fighter under the get-up meter (meter text stays fully readable ON TOP — if not, raise dim hole radius); rising eases the light back. New round's boxing half starts with a clean mat (decals cleared in enter). Attack tells remain plainly readable through every effect. No frame errors.
- [ ] **Step 6: Commit**

```bash
git add src/states/boxing.js
git commit -m "feat(boxing): living ring — reflections, fight-memory decals, flashbulbs, knockdown spotlight"
```

---

### Task 10: CLASSIC arena — painted layers + layered-scene support

**Files:**
- Create: `assets/sprites/arenas/classic/mid.png` (512×170, opaque), `assets/aseprite/arena-classic.aseprite`
- Modify: `src/scenery.js` (layered-scene support + classic v2 FX), `src/config.js` (`SCENERY.SCENES.classic` knobs), `assets/sprites/manifest.json` (`"arenas": { "classic": "arenas/classic" }`)

**Interfaces:**
- Consumes: `arenaLayers` (T2), `additiveGlow/spotCone` (T8).
- Produces: generic layered-scene mechanism — a scene object may define `drawLayered(ctx, p, layers)`; `drawScene` prefers it when `arenaLayers(id)` exists. V2 (Beach) reuses this mechanism unchanged.

**Art spec `mid.png`:** full 512×170. Top third: `ink0` void with an X-braced light truss (`ink2` beams, `steel1` bolt dots) spanning x60–452 at y6–20, four lamp housings (`gold1` casings) at x≈100/204/308/412 y18; center-top PAWNCH banner ≈150×34 (`ember3` field, `gold2` letters, `ember1` drape shadows). Lower two-thirds: three receding crowd tiers — rows of head/shoulder silhouettes (`ink1` on `ink0`, back tier smallest), aisle gaps, a `blue1` rail line per tier; ~20 unlit phone-dot spots (`ink2`) that the code twinkles. Corners darken 1 step. No pure black; lamp glow comes from code.

- [ ] **Step 1: Layered support in `scenery.js`.** Import `arenaLayers` from gfx.js; change `drawScene`:

```js
export function drawScene(ctx, id, p) {
  const scene = SCENES[id] || SCENES.classic;
  const layers = arenaLayers(id);
  if (layers && scene.drawLayered) return scene.drawLayered(ctx, p, layers);
  scene.draw(ctx, p);
}
```

- [ ] **Step 2: Classic v2 knobs** in `SCENERY.SCENES` (config.js): `classic: { lampXs: [100, 204, 308, 412], lampY: 20, cone: '#cdd6ff', coneA: 0.10, haze: '#3a4a78', phone: '#b8d0ff', phoneN: 22, twinkleHz: 2 }`.

- [ ] **Step 3: Classic `drawLayered`** in scenery.js (keep `classicScene` untouched as the fallback `draw`):

```js
SCENES.classic.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd, accent } = p; const C = SCENERY.SCENES.classic;
  sky(ctx, W, floorTop, ['#070a16', '#0d1226']);
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  for (const lx of C.lampXs) {                       // truss lamps: glow + breathing cones
    const breathe = 0.85 + 0.15 * Math.sin(t * 1.3 + lx);
    additiveGlow(ctx, lx, C.lampY, 10, C.cone, 0.5 * breathe);
    spotCone(ctx, { cx: lx, topY: C.lampY, floorY: floorTop, topHalfW: 5, botHalfW: 34, color: C.cone, alpha: C.coneA * breathe + crowd * 0.04 });
  }
  for (let i = 0; i < 2; i++)                        // drifting smoke haze through the beams
    additiveGlow(ctx, drift(t, 4 + i * 3, W, 60, i * 200), 34 + i * 22, 46, C.haze, 0.05);
  for (let i = 0; i < C.phoneN; i++)                 // phone-light pinpricks in the tiers
    twinkle(ctx, hash(i) * W, floorTop * (0.45 + 0.4 * hash(i + 3)), 1, C.phone, t * C.twinkleHz, i * 1.9);
  if (crowd > 0.01) { ctx.fillStyle = mixA(accent, crowd * 0.16); ctx.fillRect(0, 0, W, floorTop); }
};
```

(Import `additiveGlow`, `spotCone` from `./lighting.js` at the top of scenery.js.)

- [ ] **Step 4: Paint `mid.png`** per the art spec (block → shade → QA loop; it's opaque so Read directly). Save the `.aseprite` master. Add the manifest `arenas` entry.
- [ ] **Step 5: Verify.** Harness: CLASSIC now shows truss + cones + haze + twinkling tiers behind the painted ring; crowd slider flares it; `?bare=1` yields the untouched procedural classic. Live: a multiplayer/hotseat match (classic is the default arena) looks right and Story opponents' procedural scenes still render unregressed.
- [ ] **Step 6: Commit**

```bash
git add src/scenery.js src/config.js assets/sprites/arenas/classic/mid.png assets/aseprite/arena-classic.aseprite assets/sprites/manifest.json
git commit -m "feat(art): CLASSIC arena v2 — painted truss/crowd layer + volumetric cones + haze (layered-scene support)"
```

---

### Task 11: Full-game verification sweep + docs

**Files:**
- Modify: `CLAUDE.md` (30-second tour + verify section), `docs/superpowers/specs/2026-07-20-visual-overhaul-design.md` (status line)

- [ ] **Step 1: Headless suite green.** `osascript -l JavaScript tools/test/run-headless.js "$PWD"` → `0 failed`.
- [ ] **Step 2: Zero-asset boot.** Temporarily `mv assets/sprites/manifest.json /tmp/…` (or use the harness `?bare=1` AND a full game load with the manifest renamed) → title, tutorial-box, a story round, round break all render on pure procedural art. Restore the manifest.
- [ ] **Step 3: Full sweep with assets.** Title → Story fight 1 → chess half → boxing half with: rope ripples, decals accumulating, flashbulbs, a knockdown spotlight + readable get-up meter, round break (stool visible), tells readable throughout, 60fps feel, zero `[PAWNCH] frame error` lines. Check tutorialbox + walk states unbroken.
- [ ] **Step 4: Docs.** CLAUDE.md tour: add one line each for `src/ring.js` (RingView — painted ring kit + physical ropes + decals), `src/lighting.js` (glow/spotlight/reflection/flash pass), `src/ropes.js` (pure rope math, headless-tested), and note `tools/arena-preview.html` under "Verifying a change". Spec: flip V1 row to DONE with commit range.
- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-07-20-visual-overhaul-design.md
git commit -m "docs: V1 ring + lighting foundation shipped — tour, verify notes, spec status"
```
