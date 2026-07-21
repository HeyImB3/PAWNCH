# Visual polish pass — ropes, beach water, stadium crowd/sign, sprite-true portraits

**Date:** 2026-07-21
**Status:** Approved (design)
**Owner intent:** Four targeted fixes to the shipped V1–V6 visual overhaul, from
first playtest feedback: stop the distracting rope waves, make Patty's sunset
water beautiful instead of speckly, make the Pawnchion's stadium crowd read as
real cheering people with a big neon PAWNCH sign, and make every portrait /
selection card actually look like the Gemini fighter models.

## Decisions locked with the owner

1. **Ropes: no impact waves at all.** Neither punches nor knockdowns ripple the
   ropes. Only the catenary sag + subtle idle sway remain.
2. **Beach water: glossy sun lane + live glints.** Repaint the sea and sun path;
   add 2–3 gentle animated twinkles in the live layer.
3. **Stadium sign: mounted neon signboard** (~2.5× the old fan cards) with a
   live glow/flicker/letter-chase treatment. Crowd repainted as real spectators
   with a physical WAVE (raised arms follow the light band).
4. **Portraits: sprite head-crops, no Gemini.** Chess/round-break/match-end
   faces are regenerated offline from the existing fighter sprites (expressions
   map to pose heads). Story-mode cards blit a bust crop of the real sprite at
   draw time. `portrait.js` is untouched; a later Gemini upgrade would drop into
   the same filenames with zero code changes.

## 1 — Ropes stop waving

- Delete the two gameplay feeds into the wave system in `src/states/boxing.js`:
  the per-hit `this.ringView.impact(...)` (onHit, ~line 88) and the knockdown
  `this.ringView.impact(game.W / 2, 1)` (onKnockdown, ~line 128).
- Everything else about those beats stays: mat decals, flashbulbs, screen shake,
  hit-stop, crowd surge.
- `RingView.impact()`, `src/ropes.js` math, `RING.ROPES` config, and the
  headless rope tests all stay intact — `tools/arena-preview.html`'s IMPACT
  button remains the QA harness for the (now gameplay-unused) wave path.

## 2 — Patty's beach: glossy sun lane

All painting in `tools/paint_beach.py` `paint_far()` (sea block, rows
HORIZON..WATERLINE); regenerate `assets/sprites/arenas/beach/far.png` only.

- **Sea base:** vertical dusk gradient — brightest just under the horizon,
  deepening toward the waterline (palette ramp, not flat BLUE0). Sparse
  *horizontal* wave strokes; near the horizon they catch ember light.
- **Sun lane:** a solid tapering column under the sun (existing widening
  geometry is fine): gold core → ember edges, hue-shifted per the master
  palette, brightness falling off with depth. Edges soften via dither into the
  sea — no hard vertical line, no isolated single pixels.
- **Shimmer:** horizontal dashes (2–6 px) across the lane at irregular row
  intervals, denser near the horizon — coherent glints, not noise.
- **Live glints:** in `src/scenery.js` `SCENES.beach.drawLayered`, 2–3 slow
  additive twinkles drifting on the lane. Deterministic from `t` (no
  `Math.random` in draw), knobs in `SCENERY.SCENES.beach.L`
  (count/speed/color/alpha), count run through `fxN()` so FX LOW trims them.

## 3 — Pawnchion's stadium: real crowd + neon signboard

Painted work in `tools/paint_stadium.py`; regenerate the stadium layer PNGs.
Live work in `src/scenery.js` `SCENES.stadium.drawLayered`. The procedural
`stadiumScene` zero-asset fallback is untouched.

**Paint — crowd (`paint_mid()` tiers + `paint_far()` top tier):**
- Replace the color-block "confetti" with actual spectator figures: head with
  varied skin-tone ramp, shirt with a shadowed side, occasional pre-raised
  arms; figures larger in the front tier (~8–10 px) shrinking and dimming
  toward the back; rows overlap with the existing step shadows.
- Shirt colors move off candy-saturation toward the master palette; the far
  micro-crowd flecks desaturate one more notch for depth.
- A few painted flags + foam fingers sprinkled through the tiers.

**Paint — the neon signboard (replaces the letter-card block):**
- A wide dark board mounted on the mid-tier facade, ~2.5× the old sign's
  footprint, PAWNCH in neon-tube letters (gold/ember tubes), painted inner glow
  halo spilling onto the board and nearby crowd, mounting struts and a contact
  shadow so it sits *in* the tier (Golden Rule 10).
- Letter cell geometry (board rect, letter pitch) recorded in
  `SCENERY.SCENES.stadium.L.sign` so paint and live code stay in sync.

**Live — `drawLayered`:**
- **Physical WAVE:** where the existing traveling brightness band crosses a
  tier, draw procedural raised-arm pixels (per-seat deterministic hash for
  position/color jitter) so the crowd visibly stands and waves with the band.
- **Sign life:** additive glow pulse on the tube letters; a rare
  half-dead→blazing neon flicker (`t % PERIOD` pattern, like cyber's HOTEL
  ROOK); on crowd surges (`crowd > 0.5`, i.e. knockdowns/big hits) the letters
  chase-light left to right using the `L.sign` geometry.
- Sparse phone-light twinkles in the upper tiers (as classic does), through
  `fxN()`.

## 4 — Sprite-true portraits + story cards

**A. Chess/broadcast portraits — new tool `tools/portrait_from_sprite.py`:**
- For each of the 11 slugs (10 fighters + player), crop the head from chosen
  pose sprites in `assets/sprites/boxers/<slug>/`, normalize so the face fills
  the 44×44 rig with eyes on the rig eye-line (`tools/paint_portraits.py`
  contract mirrored in `src/portrait.js` — neither changes).
- Per-slug data table in the tool: pose → crop rect + eye-line y, hand-tuned
  against a checkerboard audit montage (`tools/_portrait_audit.png`).
- **Expression → pose-head mapping** (default, per-slug overridable, falling
  back to `idle` wherever a pose head is tilted/occluded):
  `neutral`,`pleased` → `front_idle` · `concerned`,`upset`,`wince` →
  `front_hurt` · `shock`,`dejected` → `front_stagger` · `smirk`,`beaming`,
  `grin3` → `front_special`. Player maps from its `front_*` frames.
- Output: the same 10 expression filenames `src/portrait.js` already loads,
  written to `assets/sprites/portraits/<slug>/` (replacing the old rig faces).
  LANCZOS for any scaling; alpha judged via `tools/check_alpha.py`, never the
  Read tool. Blink eyelids, emote glyphs, and `_overlays` damage tiers keep
  compositing on top unchanged.

**B. Story-mode cards — `drawPortrait` in `src/fighter.js`:**
- When `look.sprite` names a registered boxer set, blit a bust crop of
  `front_idle` (top of head → mid-chest, derived from the sprite's alpha bbox)
  into the cell over the existing studio-gradient backdrop, pixel-crisp.
- Silhouette mode (unbeaten + "?") reuses the same crop through the existing
  source-in darkening. No sprite registered → current procedural bust
  (zero-asset rule intact). `src/states/story.js` needs no changes.

## QA / verification

- Headless unit suite still green: `osascript -l JavaScript
  tools/test/run-headless.js "$PWD"`.
- `tools/arena-preview.html`: `?scene=beach` and `?scene=stadium` (+ `?bare=1`,
  `?fxlow=1`, `?crowd=NN`, `?down=1`); confirm no rope wave on IMPACT-free play
  in a real match.
- `tools/portrait-preview.html` grid: all slugs × expressions × damage tiers;
  `tools/chess-preview.html` for the broadcast panel in situ.
- In-game sweep: story select (cards + silhouettes) → chess half (faces react)
  → boxing (no rope waves on hits/knockdowns) → round break → match end.
- All transparent-PNG judgments through `tools/check_alpha.py` / montages.

## Risks / accepted trade-offs

- **Pose-head expressions are approximate.** Some fighters' hurt/stagger/
  special heads will be unusable (tilt/glove occlusion) and fall back to idle,
  flattening their mood range — accepted as the cost of the no-Gemini choice;
  upgrade path preserved (same filenames).
- **Repainted layers must stay palette-true** (`tools/pawnch_palette.py` only)
  or the arenas stop reading as one artist — both painters already import it.
- **Live additions are new per-frame work**: arm-wave + glints + sign glow all
  go through `fxN()`/FX LOW and the existing `?perf=1` overlay check.
