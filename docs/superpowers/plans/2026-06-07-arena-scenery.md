# Arena Scenery + Unlockable Backdrops — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each Story fighter a unique, lightly-animated arena behind the boxing ring (with a scene-native moving audience), and let players unlock + select arenas for multiplayer — mirroring the existing chess-set unlock.

**Architecture:** A new `src/scenery.js` holds one pure, stateless `draw(ctx, p)` per arena (a function of time `t` + `crowd`), registered in a `SCENES` map. `gfx.js`'s `ring()` is split so it draws only the physical ring; the backdrop it used to paint becomes the built-in `classic` scene. `boxing.js` draws the chosen scene, then the ring. Unlocks live in `save.unlocks.arenas`; selection in `save.settings.arena`; both are additive (no `SAVE_KEY` bump) and retro-granted on load.

**Tech Stack:** Vanilla ES modules + Canvas 2D. No build step, no deps, no assets (Golden Rules 1 & 5). All tuning in `src/config.js` `SCENERY` (Golden Rule 2); brand colors in `PAL`, arena colors namespaced in `SCENERY.SCENES` (Golden Rule 3).

**Verification note:** This repo has **no automated test suite** (see `CLAUDE.md`); verification is (a) a browser-console **smoke** that dynamically imports the module and calls the draw fn across a time sweep to prove it never throws, and (b) a play-through. Serve with `python -m http.server 5173` from the project root and open `http://localhost:5173`. Watch the console for `[PAWNCH] frame error:`. Use `window.PAWNCH` (live `Game`) per the project's live-test workflow. **Do not verify via screenshots.**

---

## File map

- **Create** `src/scenery.js` — scene registry, `drawScene`, `sceneFor`, `availableArenas`, shared scene helpers, all 11 scenes.
- **Modify** `src/config.js` — add `SCENERY` block (mapping, names, knobs, per-scene palettes).
- **Modify** `src/gfx.js` — `export` color helpers (`mix`, `mixA`, `withA`, `shade`, `lerp`); strip the backdrop out of `ring()`.
- **Modify** `src/states/boxing.js` — draw the scene before the ring.
- **Modify** `src/save.js` — `unlocks.arenas`, `settings.arena`, retro-grant + validation.
- **Modify** `src/states/matchend.js` — unlock the beaten fighter's arena + unlock toast.
- **Modify** `src/states/settings.js` — ARENA row in the DISPLAY tab.
- **Modify** `.gitignore` — ignore `.superpowers/` (brainstorm mockups).

---

## Task 1: SCENERY config block

**Files:**
- Modify: `src/config.js` (append a new export near the other tuning blocks)

- [ ] **Step 1: Add the `SCENERY` export**

Append to `src/config.js` (after the `SAVE_KEY` export is fine, or near `BOX`):

```js
// Arena scenery (boxing-half backdrops). One scene per Story fighter, plus a
// built-in CLASSIC ring. Story forces the opponent's arena; multiplayer uses the
// player's unlocked, selected arena (see save.settings.arena). All scene tuning
// lives here so draw code (src/scenery.js) holds no magic numbers / raw hex.
export const SCENERY = {
  // opponent index (0..9) -> scene id. Index-aligned to the ROSTER in opponents.js.
  OPPONENT_SCENES: ['beach', 'woods', 'cyber', 'dream', 'temple', 'castle', 'space', 'abyss', 'chesshall', 'stadium'],
  // display names (Settings arena picker + unlock toast)
  NAMES: {
    classic: 'CLASSIC RING', beach: 'TROPICAL BEACH', woods: 'SPOOKY WOODS',
    cyber: 'CYBERPUNK STREET', dream: 'DREAM WORLD', temple: 'MOUNTAIN TEMPLE',
    castle: 'SKY CASTLE', space: 'DEEP SPACE', abyss: 'UNDERWATER CAVE',
    chesshall: 'GRAND CHESS HALL', stadium: 'MEGA STADIUM',
  },
  ANIM: 1.0,          // global ambient-motion speed multiplier (turn scenes calmer/busier)
  CROWD_FLARE: 0.45,  // extra audience brightness on big hits (driven by boxing `crowd` 0..1)
  // per-scene palettes + density/speed knobs. Colors are scene-specific (NOT brand
  // palette) so they live here, namespaced, instead of in PAL.
  SCENES: {
    beach:   { sky: ['#7ad0ff', '#bfe9ff', '#ffd9a0', '#f2c27a'], sun: '#fff6cf', sunGlow: '#ffd24a', sea: '#3aa7e0', seaHi: '#7fd0ef', sand: '#e7c486', palm: '#3a2410', leaf: '#2f9b54', crowd: '#3a2a1a', crowdN: 22, palms: 2 },
    woods:   { sky: ['#0d1f15', '#06120c', '#040a06'], trunk: '#0c1c14', trunkN: 5, fireCore: '#fff6c0', fireMid: '#ff9a18', fireGlow: '#ffb24a', candleN: 6, fly: '#bfff7a', flyN: 7, crowd: '#0a140e', crowdN: 14 },
    cyber:   { sky: ['#13062a', '#1a0830', '#070414'], bld: '#0a0618', bldN: 6, neon: ['#ff3bd0', '#22e7ff', '#ffe14a', '#7a5cff'], crowd: '#7a9bff', crowdN: 30, rain: 'rgba(150,200,255,0.10)' },
    dream:   { sky: ['#5a2a8a', '#b85cc0', '#ffb0d6', '#8fd0ff'], cloud: 'rgba(255,255,255,0.6)', shape: 'rgba(255,255,255,0.5)', ghost: 'rgba(255,255,255,0.45)', ghostN: 5, star: '#ffffff', starN: 10 },
    temple:  { sky: ['#caa0ff', '#9a5cff', '#5a3a8a'], peak: '#4a2f7a', peak2: '#3a2566', stone: '#3a2566', stoneHi: '#52397f', roof: '#2a1a4a', flag: ['#ff7a18', '#ffd24a'], cloud: 'rgba(255,255,255,0.5)', monk: '#1e1232', monkN: 16 },
    castle:  { sky: ['#8fd0ff', '#bfe6ff', '#e8f4ff'], cloud: '#ffffff', cloudN: 4, keep: '#9aa6c8', tower: '#8a96b8', roof: '#ff3b53', banner: '#ff7a18', crowd: '#2a2040', crowdN: 18, bird: '#22324f' },
    space:   { core: '#1a1040', edge: '#020108', star: '#ffffff', starN: 22, planet: ['#7a9bff', '#2b4cc0', '#16236a'], ring: 'rgba(111,160,255,0.5)', neb: '#7a5cff', gallery: '#0e1a3a', ast: '#cfe0ff', astN: 6 },
    abyss:   { sky: ['#0a4a52', '#073238', '#04181c'], rock: '#06262b', fireCore: '#fff3c0', fireMid: '#ff8a18', fireGlow: '#ff9a3a', fireN: 3, jelly: ['#ffd0ff', '#c46aff'], jellyN: 5, bub: 'rgba(191,239,255,0.55)', bubN: 8 },
    chesshall: { sky: ['#2a1d3a', '#1a1228', '#0e0a18'], col: '#2e2348', win: '#3a2f6a', chand: '#ffd24a', chandN: 3, table: '#4a3018', tableTop: '#6f4d29', head: '#d8c0a0', headN: 7, piece: '#f0e3c8' },
    stadium: { sky: ['#0a1430', '#13357f', '#1a4a9a'], tiers: ['#ff7a18', '#2b6cff', '#ffd24a', '#39d98a'], tierN: 3, light: '#ffffff', jumbo: '#020610', jumboFrame: '#3a4a78', conf: ['#ff7a18', '#ffd24a', '#2b6cff'], floor: '#2a3566' },
  },
};
```

- [ ] **Step 2: Smoke-verify the export shape**

Serve (`python -m http.server 5173`), open `http://localhost:5173`, and in the console:

```js
const { SCENERY } = await import('/src/config.js');
console.assert(SCENERY.OPPONENT_SCENES.length === 10, 'need 10 opponent scenes');
console.assert(new Set(SCENERY.OPPONENT_SCENES).size === 10, 'scene ids must be unique');
console.assert(SCENERY.OPPONENT_SCENES.every(id => SCENERY.SCENES[id] && SCENERY.NAMES[id]), 'every scene needs a palette + name');
console.log('SCENERY OK');
```

Expected: logs `SCENERY OK`, no assertion warnings.

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "feat(scenery): add SCENERY config (scene map, names, per-scene palettes)"
```

---

## Task 2: Export color helpers + strip backdrop from `ring()`

**Files:**
- Modify: `src/gfx.js` (export helpers; remove backdrop block from `ring()`)

- [ ] **Step 1: Export the private color/lerp helpers**

In `src/gfx.js`, add `export` to these existing functions (do not change their bodies):
- `function shade(hex, amt)` → `export function shade(hex, amt)`
- `function withA(hex, a)` → `export function withA(hex, a)`
- `function mix(a, b, t)` → `export function mix(a, b, t)`
- `function mixA(hex, alpha)` → `export function mixA(hex, alpha)`
- `function lerp(a, b, t)` → `export function lerp(a, b, t)`

- [ ] **Step 2: Remove the backdrop block from `ring()`**

In `src/gfx.js` `ring()`, delete the backdrop section — the arena gradient, overhead spotlights, tiered crowd, and accent wash (everything from the `// arena backdrop (tinted toward the accent)` comment down to and including the `if (crowd > 0.01) { ... }` line). `ring()` must now START at the `// ring apron (front skirt) + canvas floor` block. Keep the rest of `ring()` (apron, floor, emblem, ropes, posts) exactly as-is. The function still accepts `{ floorTop, accent, crowd }` — `crowd` is now unused by `ring()` but kept for signature stability.

After the edit, `ring()`'s first executable line is:

```js
  // ring apron (front skirt) + canvas floor
  ctx.fillStyle = mix(PAL.ringFloor, '#000', 0.35);
```

- [ ] **Step 3: Verify the page still loads (ring will look bare until Task 4 wires the scene)**

Reload `http://localhost:5173`. In console:

```js
const G = await import('/src/gfx.js');
console.assert(['mix','mixA','withA','shade','lerp'].every(k => typeof G[k] === 'function'), 'helpers must be exported');
console.log('gfx exports OK');
```

Expected: logs `gfx exports OK`. (A Story boxing half will render the ring without a backdrop for now — that's fixed in Task 4.)

- [ ] **Step 4: Commit**

```bash
git add src/gfx.js
git commit -m "refactor(gfx): export color helpers; split backdrop out of ring()"
```

---

## Task 3: `scenery.js` skeleton + shared helpers + `classic` scene

**Files:**
- Create: `src/scenery.js`

- [ ] **Step 1: Create `src/scenery.js`**

```js
// Arena scenery: one animated boxing-half backdrop per Story fighter, plus a
// built-in CLASSIC ring (reproduces the old gfx.ring() backdrop exactly). Each
// scene's draw(ctx, p) is a PURE function of time `t` and `crowd` (0..1, flares
// on big hits) — no retained state — so it's cheap and resume-safe. Story forces
// the opponent's arena; multiplayer reads the player's selected, unlocked arena.
//
// All colors/knobs come from SCENERY in config.js (Golden Rules 2 & 3); brand
// colors come from PAL. Zero image assets (Golden Rule 5).

import { SCENERY, PAL } from './config.js';
import { text, mix, mixA, withA, shade, lerp } from './gfx.js';

const TAU = Math.PI * 2;
// deterministic pseudo-random in [0,1) — stable element placement without state
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
// global ambient speed knob
const A = () => SCENERY.ANIM;

// ---- shared scene helpers ---------------------------------------------------
// vertical backdrop gradient across the scene region (y 0..h)
function sky(ctx, W, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const n = stops.length;
  stops.forEach((c, i) => g.addColorStop(n === 1 ? 0 : i / (n - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
}
// a row of chunky crowd "heads"; optional vertical wave + brightness flare
function crowdRow(ctx, W, y, h, count, color, t, opt = {}) {
  const { wave = 0, speed = 0, phase = 0.5, sz = 3, alpha = 0.55, flare = 0 } = opt;
  ctx.globalAlpha = Math.min(1, alpha + flare);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = (i / count) * W + hash(i * 1.7 + phase) * (W / count) * 0.5;
    const dy = wave ? Math.sin(t * speed * A() + i * phase) * wave : 0;
    ctx.fillRect(x | 0, (y + dy) | 0, sz, h);
  }
  ctx.globalAlpha = 1;
}
// twinkling point
function twinkle(ctx, x, y, s, color, t, phase) {
  ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 * A() + phase));
  ctx.fillStyle = color; ctx.fillRect(x | 0, y | 0, s, s); ctx.globalAlpha = 1;
}
// flickering flame with a soft glow (teardrop)
function flame(ctx, x, y, s, t, phase, core, midC, glow) {
  const f = 1 + 0.18 * Math.sin(t * 9 * A() + phase);
  const gr = ctx.createRadialGradient(x, y, 0, x, y, s * 2.6 * f);
  gr.addColorStop(0, withA(glow, 0.5)); gr.addColorStop(1, withA(glow, 0));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, s * 2.6 * f, 0, TAU); ctx.fill();
  ctx.fillStyle = midC; ctx.beginPath(); ctx.ellipse(x, y, s * 0.6, s * f, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = core; ctx.beginPath(); ctx.ellipse(x, y, s * 0.3, s * 0.6 * f, 0, 0, TAU); ctx.fill();
}
// horizontal drift with wrap over [-margin, W+margin]
function drift(t, speed, W, margin, offset) {
  const span = W + margin * 2;
  return (((t * speed * A() + offset) % span) + span) % span - margin;
}
// radial glow blob
function glow(ctx, x, y, r, color, a) {
  if (a <= 0) return;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, withA(color, a)); gr.addColorStop(1, withA(color, 0));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

// ---- scene registry ---------------------------------------------------------
// id -> { draw(ctx, { W, floorTop, t, crowd, accent }) }
export const SCENES = {};

// CLASSIC — verbatim port of the old gfx.ring() backdrop, so nothing regresses.
function classicScene(ctx, p) {
  const { W, floorTop, accent, crowd } = p;
  const g = ctx.createLinearGradient(0, 0, 0, floorTop);
  g.addColorStop(0, mix('#070b1e', accent, 0.16)); g.addColorStop(1, '#10152b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, floorTop);
  for (const [sx, col] of [[W * 0.28, PAL.orange], [W * 0.72, accent]]) {
    const gr = ctx.createLinearGradient(sx, 0, sx, floorTop);
    gr.addColorStop(0, mixA(col, 0.18 + crowd * 0.15)); gr.addColorStop(1, mixA(col, 0));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(sx - 10, 0); ctx.lineTo(sx + 10, 0); ctx.lineTo(sx + 70, floorTop); ctx.lineTo(sx - 70, floorTop); ctx.closePath(); ctx.fill();
  }
  for (let band = 0; band < 3; band++) {
    const by = 12 + band * 26, bh = 22, sz = 2 + band;
    ctx.fillStyle = `rgba(${200 + band * 18},${205},${230},${0.10 + band * 0.05 + crowd * 0.45})`;
    for (let i = 0; i < 26; i++) { const cx2 = ((i * 41 + band * 13) % W); ctx.fillRect(cx2, by + ((i * 7) % bh), sz, sz); }
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(accent, crowd * 0.22); ctx.fillRect(0, 0, W, floorTop); }
}
SCENES.classic = { draw: classicScene };

// ---- public API -------------------------------------------------------------
// draw a scene by id; unknown / not-yet-implemented ids fall back to CLASSIC
export function drawScene(ctx, id, p) { (SCENES[id] || SCENES.classic).draw(ctx, p); }

// which arena to render for a match. Story = opponent's arena (forced);
// multiplayer (local + online) = the player's selected, unlocked arena.
export function sceneFor(match, save) {
  if (match?.mode === 'story' && match.opponent) {
    return SCENERY.OPPONENT_SCENES[match.opponent.index] || 'classic';
  }
  const a = save?.settings?.arena || 'classic';
  if (a === 'classic') return 'classic';
  return save?.unlocks?.arenas?.[a] ? a : 'classic';
}

// arena ids the player can pick in Settings: CLASSIC (always) + unlocked, roster order
export function availableArenas(save) {
  const unlocked = save?.unlocks?.arenas || {};
  return ['classic', ...SCENERY.OPPONENT_SCENES.filter((id) => unlocked[id])];
}

// expose helpers to scene modules below (same file)
export { SCENERY, PAL, TAU, hash, sky, crowdRow, twinkle, flame, drift, glow, A, text, mix, mixA, withA, shade, lerp };
```

> Note: the trailing `export { ... }` re-export is only so later scene tasks can be appended in the same file referencing these names; the names are already in module scope, so scenes added below just call them directly. (If your linter objects to re-exporting imports, drop that line — it is not required for the scenes to work.)

- [ ] **Step 2: Smoke-verify `classic` + the API**

Reload, then in console:

```js
const S = await import('/src/scenery.js');
const ctx = document.createElement('canvas').getContext('2d');
for (let t = 0; t < 3; t += 0.3) S.drawScene(ctx, 'classic', { W: 512, floorTop: 170, t, crowd: 0.6, accent: '#ff7a18' });
S.drawScene(ctx, 'doesnotexist', { W: 512, floorTop: 170, t: 1, crowd: 0, accent: '#2b6cff' }); // must fall back, not throw
console.assert(S.sceneFor({ mode: 'story', opponent: { index: 0 } }) === 'beach', 'story forces opponent arena');
console.assert(S.sceneFor({ mode: 'pvp' }, { settings: { arena: 'beach' }, unlocks: { arenas: {} } }) === 'classic', 'locked arena -> classic');
console.log('scenery API OK');
```

Expected: logs `scenery API OK`, no throws.

- [ ] **Step 3: Commit**

```bash
git add src/scenery.js
git commit -m "feat(scenery): scene registry, helpers, classic scene, sceneFor/availableArenas"
```

---

## Task 4: Wire the scene into the boxing half

**Files:**
- Modify: `src/states/boxing.js` (import + draw call + cache scene id)

- [ ] **Step 1: Import the scenery API**

In `src/states/boxing.js`, change the gfx import line and add a scenery import:

```js
import { text, textWidth, panel, ring, boxer, barH } from '../gfx.js';
import { drawScene, sceneFor } from '../scenery.js';
```

- [ ] **Step 2: Resolve the scene once on enter**

In `BoxingState.enter(game)`, after `this.accent = this.oppHue.body;`, add:

```js
    this.sceneId = sceneFor(m, game.save);   // story: opponent arena; pvp: player's pick
```

- [ ] **Step 3: Draw the scene before the ring**

In `BoxingState.draw(game, ctx)`, replace the single `ring(...)` line:

```js
    ring(ctx, W, H, { floorTop: 170, accent: this.accent, crowd: this.crowd });
```

with:

```js
    drawScene(ctx, this.sceneId, { W, floorTop: 170, t: this.t, crowd: this.crowd, accent: this.accent });
    ring(ctx, W, H, { floorTop: 170, accent: this.accent, crowd: this.crowd });
```

- [ ] **Step 4: Verify the classic backdrop is back and identical**

Reload, start a Story fight (any), reach the boxing half. Expected: the arena backdrop looks exactly like `main` (gradient + spotlights + tiered crowd), the ring is fully drawn over it, and the console shows no `[PAWNCH] frame error:`. Optionally A/B against `git stash`/`main`.

- [ ] **Step 5: Commit**

```bash
git add src/states/boxing.js
git commit -m "feat(scenery): render the arena scene behind the ring in the boxing half"
```

---

## Task 5: Save schema — arena unlocks + selection + retro-grant

**Files:**
- Modify: `src/save.js`

- [ ] **Step 1: Import SCENERY**

In `src/save.js`, extend the config import:

```js
import { SAVE_KEY, SCENERY } from './config.js';
```

- [ ] **Step 2: Add the new fields to `DEFAULT`**

In `DEFAULT.unlocks`, add `arenas`:

```js
  unlocks: {
    arcanePieces: false,       // the ARCANE chess set — earned by beating THE PAWNCHION
    arenas: {},                // { [sceneId]: true } — arenas unlocked for multiplayer
  },
```

In `DEFAULT.settings`, add `arena` (place it next to `pieceSet`):

```js
    pieceSet: 'celestial',     // active chess set: 'celestial' (default) | 'arcane' (unlock)
    arena: 'classic',          // selected multiplayer arena id (Settings -> DISPLAY)
```

- [ ] **Step 3: Retro-grant + validate on load**

In `load()`, immediately after the existing arcane retro-grant line
(`if (state.storyProgress >= OPPONENTS.length) state.unlocks.arcanePieces = true;`), add:

```js
    // Retro-grant arenas for every already-beaten fighter (mirrors the arcane set):
    // beating fighter i unlocks arena OPPONENT_SCENES[i].
    const beaten = Math.min(state.storyProgress, SCENERY.OPPONENT_SCENES.length);
    for (let i = 0; i < beaten; i++) state.unlocks.arenas[SCENERY.OPPONENT_SCENES[i]] = true;
    // Can't have a locked arena selected (hand-edited/cross-device save) — fall back.
    if (state.settings.arena !== 'classic' && !state.unlocks.arenas[state.settings.arena]) state.settings.arena = 'classic';
```

- [ ] **Step 4: Verify retro-grant + validation**

Reload, then in console:

```js
localStorage.setItem('pawnch.save.v1', JSON.stringify({ storyProgress: 3, settings: { arena: 'space' } }));
const { load } = await import('/src/save.js?bust=' + Date.now());
const s = load();
console.assert(s.unlocks.arenas.beach && s.unlocks.arenas.woods && s.unlocks.arenas.cyber, 'first 3 arenas retro-granted');
console.assert(!s.unlocks.arenas.dream, 'unbeaten arena stays locked');
console.assert(s.settings.arena === 'classic', 'locked selected arena fell back to classic');
console.log('save retro-grant OK');
localStorage.removeItem('pawnch.save.v1');
```

Expected: logs `save retro-grant OK`. (Reload the page afterward so the live game reloads a clean save.)

- [ ] **Step 5: Commit**

```bash
git add src/save.js
git commit -m "feat(scenery): persist arena unlocks + selection with retro-grant"
```

---

## Task 6: Unlock the beaten fighter's arena on a Story win

**Files:**
- Modify: `src/states/matchend.js`

- [ ] **Step 1: Import SCENERY**

In `src/states/matchend.js`, extend the config import:

```js
import { PAL, SCENERY } from '../config.js';
```

- [ ] **Step 2: Grant the arena unlock in `enter()`**

Inside the `if (this.story && this.win) { ... }` block, after the arcane block
(`if (this.unlockedArcane) game.save.unlocks.arcanePieces = true;`) and before
`game.persist();`, add:

```js
      // Beating a fighter unlocks THEIR arena for multiplayer (idempotent on replays).
      const scene = SCENERY.OPPONENT_SCENES[this.m.opponent.index];
      this.unlockedArena = null;
      if (scene && !game.save.unlocks.arenas[scene]) {
        game.save.unlocks.arenas[scene] = true;
        this.unlockedArena = SCENERY.NAMES[scene];
      }
```

- [ ] **Step 3: Show the unlock toast in `draw()`**

In `draw()`, replace this block:

```js
      if (this.story && this.win && !this.lastOpponent)
        text(ctx, this.advanced ? 'READY FOR THE NEXT OPPONENT?' : 'BACK TO THE FIGHT SELECT', W / 2, 318, { scale: 1, color: PAL.orangeLite, align: 'center' });
      if (this.unlockedArcane)
        text(ctx, 'ARCANE CHESS SET UNLOCKED!', W / 2, 318, { scale: 1, color: PAL.gold, align: 'center' });
```

with (split the lines so an arena unlock and the next-opponent/arcane line don't overlap):

```js
      if (this.story && this.win && !this.lastOpponent)
        text(ctx, this.advanced ? 'READY FOR THE NEXT OPPONENT?' : 'BACK TO THE FIGHT SELECT', W / 2, 312, { scale: 1, color: PAL.orangeLite, align: 'center' });
      if (this.unlockedArcane)
        text(ctx, 'ARCANE CHESS SET UNLOCKED!', W / 2, 312, { scale: 1, color: PAL.gold, align: 'center' });
      if (this.unlockedArena)
        text(ctx, this.unlockedArena + ' ARENA UNLOCKED!', W / 2, 326, { scale: 1, color: PAL.green, align: 'center' });
```

- [ ] **Step 4: Verify (play-through + console)**

Console smoke (no full match needed): confirm the field plumbs through a simulated win:

```js
const G = window.PAWNCH;                         // live Game
G.save.unlocks.arenas = {};                      // reset
G.match = { mode: 'story', winner: 'player', reason: 'ko', opponent: { index: 0, name: 'PATTY PUSHWOOD', elo: 400 }, pgnMoves: [] };
const { MatchEndState } = await import('/src/states/matchend.js?bust=' + Date.now());
const st = new MatchEndState(); st.enter(G);
console.assert(G.save.unlocks.arenas.beach === true, 'beach unlocked on win vs fighter 0');
console.assert(st.unlockedArena === 'TROPICAL BEACH', 'unlock toast name set');
console.log('arena unlock OK');
```

Expected: logs `arena unlock OK`. Then play Story fight 1 to a win and confirm the green `TROPICAL BEACH ARENA UNLOCKED!` line shows. Reload afterward.

- [ ] **Step 5: Commit**

```bash
git add src/states/matchend.js
git commit -m "feat(scenery): unlock the beaten fighter's arena + show unlock toast"
```

---

## Task 7: Settings — ARENA picker in the DISPLAY tab

**Files:**
- Modify: `src/states/settings.js`

- [ ] **Step 1: Imports**

In `src/states/settings.js`, extend imports:

```js
import { PAL, SCENERY } from '../config.js';
import { text, panel, barH, setPieceSet } from '../gfx.js';
import { availableArenas } from '../scenery.js';
```

- [ ] **Step 2: Add ARENA to the DISPLAY rows**

In `_rows(game)`, change the display-tab return:

```js
    return ['SCANLINES', 'SCALE', 'PIECES', 'ARENA', 'BACK'];
```

- [ ] **Step 3: Handle ARENA in `update()` confirm**

In `update()`, in the `if (i.pressed('confirm'))` block, after the `PIECES` branch, add an `ARENA` branch:

```js
      else if (row === 'PIECES') { this._cyclePieceSet(game); }
      else if (row === 'ARENA') { this._cycleArena(game); }
```

- [ ] **Step 4: Handle ARENA in `_adjust()` (left/right on the DISPLAY tab)**

In `_adjust()`, inside the `else if (this.tab === 2)` block, after the `PIECES` line, add:

```js
      if (row === 'ARENA') this._cycleArena(game);
```

- [ ] **Step 5: Add `_cycleArena`**

After `_cyclePieceSet(game)`, add:

```js
  // Switch the active multiplayer arena. CLASSIC is always available; the rest
  // unlock by beating that fighter in Story. Inert (soft blip) if nothing's unlocked.
  _cycleArena(game) {
    const list = availableArenas(game.save);
    if (list.length <= 1) { audio.sfx.select(); return; }   // only CLASSIC -> nothing to cycle
    const cur = list.indexOf(game.save.settings.arena);
    const next = list[(cur + 1 + list.length) % list.length] || 'classic';
    game.save.settings.arena = next;
    game.persist();
    audio.sfx.confirm();
  }
```

- [ ] **Step 6: Render the ARENA row in `_display()`**

Replace the body of `_display(game, ctx)` with (adds the ARENA row + moves BACK to index 4):

```js
  _display(game, ctx) {
    const W = game.W;
    const s = game.save.settings;
    const unlocked = !!game.save.unlocks.arcanePieces;
    const setLabel = s.pieceSet === 'arcane' ? 'ARCANE' : 'CELESTIAL';
    const arenaCount = availableArenas(game.save).length;          // incl. CLASSIC
    const arenaName = SCENERY.NAMES[s.arena] || 'CLASSIC RING';
    const rows = [
      ['SCANLINES', s.scanlines ? 'ON' : 'OFF', true],
      ['SCALE', s.scale === 'fit' ? 'FIT SCREEN' : 'INTEGER', true],
      ['PIECES', unlocked ? setLabel : 'LOCKED', unlocked],
      ['ARENA', arenaName, true],
    ];
    rows.forEach(([label, val, enabled], i) => {
      const y = 138 + i * 32;
      const on = this.sel === i;
      text(ctx, label, 100, y, { scale: 2, color: on ? PAL.white : PAL.textDim });
      text(ctx, val, 300, y, { scale: 2, color: enabled ? PAL.orange : PAL.line });
    });
    // hint line under the rows: arena unlock progress (or the pieces hint)
    const hint = arenaCount > 1
      ? 'ARENAS UNLOCKED: ' + arenaCount + '/' + (SCENERY.OPPONENT_SCENES.length + 1) + '   WIN FIGHTS TO UNLOCK MORE'
      : 'WIN A STORY FIGHT TO UNLOCK ITS ARENA';
    text(ctx, hint, W / 2, 138 + 4 * 32 + 2, { scale: 1, color: PAL.orangeLite, align: 'center' });
    const by = 138 + 4 * 32 + 18;
    text(ctx, 'BACK', 100, by, { scale: 2, color: this.sel === 4 ? PAL.white : PAL.textDim });
    text(ctx, 'ARROWS L/R OR ENTER TO CHANGE', 100, by + 26, { scale: 1, color: PAL.textDim });
  }
```

- [ ] **Step 7: Verify the picker**

Reload. Unlock a couple of arenas via console then open Settings → DISPLAY:

```js
const G = window.PAWNCH;
G.save.unlocks.arenas = { beach: true, woods: true };
G.save.settings.arena = 'classic';
```

Navigate Title → Settings → press `E` to reach DISPLAY. Expected: an `ARENA` row shows `CLASSIC RING`; selecting it and pressing →/Enter cycles `CLASSIC RING → TROPICAL BEACH → SPOOKY WOODS → …`; the hint shows `ARENAS UNLOCKED: 3/11`; `BACK` still works and persists (`PAWNCH.save.settings.arena` updates). No `[PAWNCH] frame error:`.

- [ ] **Step 8: Commit**

```bash
git add src/states/settings.js
git commit -m "feat(scenery): add ARENA picker to Settings DISPLAY tab"
```

---

## Tasks 8–17: Implement the ten arenas

Each task: append one scene function + its `SCENES.<id>` registration to `src/scenery.js`,
smoke-verify it never throws across a time sweep, then commit. Scenes draw only the
backdrop region (`y` roughly `0..floorTop`); the ring is drawn over the lower band by
`ring()`. After implementing a scene, you can view it live by playing that Story fight,
or by `PAWNCH.save.unlocks.arenas.<id>=true; PAWNCH.save.settings.arena='<id>'` then a
LOCAL HOTSEAT match.

**Shared smoke (substitute the id):**

```js
const S = await import('/src/scenery.js?bust=' + Date.now());
const ctx = document.createElement('canvas').getContext('2d');
for (let t = 0; t < 4; t += 0.25) S.drawScene(ctx, '<ID>', { W: 512, floorTop: 170, t, crowd: 0.7, accent: '#ffd24a' });
console.log('<ID> OK');
```

### Task 8: `beach` (Patty)

- [ ] **Step 1: Append to `src/scenery.js`**

```js
// TROPICAL BEACH — gentle sun, rolling surf, swaying palms, sand-level crowd.
function beachScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.beach;
  sky(ctx, W, floorTop, C.sky);
  const horizon = floorTop * 0.5;
  // sun + shimmer
  const sx = W * 0.22, sy = horizon * 0.5;
  glow(ctx, sx, sy, 40, C.sunGlow, 0.5 + 0.1 * Math.sin(t * 1.5));
  ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, TAU); ctx.fill();
  // sea band with a moving highlight line
  ctx.fillStyle = C.sea; ctx.fillRect(0, horizon, W, floorTop * 0.18);
  ctx.fillStyle = C.seaHi;
  for (let x = 0; x < W; x += 8) ctx.fillRect(x, horizon + 4 + Math.sin(t * 2 + x * 0.05) * 2, 5, 1);
  // sand
  ctx.fillStyle = C.sand; ctx.fillRect(0, horizon + floorTop * 0.18, W, floorTop);
  // crowd on the sand
  crowdRow(ctx, W, floorTop - 14, 8, C.crowdN, C.crowd, t, { wave: 1.5, speed: 2, alpha: 0.5, flare: crowd * SCENERY.CROWD_FLARE });
  // swaying palms
  for (let i = 0; i < C.palms; i++) {
    const px = W * (0.18 + i * 0.62), base = floorTop - 10;
    const sway = Math.sin(t * 1.2 * A() + i) * 5;
    ctx.strokeStyle = C.palm; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(px, base); ctx.quadraticCurveTo(px + sway * 0.5, base - 22, px + sway, base - 40); ctx.stroke();
    ctx.fillStyle = C.leaf;
    for (let a = -2; a <= 2; a++) {
      ctx.beginPath(); ctx.ellipse(px + sway, base - 42, 16, 4, a * 0.5 + Math.sin(t + a) * 0.05, 0, TAU); ctx.fill();
    }
  }
}
SCENES.beach = { draw: beachScene };
```

- [ ] **Step 2:** Run the shared smoke with `<ID>=beach`. Expected: `beach OK`, no throw.
- [ ] **Step 3:** Commit: `git add src/scenery.js && git commit -m "feat(scenery): tropical beach arena (Patty)"`

### Task 9: `woods` (Gus Gambit)

- [ ] **Step 1: Append to `src/scenery.js`**

```js
// SPOOKY WOODS — dark trunks, bobbing floating candles, fireflies, hooded crowd.
function woodsScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.woods;
  sky(ctx, W, floorTop, C.sky);
  // tree trunks
  ctx.fillStyle = C.trunk;
  for (let i = 0; i < C.trunkN; i++) {
    const x = (i + 0.5) / C.trunkN * W + (hash(i) - 0.5) * 30;
    const w = 10 + hash(i + 3) * 14;
    ctx.fillRect(x - w / 2, floorTop * (0.1 + hash(i + 1) * 0.1), w, floorTop);
  }
  // hooded onlookers (low silhouettes)
  crowdRow(ctx, W, floorTop - 16, 16, C.crowdN, C.crowd, t, { wave: 1, speed: 1.4, sz: 5, alpha: 0.85, flare: crowd * 0.2 });
  // floating candles
  for (let i = 0; i < C.candleN; i++) {
    const cx = (i + 0.5) / C.candleN * W + Math.sin(t * 0.6 + i) * 10;
    const cy = floorTop * (0.25 + 0.45 * hash(i + 7)) + Math.sin(t * 1.6 * A() + i * 1.3) * 6;
    flame(ctx, cx, cy, 5, t, i * 1.7, C.fireCore, C.fireMid, C.fireGlow);
  }
  // fireflies
  for (let i = 0; i < C.flyN; i++) {
    const fx = drift(t, 6 + i, W, 10, i * 70), fy = floorTop * (0.3 + 0.5 * hash(i + 2)) + Math.sin(t * 2 + i) * 8;
    twinkle(ctx, fx, fy, 2, C.fly, t, i * 2.1);
  }
}
SCENES.woods = { draw: woodsScene };
```

- [ ] **Step 2:** Run the shared smoke with `<ID>=woods`. Expected: `woods OK`.
- [ ] **Step 3:** Commit: `git add src/scenery.js && git commit -m "feat(scenery): spooky woods arena (Gus Gambit)"`

### Task 10: `cyber` (Rosa Rookrush)

- [ ] **Step 1: Append to `src/scenery.js`**

```js
// CYBERPUNK STREET — building silhouettes, flickering neon billboards, rain, crowd.
function cyberScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.cyber;
  sky(ctx, W, floorTop, C.sky);
  // buildings
  ctx.fillStyle = C.bld;
  for (let i = 0; i < C.bldN; i++) {
    const w = W / C.bldN, x = i * w, h = floorTop * (0.5 + 0.45 * hash(i + 1));
    ctx.fillRect(x + 2, floorTop - h, w - 4, h);
  }
  // neon billboards (flicker)
  for (let i = 0; i < 6; i++) {
    const col = C.neon[i % C.neon.length];
    const bx = (i * 97 % (W - 50)) + 6, by = 12 + (i * 37 % 70);
    const on = (Math.sin(t * 7 * A() + i * 2) > -0.4) ? 1 : 0.35;
    glow(ctx, bx + 22, by + 12, 30, col, 0.4 * on);
    ctx.globalAlpha = on; ctx.fillStyle = col; ctx.fillRect(bx, by, 44, 24); ctx.globalAlpha = 1;
  }
  // rain
  ctx.strokeStyle = C.rain; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const rx = (i * 53 + (t * 200 * A()) % W) % W, ry = (i * 41 + (t * 300 * A())) % floorTop;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 9);
  }
  ctx.stroke();
  // sidewalk crowd
  crowdRow(ctx, W, floorTop - 12, 10, C.crowdN, C.crowd, t, { wave: 1.5, speed: 2.5, alpha: 0.55, flare: crowd * SCENERY.CROWD_FLARE });
}
SCENES.cyber = { draw: cyberScene };
```

- [ ] **Step 2:** Run the shared smoke with `<ID>=cyber`. Expected: `cyber OK`.
- [ ] **Step 3:** Commit: `git add src/scenery.js && git commit -m "feat(scenery): cyberpunk street arena (Rosa Rookrush)"`

### Task 11: `dream` (Kid Knightmare)

- [ ] **Step 1: Append to `src/scenery.js`**

```js
// DREAM WORLD — slow hue-shifting pastel sky, floating shapes, drifting spectres.
function dreamScene(ctx, p) {
  const { W, floorTop, t } = p; const C = SCENERY.SCENES.dream;
  // hue-shifting gradient (cycle the stop order slowly)
  const k = (Math.sin(t * 0.2) + 1) / 2;
  sky(ctx, W, floorTop, [mix(C.sky[0], C.sky[3], k), C.sky[1], mix(C.sky[2], C.sky[0], k)]);
  // soft clouds
  for (let i = 0; i < 3; i++) {
    const cx = drift(t, 4 + i * 2, W, 40, i * 160), cy = floorTop * (0.2 + 0.2 * i);
    glow(ctx, cx, cy, 36 - i * 6, C.cloud.replace('rgba', 'rgb').replace(/,[^,]+\)/, ')'), 0.0); // (no-op safety)
    ctx.fillStyle = C.cloud; ctx.beginPath(); ctx.ellipse(cx, cy, 40, 12, 0, 0, TAU); ctx.fill();
  }
  // floating rotating shapes
  for (let i = 0; i < 4; i++) {
    const x = (i + 0.5) / 4 * W + Math.sin(t * 0.5 + i) * 12, y = floorTop * (0.3 + 0.3 * hash(i + 5)) + Math.sin(t * 1.2 + i) * 8;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.6 + i); ctx.fillStyle = C.shape;
    if (i % 2) { ctx.fillRect(-7, -7, 14, 14); } else { ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, 7); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  // stars
  for (let i = 0; i < C.starN; i++) twinkle(ctx, hash(i) * W, hash(i + 1) * floorTop * 0.7, 2, C.star, t, i * 1.3);
  // drifting dream spectres along the floor
  for (let i = 0; i < C.ghostN; i++) {
    const gx = drift(t, 8 + i * 2, W, 16, i * 90), gy = floorTop - 14 + Math.sin(t * 1.5 + i) * 4;
    ctx.fillStyle = C.ghost; ctx.beginPath();
    ctx.moveTo(gx - 6, gy + 10); ctx.lineTo(gx - 6, gy - 6); ctx.arc(gx, gy - 6, 6, Math.PI, 0); ctx.lineTo(gx + 6, gy + 10); ctx.closePath(); ctx.fill();
  }
}
SCENES.dream = { draw: dreamScene };
```

> The `glow(...)` line above is a deliberate no-op kept out to avoid an extra blob; if you prefer, delete that single line — the clouds render from the `ellipse` below it.

- [ ] **Step 2:** Run the shared smoke with `<ID>=dream`. Expected: `dream OK`.
- [ ] **Step 3:** Commit: `git add src/scenery.js && git commit -m "feat(scenery): dream world arena (Kid Knightmare)"`

### Task 12: `temple` (Bishop Bruiser)

- [ ] **Step 1: Append to `src/scenery.js`**

```js
// MOUNTAIN TEMPLE — twilight peaks, a pillared shrine, seated monks, prayer flags.
function templeScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.temple;
  sky(ctx, W, floorTop, C.sky);
  // distant drifting clouds
  for (let i = 0; i < 2; i++) { const cx = drift(t, 5 + i * 3, W, 50, i * 200); ctx.fillStyle = C.cloud; ctx.beginPath(); ctx.ellipse(cx, floorTop * (0.2 + i * 0.2), 46, 8, 0, 0, TAU); ctx.fill(); }
  // peaks
  const peak = (x, w, h, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, floorTop); ctx.lineTo(x + w / 2, floorTop - h); ctx.lineTo(x + w, floorTop); ctx.closePath(); ctx.fill(); };
  peak(-20, 160, floorTop * 0.7, C.peak2); peak(W - 140, 170, floorTop * 0.8, C.peak2);
  // shrine: base + roof + columns
  const bx = W / 2 - 70, bw = 140, baseY = floorTop - 40;
  ctx.fillStyle = C.stone; ctx.fillRect(bx, baseY, bw, 40);
  ctx.fillStyle = C.stoneHi; for (let i = 0; i < 4; i++) ctx.fillRect(bx + 12 + i * 36, baseY, 8, 40);
  ctx.fillStyle = C.roof; ctx.beginPath(); ctx.moveTo(bx - 14, baseY); ctx.lineTo(W / 2, baseY - 30); ctx.lineTo(bx + bw + 14, baseY); ctx.closePath(); ctx.fill();
  // seated monks (crowd) along the base
  crowdRow(ctx, W, floorTop - 12, 8, C.monkN, C.monk, t, { wave: 0.8, speed: 1, sz: 5, alpha: 0.8, flare: crowd * 0.2 });
  // prayer flags fluttering between two poles
  for (let i = 0; i < 8; i++) {
    const fx = W * 0.2 + i * (W * 0.6 / 8), fy = 24 + Math.sin(i) * 4;
    const flutter = 0.6 + 0.4 * Math.sin(t * 4 * A() + i);
    ctx.fillStyle = C.flag[i % C.flag.length]; ctx.fillRect(fx, fy, 12 * flutter, 8);
  }
}
SCENES.temple = { draw: templeScene };
```

- [ ] **Step 2:** Run the shared smoke with `<ID>=temple`. Expected: `temple OK`.
- [ ] **Step 3:** Commit: `git add src/scenery.js && git commit -m "feat(scenery): mountain temple arena (Bishop Bruiser)"`

### Task 13: `castle` (Queen Quake)

- [ ] **Step 1: Append to `src/scenery.js`**

```js
// SKY CASTLE — bright sky, parallax clouds, a floating keep + towers, banners, birds.
function castleScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.castle;
  sky(ctx, W, floorTop, C.sky);
  // parallax clouds
  for (let i = 0; i < C.cloudN; i++) {
    const cx = drift(t, 3 + i * 2, W, 60, i * 130), cy = floorTop * (0.12 + 0.22 * hash(i + 1));
    ctx.fillStyle = C.cloud; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(cx, cy, 50, 14, 0, 0, TAU); ctx.ellipse(cx + 26, cy + 4, 30, 10, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  const bob = Math.sin(t * 0.8 * A()) * 4, midY = floorTop * 0.5 + bob;
  // towers
  for (const tx of [W / 2 - 64, W / 2 + 40]) {
    ctx.fillStyle = C.tower; ctx.fillRect(tx, midY - 30, 24, 70);
    ctx.fillStyle = C.roof; ctx.beginPath(); ctx.moveTo(tx - 4, midY - 30); ctx.lineTo(tx + 12, midY - 50); ctx.lineTo(tx + 28, midY - 30); ctx.closePath(); ctx.fill();
    const fl = 0.6 + 0.4 * Math.sin(t * 4 + tx); ctx.fillStyle = C.banner; ctx.fillRect(tx + 12, midY - 50, 8 * fl, 12);
  }
  // central keep
  ctx.fillStyle = C.keep; ctx.fillRect(W / 2 - 34, midY - 10, 68, 50);
  ctx.fillStyle = shade(C.keep, -30); ctx.fillRect(W / 2 - 8, midY + 14, 16, 26); // gate
  // balcony courtiers
  crowdRow(ctx, W, midY + 42, 6, C.crowdN, C.crowd, t, { wave: 1, speed: 2, sz: 3, alpha: 0.6, flare: crowd * SCENERY.CROWD_FLARE });
  // circling birds
  for (let i = 0; i < 3; i++) {
    const bx = W / 2 + Math.cos(t * 0.8 + i * 2) * 90, by = floorTop * 0.3 + Math.sin(t * 0.8 + i * 2) * 20;
    ctx.strokeStyle = C.bird; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(bx - 4, by); ctx.lineTo(bx, by - 2 - Math.sin(t * 8 + i)); ctx.lineTo(bx + 4, by); ctx.stroke();
  }
}
SCENES.castle = { draw: castleScene };
```

- [ ] **Step 2:** Run the shared smoke with `<ID>=castle`. Expected: `castle OK`.
- [ ] **Step 3:** Commit: `git add src/scenery.js && git commit -m "feat(scenery): sky castle arena (Queen Quake)"`

### Task 14: `space` (Iron Endgame)

- [ ] **Step 1: Append to `src/scenery.js`**

```js
// DEEP SPACE — starfield, a ringed planet, drifting nebula, astronaut gallery.
function spaceScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.space;
  const g = ctx.createRadialGradient(W * 0.7, floorTop * 0.3, 4, W * 0.5, floorTop * 0.5, W * 0.8);
  g.addColorStop(0, C.core); g.addColorStop(1, C.edge); ctx.fillStyle = g; ctx.fillRect(0, 0, W, floorTop);
  // stars
  for (let i = 0; i < C.starN; i++) twinkle(ctx, hash(i) * W, hash(i + 9) * floorTop * 0.85, 1 + (hash(i + 3) > 0.8 ? 1 : 0), C.star, t, i);
  // drifting nebula
  glow(ctx, drift(t, 3, W, 60, 0), floorTop * 0.55, 70, C.neb, 0.22 + 0.06 * Math.sin(t));
  // ringed planet
  const px = W * 0.74, py = floorTop * 0.32;
  const pg = ctx.createRadialGradient(px - 6, py - 6, 2, px, py, 26);
  pg.addColorStop(0, C.planet[0]); pg.addColorStop(0.6, C.planet[1]); pg.addColorStop(1, C.planet[2]);
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 24, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.ring; ctx.lineWidth = 3; ctx.save(); ctx.translate(px, py); ctx.rotate(-0.3); ctx.scale(1, 0.32); ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.stroke(); ctx.restore();
  // viewing gallery + floating astronauts (the crowd)
  ctx.fillStyle = C.gallery; ctx.fillRect(0, floorTop - 24, W, 24);
  for (let i = 0; i < C.astN; i++) {
    const ax = (i + 0.5) / C.astN * W, ay = floorTop - 14 + Math.sin(t * 1.5 * A() + i * 1.7) * 4;
    glow(ctx, ax, ay, 7, C.ast, 0.4 + crowd * 0.4);
    ctx.fillStyle = C.ast; ctx.fillRect(ax - 4, ay - 6, 8, 12); ctx.fillStyle = C.planet[1]; ctx.fillRect(ax - 2, ay - 4, 4, 3);
  }
}
SCENES.space = { draw: spaceScene };
```

- [ ] **Step 2:** Run the shared smoke with `<ID>=space`. Expected: `space OK`.
- [ ] **Step 3:** Commit: `git add src/scenery.js && git commit -m "feat(scenery): deep space arena (Iron Endgame)"`

### Task 15: `abyss` (Tal Tempest)

- [ ] **Step 1: Append to `src/scenery.js`**

```js
// UNDERWATER CAVE — teal depths, rock walls, little fires, rising jellyfish, bubbles.
function abyssScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.abyss;
  sky(ctx, W, floorTop, C.sky);
  // caustic shimmer near the top
  ctx.globalAlpha = 0.12; ctx.fillStyle = C.jelly[1];
  for (let x = 0; x < W; x += 16) ctx.fillRect(x, 6 + Math.sin(t * 2 + x * 0.04) * 4, 8, 2);
  ctx.globalAlpha = 1;
  // rock walls
  ctx.fillStyle = C.rock;
  ctx.beginPath(); ctx.moveTo(0, floorTop); ctx.lineTo(0, floorTop * 0.5); ctx.lineTo(70, floorTop); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W, floorTop); ctx.lineTo(W, floorTop * 0.4); ctx.lineTo(W - 84, floorTop); ctx.closePath(); ctx.fill();
  // little fires on the rocks
  for (let i = 0; i < C.fireN; i++) flame(ctx, 24 + i * 18, floorTop - 18 - i * 4, 5, t, i * 2, C.fireCore, C.fireMid, C.fireGlow);
  // rising jellyfish (the crowd)
  for (let i = 0; i < C.jellyN; i++) {
    const jx = (i + 0.5) / C.jellyN * W + Math.sin(t + i) * 14;
    const jy = floorTop - ((t * 18 * A() + i * 40) % (floorTop + 20));
    const col = C.jelly[i % C.jelly.length];
    glow(ctx, jx, jy, 16, col, 0.5 + crowd * 0.3);
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(jx, jy, 9, 7, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
    for (let k = -2; k <= 2; k++) { ctx.moveTo(jx + k * 3, jy); ctx.lineTo(jx + k * 3 + Math.sin(t * 3 + k) * 2, jy + 10); }
    ctx.stroke();
  }
  // bubbles
  for (let i = 0; i < C.bubN; i++) {
    const bx = hash(i) * W, by = floorTop - ((t * 30 * A() + i * 25) % (floorTop + 10));
    ctx.fillStyle = C.bub; ctx.beginPath(); ctx.arc(bx, by, 1.5 + hash(i + 1) * 1.5, 0, TAU); ctx.fill();
  }
}
SCENES.abyss = { draw: abyssScene };
```

- [ ] **Step 2:** Run the shared smoke with `<ID>=abyss`. Expected: `abyss OK`.
- [ ] **Step 3:** Commit: `git add src/scenery.js && git commit -m "feat(scenery): underwater cave arena (Tal Tempest)"`

### Task 16: `chesshall` (Magnus)

- [ ] **Step 1: Append to `src/scenery.js`**

```js
// GRAND CHESS HALL — tall windows, columns, swaying chandeliers, rows of boards.
function chesshallScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.chesshall;
  sky(ctx, W, floorTop, C.sky);
  // tall windows
  ctx.fillStyle = C.win;
  for (let i = 0; i < 4; i++) { const x = 24 + i * (W - 48) / 4; ctx.fillRect(x, 8, 26, 70); }
  // columns
  ctx.fillStyle = C.col;
  for (const x of [70, W / 2 - 7, W - 84]) ctx.fillRect(x, 0, 14, floorTop);
  // chandeliers (sway)
  for (let i = 0; i < C.chandN; i++) {
    const cx = (i + 0.5) / C.chandN * W, cy = 14 + Math.sin(t * 1.5 * A() + i) * 3;
    ctx.strokeStyle = shade(C.chand, -60); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, cy); ctx.stroke();
    glow(ctx, cx, cy, 14, C.chand, 0.5); ctx.fillStyle = C.chand; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill();
  }
  // rows of tables w/ tiny boards + seated players' heads turning to watch
  for (let i = 0; i < C.headN; i++) {
    const tx = 30 + i * (W - 60) / (C.headN - 1), ty = floorTop - 22;
    ctx.fillStyle = C.tableTop; ctx.fillRect(tx - 14, ty, 28, 4);
    ctx.fillStyle = C.table; ctx.fillRect(tx - 14, ty + 4, 28, 8);
    // a tiny board + two pieces
    ctx.fillStyle = C.piece; ctx.fillRect(tx - 3, ty - 6, 2, 6); ctx.fillRect(tx + 1, ty - 6, 2, 6);
    // head turning (a small horizontal bob)
    const hx = tx + Math.sin(t * 1.2 + i) * 2;
    ctx.fillStyle = C.head; ctx.beginPath(); ctx.arc(hx, ty - 12, 4, 0, TAU); ctx.fill();
  }
  if (crowd > 0.01) { ctx.fillStyle = mixA(C.chand, crowd * 0.12); ctx.fillRect(0, 0, W, floorTop); }
}
SCENES.chesshall = { draw: chesshallScene };
```

- [ ] **Step 2:** Run the shared smoke with `<ID>=chesshall`. Expected: `chesshall OK`.
- [ ] **Step 3:** Commit: `git add src/scenery.js && git commit -m "feat(scenery): grand chess hall arena (Magnus)"`

### Task 17: `stadium` (THE PAWNCHION)

- [ ] **Step 1: Append to `src/scenery.js`**

```js
// MEGA STADIUM — packed tiers doing a phase-offset WAVE, stadium lights, jumbotron.
function stadiumScene(ctx, p) {
  const { W, floorTop, t, crowd } = p; const C = SCENERY.SCENES.stadium;
  sky(ctx, W, floorTop, C.sky);
  // stadium lights
  for (const lx of [W * 0.12, W * 0.88]) {
    const on = 0.7 + 0.3 * Math.sin(t * 3 + lx);
    glow(ctx, lx, 8, 22, C.light, 0.5 * on);
    ctx.fillStyle = C.light; ctx.globalAlpha = on; ctx.fillRect(lx - 5, 2, 10, 8); ctx.globalAlpha = 1;
  }
  // three crowd tiers doing the wave (each row a phase-shifted vertical sine)
  for (let band = 0; band < C.tierN; band++) {
    const y = 18 + band * 16, h = 14;
    for (let i = 0; i < 64; i++) {
      const x = i / 64 * W;
      const dy = Math.sin(t * 3 * A() - i * 0.35 + band * 0.5) * 4;
      ctx.fillStyle = C.tiers[(i + band) % C.tiers.length];
      ctx.globalAlpha = Math.min(1, 0.6 + crowd * SCENERY.CROWD_FLARE);
      ctx.fillRect(x | 0, (y + dy) | 0, 6, h);
    }
  }
  ctx.globalAlpha = 1;
  // jumbotron
  const jx = W / 2 - 36, jy = 14;
  ctx.fillStyle = C.jumboFrame; ctx.fillRect(jx - 3, jy - 3, 78, 42);
  ctx.fillStyle = C.jumbo; ctx.fillRect(jx, jy, 72, 36);
  glow(ctx, W / 2, jy + 18, 40, C.tiers[1], 0.18);
  text(ctx, 'PAWNCH', W / 2, jy + 12, { scale: 1, color: C.tiers[0], align: 'center' });
  text(ctx, 'CHAMP', W / 2, jy + 24, { scale: 1, color: C.tiers[2], align: 'center' });
  // falling confetti
  for (let i = 0; i < 18; i++) {
    const cx = hash(i) * W, cy = (t * 40 * A() + i * 30) % floorTop;
    ctx.fillStyle = C.conf[i % C.conf.length]; ctx.fillRect(cx, cy, 3, 5);
  }
  // arena floor strip (under the lower tiers)
  ctx.fillStyle = C.floor; ctx.fillRect(0, floorTop - 18, W, 18);
}
SCENES.stadium = { draw: stadiumScene };
```

- [ ] **Step 2:** Run the shared smoke with `<ID>=stadium`. Expected: `stadium OK`.
- [ ] **Step 3:** Commit: `git add src/scenery.js && git commit -m "feat(scenery): mega stadium arena (THE PAWNCHION)"`

---

## Task 18: Full integration pass + .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ignore the brainstorm mockups**

Add to `.gitignore` (create the file if missing):

```
.superpowers/
```

- [ ] **Step 2: Full play-through smoke**

With the page served: run all ten scenes through the shared smoke in one shot:

```js
const S = await import('/src/scenery.js?bust=' + Date.now());
const ctx = document.createElement('canvas').getContext('2d');
const ids = ['classic','beach','woods','cyber','dream','temple','castle','space','abyss','chesshall','stadium'];
for (const id of ids) { for (let t = 0; t < 4; t += 0.2) S.drawScene(ctx, id, { W: 512, floorTop: 170, t, crowd: 0.7, accent: '#9a5cff' }); }
console.log('all scenes OK');
```

Expected: `all scenes OK`, no throw.

- [ ] **Step 3: Manual checklist (play)**

  - Story fights 1–10: each shows its mapped arena behind the ring, audience + ambient motion animate, the ring stays readable, no `[PAWNCH] frame error:`.
  - Beat fight 1 → `TROPICAL BEACH ARENA UNLOCKED!` toast; Settings → DISPLAY → ARENA now lists `TROPICAL BEACH` and cycling persists.
  - LOCAL HOTSEAT with `settings.arena` set to an unlocked arena → that backdrop renders in the boxing half.
  - `classic` renders identically to `main` (A/B).
  - Old save (no `arenas`) loads, retro-grants beaten fighters' arenas, never selects a locked arena.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore .superpowers brainstorm mockups"
```

---

## Self-review (done while writing)

- **Spec coverage:** scene map (Tasks 1, 8–17), `scenery.js` + `ring()` split (Tasks 2–4), unlock mirroring chess sets (Tasks 5–6), Settings ARENA row (Task 7), additive save + retro-grant (Task 5), per-scene catalog (Tasks 8–17), config tuning (Task 1), Golden-Rule compliance (procedural/no-asset/config-driven throughout). **Online sync:** intentionally simplified to "each client renders its own selected arena" (cosmetic; no `net.js` change) — noted in `sceneFor` (Task 3) and the plan header.
- **Placeholder scan:** no TBD/TODO; every code step is complete. The one `glow(...)` no-op in `dream` is called out with a delete-if-preferred note.
- **Type/name consistency:** `drawScene(ctx, id, { W, floorTop, t, crowd, accent })`, `SCENES.<id> = { draw }`, `sceneFor`, `availableArenas`, `SCENERY.OPPONENT_SCENES/NAMES/SCENES/ANIM/CROWD_FLARE`, `save.unlocks.arenas`, `save.settings.arena` are used identically across all tasks. Helper names (`sky`, `crowdRow`, `twinkle`, `flame`, `drift`, `glow`, `hash`, `A`) are defined once in Task 3 and reused by every scene.
