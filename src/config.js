// PAWNCH — central tuning + palette. Tweak the game's feel from one place.

export const VIEW = { W: 512, H: 448 };

// Round / match structure
export const MATCH = {
  TOTAL_ROUNDS: 10,
  // ONE continuous chess game per match. Each player's clock is set once at the
  // start and persists round-to-round (it only ticks during chess halves), so
  // every chess half resumes exactly where you left off.
  CHESS_SECONDS: 300,         // per-player clock for the WHOLE match (continuous) — 5 min each
  CHESS_INCREMENT_MS: 3000,   // Fischer increment added per move (keeps it spanning rounds)
  CHESS_HALF_SECONDS: 60,     // wall-time window for each round's chess half
  BOXING_SECONDS: 60,  // boxing time limit per round
  // fraction of max health restored at the start of each NEW round (rounds 2..10)
  HEAL_MIN: 0.10,
  HEAL_MAX: 0.15,
  // Skip-the-chess deterrent: a human side that makes NO move during a round's
  // chess half has its HP capped at this value for that round's boxing half
  // (no effect if it's already below the cap, so a hurt fighter isn't punished
  // twice). Applied only at that one chess->boxing handoff, so it never carries
  // into later rounds.
  NO_MOVE_HP_CAP: 50,
  WALK_SECONDS: 2.6,   // walk-to-the-board flair (snappy, not awkward)
};

// 16-bit-ish palette. Orange + blue lead; everything else supports.
export const PAL = {
  // brand
  orange:     '#ff7a18',
  orangeLite: '#ffb05a',
  orangeDark: '#c14d00',
  blue:       '#2b6cff',
  blueLite:   '#6fa0ff',
  blueDark:   '#13357f',
  // ui / neutrals
  ink:        '#070a16',
  ink2:       '#0d1226',
  panel:      '#141a33',
  panel2:     '#1d2647',
  line:       '#3a4a78',
  text:       '#eaf0ff',
  textDim:    '#8ea0cf',
  white:      '#ffffff',
  black:      '#000000',
  gold:       '#ffd24a',
  red:        '#ff3b53',
  green:      '#39d98a',
  // chess board
  boardLight: '#ffd9a8',
  boardDark:  '#b85c1f',
  boardEdge:  '#5a2a08',
  // chess-half piece auras (animated magic). The unlockable ARCANE set keeps the
  // original look: dark pieces swirl purple/magenta, white pieces twinkle with
  // celestial blue/white glints.
  auraDark:    '#9646d2',   // dark-piece purple aura
  moteViolet:  '#b061ff',
  moteMagenta: '#ff4d9d',
  ember:       '#d078ff',
  auraLite:    '#6fa8ff',   // white-piece celestial aura
  glintCore:   '#d2e8ff',
  glint:       '#e8f2ff',
  // Default CELESTIAL set — WHITE pieces are imbued with the "magic of the sun"
  // (warm gold/orange radiance), DARK pieces with the "magic of supernovas &
  // galaxies" (cool cosmic blues/violet).
  sunGlow:     '#ff8a1e',   // warm halo behind a white piece
  sunCore:     '#ffe7a8',   // bright spark core
  sunFlare:    '#ffd24a',   // gold rays / glint lines
  sunEmber:    '#ffb24a',   // rising warm ember
  galaxyGlow:  '#2b6cff',   // cool halo behind a dark piece
  galaxyCore:  '#bcd4ff',   // distant-star core
  galaxyStar:  '#9fd0ff',   // orbiting star mote
  galaxyNebula:'#7a5cff',   // violet nebula mote
  // ring
  ringFloor:  '#2a3566',
  ringFloor2: '#222c57',
  ringRope:   '#ff7a18',
  ringPost:   '#1a2244',
};

// Chess-half piece aura sizing. Kept TIGHT so the magic hugs each piece and
// reads as atmosphere instead of muddling the board. Every radius/size below is
// a fraction of the piece's on-screen `size`; alphas are the base (pre-pulse).
export const AURA = {
  haloRadius: 0.46,   // soft glow radius behind the piece (was ~0.60)
  haloPulse:  0.05,   // how much the halo breathes
  whiteAlpha: 0.11,   // white-piece halo strength
  darkAlpha:  0.14,   // dark-piece halo strength
  // white celestial star-glints (twinkle around the piece)
  glintCount:  4,
  glintOrbitX: 0.34,  // horizontal orbit radius (was 0.50)
  glintOrbitY: 0.30,  // vertical orbit radius   (was 0.44)
  glintSize:   0.07,  // glint scale             (was 0.085)
  // dark orbiting motes + rising embers
  moteCount:  4,
  moteOrbitX: 0.34,   // (was 0.46)
  moteOrbitY: 0.24,   // (was 0.30)
  moteSize:   0.05,   // (was 0.06)
  emberRise:  0.48,   // how high embers climb above the piece (was 0.80)
  emberSway:  0.12,   // ember horizontal drift (was 0.16)
};

// Per-SET magic theme. Each named piece set (see assets/sprites/manifest.json)
// maps a piece color -> an animation `kind` (drawn in gfx.js `pieceAura`), a
// halo color, and `haloA` (base back-glow alpha, pre-pulse).
//   CELESTIAL (default): white = "sun" (warm), dark = "galaxy/supernova" (cool).
//     Alphas are kept low so the engine aura COMPLEMENTS the art's baked glow.
//   ARCANE (unlockable): the original purple swirl (dark) + celestial twinkle
//     (white) — full strength, since those cleaned sprites carry no baked aura.
export const PIECE_FX = {
  celestial: {
    white: { kind: 'sun',    halo: PAL.sunGlow,    haloA: 0.10 },
    dark:  { kind: 'galaxy', halo: PAL.galaxyGlow, haloA: 0.12 },
  },
  arcane: {
    white: { kind: 'glints', halo: PAL.auraLite,   haloA: AURA.whiteAlpha },
    dark:  { kind: 'swirl',  halo: PAL.auraDark,    haloA: AURA.darkAlpha },
  },
};

// Boxing feel (Punch-Out-inspired). Times in ms unless noted.
export const BOX = {
  MAX_HP: 100,
  PLAYER_JAB_DMG: 6,
  PLAYER_HOOK_DMG: 13,
  PLAYER_JAB_WINDUP: 90,
  PLAYER_HOOK_WINDUP: 220,
  PLAYER_RECOVER: 260,     // brief commit after a punch
  DODGE_TIME: 360,         // i-frame window while dodging
  DUCK_TIME: 420,
  BLOCK_REDUCTION: 0.75,   // damage multiplier reduction while guarding
  STAR_DMG: 26,            // counter / star punch
  // Best-of-3 knockdowns (Tyson's Punch-Out style). A fighter who hits 0 HP is
  // knocked DOWN; the ref counts to GET_UP_COUNT seconds. Survive the count on
  // your 1st/2nd fall and you RISE (restored to GET_UP_HP). Your KNOCKDOWNS_TO_KO-th
  // fall = counted out = the match is lost. The round clock PAUSES during a count.
  GET_UP_COUNT: 10,        // seconds the ref counts on a knockdown (was 3)
  KNOCKDOWNS_TO_KO: 3,     // 3rd knockdown ends it (best of 3)
  GET_UP_HP: 45,           // HP a fighter rises with after beating the count
  // GET-UP minigame (Tyson's Punch-Out style). While DOWN you mash to charge a
  // power bar to 1.0 before the ref reaches GET_UP_COUNT, or you're counted out.
  // Index 0 = your 1ST fall (easy), index 1 = your 2ND fall (hard). The FINAL
  // (3rd) fall is an automatic TKO — no bar, no chance to rise.
  GET_UP: {
    CHARGE_PER_TAP: [0.075, 0.068], // fill added per mash on fall 1 / fall 2
    DECAY_PER_SEC:  [0.17, 0.36],   // fill bleeds away each second (mash to outrun it)
    AI_CHARGE_PER_SEC: [0.62, 0.58],// the CPU claws its way up on its own (story)
  },
  // PERFECT PARRY (anti-mash skill move). Raising guard opens a brief parry
  // WINDOW: a blockable hit that lands inside it is PARRIED — no damage, and the
  // attacker is STAGGERED (frozen, flashing red) for STUN_MS, handing the parrier
  // a free opening. You can't fish for it: after a window closes you can't open a
  // new one for LOCKOUT_MS, and a window that expires unused costs WHIFF_STAMINA.
  // Unblockable boss specials ignore parry (you must still slip/duck them).
  PARRY: {
    WINDOW_MS: 150,        // player's parry window after raising guard (a fresh tap)
    AI_WINDOW_MS: 170,     // the bot's window when it reads a punch and guards to parry (a touch wider = reliable)
    STUN_MS: 1500,         // stagger inflicted on a parried attacker (their "1.5 free seconds" given up)
    LOCKOUT_MS: 360,       // after a window closes, how long before a new one can open
    WHIFF_STAMINA: 8,      // stamina lost when a parry window expires without a parry
    AI_COOLDOWN_MS: 1250,  // minimum gap between a bot's parry attempts (lower = sharper readers / more parries)
  },
};

// Chess AI think-time bounds (humanizes clock usage)
export const CHESS = {
  // --- Humanized "reveal delay" -----------------------------------------
  // The delay before the bot plays is DECOUPLED from how long Stockfish
  // actually searches: it searches briefly (SEARCH_MS) but waits out a longer,
  // human-feeling pause before moving. The whole pause burns the bot's clock
  // like a real player's time (both sides have a generous 5-min continuous clock).
  SEARCH_MS: 700,                 // Stockfish's real search budget per move
  OPENING_MOVES: 10,              // the bot's first N moves use the quick band
  OPENING_DELAY_MS: [600, 2200],  // moves 1–10: snappy book-like play
  MID_DELAY_MS: [1000, 4000],     // after move 10: normal pace
  PRECISE_DELAY_MS: [5000, 10000],// after move 10, on a "tough/precise" move

  // What makes a move "precise" (engine-inferred — Stockfish never says so):
  PRECISE_SWING_CP: 120,          // eval swung >= this many centipawns vs the
                                  // bot's previous move (a critical moment)
  // A forced mate (score mate N) always counts as precise.
};

// Hidden developer shortcut. Holding the two combo keys together for HOLD_MS
// during a chess or boxing half fast-forwards to the other half — lets me test
// the live build without playing through a whole half. Not advertised in-game.
export const DEV = {
  SKIP_COMBO: ['KeyB', 'Digit3'],   // hold "B" + "3" together…
  SKIP_HOLD_MS: 7000,               // …for this long to skip the current half
};

export const SAVE_KEY = 'pawnch.save.v1';

// Optional online server. Leave url null to default to ws://<host>:8080 in dev.
export const NET = {
  url: null,
};
