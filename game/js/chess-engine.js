// ============================================================
// MANA CHESS - Core Chess Engine (FIDE Rules)
// Layer 1: Pure chess, no powers. Must be 100% correct.
// ============================================================

const PIECE = {
  PAWN: 'P', KNIGHT: 'N', BISHOP: 'B',
  ROOK: 'R', QUEEN: 'Q', KING: 'K'
};

const COLOR = { WHITE: 'w', BLACK: 'b' };

// Piece factory - creates piece object with all NOVA GAMBIT extensions
function makePiece(type, color, opts = {}) {
  return {
    type,
    color,
    hasMoved: false,
    // Fortify: 1-HP shield (v3.2). 0 = no shield, 1 = one absorb left.
    shieldHP: opts.shieldHP != null ? opts.shieldHP : 0,
    // Turn number AFTER which the shield expires (0 = persistent, untracked).
    shieldExpiresOn: opts.shieldExpiresOn || 0,
    // Ghost: phased for current turn only (decays at end of owner's turn).
    isPhased: opts.isPhased || false,
    phaseTurnsLeft: opts.phaseTurnsLeft || 0,
    // Frost: frozen until frozenUntil === turnNumber when it's this piece's owner's turn.
    // 0 = not frozen; >0 = turn number at which it unfreezes (i.e. can move again).
    frozenUntil: opts.frozenUntil || 0,
    // Spawn: ghostly spectral pawn — vanishes at start of caster's next turn.
    isSpectral: opts.isSpectral || false,
    spectralExpireTurn: opts.spectralExpireTurn || 0,
    // Imprison: if captor, holds a captive piece (the full object).
    imprisoned: opts.imprisoned || null,
    // Original starting file (set in createInitialBoard); used by Cleanse / captor-death
    // to release prisoners to their home tile.
    originFile: opts.originFile != null ? opts.originFile : null,
    id: opts.id || `${color}${type}${Math.random().toString(36).slice(2, 8)}`
  };
}

// Back-compat helpers to let test code refer to "hasShield"
function pieceHasShield(p) { return !!p && p.shieldHP > 0; }

// ---------- Board creation ----------
function createInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = [PIECE.ROOK, PIECE.KNIGHT, PIECE.BISHOP, PIECE.QUEEN,
                    PIECE.KING, PIECE.BISHOP, PIECE.KNIGHT, PIECE.ROOK];
  for (let c = 0; c < 8; c++) {
    board[0][c] = makePiece(backRank[c], COLOR.BLACK, { originFile: c });
    board[1][c] = makePiece(PIECE.PAWN, COLOR.BLACK, { originFile: c });
    board[6][c] = makePiece(PIECE.PAWN, COLOR.WHITE, { originFile: c });
    board[7][c] = makePiece(backRank[c], COLOR.WHITE, { originFile: c });
  }
  return board;
}

// ---------- Coordinate helpers ----------
// row 0 = rank 8 (black back rank), row 7 = rank 1 (white back rank)
// col 0 = file a, col 7 = file h
function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function algebraic(r, c) {
  return String.fromCharCode(97 + c) + (8 - r);
}

function fromAlgebraic(sq) {
  return { r: 8 - parseInt(sq[1]), c: sq.charCodeAt(0) - 97 };
}

// Find king position on board
function findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === PIECE.KING && p.color === color) return { r, c };
    }
  }
  return null;
}

// ---------- Pseudo-legal move generation (per-piece, ignoring check) ----------
// options.phaseIgnoreBlockers: if true, piece can pass through other pieces (Phase Shift)

function slidingMoves(board, r, c, directions, phaseIgnore = false) {
  const piece = board[r][c];
  const moves = [];
  for (const [dr, dc] of directions) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const target = board[nr][nc];
      if (!target) {
        moves.push({ r: nr, c: nc, capture: false });
      } else {
        // Phased pieces pass through but cannot land on King (checked in validator)
        if (phaseIgnore) {
          // Can pass through own or enemy piece (non-King transit allowed through King too)
          // Stop and add capture if enemy
          if (target.color !== piece.color && target.type !== PIECE.KING) {
            moves.push({ r: nr, c: nc, capture: true });
          }
          // Continue past (phased)
        } else {
          if (target.color !== piece.color && target.type !== PIECE.KING) {
            moves.push({ r: nr, c: nc, capture: true });
          }
          break;
        }
      }
      nr += dr; nc += dc;
    }
  }
  return moves;
}

function stepMoves(board, r, c, deltas) {
  const piece = board[r][c];
  const moves = [];
  for (const [dr, dc] of deltas) {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    const target = board[nr][nc];
    if (!target) moves.push({ r: nr, c: nc, capture: false });
    else if (target.color !== piece.color && target.type !== PIECE.KING) {
      moves.push({ r: nr, c: nc, capture: true });
    }
  }
  return moves;
}

function pawnMoves(board, r, c, gameState) {
  const piece = board[r][c];
  const dir = piece.color === COLOR.WHITE ? -1 : 1;
  const startRow = piece.color === COLOR.WHITE ? 6 : 1;
  const moves = [];

  // Forward 1 (pawns can move onto bombs to defuse them)
  if (inBounds(r + dir, c) && !board[r + dir][c]) {
    moves.push({ r: r + dir, c, capture: false });
    // Forward 2 from start
    if (r === startRow && !board[r + 2 * dir][c]) {
      moves.push({ r: r + 2 * dir, c, capture: false, doublePush: true });
    }
  }

  // Captures (diagonal)
  for (const dc of [-1, 1]) {
    const nr = r + dir, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    const target = board[nr][nc];
    if (target && target.color !== piece.color && target.type !== PIECE.KING) {
      moves.push({ r: nr, c: nc, capture: true });
    }
    // En passant — v3.2: Spectral pawns cannot EP.
    // Only valid for the player NOT owning the just-double-pushed pawn:
    //   white captures into row 2 (rank 6); black captures into row 5 (rank 3).
    if (gameState && gameState.enPassantTarget && !piece.isSpectral) {
      const ep = gameState.enPassantTarget;
      const epRowForUs = piece.color === COLOR.WHITE ? 2 : 5;
      if (nr === ep.r && nc === ep.c && nr === epRowForUs) {
        moves.push({ r: nr, c: nc, capture: true, enPassant: true });
      }
    }
  }

  return moves;
}

function knightMoves(board, r, c) {
  return stepMoves(board, r, c, [
    [-2,-1],[-2,1],[-1,-2],[-1,2],
    [1,-2],[1,2],[2,-1],[2,1]
  ]);
}

function bishopMoves(board, r, c, phase = false) {
  return slidingMoves(board, r, c, [[-1,-1],[-1,1],[1,-1],[1,1]], phase);
}

function rookMoves(board, r, c, phase = false) {
  return slidingMoves(board, r, c, [[-1,0],[1,0],[0,-1],[0,1]], phase);
}

function queenMoves(board, r, c, phase = false) {
  return [
    ...rookMoves(board, r, c, phase),
    ...bishopMoves(board, r, c, phase)
  ];
}

function kingMoves(board, r, c, gameState) {
  const piece = board[r][c];
  const moves = stepMoves(board, r, c, [
    [-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]
  ]);

  // Castling (only in non-phased state, no check, no through check, hasn't moved)
  // v3.5: also reject if the Rook is frozen (Frost blocks castling).
  if (!piece.hasMoved && gameState && !isSquareAttacked(board, r, c, opposite(piece.color))) {
    // Kingside (O-O): rook at (r, 7), empty c=5,6, king goes c=6
    const kRook = board[r][7];
    if (kRook && kRook.type === PIECE.ROOK && kRook.color === piece.color && !kRook.hasMoved) {
      const kRookFrozen = kRook.frozenUntil && gameState.turnNumber && kRook.frozenUntil > gameState.turnNumber;
      if (!kRookFrozen && !board[r][5] && !board[r][6]) {
        if (!isSquareAttacked(board, r, 5, opposite(piece.color)) &&
            !isSquareAttacked(board, r, 6, opposite(piece.color))) {
          moves.push({ r, c: 6, castle: 'K' });
        }
      }
    }
    // Queenside (O-O-O): rook at (r, 0), empty c=1,2,3
    const qRook = board[r][0];
    if (qRook && qRook.type === PIECE.ROOK && qRook.color === piece.color && !qRook.hasMoved) {
      const qRookFrozen = qRook.frozenUntil && gameState.turnNumber && qRook.frozenUntil > gameState.turnNumber;
      if (!qRookFrozen && !board[r][1] && !board[r][2] && !board[r][3]) {
        if (!isSquareAttacked(board, r, 3, opposite(piece.color)) &&
            !isSquareAttacked(board, r, 2, opposite(piece.color))) {
          moves.push({ r, c: 2, castle: 'Q' });
        }
      }
    }
  }

  return moves;
}

function opposite(color) {
  return color === COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
}

// Get all pseudo-legal moves for a piece (without check validation)
function pseudoLegalMoves(board, r, c, gameState) {
  const piece = board[r][c];
  if (!piece) return [];
  const phase = piece.isPhased;

  switch (piece.type) {
    case PIECE.PAWN: return pawnMoves(board, r, c, gameState);
    case PIECE.KNIGHT: return knightMoves(board, r, c);
    case PIECE.BISHOP: return bishopMoves(board, r, c, phase);
    case PIECE.ROOK: return rookMoves(board, r, c, phase);
    case PIECE.QUEEN: return queenMoves(board, r, c, phase);
    case PIECE.KING: return kingMoves(board, r, c, gameState);
  }
  return [];
}

// ---------- Check detection ----------
// Is (r,c) attacked by the given color?
function isSquareAttacked(board, r, c, byColor) {
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (!piece || piece.color !== byColor) continue;
      // Use simplified attack check (ignore castling/en passant for attack detection)
      const attacks = getAttackSquares(board, i, j);
      for (const atk of attacks) {
        if (atk.r === r && atk.c === c) return true;
      }
    }
  }
  return false;
}

// Squares a piece attacks (for check detection - not the same as legal moves)
function getAttackSquares(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];

  if (piece.type === PIECE.PAWN) {
    const dir = piece.color === COLOR.WHITE ? -1 : 1;
    const attacks = [];
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (inBounds(nr, nc)) attacks.push({ r: nr, c: nc });
    }
    return attacks;
  }

  if (piece.type === PIECE.KING) {
    const attacks = [];
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) attacks.push({ r: nr, c: nc });
    }
    return attacks;
  }

  if (piece.type === PIECE.KNIGHT) {
    const attacks = [];
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) attacks.push({ r: nr, c: nc });
    }
    return attacks;
  }

  // Sliding pieces: use move generation (attacks = squares they can go, even if blocked by own piece differently)
  const dirs = {
    [PIECE.BISHOP]: [[-1,-1],[-1,1],[1,-1],[1,1]],
    [PIECE.ROOK]: [[-1,0],[1,0],[0,-1],[0,1]],
    [PIECE.QUEEN]: [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]
  }[piece.type];

  const attacks = [];
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      attacks.push({ r: nr, c: nc });
      if (board[nr][nc]) {
        // Phased sliding pieces pass through for attacks too
        if (!piece.isPhased) break;
      }
      nr += dr; nc += dc;
    }
  }
  return attacks;
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king.r, king.c, opposite(color));
}

// ---------- Legal move filtering ----------
// A move is legal if after making it, the player's own king is not in check.
// Also filters out moves that capture shielded pieces (capture fizzles but still "legal" for display)
function legalMoves(board, r, c, gameState) {
  const piece = board[r][c];
  if (!piece) return [];
  // Frozen pieces cannot move on their owner's next turn (while frozen).
  if (piece.frozenUntil && gameState && piece.frozenUntil > gameState.turnNumber) return [];
  // Spectral pawns cannot move (ever).
  if (piece.isSpectral) return [];
  // v3.3: Captors CAN move while holding a prisoner.
  const pseudo = pseudoLegalMoves(board, r, c, gameState);
  return pseudo.filter(move => {
    // Phase Shift: cannot land on own King or enemy King
    if (piece.isPhased) {
      const target = board[move.r][move.c];
      if (target && target.type === PIECE.KING) return false;
    }
    // Simulate move
    const snap = snapshot(board);
    applyMoveRaw(board, r, c, move, gameState);
    const inCheck = isInCheck(board, piece.color);
    restore(board, snap);
    return !inCheck;
  });
}

// Get ALL legal moves for a color (used for checkmate/stalemate detection)
function allLegalMoves(board, color, gameState) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        const pieceMoves = legalMoves(board, r, c, gameState);
        for (const m of pieceMoves) {
          moves.push({ from: { r, c }, to: { r: m.r, c: m.c }, move: m });
        }
      }
    }
  }
  return moves;
}

function isCheckmate(board, color, gameState) {
  return isInCheck(board, color) && allLegalMoves(board, color, gameState).length === 0;
}

function isStalemate(board, color, gameState) {
  return !isInCheck(board, color) && allLegalMoves(board, color, gameState).length === 0;
}

// ---------- Board snapshot/restore (for simulation) ----------
function snapshot(board) {
  return board.map(row => row.map(p => p ? { ...p } : null));
}

function restore(board, snap) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      board[r][c] = snap[r][c] ? { ...snap[r][c] } : null;
    }
  }
}

// Apply a move without validation (used internally for simulation)
function applyMoveRaw(board, fromR, fromC, move, gameState) {
  const piece = board[fromR][fromC];
  const target = board[move.r][move.c];

  // FORTIFY: shielded piece capture fizzles — attacker does NOT move, shield absorbs one hit.
  // Note: legalMoves() invokes this through a snapshot/restore loop, so mutating shieldHP here
  // is fine — the snapshot captures the pre-move state. The important invariant is that the
  // board layout is unchanged by a would-be shield-blocked capture, so isInCheck() after the
  // "move" correctly reflects that the mover's king still sees the original position.
  if (target && target.shieldHP > 0 && move.capture) {
    target.shieldHP -= 1;
    return { shieldBroke: true, captured: null };
  }

  // En passant
  if (move.enPassant) {
    const capturedPawnRow = piece.color === COLOR.WHITE ? move.r + 1 : move.r - 1;
    board[capturedPawnRow][move.c] = null;
  }

  // Castling
  if (move.castle) {
    const rookFromC = move.castle === 'K' ? 7 : 0;
    const rookToC = move.castle === 'K' ? 5 : 3;
    const rook = board[fromR][rookFromC];
    board[fromR][rookFromC] = null;
    board[fromR][rookToC] = rook;
    if (rook) rook.hasMoved = true;
  }

  // FRAGILE: if captured piece is fragile, it vanishes instead of being captured
  // Actually - in our design: if a FRAGILE piece is ATTACKED, it vanishes (no capture, attacker doesn't land)
  // This is handled at the move-validation level. If we got here with a capture on fragile, it vanishes
  // and attacker DOES move into the square (different from shield).
  const captured = target || null;

  board[move.r][move.c] = piece;
  board[fromR][fromC] = null;
  piece.hasMoved = true;

  return { captured, shieldBroke: false };
}

// Expose to global scope (works in both browser and Node VM context)
(function() {
  const g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : this);
  Object.assign(g, {
    PIECE, COLOR, makePiece, createInitialBoard, inBounds, algebraic, fromAlgebraic,
    findKing, pseudoLegalMoves, legalMoves, allLegalMoves, isInCheck, isCheckmate,
    isStalemate, isSquareAttacked, opposite, snapshot, restore, applyMoveRaw,
    getAttackSquares
  });
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PIECE, COLOR, makePiece, createInitialBoard, inBounds, algebraic, fromAlgebraic,
    findKing, pseudoLegalMoves, legalMoves, allLegalMoves, isInCheck, isCheckmate,
    isStalemate, isSquareAttacked, opposite, snapshot, restore, applyMoveRaw,
    getAttackSquares
  };
}
