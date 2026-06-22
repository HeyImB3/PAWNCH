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
        "snarl. He wears bright orange boxing trunks and orange boxing gloves, a royal-blue "
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

POSE_DESC = {
    "idle":    "standing in a boxing stance, both gloves up near his chin, weight balanced.",
    "guard":   "in a tight defensive guard, both gloves pressed together in front of his face, elbows tucked in.",
    # NOTE: the player stands at the BOTTOM of the screen (back to camera), so enemy
    # punches angle DOWNWARD toward the viewer/player below - never straight ahead.
    "windupL": "loading up a huge punch to bring DOWN on the player below him: his LEFT fist cocked WAY back and HIGH above the shoulder, elbow up, body coiled like a spring, the right glove guarding his chin - an obvious exaggerated telegraph that he is about to strike downward.",
    "windupR": "loading up a huge punch to bring DOWN on the player below him: his RIGHT fist cocked WAY back and HIGH above the shoulder, elbow up, body coiled like a spring, the left glove guarding his chin - an obvious exaggerated telegraph that he is about to strike downward.",
    "jabL":    "firing a straight LEFT jab DOWNWARD at the player below him: his LEFT arm punched out and angled DOWN toward the lower-front of the screen (striking someone standing below him), fist leading and pointing down-and-forward, the right glove tucked at his cheek - a dynamic, exaggerated downward punch, not a standing pose.",
    "jabR":    "firing a straight RIGHT jab DOWNWARD at the player below him: his RIGHT arm punched out and angled DOWN toward the lower-front of the screen (striking someone standing below him), fist leading and pointing down-and-forward, the left glove tucked at his cheek - a dynamic, exaggerated downward punch, not a standing pose.",
    "hookL":   "throwing a LEFT hook that arcs DOWNWARD onto the player below him: his left arm swinging in a big arc coming DOWN toward the lower-front, elbow bent, torso and hips rotated hard - a clearly different silhouette from standing.",
    "hookR":   "throwing a RIGHT hook that arcs DOWNWARD onto the player below him: his right arm swinging in a big arc coming DOWN toward the lower-front, elbow bent, torso and hips rotated hard - a clearly different silhouette from standing.",
    "special": "unleashing his signature finisher - BOTH arms raised high overhead, fists clenched together for a massive overhead smash, towering and menacing.",
    "duck":    "ducking low - knees deeply bent, head dropped down between his raised gloves, crouched.",
    "hurt":    "recoiling from a hit - head snapped back and to one side, both arms flung loose, knocked off balance.",
    "stagger": "dazed and wobbling off balance - knees buckling, arms hanging loose, seeing stars.",
    "down":    "FLAT ON HIS BACK on the canvas floor, completely KNOCKED OUT: his whole body is HORIZONTAL on the ground, lying down, arms sprawled out to the sides, legs out, head on the mat - he is NOT standing or kneeling, he is lying flat.",
    "walk":    "striding forward toward the viewer, mid-step, gloves up in a guard.",
}

def anchor_prompt(slug):
    return (f"{IDENTITY[slug]} He is {POSE_DESC['idle']} {STYLE} "
            "He must clearly show BOTH matching rook-tower shoulder pauldrons, one on each "
            "shoulder, equal in size and symmetric.")

def pose_prompt(slug, pose):
    return (f"Keep the SAME character, costume and crown from the reference image, but "
            f"put him in a NEW, clearly different action pose. {IDENTITY[slug]} "
            f"Show him {POSE_DESC[pose]} Make the body language exaggerated and unmistakable. "
            f"{STYLE} {CONTINUITY}")


if __name__ == "__main__":
    import sys
    slug = sys.argv[1] if len(sys.argv) > 1 else "pawnchion"
    print("=== ANCHOR ===\n" + anchor_prompt(slug))
    print("\n=== POSE jabR ===\n" + pose_prompt(slug, "jabR"))
