# PAWNCH Art Bible — sprite standards & the rebuild decision

**Status (2026-06-23): the Gemini-rendered originals are the keeper.** We tried a
full pixel-art restyle and it did not beat the originals' charm — so we **polish the
originals** instead. A true restyle is deferred to a higher-power tool (Gemini
regeneration once credits are back, or a human pixel artist).

## What we tried, and what we learned

- **Attempt:** rebuild every fighter as crisp, vibrant, limited-palette **cel art** —
  auto "cel-ify" from the references, then hand-refine. Pilot = Patty.
- **Result:** more vibrant + editable, but **rougher**. Auto-quantizing a polished
  render keeps its noise; code-authored faces/shading can't match a skilled hand. It
  lost the originals' charm — a clear downgrade, not an upgrade.
- **Decision:** keep the originals; fix their *real* defects. The pixel-art restyle is
  a future project, done the right way (below), not via post-processing.

## The real defect we DID fix — the slicer's white-knockout

- **Bug:** `tools/slice_boxer.py`'s background knockout deleted legitimately **white/
  light content** as if it were background — white **clothing** (Magnus's trunks,
  boots, trim), white **collars** (Bishop), and the white **eye-shine** across the
  roster. Those rendered transparent → missing / black on the dark arena. (This is
  what looked like "translucent eyes.")
- **Root cause:** the "remove enclosed white pockets" step dropped *any* large enclosed
  white region. That correctly removes the trapped background between raised arms — but
  it also removed white *clothing*, which is just as enclosed.
- **Fix:** a large enclosed white pocket is dropped **only if it is pure / uniform
  bright white** (= trapped background). **Shaded** white (clothing has folds and
  off-white tones) and **small** pockets (eye-shine, teeth) are kept. Border-darkness
  is deliberately NOT used as a signal — a bg gap between dark-robed arms is
  dark-bordered too, and real eye-shine is always small (so it's size-exempt).
- All 11 fighters were re-sliced from `_src/` with the fixed slicer. The **Bishop
  mitre** + **`front_jabL` ghost fix** are re-applied on top of the clean reslice. The
  earlier (imperceptible) white-halo pass is intentionally not re-done.

## Standing art facts (still true)

- Canvas **150×216**, feet on row **190**, body centered on col **75** — matches
  `src/fighter.js` (`IW/IH/CX/FEET`). The slicer normalizes every pose to this.
- **`_src/<slug>/` is the master.** It holds the high-res Gemini sources; the slicer
  rebuilds the game PNGs in `assets/sprites/boxers/<slug>/` from them. Keep `_src`.
- Per-fighter on-screen size is `BODY_H` in `slice_boxer.py` (Patty small, Iron huge).
- The painterly originals keep CLAUDE.md **Golden Rule 10** (add-on elements must match
  the sprite's soft edges / lighting — e.g. how the Bishop mitre was integrated).

## If/when we DO restyle later — the right way

- Use the **highest-power tool**, not post-processing: **Gemini regeneration** with a
  pixel-art-native prompt, or a **human pixel artist**.
- These modular ideas still apply then: one shared **master palette**; layered
  **`.aseprite` sources** committed alongside the PNGs; reusable **part templates**;
  tagged **spritesheets**; a **silhouette-check** QA step.

> This supersedes the earlier version of this doc, which laid out an "auto-base +
> hand-refine" restyle pipeline. The Patty pilot disproved that pipeline; this is the
> honest record of where we landed.
