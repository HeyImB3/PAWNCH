# Visual Overhaul V5 — Face-Tile Portrait System: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Living portraits for the hero + all 10 fighters — material-driven expressions, reaction pops on captures/checks, idle blinks, and persistent 3-tier battle damage (with the tier-3 missing-tooth grin) — shown in the chess broadcast panel and reused at round break, match end, and the boxing intro.

**Architecture:** A **standardized face rig** makes the scale tractable: `tools/paint_portraits.py` draws every character from one 44×44 geometry contract (fixed eye/brow/mouth boxes) + a per-character parameter dict seeded from the ROSTER's existing `look.face`/`headgear`/HUE data — 11 characters × 10 expressions from ONE painter, and because geometry is standardized, the 3 damage overlays are GLOBAL PNGs and the engine can draw eyelid blinks/emote FX procedurally at known positions. `src/portrait.js` owns the expression state machine (`PortraitFace`); `match.damage` accrues in the match model (Golden Rule 6) from boxing hooks. Chess's `_portraitSlot` is the single integration point (V4 designed it that way); the bust silhouette remains the zero-asset fallback.

**Tech Stack:** Unchanged (PIL rig painter, Canvas 2D, headless-Chrome QA).

## Global Constraints

- All prior Global Constraints verbatim. `match.damage` is written ONLY by boxing hit hooks and read by presentation — it never feeds back into the sim.
- **Rig geometry contract (44×44, all characters):** head center x=22; crown y5, chin y31; eye boxes L(13,17)-(19,21) R(25,17)-(31,21); brows y13–15; nose (21,22)-(23,24); mouth box (15,25)-(29,29); bust y31–43. The engine's blink bar covers (12,16)-(32,22); emote anchors: vein (35,7), sweat (35,10), sparkle (9,7). Damage overlays target these same boxes. ANY rig change updates painter + engine + overlays together.
- Expressions (exact keys, = filenames `<key>.png`): `neutral pleased smirk beaming concerned upset dejected wince shock grin3`.
- Tier thresholds per spec: `score = boxingDamageTaken + 50 × knockdownsSuffered`; tier 1 ≥ 100, 2 ≥ 220, 3 ≥ 360 — all in `PORTRAIT` config.
- Suite `66 passed, 0 failed` throughout; zero-asset boot falls back to the V4 bust silhouettes.

---

### Task 1: `match.damage` tracking + `PORTRAIT` config

**Files:**
- Modify: `src/config.js`, `src/game.js` (match init in `startMatch`), `src/states/boxing.js` (onHit/onKnockdown hooks)

**Interfaces:**
- Produces: `PORTRAIT = { TIERS: [100, 220, 360], KD_SCORE: 50, REACT_MS: 1500, EASE_MS: 900, BLINK_S: [2.5, 6.5], SIZE: 44 }`; `match.damage = { player: 0, enemy: 0 }` (init in startMatch; all readers guard `(m.damage ||= { player: 0, enemy: 0 })` for older saves).

- [ ] **Step 1:** Config block after `PANEL`. game.js `startMatch`: add `damage: { player: 0, enemy: 0 },` to the match object literal (find the `hp: {...}` line; add alongside).
- [ ] **Step 2:** boxing.js `onHit(side, dmg, kind)`: add `(this.m.damage ||= { player: 0, enemy: 0 })[side] += dmg;` (side = the fighter who GOT hit — verify: onHit's `side` is the victim, consistent with the HP burst positions). `onKnockdown: (side) => { … existing …; (this.m.damage ||= { player: 0, enemy: 0 })[side] += PORTRAIT.KD_SCORE; }` (sim passes `(fr.side, fr.knockdowns)` — adopt the arg).
- [ ] **Step 3:** Suite green; boot clean. Commit: `git commit -m "feat(match): persistent battle-damage score (hits + knockdowns) in the match model"`

### Task 2: Loader group + `src/portrait.js` engine + grid harness

**Files:**
- Modify: `src/gfx.js` (registry), `src/assets.js` (loader), `assets/sprites/manifest.json`
- Create: `src/portrait.js`, `tools/portrait-preview.html`

**Interfaces:**
- gfx.js: `registerPortrait(slug, key, img)` / `portraitSprite(slug, key)`; loader groups `"portraits": { "<slug>": "portraits/<slug>" }` (dir of `<expr>.png`, missing files skipped) and `"portraitOverlays": "portraits/_overlays"` (dir of `damage1.png damage2.png damage3.png`, registered under slug `_overlays`).
- portrait.js: `EXPRESSIONS` array; `damageTier(score) → 0|1|2|3`; `class PortraitFace { constructor({ slug, hue }); setMaterial(diff); react(kind /* 'joy'|'anger'|'shock'|'smug' */); force(expr|null); update(dt); draw(ctx, x, y, { tier = 0 }) }`. Baseline map: ≥6 beaming (grin3 at tier 3), 3–5 smirk, 1–2 pleased, 0 neutral, −1..−2 concerned, −3..−5 upset, ≤−6 dejected. Reactions override for `REACT_MS` with a squash-bounce (scaleY dip → overshoot) + an emote glyph (anger = red vein chevrons, shock = blue sweat drop sliding, joy/smug = gold sparkle). Blinks: at hash-scheduled intervals in `BLINK_S`, 120 ms, only over `neutral/pleased/smirk/concerned` — a `hue.skin` bar across the blink box. Fallback (`!portraitSprite(slug, expr)`): the V4 bust silhouette (move that drawing here as `drawBustFallback(ctx, x, y, hue)`), scaled by the same pop so reactions still read.
- Harness: grid page — rows = `['player','patty','gus','rosa','kid','bishop','queen','iron','tal','magnus','pawnchion']`, cols = the 10 expressions, `?tier=N` composites the overlay on all cells, bottom row = live `PortraitFace` cycling material −8→+8 and firing a reaction every 3 s.

- [ ] Steps: registry+loader → engine (complete code at execution; the class is ~120 lines following the interface above) → harness → QA (fallback busts fill the grid pre-art) → suite → commit: `git commit -m "feat(portrait): expression engine, loader group, grid harness (fallback busts)"`

### Task 3: The face RIG painter + hero + Patty + global overlays

**Files:**
- Create: `tools/paint_portraits.py`, `assets/sprites/portraits/{player,patty}/…` (10 PNGs each), `assets/sprites/portraits/_overlays/damage{1,2,3}.png`
- Modify: `assets/sprites/manifest.json`

**Rig painter structure:**
- `CHARS = { slug: { skin: (r,g,b), hue: hex, trim: hex, hair: 'none|short|side|spiky|long', hairCol, headgear: 'none|pawnDomeShort|pawnDomeTall|rookChimney|knightVisor|mitre|crown|ironHelm|bandana|laurel|champCrown', mods: ['stubble','widowPeak','hooded','lipstick','cheekDab','cheekMark','glint','bar-brows'] } }` — seeded from `src/opponents.js` ROSTER `look` (read the full look block first; keep identities faithful: Patty = pawnDomeShort + hopeful, Bishop = mitre, Queen = crown+lipstick+cheekMark, Iron = steel helm + bar brows + dark eyes, Tal = widowPeak+stubble+catchlight, Magnus = hooded+stubble+laurel?, Pawnchion = champ crown + glint, hero = headband).
- Draw order per frame: bust (hue body, trim collar) → neck → head base (3-tone skin ramp, jaw by param) → ears → mouth(expr) → nose → eyes(expr, + mods hooded/glint/eyeCol) → brows(expr) → hair → headgear → mods (stubble dither, marks). Expression feature table (brow/eye/mouth per the 10 keys) implemented as small draw functions taking the skin ramp.
- Overlays (global): tier1 = cheek bruise (27,21)-(33,26) RED1/MAT-purple dither + brow cut (13,12) 3px RED2; tier2 = tier1 + butterfly bandage (12,11)-(19,15) SPEC1/STEEL3 + under-eye swelling (25,22)-(31,25) skin-dark dither + lip cut (24,28); tier3 = tier2 + black-eye ring around the R eye box (INK1/MAT1) + nose plaster (19,21)-(25,25) SPEC1 band. `grin3` per character = beaming with a 2×3 INK0 gap in the teeth row.

- [ ] Steps: painter skeleton + hero/patty params → paint → grid-harness QA at `?tier=0..3` (iterate the rig until expressions READ at 44px — the unforgiving gate) → manifest entries → commit: `git commit -m "feat(art): portrait rig painter — hero + Patty sets + global damage overlays"`

### Task 4: The other nine fighters

- [ ] Read the full ROSTER `look` entries; write the 9 param dicts; generate; grid QA (identity check: each face should be recognizable as its fighter by silhouette/headgear/palette alone); fix collisions (headgear vs hair clipping). Manifest entries. Commit: `git commit -m "feat(art): portrait sets for the full roster (9 fighters)"`

### Task 5: Chess integration + round break

**Files:**
- Modify: `src/states/chess.js`, `src/states/roundbreak.js`

- [ ] **Chess:** `enter()`: build `this.faces = { enemy: new PortraitFace({ slug: story? m.opponent.look?.sprite : null, hue: this.oppHue }), player: new PortraitFace({ slug: 'player', hue: HUE.player }) }`. `update()`: `faces.*.update(dt)`; each frame `setMaterial(±myMat)`. `_commit()`: after status calc — capture → mover's face `react('joy')`, victim's `react('anger')`; check → checked side `react('shock')`; promotion → mover `react('smug')`. `_portraitSlot`: replace the bust body with `face.draw(ctx, x, y, { tier: damageTier((m.damage ||= {player:0,enemy:0})[side]) })`, keeping the accent frame + alarm/spotlight strokes on top; fallback path unchanged (PortraitFace handles it internally).
- [ ] **Roundbreak:** two static `PortraitFace`s (enter), `setMaterial` once from the board, `force('wince')` on whichever side lost more HP this round (compare `this.before` vs `this.after`… simpler: force none; show tier damage — the faces' damage tiers ARE the story). Draw at 44×44 beside each fighter's heal bar with nameplates.
- [ ] Harness + live QA (`chess-preview.html` — captures fire reactions visibly; `?check=1` → shock) → suite → commit: `git commit -m "feat(chess): living portraits — material moods, capture/check reactions, damage tiers"`

### Task 6: Match end + boxing intro + master sheet + sweep

- [ ] **Matchend:** winner face `force('beaming')` (or `grin3` at tier 3 — the spec's money shot), loser `force('dejected')`, drawn with tiers near the result text. **Boxing intro:** opponent portrait at current tier in the `_nameplate` plate (left of the name).
- [ ] Contact-sheet master: composite all 11×10 grid + overlays into one PNG → `import_image` → `assets/aseprite/portraits-sheet.aseprite`.
- [ ] Sweep: suite; zero-asset boot (busts); full boot (~330 sprites); gallery (grid ?tier=0 and ?tier=3, chess live shot) → send; spec V5 row → DONE; CLAUDE.md tour + memory; merge → suite → push → delete branch.
