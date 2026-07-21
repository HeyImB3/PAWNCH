# Visual Overhaul V2 — Beach Arena Pilot: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first fully painted arena — Patty's TROPICAL BEACH at golden hour — as 3 parallax layers + a living FX pass, and pilot the per-scene key-light system (fighter rim light + golden tint wash) deferred from V1.

**Architecture:** The V1 mechanisms carry everything: `arenas` manifest group → `registerArenaLayer` → `SCENES.beach.drawLayered(ctx, p, layers)`; painted layers come from a deterministic PIL painter (`tools/paint_beach.py`) sharing a new `tools/pawnch_palette.py` module with `paint_ring.py`. Art direction: **backlit golden hour** — the sky/sun are the brightest elements, everything terrestrial is a warm-rimmed silhouette, keeping the fighters' contrast band untouchable. The procedural `beachScene` stays the zero-asset fallback.

**Tech Stack:** Vanilla ES modules, Canvas 2D, PIL painter scripts (tools/.venv), Aseprite MCP for `.aseprite` masters, headless-Chrome harness QA.

## Global Constraints

- Everything from the V1 plan's Global Constraints applies verbatim (no deps; tuning in `config.js`; presentation-only, never touches `src/sim/*`; zero-asset boot works; native-res pixels; readability beats spectacle; commit per task).
- Master palette only (`assets/aseprite/pawnch-master.gpl`). The dusk sky is built from the EXISTING ramps: ink0→blue0→ember1→ember2→ember3→gold1 — no new colors.
- Scene layers are 512×170 (the backdrop region above `floorTop=170`). `drawLayered` draw order: far → sky-side FX → mid → ground FX → near → crowd flare (same contract classic v2 established).
- Scene draws stay PURE functions of `t`/`crowd` (scenery.js doctrine — resume-safe, no retained state). The rare crab event is therefore a deterministic `t`-schedule, not stored state.
- Harness QA commands: `?scene=beach`, `?scene=beach&crowd=60`, `?bare=1` (procedural fallback must be pixel-identical to today's).
- Suite must stay green: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` → `[TESTS] 66 passed, 0 failed` (V2 adds no unit-testable pure logic; regression only).

---

### Task 1: Shared palette module (`tools/pawnch_palette.py`)

**Files:**
- Create: `tools/pawnch_palette.py`
- Modify: `tools/paint_ring.py` (delete its local constants + `n2`, import instead)

**Interfaces:**
- Produces: `INK0 INK1 INK2 STEEL0..STEEL4 MAT0..MAT5 GOLD0..GOLD3 GOLD4 BLUE0 BLUE1 BLUE2 WOOD0..WOOD5 EMBER1..EMBER7 RED0 SPEC0 SPEC1` as `(r,g,b)` tuples, and `n2(x, y, salt=0)` deterministic hash noise. Consumed by `paint_ring.py` (existing names must keep their values EXACTLY) and `tools/paint_beach.py` (Task 2).

- [ ] **Step 1: Write `tools/pawnch_palette.py`** — every ramp from `pawnch-master.gpl` as tuples (copy the RGB values from the .gpl verbatim; the constants already in `paint_ring.py` are the authority for names it uses), plus:

```python
# deterministic hash noise in [0,1) — stable art, no RNG state
import math
def n2(x, y, salt=0):
    h = math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
    return h - math.floor(h)
```

Add the names paint_beach needs that paint_ring lacked: `GOLD4 = (255, 246, 216)`, `BLUE0 = (10, 16, 48)`, `BLUE2 = (31, 79, 192)`, `EMBER2 = (140, 35, 24)`, `EMBER4 = (255, 122, 24)`, `EMBER5 = (255, 154, 58)`, `WOOD0 = (22, 13, 6)`, `WOOD4 = (154, 113, 63)`, `WOOD5 = (201, 155, 98)`, `SPEC0 = (255, 255, 255)`, `SPEC1 = (232, 242, 255)`.

- [ ] **Step 2: Refactor `paint_ring.py`** — replace its palette-constant block and `n2` with `from pawnch_palette import *` (script-dir import; works when invoked as `tools/.venv/bin/python tools/paint_ring.py`). Remove now-duplicate local `SPEC1` definitions inside functions if they shadow identically.
- [ ] **Step 3: Prove byte-identical output.** `tools/.venv/bin/python tools/paint_ring.py all` then `git status --short assets/sprites` → EMPTY (deterministic painter + same constants = unchanged PNGs). Any diff = a constant got mistyped; fix before proceeding.
- [ ] **Step 4: Commit**

```bash
git add tools/pawnch_palette.py tools/paint_ring.py
git commit -m "refactor(tools): shared pawnch_palette module for all arena painters"
```

---

### Task 2: Paint `far.png` — dusk sky, sun, sea (opaque 512×170)

**Files:**
- Create: `tools/paint_beach.py` (painter skeleton + `far`), `assets/sprites/arenas/beach/far.png`

**Interfaces:**
- Produces: `tools/paint_beach.py` with `PIECES = {'far': …, 'mid': …, 'near': …}` and the same `main()` CLI shape as paint_ring (`paint_beach.py far|mid|near|all`), writing into `assets/sprites/arenas/beach/`. Sun center is at **(150, 78)** — Task 5's config `sun: [150, 78]` must match.

**Art spec (backlit golden hour, in-palette dusk ramp):**
- Sky y0–91, horizontal bands blended with `n2`-threshold dithering (hand dither, ~6px transition zones — no hard band lines): ink0 (y0–14) → blue0 (→34) → ember1 (→52) → ember2 (→68) → ember3 (→80) → gold1 (→91). Band boundaries wobble ±2px via `n2(x//9, band, 41)`.
- Sun: disc center (150,78) r14 — gold4 core r9, gold3 rim; a 1px gold3 halo dither ring (code adds the real glow).
- Backlit stratus clouds: 4 flat ellipse-ish silhouette bands (ink1 with a 1px gold2 UNDER-rim on their sun-facing lower-left edges) at ~(90,26,w120,h6), (330,40,w150,h8), (210,56,w90,h5), (420,20,w100,h5) — drawn as horizontal lens shapes via per-row width falloff, jittered edges (`n2`).
- Sea y92–169: horizon row y92 = ember3 with gold2 shimmer dashes for x in 120..180; water = blue0 base with ink1 horizontal wave strokes every 5–8px (jittered), and a **sun path**: for x in 128..172, gold1/ember4 sparkle flecks (`n2 < 0.18`), fading wider+sparser toward y169.
- Distant headland: ink1 silhouette wedge on the right, x400–512, rising y92→84, 1px ember2 rim on its left (sun-facing) edge.
- Fully opaque (below-mid rows just keep water — mid's sand covers y≥118).

- [ ] **Step 1: Write the painter** (`paint_beach.py` importing `from pawnch_palette import *`; mirror paint_ring's `main()`/`PIECES`/OUT_DIR pattern with `OUT_DIR = …/assets/sprites/arenas/beach`).
- [ ] **Step 2: Paint + QA.** Run `tools/.venv/bin/python tools/paint_beach.py far`; Read the PNG at full size AND a 3× crop of the sun/horizon (PIL crop-resize like V1's mat QA). Gate: bands read as painted dusk (no hard stripes), sun disc clean, sea sparkle only in the sun path.
- [ ] **Step 3: Commit**

```bash
git add tools/paint_beach.py assets/sprites/arenas/beach/far.png
git commit -m "feat(art): beach arena far layer — dusk sky, backlit clouds, sun path sea"
```

---

### Task 3: Paint `mid.png` — sand, bleachers, palms, torches (transparent 512×170)

**Files:**
- Modify: `tools/paint_beach.py` (add `mid`), Create: `assets/sprites/arenas/beach/mid.png`

**Interfaces:**
- Produces geometry Task 5's FX knobs must match: waterline **y118**; torch bowls at **(88,96) (190,104) (322,104) (424,96)** (flame anchor = bowl top-center); lantern wire anchors **(36,52) (256,40) (470,52)**.

**Art spec:**
- Sand y118–169: wood2 base, wood3 sun-streak flecks (`n2<0.25` and x<300 — light comes from the left), ink1 shadow speckle (`n2<0.08`); wet band y118–122: gold2 shimmer dashes + spec1 foam dots (sparse — code animates the live foam).
- Driftwood bleachers flanking center (clear of x170–340 so tells/fighters stay clean): platforms x8–160 and x352–504, y128–158: wood1 plank slabs (2 tiers each, 1px wood3 top edges, plank gaps every 22px ink0); seated crowd silhouettes: ink1 heads (r3–4, pitch 9, `n2` jitter) + shoulders, each head with a 1–2px **gold0 rim on its LEFT crown** (backlit) when `n2<0.6`; a few raised arms (3px vertical strokes).
- Palm trunks: at x36 and x470, y40→140, curving outward ~10px (quadratic), 7px wide: ink1 fill, ember1 rim column on the left edge, ring-notch ticks every 9px ink0.
- Tiki torches at the four positions: wood1 pole (3px), wood2 cross-wrap ticks, bowl = 9×5 ink1 cup with wood0 interior — UNLIT (code adds `flame()`).
- Lantern wire: 1px ink2 catenary sagging 8px between anchor points (two spans) — wire only, code draws the swinging lanterns.

- [ ] **Step 1: Add `mid` painter + run.** `tools/.venv/bin/python tools/paint_beach.py mid`.
- [ ] **Step 2: QA via checker** (transparent!): `tools/.venv/bin/python tools/check_alpha.py assets/sprites/arenas/beach/mid.png <scratch>/chk-beach-mid.png --scale 2` → Read: transparency clean above the sand/structures, bleachers/palms/torches read as backlit silhouettes.
- [ ] **Step 3: Commit**

```bash
git add tools/paint_beach.py assets/sprites/arenas/beach/mid.png
git commit -m "feat(art): beach arena mid layer — dusk sand, driftwood bleachers, palms, unlit torches"
```

---

### Task 4: Paint `near.png` fronds + combined `.aseprite` master + manifest

**Files:**
- Modify: `tools/paint_beach.py` (add `near`), `assets/sprites/manifest.json` (`"arenas"` gains `"beach": "arenas/beach"`)
- Create: `assets/sprites/arenas/beach/near.png`, `assets/aseprite/arena-beach.aseprite`

**Art spec (`near.png`, transparent):** overhanging palm-frond clusters framing the top corners — left x0–175/y0–48, right x335–512/y0–42. Each cluster: 5–6 blade silhouettes fanning down-inward from the off-screen trunk top, blades drawn as tapering strokes with serrated edges (`n2` bite-outs every 3–4px): ink0 cores, ink1 edges, occasional ember1 streak on a blade's sun-side. Two hanging coconut discs (r4, ink1 + 1px ember1 left-rim) under the left cluster. NOTHING below y50 (fighter/tell space stays clear).

- [ ] **Step 1: Add `near` painter + run + checker QA** (same commands as Task 3, `near.png`).
- [ ] **Step 2: Build the layered master:** MCP `create_canvas` 512×170 RGB → `import_image` far.png as layer "far" → `import_image` mid.png as layer "mid" → `import_image` near.png as layer "near" → `set_palette` (master 51 colors) → `save_as` `assets/aseprite/arena-beach.aseprite`.
- [ ] **Step 3: Manifest entry** `"beach": "arenas/beach"` under `"arenas"`; validate `python3 -c "import json;json.load(open('assets/sprites/manifest.json'))"`.
- [ ] **Step 4: Commit**

```bash
git add tools/paint_beach.py assets/sprites/arenas/beach/near.png assets/aseprite/arena-beach.aseprite assets/sprites/manifest.json
git commit -m "feat(art): beach near-layer fronds, layered aseprite master, manifest wiring"
```

---

### Task 5: `SCENES.beach.drawLayered` — the living golden hour

**Files:**
- Modify: `src/config.js` (extend `SCENERY.SCENES.beach`), `src/scenery.js` (beach drawLayered + one tiny helper)

**Interfaces:**
- Consumes: `arenaLayers('beach')` (auto via `drawScene`), `additiveGlow`/`spotCone` (already imported in scenery.js), existing helpers `sky/flame/twinkle/drift/glow/hash`.
- Produces: config knob shape other scenes will copy: `SCENERY.SCENES.beach.L = {…}` for all layered-FX tuning.

- [ ] **Step 1: Config knobs.** In `SCENERY.SCENES`, extend `beach` (keep every existing procedural key — the fallback still reads them) by adding:

```js
beach: { /* …existing keys stay… */
  // layered-scene (drawLayered) knobs — geometry mirrors the painted layers
  L: {
    sun: [150, 78], sunGlowR: 34, horizonY: 92,
    rays: [[150, 78, 300, 170, 0.06], [150, 78, 420, 170, 0.045], [150, 78, 210, 170, 0.05]], // [x0,y0,x1,floorY,alpha]
    rayW: [10, 46],                    // half-width at source -> at floor
    sparkleN: 12, sparkleX: [124, 176],
    foamY: 119, foamAmp: 2.2, foamSpeed: 1.4,
    torches: [[88, 96], [190, 104], [322, 104], [424, 96]],
    wire: [[36, 52], [256, 40], [470, 52]], wireSag: 8, lanternN: 7,
    ballX: [30, 150], ballY: 132,      // beach-ball bounce zone (left bleachers)
    crabPeriod: 47, crabDur: 6, crabY: 152,
    frondSway: 1.2, frondHz: 0.8,      // near-layer wind sway (px, cycles/sec)
    // scene-specific FX colors (namespaced here per Golden Rule 2/3)
    rayCol: '#ffd24a', bloomCol: '#ff9a3a', sparkleCol: '#ffe7a8',
    foamCol: 'rgba(232,242,255,0.75)',
    lantBody: '#c9962a', lantCore: '#ffe7a8', lantGlow: '#ffd24a',
    ballCol: '#ff7a18', ballHi: '#e8f2ff', crabCol: '#c22037', flareCol: '#ff9a3a',
  },
  key: { color: '#ffd24a', alpha: 0.20, wash: '#ff9a3a', washA: 0.05 },  // golden-hour key light (Task 6)
},
```

- [ ] **Step 2: Beach drawLayered** in `scenery.js` (after `SCENES.beach = { draw: beachScene };`):

```js
// angled god-ray quad (additive) — beach-local helper
function ray(ctx, x0, y0, x1, y1, w0, w1, color, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, withA(color, a)); g.addColorStop(1, withA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0 - w0, y0); ctx.lineTo(x0 + w0, y0);
  ctx.lineTo(x1 + w1, y1); ctx.lineTo(x1 - w1, y1);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// quadratic-catenary point along a 2-span lantern wire
function wireAt(anchors, sag, k) {
  const span = k < 0.5 ? 0 : 1, u = (k % 0.5) * 2;
  const [ax, ay] = anchors[span], [bx, by] = anchors[span + 1];
  return [ax + (bx - ax) * u, ay + (by - ay) * u + Math.sin(u * Math.PI) * sag];
}

// TROPICAL BEACH v2 — painted golden hour + living light. Pure fn of t/crowd.
SCENES.beach.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd, accent } = p;
  const C = SCENERY.SCENES.beach, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // sun: breathing glow + wide horizon bloom
  const breathe = 0.5 + 0.08 * Math.sin(t * 1.1);
  additiveGlow(ctx, L.sun[0], L.sun[1], L.sunGlowR, C.sunGlow, breathe);
  additiveGlow(ctx, L.sun[0], L.horizonY, 70, L.bloomCol, 0.16);
  // god-rays fanning from the sun (slow shimmer)
  L.rays.forEach(([x0, y0, x1, fy, a], i) => {
    const sh = 0.75 + 0.25 * Math.sin(t * 0.7 + i * 2.1);
    ray(ctx, x0, y0, x1, Math.min(fy, floorTop), L.rayW[0], L.rayW[1], L.rayCol, a * sh);
  });
  // water sparkle in the sun path
  for (let i = 0; i < L.sparkleN; i++) {
    const sx = L.sparkleX[0] + hash(i) * (L.sparkleX[1] - L.sparkleX[0]);
    twinkle(ctx, sx, L.horizonY + 2 + hash(i + 5) * 22, 1, L.sparkleCol, t * 3, i * 1.7);
  }
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // rolling surf foam over the waterline
  ctx.fillStyle = L.foamCol;
  for (let x = 0; x < W; x += 7) {
    const fy = L.foamY + Math.sin(t * L.foamSpeed + x * 0.045) * L.foamAmp;
    if (hash(x) < 0.75) ctx.fillRect(x, fy | 0, 4, 1);
  }
  // tiki flames in the painted bowls
  L.torches.forEach(([tx, ty], i) => flame(ctx, tx, ty - 2, 5, t, i * 1.9, '#fff6c0', '#ff9a18', '#ffb24a'));
  // swinging string lanterns along the painted wire
  for (let i = 0; i < L.lanternN; i++) {
    const k = (i + 0.5) / L.lanternN;
    const [lx, ly] = wireAt(L.wire, L.wireSag, k);
    const sway = Math.sin(t * 1.3 + i * 1.1) * 2;
    additiveGlow(ctx, lx + sway, ly + 5, 8, L.lantGlow, 0.35 + crowd * 0.2);
    ctx.fillStyle = L.lantBody; ctx.fillRect((lx + sway - 1) | 0, (ly + 2) | 0, 3, 4);
    ctx.fillStyle = L.lantCore; ctx.fillRect((lx + sway) | 0, (ly + 3) | 0, 1, 2);
  }
  // beach ball arcing over the left bleachers
  const bk = (t * 0.35) % 1, bx = L.ballX[0] + (L.ballX[1] - L.ballX[0]) * bk;
  const by = L.ballY - Math.abs(Math.sin(bk * Math.PI * 3)) * 16;
  ctx.fillStyle = L.ballCol; ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = L.ballHi; ctx.fillRect((bx - 1) | 0, (by - 3) | 0, 2, 2);
  // rare event: a crab scuttles across the sand (deterministic t-schedule)
  const cph = t % L.crabPeriod;
  if (cph < L.crabDur) {
    const cx = -8 + (W + 16) * (cph / L.crabDur), cy = L.crabY + Math.sin(t * 14) * 1;
    ctx.fillStyle = L.crabCol;
    ctx.fillRect(cx | 0, cy | 0, 5, 3);
    ctx.fillRect((cx - 1) | 0, (cy + 1) | 0, 1, 1); ctx.fillRect((cx + 5) | 0, (cy + 1) | 0, 1, 1); // claws
    const leg = Math.floor(t * 10) % 2;
    ctx.fillRect((cx + (leg ? 0 : 2)) | 0, (cy + 3) | 0, 1, 1); ctx.fillRect((cx + (leg ? 3 : 4)) | 0, (cy + 3) | 0, 1, 1);
  }
  // near fronds with a gentle wind sway (whole-layer drift; clusters are painted
  // to hug the corners so the 1px edge sliver never reads)
  if (layers.near) {
    ctx.save();
    ctx.translate(Math.sin(t * L.frondHz) * L.frondSway, 0);
    ctx.drawImage(layers.near, 0, 0);
    ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.14); ctx.fillRect(0, 0, W, floorTop); }
};
```

- [ ] **Step 3: Verify.** `node --check src/scenery.js src/config.js`; suite green; harness screenshots `?scene=beach`, `?scene=beach&crowd=60`, and `?scene=beach&bare=1` (procedural beach unchanged). Gate: sun glow + rays shimmer over painted sky, foam animates on the waterline, torches burn, lanterns swing and glow, fronds frame the top, crab crosses when `t mod 47 < 6` (screenshot with `--virtual-time-budget` high enough or temporarily set crabPeriod low — restore after). Fighters/tells stay the highest-contrast elements.
- [ ] **Step 4: Commit**

```bash
git add src/scenery.js src/config.js
git commit -m "feat(scenery): beach arena v2 — golden-hour layered scene with living FX"
```

---

### Task 6: Key-light system pilot — fighter rim light + golden wash

**Files:**
- Modify: `src/lighting.js` (add `withRim`), `src/config.js` (`LIGHT.RIM`), `src/states/boxing.js` (apply per-scene key)

**Interfaces:**
- Produces: `withRim(ctx, W, H, key, drawCb)` — runs drawCb into a cached offscreen canvas, tints the drawn pixels with a directional `source-atop` gradient of `key.color` at `key.alpha * LIGHT.RIM.SCALE`, blits back. `key` shape: `{ color, alpha, wash, washA }` (from `SCENERY.SCENES[id].key`). Scenes WITHOUT `key` are untouched (classic keeps its look until given one).

- [ ] **Step 1: Config.** Add to `LIGHT`: `RIM: { SCALE: 1.0, SPAN: 0.55 }` (SPAN = fraction of the width the directional gradient covers, sun side = left).
- [ ] **Step 2: `withRim` in lighting.js:**

```js
// Per-scene key light on sprites: draw into a scratch canvas, tint the drawn
// pixels with a directional gradient (sun side -> transparent), blit back.
// Cheap pilot of a true edge-rim; reads as directional golden-hour light.
let _rimCv = null;
export function withRim(ctx, W, H, key, drawCb) {
  if (!key) return drawCb();
  const cv = (_rimCv ||= document.createElement('canvas'));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, W, H);
  drawCb(c);
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(0, 0, W * LIGHT.RIM.SPAN, 0);
  g.addColorStop(0, withA(key.color, key.alpha * LIGHT.RIM.SCALE));
  g.addColorStop(1, withA(key.color, 0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.restore();
  ctx.drawImage(cv, 0, 0);
}
```

Note: `drawCb` receives the SCRATCH context — callers must draw with it, not the outer ctx.

- [ ] **Step 3: Boxing integration.** In `enter()`: `this.keyLight = SCENERY.SCENES[this.sceneId]?.key || null;` (import `SCENERY`). Wrap BOTH fighter draws: enemy — `withRim(ctx, W, H, this.keyLight, (c2 = ctx) => drawFighter(c2, ex, FIGHTER.ENEMY_FEET_Y, FIGHTER.SIZE.enemy, eLook, em.pose, 1, this.t * 4, em.info));` — concretely, change each `drawFighter(ctx, …)` call into `withRim(ctx, W, H, this.keyLight, (c2) => drawFighter(c2 || ctx, …))` with the same args (reflection stays un-rimmed). After the player draw, before the special-front FX: `if (this.keyLight) tintWash(ctx, W, H, this.keyLight.wash, this.keyLight.washA);` (imports: `withRim`, `tintWash`).
- [ ] **Step 4: Verify.** Harness has no boxing state — verify in the LIVE game: dev-skip into Patty's fight (Story fight 1, localhost dev-unlock); screenshot via headless Chrome is impossible mid-fight, so run the harness check indirectly: temporary `?scene=beach` harness draws fighters WITHOUT rim (acceptable — rim is boxing-only), then boot the real game headless and confirm zero console errors + suite green. Gate for the look: fighters in the beach fight carry a warm left-edge tint; classic fights unchanged (no `key` on classic).
- [ ] **Step 5: Commit**

```bash
git add src/lighting.js src/config.js src/states/boxing.js
git commit -m "feat(fx): per-scene key light — fighter rim tint + golden wash (beach pilot)"
```

---

### Task 7: Final sweep + docs

**Files:**
- Modify: `docs/superpowers/specs/2026-07-20-visual-overhaul-design.md` (V2 row → DONE), `CLAUDE.md` (one line: beach = first layered arena; painters pattern)

- [ ] **Step 1:** Suite green; zero-asset boot (manifest stashed → title renders, procedural beach in tutorial arena picker path unaffected → restore).
- [ ] **Step 2:** Harness gallery: screenshots of beach (calm / crowd=60 / crab moment) + classic regression shot; send to the user.
- [ ] **Step 3:** Docs + spec status + memory update; commit.

```bash
git add CLAUDE.md docs/superpowers/specs/2026-07-20-visual-overhaul-design.md
git commit -m "docs: V2 beach pilot shipped — first fully painted arena + key-light system"
```
