---
description: Scaffold a new game screen ("state") and wire it into PAWNCH
argument-hint: [stateName] (e.g. credits, shop)
---

Create a new screen/"state" for PAWNCH and register it. Target: **$ARGUMENTS**

PAWNCH screens are small classes in `src/states/`. Read an existing one first
(e.g. `src/states/title.js`) and `src/game.js` to match the pattern exactly.

## The state interface

A state is a class exported from its own file. Implement any of:

- `enter(game, params)` — set up when the screen opens
- `exit(game)` — tear down when leaving
- `update(game, dt)` — per-frame logic; read input via `game.input`
  (`game.input.pressed('confirm')`, `'up'`, `'down'`, `'cancel'`, … — see
  `DEFAULT_BINDINGS` in `src/input.js` for the available action names)
- `draw(game, ctx)` — render via `src/gfx.js` helpers (`text`, `panel`, `logo`,
  `bgGradient`, …) using colors from `PAL` (`src/config.js`). Keep it pixel art.

## Steps

1. Read `src/states/title.js` (a simple example) and the `STATES` map +
   `setState`/`changeState` in `src/game.js`.
2. Create `src/states/<name>.js` exporting `class <Name>State` with at least
   `enter`, `update`, and `draw`.
3. Register it in `src/game.js`: import the class and add it to the `STATES` map
   under a lowercase key (e.g. `credits: CreditsState`).
4. Wire navigation **to** it with `game.changeState('<name>')` from wherever it
   should be reachable (often a new menu item in `src/states/title.js`), and let
   the user leave it again (e.g. a `cancel`/back press returns to the prior screen).
5. Use `audio.sfx` for menu blips if it's interactive, and pull every color from
   `PAL`.
6. Tell the user how to reach the new screen and to verify with `npm run dev`.

Keep it minimal and consistent — no new dependencies, and any tunable numbers go
in `src/config.js`.
