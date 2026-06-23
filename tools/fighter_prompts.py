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
    # Each fighter is a DISTINCT character first (body type, silhouette, personality,
    # costume) - clearly a boxer (gloves on, in the ring) but never the same scheme.
    # Chess theme is EMBODIED + one signature nod, not a uniform chess-piece hat.
    "patty": (
        "PATTY PUSHWOOD, the goofy harmless rookie and gentlest first opponent: the SHORTEST and "
        "ROUNDEST fighter in the whole game - a soft doughy little PAWN-SHAPED pudgeball with a "
        "round belly, stubby little arms and legs, a goofy hopeful grin, big innocent eyes and "
        "rosy cheeks. His body and trunks have a warm wood-grain look (a literal 'wood-pusher'). "
        "Bright orange boxing gloves that look too big for his tiny arms. A lovable dope, totally "
        "unintimidating."
    ),
    "gus": (
        "GUS GAMBIT, a sly riverboat-gambler con-man who fakes and sacrifices: lean and slouchy "
        "with a smug card-sharp grin, a thin pencil mustache, slicked-back hair, a green dealer's "
        "visor and green sleeve garters on his bare arms, and green boxing gloves. He looks like "
        "a hustler about to cheat you - shifty eyes, a sneaky sideways lean. He works angles and "
        "feints, never a straight fight. NO helmet."
    ),
    "rosa": (
        "ROSA ROOKRUSH, an unstoppable charging bruiser built like a FORTRESS: the WIDEST, most "
        "square and blocky fighter in the game - a huge rectangular tank of a woman with enormous "
        "boulder shoulders and a body textured like grey castle stone and red brick, tiny eyes, a "
        "furious grin and fiery red hair. Big red boxing gloves like wrecking balls. Her body IS "
        "the rook-tower; she charges in straight lines and flattens everything. NO helmet."
    ),
    "kid": (
        "KID KNIGHTMARE, a flashy acrobatic young trickster: lean, springy and athletic with a "
        "cocky smirk and a spiky horse-mane MOHAWK (a knight's horse). He wears a sleeveless blue "
        "jacket and blue boxing gloves, and his SIGNATURE is a glowing two-pronged FORK - a fork "
        "emblem on his chest and little fork-shaped electric sparks crackling around his gloves. "
        "He bounces and break-dances, tricky and unpredictable."
    ),
    "bishop": (
        "BISHOP BRUISER, a towering creepy zealot-preacher: the TALLEST and LANKIEST fighter by "
        "far - gaunt and impossibly long-limbed with a thin pale face, sunken fervent eyes and a "
        "sermonizing sneer. He wears a high white clerical collar and a long dark cassock-robe "
        "open over his purple trunks, with purple boxing gloves on his long reaching arms. He "
        "looms and lectures and works cruel diagonals with his huge reach. NO mitre hat."
    ),
    "queen": (
        "QUEEN QUAKE, a flamboyant glamorous powerhouse DIVA: tall, voluptuous and commanding "
        "with enormous dramatic pink bouffant hair, heavy glam makeup, big dangling jewelry, a "
        "haughty theatrical sneer, and a sequined magenta-pink leotard and trunks. Pink boxing "
        "gloves. She is pure showbiz spectacle - she stomps and the whole ring QUAKES. The most "
        "theatrical, over-the-top fighter. Her giant hair IS her crown - NO coronet hat."
    ),
    "iron": (
        "IRON ENDGAME, a cold relentless GRINDING MACHINE: a hulking steampunk iron ROBOT boxer "
        "built of riveted iron plates, exposed brass gears and hissing pistons, with a blank iron "
        "visor face lit by a single cold glowing horizontal eye-slit, and heavy iron-block fists "
        "for gloves. No skin, no expression - an unfeeling endgame automaton that grinds "
        "opponents to dust. The biggest, heaviest, most inhuman fighter in the game."
    ),
    "tal": (
        "TAL TEMPEST, a wild hypnotic MAD-GENIUS - an affectionate caricature of chess legend "
        "Mikhail Tal: lean and twitchy with intense piercing dark eyes under heavy black "
        "eyebrows, a wild unruly dark mop of hair, and a manic dangerous grin. A swirling "
        "hypnotic energy and crackling storm-sparks whirl around him; teal boxing gloves and a "
        "teal sash. He sacrifices everything in a reckless brilliant frenzy. NO crown, NO helmet."
    ),
    "magnus": (
        "MAGNUS MAXIMUS, an ice-cold flawless PRODIGY - an affectionate caricature of world "
        "champion Magnus Carlsen: athletic and composed with a strong jaw, short side-swept "
        "light-brown hair, calm intense focused eyes and a cool unbothered half-smirk. He stands "
        "relaxed and supremely confident with minimal flash, in clean gold-trimmed white trunks "
        "and white-and-gold boxing gloves. Calculating and untouchable - the calm before the "
        "checkmate. Understated, NO big crown."
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
    "CRITICAL CONTINUITY: keep this fighter EXACTLY identical to the reference image - the same "
    "face, hair, costume, colors, build and signature details, and the same body size. Do NOT "
    "add or remove costume elements between frames, and do NOT add a crown, a chess-piece hat, "
    "or shoulder armour unless the reference already has one."
)

# Staging: the player is a SMALL opponent at the bottom-center of the screen. The enemy
# towers over them, so his head, eyes and punches all aim DOWN toward that lower target -
# never staring straight ahead or glancing/striking off to the left or right.
FOCUS = (
    "STAGING: the opponent (the player) stands close to the camera in the FOREGROUND at the "
    "bottom of the screen, BELOW and out in FRONT of this fighter (not at his feet, not on the "
    "floor he stands on). So he tilts his head DOWN-AND-FORWARD and his eyes and punches aim "
    "toward that opponent in the lower-CENTER-FRONT of the frame - never staring straight ahead "
    "and never aiming off to the left or right. "
    "Draw ONLY this single fighter, alone in the frame - do NOT draw the opponent, just imply "
    "them below and in front."
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
    return f"{IDENTITY[slug]} He is {POSE_DESC['idle']} {FOCUS} {STYLE}"

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
