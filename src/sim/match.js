// Unified deterministic match sim — Phase 2-A-1 skeleton (flow machine + boxing).
// Chess is a fixed-length stub here; real chess lands in 2-A-2.
import { MATCH, SIM } from '../config.js';
import { newRng, rngFloat, rngInt } from './rng.js';
import { BoxingMatch, snapshotBox, restoreBox } from './box.js';

const WALK_TICKS = Math.round(MATCH.WALK_SECONDS * SIM.TICK_HZ);
const CHESS_STUB_TICKS = Math.round((MATCH.CHESS_HALF_SECONDS || 60) * SIM.TICK_HZ);
const BREAK_TICKS = Math.round(MATCH.BREAK_SECONDS * SIM.TICK_HZ);

function nextSeed(rng) { return rngInt(rng, 0x100000000); }   // uint32 seed, advances rng

export function newMatch(config) {
  const rng = newRng((config.seed >>> 0) || 1);
  const playerColor = rngFloat(rng) < 0.5 ? 'w' : 'b';        // coin flip from the seed
  return {
    tick: 0, phase: 'walk', phaseTick: 0, rng,
    round: 1, mode: config.mode || 'story', playerColor,
    enemyParams: config.enemyParams || null,
    hp: { player: config.startHP?.player ?? 100, enemy: config.startHP?.enemy ?? 100 },
    box: null, over: false, winner: null, reason: null,
  };
}

function startBoxing(s) {
  const box = new BoxingMatch({
    mode: s.mode === 'pvp' ? 'pvp' : 'story',
    enemyParams: s.enemyParams || undefined,
    seconds: MATCH.BOXING_SECONDS,
    startHP: { player: s.hp.player, enemy: s.hp.enemy },
    seed: nextSeed(s.rng), hooks: {}, onKO() {}, onTime() {},
  });
  s.box = snapshotBox(box); s.phase = 'boxing'; s.phaseTick = 0;
}

function applyHeal(s) {
  const amt = MATCH.HEAL_MIN + rngFloat(s.rng) * (MATCH.HEAL_MAX - MATCH.HEAL_MIN);
  const heal = Math.round(100 * amt);
  s.hp.player = Math.min(100, s.hp.player + heal);
  s.hp.enemy = Math.min(100, s.hp.enemy + heal);
}

function boxView(bi) {
  const p = new Set((bi && bi.pressed) || []), h = new Set((bi && bi.held) || []);
  return { pressed: (a) => p.has(a), isDown: (a) => h.has(a) };
}

export function stepMatch(s, inputs) {
  inputs = inputs || {};
  const skip = !!inputs.skip;
  if (s.phase === 'walk') {
    s.phaseTick++;
    if (s.phaseTick >= WALK_TICKS || skip) { s.phase = 'chess'; s.phaseTick = 0; }
  } else if (s.phase === 'chess') {
    s.phaseTick++;
    if (s.phaseTick >= CHESS_STUB_TICKS || skip) startBoxing(s);
  } else if (s.phase === 'boxing') {
    const box = restoreBox(s.box, { mode: s.mode, enemyParams: s.enemyParams, hooks: {} });
    box.update(SIM.TICK_MS, boxView(inputs.box));
    s.box = snapshotBox(box);
    s.hp.player = box.player.hp; s.hp.enemy = box.enemy.hp;
    if (box.over) {
      if (box.result) { s.over = true; s.winner = box.result; s.reason = 'ko'; s.phase = 'over'; }
      else if (s.round >= MATCH.TOTAL_ROUNDS) {
        s.over = true; s.reason = 'material';
        // 2-A-2: STUB tiebreak by HP. The live game decides a drawn FINAL round by chess
        // MATERIAL (see game.js resolveBoxing) — replace this once the board is in MatchState.
        s.winner = s.hp.player > s.hp.enemy ? 'player' : s.hp.enemy > s.hp.player ? 'enemy' : 'draw';
        s.phase = 'over';
      } else { applyHeal(s); s.phase = 'break'; s.phaseTick = 0; }
    }
  } else if (s.phase === 'break') {
    s.phaseTick++;
    if (s.phaseTick >= BREAK_TICKS || skip) { s.round++; s.box = null; s.phase = 'walk'; s.phaseTick = 0; }
  }
  s.tick++;
  return s;
}

// enemyParams is shared by REFERENCE (treated as immutable — box.js only READS this.params,
// never writes it). Deep-clone it here if any future code ever mutates a fighter's params.
export function snapshotMatch(s) {
  return { tick: s.tick, phase: s.phase, phaseTick: s.phaseTick, rng: { ...s.rng },
    round: s.round, mode: s.mode, playerColor: s.playerColor, enemyParams: s.enemyParams,
    hp: { ...s.hp }, box: s.box ? JSON.parse(JSON.stringify(s.box)) : null,
    over: s.over, winner: s.winner, reason: s.reason };
}
export function restoreMatch(snap) { return snapshotMatch(snap); }
