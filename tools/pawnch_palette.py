"""The PAWNCH master palette (mirrors assets/aseprite/pawnch-master.gpl) as
(r,g,b) tuples, plus the shared deterministic hash noise. Every arena/ring
painter imports from here so the whole game stays on ONE palette
(docs/ART_BIBLE.md v2 rule 2)."""
import math

# Ramp 1 — ink / steel (cool neutrals)
INK0, INK1, INK2 = (7, 10, 22), (13, 18, 38), (20, 26, 51)
STEEL0, STEEL1, STEEL2, STEEL3, STEEL4 = (38, 48, 79), (58, 74, 120), (90, 111, 160), (142, 160, 207), (205, 214, 255)
# Ramp 2 — brand blue
BLUE0, BLUE1, BLUE2, BLUE3, BLUE4, BLUE5, BLUE6 = (10, 16, 48), (19, 53, 127), (31, 79, 192), (43, 108, 255), (90, 138, 255), (111, 160, 255), (184, 208, 255)
# Ramp 3 — brand ember / orange
EMBER0, EMBER1, EMBER2, EMBER3, EMBER4, EMBER5, EMBER6, EMBER7 = (42, 10, 20), (87, 21, 40), (140, 35, 24), (193, 77, 0), (255, 122, 24), (255, 154, 58), (255, 176, 90), (255, 217, 168)
# Ramp 4 — gold
GOLD0, GOLD1, GOLD2, GOLD3, GOLD4 = (140, 90, 18), (201, 150, 42), (255, 210, 74), (255, 231, 168), (255, 246, 216)
# Ramp 5 — mat canvas (violet-blue)
MAT0, MAT1, MAT2, MAT3, MAT4, MAT5 = (14, 20, 48), (27, 35, 68), (42, 53, 102), (61, 74, 133), (85, 99, 168), (126, 136, 191)
# Ramp 6 — red / danger
RED0, RED1, RED2, RED3, RED4 = (64, 16, 30), (122, 14, 28), (194, 32, 55), (255, 59, 83), (255, 138, 150)
# Ramp 7 — wood / leather
WOOD0, WOOD1, WOOD2, WOOD3, WOOD4, WOOD5 = (22, 13, 6), (44, 28, 13), (74, 48, 24), (111, 77, 41), (154, 113, 63), (201, 155, 98)
# Ramp 8 — green accent
GREEN0, GREEN1, GREEN2, GREEN3 = (12, 43, 30), (23, 87, 58), (57, 217, 138), (138, 240, 192)
# Speculars (tiny glints only — never fills)
SPEC0, SPEC1 = (255, 255, 255), (232, 242, 255)


def n2(x, y, salt=0):
    """Deterministic hash noise in [0,1) — stable art, no RNG state."""
    h = math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
    return h - math.floor(h)
