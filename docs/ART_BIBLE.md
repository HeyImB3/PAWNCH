# PAWNCH Art Bible — the sprite-rebuild standard

The plan + rules for rebuilding every fighter (10 enemies + the player) from the
Gemini reference sprites into **our own** clean, vibrant, hand-authored pixel art.
This is the durable style guide: follow it and anyone (you, me, a future artist)
produces on-style sprites. Started 2026-06-23. Status: **pilot = Patty**.

> This supersedes the "match the soft LANCZOS edges" guidance in CLAUDE.md Golden
> Rule 10 *for rebuilt fighters*. Rule 10 governed *adding* elements to the old
> painterly sprites (e.g. Bishop's mitre). A fighter that has been rebuilt to this
> bible is **crisp cel art**, not soft/painterly — the rules below win for it.

---

## 0. Why

The Gemini sprites are painterly AI renders: muddy, ~4000+ colors each, hard to
edit, not "ours." We're replacing them with **crisp, cel-shaded, limited-palette,
bold-vibrant** sprites authored in Aseprite — cleaner, far more editable, more
vibrant, and genuinely our IP. Once a fighter is rebuilt, its Gemini `_src/` can be
retired (kept only until the rebuild is signed off).

## 1. Target style (locked)

- **Canvas:** keep **150 × 216**, feet on row **190**, body centered on col **75**
  (unchanged — so rebuilt sprites drop into the game with zero engine re-tuning).
- **Crisp, not chunky.** Full 150-res detail with hard pixel edges (chunky/low-res
  was rejected — it muddied small faces like Patty's).
- **Cel-shaded:** flat colour regions with 2–3 deliberate, hand-placed tone bands
  per material. No gradients, no AI mush, no dithered noise on flat surfaces.
- **Bold arcade-vibrant** palette — punchier/more saturated than the Gemini source
  (user direction: "punch it up more"). Highlights warm, shadows rich/hue-shifted.
- **Crisp outline:** a 1px dark, slightly-warm outline on the silhouette (and key
  internal material seams). NOT pure black — use the shared `outline` colour.
- **Readability first:** the character must read instantly as a black silhouette
  and the face/signature detail must stay legible at game scale.

## 2. Master palette (shared across the whole roster)

One curated, limited master palette. Cohesion comes from every fighter pulling from
shared ramps + shared neutrals; per-fighter accent ramps extend it. Editing the
master palette re-tints the whole game.

**Shared neutrals (all fighters):**
- `outline`  `#28130d`   (dark warm brown-black — silhouette + seams)
- `dark`     `#1a1010`   (pupils, mouth interiors, deepest cavities)
- `eye_white``#fcf6ec`   (eye whites, teeth, bright glints)

**Patty seed ramps (light → dark):**
- **skin/amber-pawn:** `#ffd884 #f6ad36 #e0801a #a85214 #5e2c0e`
- **glove (hot red-orange):** `#ffa022 #f55914 #cc3206 #7a1c04`
- **trunks (electric blue):** `#63e2ff #17a8ef #0f6ed0 #0a4496`
- **cheek blush:** `#ff6f80`

Each new fighter adds its own ramps (e.g. Iron's steel + brass, Queen's pinks,
Bishop's robe-purple + the white+gold mitre) but reuses the shared neutrals and,
where possible, shared ramps. Keep the total master palette tight (target ≲ 48
colours across the whole roster). Maintain it as a real Aseprite palette file
committed at `assets/palette/pawnch.aseprite` (or `.gpl`).

**Shading rules:** single light from upper-left. Highlight band on upper-left
surfaces, mid as the base, shadow on lower-right, plus a deep accent in cavities.
Hue-shift the ramps (don't just darken): shadows drift toward red/violet, highlights
toward yellow — that's where "vibrant" comes from. Ensure adjacent materials
**contrast** (e.g. don't let amber skin and orange gloves merge — separate by
value/outline).

## 3. Production pipeline (per pose)

A hybrid: automation does the grunt work, the hand-pass delivers the quality.

1. **Auto cel-base** (`tools/celify.py`, evolving): from the fighter's reference,
   segment materials by hue/value → median-denoise → posterize each material into
   its ramp's cel bands → crisp 1px outline → despeckle. Output: a clean flat-cel
   starting layer at 150×216. (~70% of the work; nails palette + flats + silhouette.)
2. **Hand-refine in Aseprite** (the craft, where "ours/clean/pro" lives):
   - Redraw the **face** clean (eyes, mouth, brow, expression) — auto can't nail it.
   - Place **cheeks / signature accents** by hand.
   - Fix material **contrast** + any banding the auto left.
   - Tidy the **outline** + key internal seams; add selective rim light if wanted.
   - Confirm the **silhouette** reads.
3. **Export + commit source:** export the flattened PNG to
   `assets/sprites/boxers/<slug>/front_<pose>.png` (player: `back_<pose>` etc.), AND
   commit the **layered `.aseprite` source** to `assets/sprites/_aseprite/<slug>/`.
   The `.aseprite` is the editable source of truth from now on.

**Aseprite layer convention (per `.aseprite`):**
`outline` · `flats` (base colours) · `shading` (tone bands) · `face` · `accents`.
Keeping these separate is what makes the sprites "easy to edit forever."

## 4. Animation-ready (this pass = poses, structured for frames later)

This pass rebuilds the existing **~14 poses** (idle, guard, windup L/R, jab L/R,
hook L/R, duck, hurt, stagger, down, walk, special; player also `back_*` + a couple
`front_*`). We are NOT authoring new in-between frames yet — but we structure for it:
- Each fighter's `.aseprite` uses Aseprite **frames + tags** (one tag per pose) so
  adding tween frames later is trivial.
- Export a per-fighter **tagged spritesheet** (`assets/sprites/_sheets/<slug>.png` +
  JSON) alongside the individual PNGs — animation-ready for a future frame-based rig.

## 5. Modular game-dev notes (suggestions)

- **Shared part templates.** Author a canonical glove, fist, eye, boot, tooth once;
  reuse/adapt across fighters for consistency + speed. Keep in
  `assets/sprites/_parts/`.
- **Master palette file** (see §2) — single source of truth; re-tinting the game =
  editing one file.
- **`.aseprite` sources committed** — the PNGs are build output; the layered sources
  are the editable truth. Consider a tiny `tools/export_aseprite.py` to batch
  re-export all PNGs from sources.
- **Spritesheets + JSON** per fighter for a future animation system.
- **A "silhouette check"** step (render solid-black) in QA — if two fighters are
  indistinguishable as silhouettes, the design needs work (existing CLAUDE.md
  Golden Rule 8 / fighter-art rule).
- **Retire `_src/`** per fighter once its rebuild is signed off (regenerable, and we
  no longer depend on Gemini once we own the sprites).

## 6. Pilot + rollout

- **Pilot: Patty** (simplest everyman → seeds the master palette + proves the
  pipeline + per-fighter effort). Build all 14 Patty poses to hero quality, derive
  any palette/rule refinements back into this bible, get sign-off.
- **Rollout order** (simple → complex, most-seen early): Patty → **player** → Gus →
  Rosa → Kid → Tal → Magnus → Queen → Bishop → Iron → **Pawnchion** (champion last).
  Each fighter = its own reviewable batch (auto-base → hand-refine → QA on a
  checkerboard contact sheet → export + `.aseprite` + sign-off).

## 7. Definition of done (per fighter)

- All poses rebuilt to the §1 standard, on the master palette.
- Faces/signatures hand-clean; silhouette reads; materials contrast.
- PNGs exported to the game paths; layered `.aseprite` source committed; spritesheet
  exported.
- Reviewed on a checkerboard + at game scale (and, for key fighters, in-engine).
- `_src/<slug>` retired.
