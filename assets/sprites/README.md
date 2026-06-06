# PAWNCH sprite art (drop your Aseprite exports here)

The game ships **100% procedural** — no art files are required. But if you add a
`manifest.json` here pointing at PNGs, those images are loaded at boot and used
instead of the procedural drawings (per-key fallback: anything you don't supply
stays procedural). So you can replace the art piece by piece.

## How to use

1. Export your frames from Aseprite as PNGs into this folder.
2. Create `manifest.json` (see `manifest.example.json`) mapping keys → filenames.
3. Reload the game.

## Keys

**Boxers** — `"<facing>:<pose>"`
- facing: `front` (opponent, faces camera) · `back` (you, from behind)
- pose: `idle` `guard` `windupL` `windupR` `punchL` `punchR` `hurt` `down` `walk`
- Authored size: ~22×32 "sprite units"; it's scaled to match the procedural
  footprint (the anchor is the upper chest, ~5 units below the image top).
- Minimum useful set: `front:idle`, `back:idle` (others fall back to `idle`).

**Pieces** — organized into named **sets**. `manifest.json` maps a set name to a
sub-directory of 12 PNGs (`wp.png`..`bk.png`):

```json
{ "pieceSets": { "celestial": "celestial", "arcane": "arcane" } }
```

- Files in each set dir are named `"<color><type>.png"` — color `w`|`b`, type
  `p` `n` `b` `r` `q` `k` (e.g. `celestial/wq.png`, `arcane/bn.png`).
- The renderer scales every sprite to a per-type target height (`PIECE_TYPE_H`
  in `gfx.js`) so a white king == a black king regardless of source size, and
  layers an **animated chess-half aura** around it whose flavor depends on the
  active set + color (see `PIECE_FX` in `config.js`):
  - **`celestial`** (default) — white = "sun" (warm gold radiance), dark =
    "galaxy/supernova" (cool cosmic swirl). Aura alpha is low so it complements
    the art's own baked glow; keep a little glow on these sprites.
  - **`arcane`** (unlocked by beating THE PAWNCHION) — the original purple swirl
    (dark) + celestial-blue twinkle (white). Author these as tight silhouettes
    with **no** baked aura; the engine supplies it at full strength.
- The active set is chosen at runtime (Settings → Display → PIECES) and saved.
- A legacy flat `"pieces": { "wq": "file.png", ... }` map is still honored and
  loads as the default `celestial` set.
- `tools/slice_mk3.py` produced the `celestial` set from the `MK3.png` showcase
  sheet (white-background knockout, keeps the colored glow, tight-crops). Run
  `python tools/slice_mk3.py --probe` first to sanity-check the detected boxes.
- `tools/chess_slice.py` / `tools/clean_pieces.py` are the one-shot tools that
  produced the `arcane` set from the raw `CHESS PIECES MK2` sheet.

That's it — any missing file just uses the built-in 16-bit art (which is also
recolored to match the active set's theme), so the game still runs with zero
image files present.
