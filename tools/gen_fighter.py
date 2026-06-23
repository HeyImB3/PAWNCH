#!/usr/bin/env python3
# Generate a fighter's pose set (per-pose mode).
#
# Makes ONE idle "anchor" to lock identity, then generates each game pose
# conditioned on that anchor so the character stays consistent across frames.
# Raw frames -> assets/sprites/_src/<slug>/{_anchor,<pose>}.png (gitignored).
#
#   tools/.venv/bin/python tools/gen_fighter.py pawnchion
#   ... --only jabL,hookR        # regenerate just these poses (reuses the anchor)
#   ... --model gemini-3-pro-image
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fighter_prompts import anchor_prompt, pose_prompt, POSE_ORDER
from gemini_image import generate, DEFAULT_MODEL

def perpose(slug, model, only=None, anchor_ref=None):
    raw = os.path.join("assets", "sprites", "_src", slug)
    os.makedirs(raw, exist_ok=True)
    anchor = os.path.join(raw, "_anchor.png")
    # (Re)generate the anchor unless we're re-rolling specific poses and it exists.
    # anchor_ref (a real-person photo) conditions the anchor for a likeness caricature.
    if not (only and os.path.exists(anchor)):
        print("[anchor] generating identity anchor ...")
        generate(anchor_prompt(slug), anchor, model=model, refs=[anchor_ref] if anchor_ref else None)
    for p in (only or POSE_ORDER):
        out = os.path.join(raw, p + ".png")
        print(f"[{p}] generating (ref=anchor) ...")
        generate(pose_prompt(slug, p), out, model=model, refs=[anchor])
    print("done ->", raw)

def main(argv):
    model, only, anchor_ref, rest = DEFAULT_MODEL, None, None, []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--model": model = argv[i + 1]; i += 2
        elif a == "--only": only = argv[i + 1].split(","); i += 2
        elif a == "--anchor-ref": anchor_ref = argv[i + 1]; i += 2
        else: rest.append(a); i += 1
    if not rest:
        raise SystemExit("usage: gen_fighter.py SLUG [--model M] [--only p1,p2] [--anchor-ref photo]")
    perpose(rest[0], model, only, anchor_ref)

if __name__ == "__main__":
    main(sys.argv[1:])
