# Visual Overhaul V3 Batch 2 — Temple, Castle, Space: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three more painted arenas — Bishop's MOUNTAIN TEMPLE, Queen's SKY CASTLE, Iron's DEEP SPACE — completing 8 of 11 scenes on the proven pipeline.

**Architecture:** Identical to batch 1 (`docs/superpowers/plans/2026-07-21-visual-overhaul-v3-batch1.md`): per arena a PIL painter → 3 layers → `L` config knobs + `key` → `drawLayered` following `SCENES.beach.drawLayered` structurally → `.aseprite` master + manifest → fallback intact. Novel mechanics this batch: a **t-schedule reactive** (temple gong rings while `t < GONG_S`, i.e. at every boxing-half start), **code-animated machinery on painted anchors** (space gears/pistons — the holo-rook pattern), and **crowd-spike reactives** (castle trumpet flourish, space warning strobes).

**Tech Stack:** Unchanged (PIL painters, Canvas 2D, Aseprite MCP masters, headless-Chrome QA).

## Global Constraints

- Everything in the batch-1 plan's Global Constraints verbatim (pure-t scenes; 512×170 layers, far opaque; near above y50; per-arena master+manifest+commit; suite `66 passed, 0 failed`; harness QA `?scene=<id>` / `&crowd=60` / `?bare=1`).
- No palette additions this batch — all three scenes fit the master ramps (twilight = MAT+RED4, daylight = BLUE+STEEL+SPEC, space = INK+STEEL+MAT+GOLD warnings).
- Boxing halves reset `this.t = 0` on enter, so `t < N` in a drawLayered fires at every round start — that's the temple gong's trigger (no sim/state coupling).

---

### Task 1: MOUNTAIN TEMPLE — paint (`tools/paint_temple.py` → `assets/sprites/arenas/temple/`)

**Interfaces (geometry Task 2 must match):** gong center **(256, 46)** r16; incense burners **(150, 132) (362, 132)**; stone lanterns **(96, 120) (416, 120)**; monk-bowl anchors: row y142 pitch 22, x116–396.

**Art spec (twilight monastery; MAT ramp sky + RED4 horizon, STEEL peaks, WOOD/GOLD shrine):**
- `far.png` (opaque): twilight bands top→down MAT1→MAT2→MAT3 with a RED4 glow band above the peaks (dither transitions, wobbled); two mountain ranges — back: STEEL1 ridgeline y64–96 with SPEC1 snowcaps (top 3 rows dithered), front: MAT1 dark ridge y84–120; a tiny pagoda silhouette (INK1, 12×16, tiered roofs) on the front ridge at x430; thin static cloud wisps (STEEL4 20% dither lenses) at y50–70.
- `mid.png` (transparent): TWO carved bishop statues flanking (x28–72 and x440–484, y28–170): robed stone figures — STEEL2 base, STEEL1 shadow (inner side), STEEL3 lit planes (outer), the **cleft mitre** heads (the bishop's signature), MAT3 crack lines, draped prayer scarves (GOLD1 + RED2 bands) around their necks; the **great gong** at (256,46): WOOD1 frame posts + top beam, disc r16 — GOLD0 rim, GOLD1 face, EMBER3 boss center, hung by STEEL1 cords (painted still; code rings it); shrine platform strip behind the ring (y126–170): WOOD2 planks with WOOD0 gaps, stone base; **monk row** at y142: seated figures pitch 22 (x116–396) — WOOD1 robes, bald heads (WOOD4 with a GOLD0 crown-rim left), each with a small bowl (STEEL1) at the anchor (code adds bowl flames); two stone lanterns at the anchors (STEEL1 pillar, roofed cap, dark hollow — code glows); two incense burners (bronze pots GOLD0/WOOD1) at the anchors (code smokes).
- `near.png` (transparent): prayer-flag strings across BOTH top corners: sagging cords (INK2) from the edges to x~180/x~330 at y8–26, with flags every 14px alternating EMBER4/GOLD2/BLUE4/GREEN2/SPEC1 (6×8 rects with 1px darker bottom edge + ragged fly-end); a temple eave corner top-left (x0–46/y0–18, WOOD1 with upturned tip + a small bronze wind-bell GOLD0). Nothing below y50.

- [ ] **Step 1:** Painter (batch-1 skeleton) + paint + QA (checker for mid/near, PIL composite). Gate: statues read as mitred bishops, gong reads bronze, flags colorful but small.
- [ ] **Step 2:** Commit: `git add tools/paint_temple.py assets/sprites/arenas/temple && git commit -m "feat(art): mountain temple arena layers — bishop statues, gong, monks, prayer flags"`

### Task 2: MOUNTAIN TEMPLE — config + drawLayered + master + manifest

- [ ] **Step 1: Config** (extend `SCENERY.SCENES.temple`, keep procedural keys):

```js
L: {
  gong: [256, 46], gongR: 16, gongS: 1.2,          // rings while t < gongS (every round start)
  burners: [[150, 132], [362, 132]],
  lanterns: [[96, 120], [416, 120]],
  bowls: { y: 142, x0: 116, x1: 396, pitch: 22 },
  cloudN: 3, craneperiod: 57, craneDur: 4.5,
  flagSway: 1.4, flagHz: 0.9,
  fireCore: '#fff6c0', fireMid: '#ff9a18', fireGlow: '#ffb24a',
  smokeCol: '#8ea0cf', craneCol: '#e8f2ff', flareCol: '#ffd24a',
},
key: { color: '#b8d0ff', alpha: 0.12, wash: '#5563a8', washA: 0.04 },  // twilight-cool rim
```

- [ ] **Step 2: drawLayered** (beach template; novel = gong ring, incense, crane):

```js
SCENES.temple.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.temple, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  for (let i = 0; i < L.cloudN; i++)                     // drifting twilight cloud glows
    additiveGlow(ctx, drift(t, 4 + i * 2, W, 60, i * 160), 56 + i * 8, 40, '#cdd6ff', 0.05);
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // THE GONG rings at every round start (t resets per boxing half): expanding
  // ring strokes + a warm shimmer on the disc while t < gongS
  if (t < L.gongS) {
    const k = t / L.gongS;
    additiveGlow(ctx, L.gong[0], L.gong[1], L.gongR * 2, '#ffd24a', 0.5 * (1 - k));
    for (let r = 0; r < 2; r++) {
      ctx.strokeStyle = withA('#ffe7a8', (1 - k) * (0.5 - r * 0.2));
      ctx.lineWidth = 2 - r;
      ctx.beginPath(); ctx.arc(L.gong[0], L.gong[1], L.gongR + 4 + k * (26 + r * 14), 0, Math.PI * 2); ctx.stroke();
    }
  }
  // stone-lantern glows + monk candle bowls
  L.lanterns.forEach(([lx, ly], i) => additiveGlow(ctx, lx, ly, 12, L.fireGlow, 0.35 + 0.05 * Math.sin(t * 2 + i)));
  for (let bx = L.bowls.x0; bx <= L.bowls.x1; bx += L.bowls.pitch)
    flame(ctx, bx, L.bowls.y - 2, 3, t, bx * 0.13, L.fireCore, L.fireMid, L.fireGlow);
  // incense: thin rising smoke wisps
  L.burners.forEach(([sx, sy], i) => {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.25 + k * 0.33 + i * 0.5) % 1;
      additiveGlow(ctx, sx + Math.sin(t * 0.8 + k * 2 + i) * (3 + ph * 8), sy - ph * 54, 5 + ph * 7, L.smokeCol, 0.10 * (1 - ph));
    }
  });
  // RARE: a crane glides across the peaks
  const cph = t % L.craneperiod;
  if (cph < L.craneDur) {
    const cx = -16 + (W + 32) * (cph / L.craneDur), cy = 58 + Math.sin(cph * 2) * 5;
    const wing = Math.sin(t * 6) * 4;
    ctx.strokeStyle = L.craneCol; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - wing); ctx.lineTo(cx, cy); ctx.lineTo(cx + 7, cy - wing);
    ctx.moveTo(cx, cy); ctx.lineTo(cx + 5, cy + 1);      // trailing legs
    ctx.stroke();
  }
  if (layers.near) {
    ctx.save(); ctx.translate(Math.sin(t * L.flagHz) * L.flagSway, 0);
    ctx.drawImage(layers.near, 0, 0); ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.10); ctx.fillRect(0, 0, W, floorTop); }
};
```

- [ ] **Step 3:** Master + manifest (`"temple": "arenas/temple"`) + checks + harness shots (one at low virtual time to catch the gong ring).
- [ ] **Step 4:** Commit: `git add src/config.js src/scenery.js assets/sprites/manifest.json assets/aseprite/arena-temple.aseprite && git commit -m "feat(scenery): mountain temple v2 — gong ring, candle bowls, incense, crane"`

---

### Task 3: SKY CASTLE — paint (`tools/paint_castle.py` → `assets/sprites/arenas/castle/`)

**Interfaces (geometry Task 4 must match):** waterfall sheet **x330–345, y95–168** (mist base at (338,164)); trumpeters at **(84, 138) (428, 138)**; keep banners' poles at **(210, 24) (300, 18)**.

**Art spec (bright daylight; BLUE sky + SPEC/STEEL clouds + STEEL keep + RED roofs):**
- `far.png` (opaque): daylight sky BLUE2(top)→BLUE4→BLUE6(horizon) dithered; big cumulus clouds (3–4): SPEC1 tops, STEEL4 bodies, STEEL3 flat undersides, jittered lens stacks; two tiny distant floating islets (STEEL1 with GREEN1 lips) at (60,90) and (470,70).
- `mid.png` (transparent): THE floating keep left-of-center, x150–360: island rock chunk y95–135 (STEEL0/MAT1 with cracks, GREEN1/GREEN2 grass lip at y95, hanging root strands below to y150); keep on top y20–95: central hall (STEEL2 walls, STEEL3 lit left faces, arrow-slit windows INK1) + two round towers with RED2/RED3 conical roofs + GOLD2 finials, banner poles at the two anchors (bare — code doesn't animate these, the PAINTED banners fly from them: EMBER4 and BLUE4 swallow-tails mid-wave); the **waterfall** pouring off the island's right edge: BLUE5 sheet x330–345 with SPEC1 vertical streak dithering, falling past the island bottom to y168 (code animates foam + mist); royal **parapet** across the bottom y132–170: STEEL1 stone with crenellations (merlon blocks y132–140), noble spectator row behind it y126–140: small figures with colorful hats/hennins (RED3, BLUE4, GOLD2, GREEN2 dots on STEEL4 faces), and TWO trumpeter silhouettes at the anchors — INK1 figures with long GOLD1 horns angled up-out (code glints them on crowd spikes).
- `near.png` (transparent): two long streaming swallow-tail banners from the top corners (left: RED3 with GOLD2 tail-trim; right: BLUE4 with SPEC1 trim), painted mid-ripple (3 wave segments each, 10px tall, reaching to x~150/x~370); a few GOLD2 sparkle motes. Nothing below y50.

- [ ] **Step 1:** Painter + paint + QA + composite. Gate: clouds read puffy-bright, keep reads regal, waterfall streaks vertical, trumpeters readable at the parapet ends.
- [ ] **Step 2:** Commit: `git add tools/paint_castle.py assets/sprites/arenas/castle && git commit -m "feat(art): sky castle arena layers — floating keep, waterfall, royal parapet"`

### Task 4: SKY CASTLE — config + drawLayered + master + manifest

- [ ] **Step 1: Config** (extend `SCENERY.SCENES.castle`):

```js
L: {
  fall: { x: 338, y0: 95, y1: 168 }, mist: [338, 164],
  trumpeters: [[84, 138], [428, 138]],
  cloudN: 3, petalN: 7,
  flyPeriod: 61, flyDur: 5,
  bannerSway: 1.6, bannerHz: 0.7,
  petalCol: '#ff8a96', mistCol: '#e8f2ff', glintCol: '#ffe7a8',
  flyCol: '#26304f', flareCol: '#ffd24a',
},
key: { color: '#fff6d8', alpha: 0.10, wash: '#b8d0ff', washA: 0.03 },  // airy daylight
```

- [ ] **Step 2: drawLayered** (novel = waterfall foam/mist, trumpet flourish, flyby, petals):

```js
SCENES.castle.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.castle, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  for (let i = 0; i < L.cloudN; i++)                     // near cloud-drift glows
    additiveGlow(ctx, drift(t, 5 + i * 3, W, 70, i * 140), 30 + i * 18, 46, '#e8f2ff', 0.08);
  // RARE: a winged silhouette glides past behind the keep
  const fph = t % L.flyPeriod;
  if (fph < L.flyDur) {
    const fx = W + 20 - (W + 40) * (fph / L.flyDur), fy = 40 + Math.sin(fph * 1.5) * 8;
    const flap = Math.sin(t * 5) * 5;
    ctx.strokeStyle = L.flyCol; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx - 10, fy - flap); ctx.lineTo(fx, fy); ctx.lineTo(fx + 10, fy - flap);
    ctx.stroke();
    ctx.fillStyle = L.flyCol; ctx.fillRect((fx - 2) | 0, fy | 0, 5, 2);  // body
  }
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // waterfall: falling foam dashes + drifting mist at the base
  for (let k = 0; k < 9; k++) {
    const ph = (t * 1.4 + k * 0.11) % 1;
    const fy2 = L.fall.y0 + (L.fall.y1 - L.fall.y0) * ph;
    ctx.fillStyle = 'rgba(232,242,255,' + (0.5 + 0.3 * hash(k)).toFixed(2) + ')';
    ctx.fillRect((L.fall.x - 6 + hash(k) * 12) | 0, fy2 | 0, 2, 4 + hash(k + 3) * 4);
  }
  additiveGlow(ctx, L.mist[0], L.mist[1], 18 + 3 * Math.sin(t * 1.7), L.mistCol, 0.22);
  // trumpeters flourish when the crowd surges (knockdowns / big hits)
  if (crowd > 0.35) {
    L.trumpeters.forEach(([tx, ty], i) => {
      additiveGlow(ctx, tx, ty - 6, 10, L.glintCol, 0.5 * crowd);
      for (let s = 0; s < 3; s++)
        twinkle(ctx, tx + (i ? -1 : 1) * (6 + s * 5), ty - 10 - s * 4, 1, L.glintCol, t * 6, s * 1.2);
    });
  }
  // petals drifting on the wind
  for (let i = 0; i < L.petalN; i++) {
    const px2 = drift(t, 9 + i * 2, W, 14, i * 80);
    const py2 = 30 + hash(i + 4) * 100 + Math.sin(t * 1.6 + i * 1.3) * 9;
    ctx.fillStyle = L.petalCol;
    ctx.fillRect(px2 | 0, py2 | 0, 2, 1 + (Math.floor(t * 3 + i) % 2));
  }
  if (layers.near) {
    ctx.save(); ctx.translate(Math.sin(t * L.bannerHz) * L.bannerSway, 0);
    ctx.drawImage(layers.near, 0, 0); ctx.restore();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.10); ctx.fillRect(0, 0, W, floorTop); }
};
```

- [ ] **Step 3:** Master + manifest (`"castle": "arenas/castle"`) + checks + harness shots (`&crowd=70` to see the flourish).
- [ ] **Step 4:** Commit: `git add src/config.js src/scenery.js assets/sprites/manifest.json assets/aseprite/arena-castle.aseprite && git commit -m "feat(scenery): sky castle v2 — waterfall mist, trumpet flourish, petals, flyby"`

---

### Task 5: DEEP SPACE — paint (`tools/paint_space.py` → `assets/sprites/arenas/space/`)

**Interfaces (geometry Task 6 must match):** planet center **(400, 60)** r38 (ring ellipse painted); gear hubs (code rotates spoke wheels inside): **(40, 54) r14** and **(40, 96) r10**; piston slots (code slides rods): **(468, 40, h30)** and **(486, 52, h24)** (x, top y, slot height); beacon domes **(120, 14) (392, 14)**; astronaut viewport strip y128–158.

**Art spec (INK space + STEEL station + MAT/BLUE planet + GOLD/RED warnings):**
- `far.png` (opaque): INK0 space with two star densities (STEEL3 sparse n2<0.006, SPEC1 rare n2<0.002 — code twinkles some); a nebula wash lower-left (MAT2 + RED1 cloud dither, 20–30%); the **ringed gas giant** at (400,60) r38: horizontal turbulent bands MAT3/MAT4/BLUE1/STEEL1 (band edges wobbled with n2), terminator shading on the right third (darken to MAT1); the **ring system**: flat ellipse (rx 62, ry 14, same center) — STEEL3 outer band, GOLD1 inner band, 2px gap between; rings pass IN FRONT below planet center and BEHIND above (paint front half only over the disc); a tiny cratered moon (STEEL2 r5) at (330,26).
- `mid.png` (transparent): the orbital platform — LEFT machinery column x0–72: two **gear housings** at the hub anchors: outer ring gear teeth (STEEL1 ring with INK0 tooth gaps around radius, bolted STEEL3 rivets) with EMPTY centers (code draws rotating spoke wheels); pipes (STEEL0 verticals with elbow bends), a GOLD0/INK0 hazard-striped edge column; RIGHT machinery column x440–512: two **piston slots** at the anchors (STEEL0 cylinder frames, dark INK0 slot interiors — code slides the rods), a radar dish (STEEL2 arc on a pivot) at (476,20), cable bundles; overhead spine truss y6–22 spanning x60–450 (STEEL0 X-braced like classic but heavier) with two **beacon domes** (RED1 hemispheres, unlit) at the anchors + hanging work-lamp housings (GOLD0, unlit) at x180/x260/x340; the **astronaut gallery**: hull deck y128–170 (STEEL0 plating with INK1 panel seams + rivet dots) with a long viewport strip y132–154 (INK0 glass): inside, a row of little astronauts pitch 24 x84–428 — SPEC1 helmets (with 1px BLUE4 visor glint), suits alternating BLUE3/RED2/GOLD1/GREEN2, some waving (raised 2px arm); TWO floating astronauts OUTSIDE above the deck at (150,108) and (350,100): tethered (1px STEEL1 line to the deck), full suits (code puffs their thrusters).
- `near.png` (transparent): heavy foreground truss braces in the top corners (STEEL0/INK0 girders with rivets + GOLD0/INK0 hazard chevrons on their inner edges), one dangling power cable with a plug head from top-right to (430,40). Nothing below y50.

- [ ] **Step 1:** Painter + paint + QA + composite. Gate: planet bands read painterly, ring passes correctly in front/behind, gear housings clearly await their inner wheels, astronauts read as individuals.
- [ ] **Step 2:** Commit: `git add tools/paint_space.py assets/sprites/arenas/space && git commit -m "feat(art): deep space arena layers — ringed giant, orbital platform, astronaut gallery"`

### Task 6: DEEP SPACE — config + drawLayered + master + manifest

- [ ] **Step 1: Config** (extend `SCENERY.SCENES.space`):

```js
L: {
  planet: [400, 60],
  gears: [[40, 54, 14, 1], [40, 96, 10, -1.6]],   // [x, y, spoke radius, spin speed]
  pistons: [[468, 40, 30, 1.1], [486, 52, 24, 1.7]], // [x, top, slot h, speed]
  beacons: [[120, 14], [392, 14]],
  lamps: [120, 180, 260, 340, 392],
  floaters: [[150, 108], [350, 100]],
  debrisN: 5, twinkN: 10,
  cometPeriod: 43, cometDur: 2.2,
  gearCol: '#5a6fa0', rodCol: '#8ea0cf', beaconCol: '#ff3b53',
  lampCol: '#ffd24a', puffCol: '#b8d0ff', cometCol: '#e8f2ff', flareCol: '#ff3b53',
},
key: { color: '#b8d0ff', alpha: 0.13, wash: '#13357f', washA: 0.04 },  // hard vacuum-blue
```

- [ ] **Step 2: drawLayered** (novel = rotating gears, sliding pistons, strobes, comet, thrusters):

```js
SCENES.space.drawLayered = (ctx, p, layers) => {
  const { W, floorTop, t, crowd } = p;
  const C = SCENERY.SCENES.space, L = C.L;
  if (layers.far) ctx.drawImage(layers.far, 0, 0);
  for (let i = 0; i < L.twinkN; i++)                     // twinkling stars
    twinkle(ctx, hash(i + 20) * W, hash(i + 30) * floorTop * 0.8, 1, C.star, t * 1.5, i * 1.9);
  // RARE: a comet crosses behind the platform
  const kph = t % L.cometPeriod;
  if (kph < L.cometDur) {
    const kx = W + 10 - (W + 60) * (kph / L.cometDur), ky = 20 + kph * 16;
    for (let s = 0; s < 10; s++) {
      ctx.fillStyle = withA(L.cometCol, 0.7 - s * 0.07);
      ctx.fillRect((kx + s * 3) | 0, (ky - s * 1.2) | 0, 2, 1);
    }
    additiveGlow(ctx, kx, ky, 8, L.cometCol, 0.5);
  }
  if (layers.mid) ctx.drawImage(layers.mid, 0, 0);
  // ROTATING GEARS: code spoke-wheels inside the painted ring housings
  L.gears.forEach(([gx, gy, gr, spd]) => {
    const a = t * spd;
    ctx.strokeStyle = L.gearCol; ctx.lineWidth = 2;
    for (let s = 0; s < 4; s++) {
      const sa = a + s * Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(gx, gy);
      ctx.lineTo(gx + Math.cos(sa) * gr, gy + Math.sin(sa) * gr); ctx.stroke();
    }
    ctx.fillStyle = L.rodCol; ctx.fillRect(gx - 2, gy - 2, 4, 4);   // hub
  });
  // SLIDING PISTONS: rods pumping in the painted slots
  L.pistons.forEach(([px2, top, sh, spd]) => {
    const k = (Math.sin(t * spd) + 1) / 2;
    const ry = top + k * (sh - 8);
    ctx.fillStyle = L.rodCol; ctx.fillRect(px2, ry | 0, 4, 8);
    ctx.fillStyle = '#e8f2ff'; ctx.fillRect(px2, ry | 0, 4, 1);
  });
  // beacons + work lamps; on crowd surges the beacons STROBE red
  const strobe = crowd > 0.3 && Math.floor(t * 6) % 2 === 0;
  L.beacons.forEach(([bx2, by2]) =>
    additiveGlow(ctx, bx2, by2, strobe ? 26 : 12, L.beaconCol, strobe ? 0.6 : 0.22 + 0.08 * Math.sin(t * 2 + bx2)));
  if (strobe) { ctx.fillStyle = 'rgba(255,59,83,0.08)'; ctx.fillRect(0, 0, W, floorTop); }
  L.lamps.forEach((lx2, i) => { if (i === 1 || i === 2 || i === 3) additiveGlow(ctx, lx2, 22, 10, L.lampCol, 0.3); });
  // floating astronauts: thruster puffs + gentle bob is painted-static, puffs sell it
  L.floaters.forEach(([ax2, ay2], i) => {
    const ph = (t * 0.7 + i * 0.5) % 1;
    if (ph < 0.3) additiveGlow(ctx, ax2 - 5, ay2 + 6, 5 + ph * 10, L.puffCol, 0.3 * (1 - ph / 0.3));
  });
  // drifting debris flecks
  for (let i = 0; i < L.debrisN; i++) {
    const dx2 = drift(t, 2 + i, W, 10, i * 100), dy2 = 30 + hash(i + 8) * 80;
    ctx.fillStyle = '#5a6fa0';
    ctx.fillRect(dx2 | 0, (dy2 + Math.sin(t * 0.5 + i) * 3) | 0, 2, 1 + (i % 2));
  }
  if (layers.near) ctx.drawImage(layers.near, 0, 0);
  if (crowd > 0.01) { ctx.fillStyle = mixA(L.flareCol, crowd * 0.08); ctx.fillRect(0, 0, W, floorTop); }
};
```

- [ ] **Step 3:** Master + manifest (`"space": "arenas/space"`) + checks + harness shots (`&crowd=70` for strobes).
- [ ] **Step 4:** Commit: `git add src/config.js src/scenery.js assets/sprites/manifest.json assets/aseprite/arena-space.aseprite && git commit -m "feat(scenery): deep space v2 — rotating gears, pistons, warning strobes, comet"`

---

### Task 7: Batch sweep + docs + checkpoint

- [ ] Suite green; `?bare=1` spot-check one of the three (procedural intact); full-boot console clean (expect ~209 sprites).
- [ ] Gallery: harness shots of all three + send to user.
- [ ] Spec V3 row → batch 2 done; memory update (batch 3 = abyss/chesshall/stadium). Commit → merge main (ff-only) → suite on main → push origin → delete branch.
