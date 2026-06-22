# Fighter Art Overhaul — Gemini Sprite Pipeline

- **Date:** 2026-06-22
- **Status:** Approved (design); pending spec review → implementation plan
- **Owner:** ssmolak + Claude
- **Branch:** `feat/fighter-art-overhaul`

## Context

The chess pieces in PAWNCH look professional (a 9/10) because they are **authored
raster art**: a Gemini-generated showcase sheet (`assets/sprites/MK3.png`) sliced by
`tools/slice_mk3.py` into transparent PNGs that `gfx.js` blits via the manifest
(`assets/sprites/celestial/*`, `arcane/*`). The **boxers look like a 2/10** because they
are the opposite — drawn live from geometric primitives in `src/fighter.js` (ellipse
heads, `quadraticCurveTo` torsos, round-cap line arms). No amount of tuning makes
assembled primitives read as characters.

This overhaul replaces the procedural mannequins with authored sprite frames at the
**same fidelity as the chess set**, using the **same proven pipeline** (Gemini → slice →
manifest → blit). The procedural renderer is **kept as the zero-asset fallback**, so the
game still runs with no image files present (Golden Rule 5).

The user's quality bar: NES/SNES *Punch-Out* — chunky proportions, bold outlines, strong
character and comedy — executed at the premium fidelity of the chess pieces. THE
PAWNCHION (the end boss) must read as a genuine badass champion, not a mascot.

## Goals

- Authored sprite frames for fighters, blitted over the procedural fallback.
- Per-fighter visual identity (11 roster fighters + the player), consistent across poses.
- Release-grade: no jitter, readable at in-game blit size, palette-coherent with the brand.
- Reuse the proven Gemini → slice → manifest pipeline; no new shipped dependencies.
- Preserve every Golden Rule (esp. #5 procedural fallback, #2 tuning in config, #3 palette).

## Non-goals (this spec)

- Re-doing the chess pieces (already good).
- Player-appearance customization / character creator for multiplayer (future).
- Changing boxing *gameplay*, AI, or match rules (`boxing.js`, Golden Rules 8–9 untouched).
- New in-between/skeletal animation system — we ship key frames + the engine's existing
  `lean/sink/bob/step` tweening, and add light 2-frame cycles only in the polish phase.

## Production pipeline (hybrid)

Per fighter, repeat:

1. **Prompt** — I art-direct one prompt per fighter, pulling identity from the existing
   `LOOKS`/`HUE`/roster data in `src/opponents.js` (proportions, palette, headgear,
   emblem, special move, flavor tag).
2. **Generate** — I drive the **Gemini API** (`GEMINI_API_KEY` in `.env`) to produce
   **one pose-sheet in a single image** so the model holds the character consistent across
   all poses (the trick the previous attempt lacked). Fallback if a grid drifts: generate
   an idle reference, then image-edit it into each pose.
3. **Curate** — the user reviews the sheet / QA montage and approves or requests a redo
   (the "hybrid": I generate + QA, user is final art director).
4. **Slice** — a boxer slicer (evolved from `slice_mk3.py`) knocks out backgrounds,
   keeps the largest blob, feathers, and **normalizes every frame to a shared canvas with
   feet on a constant baseline**, exporting per-pose PNGs.
5. **Integrate** — manifest entry + the engine prefers the sprite, falls back to
   procedural per missing frame. Tune placement/scale/timing in-engine to release quality.

## Art-direction spec (the look)

- **Frame canvas:** fixed **192×256** px, transparent background, **feet locked to a
  constant baseline row** so frames never jitter relative to the engine's feet-anchored
  blit. (Final number confirmed during Phase 1 against `FIGHTER.SIZE`/`*_FEET_Y`.)
- **Outline:** bold dark outline matching `FIGHTER.OUTLINE`.
- **Palette:** anchored on each fighter's `HUE` (body/trim/skin from `opponents.js`),
  a tight 2–3 step shade ramp, brand orange/blue accents; coherent with the chess set.
  Optional palette-quantization pass in the slicer for crispness.
- **Proportions/character:** Punch-Out exaggeration; silhouette-first readability.
- **THE PAWNCHION:** hulking amalgam-crowned chess-king champion — champ orange body,
  blue trim, gold accents, menacing stance, true final-boss presence.

## Pose set & sprite-key resolver

Every fighter is drawn through the single chokepoint
`drawFighter(ctx, x, y, size, look, pose, facing, step, info)` (and `drawPortrait`).
`facing` is `1` (front / opponents) or `-1` (back / player). `info` carries
`{ arm:'L'|'R', kind:'jab'|'hook'|'signature', target:'high'|'low' }`.

A small resolver maps `(facing, pose, info)` → sprite key:

| engine pose            | sprite key (per facing) |
| ---------------------- | ----------------------- |
| `idle`                 | `idle`                  |
| `guard`                | `guard`                 |
| `windup` (arm L / R)   | `windupL` / `windupR`   |
| `punch` jab (L / R)    | `jabL` / `jabR`         |
| `punch` hook (L / R)   | `hookL` / `hookR`       |
| `punch`/`special` signature | `special`          |
| `special`              | `special`               |
| `duck`                 | `duck`                  |
| `hurt`                 | `hurt`                  |
| `stagger`              | `stagger`               |
| `down`                 | `down`                  |
| `walk`                 | `walk`                  |

Registry key = `` `${facing===-1?'back':'front'}:${spriteKey}` ``.

- **Opponents** are only ever drawn front-facing → need the **front** set (~14 frames).
- **The player** is drawn **back** in fights and **front** on win/round-break/walk-in
  screens → needs **back + front** sets.
- A missing frame for any pose → that pose falls back to procedural for that fighter only.

## Engine integration

The current `SPRITES.boxers` registry is keyed only by `front|back:pose` — it assumes
**one** boxer appearance. Fighters are distinct, so we mirror the **pieceSets** pattern:

1. **`gfx.js`** — add `SPRITES.boxerSets = {}`, `registerBoxer(set, key, img)`, and a
   lookup helper. `set` is a per-fighter slug.
2. **`fighter.js`** — `drawFighter`/`drawPortrait` derive the set slug from
   `look.sprite`, look up `SPRITES.boxerSets[slug][regKey]`, blit at the existing
   center-x / feet-y / size geometry, and **fall back to the procedural `render()`** when
   the frame is absent. No other call site changes.
3. **`opponents.js`** — add a `sprite` slug to each resolved `look` (e.g. fighter index →
   slug like `pawnchion`); `HERO_LOOK.sprite = 'player'`; `DEFAULT_LOOK` leaves it unset
   (procedural) or `default`.
4. **`assets.js`** — load `manifest.boxerSets` (`slug → dir`), mirroring `pieceSets`:
   for each set dir, try each `<regKey>.png` (missing files stay procedural).

### Asset layout & manifest

```
assets/sprites/boxers/<slug>/front_idle.png, front_guard.png, front_windupL.png,
   front_windupR.png, front_jabL.png, front_jabR.png, front_hookL.png, front_hookR.png,
   front_special.png, front_duck.png, front_hurt.png, front_stagger.png,
   front_down.png, front_walk.png            # player set also adds back_*.png
```

```json
{
  "pieceSets": { "celestial": "celestial", "arcane": "arcane" },
  "boxerSets": { "pawnchion": "boxers/pawnchion" }
}
```

(Filenames use `_`; registry/manifest keys use `:`. Legacy flat `manifest.boxers` may
remain for a single PVP-default appearance.)

## Scope & sequencing

- **Phase 1 — vertical slice (now): THE PAWNCHION.** Front-facing, full pose set:
  prompt → generate → curate → slice → wire `boxerSets` + resolver + manifest →
  integrate → tune in a real fight to release quality. Proves the entire pipeline and the
  quality bar end to end.
- **Phase 2 — rest of the roster** (front sets), one fighter per sheet.
- **Phase 3 — the player** (back set for fights + front set for win/break/walk) and the
  PVP default appearance.
- **Phase 4 — polish:** 2-frame idle breathe, 2-frame walk, dedicated portraits,
  hit-react timing.

## What's committed / Golden Rules

- **Committed:** generation + slice scripts (text), sliced PNGs (as the pieces already
  are), manifest entries, the per-fighter `sprite` slugs.
- **Not committed / not shipped:** `.env`, the Gemini SDK, Pillow — all dev tooling.
- Golden Rule 5: game still runs with zero image files (procedural fallback intact).
- Golden Rule 2/3: sizes/baselines stay in `config.js` `FIGHTER`; colors from `PAL`/`HUE`.
- Golden Rules 6/8/9: no match-logic, AI, or anti-mash changes.

## Risks & mitigations

- **Character consistency across poses** → single-sheet generation; reference-conditioned
  edits as fallback; user curation gate.
- **Frame jitter** → fixed canvas + feet-baseline normalization in the slicer.
- **Readability at blit size** → chunky silhouettes; QA montage rendered at the actual
  in-game scale, not just 1:1.
- **Credential** → verified working as an AI Studio API key (HTTP 200, 2026-06-22).
  Available image models include `gemini-3-pro-image`, `gemini-2.5-flash-image`, and
  `imagen-4.0-ultra-generate-001`; final model chosen by a Phase 1 quality bake-off.
- **Disk (31 GB free) / API cost** → PNGs are tiny; no local model; API runs a few dollars.

## Open questions (resolved or deferred)

- Generation mode: **Hybrid** (I drive API + QA; user approves finals). ✓
- First target: **THE PAWNCHION**. ✓
- Exact canvas px and per-pose count: finalized in Phase 1 against `FIGHTER` config.
- Hook vs jab windup distinction: single `windupL/R` for v1; split later if needed.
- Generation model (`gemini-3-pro-image` vs `gemini-2.5-flash-image` vs `imagen-4.0`):
  decided by a quick Phase 1 quality bake-off on THE PAWNCHION.
