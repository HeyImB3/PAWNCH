# PAWNCH Art Bible

## v2 — the PAWNCH Hi-Bit standard (2026-07-20)

**Scope:** every NEW asset from the visual overhaul onward (ring kit, arena
layers, UI chrome, portraits). Authored **by hand in Aseprite** (pixel-mcp) —
no generated renders. The Gemini fighter sprites remain the keepers (see the
v1 history below); new art must harmonize with them, not imitate them.
Spec: `docs/superpowers/specs/2026-07-20-visual-overhaul-design.md`.

### The rules (every pixel obeys these)

1. **Native resolution, honest pixels.** Author at 1:1 game scale on the
   512×448 canvas. No downscaled renders, no mixed pixel sizes, no rotated
   pixels, `imageSmoothingEnabled` stays false.
2. **One master palette.** `assets/aseprite/pawnch-master.gpl` (~51 colors,
   8 hue-shifted ramps anchored on brand orange/blue) is the ONLY color
   source. Per-scene sub-palettes are subsets/derivations of it. `spec0/1`
   (white) are for tiny glints only — never fills.
3. **Hue-shifted ramps.** Shadows cool toward blue-violet, highlights warm
   toward gold. Never straight black-or-white shading.
4. **Cluster shading, KOF-interior style.** Model form with shaped color
   clusters; minimal dark outlines (only where a silhouette must pop). No
   pillow shading, no banding. Dither only as deliberate texture (sky, smoke,
   canvas weave) — never as a gradient crutch.
5. **Declared key light per scene.** Each arena states its light source
   (classic = overhead truss; beach = low warm sun; …). Painted shading and
   the code light pass must agree with it.
6. **The glow pass is code, not paint.** Light emitters are painted UNLIT
   (housings, tubes, bulbs); `src/lighting.js` adds additive bloom at runtime.
   Crisp pixels + soft light = the hi-bit look.
7. **Motion doctrine.** Nothing on screen is ever fully still — but motion is
   code-driven (scenery FX, rope physics, decals), so painted layers stay
   static and cacheable.
8. **Readability beats spectacle.** Fighters + attack tells own the
   highest-contrast band; backdrops sit lower-contrast behind them (Golden
   Rules 8–9). If a backdrop element competes with a windup tell, darken it.

### Workflow & QA gates (all three, every asset)

- Layered `.aseprite` masters committed to `assets/aseprite/`; the game PNGs
  they export live in `assets/sprites/…` (manifest-registered, per-piece
  procedural fallback — Golden Rule 5 stays intact).
- **Gate 1:** `tools/.venv/bin/python tools/check_alpha.py out.png chk.png`
  — checkerboard composite; the Read tool renders alpha as white and lies,
  so cutouts are judged ONLY on the checker.
- **Gate 2:** `tools/arena-preview.html` — the asset in its real composite
  (scene + ring + fighters + FX), including the `?bare=1` fallback path.
- **Gate 3:** the live game at 60fps with zero `[PAWNCH] frame error` lines.

---

## v1 history — sprite standards & the rebuild decision

**Status (2026-06-23): the Gemini-rendered originals are the keeper.** We tried a
full pixel-art restyle and it did not beat the originals' charm — so we **polish the
originals** instead. A true restyle is deferred to a higher-power tool (Gemini
regeneration once credits are back, or a human pixel artist).

### What we tried, and what we learned

- **Attempt:** rebuild every fighter as crisp, vibrant, limited-palette **cel art** —
  auto "cel-ify" from the references, then hand-refine. Pilot = Patty.
- **Result:** more vibrant + editable, but **rougher**. Auto-quantizing a polished
  render keeps its noise; code-authored faces/shading can't match a skilled hand. It
  lost the originals' charm — a clear downgrade, not an upgrade.
- **Decision:** keep the originals; fix their *real* defects. The pixel-art restyle is
  a future project, done the right way (below), not via post-processing.

### The real defect we DID fix — the slicer's white-knockout

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

### Standing art facts (still true)

- Canvas **150×216**, feet on row **190**, body centered on col **75** — matches
  `src/fighter.js` (`IW/IH/CX/FEET`). The slicer normalizes every pose to this.
- **`_src/<slug>/` is the master.** It holds the high-res Gemini sources; the slicer
  rebuilds the game PNGs in `assets/sprites/boxers/<slug>/` from them. Keep `_src`.
- Per-fighter on-screen size is `BODY_H` in `slice_boxer.py` (Patty small, Iron huge).
- The painterly originals keep CLAUDE.md **Golden Rule 10** (add-on elements must match
  the sprite's soft edges / lighting — e.g. how the Bishop mitre was integrated).

### If/when we DO restyle the FIGHTERS later — the right way

- Use the **highest-power tool**, not post-processing: **Gemini regeneration** with a
  pixel-art-native prompt, or a **human pixel artist**. (Environments/UI/portraits
  are now covered by the v2 hand-authored standard above.)
- These modular ideas still apply then: one shared **master palette**; layered
  **`.aseprite`** sources committed alongside the PNGs; reusable **part templates**;
  tagged **spritesheets**; a **silhouette-check** QA step.

> The v1 sections supersede the earlier version of this doc, which laid out an
> "auto-base + hand-refine" restyle pipeline. The Patty pilot disproved that
> pipeline; this is the honest record of where we landed.
