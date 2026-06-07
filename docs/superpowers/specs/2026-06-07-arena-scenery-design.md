# PAWNCH — Arena Scenery + Unlockable Backdrops (design spec)

Date: 2026-06-07
Status: approved scene-map; design under review

## 1. Summary

Add a unique, lightly-animated **arena backdrop** behind the boxing ring for each
of the 10 Story-mode fighters, each with a scene-appropriate **audience** that
moves a little so the arena feels alive. Beating a fighter in their arena
**unlocks** that arena; unlocked arenas are selectable from the Settings menu for
use in **multiplayer** (local hotseat + online) — the same earn-then-pick pattern
already used for the unlockable chess sets (`arcanePieces` / `pieceSet`).

All art is **procedural** (no asset files), drawn to the existing 512×448 canvas in
the game's 16-bit style, and **tunable from `config.js`**. This is a large visual
update; fidelity is intentionally restrained for a first pass ("tune later").

## 2. Goals / non-goals

**Goals**
- One distinct arena per fighter (10), plus a built-in **Classic Ring** that
  reproduces today's look (default + fallback, always available).
- Every arena animates subtly (wind / water / light / drifting motes) and carries
  an animated audience (literal crowd *or* scene-native: jellyfish, astronauts,
  dream-silhouettes, seated monks/players, etc.).
- Earn-then-pick unlocks mirroring the chess-set system, exposed in Settings.
- No regression to ring readability, framerate, or the no-asset guarantee.

**Non-goals (this pass)**
- Chess-half scenery (boxing half only — "behind the ring").
- Shipping real pixel-art PNGs (the optional sprite manifest can layer art on top
  later; the game must still run with zero image files).
- Per-arena music / SFX.
- Letting the player override the opponent's arena *in Story* (Story is always the
  opponent's arena by design).

## 3. Scene → fighter map (approved)

Indexed by `OPPONENTS[i].index`:

| idx | Fighter          | hue    | Scene id    | Arena name            | Audience (animated)                         |
|-----|------------------|--------|-------------|-----------------------|---------------------------------------------|
| 0   | Patty Pushwood   | orange | `beach`     | Tropical Beach        | beach-goers on the sand; gulls; palm sway   |
| 1   | Gus Gambit       | green  | `woods`     | Spooky Woods          | hooded onlookers; fireflies; floating candles|
| 2   | Rosa Rookrush    | red    | `cyber`     | Cyberpunk Night Street| sidewalk crowd under neon; hover-traffic    |
| 3   | Kid Knightmare   | blue   | `dream`     | Dream World           | drifting dream-spectator silhouettes        |
| 4   | Bishop Bruiser   | purple | `temple`    | Mountaintop Temple    | rows of seated monks; prayer flags          |
| 5   | Queen Quake      | pink   | `castle`    | Castle in the Sky     | balcony courtiers; circling birds           |
| 6   | Iron Endgame     | steel  | `space`     | Deep Space Station    | floating astronauts in a viewing gallery    |
| 7   | Tal Tempest      | teal   | `abyss`     | Underwater Cave       | jellyfish + fish schools (= the crowd); fires|
| 8   | Magnus Maximus   | gold   | `chesshall` | Grand Chess Hall      | seated players at many lit boards           |
| 9   | THE PAWNCHION    | champ  | `stadium`   | Mega Stadium          | massive tiered crowd doing the WAVE; jumbotron|

Plus `classic` — the current ring backdrop (default; always unlocked).

Defined once as `SCENERY.OPPONENT_SCENES` (config), index-aligned to the roster:
`['beach','woods','cyber','dream','temple','castle','space','abyss','chesshall','stadium']`.

## 4. Architecture

### 4.1 New module: `src/scenery.js`
- Exports `drawScene(ctx, id, { W, floorTop, t, crowd, accent })` and
  `SCENES` (id → { name, draw }), plus `SCENE_ORDER` for the Settings cycler.
- Each scene `draw(ctx, p)` renders **only the backdrop region** (roughly `y` in
  `0..floorTop`, with freedom to spill a little behind the apron). It is a **pure
  function of `t` and `crowd`** — no retained state — so it is resume/await-safe
  and cheap. `accent` (the fighter hue) is available for tinting where a scene
  wants to echo the fighter.
- Helper kit local to the module (tiered-crowd band, twinkle field, drifting
  sprite, flame flicker, water caustics) so individual scenes stay short, in the
  spirit of the small focused helpers in `gfx.js`.
- `classic` scene reproduces the current `ring()` backdrop (gradient + two
  spotlights + 3 tiered crowd bands + accent wash) so it is pixel-equivalent to
  today when no scene is chosen.

### 4.2 Refactor `gfx.js` `ring()`
Split today's monolithic `ring()` into two concerns:
- `ring()` keeps drawing the **physical ring** (apron, perspective canvas, ropes,
  corner posts/turnbuckles, center emblem) — always drawn on top of a scene.
- The **backdrop** portion (arena gradient, overhead spotlights, tiered crowd,
  crowd flare) moves into the `classic` scene in `scenery.js`.
- `ring()` gains no new behavior beyond no longer painting its own backdrop; the
  boxing state draws the scene first, then `ring()`.

### 4.3 Integration in `src/states/boxing.js`
In `draw()`, before `ring(...)`:
```js
const sceneId = sceneFor(this.m, game.save);
drawScene(ctx, sceneId, { W, floorTop: 170, t: this.t, crowd: this.crowd, accent: this.accent });
ring(ctx, W, H, { floorTop: 170, accent: this.accent, crowd: this.crowd });
```
`sceneFor(match, save)`:
- `story` → `SCENERY.OPPONENT_SCENES[match.opponent.index]` (forced).
- `pvp` local → `save.settings.arena` (validated against unlocked; else `classic`).
- `pvp` online → arena id received from host at match start (see 4.5); fallback to
  local `save.settings.arena`, then `classic`.

### 4.4 Save schema (`src/save.js`) — additive, no key bump
```js
unlocks: {
  arcanePieces: false,
  arenas: {},            // { [sceneId]: true } for unlocked opponent arenas
},
settings: {
  ...,
  arena: 'classic',      // selected multiplayer arena id
},
```
On `load()`, after the existing hygiene:
- **Retro-grant**: for every beaten fighter (`i < storyProgress`), set
  `unlocks.arenas[OPPONENT_SCENES[i]] = true` (mirrors the `arcanePieces`
  retro-grant). `classic` is always considered unlocked (not stored).
- **Validation**: if `settings.arena` is not `classic` and not currently unlocked,
  fall back to `classic` (mirrors the `pieceSet` fallback).
`deepMerge` already seeds the new fields for old saves; `SAVE_KEY` stays `…v1`.

### 4.5 Unlock granting (`src/states/matchend.js`)
On a Story win (next to the existing progress/`arcanePieces` block), unlock the
beaten opponent's arena idempotently:
```js
const scene = OPPONENT_SCENES[this.m.opponent.index];
if (scene && !game.save.unlocks.arenas[scene]) {
  game.save.unlocks.arenas[scene] = true;
  this.unlockedArena = SCENES[scene].name;   // for a "NEW ARENA UNLOCKED" toast
}
```
Surface the unlock on the match-end screen (same beat as the Arcane unlock toast).

### 4.6 Online sync (cosmetic)
`net.js` / match setup sends the host's chosen `arena` id once at match start so
both clients render the same backdrop. Backdrop is purely cosmetic and outside the
deterministic chess path, so a missed/owner-mismatched id simply falls back to
`classic` — never affects gameplay. (Boxing netcode is beta; this rides along with
existing match-start metadata.)

### 4.7 Settings UI (`src/states/settings.js`, DISPLAY tab)
Add an **ARENA** row beneath **PIECES**:
- Shows the selected arena's name; cycles through `['classic', …unlocked]` on
  left/right/Enter (same `_cyclePieceSet` pattern → `_cycleArena`).
- Hint line shows how many arenas are unlocked / how to unlock more
  ("WIN A FIGHT TO UNLOCK ITS ARENA").
- Selecting persists `settings.arena` and is used by PVP/online immediately.
- `_rows()` for `tab === 2` becomes `['SCANLINES','SCALE','PIECES','ARENA','BACK']`.

## 5. Config / tuning (`src/config.js`)
New `SCENERY` block centralizes everything tunable (Golden Rule 2):
```js
export const SCENERY = {
  OPPONENT_SCENES: ['beach','woods','cyber','dream','temple','castle','space','abyss','chesshall','stadium'],
  CROWD_BANDS: 3,           // shared tiered-crowd depth
  CROWD_FLARE: 0.45,        // how much `crowd` brightens audiences on big hits
  ANIM_SCALE: 1.0,          // global multiplier on ambient motion speed (easy dial)
  // per-scene palettes + density/speed knobs (jellyfish hue, neon colors,
  // candle count, wave speed, star count, …) live here so draw code holds no
  // magic numbers / raw hex.
  SCENES: { beach: {...}, woods: {...}, /* … */ },
};
```
Brand colors remain in `PAL`; arena-specific colors live in `SCENERY.SCENES`
(new, non-brand colors) so `PAL` isn't polluted and draw code stays data-driven.

## 6. Per-scene catalog (first-pass content)
Each scene: a layered backdrop (sky/ground gradient), 2–4 ambient elements, and an
audience layer. Target ≈ a few dozen primitive draws/frame.

- **classic** — current arena gradient, 2 spotlights, 3 tiered crowd bands, accent wash.
- **beach** — sky→sea→sand gradient; shimmering sun; rolling surf line; 2 swaying
  palms; sand-level crowd dots; occasional gull.
- **woods** — dark green gradient; tree-trunk silhouettes; bobbing floating candle
  flames; twinkling fireflies; hooded onlooker silhouettes; low fog band.
- **cyber** — night gradient; building silhouettes; flickering neon billboards
  (magenta/cyan/gold/violet); sidewalk crowd; rain streaks; distant hover-lights.
- **dream** — slowly hue-shifting pastel gradient; soft blurred clouds; floating
  rotating shapes; drifting translucent spectator silhouettes; sparse stars.
- **temple** — twilight peak gradient; distant peaks; temple roof + columns;
  fluttering prayer flags; rows of seated monks; drifting cloud/incense bands.
- **castle** — bright sky gradient; parallax drifting clouds; floating keep + two
  towers (gentle bob); waving banners; balcony courtier dots; circling birds.
- **space** — starfield radial gradient; twinkling stars; ringed planet; drifting
  nebula; station viewing gallery with floating astronaut silhouettes.
- **abyss** — deep teal gradient; cave-rock silhouettes; flickering little fires;
  rising glowing jellyfish (the crowd) + fish schools; rising bubbles; caustics.
- **chesshall** — grand hall gradient; tall windows; columns; swaying chandeliers;
  rows of wooden tables with tiny lit boards/pieces; seated players' heads turning.
- **stadium** — deep-blue bowl; flaring stadium lights; 3 tiered crowd bands doing
  a phase-offset WAVE; central jumbotron ("PAWNCH"); falling confetti; ring floor.

## 7. Golden-rule compliance
- **GR1** no build/deps/framework — pure ES module + canvas.
- **GR2** all tuning in `config.js` (`SCENERY`).
- **GR3** brand colors from `PAL`; arena colors namespaced in `SCENERY.SCENES`.
- **GR4** draw via canvas with `imageSmoothingEnabled = false`; new helpers live
  beside `gfx.js`/in `scenery.js`.
- **GR5** procedural placeholders; **zero** image files required; optional asset
  manifest can override later.
- **GR6** match/win/unlock logic stays in the match model + `matchend.js`
  (`storyProgress`-driven), consistent with `arcanePieces`.
- **GR7/GR8/GR9** purely cosmetic — no change to AI, difficulty curve, parry, or
  the anti-mash systems.

## 8. Performance
- Scenes are stateless per-frame functions; budget ≈ a few dozen fills/arcs each.
- Reuse gradients where cheap; avoid per-frame `createRadialGradient` storms (cap
  glow gradients per scene). Animation derived from the existing `this.t` clock.
- `SCENERY.ANIM_SCALE` and per-scene density knobs let us dial cost down globally
  if any device struggles.

## 9. Verification (no automated suite)
- `npm run dev` (python http.server), play each Story fight; confirm the right
  arena renders behind the ring, audience + ambient motion animate, ring stays
  readable, no `[PAWNCH] frame error`.
- Beat fight 1 → confirm its arena unlocks; check Settings → DISPLAY → ARENA now
  lists it and cycling persists; start a local PVP match and confirm the chosen
  arena renders.
- Confirm `classic` is pixel-equivalent to today's ring (A/B against `main`).
- Confirm an old save (pre-`arenas`) loads, retro-grants beaten fighters' arenas,
  and never selects a locked arena.
- Smoke via `window.PAWNCH` per the project's live-test workflow (no screenshot
  verification).

## 10. Open / deferred decisions
- Default multiplayer arena before any unlock = `classic` (decided).
- Online arena = host's pick, cosmetic fallback to `classic` (decided).
- Real pixel-art PNGs + per-arena music = future passes (deferred).
