# CLAUDE.md — working on PAWNCH

PAWNCH is a **chess-boxing browser game** in a 16-bit retro style: each round is a
1-minute chess half then a 1-minute boxing half, and winning *either* half takes
the whole match. The game is **vanilla JavaScript (ES modules) with no build step
and no dependencies**. This file tells you (Claude) how to work in this repo. For
the player-facing overview and full feature list, see [`README.md`](README.md).

> ⚠️ **RELEASE BLOCKER — online multiplayer is broken.** The two clients desync
> (coin flip, chess moves, and the half timer drift apart). It **must be fully
> fixed and working before any Steam release.** Status, root cause, and next steps:
> [`docs/ONLINE_SYNC_TODO.md`](docs/ONLINE_SYNC_TODO.md); code marker `TODO(online-sync)` in `src/game.js`.

## Design pillars (read before tuning any gameplay)

These are *why* PAWNCH exists; the Golden Rules below enforce them. Trading one of
these away for a change that "feels nicer" is a regression, not a shortcut.

- **It's a skill game, and it's hard on purpose.** Patty (fight 1) is the only
  gentle tutorial — the ladder cliffs upward right after him and climbs to a
  near-perfect champion. Wins should feel *earned*. Never dumb down the AI to make a
  half feel better; fix the player's tools or the telegraphing instead.
- **You out-*read* opponents, you don't out-*mash* them.** The boxing half rewards
  timing, spacing, and the perfect parry — never punch spam. Mashing must stay
  actively punished (see the anti-mash Golden Rule).
- **Both halves carry equal weight.** Winning *either* the chess half or the boxing
  half wins the match, so neither can be ignored or auto-skipped — that's what the
  chess-skip HP cap defends.

## Run it / see your changes

The game is static ES modules, so it **must be served over `http://`** — never
opened as a `file://`:

```bash
npm run dev      # python3 -m http.server 5173   → open http://localhost:5173
npm start        # npx serve -l 5173 .   (Node only; use this if you don't have python3)
```

Then **click or press a key once** — browsers block audio until a user gesture.
For reliable reloads while editing, `python3 tools/devserver.py` serves with
no-cache headers. Online multiplayer also needs the relay: `npm run server`
(Node, `ws://localhost:8080`) — see [`docs/HOSTING.md`](docs/HOSTING.md).

There is **no build, bundler, or transpile step** — edit a file and reload the page.

## How it's built (the 30-second tour)

- **`src/game.js`** — the heart: the `Game` class runs the render loop, a small
  **state machine**, and the shared **`match` model** (board, clocks, HP, round,
  winner). The **win rules** live here in `resolveChess()` / `resolveBoxing()`.
- **Screens are "states"** in **`src/states/*.js`** — each is a class with optional
  `enter(game, params)`, `exit(game)`, `update(game, dt)`, `draw(game, ctx)`. They
  are listed in the `STATES` map in `game.js`; switch between them with
  `game.changeState('name')` (which plays an orange/blue wipe).
- **Everything draws to one 2D canvas** (512×448, pixel-crisp) via helpers in
  **`src/gfx.js`** (`text`, `panel`, `logo`, `bgGradient`, `boxer`, `piece`, `ring`,
  `barH`, `FX` particles…). Image smoothing stays **off**.
- **Subsystems:** `input.js` (remappable, edge-detected keys + pointer; the `input`
  singleton, used as `game.input`), `audio.js` (chiptune engine + `sfx` + songs),
  `save.js` (`localStorage`), `net.js` (`NetClient`, online play). **All tuning and
  the palette live in `src/config.js`.**
- **Chess brain** in `src/chess/`: `board.js` (full legal rules + FEN), `ai.js`
  (built-in alpha-beta `chooseMove`), `engine.js` (`bestMove()` tries Stockfish-WASM
  from a CDN, falls back to the built-in AI, with a humanized think time).
- **Boxing sim** in `src/boxing.js` (`BoxingMatch`) — Punch-Out-style read-and-react:
  telegraphed tells, perfect-parry staggers, best-of-3 knockdowns, get-up minigame.
- **Authored fighter sprites** (optional; override `fighter.js`'s procedural boxer):
  per-fighter **`boxerSets`** under `assets/sprites/boxers/<slug>/` (`front_<pose>.png`;
  player also `back_*`), mirroring chess `pieceSets`. `drawFighter` blits a registered
  sprite when `look.sprite` is set (via the `boxerKey` pose resolver), else falls back to
  procedural (Golden Rule 5). `FIGHTER.BOB` gives sprite fighters an idle weave; a landed
  enemy strike snaps to a held `punch` frame (`BOX.PUNCH_HOLD_MS`) so the hit-stop
  (`game.doFreeze`, ≤140ms) freezes the *punch*, not an idle frame.
- **Boss special spectacle** in **`src/specialfx.js`** — per-fighter chess-themed FX keyed
  by sprite slug (back layer: arena dim + giant ghost piece + lit board; front: shockwave +
  piece scatter + name stamp), drawn by the boxing state during a special. `registerSpecialFx(slug,…)`
  per fighter — all 10 are registered, each themed to their move (Rosa's charging rook, Iron's
  gears, Tal's hypnotic storm, …).
- **The living ring** (visual overhaul V1): `src/ring.js` (`RingView` — painted mat/post/
  pad/stool/press kit + dynamic ropes + accent-tinted turnbuckles + fight-memory decals,
  per-piece procedural fallback), `src/ropes.js` (pure rope-wave math, headless-tested),
  `src/lighting.js` (additive glow pass, knockdown spotlight, mat reflections, press-row
  flashbulbs, per-scene key light: `withRim` fighter rim + wash). Ring/arena art is
  painted by **`tools/paint_ring.py` / `tools/paint_beach.py`** (deterministic,
  master-palette-only via `tools/pawnch_palette.py` — see `docs/ART_BIBLE.md` v2);
  arena scenes add painted parallax layers via `manifest.json` `arenas` + a
  `drawLayered` on the scene (`scenery.js`; **all 11 arenas shipped**, painters in
  `tools/paint_<arena>.py`). Scene draws stay PURE functions of their params;
  the boxing state passes read-only `board`/`round` for the "live" arenas
  (chesshall wall-board, stadium jumbotron).
- **The chess broadcast panel + living portraits** (V4+V5): `states/chess.js`
  `_broadcastPanel` (painted chrome `ui/chesspanel.png` + `PANEL` config; legacy text
  panel = zero-asset fallback) and **`src/portrait.js`** (`PortraitFace`: material-driven
  moods, reaction pops on captures/checks, blinks, and PERSISTENT battle damage —
  `match.damage` accrues from boxing hits/knockdowns, tiers via `PORTRAIT` config,
  heals never fix faces). Portrait art: `tools/paint_portraits.py` (one 44×44 face RIG,
  all 11 characters; the rig contract is mirrored in portrait.js — change both together).
  QA harnesses: `tools/chess-preview.html`, `tools/portrait-preview.html`.

## Golden rules (don't break these)

1. **No build step, no dependencies, no framework.** Keep the game vanilla ES
   modules. If you're about to add an npm package, stop and reconsider.
2. **Tune from `src/config.js`.** Round structure (`MATCH`), boxing feel (`BOX`),
   AI think-time (`CHESS`), and the palette (`PAL`) all live there — don't scatter
   magic numbers through the code.
3. **Use the palette.** Pull colors from `PAL` (orange + blue brand). Don't hardcode
   hex in game/draw code.
4. **Draw through `gfx.js` helpers** and keep `imageSmoothingEnabled = false` (set
   once in `Game`). It's pixel art.
5. **Art & audio are procedural placeholders.** Don't commit binary assets. Real
   sprites load *optionally* through the manifest in `assets/sprites/` (see
   `loadAssets()` and `tools/sprite-gen.html`) — the game must still run with
   **zero** image files present.
6. **Match logic stays in `game.js`.** Win conditions, rounds, healing, and the
   chess↔boxing crossover belong in the `match` model and its `resolve*` methods.
7. **Match the surrounding style** — small, focused modules with short explanatory
   comments. Read the neighboring file before adding code.
8. **Opponents are tough on purpose — never flatten the curve.** Only Patty (fight
   1) is a real tutorial. `boxingFromDifficulty()` (`src/opponents.js`) lifts
   everyone after him onto a high band — effective difficulty starts at `FLOOR`
   (~0.68) for fight 2 and ramps to 1.0 at the champion, and `parrySkill` climbs
   alongside it. Changes must *preserve* this steep skill curve: if a tweak makes
   the mid-roster mashable or lets the champion be beaten without reading tells,
   that's a regression. Re-tune via `FLOOR` / the `mix()` endpoints / `parrySkill`
   — never by gutting the AI.
9. **You can't win the boxing half by mashing — keep it that way.** Every boxing
   change must keep offensive spam punished: the perfect parry (`BOX.PARRY` —
   window, `WHIFF_STAMINA`, `LOCKOUT_MS`, plus AI parry-reads driven by
   `parrySkill`) and the chess-skip cap (`MATCH.NO_MOVE_HP_CAP`) exist for exactly
   this. The ONE sanctioned mash is the get-up minigame (`BOX.GET_UP` — mash to beat
   the count); don't "fix" that one as if it were the bad kind.
10. **Art is held to a stream-release, professional bar — no "glued-on" work.** Every
    visual change must look like it was *always part of the same sprite*, never pasted
    on top. That means: match the sprite's own rendering — **soft, LANCZOS-feathered
    edges** (author detail at high res, then downscale — never a hard 1px cel outline
    on a painterly sprite), **one consistent light direction**, hue-shifted color
    **ramps** (not flat bands, no pure-black/# white), and a **contact / cast shadow**
    where a new element meets the body so it sits *on* it. Reach for the **highest-power
    tool available** and all relevant craft knowledge (the Gemini engine for in-style
    re-renders when billing is on — see `fighter-art`; the Aseprite/`pixel-mcp` pro
    tools + the `pixel-art-professional` skill for hand work). **Always design →
    preview on a checkerboard/magenta bg → verify the on-disk result before calling it
    done** (the Read tool renders transparency as white and lies). "Good enough" pixel
    art is a regression here.

## Common tasks

- **Add a Story Mode opponent** → use **`/new-opponent`** (edits the `ROSTER` in
  `src/opponents.js`). Difficulty `d` (0–1) drives every boxing stat via
  `boxingFromDifficulty()`, which compresses everyone after Patty into a high band
  (`FLOOR`) and scales `parrySkill` — so a new mid-roster fighter should still feel
  genuinely hard (see Golden Rule 8). ELO climbs ~+200/step, capped at 2000.
- **Build/refresh a fighter's sprite set** → the **Gemini pipeline** in `tools/` (needs
  `GEMINI_API_KEY` in gitignored `.env`, with **API billing enabled** — the free tier is 0
  for image gen). `gen_fighter.py <slug>` makes an idle **`_anchor`** to lock identity, then
  generates each pose conditioned on it (`--ref`); `slice_boxer.py <slug>` knocks out the
  white bg, removes enclosed white pockets, **LANCZOS**-downscales to the procedural canvas
  (150×216, feet@190, center@75), and writes `assets/sprites/boxers/<slug>/`. Register it:
  `manifest.json` `boxerSets` + a `SPRITE_SLUG` entry in `opponents.js`, plus
  `registerSpecialFx(slug, …)` in `specialfx.js` for the boss move. Art-direction is in
  `tools/fighter_prompts.py`; raw `_src/` generations are gitignored (regenerable).
  Per-fighter silhouette size lives in `slice_boxer.py` `BODY_H` (Patty small, Iron huge).
  Likeness fighters (Magnus/Tal) seed the anchor from a real photo via `--anchor-ref`
  (`gemini_image.py` handles webp/jpg). The PLAYER is built by **`gen_player.py`**: a front
  anchor → `back_<pose>` fight frames (back-to-camera, punches drive UP) + a few `front_`
  frames for win/round-break/walk-in.
- **Add a new screen / mode** → use **`/new-state`** (scaffolds the class and
  registers it in `game.js`).
- **Change how a fight feels** → `BOX` in `src/config.js` — incl. `BOX.PARRY` (the
  anti-mash perfect parry) and `BOX.GET_UP` (the knockdown/get-up minigame).
- **Change round / clock / heal rules** → `MATCH` in `src/config.js` plus the
  `resolve*` methods in `game.js`. Chess is ONE continuous per-player clock for the
  whole match (`CHESS_SECONDS` + `CHESS_INCREMENT_MS`, ticking only during chess
  halves); each half is windowed to `CHESS_HALF_SECONDS`; new rounds heal
  `HEAL_MIN..HEAL_MAX`; and skipping your chess move caps that round's boxing HP at
  `NO_MOVE_HP_CAP`.
- **Add or refresh a painted arena** → the V3 pattern: a `tools/paint_<arena>.py`
  painter (imports `tools/pawnch_palette.py`; far/mid/near 512×170 layers) →
  manifest `arenas` entry → an `L` knob block + `key` light on the scene in
  `SCENERY.SCENES` → a `drawLayered(ctx, p, layers)` on the scene in `scenery.js`
  (follow `SCENES.beach.drawLayered` structurally; the procedural `draw` stays as
  the zero-asset fallback). Every arena gets a reactive beat + one rare
  `t % PERIOD < DUR` event. QA in `tools/arena-preview.html`.
- **Tune portraits / battle damage** → `PORTRAIT` in `src/config.js` (damage
  tiers, reaction/blink timing). Expressions & faces: `tools/paint_portraits.py`
  — its 44×44 rig contract is mirrored in `src/portrait.js` (blink bar, emote
  anchors, overlay boxes): **change both together**. Damage accrues in
  `match.damage` from boxing hits/knockdowns and is never healed.
- **Add a sound** → `audio.js` (the `sfx` object / song data). Chiptune only — no
  audio files.

## Verifying a change

The **sim + rope-math** modules have a headless unit suite; everything visual is
verified by running the game:

- **Unit tests** (deterministic sim + `src/ropes.js`): `osascript -l JavaScript
  tools/test/run-headless.js "$PWD"` — expect `[TESTS] N passed, 0 failed`. Same
  suites run in-browser at `tools/test/index.html`; register new `*.test.js` in
  BOTH places.
- `npm run dev`, open the page, play the relevant mode. Story Mode and local hotseat
  work fully offline; online needs `npm run server`.
- Watch the browser **console**: the loop catches per-frame errors and logs
  `[PAWNCH] frame error: …`. Two debug handles are exposed — **`window.PAWNCH`**
  (the live `Game` + `match`) and **`window.CHESS`** (the chess board module).
- Quick sanity sweep: title loads → start a match → a full round advances
  (chess → boxing → round break) → a win is detected.
- **Ring / arena / lighting art**: `tools/arena-preview.html` on the dev server —
  scene picker, crowd slider, IMPACT / KNOCKDOWN / DECALS controls, plus headless-QA
  URL params (`?bare=1` zero-asset path, `?down=1`, `?crowd=NN`, `?scene=id`,
  `?tell=1` mock attack-banner readability, `?fxlow=1` LOW FX mode, `?perf=1`
  frame-time overlay — also in `tools/chess-preview.html` and the portrait grid
  `tools/portrait-preview.html`). Judge transparent PNGs only via
  `tools/check_alpha.py` (the Read tool renders alpha as white and lies).
  The Settings VIDEO tab has an **FX** row (FULL/LOW) gating the heavy passes.

## Gotchas

- **Audio is silent until the first click/keypress** (browser autoplay policy).
- **Online multiplayer is a known-broken RELEASE BLOCKER** — the two clients
  desync (coin flip, chess moves, half timer). Don't trust online sync until it's
  fixed: [`docs/ONLINE_SYNC_TODO.md`](docs/ONLINE_SYNC_TODO.md) + `TODO(online-sync)` in `src/game.js`.
  It needs the relay server, and the live HTTPS site needs a **`wss://`** URL in
  `NET.url` (`src/config.js`) — see `docs/HOSTING.md`.
- **Stockfish** loads from a CDN; offline it silently falls back to the built-in
  AI — don't assume it's present.
- Save data lives in `localStorage` under `SAVE_KEY` (`pawnch.save.v1`); bump the
  key if you change the save shape.
- The game is served by Python: `tools/devserver.py [port]` (default 5174, no-cache).
  Node **is** installed (homebrew) — `node --check <file>` works for syntax verification,
  but keep serving via Python and keep the game dependency-free. Headless page QA:
  Chrome's `--headless --screenshot` (see how tools/arena-preview.html is exercised).
  Story Mode is **dev-unlocked on `localhost`** (`DEV_UNLOCK` in `story.js`) so you
  can fight any opponent to review sprites; the shipped game keeps normal unlock and the save
  is untouched. Pose QA harness: `tools/fighter-preview.html`. Sprite tools live in `tools/.venv`.
- **AI image-gen continuity drifts** (gloves recolor, shoulder pauldrons vanish) — audit
  EVERY regeneration, especially after re-rolling the `_anchor`. Generate the flat-KO `down`
  pose WITHOUT the anchor (an upright anchor forces him vertical). Roster staging: enemies
  tower over the player (bottom-of-screen foreground), so heads/eyes/punches aim
  DOWN-AND-FORWARD at the player's head — never straight ahead, sideways, or at the floor. The
  Read tool shows PNG transparency as white — judge cutouts via the slicer's checkerboard montage.
- **Keep SHARED prompt scaffolding generic.** `fighter_prompts.py`'s `anchor_prompt`/`CONTINUITY`
  apply to EVERY fighter — never bake one character's features into them (a stray hardcoded "gold
  crown + rook-tower pauldrons" once forced the whole roster into the same cookie-cutter scheme).
  Per-character look belongs in that fighter's `IDENTITY` only; each fighter is a DISTINCT body
  type / silhouette / personality with the chess theme embodied + one signature nod.

## Pre-approved commands

`.claude/settings.json` pre-approves a short list of **safe** commands (the local
dev servers and read-only git) so routine actions don't prompt every time. Anything
that installs, writes, or is destructive is intentionally left out — adjust the
list to taste.
