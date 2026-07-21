# Visual Overhaul V3 Batch 1 — Woods, Cyber, Dream: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three more fully painted arenas — Gus's SPOOKY WOODS, Rosa's CYBERPUNK STREET, Kid Knightmare's DREAM WORLD — each with its own key light and rare event, using the pipeline proven by CLASSIC and BEACH.

**Architecture:** Per arena: a deterministic PIL painter (`tools/paint_<arena>.py`, importing `tools/pawnch_palette.py`) produces `assets/sprites/arenas/<id>/{far,mid,near}.png`; `SCENERY.SCENES.<id>` gains an `L` knob block + `key`; `SCENES.<id>.drawLayered` composes layers + living FX **exactly following `SCENES.beach.drawLayered` in `src/scenery.js` as the structural template** (far → sky FX → mid → ground FX → near → flare). Procedural scenes remain the zero-asset fallback. One sanctioned palette addition: a 2-color NEON pair for cyber.

**Tech Stack:** Vanilla ES modules, Canvas 2D, PIL painters, Aseprite MCP for masters, headless-Chrome harness QA.

## Global Constraints

- Everything in the V1/V2 plans' Global Constraints applies verbatim (no deps; config-only tuning; presentation-only; zero-asset boot; native-res pixels; readability guardrail; commit per task; suite green: `osascript -l JavaScript tools/test/run-headless.js "$PWD"` → `66 passed, 0 failed`).
- Scene draws stay pure functions of `t`/`crowd`; every rare event is a deterministic `t`-schedule (`t % PERIOD < DUR`), like the beach crab.
- Layer size 512×170; `far` opaque, `mid`/`near` transparent; `near` content stays ABOVE y50 except where noted (fighter/tell space stays clear).
- Harness QA per arena: `?scene=<id>`, `?scene=<id>&crowd=60`, `?bare=1&scene=<id>` (procedural fallback pixel-identical).
- Each arena's task pair ends with: `.aseprite` master (create_canvas 512×170 → import far/mid/near as layers → set master palette → save_as `assets/aseprite/arena-<id>.aseprite`) + manifest entry `"<id>": "arenas/<id>"` + commit.

---

### Task 1: Sanctioned NEON palette extension

**Files:**
- Modify: `assets/aseprite/pawnch-master.gpl`, `tools/pawnch_palette.py`, `docs/ART_BIBLE.md`

**Interfaces:**
- Produces: `NEON_MAGENTA = (255, 59, 208)` and `NEON_CYAN = (34, 231, 255)` in `pawnch_palette.py`; same two rows in the .gpl (`255  59 208	neonMagenta`, ` 34 231 255	neonCyan`). These match the hues the procedural cyber scene already uses (`#ff3bd0`, `#22e7ff` in `SCENERY.SCENES.cyber.neon`).

- [ ] **Step 1:** Append to the .gpl under a `# Neon accents (cyber signage only)` comment; add the two tuples to `pawnch_palette.py`; add one line to ART_BIBLE v2 rule 2: "One sanctioned extension: the 2-color NEON pair (magenta/cyan), reserved for cyber-arena signage and its key light."
- [ ] **Step 2:** Commit: `git add assets/aseprite/pawnch-master.gpl tools/pawnch_palette.py docs/ART_BIBLE.md && git commit -m "feat(art): sanctioned neon accent pair in the master palette (cyber)"`

---

### Task 2: SPOOKY WOODS — paint the layers (`tools/paint_woods.py`)

**Files:**
- Create: `tools/paint_woods.py`, `assets/sprites/arenas/woods/{far,mid,near}.png`

**Interfaces:**
- Produces geometry Task 3's `L` block must match: moon center **(392, 30)** r11; candle clusters (bowl anchor points, flame drawn 2px above each): **(70,118) (128,132) (196,140) (316,140) (384,132) (442,118) (60,90) (452,90)**; fog band y128–166.

**Art spec (moonlit forest amphitheeater; palette: ink/steel + green0/1 moss + wood + gold/ember candle warmth):**
- `far.png` (opaque): near-black gradient ink0→ink1(bottom); a back rank of thin trunk silhouettes (ink1, 6–14px wide, jittered spacing ~44px) with tiny canopy-gap sky slivers (steel0 dither) up top; the **moon** at (392,30): spec1 core r7, steel4 ring to r11, steel3 dither halo to r15, partly bitten by a branch silhouette crossing it (ink1, 3px); faint green0 moss dither on trunk bases.
- `mid.png` (transparent): two GREAT gnarled trunks flanking (x28–66 and x446–484, y8→170): wood1 cores with ink1 bark ridges (vertical wavy strokes), root flares spreading at the base (y150+), knot holes (ink0 ellipses); a thick branch arch crossing the top from the left trunk (y10–26, dipping to y34 center, wood1 with ink1 underside); **hooded congregation**: two rows of robed figures behind the ring line (y120–150, pitch 16, x80–430): ink0 hood-and-shoulder silhouettes (rounded-top trapezoids, 10px wide, jitter) each with a faint green1 hood-edge rim when `n2<0.5` and a wood0 candle-in-hands dot; **candle clusters** at the 8 anchor points: stacked stubby candles (spec1/steel4 wax, 2–4 per cluster on stump bases wood1) — UNLIT (code adds flames); moss patches green0 with green1 flecks on stumps and trunk bases.
- `near.png` (transparent): one massive twisted foreground branch across the top (y0–30, ink0 with ink1 edge highlights, forking twice) with **hanging moss curtains** (green0 vertical raggedy strands, 8–20px long, from the branch underside) and 2 hanging candle-jars (steel1 wire, gold0 jar outline, unlit).

- [ ] **Step 1:** Write the painter (same skeleton as `tools/paint_beach.py`: `PIECES = {'far':…,'mid':…,'near':…}`, `main()` CLI, OUT_DIR `assets/sprites/arenas/woods`).
- [ ] **Step 2:** Paint + QA each: far → Read directly (opaque); mid/near → `tools/check_alpha.py` checker at `--scale 2`; then a PIL 3-layer composite preview (the V2 method). Gate: moon reads, trunks frame without crowding center, congregation reads as individual hooded figures, candles visible but unlit.
- [ ] **Step 3:** Commit: `git add tools/paint_woods.py assets/sprites/arenas/woods && git commit -m "feat(art): spooky woods arena layers — moonlit amphitheater, congregation, candle stumps"`

---

### Task 3: SPOOKY WOODS — config + drawLayered + master + manifest

**Files:**
- Modify: `src/config.js` (extend `SCENERY.SCENES.woods`), `src/scenery.js` (add `SCENES.woods.drawLayered`), `assets/sprites/manifest.json`
- Create: `assets/aseprite/arena-woods.aseprite`

**Interfaces:**
- Consumes: `additiveGlow`, `godRay`, existing `flame/twinkle/drift/hash/mixA/withA` in scenery.js.

- [ ] **Step 1: Config.** Extend `woods` (keep existing procedural keys) with:

```js
L: {
  moon: [392, 30], moonGlowR: 26,
  candles: [[70, 118], [128, 132], [196, 140], [316, 140], [384, 132], [442, 118], [60, 90], [452, 90]],
  fogY: [128, 166], fogN: 3, fogCol: '#26304f',
  flyN: 9, flyCol: '#8af0c0',
  eyesPeriod: 23, eyesDur: 2.2, eyesN: 3, eyesCol: '#39d98a',
  shaftAlpha: 0.07, shaftCol: '#cdd6ff',
  mossSway: 1.0, mossHz: 0.5,
  flareCol: '#39d98a',
},
key: { color: '#8ea0cf', alpha: 0.14, wash: '#17573a', washA: 0.035 },  // cold moon rim, faint forest grade
```

- [ ] **Step 2: drawLayered** (beach template; novel pieces in full):

```js
SCENES.woods.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.woods, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // moon glow + one broad shaft slanting down-left through the canopy
  additiveGlow(ctx, L.moon[0], L.moon[1], L.moonGlowR, L.shaftCol, 0.4 + 0.06 * Math.sin(t * 0.9));
  godRay(ctx, L.moon[0], L.moon[1], L.moon[0] - 120, floorTop, 8, 52, L.shaftCol, L.shaftAlpha);
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // candle flames on every painted cluster (the warm pools of light)
  L.candles.forEach(([cx, cy], i) =>
    flame(ctx, cx, cy - 2, 4, t, i * 1.7, C.fireCore, C.fireMid, C.fireGlow));
  // rolling ground fog: broad drifting glows hugging the floor band
  for (let i = 0; i < L.fogN; i++) {
    const fx = drift(t, 3 + i * 2, W, 90, i * 170);
    const fy = L.fogY[0] + (L.fogY[1] - L.fogY[0]) * hash(i + 2);
    additiveGlow(ctx, fx, fy, 60, L.fogCol, 0.07);
  }
  // fireflies wandering between the trunks
  for (let i = 0; i < L.flyN; i++) {
    const fx = drift(t, 5 + i, W, 12, i * 60);
    const fy = 60 + hash(i + 3) * 80 + Math.sin(t * 1.8 + i) * 6;
    twinkle(ctx, fx, fy, 2, L.flyCol, t * 2, i * 2.3);
  }
  // RARE: pairs of eyes blink open in the dark, then vanish
  const eph = t % L.eyesPeriod;
  if (eph < L.eyesDur) {
    const k = Math.sin((eph / L.eyesDur) * Math.PI);           // fade in-out
    const cycle = Math.floor(t / L.eyesPeriod);                // new spots each time
    for (let i = 0; i < L.eyesN; i++) {
      const ex = 60 + hash(cycle * 7 + i) * (W - 120);
      const ey = 40 + hash(cycle * 13 + i + 3) * 70;
      ctx.globalAlpha = k;
      ctx.fillStyle = L.eyesCol;
      ctx.fillRect(ex | 0, ey | 0, 2, 2); ctx.fillRect((ex + 6) | 0, ey | 0, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
  // near branch + moss with a slow sway
  if (layers.near) {
    ctx.save();
    ctx.translate(Math.sin(t * L.mossHz) * L.mossSway, 0);
    ctx.drawImage(layers.near, 0, 0);
    ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.10); ctx.fillRect(0, 0, W, floorTop); }
};
```

- [ ] **Step 3:** `.aseprite` master + manifest entry (`"woods": "arenas/woods"`) per the Global-Constraints recipe; `node --check`, suite green, harness shots (`?scene=woods`, `&crowd=60`, bare).
- [ ] **Step 4:** Commit: `git add src/config.js src/scenery.js assets/sprites/manifest.json assets/aseprite/arena-woods.aseprite && git commit -m "feat(scenery): spooky woods v2 — moon shaft, candle pools, fog, fireflies, blinking eyes"`

---

### Task 4: CYBERPUNK STREET — paint the layers (`tools/paint_cyber.py`)

**Files:**
- Create: `tools/paint_cyber.py`, `assets/sprites/arenas/cyber/{far,mid,near}.png`

**Interfaces:**
- Produces geometry Task 5 must match: HOTEL ROOK sign board **x30–58, y28–120** (letters stacked vertically); billboard frame **x196–316, y8–52** (holo-rook projects at its center (256,30)); steam vents at **(170,150) (352,146)**; monorail viaduct rail at **y58** in far.png; wet-walk strip y150–169.

**Art spec (rain-soaked neon canyon; ink/steel/mat + gold windows + NEON pair + blue):**
- `far.png` (opaque): canyon of towers in 3 depths — back rank (y8–150): mat0/ink1 slabs w~60 with sparse gold0 window dots (n2<0.06); mid rank: ink0 slabs w~80 with brighter windows (gold1, blue5, occasional NEON_CYAN, n2<0.10), rooftop water towers + antennas (steel0); a **monorail viaduct** crossing the full width at y58: 3px steel0 deck on thin pylons (the rare-event train runs along it, code-drawn); sky slivers: ink0 with mat2 haze dither; distant NEON smudges (2×4 blurry sign blobs at 30% dither density).
- `mid.png` (transparent): street-level flanks — LEFT: a building face x0–70 with the **HOTEL ROOK vertical sign**: steel0 board x30–58/y28–120 with a 1px steel1 frame, stacked 3×5-font letters (reuse `F35` pattern from paint_ring.py classic banner — add letters O,T,E,L,R,K to a local F35) painted UNLIT in NEON_MAGENTA at 40% dither density (code lights them fully); RIGHT: building face x442–512 with a noodle-stand awning (RED1/spec1 stripes, y96–108), 2 small hanging signs (steel0 boards with a NEON_CYAN knight-glyph ♞ blob and a gold1 pawn blob); CENTER-TOP: the **billboard frame** x196–316/y8–52: ink1 heavy frame, steel0 inner border, DEAD BLACK ink0 screen (the holo-rook lives there in code); crossing overhead cables (1px ink2 catenaries, 3 spans) with tiny hanging lamps (gold0 dots); back-walk **umbrella crowd** y128–150: two rows of umbrella caps (rounded 12px domes, alternating ink1 / mat1 with a 1px NEON_MAGENTA or NEON_CYAN rim every third, poles ink0) — heads hidden under them; street furniture: hydrant (RED1, x86), AC boxes, pipes on the flank walls with vent nozzles at the two steam points; **wet-walk strip** y150–169: ink1 asphalt with vertical neon smear columns (2px, 30–50% dither density) directly under each lit element: magenta under the hotel sign, cyan under the right signs, gold under cable lamps.
- `near.png` (transparent): dangling foreground cables from the top corners (2px ink0 with steel0 glints, one crossing to x160), the corner of a fire-escape platform top-right (x470–512/y0–34, ink0 grating with steel0 edge lines). Nothing below y50.

- [ ] **Step 1:** Write painter + paint + per-layer QA + PIL composite (V2 method). Gate: signs read UNLIT (dim), windows twinkle-ready, umbrella rims give the crowd a neon halo line, wet smears sit under their sources.
- [ ] **Step 2:** Commit: `git add tools/paint_cyber.py assets/sprites/arenas/cyber && git commit -m "feat(art): cyberpunk street arena layers — neon canyon, hotel rook, umbrella crowd"`

---

### Task 5: CYBERPUNK STREET — config + drawLayered + master + manifest

**Files:**
- Modify: `src/config.js`, `src/scenery.js`, `assets/sprites/manifest.json`
- Create: `assets/aseprite/arena-cyber.aseprite`

- [ ] **Step 1: Config.** Extend `cyber` with:

```js
L: {
  sign: [44, 74],                  // HOTEL ROOK glow center
  billboard: [256, 30],            // holo-rook projection center
  steam: [[170, 150], [352, 146]],
  railY: 58, trainPeriod: 41, trainDur: 3.5, trainCars: 4,
  droneN: 2, rainN: 46,
  smearY: [150, 169],
  neonM: '#ff3bd0', neonC: '#22e7ff',
  trainWin: '#ffd24a', flareCol: '#7a5cff',
},
key: { color: '#ff3bd0', alpha: 0.15, wash: '#7a5cff', washA: 0.05 },  // magenta rim, violet grade
```

- [ ] **Step 2: drawLayered** (beach template; novel pieces in full):

```js
SCENES.cyber.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.cyber, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // RARE: a monorail train crosses the far viaduct (lit window strip)
  const tph = t % L.trainPeriod;
  if (tph < L.trainDur) {
    const tx = -80 + (W + 160) * (tph / L.trainDur);
    for (let c2 = 0; c2 < L.trainCars; c2++) {
      const cx = tx - c2 * 22;
      ctx.fillStyle = '#0d1226'; ctx.fillRect(cx | 0, L.railY - 6, 20, 5);
      ctx.fillStyle = L.trainWin;
      for (let wdx = 2; wdx < 18; wdx += 4) ctx.fillRect((cx + wdx) | 0, L.railY - 5, 2, 2);
    }
    additiveGlow(ctx, tx, L.railY - 4, 16, L.trainWin, 0.2);
  }
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // HOTEL ROOK sign: flickers between half-dead and blazing. `crowd` spikes to
  // 1 on knockdowns (boxing), so the whole street SURGES on the big moments —
  // the spec's "neon surge + drone swarm" reactive beat.
  const surge = 1 + crowd * 0.6;
  const on = Math.sin(t * 7) > -0.35 ? 1 : 0.3;
  additiveGlow(ctx, L.sign[0], L.sign[1], 34, L.neonM, 0.4 * on * surge);
  additiveGlow(ctx, L.sign[0], L.sign[1] + 30, 24, L.neonM, 0.25 * on * surge);
  // holographic ROOK on the billboard: ghostly glyph, scanline glitches
  const gj = hash(Math.floor(t * 9)) < 0.18 ? (hash(Math.floor(t * 9) + 1) - 0.5) * 6 : 0; // glitch jump
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 3);
  piece(ctx, 'r', L.billboard[0] + gj, L.billboard[1], 30, false, { t, glow: 2, shadow: false, clean: true });
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = L.neonC;                                 // holo scanlines
  for (let sy = L.billboard[1] - 16; sy < L.billboard[1] + 16; sy += 3)
    ctx.fillRect(L.billboard[0] - 22, sy + (Math.floor(t * 20) % 3), 44, 1);
  ctx.restore();
  additiveGlow(ctx, L.billboard[0], L.billboard[1], 30, L.neonC, 0.22);
  // steam vents: rising warm-lit puffs
  L.steam.forEach(([sx, sy], i) => {
    const k = (t * 0.6 + i * 0.5) % 1;
    additiveGlow(ctx, sx + Math.sin(t + i) * 3, sy - k * 26, 8 + k * 10, '#8ea0cf', 0.16 * (1 - k));
  });
  // camera drones: two circling lights with blink + tiny search cones —
  // they orbit faster and dive lower when the crowd surges (knockdowns)
  for (let i = 0; i < L.droneN; i++) {
    const dx = W / 2 + Math.cos(t * 0.5 * surge + i * Math.PI) * (150 + i * 40 - crowd * 40);
    const dy = 40 + crowd * 22 + Math.sin(t * 0.8 * surge + i * 2) * 14;
    ctx.fillStyle = '#26304f'; ctx.fillRect(dx | 0, dy | 0, 4, 2);
    ctx.fillStyle = Math.floor(t * 4 + i) % 2 ? '#ff3b53' : L.neonC;
    ctx.fillRect((dx + 1) | 0, (dy - 1) | 0, 1, 1);
    spotCone(ctx, { cx: dx + 2, topY: dy + 2, floorY: dy + 34, topHalfW: 1, botHalfW: 8, color: L.neonC, alpha: 0.06 });
  }
  // rain: streaks angling down-left, denser when the crowd's up
  ctx.strokeStyle = C.rain; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < L.rainN; i++) {
    const rx = (i * 53 + (t * 240) % W) % W, ry = (i * 41 + t * 340) % floorTop;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 9);
  }
  ctx.stroke();
  if (layers.near) ctx.drawImage(layers.near, 0, 0);
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.14); ctx.fillRect(0, 0, W, floorTop); }
};
```

(`piece` is exported by gfx.js — add it to the scenery.js import line.)

- [ ] **Step 3:** Master + manifest (`"cyber": "arenas/cyber"`); `node --check`, suite, harness shots incl. a long-virtual-time one to catch the train.
- [ ] **Step 4:** Commit: `git add src/config.js src/scenery.js assets/sprites/manifest.json assets/aseprite/arena-cyber.aseprite && git commit -m "feat(scenery): cyberpunk street v2 — neon flicker, holo-rook, steam, drones, monorail"`

---

### Task 6: DREAM WORLD — paint the layers (`tools/paint_dream.py`)

**Files:**
- Create: `tools/paint_dream.py`, `assets/sprites/arenas/dream/{far,mid,near}.png`

**Interfaces:**
- Produces geometry Task 7 must match: knight bust center **(388, 72)**, bust bob is code-driven so mid.png gets the bust ONLY (transparent around it lets it float); aurora bands baked in far at y18–44; island edges for stardust falls at **(120, 96) (300, 84)**.

**Art spec (pastel night-dream; mat ramp sky + RED4 pink + BLUE6/STEEL4 + GREEN3 aurora):**
- `far.png` (opaque): dream sky — vertical dither-blended bands mat1(top)→mat2→mat3→mat4(low), sprinkled star dots (spec1/blue6, n2<0.015, twinkle-ready); **aurora ribbons**: two soft wavy bands at y18–30 and y32–44 in green3 and blue6 at 25–35% dither density (code shimmers over them); a huge pale dream-moon (steel4 disc r18 with mat5 craters) at (96, 34); drifting cloud puffs (steel4 30% dither lenses); two **floating islands** silhouettes (mat1 undersides with hanging root strands, green1 grass lips) at (120,96) w70 and (300,84) w90 — their stardust falls are code.
- `mid.png` (transparent): the **colossal stone knight bust** centered (388,72), ~76px tall / 60px wide, facing LEFT (profile: mane arc, muzzle, ear) — steel2 base tone, steel1 shadow side (right), steel3 lit planes (left), mat3 deep cracks, a broken-off neck base with floating rubble chunks (3–5 small steel1 fragments hovering under it); a **stairway to nowhere**: 7 floating steps (mat3 tops, mat1 sides) spiraling up from (180,140) to (240,60), slightly scattered; **spectre crowd**: a rank of little ghost blobs (steel4 rounded bodies, 8px, mat4 eye dots, wavy hems) hovering in a loose row y136–152, x60–440 pitch 26.
- `near.png` (transparent): dream-wisp framing — soft cloud streamers in the top corners (steel4/spec1 at 20–35% dither, lens-shaped, layered), 3 small floating chess pieces silhouettes (mat1 pawn/bishop/knight ~10px) hanging at staggered heights near the corners. Nothing below y50.

- [ ] **Step 1:** Painter + paint + QA + composite (V2 method). Gate: bust reads as carved stone with a broken neck, ghosts are individuals, sky feels soft (no hard band lines), auroras present but calm.
- [ ] **Step 2:** Commit: `git add tools/paint_dream.py assets/sprites/arenas/dream && git commit -m "feat(art): dream world arena layers — pastel sky, knight bust, stairway, spectres"`

---

### Task 7: DREAM WORLD — config + drawLayered + master + manifest

**Files:**
- Modify: `src/config.js`, `src/scenery.js`, `assets/sprites/manifest.json`
- Create: `assets/aseprite/arena-dream.aseprite`

- [ ] **Step 1: Config.** Extend `dream` with:

```js
L: {
  bust: [388, 72], bustBob: 3, bustHz: 0.4,
  falls: [[120, 96], [300, 84]],
  auroraY: [18, 44],
  hueCycle: ['#7a5cff', '#ff8a96', '#39d98a'], hueA: 0.05, hueHz: 0.08,
  starN: 14, shootPeriod: 9, shootDur: 0.7,
  sheepPeriod: 53, sheepDur: 5, sheepY: 120,
  wispSway: 1.5, wispHz: 0.5, flareCol: '#b8d0ff',
},
key: { color: '#ff8a96', alpha: 0.12, wash: '#7a5cff', washA: 0.04 },  // soft pink rim, violet grade
```

- [ ] **Step 2: drawLayered** — beach template; novel pieces in full. NOTE the bust bob: mid.png is drawn TWICE — once normally minus the bust region is impossible, so the WHOLE mid layer bobs gently (`ctx.translate(0, Math.sin(t*L.bustHz*2*Math.PI)*L.bustBob)`) — ghosts/stairs floating too is dream-correct:

```js
SCENES.dream.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.dream, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // hue-cycling dream wash over the sky (lerped between three tints)
  const hk = (t * L.hueHz) % 1, hi = Math.floor(hk * L.hueCycle.length);
  const hcol = L.hueCycle[hi % L.hueCycle.length];
  ctx.fillStyle = mixA(hcol, L.hueA * (0.5 + 0.5 * Math.sin(hk * Math.PI * 2 * L.hueCycle.length)));
  ctx.fillRect(0, 0, W, floorTop);
  // aurora shimmer: slow vertical light bands over the painted ribbons
  for (let i = 0; i < 3; i++) {
    const ax = drift(t, 6 + i * 3, W, 40, i * 150);
    additiveGlow(ctx, ax, (L.auroraY[0] + L.auroraY[1]) / 2, 30, i % 2 ? '#8af0c0' : '#b8d0ff', 0.07);
  }
  // stardust falling off the floating islands
  L.falls.forEach(([fx2, fy2], i) => {
    for (let k = 0; k < 5; k++) {
      const fy3 = fy2 + ((t * 14 + k * 9 + i * 5) % 34);
      twinkle(ctx, fx2 + Math.sin(t + k) * 3, fy3, 1, '#ffe7a8', t * 2, k * 1.3 + i);
    }
  });
  // shooting star: brief diagonal streak on a t-schedule
  const sph = t % L.shootPeriod;
  if (sph < L.shootDur) {
    const cyc = Math.floor(t / L.shootPeriod);
    const sx = 60 + hash(cyc) * (W - 160) + sph * 120, sy = 10 + hash(cyc + 2) * 30 + sph * 46;
    ctx.strokeStyle = 'rgba(255,246,216,' + (1 - sph / L.shootDur) + ')';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 14, sy - 6); ctx.stroke();
  }
  // the whole mid layer floats (bust, stairway, spectres — it's a dream)
  ctx.save();
  ctx.translate(0, Math.sin(t * L.bustHz * Math.PI * 2) * L.bustBob);
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  ctx.restore();
  // RARE: the counting sheep bounces across
  const shp = t % L.sheepPeriod;
  if (shp < L.sheepDur) {
    const sx = -12 + (W + 24) * (shp / L.sheepDur);
    const sy = L.sheepY - Math.abs(Math.sin(shp * Math.PI * 4)) * 18;
    ctx.fillStyle = '#e8f2ff';                              // fluffy body
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.arc(sx - 4, sy + 1, 3, 0, Math.PI * 2); ctx.arc(sx + 4, sy + 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#26304f';                              // face + legs
    ctx.fillRect((sx + 5) | 0, (sy - 3) | 0, 3, 3);
    ctx.fillRect((sx - 3) | 0, (sy + 4) | 0, 1, 2); ctx.fillRect((sx + 2) | 0, (sy + 4) | 0, 1, 2);
  }
  if (layers.near) {
    ctx.save();
    ctx.translate(Math.sin(t * L.wispHz) * L.wispSway, 0);
    ctx.drawImage(layers.near, 0, 0);
    ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.12); ctx.fillRect(0, 0, W, floorTop); }
};
```

- [ ] **Step 3:** Master + manifest (`"dream": "arenas/dream"`); checks + harness shots (one with high virtual time to catch the sheep).
- [ ] **Step 4:** Commit: `git add src/config.js src/scenery.js assets/sprites/manifest.json assets/aseprite/arena-dream.aseprite && git commit -m "feat(scenery): dream world v2 — hue-cycle wash, auroras, floating bust, sheep"`

---

### Task 8: Batch sweep + docs + checkpoint

- [ ] **Step 1:** Suite green; zero-asset boot (manifest stashed → title + procedural woods/cyber/dream in the harness `?bare=1` → restore).
- [ ] **Step 2:** Gallery: harness shots of all three arenas (calm + crowd) + classic/beach regression shots; send to the user.
- [ ] **Step 3:** Docs: spec V3 row → "batch 1 (woods/cyber/dream) DONE"; memory update (batch 2 = temple/castle/space next). Commit, merge to main (ff-only), suite on main, push origin, delete branch — the established checkpoint flow.
