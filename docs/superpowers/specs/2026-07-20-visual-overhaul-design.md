# PAWNCH Visual Overhaul — hi-bit arenas, living ring, broadcast chess panel, face tiles

**Date:** 2026-07-20
**Status:** Approved (design); implementation phased V1–V6
**Owner intent:** Push PAWNCH's in-match visuals to contend with the best modern
pixel art of the last five years (Sea of Stars, Blasphemous II, Eastward, The
Last Night) — lush, immaculate, detailed. Punch-Out!! (Wii) is the *mechanical*
reference for accumulating face damage, NOT the visual bar.

## Decisions locked with the owner

1. **No more Gemini for these assets.** Claude authors all new art by hand in
   Aseprite (pixel-mcp tools + professional pixel-art technique). The existing
   Gemini fighter sprites remain the keepers (per `docs/ART_BIBLE.md`).
2. **Style register: hi-bit pixel art.** Real pixel art, native resolution, no
   fake hardware limits — rich palettes, hue-shifted ramps, cluster shading,
   selective dither, soft additive light over crisp pixels.
3. **Phase 1 focus: the ring + master style foundation** (it appears in every
   fight), then a pilot arena, then rollout, then chess panel, then portraits.
4. **Architecture: modular painted kit + living code layer.** Painted pieces are
   composed and *animated/lit* by code; the current procedural scenes remain the
   zero-asset fallback (Golden Rule 5 intact).

## 1 — The "PAWNCH Hi-Bit" style bible (becomes ART_BIBLE.md v2)

- **Native resolution, honest pixels.** All new art authored in Aseprite at 1:1
  game scale (512×448 canvas). No downscaled renders, no mixed pixel sizes, no
  rotated pixels. Layered `.aseprite` masters are committed (`assets/aseprite/`).
- **One master palette family (~56 colors)** anchored on brand orange/blue.
  Shadows hue-shift cool (blue-violet), highlights warm (gold); never pure
  black/white ramps. Each arena derives a sub-palette from the master so the
  whole game reads as one artist.
- **Cluster shading, KOF-interior style**: forms modeled by shaped color
  clusters; minimal outlines (only where a silhouette must pop). No pillow
  shading, no banding; dithering only as deliberate texture (sky, smoke).
- **Declared key light per scene** (beach = low warm sun; cyber =
  magenta/cyan signage; woods = candle pools; …). The ring and fighters receive
  that light via a code tint wash + rim-light pass.
- **The glow pass**: light emitters (lamps, neon, flames, jumbotron) get an
  additive bloom layer (`globalCompositeOperation:'lighter'`) over crisp pixels.
- **Motion doctrine**: nothing is ever fully still; every layer idles, and every
  gameplay beat echoes into the environment.

## 2 — The Ring (Phase V1 centerpiece)

Painted modular kit (`assets/sprites/ring/`): mat, apron, posts, turnbuckles,
corner stool/towel. Live code layer on top:

- **Mat**: painted canvas texture — worn center, stitched seams in perspective,
  crowned-pawn sunburst emblem. Code adds a gloss/reflection pass (faint flipped
  fighter + corner-light reflections) and **fight-memory decals** (sweat/scuff
  marks accumulate where hits/knockdowns land; wiped each round break).
- **Ropes**: painted 3-tone ramp look (drawn by code so they stay physical) —
  catenary sag, idle sway, shockwave ripple on big hits, hard bounce on
  knockdowns near them.
- **Posts/turnbuckles**: chunky painted sprites; per-opponent accent pads
  (tinting preserved via pre-tinted offscreen composite); corner lamps with
  bloom halos. Blue corner gets stool/towel/bottle, visible at round breaks.
- **Apron**: embroidered PAWNCH logotype, gold trim stitch, per-opponent accent
  band, subtle chess-motif bunting.
- **Ringside foreground** (silhouette layer in FRONT of the mat edge): press-row
  photographers whose flashbulbs pop on big hits; boom mic dips in on knockdowns.
- **The spotlight moment**: on a knockdown, arena light dims to near-black and a
  single volumetric spotlight cone snaps to the downed fighter for the count.

## 3 — The arenas (V2 pilot = Beach, then rollout in story order)

Each scene = 3 painted parallax layers (far / mid / near-crowd) + code FX layer,
a declared key light, constant idle motion, gameplay-reactive beats, and one
rare "did-you-see-that" event. The existing procedural scenes stay as fallback.

- **CLASSIC** — real arena: hanging light truss, 4 volumetric cones, smoke haze,
  tiered silhouette crowd with phone lights, PAWNCH banner. Reactive: flash-pop
  waves on big hits.
- **BEACH (Patty)** — golden hour: low sun, god-rays through swaying palms,
  rolling surf with foam sparkle, tiki torches + swinging string lanterns,
  driftwood bleachers, beach ball. Rare: crab crosses the apron between rounds.
- **WOODS (Gus)** — forest amphitheater: trunk arches, rolling low fog layer,
  candle pools, fireflies, moon shaft, swaying hooded congregation. Rare: eyes
  blink open in the dark.
- **CYBER (Rosa)** — rain-soaked neon canyon: deep skyscraper layers with lit
  windows, flickering "HOTEL ROOK" neon, glitching holographic rook, rain,
  wet-street neon reflections, steam vents, circling camera drones. Reactive:
  neon surge + drone swarm on knockdowns.
- **DREAM (Kid)** — hue-cycling sky (code lerps painted-layer palette), floating
  islands, colossal rotating stone knight head, stairways to nowhere, aurora
  ribbons, star showers. Rare: a sheep bounces across, counting itself.
- **TEMPLE (Bishop)** — twilight monastery: carved bishop statues, prayer flags,
  incense columns, snow peaks + cloud drift, monks with candle bowls. Reactive:
  a great gong rings (visual + sfx) at round start.
- **CASTLE (Queen)** — floating keep, streaming banners, waterfall off the
  island edge into mist, 3 cloud depths, royal balcony with trumpeters, petals.
  Reactive: trumpet flourish on knockdowns.
- **SPACE (Iron)** — orbital platform: ringed planet, parallax starfields,
  rotating machinery/pistons, astronaut gallery with thruster puffs, debris.
  Reactive: red warning strobes on knockdowns. Rare: comet.
- **ABYSS (Tal)** — bioluminescent trench: caustic light ripples over everything
  (code overlay), jellyfish blooms, kelp, vent bubbles, lurking anglerfish.
  Rare: whale silhouette glides far behind.
- **CHESSHALL (Magnus)** — championship gala: stained-glass chess window casting
  colored light patches, chandeliers with bloom, marble columns, formal
  audience, press flashes — and a **demonstration wall-board mirroring the
  actual live chess position of this match**.
- **STADIUM (Pawnchion)** — colossal bowl doing the wave, sweeping searchlights,
  confetti cannons, pyro on knockdowns, blimp — **jumbotron shows live round
  number / fight state**; crowd letter-cards spell P-A-W-N-C-H.

## 4 — Chess side panel: broadcast match graphics (V4)

Painted championship-broadcast chrome in the right column (x≈383, w≈120):

- Opponent portrait tile (painted frame, arena-accent trim) + nameplate + ELO.
- **Clocks as physical objects**: painted plates, glowing dot-matrix digits;
  active side glows; <10s = red flash, steam, heartbeat pulse.
- **Captured-piece trays** replace the material number: tiny painted icons of
  every captured piece per side + net advantage badge. Captured pieces **fly
  from the board into the tray** with a click + spark.
- **Half-timer = burning fuse** crawling toward a bell icon; sparks under 10s.
- **Move ticker**: last move slides in with piece glyph (♞ Nf6), 3-move history.
- Player portrait + clock at the bottom (fighting-game HUD convention), with
  both sides' **carried boxing HP as glove-icon bars** under the portraits.
- Check = red alarm flash on the endangered portrait + screen-edge vignette;
  checkmate = spotlight treatment on the winner's portrait.

## 5 — Face-tile system (V5)

Hand-pixeled ~56×56 head-and-shoulder portraits, KOF-interior shading, for all
10 opponents + the hero, repainted from each fighter's established design.

**Expression engine (`src/portrait.js`), two layers:**

1. **Baseline mood from material diff** (eases in ~1s): 0 = focused neutral;
   +1..2 pleased; +3..5 confident smirk; +6+ beaming. Mirrored: −1..2 concerned;
   −3..5 upset; −6− dejected. The two portraits always tell opposite ends of
   the same story.
2. **Reaction pops** (~1.5s override + squash-bounce): capture for → excited;
   captured against → wince/snarl; check → shock; promotion → smug. Emote FX
   particles (anger vein, sweat drop, sparkle) layer on any frame. Idle blinks
   (2-frame) + occasional board glance.

**Battle damage (owner's core idea; Punch-Out Wii rule):** persistent for the
whole match — round heals restore HP, never faces. Three tiers driven by
knockdowns taken + cumulative boxing damage, tracked in the `match` model
(`match.damage`) in `game.js`. Initial formula (tunable via `PORTRAIT` in
config.js): `score = totalBoxingDamageTaken + 50 × knockdownsSuffered`;
tier 1 ≥ 100, tier 2 ≥ 220, tier 3 ≥ 360. Drawn as overlay layers composable
onto any expression (9 base expressions + 3 overlays + 1 variant frame, not a
27-frame matrix):
- Tier 1: reddened cheek, small brow cut.
- Tier 2: butterfly bandage, swelling eye, split lip.
- Tier 3: black eye, plastered nose + a dedicated tier-3 grin frame with the
  **missing tooth**.

**Reuse**: chess panel (home), round break, boxing intro nameplate, match end.

**Expression frame list per character** (9 base + 1 variant + 3 overlays):
neutral, pleased, smirk, beaming, concerned, upset, dejected, wince, shock;
grin3 (dedicated tier-3 missing-tooth variant); overlays damage1/2/3.

## 6 — Technical architecture

- **Assets** via existing `manifest.json` → `loadAssets()` (new groups):
  `arenas/<sceneId>/{far,mid,near}.png`; `ring/*.png`;
  `portraits/<slug>/*.png`; `ui/*.png`. `.aseprite` masters in `assets/aseprite/`.
- **Code**: `scenery.js` scenes use painted layers when registered, else current
  procedural fallback. New `src/lighting.js` (glow pass, spotlight cone,
  rim/tint wash, caustics, reflection blit). New `src/portrait.js` (expression
  state machine). `match.damage` tracking in `game.js` (Golden Rule 6). New
  tuning blocks in `config.js` (`PORTRAIT`, per-scene light/FX knobs, palette
  additions in `PAL`) — no magic numbers in draw code (Golden Rule 2).
- **Guardrail — determinism**: all of this is presentation-only; nothing reads
  from or writes into the deterministic sim (`src/sim/*`). Rare events + FX use
  render-side randomness only. The online-sync rebuild is untouched.
- **Guardrail — readability beats spectacle**: fighters + their tells own a
  reserved value/contrast band; backdrops sit lower-contrast behind them. A
  backdrop change that muddies tell-reading is a regression (Golden Rules 8/9).
- **Fallbacks**: game boots with zero images — procedural scenes; procedural
  mini-face portraits (from fighter look params); current `panel()` chrome.
- **QA**: `tools/arena-preview.html` harness (scenes × light states × portraits
  × expressions × damage tiers); localhost dev-unlock for in-fight review; perf
  vs the `[PAWNCH] frame error` log at 60fps. Painted layers are static blits;
  glow passes capped.

## 7 — Phases

| Phase | Delivers |
|---|---|
| **V1** ✅ DONE 2026-07-21 (branch `visual-v1-ring`, be7e9a2..HEAD) | Art Bible v2, master palette, painted ring kit, lighting system (glow/spotlight/reflections), rope physics, press-row flashbulbs, knockdown spotlight moment, upgraded CLASSIC arena. Note: ring/arena art is painted by `tools/paint_ring.py` (deterministic per-pixel painter; the MCP dither primitives were too coarse) — fighter rim-light deferred to V2. |
| **V2** ✅ DONE 2026-07-21 (branch `visual-v2-beach`) | Pilot arena end-to-end: **Beach**, reimagined as BACKLIT GOLDEN HOUR (sun-path sea, torch flames, swinging lantern string, ember-rimmed frond canopies, bleacher crowd, crab rare-event) — plus the key-light system (`withRim` fighter rim + golden wash), piloted here and ready for every later arena. |
| **V3** | Remaining 9 arenas, batches of 2–3 per session, story order, each with reactive beats + rare event |
| **V4** | Chess broadcast panel: clock plates, capture trays + fly-in, fuse timer, move ticker, layout |
| **V5** | Portraits: hero + Patty first (prove the set), expression engine + damage tracking, roster rollout, reuse across screens |
| **V6** | Polish sweep: consistency audit, readability/silhouette QA, perf pass, FX-intensity setting |

## Research grounding

- SFII stage construction (3 scroll layers, small repeating loops, parallax):
  fabiensanglard.net/sf2_sheets, sf2platinum.wordpress.com
- Punch-Out!! (Wii) accumulating face damage between rounds:
  punchout.fandom.com/wiki/Punch-Out!!_(Wii)
- Hi-bit definition/manifesto: dpadstudio.com/Blog/postHibit.html
- Hue-shifting fundamentals: tofupixel (Pixel Art Fundamentals — Hue Shifting)
- KOF small-portrait craft (interior shading, minimal outlines): ChronoCrash
  appreciation thread
