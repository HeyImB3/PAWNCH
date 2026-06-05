// PAWNCH — central tuning + palette. Tweak the game's feel from one place.

export const VIEW = { W: 512, H: 448 };

// Round / match structure
export const MATCH = {
  TOTAL_ROUNDS: 10,
  // ONE continuous chess game per match. Each player's clock is set once at the
  // start and persists round-to-round (it only ticks during chess halves), so
  // every chess half resumes exactly where you left off.
  CHESS_SECONDS: 60,          // per-player clock for the WHOLE match (continuous)
  CHESS_INCREMENT_MS: 3000,   // Fischer increment added per move (keeps it spanning rounds)
  CHESS_HALF_SECONDS: 60,     // wall-time window for each round's chess half
  BOXING_SECONDS: 60,  // boxing time limit per round
  // fraction of max health restored at the start of each NEW round (rounds 2..10)
  HEAL_MIN: 0.10,
  HEAL_MAX: 0.15,
  WALK_SECONDS: 4,     // walk-to-the-board flair (3-5s)
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
  // ring
  ringFloor:  '#2a3566',
  ringFloor2: '#222c57',
  ringRope:   '#ff7a18',
  ringPost:   '#1a2244',
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
};

// Chess AI think-time bounds (humanizes clock usage)
export const CHESS = {
  MIN_MOVE_MS: 1000,
  MAX_MOVE_MS: 7000,
};

export const SAVE_KEY = 'pawnch.save.v1';

// Optional online server. Leave url null to default to ws://<host>:8080 in dev.
export const NET = {
  url: null,
};
