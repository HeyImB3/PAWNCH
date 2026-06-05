# CLAUDE.md — working on PAWNCH

PAWNCH is a **chess-boxing browser game** in a 16-bit retro style: each round is a
1-minute chess half then a 1-minute boxing half, and winning *either* half takes
the whole match. The game is **vanilla JavaScript (ES modules) with no build step
and no dependencies**. This file tells you (Claude) how to work in this repo. For
the player-facing overview and full feature list, see [`README.md`](README.md).

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
- **Boxing sim** in `src/boxing.js` (`BoxingMatch`) — Punch-Out-style.

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

## Common tasks

- **Add a Story Mode opponent** → use **`/new-opponent`** (edits the `ROSTER` in
  `src/opponents.js`). Difficulty `d` (0–1) drives every boxing stat; ELO climbs
  ~+200/step, capped at 2000.
- **Add a new screen / mode** → use **`/new-state`** (scaffolds the class and
  registers it in `game.js`).
- **Change how a fight feels** → `BOX` in `src/config.js`.
- **Change round / clock / heal rules** → `MATCH` in `src/config.js` plus the
  `resolve*` methods in `game.js`.
- **Add a sound** → `audio.js` (the `sfx` object / song data). Chiptune only — no
  audio files.

## Verifying a change

There is **no automated test suite** — verify by running the game and exercising
the change:

- `npm run dev`, open the page, play the relevant mode. Story Mode and local hotseat
  work fully offline; online needs `npm run server`.
- Watch the browser **console**: the loop catches per-frame errors and logs
  `[PAWNCH] frame error: …`. Two debug handles are exposed — **`window.PAWNCH`**
  (the live `Game` + `match`) and **`window.CHESS`** (the chess board module).
- Quick sanity sweep: title loads → start a match → a full round advances
  (chess → boxing → round break) → a win is detected.

## Gotchas

- **Audio is silent until the first click/keypress** (browser autoplay policy).
- **Online multiplayer** needs the relay server, and the live HTTPS site needs a
  **`wss://`** URL in `NET.url` (`src/config.js`) — see `docs/HOSTING.md`. The
  boxing netcode is **beta** (local-authority relay); chess sync is deterministic
  and solid.
- **Stockfish** loads from a CDN; offline it silently falls back to the built-in
  AI — don't assume it's present.
- Save data lives in `localStorage` under `SAVE_KEY` (`pawnch.save.v1`); bump the
  key if you change the save shape.

## Pre-approved commands

`.claude/settings.json` pre-approves a short list of **safe** commands (the local
dev servers and read-only git) so routine actions don't prompt every time. Anything
that installs, writes, or is destructive is intentionally left out — adjust the
list to taste.
