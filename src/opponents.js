// Story-mode roster. Difficulty climbs on BOTH axes: chess ELO (+200 a step,
// capped at 2000) and boxing skill. Each opponent has a flavor + a palette so
// they read as distinct 16-bit characters. Boxing params are derived from a
// 0..1 difficulty so they're easy to retune.

// difficulty -> boxing behaviour. d in [0,1]. The baseline is deliberately
// read-and-react (Punch-Out style): tells are visible, but whiffing or eating a
// shot is punishing, and it tightens fast as the ladder climbs.
function boxingFromDifficulty(d, special) {
  // "Hard cliff after Patty." Patty (d<=0.1) stays a genuine gentle tutorial so
  // players can learn the controls + parry. EVERYONE after him is lifted onto a
  // high difficulty band: their EFFECTIVE difficulty D starts at FLOOR (~the old
  // upper-mid) for fight 2 and ramps to 1.0 at the champion. The ladder's curve is
  // preserved — just compressed into a much tougher range so nobody can breeze
  // through the mid-roster by button-mashing. Re-tune feel here: FLOOR sets the
  // cliff height, the mix() endpoints set the ceiling.
  //
  // FLOOR is the main mid-roster dial. Because D interpolates toward a FIXED top
  // of 1.0, raising FLOOR lifts fights 2-7 the most and barely moves the top three
  // (8-10), which already feel right. Bump it again later if 2-7 still feel soft.
  const FLOOR = 0.68;
  const D = d <= 0.1 ? d : FLOOR + (1 - FLOOR) * (d - 0.16) / (1 - 0.16);
  const mix = (easy, hard) => easy + (hard - easy) * D;
  return {
    telegraphMs: Math.round(mix(720, 220)),    // windup before their hit lands (shorter = harder to read)
    recoverMs: Math.round(mix(560, 140)),      // opening after they punch (smaller = far less counter time)
    aggression: mix(0.45, 1.0),                // how often they attack
    comboChance: mix(0.12, 0.88),              // chance to chain punches
    dodgeSkill: mix(0.16, 0.85),               // chance to slip the player's punch
    guardChance: mix(0.18, 0.62),              // chance to raise guard
    punchDmg: Math.round(mix(9, 32)),          // damage their hits deal
    feintChance: mix(0.05, 0.62),              // fake-out telegraphs
    highChance: mix(0.45, 0.62),               // share of attacks aimed high (head)
    // "Sharp readers": skill at PERFECT-PARRYING the player's punches (reads a
    // commit and guards into the parry window — punishes mashing). OFF only for
    // Patty; a strong baseline from fight 2, climbing the ladder. Pairs with a
    // short AI cooldown (config) and a punish combo (boxing.js _enemyPunishCombo).
    parrySkill: d <= 0.1 ? 0 : Math.min(0.92, 0.40 + D * 0.58),
    // a generic heavy "haymaker" — part of the baseline kit (occasional big hook)
    signature: {
      name: 'HAYMAKER',
      dmg: Math.round(mix(20, 54)),
      telegraphMs: Math.round(mix(960, 540)),
      chance: mix(0.05, 0.20),
    },
    // the opponent's ONE unique, themed boss move (see buildSpecial in boxing.js)
    special: buildSpecialDef(special, D),
  };
}

// Resolve a per-character special descriptor into runtime params, scaling its
// damage/speed with difficulty `d` so the boss move bites harder up the ladder.
function buildSpecialDef(s, d) {
  return {
    name: s.name,
    type: s.type,
    dmg: Math.round((s.dmgBase ?? 16) + d * (s.dmgScale ?? 22)),
    telegraphMs: Math.round((s.tgBase ?? 1000) - d * (s.tgScale ?? 340)),
    hits: s.hits ?? 3,
    gapMs: s.gapMs ?? 150,
    lowFirst: s.lowFirst ?? true,
    target: s.target ?? 'high',
    cooldownMs: s.cooldownMs ?? 5200,           // min time between boss moves (learnable cadence)
    chance: s.chance ?? (0.45 + d * 0.30),      // odds to use it when attacking & off cooldown
  };
}

const ROSTER = [
  { name: 'Patty Pushwood', elo: 400,  hue: 'orange', tag: "Wood-pusher with a soft jab.",       d: 0.05,
    // a "storm" of weak pawns — a slow flurry of light jabs that teaches the rhythm dodge.
    special: { name: 'PAWN STORM', type: 'flurry', hits: 3, gapMs: 200, dmgBase: 5, dmgScale: 6, tgBase: 540, tgScale: 120, cooldownMs: 6200, chance: 0.55 } },
  { name: 'Gus Gambit',     elo: 600,  hue: 'green',  tag: "Loves a dodgy gambit.",               d: 0.16,
    // a gambit = a trap: fakes one side, lands from the other.
    special: { name: 'GAMBIT JAB', type: 'feint', dmgBase: 12, dmgScale: 16, tgBase: 640, tgScale: 220, cooldownMs: 5600 } },
  { name: 'Rosa Rookrush',  elo: 800,  hue: 'red',    tag: "Charges the rook lines.",             d: 0.27,
    // rooks charge in straight lines — a fast, heavier four-jab roll.
    special: { name: 'ROOK ROLL', type: 'flurry', hits: 4, gapMs: 150, dmgBase: 7, dmgScale: 9, tgBase: 480, tgScale: 150, cooldownMs: 5400 } },
  { name: 'Kid Knightmare', elo: 1000, hue: 'blue',   tag: "Tricky forks, trickier hooks.",       d: 0.40,
    // a knight fork hits two squares at once — a head feint into a body rip.
    special: { name: 'FORK HOOK', type: 'lowhigh', lowFirst: false, dmgBase: 12, dmgScale: 16, tgBase: 560, tgScale: 190, gapMs: 170, cooldownMs: 5200 } },
  { name: 'Bishop Bruiser', elo: 1200, hue: 'purple', tag: "Diagonal pressure, body shots.",      d: 0.52,
    // a diagonal drive sweeps up from the body to the head.
    special: { name: 'DIAGONAL DRIVE', type: 'lowhigh', lowFirst: true, dmgBase: 13, dmgScale: 17, tgBase: 520, tgScale: 190, gapMs: 150, cooldownMs: 5000 } },
  { name: 'Queen Quake',    elo: 1400, hue: 'pink',   tag: "Centralizes and swings hard.",        d: 0.63,
    // the queen winds up a ground-shaking bomb — slip it for a free combo.
    special: { name: 'QUEEN QUAKE', type: 'charge', dmgBase: 26, dmgScale: 24, tgBase: 1150, tgScale: 300, cooldownMs: 5200 } },
  { name: 'Iron Endgame',   elo: 1600, hue: 'steel',  tag: "Grinds you down to the bone.",        d: 0.74,
    // zugzwang: you're forced to move — guard won't save you, you MUST slip.
    special: { name: 'ZUGZWANG SLAM', type: 'unblockable', target: 'high', dmgBase: 20, dmgScale: 22, tgBase: 780, tgScale: 270, cooldownMs: 4800 } },
  { name: 'Tal Tempest',    elo: 1800, hue: 'teal',   tag: "Sacrifices everything — even mercy.", d: 0.85,
    // a sacrificial storm — five relentless shots, but a big opening after.
    special: { name: 'SAC ATTACK', type: 'flurry', hits: 5, gapMs: 120, dmgBase: 9, dmgScale: 11, tgBase: 430, tgScale: 140, cooldownMs: 4600, chance: 0.7 } },
  { name: 'Magnus Maximus', elo: 2000, hue: 'gold',   tag: "Near-perfect. Near-untouchable.",     d: 0.94,
    // near-untouchable: a counter stance that punishes any punch — wait it out.
    special: { name: 'ENDGAME CRUSH', type: 'counterstance', dmgBase: 22, dmgScale: 24, tgBase: 900, tgScale: 260, cooldownMs: 4600 } },
  { name: 'THE PAWNCHION',  elo: 2000, hue: 'champ',  tag: "Grand champion of PAWNCH.",           d: 1.0,
    // checkmate: a feint into an unblockable finisher — the last thing you read wrong.
    special: { name: 'CHECKMATE BLOW', type: 'checkmate', dmgBase: 24, dmgScale: 30, tgBase: 820, tgScale: 280, cooldownMs: 4200 } },
];

export const HUE = {
  orange: { body: '#ff7a18', trim: '#c14d00', skin: '#f2b07a' },
  green:  { body: '#39d98a', trim: '#1f7a4d', skin: '#e8a878' },
  red:    { body: '#ff3b53', trim: '#a01020', skin: '#d99a6a' },
  blue:   { body: '#2b6cff', trim: '#13357f', skin: '#f2b07a' },
  purple: { body: '#9a5cff', trim: '#4a2a8a', skin: '#caa0e0' },
  pink:   { body: '#ff6ab0', trim: '#a02060', skin: '#f2b07a' },
  steel:  { body: '#8fa0c0', trim: '#4a5570', skin: '#c8a888' },
  teal:   { body: '#1fc8d0', trim: '#0a6a70', skin: '#e8b888' },
  gold:   { body: '#ffd24a', trim: '#a07810', skin: '#f2b07a' },
  champ:  { body: '#ff7a18', trim: '#2b6cff', skin: '#f2c090' },
  player: { body: '#2b6cff', trim: '#13357f', skin: '#f2b07a' },
};

// Per-fighter visual `look` (consumed by src/fighter.js). Build fields are
// proportion multipliers on the neutral skeleton (default 1). `chest` is the
// build width; `emblem` is the chest MOTIF (distinct keys — do not merge).
const LOOKS = {
  0:{ hgt:0.84, head:1.12, shoulder:0.84, chest:1.0, waist:1.2, hip:1.12, glove:1.28, belly:1, bob:1.6,
      headgear:'pawnDomeShort', emblem:'pawnGlyph',
      special:{name:'PAWN STORM',frame:'bothLow',fx:'pips'}, face:{brows:'hopeful',mouth:'grin',cheekDab:true} },
  1:{ hgt:0.93, shoulder:0.9, waist:0.85,
      headgear:'pawnDomeTall', sash:{dir:'LR'},
      special:{name:'GAMBIT JAB',frame:'oneLoadedHigh',fx:'spark'}, face:{brows:'cocked',mouth:'smirk'} },
  2:{ hgt:0.95, shoulder:1.12, chest:1.08, waist:1.0,
      headgear:'rookChimney', emblem:'brick',
      special:{name:'ROOK ROLL',frame:'bothLow',fx:'streak'}, face:{brows:'angryV',mouth:'grin',hairCol:'#7a0c18'} },
  3:{ hgt:0.97, shoulder:0.9, waist:0.82, chest:1.0,
      headgear:'knightVisor', emblem:'fork', hair:'none',
      special:{name:'FORK HOOK',frame:'bothHighFeint',fx:'spark'}, face:{brows:'cocked',mouth:'smirk'} },
  4:{ hgt:1.03, shoulder:1.05, waist:0.85,
      headgear:'mitre', sash:{dir:'RL'},
      special:{name:'DIAGONAL DRIVE',frame:'oneLoadedLow',fx:'diag'}, face:{brows:'flatHeavy',mouth:'flat'} },
  5:{ hgt:1.06, shoulder:1.12, chest:1.05,
      headgear:'queenCoronet', sash:{dir:'LR',wide:true},
      special:{name:'QUEEN QUAKE',frame:'overhead',fx:'quake'}, face:{brows:'angryV',mouth:'lipstick',hooded:true,cheekMark:true} },
  6:{ hgt:0.98, head:0.92, shoulder:1.5, chest:1.25, waist:0.9, thigh:1.18, bob:0.2,
      headgear:'rookStub', emblem:'rivets',
      special:{name:'ZUGZWANG SLAM',frame:'maul',fx:'forge'}, face:{brows:'bar',mouth:'flat',eyeCol:'#2a2a30'} },
  7:{ hgt:1.06, shoulder:1.0, waist:0.78, bob:1.4,
      headgear:'none', hair:'stormMane', sash:{dir:'RL',pips:3},
      special:{name:'SAC ATTACK',frame:'crucifix',fx:'bolt'}, face:{brows:'angryV',mouth:'smirk',widowPeak:true,catchlight:true,stubble:true} },
  8:{ hgt:1.12, shoulder:1.15, chest:1.05, waist:0.95, bob:0.25,
      headgear:'kingCrown', hair:'sideSwept', hairCol:'#7a5836', heavyJaw:true, sash:{dir:'LR',stud:true},
      special:{name:'ENDGAME CRUSH',frame:'counter',fx:'aura'}, face:{brows:'flatHeavy',mouth:'smirk',hooded:true,stubble:true} },
  9:{ hgt:1.18, shoulder:1.2, chest:1.1, waist:0.9, towers:true, gloveTint:'orange',
      headgear:'amalgam', hair:'none', emblem:'kingcross', sash:{dir:'LR',stud:true},
      special:{name:'CHECKMATE BLOW',frame:'oneLoadedHigh',fx:'streak'}, face:{brows:'bar',mouth:'flat',glint:true} },
};

// Fighter index -> boxer sprite-set slug (matches assets/sprites/boxers/<slug>).
// Only fighters with authored art need an entry; the rest stay procedural.
const SPRITE_SLUG = { 9: 'pawnchion' };

// The player (drawn back-view in a fight, front on win screens). No chess gimmick.
export const HERO_LOOK = { hue: HUE.player, hgt:1.06, shoulder:1.05, waist:0.8, sprite: 'player',
  headgear:'none', special:{name:'UPPERCUT',frame:'uppercut'}, face:{brows:'hopeful',mouth:'grin'} };

// Fallback look for PVP/online enemies (no Story `look`): a plain red boxer.
export const DEFAULT_LOOK = { hue: HUE.red, hgt:1.0, shoulder:1.0, waist:1.0,
  headgear:'none', special:{name:'HAYMAKER',frame:'oneLoadedHigh',fx:'streak'}, face:{brows:'flat',mouth:'flat'} };

export const OPPONENTS = ROSTER.map((o, i) => ({
  id: i,
  index: i,
  name: o.name,
  elo: o.elo,
  tag: o.tag,
  hue: o.hue,
  boxing: boxingFromDifficulty(o.d, o.special),
  look: { ...(LOOKS[i] || {}), hue: HUE[o.hue] || HUE.red, sprite: SPRITE_SLUG[i] },   // resolved palette + optional sprite set
}));
