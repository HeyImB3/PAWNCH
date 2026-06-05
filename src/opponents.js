// Story-mode roster. Difficulty climbs on BOTH axes: chess ELO (+200 a step,
// capped at 2000) and boxing skill. Each opponent has a flavor + a palette so
// they read as distinct 16-bit characters. Boxing params are derived from a
// 0..1 difficulty so they're easy to retune.

// difficulty -> boxing behaviour. d in [0,1].
function boxingFromDifficulty(d, sigName) {
  return {
    telegraphMs: Math.round(820 - d * 480),   // windup before their hit lands (longer = easier)
    recoverMs: Math.round(700 - d * 380),      // openings after they punch
    aggression: 0.25 + d * 0.55,               // how often they attack
    comboChance: d * 0.55,                     // chance to chain punches
    dodgeSkill: 0.05 + d * 0.55,               // chance to slip the player's punch
    guardChance: 0.10 + d * 0.45,              // chance to raise guard
    punchDmg: Math.round(7 + d * 11),          // damage their hits deal
    feintChance: d * 0.4,                      // fake-out telegraphs
    highChance: 0.45 + d * 0.15,               // share of attacks aimed high (head)
    // a big, readable "signature" haymaker thrown occasionally
    signature: {
      name: sigName,
      dmg: Math.round(18 + d * 22),
      telegraphMs: Math.round(1050 - d * 350),
      chance: 0.06 + d * 0.10,
    },
  };
}

const ROSTER = [
  { name: 'Patty Pushwood', elo: 400,  hue: 'orange', tag: "Wood-pusher with a soft jab.", d: 0.05, sig: 'PAWN STORM' },
  { name: 'Gus Gambit',     elo: 600,  hue: 'green',  tag: "Loves a dodgy gambit.",        d: 0.16, sig: 'GAMBIT JAB' },
  { name: 'Rosa Rookrush',  elo: 800,  hue: 'red',    tag: "Charges the rook lines.",      d: 0.27, sig: 'ROOK ROLL' },
  { name: 'Kid Knightmare', elo: 1000, hue: 'blue',   tag: "Tricky forks, trickier hooks.", d: 0.40, sig: 'FORK HOOK' },
  { name: 'Bishop Bruiser', elo: 1200, hue: 'purple', tag: "Diagonal pressure, body shots.", d: 0.52, sig: 'DIAGONAL DRIVE' },
  { name: 'Queen Quake',    elo: 1400, hue: 'pink',   tag: "Centralizes and swings hard.",  d: 0.63, sig: 'QUEEN QUAKE' },
  { name: 'Iron Endgame',   elo: 1600, hue: 'steel',  tag: "Grinds you down to the bone.",  d: 0.74, sig: 'ZUGZWANG SLAM' },
  { name: 'Tal Tempest',    elo: 1800, hue: 'teal',   tag: "Sacrifices everything — even mercy.", d: 0.85, sig: 'SAC ATTACK' },
  { name: 'Magnus Maximus', elo: 2000, hue: 'gold',   tag: "Near-perfect. Near-untouchable.", d: 0.94, sig: 'ENDGAME CRUSH' },
  { name: 'THE PAWNCHION',  elo: 2000, hue: 'champ',  tag: "Grand champion of PAWNCH.",     d: 1.0,  sig: 'CHECKMATE BLOW' },
];

export const OPPONENTS = ROSTER.map((o, i) => ({
  id: i,
  index: i,
  name: o.name,
  elo: o.elo,
  tag: o.tag,
  hue: o.hue,
  boxing: boxingFromDifficulty(o.d, o.sig),
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
