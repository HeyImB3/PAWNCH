---
name: fighter-art
description: >-
  Create or fix a PAWNCH story-mode fighter's sprites and signature special-move spectacle,
  end-to-end: art-direct a distinct character, generate per-pose sprites with Gemini
  (idle anchor → poses; the player's back-view; real-photo likenesses), slice them to the
  game canvas, and wire them in. Use this whenever the user wants to add, create, redesign,
  or FIX any PAWNCH enemy / opponent / boxer / fighter / champion model, sprite, look, or
  special move — including "make a new fighter", "the Bishop sprite looks wrong", "redesign
  Iron", "give X a cooler special", or generating boxing character art — even if they never
  say the word "sprite". Pairs with the /new-opponent command, which sets the fighter's
  stats/difficulty; this skill is the LOOK.
---

# PAWNCH fighter art — create or fix a story-mode fighter

This skill turns a fighter's name + theme into finished, in-game sprite art (idle, guard,
wind-ups, punches, special, hurt, stagger, KO, walk) plus their chess-themed special-move
spectacle. It orchestrates the Python tools in `tools/` (the source of truth) — your job is
the art direction, the gotchas, and the integration, not reinventing the scripts.

**Read `tools/fighter_prompts.py` first** — that's where every fighter's `IDENTITY` lives and
where the shared `STYLE` / `FOCUS` / `CONTINUITY` / `POSE_DESC` scaffolding is defined. The
fighters you'll see there are your worked examples.

Pairs with `/new-opponent` (the kit/difficulty in `src/opponents.js`). This skill is the look.

---

## The rule that matters most: every fighter is a DISTINCT character

The single biggest failure mode here is a cookie-cutter roster — "muscular boxer + chess-piece
hat + trunks" nine times over. It is *boring* and it's the opposite of what makes Punch-Out's
cast great (Glass Joe and King Hippo are different *creatures*, not the same body in hats).

Before generating anything, the fighter must pass this checklist:

- **Distinct body type / silhouette.** Short & round? Wide fortress? Tall & lanky? A robot?
  If you can't tell two fighters apart as black silhouettes, redesign one.
- **One clear personality.** A con-man, a zealot, a diva, a machine, a mad genius.
- **Chess theme EMBODIED + ONE signature nod** — not a uniform chess hat. The piece's
  *character* drives the design; the nod is a single legible detail (Kid's fork, Rosa's
  fortress build, Iron = a machine). See `references/prompt-recipe.md`.
- **Still clearly a boxer** — gloves on, in the ring (even the robot wears gloves).
- **No crown / chess-hat / shoulder armor unless that specific fighter's `IDENTITY` says so.**
  (Only THE PAWNCHION, the king boss, earns the regal armor.)

If a redesign is the goal, lead with body type and personality in the `IDENTITY`, and say
explicitly what they do NOT have (e.g. "NO crown, NO helmet").

---

## Prerequisites (check once)

- **Gemini billing must be ON.** Image generation needs a paid Google AI Studio key in the
  gitignored `.env` as `GEMINI_API_KEY` (the free tier is `0` for image gen — a 429 with
  `limit: 0` means billing isn't enabled). Smoke-test: `tools/.venv/bin/python tools/gemini_image.py "a red 16-bit boxing glove, white background" /tmp/g.png`.
- **Tools run in `tools/.venv`** (Pillow). If missing: `python3 -m venv tools/.venv && tools/.venv/bin/pip install Pillow`.
- **No Node on this machine** — the game is served by Python; verify JS by loading the page.

---

## Workflow: add a new fighter

Pick a short lowercase **slug** (e.g. `iron`, `bishop`). Then:

### 1. Art-direct the look → add an `IDENTITY`

Add an entry to `IDENTITY` in `tools/fighter_prompts.py`. Write it as a vivid *character*,
following the checklist above. Keep the shared `STYLE`/`FOCUS`/`CONTINUITY` **generic** — never
bake one fighter's features into them (this is the bug that made the whole roster same-y;
see Gotchas). Full recipe + examples: **`references/prompt-recipe.md`**.

### 2. Generate the sprites

```bash
tools/.venv/bin/python tools/gen_fighter.py <slug>
```
This makes an idle **`_anchor`** (locks identity), then generates each pose conditioned on it
(`--ref`) so the character stays consistent. Output: `assets/sprites/_src/<slug>/` (gitignored).
- **Real-person likeness** (e.g. a Magnus/Tal homage): seed the anchor from a photo —
  `gen_fighter.py <slug> --anchor-ref "assets/Fighter ref/<photo>"` (crop out other people first).

### 3. Slice + QA

```bash
tools/.venv/bin/python tools/slice_boxer.py <slug>
```
Knocks out the white background, removes enclosed white pockets, **LANCZOS**-downscales to the
procedural canvas (150×216, feet on row 190, centered on col 75), and writes
`assets/sprites/boxers/<slug>/front_<pose>.png`. Set the fighter's on-screen size in
`slice_boxer.py` `BODY_H[<slug>]` (Patty small, Iron huge) so silhouettes differ in the ring.

**Always eyeball the result on a checkerboard** (the Read tool shows transparency as white, so
it lies). Build a contact sheet of the `_src` frames and view it; confirm: consistent character,
distinct poses, downward-aimed punches, a flat KO, clean cut-outs, no trapped white, no drift.

### 4. Wire it into the game

- `src/opponents.js` — add the slug to `SPRITE_SLUG` (`<index>: '<slug>'`).
- `assets/sprites/manifest.json` — add `"<slug>": "boxers/<slug>"` under `boxerSets`.
- That's it: `drawFighter` prefers the registered sprite (via `look.sprite` + the `boxerKey`
  resolver) and falls back to procedural per missing frame, so it's a safe drop-in.

### 5. Give it a special-move spectacle

Add `registerSpecialFx('<slug>', fn)` in `src/specialfx.js`, themed to the fighter's special
move (Rosa's charging rook, Iron's gears, Tal's hypnotic storm…). Use the shared helpers
(`dim`/`halo`/`shock`/`scatter`/`stamp`) and the `pawnchion` CHECKMATE function as the template:
a `back` layer behind the fighter (arena dim + a giant ghost piece + themed energy) and a
`front` layer over everything (shockwave + piece scatter + a name stamp). The boxing state
dispatches by slug automatically. Recipe: `references/prompt-recipe.md` (Special FX section).

### 6. Verify in-game

Serve with `python3 tools/devserver.py 5174`. Story Mode is **dev-unlocked on localhost**
(`DEV_UNLOCK` in `src/states/story.js`) so you can pick any fighter. To jump straight to the
boxing half, in the console:
`const {OPPONENTS}=await import('/src/opponents.js'); PAWNCH.startMatch({mode:'story',opponent:OPPONENTS[<i>]}); PAWNCH.changeState('boxing')`.
Watch for: right size next to the player/ropes, punches landing, the special spectacle on a
signature, console clean. Also `tools/fighter-preview.html` shows all poses at once.

---

## Refining / fixing an existing fighter

This is the common case (a sprite "didn't hit the mark"). Re-roll only what's wrong — the
anchor (and so the identity) is preserved:

```bash
tools/.venv/bin/python tools/gen_fighter.py <slug> --only jabL,jabR,special   # specific poses
```
- To change the **character/look**, edit that fighter's `IDENTITY`, delete its `_anchor.png`,
  then regenerate (the anchor re-rolls). **Audit the whole set afterward** — a new anchor can
  drift other details.
- To fix a single bad pose's look, edit its `POSE_DESC` (shared across all fighters — change
  carefully) or use `--only`.
- Re-slice (`slice_boxer.py <slug>`) and re-view on the checkerboard after every change.

---

## Gotchas (hard-won — don't relearn these)

- **Keep the SHARED scaffolding generic.** `anchor_prompt` / `CONTINUITY` apply to EVERY
  fighter. A stray hardcoded "gold crown + rook-tower pauldrons" once forced the *entire*
  roster into the same scheme. Per-character look belongs in that fighter's `IDENTITY` only.
- **AI drifts on every re-roll** — gloves recolor, details vanish/appear, a stray crown sneaks
  in. Audit the full contact sheet after *any* regeneration, especially after a new anchor.
- **Generate the KO `down` pose WITHOUT the anchor** — an upright anchor refuses to lie flat.
  (gen_fighter conditions on the anchor; for a stubborn `down`, generate it standalone with
  `gemini_image.py` describing a side-on figure lying flat, then re-slice.)
- **Staging:** enemies tower over the player (who is in the bottom-of-screen foreground), so
  heads/eyes/punches aim **down-and-forward at the player's head** — never straight ahead,
  sideways, or at the floor. The player is the reverse: back-to-camera, punching UP.
- **NEAREST destroys detail when shrinking** a 1024px source — the slicer uses LANCZOS so
  eyes/teeth survive. Don't switch it back.
- **One failed pose aborts a fighter's run** (a transient API error raises and stops). If you
  get only 1 frame, just re-run; the anchor is reused.

## Deep dive

For the full prompting recipe — how to write a great `IDENTITY`, the staging/continuity
language and *why* it's shaped that way, likeness conditioning, the per-pose `POSE_DESC`, and
designing a special-FX function — read **`references/prompt-recipe.md`**.
