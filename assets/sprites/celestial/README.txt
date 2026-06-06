CELESTIAL piece set — the default "Sun & Galaxy" pieces (MK3).

  wp wn wb wr wq wk   orange "sun" pieces  -> WHITE side
  bp bn bb br bq bk   blue "galaxy" pieces -> DARK side

These 12 PNGs were sliced from ../MK3.png (the showcase sheet) by
`python tools/slice_mk3.py` — it knocks out the white background, keeps the
colored part of each piece's baked glow, drops stray detached sparkles, and
tight-crops each piece. Re-run that tool to regenerate them from MK3.png.

The engine layers a toned-down animated aura (sun rays / galaxy swirl) on top,
so the baked glow and the animation complement each other. The renderer rescales
every sprite to a per-type target height (PIECE_TYPE_H in src/gfx.js), so exact
source sizes don't matter. The unlockable ARCANE set lives in ../arcane/.
