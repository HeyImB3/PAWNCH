# Sprite cleanup + Bishop mitre — Aseprite pass

Cleaning leftover Gemini generation artifacts on the boxer sprites, and adding a
bishop's mitre to Bishop, via the `pixel-mcp` MCP (see [memory `aseprite-mcp-setup`]).
Started 2026-06-23.

## ✅ DONE (2026-06-23)
- **Bishop `front_jabL` ghost** — painted out the hallucinated skull+collar+blob in the
  deep robe fold (filled with the robe-fold color, verified pixel-exact).
- **Bishop's mitre — DONE on all 14 poses.** White+gold liturgical mitre (ivory field,
  gold trim band + bold gold cross), hand-crafted to a stream-ready bar and **integrated**
  (soft LANCZOS edges, light matched to the sprite, brow cast shadow, arm-occlusion on
  windupL) — see new **CLAUDE.md Golden Rule 10**. `tools/fighter_prompts.py` bishop
  `IDENTITY` updated to describe the mitre (was "NO mitre hat").

### Pipeline used (reusable for the next add-on costume element)
Design the element at high-res in a throwaway Python script → LANCZOS-downscale (matches
the sprite's own soft edges) → composite onto each pose (per-pose position/scale/tilt/
mirror from a skin-based head-finder, + skin-only cast shadow) → **preview on magenta/
dark bg, never trust the Read tool's white** → emit an "import-safe" delta PNG (opaque
over content, partial only over transparent bg) → apply IN Aseprite via the MCP
(`import_image` the delta as a layer → `export_sprite`; `draw_pixels` is the pixel-exact
alternative for small deltas) → diff committed-vs-expected (maxΔ≤3 = imperceptible).
Scratch scripts: `/tmp/mitre_pro.py` (design), `/tmp/mitre_build.py` (per-pose stamper),
`/tmp/head_montage.py` + `/tmp/contact.py` (QA).

## Decisions (from the user)
- **Editing happens THROUGH Aseprite/`pixel-mcp`** — not by PIL-writing the committed PNGs
  directly (PIL is fine for *designing/previewing* the art; the committed file is only
  ever mutated via the MCP).
- **Gemini engine was out of credits** (HTTP 429, prepayment depleted), so the mitre was
  hand-crafted rather than regenerated in-style. If credits are restored, the
  highest-fidelity path is to bake the mitre into the `IDENTITY` and regenerate (see
  `fighter-art`).

## What the audit found (3 categories — only #2/#3 are real work)
1. **Soft / anti-aliased edges (~98–99% of every silhouette).** NOT junk — it's the
   LANCZOS downscale in `slice_boxer.py`. Hardening it makes sprites jaggier. **Leave it.**
2. **White-knockout halo** — modest bright-white fringe on the silhouette border.
   Worst on: iron (~1026 px total / 14 poses), player (~845), bishop (~800),
   magnus (~711), pawnchion (~690). ~50–75 px/sprite — a thin fringe to tidy by hand.
3. **Embedded "ghost" content errors** — hallucinated duplicate bits baked INTO the
   silhouette (connected, so auto-scan can't find them and edge cleanup can't remove
   them). Must be painted out in Aseprite, or the pose regenerated. Found only by
   zoomed visual audit.

### Confirmed ghost artifacts so far
- **bishop/front_jabL.png** — a spurious skull-with-white-collar duplicate head + a
  small dark blob hallucinated into the robe between the legs. Paint out, fill with
  robe color. (His real head, up top, is fine.)

## Per-fighter workflow (post-restart, in Aseprite)
For each of: bishop, gus, iron, kid, magnus, patty, pawnchion, player, queen, rosa, tal
1. Open each `assets/sprites/boxers/<slug>/*.png` in Aseprite (150×216, feet@row190, center@col75).
2. Zoom in; scan for embedded ghosts (extra heads/limbs/gloves) → erase + patch with neighbor color.
3. Tidy the bright white halo on the border where present.
4. Keep the soft anti-aliased edge intact (don't hard-threshold the alpha).
5. Save back to the same path. Re-check on the contact sheet (below).
6. **Bishop only:** add a purple/white bishop's mitre on the head across all poses.

## QA helpers (ephemeral, in /tmp — regenerate anytime with tools/.venv/bin/python)
- `/tmp/contact.py` → per-fighter labeled contact sheets on a checkerboard (`/tmp/contact/<slug>.png`).
- `/tmp/sprite_scan.py` → connected-component scan (detached fragments). Currently 0 — slicer strips them.
- `/tmp/edge_scan.py` → soft-edge% + white-halo px per fighter; also zooms a region for inspection.
- The Read tool renders transparency as WHITE — judge cut-outs on the checkerboard/magenta sheets, not raw.
```
