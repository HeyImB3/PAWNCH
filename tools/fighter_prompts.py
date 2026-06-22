# Art-direction prompts for fighter sprite sheets (see the design spec).
# POSE_ORDER MUST match slice_boxer's grid reading order.

POSE_ORDER = ["idle", "guard", "windupL", "windupR", "jabL", "jabR", "hookL",
              "hookR", "special", "duck", "hurt", "stagger", "down", "walk"]

STYLE = (
    "16-bit SNES-era boxing sprite in the style of classic Punch-Out, "
    "bold solid black outline, limited flat palette with only 2 to 3 shades per color, "
    "crisp pixel-art shading with NO gradients, NO anti-aliasing and NO blur, "
    "chunky exaggerated heavyweight proportions, strong readable silhouette, "
    "the full body from the top of the head down to the feet inside every cell, "
    "plain pure-white (#ffffff) background, no text, no labels, no drop shadow, "
    "each pose centered in its own cell."
)

GRID = (
    "Render as ONE sprite sheet: a clean even grid of 7 columns by 2 rows (14 cells), "
    "uniform cell size and spacing, the SAME identical character drawn in every cell, "
    "one pose per cell, in this exact reading order left-to-right then top-to-bottom: "
    "(1) standing idle, gloves up; (2) tight defensive guard, both gloves at the face; "
    "(3) winding up a LEFT punch with the left glove pulled back; "
    "(4) winding up a RIGHT punch with the right glove pulled back; "
    "(5) throwing a straight LEFT jab fully extended; "
    "(6) throwing a straight RIGHT jab fully extended; "
    "(7) throwing a LEFT hook; (8) throwing a RIGHT hook; "
    "(9) a huge signature wind-up, both arms loaded overhead for a boss finisher; "
    "(10) ducking low; (11) recoiling hurt with the head snapped back; "
    "(12) staggered and dazed, wobbling; (13) knocked down flat on the canvas; "
    "(14) walking forward. Keep the character's colors, costume and crown identical "
    "in all 14 cells."
)

FIGHTERS = {
    "pawnchion": (
        "THE PAWNCHION, the grand champion final boss of a chess-boxing game: a towering, "
        "intimidating heavyweight boxer-king. Bright orange boxing trunks and orange boxing "
        "gloves, royal-blue trim and championship belt, a fused golden chess-piece crown "
        "(an amalgam of king, queen and rook points) on his head, rook-tower armored "
        "pauldrons on both shoulders, a gold king-cross emblem on his chest, a confident "
        "menacing snarl and glinting eyes, warm tan skin. He must read as a genuine badass "
        "end boss, not a cute mascot."
    ),
}

def sheet_prompt(slug):
    return f"{FIGHTERS[slug]} {STYLE} {GRID}"


if __name__ == "__main__":
    import sys
    print(sheet_prompt(sys.argv[1] if len(sys.argv) > 1 else "pawnchion"))
