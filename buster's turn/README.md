# buster's turn — editable sprite sources (working folder)

Hand-editing copies of every fighter's sprites, as **Aseprite** files. This folder is
**not loaded by the game** — it's a working/transfer folder (synced via git so it moves
between machines). **Remove it before the Steam release.**

## What's here
One `.aseprite` per fighter (10 enemies + Bishop + the player):
`patty, gus, rosa, kid, bishop, queen, iron, tal, magnus, pawnchion` (14 frames each)
and `player` (18 frames — its `back_` poses + the `front_` ones).

- Each **pose is a frame**, and each frame is **tagged with its pose name**
  (idle, guard, walk, windupL/R, jabL/R, hookL/R, duck, hurt, stagger, special, down).
- Game size **150×216**, RGB, single layer "Layer 1", transparent background.
- Generated **byte-identical** from the live game sprites in
  `assets/sprites/boxers/<fighter>/` — so you're drawing on exactly what ships.

## Getting your edits back into the game
The frames map 1:1 to the game PNGs by tag name. When you've edited a fighter:
- **Easiest:** tell Claude "pull buster's turn edits back into the game" and it'll
  re-export each frame to `assets/sprites/boxers/<fighter>/front_<pose>.png`
  (player: `back_<pose>` / `front_<pose>`).
- **Or by hand:** in Aseprite, File ▸ Export Sprite Sheet / export each frame to the
  matching `assets/sprites/boxers/<fighter>/<facing>_<pose>.png`.
