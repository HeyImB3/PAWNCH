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

export const OPPONENTS = ROSTER.map((o, i) => ({
  id: i,
  index: i,
  name: o.name,
  elo: o.elo,
  tag: o.tag,
  hue: o.hue,
  boxing: boxingFromDifficulty(o.d, o.special),
}));

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
