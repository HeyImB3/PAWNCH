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

**Pieces** — `"<color><type>"`, e.g. `wq`, `bn`
- color: `w` (white) · `b` (black)
- type: `p` `n` `b` `r` `q` `k`
- Author each as a tight silhouette on a transparent background (no baked
  aura/shadow). The renderer scales every sprite to a per-type target height
  (`PIECE_TYPE_H` in `gfx.js`) so a white king == a black king regardless of
  source size, and draws the animated chess-half aura around it: a swirling
  purple/magenta glow on dark pieces, twinkling celestial glints on white.
- `tools/clean_pieces.py` is the one-shot cleanup that produced the current set
  from the raw `CHESS PIECES MK2` exports (strips the baked aura + sheet junk
  and tight-crops). Re-run it on *raw* exports only.

That's it — missing keys just use the built-in 16-bit art.
