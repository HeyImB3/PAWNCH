---
description: Add a new Story Mode opponent to the PAWNCH roster
argument-hint: [name] [elo] [difficulty 0-1]
---

Add a new fighter to the Story Mode roster in `src/opponents.js`.

Requested fighter: **$ARGUMENTS**

## How the roster works (read `src/opponents.js` first to confirm)

Each opponent is one entry in the `ROSTER` array:
`{ name, elo, hue, tag, d, sig }`

- `name` — display name (keep the chess/boxing pun energy, e.g. "Rosa Rookrush").
- `elo` — chess strength. The ladder climbs ~+200 per step and is **capped at
  2000**. Place the newcomer so the ladder stays roughly sorted by strength.
- `hue` — a key in the `HUE` map (e.g. `orange`, `blue`, `steel`). It sets the
  fighter's body/trim/skin colors so they read as a distinct 16-bit character.
- `tag` — a short flavor line shown on the nameplate.
- `d` — difficulty from **0 to 1**. This single number drives **all** boxing stats
  via `boxingFromDifficulty()` (telegraph, aggression, damage, dodge, signature…).
  Pick a `d` consistent with where they sit on the ladder.
- `sig` — the name of their big "signature" haymaker (ALL CAPS, punny).

## Steps

1. Read `src/opponents.js` and a few existing entries to match the style.
2. Insert the new entry at the right ladder position (or wherever the user asked).
3. If the requested `hue` isn't already in the `HUE` map, add a tasteful entry
   (`{ body, trim, skin }`) using palette-style colors (see `PAL` in
   `src/config.js`).
4. **Don't** touch `boxingFromDifficulty()` or the `OPPONENTS` mapping — this is a
   data-only change.
5. Tell the user to verify in Story Mode with `npm run dev`.

If the user didn't give a name, ELO, and difficulty, ask for them first.
