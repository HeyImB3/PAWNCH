// PAWNCH chess rules — a compact but complete, dependency-free chess core.
// Board is a flat 64-char array, index 0 = a8 (top-left), 63 = h1 (bottom-right).
// Pieces: white = PNBRQK (uppercase), black = pnbrqk (lowercase), '' = empty.
// White moves "up" the board (toward lower row indices).

export const WHITE = 'w';
export const BLACK = 'b';

const rc = (i) => [i >> 3, i & 7];           // -> [row, col]
const idx = (r, c) => r * 8 + c;
const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const colorOf = (p) => (p === '' ? null : p === p.toUpperCase() ? WHITE : BLACK);
const isUpper = (p) => p >= 'A' && p <= 'Z';

const KNIGHT_OFF = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_OFF   = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP_DIR = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK_DIR   = [[-1,0],[1,0],[0,-1],[0,1]];

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function newGame() {
  return loadFen(START_FEN);
}

export function loadFen(fen) {
  const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
  const board = new Array(64).fill('');
  let i = 0;
  for (const ch of placement) {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') i += +ch;
    else board[i++] = ch;
  }
  return {
    board,
    turn: turn === 'b' ? BLACK : WHITE,
    castling: {
      wK: castling.includes('K'), wQ: castling.includes('Q'),
      bK: castling.includes('k'), bQ: castling.includes('q'),
    },
    ep: ep && ep !== '-' ? algToIdx(ep) : -1,
    halfmove: half ? +half : 0,
    fullmove: full ? +full : 1,
  };
}

export function toFen(s) {
  let out = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = s.board[idx(r, c)];
      if (p === '') empty++;
      else { if (empty) { out += empty; empty = 0; } out += p; }
    }
    if (empty) out += empty;
    if (r < 7) out += '/';
  }
  const cr =
    (s.castling.wK ? 'K' : '') + (s.castling.wQ ? 'Q' : '') +
    (s.castling.bK ? 'k' : '') + (s.castling.bQ ? 'q' : '') || '-';
  const epStr = s.ep >= 0 ? idxToAlg(s.ep) : '-';
  return `${out} ${s.turn} ${cr} ${epStr} ${s.halfmove} ${s.fullmove}`;
}

export function clone(s) {
  return {
    board: s.board.slice(),
    turn: s.turn,
    castling: { ...s.castling },
    ep: s.ep,
    halfmove: s.halfmove,
    fullmove: s.fullmove,
  };
}

function algToIdx(a) {
  const file = a.charCodeAt(0) - 97;       // a..h
  const rank = +a[1];                       // 1..8
  return idx(8 - rank, file);
}
export function idxToAlg(i) {
  const [r, c] = rc(i);
  return String.fromCharCode(97 + c) + (8 - r);
}

// --- Attack detection ---------------------------------------------------
export function isAttacked(board, target, by) {
  const [tr, tc] = rc(target);
  // pawns
  const pr = by === WHITE ? tr + 1 : tr - 1; // attacker pawn row
  for (const dc of [-1, 1]) {
    if (onBoard(pr, tc + dc)) {
      const p = board[idx(pr, tc + dc)];
      if (p && colorOf(p) === by && p.toLowerCase() === 'p') return true;
    }
  }
  // knights
  for (const [dr, dc] of KNIGHT_OFF) {
    const r = tr + dr, c = tc + dc;
    if (onBoard(r, c)) {
      const p = board[idx(r, c)];
      if (p && colorOf(p) === by && p.toLowerCase() === 'n') return true;
    }
  }
  // king
  for (const [dr, dc] of KING_OFF) {
    const r = tr + dr, c = tc + dc;
    if (onBoard(r, c)) {
      const p = board[idx(r, c)];
      if (p && colorOf(p) === by && p.toLowerCase() === 'k') return true;
    }
  }
  // sliders
  const check = (dirs, types) => {
    for (const [dr, dc] of dirs) {
      let r = tr + dr, c = tc + dc;
      while (onBoard(r, c)) {
        const p = board[idx(r, c)];
        if (p) {
          if (colorOf(p) === by && types.includes(p.toLowerCase())) return true;
          break;
        }
        r += dr; c += dc;
      }
    }
    return false;
  };
  if (check(BISHOP_DIR, ['b', 'q'])) return true;
  if (check(ROOK_DIR, ['r', 'q'])) return true;
  return false;
}

export function kingSquare(board, color) {
  const k = color === WHITE ? 'K' : 'k';
  return board.indexOf(k);
}

export function inCheck(s, color = s.turn) {
  const ks = kingSquare(s.board, color);
  if (ks < 0) return false;
  return isAttacked(s.board, ks, color === WHITE ? BLACK : WHITE);
}

// --- Move generation ----------------------------------------------------
// Move: { from, to, piece, captured, promo, flag } flag in
// 'normal'|'capture'|'double'|'ep'|'castleK'|'castleQ'
function pushPawnMoves(s, from, list) {
  const board = s.board;
  const [r, c] = rc(from);
  const me = s.turn;
  const dir = me === WHITE ? -1 : 1;
  const startRow = me === WHITE ? 6 : 1;
  const promoRow = me === WHITE ? 0 : 7;
  const one = idx(r + dir, c);
  if (onBoard(r + dir, c) && board[one] === '') {
    addPawn(from, one, r + dir === promoRow, 'normal', list);
    const two = idx(r + 2 * dir, c);
    if (r === startRow && board[two] === '')
      list.push({ from, to: two, flag: 'double' });
  }
  for (const dc of [-1, 1]) {
    const nr = r + dir, nc = c + dc;
    if (!onBoard(nr, nc)) continue;
    const t = idx(nr, nc);
    const p = board[t];
    if (p && colorOf(p) !== me) addPawn(from, t, nr === promoRow, 'capture', list);
    else if (t === s.ep) list.push({ from, to: t, flag: 'ep' });
  }
}
function addPawn(from, to, promo, flag, list) {
  if (promo) for (const pp of ['q', 'r', 'b', 'n']) list.push({ from, to, flag, promo: pp });
  else list.push({ from, to, flag });
}

function pseudoMoves(s) {
  const board = s.board, me = s.turn, list = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || colorOf(p) !== me) continue;
    const t = p.toLowerCase();
    const [r, c] = rc(i);
    if (t === 'p') { pushPawnMoves(s, i, list); continue; }
    if (t === 'n') {
      for (const [dr, dc] of KNIGHT_OFF) step(board, me, i, r + dr, c + dc, list);
      continue;
    }
    if (t === 'k') {
      for (const [dr, dc] of KING_OFF) step(board, me, i, r + dr, c + dc, list);
      addCastles(s, i, list);
      continue;
    }
    const dirs = t === 'b' ? BISHOP_DIR : t === 'r' ? ROOK_DIR : [...BISHOP_DIR, ...ROOK_DIR];
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (onBoard(nr, nc)) {
        const tt = idx(nr, nc), tp = board[tt];
        if (tp === '') list.push({ from: i, to: tt, flag: 'normal' });
        else { if (colorOf(tp) !== me) list.push({ from: i, to: tt, flag: 'capture' }); break; }
        nr += dr; nc += dc;
      }
    }
  }
  return list;
}
function step(board, me, from, r, c, list) {
  if (!onBoard(r, c)) return;
  const to = idx(r, c), p = board[to];
  if (p === '') list.push({ from, to, flag: 'normal' });
  else if (colorOf(p) !== me) list.push({ from, to, flag: 'capture' });
}
function addCastles(s, from, list) {
  const me = s.turn, board = s.board;
  const opp = me === WHITE ? BLACK : WHITE;
  if (inCheck(s, me)) return;
  if (me === WHITE && from === 60) {
    if (s.castling.wK && board[61] === '' && board[62] === '' && board[63] === 'R' &&
        !isAttacked(board, 61, opp) && !isAttacked(board, 62, opp))
      list.push({ from, to: 62, flag: 'castleK' });
    if (s.castling.wQ && board[59] === '' && board[58] === '' && board[57] === '' && board[56] === 'R' &&
        !isAttacked(board, 59, opp) && !isAttacked(board, 58, opp))
      list.push({ from, to: 58, flag: 'castleQ' });
  } else if (me === BLACK && from === 4) {
    if (s.castling.bK && board[5] === '' && board[6] === '' && board[7] === 'r' &&
        !isAttacked(board, 5, opp) && !isAttacked(board, 6, opp))
      list.push({ from, to: 6, flag: 'castleK' });
    if (s.castling.bQ && board[3] === '' && board[2] === '' && board[1] === '' && board[0] === 'r' &&
        !isAttacked(board, 3, opp) && !isAttacked(board, 2, opp))
      list.push({ from, to: 2, flag: 'castleQ' });
  }
}

export function legalMoves(s) {
  const me = s.turn;
  return pseudoMoves(s).filter((m) => {
    const ns = applyMove(s, m);
    return !inCheck(ns, me);
  });
}

// Apply a move, returning a NEW state (does not mutate input).
export function applyMove(s, m) {
  const ns = clone(s);
  const b = ns.board;
  const me = s.turn;
  const piece = b[m.from];
  const [fr] = rc(m.from);
  const [tr, tc] = rc(m.to);

  b[m.to] = piece;
  b[m.from] = '';
  ns.ep = -1;

  if (m.flag === 'double') {
    ns.ep = idx((tr + fr) / 2, tc); // square jumped over
  } else if (m.flag === 'ep') {
    // captured pawn sits on same row as the moving pawn started, target file
    const capRow = me === WHITE ? tr + 1 : tr - 1;
    b[idx(capRow, tc)] = '';
  } else if (m.flag === 'castleK') {
    if (me === WHITE) { b[61] = b[63]; b[63] = ''; }
    else { b[5] = b[7]; b[7] = ''; }
  } else if (m.flag === 'castleQ') {
    if (me === WHITE) { b[59] = b[56]; b[56] = ''; }
    else { b[3] = b[0]; b[0] = ''; }
  }
  if (m.promo) b[m.to] = me === WHITE ? m.promo.toUpperCase() : m.promo;

  // castling rights updates
  if (piece === 'K') { ns.castling.wK = false; ns.castling.wQ = false; }
  if (piece === 'k') { ns.castling.bK = false; ns.castling.bQ = false; }
  if (m.from === 56 || m.to === 56) ns.castling.wQ = false;
  if (m.from === 63 || m.to === 63) ns.castling.wK = false;
  if (m.from === 0 || m.to === 0) ns.castling.bQ = false;
  if (m.from === 7 || m.to === 7) ns.castling.bK = false;

  // clocks
  const wasCapture = m.flag === 'capture' || m.flag === 'ep';
  ns.halfmove = (piece.toLowerCase() === 'p' || wasCapture) ? 0 : s.halfmove + 1;
  if (me === BLACK) ns.fullmove = s.fullmove + 1;
  ns.turn = me === WHITE ? BLACK : WHITE;
  return ns;
}

// 'ongoing' | 'checkmate' | 'stalemate' | 'fifty' | 'material'
export function status(s) {
  const moves = legalMoves(s);
  if (moves.length === 0) return inCheck(s, s.turn) ? 'checkmate' : 'stalemate';
  if (s.halfmove >= 100) return 'fifty';
  if (insufficientMaterial(s.board)) return 'material';
  return 'ongoing';
}

function insufficientMaterial(board) {
  const pieces = board.filter((p) => p && p.toLowerCase() !== 'k');
  if (pieces.length === 0) return true;
  if (pieces.length === 1 && 'bn'.includes(pieces[0].toLowerCase())) return true;
  return false;
}

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function material(board) {
  let w = 0, b = 0;
  for (const p of board) {
    if (!p) continue;
    const v = VAL[p.toLowerCase()];
    if (isUpper(p)) w += v; else b += v;
  }
  return { w, b, diff: w - b };
}

// Human-friendly SAN-ish label (good enough for the move log / juice).
export function moveLabel(s, m) {
  const piece = s.board[m.from];
  const t = piece.toLowerCase();
  if (m.flag === 'castleK') return 'O-O';
  if (m.flag === 'castleQ') return 'O-O-O';
  const cap = m.flag === 'capture' || m.flag === 'ep';
  const dest = idxToAlg(m.to);
  let label;
  if (t === 'p') label = (cap ? idxToAlg(m.from)[0] + 'x' : '') + dest;
  else label = piece.toUpperCase() + (cap ? 'x' : '') + dest;
  if (m.promo) label += '=' + m.promo.toUpperCase();
  const ns = applyMove(s, m);
  if (inCheck(ns)) label += status(ns) === 'checkmate' ? '#' : '+';
  return label;
}

export { rc, idx, colorOf };
