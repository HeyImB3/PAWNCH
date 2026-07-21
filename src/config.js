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
  BREAK_SECONDS: 3.2,  // between-rounds break / heal display
};

// Deterministic simulation timing. The whole online/offline match advances on
// this fixed tick (decoupled from the display refresh rate) so two lockstep
// clients stay bit-identical. See docs/superpowers/specs/2026-06-25-online-multiplayer-design.md.
export const SIM = {
  TICK_HZ: 60,
  TICK_MS: 1000 / 60,
  MAX_CATCHUP_TICKS: 8,   // most catch-up ticks to run in one frame (spiral-of-death clamp)
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
  // procedural boxing-glove placeholder (tutorial FIGHT tile)
  gloveShade: '#a01020',   // right-side shadow on the red glove
  gloveHi:    '#ff9a9a',   // upper-left highlight
  gloveCuff:  '#ffd9c8',   // wrist cuff band
  gloveInner: '#2a0a0e',   // the dark inside of the cuff opening
  // tutorial select-screen tile backdrops (blue chess / warm fight)
  tutorChessBg: '#0e1430',
  tutorFightBg: '#160e16',
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
//     haloA is 0 — the sprites are now cropped tight to the piece body (no baked
//     glow cloud), and we deliberately skip the soft silhouette halo so nothing
//     draws a circle/glow behind the piece. The `kind` still runs, so the moving
//     sparks/embers/motes ("the magic") play on top. `halo` color is unused while
//     haloA is 0 but kept for reference / the procedural fallback.
//   ARCANE (unlockable): the original purple swirl (dark) + celestial twinkle
//     (white) — full strength, since those cleaned sprites carry no baked aura.
export const PIECE_FX = {
  celestial: {
    white: { kind: 'sun',    halo: PAL.sunGlow,    haloA: 0 },
    dark:  { kind: 'galaxy', halo: PAL.galaxyGlow, haloA: 0 },
  },
  arcane: {
    white: { kind: 'glints', halo: PAL.auraLite,   haloA: AURA.whiteAlpha },
    dark:  { kind: 'swirl',  halo: PAL.auraDark,    haloA: AURA.darkAlpha },
  },
};

// Boxing feel (Punch-Out-inspired). Times in ms unless noted.
export const BOX = {
  // A landed enemy strike SNAPS to its punch frame and HOLDS it (PUNCH_HOLD_MS) so the
  // existing hit-stop freeze (onHit) freezes the *punch* at impact, not an idle frame.
  // Kept short (Feel D): the freeze already holds the frame, so this barely delays the
  // enemy's recover/cadence and the fight stays as brutal as before. Final difficulty is
  // a playtested dial — see boxingFromDifficulty() FLOOR / parrySkill in opponents.js.
  PUNCH_HOLD_MS: 45,
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

// ---- Tutorial mode -----------------------------------------------------
// A harmless sparring dummy for the boxing tutorial — easier than Patty
// (d=0.05) by construction: very long telegraphs/recovery (huge openings),
// tiny damage, never parries, no signature/special. PRACTICE_AGGRESSION is
// dialed up only during the read-and-react lessons so it reliably feeds a
// readable punch to block / dodge / parry.
export const TUTORIAL = {
  DUMMY: {
    telegraphMs: 1000, recoverMs: 900, aggression: 0.30, comboChance: 0,
    dodgeSkill: 0.05, guardChance: 0.15, punchDmg: 4, feintChance: 0,
    highChance: 0.5, parrySkill: 0,
    signature: { name: 'WIND-UP', dmg: 6, telegraphMs: 1300, chance: 0 },
    special: null,
  },
  PRACTICE_AGGRESSION: 0.9,
};

// Procedural fighter rendering (see src/fighter.js). Sizes are buffer→screen
// blit scales for the new human sprites. STARTING values from the "Medium" mock;
// fine-tune against the live HUD in the polish phase.
export const FIGHTER = {
  SIZE: {
    enemy:  1.12,   // opponent in a fight (front)
    player: 1.37,   // you (back, foreground — reads bigger/closer)
    walk:   0.78,   // walk-to-the-board intro
    break:  0.90,   // round-break screen
    end:    1.05,   // match-end winner
  },
  ENEMY_FEET_Y: 304,   // opponent feet baseline in the 512×448 boxing scene
  PLAYER_FEET_Y: 452,  // player feet baseline (slightly off-bottom, foreground)
  OUTLINE: '#0a0a12',  // bold dark outline color (near-black)
  // Sprite "stay on your toes" idle bob — a subtle weave applied to authored sprite
  // frames during neutral poses (idle/guard/walk) so they're never static. Procedural
  // fighters already animate; this revives motion for the sprite path. Tune freely.
  BOB: { swayX: 2.4, swayFreq: 0.78, bounceY: 2.8, bounceFreq: 1.62 },
};

// Ring presentation (src/ring.js): rope physics, mat decals, reflections.
// ROPES starts from src/ropes.js ROPE_DEFAULTS — tune here, not there.
export const RING = {
  ROPES: { SAG: 4, IDLE_AMP: 0.7, IDLE_HZ: 0.35, WAVE_AMP: 9, WAVE_HZ: 7, WAVE_K: 0.035, FALLOFF: 130, DECAY_MS: 650, DEAD_MS: 2600 },
  DECALS: { MAX: 24, SCUFF_ALPHA: 0.16, SWEAT_ALPHA: 0.22 },
  REFLECT: { ALPHA: 0.13, SQUASH: 0.45 },
  PRESS_FLASH_POINTS: [[40, 418], [112, 410], [430, 414], [482, 420]], // lens xy (screen)
};

// Lighting/FX presentation (src/lighting.js).
export const LIGHT = {
  SPOT: { EASE_MS: 240, DIM: 0.78, CONE_ALPHA: 0.22, TOP_HALF_W: 26, HOLE_R: 150 },
  FLASH: { LIFE_MS: 190, BIG_HIT: 5, KNOCKDOWN: 12, PARRY: 4, SCATTER: 60 },
  // per-scene key light on fighters (withRim): SPAN = fraction of the screen
  // width the directional sun-side gradient covers; SCALE multiplies the
  // scene's key.alpha (global dial).
  RIM: { SCALE: 1.0, SPAN: 0.55 },
};

// Arena scenery (boxing-half backdrops). One scene per Story fighter, plus a
// built-in CLASSIC ring. Story forces the opponent's arena; multiplayer uses the
// player's unlocked, selected arena (see save.settings.arena). All scene tuning
// lives here so draw code (src/scenery.js) holds no magic numbers / raw hex.
export const SCENERY = {
  // opponent index (0..9) -> scene id. Index-aligned to the ROSTER in opponents.js.
  OPPONENT_SCENES: ['beach', 'woods', 'cyber', 'dream', 'temple', 'castle', 'space', 'abyss', 'chesshall', 'stadium'],
  // display names (Settings arena picker + unlock toast)
  NAMES: {
    classic: 'CLASSIC RING', beach: 'TROPICAL BEACH', woods: 'SPOOKY WOODS',
    cyber: 'CYBERPUNK STREET', dream: 'DREAM WORLD', temple: 'MOUNTAIN TEMPLE',
    castle: 'SKY CASTLE', space: 'DEEP SPACE', abyss: 'UNDERWATER CAVE',
    chesshall: 'GRAND CHESS HALL', stadium: 'MEGA STADIUM',
  },
  ANIM: 1.0,          // global ambient-motion speed multiplier (turn scenes calmer/busier)
  CROWD_FLARE: 0.45,  // extra audience brightness on big hits (driven by boxing `crowd` 0..1)
  // per-scene palettes + density/speed knobs. Colors are scene-specific (NOT brand
  // palette) so they live here, namespaced, instead of in PAL.
  SCENES: {
    // CLASSIC v2 (layered): painted truss/crowd layer + volumetric lamp cones,
    // drifting haze, phone-light twinkles. Used only when arenas/classic/mid.png
    // is registered; the zero-asset fallback keeps the original classicScene.
    classic: { lampXs: [88, 152, 360, 424], lampY: 24, cone: '#cdd6ff', coneA: 0.10, haze: '#3a4a78', phone: '#b8d0ff', phoneN: 22, twinkleHz: 2 },
    beach:   {
      sky: ['#7ad0ff', '#bfe9ff', '#ffd9a0', '#f2c27a'], sun: '#fff6cf', sunGlow: '#ffd24a', sea: '#3aa7e0', seaHi: '#7fd0ef', sand: '#e7c486', palm: '#3a2410', leaf: '#2f9b54', crowd: '#3a2a1a', crowdN: 22, palms: 2,
      // layered-scene (drawLayered) knobs — geometry mirrors the painted layers
      L: {
        sun: [150, 78], sunGlowR: 34, horizonY: 92,
        rays: [[150, 78, 300, 170, 0.06], [150, 78, 420, 170, 0.045], [150, 78, 210, 170, 0.05]], // [x0,y0,x1,floorY,alpha]
        rayW: [10, 46],                    // half-width at source -> at floor
        sparkleN: 12, sparkleX: [124, 176],
        foamY: 119, foamAmp: 2.2, foamSpeed: 1.4,
        torches: [[88, 96], [190, 104], [322, 104], [424, 96]],
        wire: [[36, 52], [470, 52]], wireSag: 12, lanternN: 7,
        ballX: [30, 150], ballY: 132,      // beach-ball bounce zone (left bleachers)
        crabPeriod: 47, crabDur: 6, crabY: 152,
        frondSway: 1.2, frondHz: 0.8,      // near-layer wind sway (px, cycles/sec)
        // scene-specific FX colors (namespaced here per Golden Rules 2-3)
        rayCol: '#ffd24a', bloomCol: '#ff9a3a', sparkleCol: '#ffe7a8',
        foamCol: 'rgba(232,242,255,0.75)',
        lantBody: '#c9962a', lantCore: '#ffe7a8', lantGlow: '#ffd24a',
        ballCol: '#ff7a18', ballHi: '#e8f2ff', crabCol: '#c22037', flareCol: '#ff9a3a',
      },
      key: { color: '#ffd24a', alpha: 0.20, wash: '#ff9a3a', washA: 0.05 },  // golden-hour key light
    },
    woods:   {
      sky: ['#0d1f15', '#06120c', '#040a06'], trunk: '#0c1c14', trunkN: 5, fireCore: '#fff6c0', fireMid: '#ff9a18', fireGlow: '#ffb24a', candleN: 6, fly: '#bfff7a', flyN: 7, crowd: '#0a140e', crowdN: 14,
      // layered-scene (drawLayered) knobs — geometry mirrors the painted layers
      L: {
        moon: [392, 30], moonGlowR: 26,
        candles: [[70, 118], [128, 132], [196, 140], [316, 140], [384, 132], [442, 118], [60, 90], [452, 90]],
        jars: [[110, 34], [300, 40]],       // hanging candle-jar glow points
        fogY: [128, 166], fogN: 3, fogCol: '#26304f',
        flyN: 9, flyCol: '#8af0c0',
        eyesPeriod: 23, eyesDur: 2.2, eyesN: 3, eyesCol: '#39d98a',
        shaftAlpha: 0.07, shaftCol: '#cdd6ff',
        mossSway: 1.0, mossHz: 0.5,
        flareCol: '#39d98a',
      },
      key: { color: '#8ea0cf', alpha: 0.14, wash: '#17573a', washA: 0.035 },  // cold moon rim, faint forest grade
    },
    cyber:   {
      sky: ['#13062a', '#1a0830', '#070414'], bld: '#0a0618', bldN: 6, neon: ['#ff3bd0', '#22e7ff', '#ffe14a', '#7a5cff'], crowd: '#7a9bff', crowdN: 30, rain: 'rgba(150,200,255,0.10)',
      // layered-scene (drawLayered) knobs — geometry mirrors the painted layers
      L: {
        sign: [44, 74],                  // HOTEL ROOK glow center
        billboard: [256, 30],            // holo-rook projection center
        steam: [[170, 150], [352, 146]],
        railY: 58, trainPeriod: 41, trainDur: 3.5, trainCars: 4,
        droneN: 2, rainN: 46,
        neonM: '#ff3bd0', neonC: '#22e7ff',
        trainWin: '#ffd24a', flareCol: '#7a5cff',
      },
      key: { color: '#ff3bd0', alpha: 0.15, wash: '#7a5cff', washA: 0.05 },  // magenta rim, violet grade
    },
    dream:   {
      sky: ['#5a2a8a', '#b85cc0', '#ffb0d6', '#8fd0ff'], cloud: 'rgba(255,255,255,0.6)', shape: 'rgba(255,255,255,0.5)', ghost: 'rgba(255,255,255,0.45)', ghostN: 5, star: '#ffffff', starN: 10,
      // layered-scene (drawLayered) knobs — geometry mirrors the painted layers
      L: {
        bust: [388, 72], bustBob: 3, bustHz: 0.4,
        falls: [[120, 96], [300, 84]],
        auroraY: [18, 44],
        hueCycle: ['#7a5cff', '#ff8a96', '#39d98a'], hueA: 0.05, hueHz: 0.08,
        shootPeriod: 9, shootDur: 0.7,
        sheepPeriod: 53, sheepDur: 5, sheepY: 120,
        wispSway: 1.5, wispHz: 0.5, flareCol: '#b8d0ff',
      },
      key: { color: '#ff8a96', alpha: 0.12, wash: '#7a5cff', washA: 0.04 },  // soft pink rim, violet grade
    },
    temple:  { sky: ['#caa0ff', '#9a5cff', '#5a3a8a'], peak: '#4a2f7a', peak2: '#3a2566', stone: '#3a2566', stoneHi: '#52397f', roof: '#2a1a4a', flag: ['#ff7a18', '#ffd24a'], cloud: 'rgba(255,255,255,0.5)', monk: '#1e1232', monkN: 16 },
    castle:  { sky: ['#8fd0ff', '#bfe6ff', '#e8f4ff'], cloud: '#ffffff', cloudN: 4, keep: '#9aa6c8', tower: '#8a96b8', roof: '#ff3b53', banner: '#ff7a18', crowd: '#2a2040', crowdN: 18, bird: '#22324f' },
    space:   { core: '#1a1040', edge: '#020108', star: '#ffffff', starN: 22, planet: ['#7a9bff', '#2b4cc0', '#16236a'], ring: 'rgba(111,160,255,0.5)', neb: '#7a5cff', gallery: '#0e1a3a', ast: '#cfe0ff', astN: 6 },
    abyss:   { sky: ['#0a4a52', '#073238', '#04181c'], rock: '#06262b', fireCore: '#fff3c0', fireMid: '#ff8a18', fireGlow: '#ff9a3a', fireN: 3, jelly: ['#ffd0ff', '#c46aff'], jellyN: 5, bub: 'rgba(191,239,255,0.55)', bubN: 8 },
    chesshall: { sky: ['#2a1d3a', '#1a1228', '#0e0a18'], col: '#2e2348', win: '#3a2f6a', chand: '#ffd24a', chandN: 3, table: '#4a3018', tableTop: '#6f4d29', head: '#d8c0a0', headN: 7, piece: '#f0e3c8' },
    stadium: { sky: ['#0a1430', '#13357f', '#1a4a9a'], tiers: ['#ff7a18', '#2b6cff', '#ffd24a', '#39d98a'], tierN: 3, light: '#ffffff', jumbo: '#020610', jumboFrame: '#3a4a78', conf: ['#ff7a18', '#ffd24a', '#2b6cff'], floor: '#2a3566' },
  },
};
