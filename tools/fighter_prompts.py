# Art-direction prompts for fighter sprite generation (see the design spec).
#
# Per-pose mode: an idle ANCHOR locks the character's identity, then each game
# pose is generated conditioned on that anchor so the character stays consistent.
# The CONTINUITY block fights the AI's tendency to drop or mis-size recurring
# details (notably the rook-tower shoulder pauldrons).

POSE_ORDER = ["idle", "guard", "windupL", "windupR", "jabL", "jabR", "hookL",
              "hookR", "special", "duck", "hurt", "stagger", "down", "walk"]

IDENTITY = {
    "pawnchion": (
        "THE PAWNCHION, the grand champion final boss of a chess-boxing game: a towering, "
        "intimidating heavyweight boxer-king with warm tan skin and a confident menacing "
        "snarl. He wears bright orange boxing trunks and bright ORANGE boxing gloves that "
        "match his trunks (his gloves are ORANGE, never blue), a royal-blue "
        "waistband and trim, a gold king-cross emblem on his chest, and a fused golden "
        "chess-piece crown (king, queen and rook points). On EACH shoulder he wears a "
        "matching grey stone rook-tower pauldron with crenellated battlements."
    ),
}

STYLE = (
    "16-bit SNES-era boxing sprite in the style of classic Punch-Out: bold solid black "
    "outline, limited flat palette with only 2 to 3 shades per color, crisp pixel-art "
    "shading, NO gradients, NO anti-aliasing, NO blur. A SINGLE character, full body from "
    "the top of the head down to the feet, centered, facing the viewer, on a plain "
    "pure-white (#ffffff) background, no text, no labels, no drop shadow."
)

CONTINUITY = (
    "CRITICAL CONTINUITY: keep him EXACTLY identical to the reference image - same face, "
    "same gold chess-piece crown, same orange-and-blue costume, same proportions and the "
    "same body size. He must ALWAYS have BOTH rook-tower pauldrons, one on each shoulder, "
    "equal in size and symmetric - never drop, hide, or shrink either pauldron."
)

# Staging: the player is a SMALL opponent at the bottom-center of the screen. The enemy
# towers over them, so his head, eyes and punches all aim DOWN toward that lower target -
# never staring straight ahead or glancing/striking off to the left or right.
FOCUS = (
    "STAGING: he faces the viewer but he is a TOWERING giant, while his opponent - the player - "
    "is much SMALLER and stands on the ground at the BOTTOM-CENTER of the frame, right in front "
    "of his boots. So he TILTS HIS HEAD DOWN and his EYES LOOK DOWNWARD at that small opponent "
    "below him: his face, gaze and entire focus are locked DOWN toward the bottom of the frame - "
    "he is NEVER staring straight ahead and NEVER glancing or aiming off to the left or right. "
    "Draw ONLY the Pawnchion himself, alone in the frame - do NOT draw the small opponent, just "
    "imply them below the bottom edge."
)

POSE_DESC = {
    "idle":    "standing in a boxing stance, both gloves up near his chin, weight balanced.",
    "guard":   "in a tight defensive guard, both gloves pressed together in front of his face, elbows tucked in.",
    # Punches drive DOWN toward the bottom-CENTER of the frame (the small player at his
    # boots), with foreshortening - never reaching off to his left or right side.
    "windupL": "rearing back to hammer DOWN on the small opponent at his feet: his LEFT fist cocked up HIGH above his shoulder, head tilted down watching the player below, body coiled to bring the fist crashing straight DOWN - an obvious telegraph.",
    "windupR": "rearing back to hammer DOWN on the small opponent at his feet: his RIGHT fist cocked up HIGH above his shoulder, head tilted down watching the player below, body coiled to bring the fist crashing straight DOWN - an obvious telegraph.",
    "jabL":    "firing a LEFT jab straight DOWN at the small opponent below him: his LEFT arm drives DOWNWARD toward the BOTTOM-CENTER of the frame (down toward his own boots), the fist ending low and central with dramatic foreshortening, head and eyes following it DOWN, right glove tucked at his cheek - the fist does NOT reach out to his side.",
    "jabR":    "firing a RIGHT jab straight DOWN at the small opponent below him: his RIGHT arm drives DOWNWARD toward the BOTTOM-CENTER of the frame (down toward his own boots), the fist ending low and central with dramatic foreshortening, head and eyes following it DOWN, left glove tucked at his cheek - the fist does NOT reach out to his side.",
    "hookL":   "swinging a LEFT hook DOWN and INWARD onto the small opponent below him: his left arm arcs down toward the bottom-center of the frame, elbow bent, torso hunching forward over the smaller target, head down - not a flat sideways swing.",
    "hookR":   "swinging a RIGHT hook DOWN and INWARD onto the small opponent below him: his right arm arcs down toward the bottom-center of the frame, elbow bent, torso hunching forward over the smaller target, head down - not a flat sideways swing.",
    "special": "unleashing his signature finisher - BOTH arms raised high overhead, fists clenched together for a massive overhead smash, towering and menacing.",
    "duck":    "ducking low - knees deeply bent, head dropped down between his raised gloves, crouched.",
    "hurt":    "recoiling from a hit - head snapped back and to one side, both arms flung loose, knocked off balance.",
    "stagger": "dazed and wobbling off balance - knees buckling, arms hanging loose, seeing stars.",
    "down":    "FLAT ON HIS BACK on the canvas floor, completely KNOCKED OUT: his whole body is HORIZONTAL on the ground, lying down, arms sprawled out to the sides, legs out, head on the mat - he is NOT standing or kneeling, he is lying flat.",
    "walk":    "striding forward toward the viewer, mid-step, gloves up in a guard.",
}

def anchor_prompt(slug):
    return (f"{IDENTITY[slug]} He is {POSE_DESC['idle']} {FOCUS} {STYLE} "
            "He must clearly show BOTH matching rook-tower shoulder pauldrons, one on each "
            "shoulder, equal in size and symmetric.")

def pose_prompt(slug, pose):
    return (f"Keep the SAME character, costume and crown from the reference image, but "
            f"put him in a NEW, clearly different action pose. {IDENTITY[slug]} "
            f"Show him {POSE_DESC[pose]} Make the body language exaggerated and unmistakable. "
            f"{FOCUS} {STYLE} {CONTINUITY}")


if __name__ == "__main__":
    import sys
    slug = sys.argv[1] if len(sys.argv) > 1 else "pawnchion"
    print("=== ANCHOR ===\n" + anchor_prompt(slug))
    print("\n=== POSE jabR ===\n" + pose_prompt(slug, "jabR"))
