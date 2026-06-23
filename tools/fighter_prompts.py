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
    "patty": (
        "PATTY PUSHWOOD, the goofy rookie first opponent: short, round and a little doughy, "
        "wearing a smooth rounded wooden PAWN-helmet (a dome like a chess pawn's head), bright "
        "orange trunks and matching orange gloves, a simple carved pawn glyph on his chest, a "
        "hopeful goofy grin, big eager eyes and rosy cheeks. A lovable harmless underdog, not "
        "intimidating at all."
    ),
    "gus": (
        "GUS GAMBIT, a sly trickster pawn who loves a dodgy gambit: lean and wiry, a TALL "
        "pointed wooden pawn-helmet, green trunks and matching green gloves with a green sash "
        "across his chest, one cocky raised eyebrow and a smug con-man smirk, shifty eyes. He "
        "looks like he is about to swindle you."
    ),
    "rosa": (
        "ROSA ROOKRUSH, a powerhouse brawler who charges straight in like a rook: broad and "
        "tough, a tall square crenellated stone ROOK-TOWER helmet with battlements on top, deep "
        "red trunks and matching red gloves, a brick-wall emblem on her chest, a fierce angry "
        "scowl and dark red hair. Built like a battering ram."
    ),
    "kid": (
        "KID KNIGHTMARE, a tricky cocky young knight-boxer: athletic, wearing a steel KNIGHT "
        "helmet shaped like a chess knight (a horse-head crest and visor), blue trunks and "
        "matching blue gloves, a two-pronged fork emblem on his chest, a sly confident smirk. "
        "Quick, slippery and unpredictable."
    ),
    "bishop": (
        "BISHOP BRUISER, a tall looming bishop who works the diagonals: lean and long-limbed, a "
        "tall split BISHOP'S MITRE hat (a pointed two-part church mitre), purple trunks and "
        "matching purple gloves with a purple sash, a calm heavy-browed flat stare, quietly "
        "menacing. He towers over you on the diagonal."
    ),
    "queen": (
        "QUEEN QUAKE, a regal and devastating queen who centralizes and swings hard: powerful "
        "and commanding, a tall pointed QUEEN'S CORONET crown topped with orbs, magenta-pink "
        "trunks and matching pink gloves with a wide royal sash, bold lipstick, hooded "
        "confident eyes and a fierce regal glare. The most powerful piece, and she knows it."
    ),
    "iron": (
        "IRON ENDGAME, a hulking iron brute who grinds opponents down: ENORMOUS shoulders and a "
        "massive barrel chest (the biggest, widest, most muscular fighter), a riveted iron "
        "rook-stub cap, cold grey steel armour-plated trunks and matching grey gloves, iron "
        "rivets across his chest, a blank flat unstoppable stare, battle-scarred. An immovable "
        "grinding machine."
    ),
    "tal": (
        "TAL TEMPEST, a wild sacrificial attacker - an affectionate caricature homage to the "
        "chess legend Mikhail Tal, 'the Magician of Riga': intense piercing dark eyes under "
        "heavy dark eyebrows, a sharp widow's-peak hairline of dark wavy hair, a sly dangerous "
        "smirk, a slim build, teal trunks and matching teal gloves with a sash. He looks like "
        "he will sacrifice everything to attack - hypnotic, reckless and brilliant."
    ),
    "magnus": (
        "MAGNUS MAXIMUS, the near-perfect champion-king - an affectionate caricature homage to "
        "world chess champion Magnus Carlsen: a strong heavy jaw, intense focused eyes under a "
        "flat brow, short side-swept light-brown hair, a calm cold confident unbothered "
        "expression, an athletic build, a gold KING'S CROWN, and gold-and-white trunks with "
        "matching gloves. Quietly untouchable and calculating."
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
    "is much SMALLER and stands close to the camera in the FOREGROUND at the bottom of the "
    "screen, BELOW him and out in FRONT of him (NOT at his feet, NOT on the floor he stands on). "
    "So he tilts his head DOWN-AND-FORWARD and his eyes look toward that small opponent in the "
    "lower-foreground: his face, gaze and focus aim at the lower-CENTER-FRONT of the frame - "
    "never staring straight ahead and never glancing off to the left or right. "
    "Draw ONLY the Pawnchion himself, alone in the frame - do NOT draw the small opponent, just "
    "imply them below and in front."
)

POSE_DESC = {
    "idle":    "standing in a boxing stance, both gloves up near his chin, weight balanced.",
    "guard":   "in a tight defensive guard, both gloves pressed together in front of his face, elbows tucked in.",
    # Punches drive DOWN toward the bottom-CENTER of the frame (the small player at his
    # boots), with foreshortening - never reaching off to his left or right side.
    "windupL": "rearing back to hammer DOWN on the small opponent at his feet: his LEFT fist cocked up HIGH above his shoulder, head tilted down watching the player below, body coiled to bring the fist crashing straight DOWN - an obvious telegraph.",
    "windupR": "rearing back to hammer DOWN on the small opponent at his feet: his RIGHT fist cocked up HIGH above his shoulder, head tilted down watching the player below, body coiled to bring the fist crashing straight DOWN - an obvious telegraph.",
    "jabL":    "firing a LEFT jab DOWN-AND-FORWARD at the small player in the foreground: his LEFT arm punches OUT toward the camera at a moderate ~30-40 degree DOWNWARD angle, the fist reaching the lower-CENTER-FRONT of the frame and stopping at the player's HEAD height (with dramatic foreshortening) - the fist does NOT continue down to the floor or his own boots, and does NOT reach out to his side; right glove guards his cheek.",
    "jabR":    "firing a RIGHT jab DOWN-AND-FORWARD at the small player in the foreground: his RIGHT arm punches OUT toward the camera at a moderate ~30-40 degree DOWNWARD angle, the fist reaching the lower-CENTER-FRONT of the frame and stopping at the player's HEAD height (with dramatic foreshortening) - the fist does NOT continue down to the floor or his own boots, and does NOT reach out to his side; left glove guards his cheek.",
    "hookL":   "swinging a LEFT hook DOWN-AND-FORWARD onto the small player in the foreground: his left arm arcs OUT toward the camera and moderately downward, the fist landing at the lower-CENTER-FRONT around the player's HEAD height with foreshortening, torso hunched forward over the target - NOT a flat sideways swing and NOT chopping down at the floor.",
    "hookR":   "swinging a RIGHT hook DOWN-AND-FORWARD onto the small player in the foreground: his right arm arcs OUT toward the camera and moderately downward, the fist landing at the lower-CENTER-FRONT around the player's HEAD height with foreshortening, torso hunched forward over the target - NOT a flat sideways swing and NOT chopping down at the floor.",
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


# ---- THE PLAYER (hero) -------------------------------------------------------
# A scrappy chess underdog ("Little Mac but better"). Drawn from BEHIND in fights
# (back to camera, punching UP/AWAY at the bigger opponent above) and from the
# FRONT on win / round-break / walk-in screens.
IDENTITY["player"] = (
    "THE PLAYER, the scrappy underdog hero of a chess-boxing game: a young, lean but tough and "
    "athletic boxer with short dark hair, a white headband, a determined fearless look and fire "
    "in his eyes. He wears bright BLUE boxing trunks and matching blue boxing gloves with white "
    "trim, and a small white chess-PAWN emblem on his waistband - a humble pawn with the heart "
    "of a champion who out-thinks and out-fights giants. Heroic and cool, an underdog you root "
    "for, never cocky."
)

PLAYER_BACK = (
    "Shown from BEHIND, his back to the camera in the lower foreground - we see the back of his "
    "head and headband, his shoulders and back, his blue trunks and the backs of his gloves, NOT "
    "his face. His opponent is a much LARGER fighter standing ABOVE and ahead of him near the top "
    "of the screen, so his guard and punches drive UP and AWAY from the camera toward that bigger "
    "opponent above."
)

PLAYER_BACK_POSE = {
    "idle":    "bouncing lightly on his toes in a boxing stance, both gloves up.",
    "guard":   "in a tight guard, both gloves up protecting his head.",
    "windupL": "cocking his LEFT arm back low to load a punch.",
    "windupR": "cocking his RIGHT arm back low to load a punch.",
    "jabL":    "firing a LEFT jab UP and AWAY at the bigger opponent above - left arm extended upward and forward.",
    "jabR":    "firing a RIGHT jab UP and AWAY at the bigger opponent above - right arm extended upward and forward.",
    "hookL":   "throwing a LEFT hook up toward the opponent above, torso twisting.",
    "hookR":   "throwing a RIGHT hook up toward the opponent above, torso twisting.",
    "special": "leaping up with a huge heroic UPPERCUT finisher - one fist driving straight UP toward the opponent above, rising onto his toes.",
    "duck":    "ducking low, crouched, gloves up.",
    "hurt":    "snapped backward, recoiling from a hit, arms flailing.",
    "stagger": "wobbling and dazed, off balance.",
    "down":    "knocked down, slumped on the canvas.",
    "walk":    "striding forward away from the camera toward the ring.",
}

PLAYER_FRONT_POSE = {
    "idle":    "facing the viewer in a confident boxing stance, gloves up, a determined grin.",
    "guard":   "facing the viewer in a tight guard, both gloves at his face.",
    "walk":    "walking toward the viewer, mid-stride, gloves up, determined.",
    "special": "a triumphant victory pose facing the viewer, one fist raised high, grinning.",
}

def player_anchor_prompt():
    return (f"{IDENTITY['player']} He stands facing the viewer in a confident boxing stance, full "
            f"body from head to feet, gloves up. {STYLE}")

def player_pose_prompt(pose, facing):
    if facing == "back":
        style = STYLE.replace("facing the viewer, ", "")   # he's back-to-camera
        return (f"The SAME character from the reference image: {IDENTITY['player']} {PLAYER_BACK} "
                f"He is {PLAYER_BACK_POSE[pose]} Make the body language exaggerated and clear. "
                f"{style} {CONTINUITY}")
    return (f"The SAME character from the reference image: {IDENTITY['player']} He is "
            f"{PLAYER_FRONT_POSE.get(pose, PLAYER_FRONT_POSE['idle'])} {STYLE} {CONTINUITY}")


if __name__ == "__main__":
    import sys
    slug = sys.argv[1] if len(sys.argv) > 1 else "pawnchion"
    print("=== ANCHOR ===\n" + anchor_prompt(slug))
    print("\n=== POSE jabR ===\n" + pose_prompt(slug, "jabR"))
