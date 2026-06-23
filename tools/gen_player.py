#!/usr/bin/env python3
# Generate THE PLAYER (hero). A FRONT identity anchor locks the look, then we make
# the BACK frames (the fight view — back to camera, punches drive up/away at the
# bigger opponent above) plus a few FRONT frames (win / round-break / walk-in).
# Raw -> assets/sprites/_src/player/{_anchor, back_<pose>, front_<pose>}.png
#
#   tools/.venv/bin/python tools/gen_player.py
#   ... --only back_jabL,front_idle      # re-roll specific frames (reuses the anchor)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fighter_prompts import player_anchor_prompt, player_pose_prompt, POSE_ORDER
from gemini_image import generate, DEFAULT_MODEL

FRONT_POSES = ["idle", "guard", "walk", "special"]   # the poses shown front (win/break/walk)

def main(argv):
    model, only, rest = DEFAULT_MODEL, None, []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--model": model = argv[i + 1]; i += 2
        elif a == "--only": only = argv[i + 1].split(","); i += 2
        else: rest.append(a); i += 1
    raw = os.path.join("assets", "sprites", "_src", "player")
    os.makedirs(raw, exist_ok=True)
    anchor = os.path.join(raw, "_anchor.png")
    if not (only and os.path.exists(anchor)):
        print("[anchor] player identity (front) ...")
        generate(player_anchor_prompt(), anchor, model=model)
    jobs = [("back", p) for p in POSE_ORDER] + [("front", p) for p in FRONT_POSES]
    for face, p in jobs:
        key = f"{face}_{p}"
        if only and key not in only:
            continue
        print(f"[{key}] generating (ref=anchor) ...")
        generate(player_pose_prompt(p, face), os.path.join(raw, key + ".png"), model=model, refs=[anchor])
    print("done ->", raw)

if __name__ == "__main__":
    main(sys.argv[1:])
