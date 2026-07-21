# Visual Overhaul V3 Batch 3 (Finale) — Abyss, Chess Hall, Stadium: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the arena roster — Tal's UNDERWATER ABYSS, Magnus's GRAND CHESS HALL (with the live wall-board mirroring the real match position), the Pawnchion's MEGA STADIUM (with the live jumbotron) — all 11 scenes painted.

**Architecture:** Same pipeline as batches 1–2. One NEW mechanism: `drawScene` params gain read-only `board` (the 64-cell chess array, or null) and `round` (int, or null), passed by the boxing state from its `match` model — strictly presentation-only (scenes only READ; harness passes a `newGame().board` demo so headless QA shows a populated board). Scenes must render sensibly with `board: null` / `round: null` (empty wall-board frame; jumbotron shows the PAWNCH marquee).

**Tech Stack:** Unchanged.

## Global Constraints

- Everything in the batch-1/2 plans' Global Constraints verbatim.
- The params extension adds fields only — no existing scene reads them, so all 8 shipped drawLayered functions are untouched.
- Live-board render must be readable at 4px/cell (32×32 board) and NEVER mutate the array.
- `text()` from gfx.js is already imported in scenery.js (stadium's procedural jumbotron uses it).

---

### Task 1: Params extension — `board` + `round` into `drawScene`

**Files:**
- Modify: `src/states/boxing.js` (the `drawScene(...)` call), `tools/arena-preview.html` (demo board)

**Interfaces:**
- Produces: scene param object gains `board: Array(64)|null` (chess board cells: uppercase = white piece letter, lowercase = black, ''/null = empty) and `round: number|null`. Consumed by Tasks 5 & 7.

- [ ] **Step 1:** In `boxing.js` draw(): `drawScene(ctx, this.sceneId, { W, floorTop: 170, t: this.t, crowd: this.crowd, accent: this.accent, board: this.m.chess ? this.m.chess.board : null, round: this.m.round ?? null });`
- [ ] **Step 2:** In the harness: `import { newGame } from '../src/chess/board.js';` then `const demo = newGame().board;` and pass `board: demo, round: 3` in its `drawScene` call.
- [ ] **Step 3:** `node --check`, suite green, harness loads (no visual change yet). Commit: `git add src/states/boxing.js tools/arena-preview.html && git commit -m "feat(scenery): pass read-only board+round into scene draws (live-board plumbing)"`

---

### Task 2: UNDERWATER ABYSS — paint (`tools/paint_abyss.py` → `assets/sprites/arenas/abyss/`)

**Interfaces (Task 3 geometry):** vent chimneys **(120, 158) (390, 154)**; anglerfish lure tip **(452, 78)**; dome gallery viewport y130–158; kelp roots x: **62, 88, 424, 452** (painted in NEAR for layer-sway).

**Art spec (bioluminescent trench; BLUE0/1 + MAT depths, GREEN glows, INK rock):**
- `far.png` (opaque): vertical depth gradient BLUE1(top, faint light from above)→BLUE0→MAT0(bottom) with n2 dither; downwelling light shafts (2 broad faint SPEC1 10% dither columns from the top edge); trench walls closing in both sides (INK1 jagged silhouettes x0–70 and x442–512 full height, edge cracks) with scattered GREEN1 bio-dots; a distant school of tiny fish (STEEL3 3px dashes in a swirl cluster near (250,60)); marine snow (SPEC1 n2<0.004 flecks).
- `mid.png` (transparent): rocky outcrops at the trench floor flanking (x60–150, x360–450, y120–170: INK1/MAT1 boulder stacks with GREEN1 algae rims on their upper-left edges); two **vent chimneys** at the anchors (tapered stone stacks, INK1 with MAT3 streaks, dark mouth at top — code bubbles); the **anglerfish** lurking upper-right (x420–500, y60–95): a bulky dark fish silhouette (INK1 body with a MAT1 belly, jagged INK0 teeth in an open jaw, one pale STEEL3 eye) with a thin lure stalk arcing forward to the tip anchor (code pulses the glow); the **observation dome gallery** behind the ring (y126–170): a curved hull (STEEL0 with INK1 ribs every 26px) with a long viewport y130–158 (INK0 glass) full of spectators — merfolk/diver silhouettes (alternating: GREEN2-finned heads, SPEC1 dive helmets with BLUE4 visors), pitch 21.
- `near.png` (transparent): tall kelp stalks rooted at the four x anchors, sweeping up to y0 (GREEN1 ribbon stalks 3px wide with GREEN2 edge blades every 8px, gentle painted S-curves — the whole layer sways in code); two coral branches in the bottom-side corners above y50? NO — corners at top: a coral overhang top-left (RED2/EMBER5 branching antler shape x0–60/y0–30) + a small one top-right. Nothing below y50 except the kelp columns (thin, at screen edges — acceptable, they're 3px wide at x62/88/424/452, clear of tells).

- [ ] **Step 1:** Painter + paint + checker QA + composite. Gate: trench depth reads, anglerfish menacing, gallery spectators individual, kelp elegant.
- [ ] **Step 2:** Commit: `git add tools/paint_abyss.py assets/sprites/arenas/abyss && git commit -m "feat(art): underwater abyss arena layers — trench, anglerfish, dome gallery, kelp"`

### Task 3: UNDERWATER ABYSS — config + drawLayered + master + manifest

- [ ] **Step 1: Config** (extend `SCENERY.SCENES.abyss`):

```js
L: {
  vents: [[120, 158], [390, 154]],
  lure: [452, 78],
  jellyN: 4, planktonN: 12,
  causticN: 3, causticCol: '#6fa0ff',
  whalePeriod: 67, whaleDur: 9,
  kelpSway: 2.2, kelpHz: 0.45,
  bubCol: 'rgba(191,239,255,0.55)', jellyCols: ['#ffd0ff', '#c46aff'],
  lureCol: '#8af0c0', whaleCol: '#0d1226', flareCol: '#39d98a',
},
key: { color: '#6fa0ff', alpha: 0.14, wash: '#13357f', washA: 0.06 },  // drowned blue
```

- [ ] **Step 2: drawLayered** (novel = caustics, code jellyfish, whale):

```js
SCENES.abyss.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.abyss, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // RARE: a whale glides far behind the trench
  const wph = t % L.whalePeriod;
  if (wph < L.whaleDur) {
    const wx = -60 + (W + 120) * (wph / L.whaleDur), wy = 46 + Math.sin(wph * 0.7) * 6;
    ctx.fillStyle = L.whaleCol;
    ctx.beginPath();
    ctx.ellipse(wx, wy, 34, 9, 0, 0, Math.PI * 2); ctx.fill();          // body
    ctx.beginPath();
    ctx.moveTo(wx - 32, wy); ctx.lineTo(wx - 46, wy - 7); ctx.lineTo(wx - 44, wy + 5);
    ctx.closePath(); ctx.fill();                                        // fluke
  }
  // caustic light ripples playing over EVERYTHING behind the ring
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < L.causticN; i++) {
    ctx.strokeStyle = withA(L.causticCol, 0.06);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = 26 + i * 44 + Math.sin(x * 0.05 + t * (1.1 + i * 0.3)) * 7 + Math.sin(x * 0.013 - t * 0.7) * 10;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // anglerfish lure: slow hypnotic pulse
  additiveGlow(ctx, L.lure[0], L.lure[1], 9 + 3 * Math.sin(t * 1.2), L.lureCol, 0.5 + 0.2 * Math.sin(t * 2.4));
  ctx.fillStyle = L.lureCol; ctx.fillRect(L.lure[0] - 1, L.lure[1] - 1, 2, 2);
  // vent bubbles rising in wobbling columns
  L.vents.forEach(([vx, vy], i) => {
    for (let k = 0; k < 5; k++) {
      const ph = (t * 0.5 + k * 0.2 + i * 0.37) % 1;
      ctx.fillStyle = L.bubCol;
      ctx.beginPath();
      ctx.arc(vx + Math.sin(ph * 9 + k) * 4, vy - ph * 90, 1 + ph * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // jellyfish blooms drifting upward (glow + dome + trailing tentacles)
  for (let i = 0; i < L.jellyN; i++) {
    const jx = ((i + 0.5) / L.jellyN) * W + Math.sin(t * 0.7 + i * 2) * 16;
    const jy = floorTop - ((t * 9 + i * 47) % (floorTop + 24));
    const col = L.jellyCols[i % L.jellyCols.length];
    additiveGlow(ctx, jx, jy, 13, col, 0.35 + crowd * 0.2);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(jx, jy, 7, 5, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = withA(col, 0.7); ctx.lineWidth = 1; ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(jx + k * 2.5, jy);
      ctx.lineTo(jx + k * 2.5 + Math.sin(t * 3 + k + i) * 2, jy + 8);
    }
    ctx.stroke();
  }
  // plankton motes
  for (let i = 0; i < L.planktonN; i++)
    twinkle(ctx, drift(t, 1.5 + i * 0.5, W, 8, i * 44), 20 + hash(i + 6) * 120, 1, '#bfefff', t * 1.2, i * 2.7);
  if (layers.near) {
    ctx.save(); ctx.translate(Math.sin(t * L.kelpHz) * L.kelpSway, 0);
    ctx.drawImage(layers.near, 0, 0); ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.10); ctx.fillRect(0, 0, W, floorTop); }
};
```

- [ ] **Step 3:** Master + manifest (`"abyss": "arenas/abyss"`) + checks + harness shots.
- [ ] **Step 4:** Commit: `git add src/config.js src/scenery.js assets/sprites/manifest.json assets/aseprite/arena-abyss.aseprite && git commit -m "feat(scenery): underwater abyss v2 — caustics, jellyfish, anglerfish lure, whale"`

---

### Task 4: GRAND CHESS HALL — paint (`tools/paint_chesshall.py` → `assets/sprites/arenas/chesshall/`)

**Interfaces (Task 5 geometry):** wall-board frame outer **x48–92, y34–78** (playing surface = **32×32 at (54,40)**, 4px cells); chandeliers at **(180, 26) (332, 26)**; rose window center **(256, 44)** r34.

**Art spec (gala interior; WOOD wainscot + STEEL marble + GOLD + glass colors):**
- `far.png` (opaque): back wall — upper zone MAT1 with WOOD1 paneling below y96 (vertical panel lines WOOD0 every 38px, GOLD0 trim rail at y96); the great **rose window** centered (256,44): a circular arch of glass segments — 8 wedge panes alternating RED2/BLUE4/GOLD2/GREEN2 (each pane dithered 70% with its color over MAT1, INK1 lead lines between wedges, a chess-knight silhouette (INK1, small stencil) in the center roundel), outer stone ring STEEL2; two tall slit windows flanking at x120/x392 (BLUE4 glass 60% dither, STEEL2 sills).
- `mid.png` (transparent): four **marble columns** (x70, x180, x332, x442; 16px wide, y0–170): STEEL3 shafts with STEEL4 left-lit edges and faint MAT4 veining squiggles, GOLD1 capitals (y18–24) and bases (y150–158); two **chandeliers** hanging at the anchors: STEEL1 chain from y0, a GOLD1 double-ring body (r10 and r6 arcs) with 6 candle stubs (SPEC1 2px) — unlit (code glows); the **wall-board** on the left wall: WOOD2 heavy frame x48–92/y34–78 with GOLD1 inner bead, the playing field left as alternating MAT1/WOOD1 4px checker (32×32 at (54,40)) — code draws the pieces; a matching EMPTY frame on the right wall x420–464 (a gilded mirror: STEEL4 with SPEC1 glint streak); the **formal audience**: two rows y132–164 (pitch 15): tuxedo silhouettes (INK0 with 2px SPEC1 shirt-front) alternating with gown figures (RED2/BLUE4/GREEN2/GOLD1 shoulders, INK1 updo heads), a few GOLD2 opera-glass glints; a parquet floor hint strip y164–170 (WOOD1/WOOD2 herringbone ticks).
- `near.png` (transparent): velvet drape swags from both top corners (RED1 body with RED2 fold highlights, deep scalloped bottom edges, GOLD1 cords + tassels hanging at x150/x362 to y40). Nothing below y50.

- [ ] **Step 1:** Painter + paint + QA + composite. Gate: rose window glows with color even unlit, columns read marble, audience reads formal, board frame awaits its position.
- [ ] **Step 2:** Commit: `git add tools/paint_chesshall.py assets/sprites/arenas/chesshall && git commit -m "feat(art): grand chess hall arena layers — rose window, marble, gala audience, wall-board"`

### Task 5: GRAND CHESS HALL — config + drawLayered (LIVE BOARD) + master + manifest

- [ ] **Step 1: Config** (extend `SCENERY.SCENES.chesshall`):

```js
L: {
  wallBoard: { x: 54, y: 40, cell: 4 },            // 32x32 playing field
  chandeliers: [[180, 26], [332, 26]],
  window: [256, 44],
  waiterPeriod: 49, waiterDur: 6,
  drapeSway: 0.8, drapeHz: 0.4,
  whitePiece: '#ffe7a8', blackPiece: '#0d1226',
  paneCols: ['#c22037', '#5a8aff', '#ffd24a', '#39d98a'],
  candleCol: '#ffd24a', dustCol: '#cdd6ff',
  waiterCol: '#070a16', trayCol: '#cdd6ff', flareCol: '#ffd24a',
},
key: { color: '#ffe7a8', alpha: 0.12, wash: '#c9962a', washA: 0.03 },  // candlelit gala
```

- [ ] **Step 2: drawLayered** — the LIVE WALL-BOARD is the centerpiece: it reads `p.board` (READ-ONLY; null → empty board) and paints each occupied cell as a 2×2 block, white pieces warm-light, black pieces ink-dark:

```js
SCENES.chesshall.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd, board } = p;
  const C = SCENERY.SCENES.chesshall, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // stained-glass light: colored beams angling down-left from the rose window
  L.paneCols.forEach((col, i) => {
    const sh = 0.7 + 0.3 * Math.sin(t * 0.5 + i * 1.7);
    godRay(ctx, L.window[0] + (i - 1.5) * 12, L.window[1] + 20, L.window[0] - 60 + i * 44, floorTop, 5, 18, col, 0.05 * sh);
  });
  // dust motes floating in the window light
  for (let i = 0; i < 8; i++)
    twinkle(ctx, L.window[0] - 50 + hash(i) * 100, 60 + hash(i + 3) * 80 + Math.sin(t * 0.6 + i) * 4, 1, L.dustCol, t * 0.8, i * 2.2);
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // THE LIVE DEMONSTRATION BOARD — mirrors the actual match position
  if (board) {
    const { x: bx, y: by, cell } = L.wallBoard;
    for (let i = 0; i < 64; i++) {
      const pc = board[i];
      if (!pc) continue;
      const r = (i / 8) | 0, c2 = i % 8;
      const isWhite = pc === pc.toUpperCase();
      ctx.fillStyle = isWhite ? L.whitePiece : L.blackPiece;
      ctx.fillRect(bx + c2 * cell + 1, by + r * cell + 1, cell - 2, cell - 2);
    }
    // a soft scholar's lamp over the board
    additiveGlow(ctx, bx + 16, by - 6, 16, L.candleCol, 0.18);
  }
  // chandeliers: candle glows with a gentle flicker
  L.chandeliers.forEach(([cx, cy], i) => {
    additiveGlow(ctx, cx, cy, 20, L.candleCol, 0.35 + 0.06 * Math.sin(t * 5 + i * 2));
    for (let k = -1; k <= 1; k++)
      flame(ctx, cx + k * 8, cy - 3, 2, t, i * 2 + k, '#fff6c0', '#ff9a18', '#ffb24a');
  });
  // audience pearl/opera-glass glints
  for (let i = 0; i < 5; i++)
    twinkle(ctx, 90 + hash(i + 9) * 330, 136 + hash(i + 12) * 20, 1, '#fff6d8', t * 2.5, i * 3.1);
  // RARE: a waiter crosses with a glinting tray
  const wph = t % L.waiterPeriod;
  if (wph < L.waiterDur) {
    const wx = -10 + (W + 20) * (wph / L.waiterDur), wy = 150;
    ctx.fillStyle = L.waiterCol;
    ctx.fillRect(wx | 0, wy - 12, 5, 12);                              // figure
    ctx.beginPath(); ctx.arc(wx + 2, wy - 15, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.trayCol; ctx.fillRect((wx + 5) | 0, wy - 17, 7, 1); // tray
    if (Math.floor(t * 3) % 2) twinkle(ctx, wx + 8, wy - 19, 1, '#fff6d8', t * 4, 0);
  }
  if (layers.near) {
    ctx.save(); ctx.translate(Math.sin(t * L.drapeHz) * L.drapeSway, 0);
    ctx.drawImage(layers.near, 0, 0); ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.10); ctx.fillRect(0, 0, W, floorTop); }
};
```

- [ ] **Step 3:** Master + manifest (`"chesshall": "arenas/chesshall"`) + checks + harness shot (demo board visible on the wall!).
- [ ] **Step 4:** Commit: `git add src/config.js src/scenery.js assets/sprites/manifest.json assets/aseprite/arena-chesshall.aseprite && git commit -m "feat(scenery): grand chess hall v2 — LIVE wall-board, stained-glass light, chandeliers"`

---

### Task 6: MEGA STADIUM — paint (`tools/paint_stadium.py` → `assets/sprites/arenas/stadium/`)

**Interfaces (Task 7 geometry):** jumbotron screen inner **x216–296, y16–48** (frame around it); pyro nozzles **(140, 152) (372, 152)**; searchlight pivots **(70, 6) (442, 6)**; crowd tier bands (the wave sweeps them): **y58–88, y92–122, y126–156**; letter-card block centered x186–326 in the middle tier.

**Art spec (night bowl; INK/MAT structure + dense colorful crowd + brand accents):**
- `far.png` (opaque): night-sky sliver y0–14 (INK0 + sparse stars); the upper bowl rim: roof band y14–26 (INK1 with STEEL0 edge) carrying painted light-bank housings (GOLD0 clusters of 4 every 60px, unlit) and the two searchlight pivot mounts (STEEL1 turrets); the topmost distant tier y26–54: dense micro-crowd (1px color flecks — MAT1 base with n2-scattered RED2/BLUE4/GOLD1/GREEN2 at 30%).
- `mid.png` (transparent): the **jumbotron** center-top: heavy STEEL0/INK1 frame x208–304/y8–56 with corner bolts and two support struts to the roof, screen interior INK0 (code draws content), a GOLD1 PAWNCH plate under it; three **crowd tier bands** at the interface y ranges: each a MAT1 slab with rows of 2×3px spectator blocks in shuffled bright colors (RED2/RED3/BLUE3/BLUE4/GOLD1/GOLD2/GREEN2/EMBER4/SPEC1 at pitch 5, jittered) — denser and larger front-to-back, separated by INK0 step shadows and BLUE1 rail lines; in the MIDDLE tier, the **letter-card block**: centered x186–326, six 20×16 card panels spelling P-A-W-N-C-H (GOLD2 letters on EMBER3 cards, using the F35 font at scale 4 — import the glyph helper pattern); two **pyro nozzles** at the anchors (STEEL0 angled tubes with INK0 mouths); confetti-cannon poles at x30/x482 (WOOD1 with EMBER4 barrel).
- `near.png` (transparent): two big brand flags waving in from the top corners (left ORANGE `#ff7a18`≈EMBER4 field with a GOLD2 pawn-silhouette blob; right BLUE4 field with SPEC1 blob), painted mid-ripple like the castle banners. Nothing below y50.

- [ ] **Step 1:** Painter + paint + QA + composite. Gate: crowd reads DENSE and colorful (this is the loudest arena — value ceiling just below the fighters), jumbotron frame commanding, letter cards legible.
- [ ] **Step 2:** Commit: `git add tools/paint_stadium.py assets/sprites/arenas/stadium && git commit -m "feat(art): mega stadium arena layers — bowl tiers, jumbotron, letter cards, pyro"`

### Task 7: MEGA STADIUM — config + drawLayered (LIVE JUMBOTRON + WAVE) + master + manifest

- [ ] **Step 1: Config** (extend `SCENERY.SCENES.stadium`):

```js
L: {
  screen: { x: 216, y: 16, w: 80, h: 32 },
  pyro: [[140, 152], [372, 152]],
  lights: [[70, 6], [442, 6]],
  tiers: [[58, 88], [92, 122], [126, 156]],
  waveSpeed: 90, waveW: 70,                      // px/sec, band width
  confN: 16, blimpPeriod: 71, blimpDur: 12,
  flagSway: 1.8, flagHz: 0.8,
  marquee: ['#ff7a18', '#ffd24a', '#2b6cff', '#39d98a'],
  pyroCore: '#fff6c0', pyroMid: '#ff9a18', pyroGlow: '#ffb24a',
  beamCol: '#cdd6ff', blimpCol: '#26304f', flareCol: '#ff7a18',
  confCols: ['#ff7a18', '#ffd24a', '#2b6cff', '#39d98a', '#e8f2ff'],
},
key: { color: '#fff6d8', alpha: 0.10, wash: '#ff7a18', washA: 0.03 },  // arena floodlight
```

- [ ] **Step 2: drawLayered** — novel: the traveling-brightness WAVE over painted tiers, sweeping searchlights, the LIVE jumbotron (`round` param; null → PAWNCH marquee only), pyro on surges, blimp:

```js
SCENES.stadium.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd, round } = p;
  const C = SCENERY.SCENES.stadium, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  // RARE: the blimp cruises the sky sliver with blinking lights
  const bph = t % L.blimpPeriod;
  if (bph < L.blimpDur) {
    const bx = -40 + (W + 80) * (bph / L.blimpDur), by = 8;
    ctx.fillStyle = L.blimpCol;
    ctx.beginPath(); ctx.ellipse(bx, by, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect((bx - 4) | 0, by + 5, 8, 3);                          // gondola
    if (Math.floor(t * 3) % 2) { ctx.fillStyle = '#ff3b53'; ctx.fillRect(bx | 0, by - 7, 1, 1); }
  }
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // THE WAVE: a traveling brightness band sweeping the painted crowd tiers
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const wx2 = (t * L.waveSpeed) % (W + L.waveW * 2) - L.waveW;
  L.tiers.forEach(([ty0, ty1], ti) => {
    const off = ti * 60;                                   // tiers lag each other
    const x0 = ((wx2 + off) % (W + L.waveW * 2)) - L.waveW;
    const g = ctx.createLinearGradient(x0 - L.waveW, 0, x0 + L.waveW, 0);
    g.addColorStop(0, 'rgba(255,246,216,0)');
    g.addColorStop(0.5, 'rgba(255,246,216,' + (0.14 + crowd * 0.10).toFixed(2) + ')');
    g.addColorStop(1, 'rgba(255,246,216,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0 - L.waveW, ty0, L.waveW * 2, ty1 - ty0);
  });
  ctx.restore();
  // sweeping searchlights from the roof pivots
  L.lights.forEach(([lx, ly], i) => {
    const sweep = Math.sin(t * 0.6 + i * 2.4) * 120;
    spotCone(ctx, { cx: lx + sweep * 0.4, topY: ly, floorY: floorTop, topHalfW: 4, botHalfW: 30, color: L.beamCol, alpha: 0.08 + crowd * 0.04 });
    additiveGlow(ctx, lx, ly, 8, L.beamCol, 0.4);
  });
  // THE LIVE JUMBOTRON: round number when known, marquee chase always
  const S = L.screen;
  const mi = Math.floor(t * 6) % L.marquee.length;
  ctx.strokeStyle = L.marquee[mi]; ctx.lineWidth = 2;
  ctx.strokeRect(S.x - 2, S.y - 2, S.w + 4, S.h + 4);                  // chasing border
  if (round != null) {
    text(ctx, 'ROUND', S.x + S.w / 2, S.y + 4, { scale: 1, color: L.marquee[(mi + 1) % 4], align: 'center' });
    text(ctx, String(round), S.x + S.w / 2, S.y + 15, { scale: 2, color: '#fff6d8', align: 'center' });
  } else {
    text(ctx, 'PAWNCH', S.x + S.w / 2, S.y + 12, { scale: 1, color: L.marquee[mi], align: 'center' });
  }
  additiveGlow(ctx, S.x + S.w / 2, S.y + S.h / 2, 34, L.marquee[mi], 0.10);
  // pyro columns on crowd surges
  if (crowd > 0.5) {
    L.pyro.forEach(([px2, py2], i) =>
      flame(ctx, px2, py2 - 8, 7 + crowd * 4, t, i * 1.3, L.pyroCore, L.pyroMid, L.pyroGlow));
  }
  // confetti rain (denser with the crowd)
  const confN = Math.floor(L.confN * (0.5 + crowd));
  for (let i = 0; i < confN; i++) {
    const cx2 = hash(i + 40) * W, cy2 = (t * 34 + i * 31) % floorTop;
    ctx.fillStyle = L.confCols[i % L.confCols.length];
    ctx.fillRect(cx2 | 0, cy2 | 0, 2, 3);
  }
  if (layers.near) {
    ctx.save(); ctx.translate(Math.sin(t * L.flagHz) * L.flagSway, 0);
    ctx.drawImage(layers.near, 0, 0); ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.12); ctx.fillRect(0, 0, W, floorTop); }
};
```

- [ ] **Step 3:** Master + manifest (`"stadium": "arenas/stadium"`) + checks + harness shots (`round: 3` demo shows "ROUND 3" on the jumbotron; `&crowd=70` shows pyro + wave surging).
- [ ] **Step 4:** Commit: `git add src/config.js src/scenery.js assets/sprites/manifest.json assets/aseprite/arena-stadium.aseprite && git commit -m "feat(scenery): mega stadium v2 — LIVE jumbotron, crowd wave, searchlights, pyro"`

---

### Task 8: Roster-complete sweep + docs + checkpoint

- [ ] Suite green; zero-asset boot; full boot (~218 sprites); bare spot-check one arena.
- [ ] Gallery of all three + send; spec V3 row → COMPLETE (all 11 arenas); CLAUDE.md tour line updated ("all 11 arenas shipped"); memory update (next = V4 chess panel). Commit → merge main → suite → push → delete branch.
