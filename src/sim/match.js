import { MATCH, SIM } from '../config.js';
import { newRng, rngFloat, rngInt } from './rng.js';
import { BoxingMatch, snapshotBox, restoreBox } from './box.js';
import { newChessClock, tickChessClock, addIncrement, resetHalf, chessClockStatus } from './chessclock.js';
import { newGame, applyMove, status, material, moveLabel } from '../chess/board.js';

const WALK_TICKS = Math.round(MATCH.WALK_SECONDS * SIM.TICK_HZ);
const BREAK_TICKS = Math.round(MATCH.BREAK_SECONDS * SIM.TICK_HZ);

function nextSeed(rng) { return rngInt(rng, 0x100000000); }
function cloneBoard(b) { return b ? JSON.parse(JSON.stringify(b)) : null; }

export function newMatch(config) {
  const rng = newRng((config.seed >>> 0) || 1);
  const playerColor = rngFloat(rng) < 0.5 ? 'w' : 'b';
  return {
    tick: 0, phase: 'walk', phaseTick: 0, rng,
    round: 1, mode: config.mode || 'story', playerColor,
    enemyParams: config.enemyParams || null,
    board: newGame(), clock: newChessClock(), movedThisHalf: { player: false, enemy: false },
    pgnMoves: [], chessResult: null,
    hp: { player: config.startHP?.player ?? 100, enemy: config.startHP?.enemy ?? 100 },
    box: null, over: false, winner: null, reason: null,
  };
}

function startBoxing(s) {
  const box = new BoxingMatch({
    mode: s.mode === 'pvp' ? 'pvp' : 'story', enemyParams: s.enemyParams || undefined,
    seconds: MATCH.BOXING_SECONDS, startHP: { player: s.hp.player, enemy: s.hp.enemy },
    seed: nextSeed(s.rng), hooks: {}, onKO() {}, onTime() {},
  });
  s.box = snapshotBox(box); s.phase = 'boxing'; s.phaseTick = 0;
}

// chess half ended non-decisively -> apply the chess-skip HP cap (human sides that
// made no move), then start boxing.
function chessToBoxing(s) {
  const sides = s.mode === 'pvp' ? ['player', 'enemy'] : ['player'];
  for (const side of sides) {
    if (!s.movedThisHalf[side]) s.hp[side] = Math.min(s.hp[side], MATCH.NO_MOVE_HP_CAP);
  }
  startBoxing(s);
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
    if (s.phaseTick >= WALK_TICKS || skip) {
      s.phase = 'chess'; s.phaseTick = 0; resetHalf(s.clock); s.movedThisHalf = { player: false, enemy: false };
    }
  } else if (s.phase === 'chess') {
    tickChessClock(s.clock, s.board.turn, SIM.TICK_MS);
    let resolved = false;
    if (inputs.chessMove) {
      const mover = s.board.turn;
      s.pgnMoves.push(moveLabel(s.board, inputs.chessMove));
      s.movedThisHalf[mover === s.playerColor ? 'player' : 'enemy'] = true;
      s.board = applyMove(s.board, inputs.chessMove);
      addIncrement(s.clock, mover);
      const st = status(s.board);
      if (st === 'checkmate') {
        const winner = mover === s.playerColor ? 'player' : 'enemy';
        s.over = true; s.winner = winner; s.reason = 'checkmate';
        s.chessResult = { decisive: true, winner, reason: 'checkmate' }; s.phase = 'over'; resolved = true;
      } else if (st === 'stalemate' || st === 'fifty' || st === 'material') {
        s.chessResult = { decisive: false, winner: null, reason: 'draw' }; chessToBoxing(s); resolved = true;
      }
    }
    if (!resolved) {
      const cs = chessClockStatus(s.clock, s.board.turn);
      if (cs === 'flag') {
        const winnerColor = s.board.turn === 'w' ? 'b' : 'w';
        const winner = winnerColor === s.playerColor ? 'player' : 'enemy';
        s.over = true; s.winner = winner; s.reason = 'flag';
        s.chessResult = { decisive: true, winner, reason: 'flag' }; s.phase = 'over';
      } else if (cs === 'time') {
        s.chessResult = { decisive: false, winner: null, reason: 'time' }; chessToBoxing(s);
      }
    }
  } else if (s.phase === 'boxing') {
    const box = restoreBox(s.box, { mode: s.mode, enemyParams: s.enemyParams, hooks: {} });
    box.update(SIM.TICK_MS, boxView(inputs.box));
    s.box = snapshotBox(box);
    s.hp.player = box.player.hp; s.hp.enemy = box.enemy.hp;
    if (box.over) {
      if (box.result) { s.over = true; s.winner = box.result; s.reason = 'ko'; s.phase = 'over'; }
      else if (s.round >= MATCH.TOTAL_ROUNDS) {
        s.over = true; s.reason = 'material';
        const diff = material(s.board.board).diff;
        const playerDiff = s.playerColor === 'w' ? diff : -diff;
        s.winner = playerDiff > 0 ? 'player' : playerDiff < 0 ? 'enemy' : 'draw';
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

export function snapshotMatch(s) {
  return { tick: s.tick, phase: s.phase, phaseTick: s.phaseTick, rng: { ...s.rng },
    round: s.round, mode: s.mode, playerColor: s.playerColor, enemyParams: s.enemyParams,
    board: cloneBoard(s.board), clock: { ...s.clock }, movedThisHalf: { ...s.movedThisHalf },
    pgnMoves: [...s.pgnMoves], chessResult: s.chessResult ? { ...s.chessResult } : null,
    hp: { ...s.hp }, box: s.box ? JSON.parse(JSON.stringify(s.box)) : null,
    over: s.over, winner: s.winner, reason: s.reason };
}
export function restoreMatch(snap) { return snapshotMatch(snap); }
