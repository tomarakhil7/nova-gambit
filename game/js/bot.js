// ============================================================
// NOVA GAMBIT - Heuristic Bot (v2.0 - OPTIMIZED)
// A CPU opponent that plays both chess moves AND Aether powers.
// Difficulty levels: easy (random), medium (heuristic), hard (deep search).
//
// HARD MODE SEARCH OPTIMIZATIONS (v2.0):
// 1. Adaptive depth by game phase:
//    - Opening (turns 1-10): 4-ply (book moves + tactical awareness)
//    - Middlegame (turns 11-30): 5-ply (complex tactics need depth)
//    - Endgame (turns 31+): 6-ply (fewer pieces, can search deeper)
//
// 2. Selective search extensions:
//    - Check extension: +2 ply when in check (critical positions)
//    - Capture extension: +1 ply for captures of high-value pieces (Q/R)
//    - Pawn-to-7th extension: +1 ply when pawn reaches 7th rank
//    - Passed pawn push: +1 ply when passed pawn advances in endgame
//
// 3. Enhanced null-move pruning (adaptive R):
//    - R=3 at depth >= 6 (aggressive pruning in deep nodes)
//    - R=2 at depth 3-5 (standard reduction)
//    - R=1 at depth <= 2 (careful pruning near leaves)
//
// 4. Improved quiescence search (max depth 8):
//    - Captures + promotions (standard)
//    - Check-giving moves (can lead to tactics)
//    - Recaptures on same square (exchange evaluation)
//
// 5. Transposition table (10k entries):
//    - Zobrist-style position hashing
//    - Stores: score, depth, bound type, best move
//    - Improves move ordering and prevents re-evaluation
//
// 6. Aspiration windows:
//    - Narrow search window around previous score
//    - Re-search if score falls outside window
//    - Improves pruning efficiency in iterative deepening
//
// 7. Performance optimizations:
//    - Reduced console logging during search
//    - TT-based move ordering (try best move from hash first)
//    - Target response time: 1-2 seconds per move
//    - Effective search depth: 5-6 ply with extensions
//
// MULTI-POWER SYSTEM:
// Bot can cast multiple powers in a single turn (up to 3 powers).
// Power combo strategies:
//   1. Frost + Capture: Freeze enemy, then capture it safely
//   2. Imprison + Capture: Remove defender, then take protected piece
//   3. Fortify + Attack: Shield piece, then move into danger
//   4. Cleanse + Activate: Remove frost, then use the piece
//   5. Wall + Promote: Create pawn wall, then promote
//   6. Blink + Double Attack: Teleport to position, then double attack
//   7. AetherBlock + Vengeance: Block opponent powers, then destroy key piece
//
// Chaining rules:
//   - Continue-turn powers (Frost, Fortify, Imprison, etc): chain if priority >= 40
//   - End-turn powers (Vengeance, Blink, etc): only cast if priority >= 60 after other powers
//   - Stop after 3 powers or if aether < 5
// ============================================================

const BOT = {
  enabled: false,
  color: null,       // 'w' or 'b' — the color the bot plays (single-bot mode)
  difficulty: 'medium', // 'easy' | 'medium' | 'hard'
  thinkDelay: 200,   // ms delay before bot plays (reduced for faster gameplay)
  thinking: false,
  // Bot vs Bot mode
  botVsBot: false,
  whiteDifficulty: 'medium',
  blackDifficulty: 'medium',
  autoPlayInterval: null,
  gameCount: 0,
  maxGames: 1,
  results: { white: 0, black: 0, draw: 0 },
  onGameEnd: null    // callback(result) for headless mode
};

// Move history for repetition avoidance
const BOT_MOVE_HISTORY = [];
const BOT_HISTORY_MAX = 12; // track last 12 half-moves

function botRecordMove(from, to) {
  BOT_MOVE_HISTORY.push(`${from.r}${from.c}${to.r}${to.c}`);
  if (BOT_MOVE_HISTORY.length > BOT_HISTORY_MAX) BOT_MOVE_HISTORY.shift();
}

function botMoveRepeatCount(from, to) {
  const key = `${from.r}${from.c}${to.r}${to.c}`;
  let count = 0;
  for (const h of BOT_MOVE_HISTORY) if (h === key) count++;
  return count;
}

function botClearHistory() {
  BOT_MOVE_HISTORY.length = 0;
}

// ---------- Opening Book ----------
// Simple opening book for the first few moves (before the search kicks in fully).
// Returns a move object or null if no book move applies.
const BOT_OPENINGS = {
  // Key: "turnNumber:color" → list of {from, to} weighted options
  // White openings (turn 1): e4, d4, Nf3, c4
  'w_start': [
    { from: {r:6,c:4}, to: {r:4,c:4}, weight: 40 }, // e4
    { from: {r:6,c:3}, to: {r:4,c:3}, weight: 35 }, // d4
    { from: {r:7,c:6}, to: {r:5,c:5}, weight: 15 }, // Nf3
    { from: {r:6,c:2}, to: {r:4,c:2}, weight: 10 }, // c4
  ],
  // After e4, develop naturally
  'w_e4_dev': [
    { from: {r:7,c:6}, to: {r:5,c:5}, weight: 30 }, // Nf3
    { from: {r:7,c:1}, to: {r:5,c:2}, weight: 25 }, // Nc3
    { from: {r:7,c:5}, to: {r:5,c:3}, weight: 20 }, // Bd3 (but actually Bc4)
    { from: {r:7,c:5}, to: {r:4,c:2}, weight: 20 }, // Bc4
  ],
  // After d4, develop
  'w_d4_dev': [
    { from: {r:6,c:2}, to: {r:4,c:2}, weight: 30 }, // c4
    { from: {r:7,c:6}, to: {r:5,c:5}, weight: 30 }, // Nf3
    { from: {r:7,c:1}, to: {r:5,c:2}, weight: 20 }, // Nc3
  ],
  // Black responses to e4: e5, c5, e6, Nf6
  'b_vs_e4': [
    { from: {r:1,c:4}, to: {r:3,c:4}, weight: 35 }, // e5
    { from: {r:1,c:2}, to: {r:3,c:2}, weight: 30 }, // c5 (Sicilian)
    { from: {r:0,c:6}, to: {r:2,c:5}, weight: 20 }, // Nf6 (Alekhine-ish)
    { from: {r:1,c:4}, to: {r:2,c:4}, weight: 15 }, // e6 (French)
  ],
  // Black responses to d4: d5, Nf6, e6
  'b_vs_d4': [
    { from: {r:1,c:3}, to: {r:3,c:3}, weight: 35 }, // d5
    { from: {r:0,c:6}, to: {r:2,c:5}, weight: 35 }, // Nf6 (Indian)
    { from: {r:1,c:4}, to: {r:2,c:4}, weight: 20 }, // e6
  ],
  // Black generic development
  'b_dev': [
    { from: {r:0,c:6}, to: {r:2,c:5}, weight: 30 }, // Nf6
    { from: {r:0,c:1}, to: {r:2,c:2}, weight: 25 }, // Nc6
    { from: {r:1,c:3}, to: {r:3,c:3}, weight: 20 }, // d5
    { from: {r:1,c:4}, to: {r:3,c:4}, weight: 20 }, // e5
  ]
};

// Helper: Get all squares a piece attacks from a given position
// Returns array of {r, c} squares that the piece at (r, c) attacks
function getAttackSquares(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];

  const attacked = [];
  const color = piece.color;
  const type = piece.type;

  // For each square on the board, check if piece attacks it
  for (let tr = 0; tr < 8; tr++) {
    for (let tc = 0; tc < 8; tc++) {
      if (tr === r && tc === c) continue; // Skip own square

      const dr = tr - r;
      const dc = tc - c;
      const absDr = Math.abs(dr);
      const absDc = Math.abs(dc);

      let attacks = false;

      switch (type) {
        case PIECE.PAWN:
          // Pawns attack diagonally
          const dir = color === COLOR.WHITE ? -1 : 1;
          if (dr === dir && absDc === 1) attacks = true;
          break;

        case PIECE.KNIGHT:
          // Knight L-shape
          if ((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2)) {
            attacks = true;
          }
          break;

        case PIECE.BISHOP:
          // Diagonal
          if (absDr === absDc && absDr > 0) {
            // Check path is clear
            const stepR = dr > 0 ? 1 : -1;
            const stepC = dc > 0 ? 1 : -1;
            let blocked = false;
            for (let i = 1; i < absDr; i++) {
              if (board[r + i * stepR][c + i * stepC]) {
                blocked = true;
                break;
              }
            }
            if (!blocked) attacks = true;
          }
          break;

        case PIECE.ROOK:
          // Straight lines
          if ((dr === 0 && dc !== 0) || (dr !== 0 && dc === 0)) {
            // Check path is clear
            const stepR = dr === 0 ? 0 : (dr > 0 ? 1 : -1);
            const stepC = dc === 0 ? 0 : (dc > 0 ? 1 : -1);
            const dist = Math.max(absDr, absDc);
            let blocked = false;
            for (let i = 1; i < dist; i++) {
              if (board[r + i * stepR][c + i * stepC]) {
                blocked = true;
                break;
              }
            }
            if (!blocked) attacks = true;
          }
          break;

        case PIECE.QUEEN:
          // Combination of rook + bishop
          if ((dr === 0 && dc !== 0) || (dr !== 0 && dc === 0) || (absDr === absDc && absDr > 0)) {
            // Check path is clear
            const stepR = dr === 0 ? 0 : (dr > 0 ? 1 : -1);
            const stepC = dc === 0 ? 0 : (dc > 0 ? 1 : -1);
            const dist = Math.max(absDr, absDc);
            let blocked = false;
            for (let i = 1; i < dist; i++) {
              if (board[r + i * stepR][c + i * stepC]) {
                blocked = true;
                break;
              }
            }
            if (!blocked) attacks = true;
          }
          break;

        case PIECE.KING:
          // One square in any direction
          if (absDr <= 1 && absDc <= 1 && (absDr > 0 || absDc > 0)) {
            attacks = true;
          }
          break;
      }

      if (attacks) {
        attacked.push({r: tr, c: tc});
      }
    }
  }

  return attacked;
}

function botGetBookMove(state, forColor, moves) {
  if (state.turnNumber > 6) return null; // only first 3 full moves

  // Check if a candidate move is legal
  function findLegal(bookMove) {
    return moves.find(m =>
      m.from.r === bookMove.from.r && m.from.c === bookMove.from.c &&
      m.to.r === bookMove.to.r && m.to.c === bookMove.to.c
    );
  }

  let bookKey = null;

  if (forColor === COLOR.WHITE) {
    if (state.turnNumber <= 1) {
      bookKey = 'w_start';
    } else if (state.turnNumber <= 5) {
      // Check what we played turn 1
      const e4Played = state.board[4] && state.board[4][4] && state.board[4][4].type === PIECE.PAWN && state.board[4][4].color === COLOR.WHITE;
      const d4Played = state.board[4] && state.board[4][3] && state.board[4][3].type === PIECE.PAWN && state.board[4][3].color === COLOR.WHITE;
      if (e4Played) bookKey = 'w_e4_dev';
      else if (d4Played) bookKey = 'w_d4_dev';
    }
  } else {
    if (state.turnNumber <= 2) {
      const e4 = state.board[4] && state.board[4][4] && state.board[4][4].type === PIECE.PAWN && state.board[4][4].color === COLOR.WHITE;
      const d4 = state.board[4] && state.board[4][3] && state.board[4][3].type === PIECE.PAWN && state.board[4][3].color === COLOR.WHITE;
      if (e4) bookKey = 'b_vs_e4';
      else if (d4) bookKey = 'b_vs_d4';
      else bookKey = 'b_dev';
    } else if (state.turnNumber <= 6) {
      bookKey = 'b_dev';
    }
  }

  if (!bookKey || !BOT_OPENINGS[bookKey]) return null;

  // Filter to legal book moves, weighted random selection
  const options = BOT_OPENINGS[bookKey]
    .map(bm => ({ ...bm, legal: findLegal(bm) }))
    .filter(bm => bm.legal);

  if (options.length === 0) return null;

  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const opt of options) {
    roll -= opt.weight;
    if (roll <= 0) return opt.legal;
  }
  return options[0].legal;
}

// Piece values for move evaluation
const BOT_PIECE_VALUES = {
  P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000
};

// Positional bonus tables (simplified, white perspective — flip for black)
const BOT_PST_PAWN = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

// Endgame pawn table: heavy incentive to advance
const BOT_PST_PAWN_EG = [
  0,   0,   0,   0,   0,   0,   0,   0,
  130, 130, 130, 130, 130, 130, 130, 130,
  80,  80,  80,  80,  80,  80,  80,  80,
  50,  50,  50,  50,  50,  50,  50,  50,
  30,  30,  30,  30,  30,  30,  30,  30,
  10,  10,  10,  10,  10,  10,  10,  10,
  0,   0,   0,   0,   0,   0,   0,   0,
  0,   0,   0,   0,   0,   0,   0,   0
];

const BOT_PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const BOT_PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];

// Middlegame king: hide in the corner
const BOT_PST_KING = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
];

// Endgame king: centralize and push toward enemy
const BOT_PST_KING_EG = [
  -50,-30,-20,-20,-20,-20,-30,-50,
  -30,  0, 10, 10, 10, 10,  0,-30,
  -20, 10, 20, 30, 30, 20, 10,-20,
  -20, 10, 30, 40, 40, 30, 10,-20,
  -20, 10, 30, 40, 40, 30, 10,-20,
  -20, 10, 20, 30, 30, 20, 10,-20,
  -30,  0, 10, 10, 10, 10,  0,-30,
  -50,-30,-20,-20,-20,-20,-30,-50
];

// ---------- Game Phase Detection ----------
// Returns 0.0 (pure endgame) to 1.0 (opening/middlegame)
function botGamePhase(state) {
  // Count non-pawn, non-king material on board (max = 62 at start: 2Q + 4R + 4B + 4N)
  let material = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.isSpectral || p.type === PIECE.PAWN || p.type === PIECE.KING) continue;
    const weights = { N: 1, B: 1, R: 2, Q: 4 };
    material += weights[p.type] || 0;
  }
  // Start of game: ~24 (2*4 + 4*2 + 4*1 + 4*1). Endgame threshold: ~6
  return Math.min(1.0, material / 20);
}

// ---------- Mating Assistance: push enemy king to corner ----------
// Distance from center (higher = more cornered)
function botKingCornerDist(r, c) {
  const fileDist = Math.max(3 - c, c - 4);
  const rankDist = Math.max(3 - r, r - 4);
  return fileDist + rankDist;
}

// Manhattan distance between two squares
function botManhattan(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

function botPST(type, phase) {
  switch (type) {
    case PIECE.PAWN: return phase < 0.4 ? BOT_PST_PAWN_EG : BOT_PST_PAWN;
    case PIECE.KNIGHT: return BOT_PST_KNIGHT;
    case PIECE.BISHOP: return BOT_PST_BISHOP;
    case PIECE.KING: return phase < 0.4 ? BOT_PST_KING_EG : BOT_PST_KING;
    default: return null; // Rook/Queen use no table (mobility more important)
  }
}

function botPieceSquareValue(piece, r, c, phase) {
  if (phase === undefined) phase = 1.0; // default to middlegame if not provided
  const table = botPST(piece.type, phase);
  if (!table) return 0;
  // Tables are from white's perspective (row 0 = rank 8)
  const idx = piece.color === COLOR.WHITE ? (r * 8 + c) : ((7 - r) * 8 + c);
  return table[idx];
}

// ---------- Endgame Type Detection ----------
function botDetectEndgameType(state) {
  // Detect specific endgame types for tablebase-like knowledge
  let whitePieces = [], blackPieces = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.isSpectral) continue;
      if (p.color === COLOR.WHITE) whitePieces.push({ type: p.type, r, c });
      else blackPieces.push({ type: p.type, r, c });
    }
  }

  const wCount = whitePieces.length;
  const bCount = blackPieces.length;

  // K+Q vs K
  if (wCount === 2 && bCount === 1) {
    const hasQueen = whitePieces.some(p => p.type === PIECE.QUEEN);
    if (hasQueen) return { type: 'KQ_vs_K', winner: COLOR.WHITE };
  }
  if (bCount === 2 && wCount === 1) {
    const hasQueen = blackPieces.some(p => p.type === PIECE.QUEEN);
    if (hasQueen) return { type: 'KQ_vs_K', winner: COLOR.BLACK };
  }

  // K+R vs K
  if (wCount === 2 && bCount === 1) {
    const hasRook = whitePieces.some(p => p.type === PIECE.ROOK);
    if (hasRook) return { type: 'KR_vs_K', winner: COLOR.WHITE };
  }
  if (bCount === 2 && wCount === 1) {
    const hasRook = blackPieces.some(p => p.type === PIECE.ROOK);
    if (hasRook) return { type: 'KR_vs_K', winner: COLOR.BLACK };
  }

  // K+P vs K
  if (wCount === 2 && bCount === 1) {
    const pawn = whitePieces.find(p => p.type === PIECE.PAWN);
    if (pawn) return { type: 'KP_vs_K', winner: COLOR.WHITE, pawn };
  }
  if (bCount === 2 && wCount === 1) {
    const pawn = blackPieces.find(p => p.type === PIECE.PAWN);
    if (pawn) return { type: 'KP_vs_K', winner: COLOR.BLACK, pawn };
  }

  // K+2B vs K
  if (wCount === 3 && bCount === 1) {
    const bishops = whitePieces.filter(p => p.type === PIECE.BISHOP);
    if (bishops.length === 2) return { type: 'KBB_vs_K', winner: COLOR.WHITE };
  }
  if (bCount === 3 && wCount === 1) {
    const bishops = blackPieces.filter(p => p.type === PIECE.BISHOP);
    if (bishops.length === 2) return { type: 'KBB_vs_K', winner: COLOR.BLACK };
  }

  return { type: 'OTHER' };
}

// ---------- Tablebase-like Evaluation ----------
function botEndgameTablebase(state, endgameType, forColor) {
  // Returns a bonus score for known winning/drawing endgames
  if (endgameType.type === 'OTHER') return 0;

  const isWinner = endgameType.winner === forColor;
  const opp = opposite(forColor);
  const myKing = findKing(state.board, forColor);
  const oppKing = findKing(state.board, opp);
  if (!myKing || !oppKing) return 0;

  let bonus = 0;

  // K+Q vs K: Force king to corner, queen close for mate
  if (endgameType.type === 'KQ_vs_K') {
    if (isWinner) {
      const oppCorner = botKingCornerDist(oppKing.r, oppKing.c);
      const kingDist = botManhattan(myKing.r, myKing.c, oppKing.r, oppKing.c);
      bonus = oppCorner * 40 + (14 - kingDist) * 25 + 500;
    } else {
      bonus = -800;
    }
  }

  // K+R vs K: Drive to edge
  if (endgameType.type === 'KR_vs_K') {
    if (isWinner) {
      const oppEdgeDist = Math.min(oppKing.r, 7 - oppKing.r, oppKing.c, 7 - oppKing.c);
      const kingDist = botManhattan(myKing.r, myKing.c, oppKing.r, oppKing.c);
      bonus = (3 - oppEdgeDist) * 35 + (14 - kingDist) * 20 + 400;
    } else {
      bonus = -700;
    }
  }

  // K+P vs K: Square rule
  if (endgameType.type === 'KP_vs_K' && endgameType.pawn) {
    const pawn = endgameType.pawn;
    const promoRank = isWinner ? (forColor === COLOR.WHITE ? 0 : 7) : (forColor === COLOR.WHITE ? 7 : 0);
    const pawnDist = Math.abs(pawn.r - promoRank);
    const oppKingDist = botManhattan(oppKing.r, oppKing.c, pawn.r, pawn.c);

    if (isWinner) {
      const canCatch = oppKingDist <= pawnDist;
      if (!canCatch) {
        bonus = 600 + (7 - pawnDist) * 50;
      } else {
        const myKingDist = botManhattan(myKing.r, myKing.c, pawn.r, pawn.c);
        if (myKingDist < oppKingDist) {
          bonus = 300 + (7 - pawnDist) * 30;
        } else {
          bonus = 50;
        }
      }
    } else {
      const canCatch = botManhattan(myKing.r, myKing.c, pawn.r, pawn.c) <= pawnDist;
      bonus = canCatch ? -200 : -700;
    }
  }

  // K+2B vs K: Drive to corner
  if (endgameType.type === 'KBB_vs_K') {
    if (isWinner) {
      const oppCorner = botKingCornerDist(oppKing.r, oppKing.c);
      const kingDist = botManhattan(myKing.r, myKing.c, oppKing.r, oppKing.c);
      bonus = oppCorner * 30 + (14 - kingDist) * 20 + 350;
    } else {
      bonus = -650;
    }
  }

  return bonus;
}

// ---------- Enhanced Endgame Evaluation ----------
function botEndgameEval(state, forColor, myKingPos, oppKingPos, phase) {
  let score = 0;
  const opp = opposite(forColor);

  // KING ACTIVITY
  if (myKingPos) {
    const centerDist = Math.abs(myKingPos.r - 3.5) + Math.abs(myKingPos.c - 3.5);
    score += (7 - centerDist) * 12;

    // Opposition
    if (oppKingPos) {
      const fileDiff = Math.abs(myKingPos.c - oppKingPos.c);
      const rankDiff = Math.abs(myKingPos.r - oppKingPos.r);
      if (fileDiff === 0 && rankDiff === 2) score += 25;
      if (rankDiff === 0 && fileDiff === 2) score += 25;
      if (fileDiff === 2 && rankDiff === 2) score += 15;
    }
  }

  // PASSED PAWN FEATURES
  let myPassedFiles = [];
  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 8; r++) {
      const p = state.board[r][c];
      if (!p || p.type !== PIECE.PAWN || p.isSpectral || p.color !== forColor) continue;
      const dir = forColor === COLOR.WHITE ? -1 : 1;
      const promoRow = forColor === COLOR.WHITE ? 0 : 7;
      let passed = true;
      for (let scanR = r + dir; scanR !== promoRow + dir; scanR += dir) {
        if (scanR < 0 || scanR > 7) break;
        for (let dc = -1; dc <= 1; dc++) {
          const scanC = c + dc;
          if (scanC < 0 || scanC > 7) continue;
          const blocker = state.board[scanR][scanC];
          if (blocker && blocker.type === PIECE.PAWN && blocker.color !== forColor && !blocker.isSpectral) {
            passed = false; break;
          }
        }
        if (!passed) break;
      }
      if (passed) {
        myPassedFiles.push(c);
        // King supports passed pawn
        if (myKingPos) {
          const dist = botManhattan(myKingPos.r, myKingPos.c, r, c);
          if (dist <= 2) score += (3 - dist) * 30;
        }
        // Outside passed pawn
        if (oppKingPos) {
          const distFromKing = Math.abs(c - oppKingPos.c);
          if (distFromKing >= 3 && (c <= 1 || c >= 6)) {
            score += 60;
          }
        }
      }
    }
  }

  // Connected passed pawns
  for (let i = 0; i < myPassedFiles.length; i++) {
    for (let j = i + 1; j < myPassedFiles.length; j++) {
      if (Math.abs(myPassedFiles[i] - myPassedFiles[j]) === 1) {
        score += 70;
      }
    }
  }

  // PIECE COORDINATION
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.isSpectral) continue;

      // Rook behind passed pawn
      if (p.type === PIECE.ROOK) {
        const dir = forColor === COLOR.WHITE ? -1 : 1;
        for (let scanR = r + dir; scanR >= 0 && scanR < 8; scanR += dir) {
          const ahead = state.board[scanR][c];
          if (ahead && ahead.type === PIECE.PAWN && ahead.color === forColor && !ahead.isSpectral) {
            if (myPassedFiles.includes(c)) score += 50;
            break;
          }
        }
        // Rook on 7th with king on 8th
        const seventhRank = forColor === COLOR.WHITE ? 1 : 6;
        const eighthRank = forColor === COLOR.WHITE ? 0 : 7;
        if (r === seventhRank && oppKingPos && oppKingPos.r === eighthRank) {
          score += 80;
        }
      }

      // Knight outposts
      if (p.type === PIECE.KNIGHT) {
        const enemyHalf = forColor === COLOR.WHITE ? (r <= 3) : (r >= 4);
        if (enemyHalf) {
          let canBeAttacked = false;
          const pawnAttackRank = forColor === COLOR.WHITE ? r + 1 : r - 1;
          if (pawnAttackRank >= 0 && pawnAttackRank < 8) {
            for (const dc of [-1, 1]) {
              const pc = c + dc;
              if (pc >= 0 && pc < 8) {
                const attacker = state.board[pawnAttackRank][pc];
                if (attacker && attacker.type === PIECE.PAWN && attacker.color === opp && !attacker.isSpectral) {
                  canBeAttacked = true;
                  break;
                }
              }
            }
          }
          if (!canBeAttacked) score += 35;
        }
      }
    }
  }

  return score;
}

// ---------- Zugzwang Detection ----------
function botShouldDisableNullMove(state, forColor) {
  const phase = botGamePhase(state);
  if (phase > 0.3) return false;

  let totalMaterial = 0;
  let onlyPawnsAndKings = true;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.isSpectral) continue;
      totalMaterial += BOT_PIECE_VALUES[p.type];
      if (p.type !== PIECE.PAWN && p.type !== PIECE.KING) {
        onlyPawnsAndKings = false;
      }
    }
  }

  if (onlyPawnsAndKings) return true;
  if (totalMaterial <= 41300) return true;

  return false;
}

// ---------- Bomb Threat Detection ----------
// Returns { threatenedPieces: [...], totalValue: N } for pieces at risk from active bombs
function botBombThreatDetection(state, forColor) {
  const threatenedPieces = [];
  let totalValue = 0;

  // Check all active bombs
  for (const bomb of state.bombs || []) {
    // Only care about enemy bombs
    if (bomb.owner === forColor) continue;

    const turnsUntilDetonation = bomb.turnsLeft;

    // Scan 3x3 blast radius around bomb
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = bomb.r + dr, nc = bomb.c + dc;
        if (!inBounds(nr, nc)) continue;

        const piece = state.board[nr][nc];
        if (!piece || piece.color !== forColor || piece.type === PIECE.KING) continue;
        if (piece.isSpectral || piece.shieldHP > 0) continue; // spectral/shielded are safe

        const pieceValue = BOT_PIECE_VALUES[piece.type];
        threatenedPieces.push({
          r: nr,
          c: nc,
          piece,
          value: pieceValue,
          turnsUntilDetonation
        });
        totalValue += pieceValue;
      }
    }
  }

  return { threatenedPieces, totalValue };
}

// ---------- Board Evaluation ----------
function botEvaluate(state, forColor) {
  let score = 0;
  const opp = opposite(forColor);
  const phase = botGamePhase(state);

  let myMaterial = 0, oppMaterial = 0;
  let myPawnCount = 0, oppPawnCount = 0;
  let myKingPos = null, oppKingPos = null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      if (p.isSpectral) continue;

      if (p.type === PIECE.KING) {
        if (p.color === forColor) myKingPos = { r, c };
        else oppKingPos = { r, c };
      }

      const baseVal = BOT_PIECE_VALUES[p.type];
      const pstVal = botPieceSquareValue(p, r, c, phase);
      const val = baseVal + pstVal;

      if (p.color === forColor) {
        score += val;
        myMaterial += baseVal;
        if (p.type === PIECE.PAWN) myPawnCount++;
        if (p.shieldHP > 0) score += 50;
        if (p.imprisoned) score += BOT_PIECE_VALUES[p.imprisoned.type] * 0.5;
      } else {
        score -= val;
        oppMaterial += baseVal;
        if (p.type === PIECE.PAWN) oppPawnCount++;
        if (p.shieldHP > 0) score -= 50;
        if (p.imprisoned) score -= BOT_PIECE_VALUES[p.imprisoned.type] * 0.5;
      }

      // Frozen penalty
      if (p.frozenUntil && p.frozenUntil > state.turnNumber) {
        const penalty = baseVal * 0.15;
        if (p.color === forColor) score -= penalty;
        else score += penalty;
      }

      // PASSED PAWN BONUS (endgame): pawn with no enemy pawns in front on same or adjacent files
      if (p.type === PIECE.PAWN && phase < 0.6) {
        const dir = p.color === COLOR.WHITE ? -1 : 1;
        const promoRow = p.color === COLOR.WHITE ? 0 : 7;
        let passed = true;
        for (let scanR = r + dir; scanR !== promoRow + dir; scanR += dir) {
          if (scanR < 0 || scanR > 7) break;
          for (let dc = -1; dc <= 1; dc++) {
            const scanC = c + dc;
            if (scanC < 0 || scanC > 7) continue;
            const blocker = state.board[scanR][scanC];
            if (blocker && blocker.type === PIECE.PAWN && blocker.color !== p.color && !blocker.isSpectral) {
              passed = false; break;
            }
          }
          if (!passed) break;
        }
        if (passed) {
          const distToPromo = p.color === COLOR.WHITE ? r : (7 - r);
          const passedBonus = (7 - distToPromo) * 25; // big bonus for close-to-promotion
          if (p.color === forColor) score += passedBonus;
          else {
            // FIX 1: HUGE PENALTY for enemy pawns on 7th rank (about to promote)
            if (distToPromo === 1) {
              score -= 700; // Massive threat - must stop!
            } else {
              score -= passedBonus;
            }
          }
        }
      }
    }
  }

  // Aether advantage (scaled down in endgame — pieces matter more)
  score += (state.mana[forColor] - state.mana[opp]) * (phase > 0.5 ? 8 : 4);

  // Center control bonus (less important in endgame)
  if (controlsCenter(state, forColor)) score += 30 * phase;
  if (controlsCenter(state, opp)) score -= 30 * phase;

  // Fountain occupation bonus (increased priority for aether economy)
  const myFountains = occupiedFountains(state, forColor);
  const oppFountains = occupiedFountains(state, opp);
  score += myFountains * 60;
  score -= oppFountains * 60;

  // Fountain control strategic bonus (exponential scaling for multiple fountains)
  if (phase >= 0.4 && phase <= 0.8) {
    // Midgame: fountain control is critical for aether economy
    if (myFountains >= 2) score += myFountains * myFountains * 20; // exponential bonus
    if (oppFountains >= 2) score -= oppFountains * oppFountains * 20;
  }

  // Check bonus (higher in endgame — checks are more forcing)
  if (isInCheck(state.board, opp)) score += phase < 0.4 ? 80 : 40;
  if (isInCheck(state.board, forColor)) score -= phase < 0.4 ? 80 : 40;

  // ===== ENDGAME MATING DRIVE =====
  // When we have a material advantage, push enemy king to corner and our king close to it
  const materialAdvantage = myMaterial - oppMaterial;
  if (phase < 0.5 && materialAdvantage > 200 && oppKingPos && myKingPos) {
    // Reward: enemy king far from center (cornered)
    const oppCornerDist = botKingCornerDist(oppKingPos.r, oppKingPos.c);
    score += oppCornerDist * 15;

    // Reward: our king close to enemy king (for mating support)
    const kingDist = botManhattan(myKingPos.r, myKingPos.c, oppKingPos.r, oppKingPos.c);
    score += (14 - kingDist) * 8;

    // Extra bonus for extreme material advantage (should be winning)
    if (materialAdvantage > 500) {
      score += oppCornerDist * 10; // double down on cornering
      score += (14 - kingDist) * 5;
    }
  }

  // ===== TRADE-DOWN BONUS =====
  // When ahead in material, encourage trading (captures reduce opponent's counterplay)
  if (materialAdvantage > 200 && phase < 0.7) {
    // Fewer total pieces = bigger advantage for us (scale: up to +80)
    const totalPieces = myMaterial + oppMaterial - 40000; // subtract kings
    score += Math.max(0, (6000 - totalPieces) / 75);
  }

  // ===== KING SAFETY IN MIDDLEGAME =====
  if (phase > 0.5 && myKingPos) {
    // Penalize open king (no pawns nearby)
    let shieldPawns = 0;
    const kDir = forColor === COLOR.WHITE ? -1 : 1;
    for (let dc = -1; dc <= 1; dc++) {
      const pr = myKingPos.r + kDir, pc = myKingPos.c + dc;
      if (inBounds(pr, pc)) {
        const p = state.board[pr][pc];
        if (p && p.type === PIECE.PAWN && p.color === forColor) shieldPawns++;
      }
    }
    score += shieldPawns * 25;
    // Penalize king on open file (no own pawn on same file)
    let ownPawnOnFile = false;
    for (let scanR = 0; scanR < 8; scanR++) {
      const p = state.board[scanR][myKingPos.c];
      if (p && p.type === PIECE.PAWN && p.color === forColor) { ownPawnOnFile = true; break; }
    }
    if (!ownPawnOnFile) score -= 40;
    // Penalize king that has moved out of castled position (exposed)
    const castleFile = myKingPos.c;
    if (castleFile >= 2 && castleFile <= 5) score -= 30; // king in center = danger
  }

  // ===== OPPONENT KING SAFETY (exploit weakness) =====
  if (phase > 0.4 && oppKingPos) {
    let oppShieldPawns = 0;
    const oppKDir = opp === COLOR.WHITE ? -1 : 1;
    for (let dc = -1; dc <= 1; dc++) {
      const pr = oppKingPos.r + oppKDir, pc = oppKingPos.c + dc;
      if (inBounds(pr, pc)) {
        const p = state.board[pr][pc];
        if (p && p.type === PIECE.PAWN && p.color === opp) oppShieldPawns++;
      }
    }
    // Reward attacking positions when opponent king is exposed
    if (oppShieldPawns < 3) score += (3 - oppShieldPawns) * 25;

    // KING TROPISM: bonus for pieces aiming at enemy king zone
    // Weighted by piece type and distance (closer = bigger bonus)
    let tropismScore = 0;
    let attackerCount = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.PAWN || p.type === PIECE.KING || p.isSpectral) continue;
      const dist = Math.max(Math.abs(r - oppKingPos.r), Math.abs(c - oppKingPos.c)); // Chebyshev
      if (dist <= 3) {
        attackerCount++;
        const weight = p.type === PIECE.QUEEN ? 3 : p.type === PIECE.ROOK ? 2 : 1;
        tropismScore += weight * (4 - dist) * 8;
      }
    }
    // Non-linear scaling: multiple attackers are much more dangerous than one
    if (attackerCount >= 2 && oppShieldPawns < 3) {
      tropismScore = Math.floor(tropismScore * (1 + (attackerCount - 1) * 0.3));
    }
    score += tropismScore;
  }

  // ===== PIECE ACTIVITY / DEVELOPMENT =====
  // Penalize undeveloped minor pieces in the opening (still on back rank)
  if (phase > 0.7) {
    const backRank = forColor === COLOR.WHITE ? 7 : 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[backRank][c];
      if (p && p.color === forColor && (p.type === PIECE.KNIGHT || p.type === PIECE.BISHOP)) {
        score -= 35; // penalty for undeveloped minor piece
      }
    }
    const oppBackRank = opp === COLOR.WHITE ? 7 : 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[oppBackRank][c];
      if (p && p.color === opp && (p.type === PIECE.KNIGHT || p.type === PIECE.BISHOP)) {
        score += 35; // reward opponent being undeveloped
      }
    }
  }

  // ===== PIECE CONNECTIVITY (lightweight) =====
  // Only in middlegame: bonus for knights/bishops NOT on edges (more active)
  if (phase > 0.4) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.isSpectral) continue;
      if (p.type !== PIECE.KNIGHT && p.type !== PIECE.BISHOP) continue;
      // Central minors are more active (no isSquareAttacked needed — use position as proxy)
      const centralBonus = (r >= 2 && r <= 5 && c >= 2 && c <= 5) ? 15 : 0;
      if (p.color === forColor) score += centralBonus;
      else score -= centralBonus;
    }
  }

  // ===== BISHOP PAIR BONUS =====
  let myBishops = 0, oppBishops = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (p && p.type === PIECE.BISHOP && !p.isSpectral) {
      if (p.color === forColor) myBishops++;
      else oppBishops++;
    }
  }
  if (myBishops >= 2) score += 50;
  if (oppBishops >= 2) score -= 50;

  // ===== ROOK ON OPEN/SEMI-OPEN FILE + 7TH RANK =====
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.type !== PIECE.ROOK || p.isSpectral) continue;
    let ownPawns = 0, oppPawns = 0;
    for (let scanR = 0; scanR < 8; scanR++) {
      const fp = state.board[scanR][c];
      if (fp && fp.type === PIECE.PAWN && !fp.isSpectral) {
        if (fp.color === p.color) ownPawns++;
        else oppPawns++;
      }
    }
    const openBonus = (ownPawns === 0 && oppPawns === 0) ? 35 : ownPawns === 0 ? 20 : 0;
    // Rook on 7th rank (penultimate to opponent) is very strong
    const seventhRank = p.color === COLOR.WHITE ? 1 : 6;
    const rankBonus = r === seventhRank ? 40 : 0;
    if (p.color === forColor) score += openBonus + rankBonus;
    else score -= openBonus + rankBonus;
  }

  // ===== DOUBLED & ISOLATED PAWN PENALTIES =====
  for (let c = 0; c < 8; c++) {
    let myPawnsOnFile = 0, oppPawnsOnFile = 0;
    for (let r = 0; r < 8; r++) {
      const p = state.board[r][c];
      if (p && p.type === PIECE.PAWN && !p.isSpectral) {
        if (p.color === forColor) myPawnsOnFile++;
        else oppPawnsOnFile++;
      }
    }
    // Doubled pawns: penalty for each pawn beyond the first
    if (myPawnsOnFile > 1) score -= (myPawnsOnFile - 1) * 20;
    if (oppPawnsOnFile > 1) score += (oppPawnsOnFile - 1) * 20;
    // Isolated pawns: no friendly pawns on adjacent files
    if (myPawnsOnFile > 0) {
      let hasAdjacentFriendly = false;
      for (let ac = c - 1; ac <= c + 1; ac += 2) {
        if (ac < 0 || ac > 7) continue;
        for (let r = 0; r < 8; r++) {
          const p = state.board[r][ac];
          if (p && p.type === PIECE.PAWN && p.color === forColor && !p.isSpectral) { hasAdjacentFriendly = true; break; }
        }
        if (hasAdjacentFriendly) break;
      }
      if (!hasAdjacentFriendly) score -= 15 * myPawnsOnFile;
    }
    if (oppPawnsOnFile > 0) {
      let hasAdjacentFriendly = false;
      for (let ac = c - 1; ac <= c + 1; ac += 2) {
        if (ac < 0 || ac > 7) continue;
        for (let r = 0; r < 8; r++) {
          const p = state.board[r][ac];
          if (p && p.type === PIECE.PAWN && p.color === opp && !p.isSpectral) { hasAdjacentFriendly = true; break; }
        }
        if (hasAdjacentFriendly) break;
      }
      if (!hasAdjacentFriendly) score += 15 * oppPawnsOnFile;
    }
  }

  // ===== HANGING PIECE PENALTY (lightweight) =====
  // Only check QUEENS and ROOKS (high-value targets worth the isSquareAttacked cost).
  // Minor pieces are handled by the 3-ply search + quiescence (opponent captures them).
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.isSpectral || p.type === PIECE.KING) continue;
    if (p.shieldHP > 0) continue;
    const val = BOT_PIECE_VALUES[p.type];
    if (val < 500) continue; // Only Rook (500) and Queen (900)
    if (p.color === forColor) {
      if (isSquareAttacked(state.board, r, c, opp)) {
        if (!isSquareAttacked(state.board, r, c, forColor)) {
          score -= val * 0.5; // Hanging rook/queen = disaster
        }
      }
    } else {
      if (isSquareAttacked(state.board, r, c, forColor)) {
        if (!isSquareAttacked(state.board, r, c, opp)) {
          score += val * 0.5; // We can take their rook/queen
        }
      }
    }
  }

  // ===== BOMB THREAT PENALTY =====
  // Penalize pieces in blast radius of enemy bombs based on detonation timing
  const bombThreats = botBombThreatDetection(state, forColor);
  for (const threat of bombThreats.threatenedPieces) {
    let penalty = 0;
    if (threat.turnsUntilDetonation <= 1) {
      // Bomb detonates next turn (or this turn) — CRITICAL
      penalty = threat.value * 1.5; // 150% of piece value
    } else if (threat.turnsUntilDetonation === 2) {
      // Bomb detonates in 2 turns — urgent
      penalty = threat.value * 0.75; // 75% of piece value
    }
    score -= penalty;
  }

  // ===== ENHANCED ENDGAME EVALUATION =====
  if (phase < 0.5) {
    // Apply endgame-specific evaluation
    score += botEndgameEval(state, forColor, myKingPos, oppKingPos, phase);

    // Apply tablebase knowledge for simple endgames
    const endgameType = botDetectEndgameType(state);
    if (endgameType.type !== 'OTHER') {
      score += botEndgameTablebase(state, endgameType, forColor);
    }
  }

  // ===== LAYER 1: AETHER ECONOMY AWARENESS =====
  // Center control = +1 aether/turn = strategic value
  const centerSquares = [{r:4,c:3},{r:4,c:4},{r:3,c:3},{r:3,c:4}];
  let myCenterPieces = 0, oppCenterPieces = 0;
  for (const sq of centerSquares) {
    const p = state.board[sq.r][sq.c];
    if (!p || p.isSpectral) continue;
    if (p.color === forColor) myCenterPieces++;
    else oppCenterPieces++;
  }
  if (myCenterPieces > oppCenterPieces) {
    score += 150; // Worth 1.5 pawns - very strong for aether economy!
  }

  // AETHER BANK VALUE - aether IS power
  // Diminishing returns: first 10 points worth more than last 10
  const myAether = state.mana[forColor];
  const oppAether = state.mana[opp];
  function aetherValue(a) {
    if (a <= 10) return a * 20; // Early aether very valuable
    if (a <= 20) return 200 + (a-10) * 15; // Mid aether valuable
    return 350 + (a-20) * 10; // Late aether less valuable (capped soon)
  }
  const aetherAdvantage = aetherValue(myAether) - aetherValue(oppAether);
  score += aetherAdvantage;

  return score;
}

// ---------- Move Scoring ----------
function botScoreMove(state, from, to, forColor) {
  let score = 0;
  const piece = state.board[from.r][from.c];
  if (!piece) return -99999; // Safety: invalid move with no piece at source
  const target = state.board[to.r][to.c];
  const phase = botGamePhase(state);
  const opp = opposite(forColor);

  // Captures scored by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
  if (target && target.color !== piece.color) {
    if (target.shieldHP > 0) {
      score -= 200; // avoid hitting shields with valuable pieces
    } else {
      score += BOT_PIECE_VALUES[target.type] * 10 - BOT_PIECE_VALUES[piece.type];
      // Trade-down bonus: when ahead, captures are extra good
      const myMat = botCountMaterial(state, forColor);
      const oppMat = botCountMaterial(state, opp);
      if (myMat - oppMat > 200) score += BOT_PIECE_VALUES[target.type] * 2;

      // FIX 2: HUGE BONUS for capturing enemy pawns on 6th/7th rank
      if (target.type === PIECE.PAWN) {
        const distToPromo = target.color === COLOR.WHITE ? to.r : (7 - to.r);
        if (distToPromo <= 2) {
          score += 600; // Critical capture - stop the promotion threat!
        }
      }
    }
  }

  // SEE CHECK: Before applying positional bonuses, verify the move doesn't lose material
  // This prevents the bot from making tactical blunders masked by positional scoring
  if (target && target.color !== piece.color) {
    const seeScore = botSEE(state, to.r, to.c, from.r, from.c, forColor);
    // If SEE is very negative (losing significant material), drastically reduce move score
    if (seeScore < -100) {
      score += seeScore * 5; // Heavy penalty for bad trades

      // LAYER 2: Smart Trading - check aether context for marginal trades
      const tradeEval = botEvaluateTrade(piece, target, state.mana[forColor], state.mana[opp]);
      if (tradeEval > 50) {
        // Aether context makes this trade acceptable despite SEE
        score += 100; // Offset some of the penalty
      }

      // Don't apply positional bonuses to losing captures
      return score;
    }

    // LAYER 2: For even/slight-loss trades, factor in aether advantage
    if (seeScore >= -100 && seeScore <= 0) {
      const tradeEval = botEvaluateTrade(piece, target, state.mana[forColor], state.mana[opp]);
      score += tradeEval * 0.5; // Bonus/penalty based on aether context
    }
  }

  // Positional improvement (phase-aware)
  score += botPieceSquareValue(piece, to.r, to.c, phase) - botPieceSquareValue(piece, from.r, from.c, phase);

  // Promotions (huge bonus)
  if (piece.type === PIECE.PAWN && (to.r === 0 || to.r === 7)) score += 900;

  // Pawn advance bonus in endgame (push pawns toward promotion)
  if (piece.type === PIECE.PAWN && phase < 0.5) {
    const advanceDist = piece.color === COLOR.WHITE ? (from.r - to.r) : (to.r - from.r);
    score += advanceDist * 30;
  }

  // Moving to a fountain (high priority in midgame for aether economy)
  if (state.fountains.some(f => f.r === to.r && f.c === to.c)) {
    score += phase >= 0.4 && phase <= 0.8 ? 100 : 60; // Extra bonus in midgame
  }

  // Moving to center (less important in endgame)
  if (CENTER_SQUARES.some(sq => sq.r === to.r && sq.c === to.c)) score += 25 * phase;

  // Defusing a bomb
  if (state.bombs.some(b => b.r === to.r && b.c === to.c && b.owner !== forColor)) score += 150;

  // BOMB ESCAPE BONUS: evacuating a piece from blast radius
  // Check if piece is currently in a bomb blast zone
  let inBlastRadius = false;
  let bombTurnsLeft = 0;
  for (const bomb of state.bombs || []) {
    if (bomb.owner === forColor) continue; // ignore our own bombs
    const distFromBomb = Math.max(Math.abs(from.r - bomb.r), Math.abs(from.c - bomb.c));
    if (distFromBomb <= 1) {
      inBlastRadius = true;
      bombTurnsLeft = bomb.turnsLeft;
      break;
    }
  }

  if (inBlastRadius) {
    // Check if destination is OUTSIDE all bomb blast radii
    let destinationSafe = true;
    for (const bomb of state.bombs || []) {
      if (bomb.owner === forColor) continue;
      const distToBomb = Math.max(Math.abs(to.r - bomb.r), Math.abs(to.c - bomb.c));
      if (distToBomb <= 1) {
        destinationSafe = false;
        break;
      }
    }

    if (destinationSafe) {
      // Escaping from bomb! Priority based on piece value and urgency
      const pieceValue = BOT_PIECE_VALUES[piece.type];
      let escapeBonus = 100; // base escape bonus

      // Higher bonus for more valuable pieces
      if (pieceValue >= 900) escapeBonus += 150; // Queen
      else if (pieceValue >= 500) escapeBonus += 100; // Rook
      else if (pieceValue >= 320) escapeBonus += 50; // Knight/Bishop

      // Higher bonus for more urgent bombs (detonating soon)
      if (bombTurnsLeft <= 1) escapeBonus *= 2; // Double if detonates next turn

      score += escapeBonus;
    }
  }

  // KING MARCH in endgame: move king toward enemy king when ahead
  if (piece.type === PIECE.KING && phase < 0.4) {
    const myMat = botCountMaterial(state, forColor);
    const oppMat = botCountMaterial(state, opp);
    if (myMat - oppMat > 200) {
      const oppKing = findKing(state.board, opp);
      if (oppKing) {
        const oldDist = botManhattan(from.r, from.c, oppKing.r, oppKing.c);
        const newDist = botManhattan(to.r, to.c, oppKing.r, oppKing.c);
        score += (oldDist - newDist) * 20; // reward approaching enemy king
      }
    }

    // FIX 3: When BEHIND in material, king should attack dangerous enemy pawns
    if (myMat - oppMat < -200) {
      // Look for enemy pawns on 6th/7th rank near destination
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = to.r + dr, nc = to.c + dc;
          if (!inBounds(nr, nc)) continue;
          const p = state.board[nr][nc];
          if (p && p.color === opp && p.type === PIECE.PAWN) {
            const distToPromo = p.color === COLOR.WHITE ? nr : (7 - nr);
            if (distToPromo <= 2) {
              score += 300; // King must attack dangerous pawns when desperate!
            }
          }
        }
      }
    }
  }

  // CHECK BONUS: Lightweight heuristic — attacks near enemy king suggest check potential
  // (Full simulation is too expensive for quick-scoring 30+ moves; deep eval catches actual checks)
  const oppKing = findKing(state.board, opp);
  if (oppKing) {
    const distToKing = Math.abs(to.r - oppKing.r) + Math.abs(to.c - oppKing.c);
    if (distToKing <= 2 && piece.type !== PIECE.PAWN && piece.type !== PIECE.KING) {
      score += phase < 0.4 ? 40 : 20; // aggression bonus for moves near enemy king
    }
  }

  return score;
}

// Quick material counter (non-king, non-spectral)
function botCountMaterial(state, color) {
  let total = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (p && p.color === color && !p.isSpectral) total += BOT_PIECE_VALUES[p.type];
  }
  return total;
}

// ---------- Static Exchange Evaluation (SEE) ----------
// Calculates the material outcome of a full exchange sequence on a square.
// Returns the net material gain/loss for the side initiating the capture.
function botSEE(state, targetR, targetC, attackerR, attackerC, forColor) {
  const opp = opposite(forColor);
  const target = state.board[targetR][targetC];
  const attacker = state.board[attackerR][attackerC];

  if (!target || !attacker) return 0;

  // If target is shielded, SEE is always bad (we only break shield)
  if (target.shieldHP > 0) return -BOT_PIECE_VALUES[attacker.type];

  // Build list of attackers for both sides
  function findAttackers(board, targetR, targetC, color) {
    const attackers = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== color || p.isSpectral) continue;
        if (p.imprisoned || (p.frozenUntil && p.frozenUntil > state.turnNumber)) continue;

        const moves = legalMoves(board, r, c, state);
        if (moves.some(m => m.r === targetR && m.c === targetC)) {
          attackers.push({ r, c, value: BOT_PIECE_VALUES[p.type], type: p.type });
        }
      }
    }
    // Sort by value (sacrifice least valuable first)
    attackers.sort((a, b) => a.value - b.value);
    return attackers;
  }

  // Simulate the exchange sequence
  let gain = [BOT_PIECE_VALUES[target.type]];
  let boardCopy = snapshot(state.board);

  // First capture
  boardCopy[targetR][targetC] = attacker;
  boardCopy[attackerR][attackerC] = null;

  let currentPiece = attacker;
  let activeColor = opp; // Opponent recaptures next

  // Alternate captures until no more attackers
  for (let depth = 1; depth < 10; depth++) {
    const attackers = findAttackers(boardCopy, targetR, targetC, activeColor);
    if (attackers.length === 0) break;

    // Use least valuable attacker
    const nextAttacker = attackers[0];
    gain[depth] = BOT_PIECE_VALUES[currentPiece.type] - gain[depth - 1];

    // Make the capture on the copy
    currentPiece = boardCopy[nextAttacker.r][nextAttacker.c];
    boardCopy[nextAttacker.r][nextAttacker.c] = null;
    boardCopy[targetR][targetC] = currentPiece;

    activeColor = opposite(activeColor);
  }

  // Note: No need to restore - boardCopy was a local snapshot, state.board unchanged

  // Negamax the gain array
  for (let i = gain.length - 1; i > 0; i--) {
    gain[i - 1] = -Math.max(-gain[i - 1], gain[i]);
  }

  return gain[0];
}

// ---------- Alpha-Beta Search (Hard mode) ----------
// ENHANCED COMPUTATION: Increased depth for stronger play since bot is fast for humans
// Adaptive depth: 6-8 ply based on game phase with selective extensions.
// Includes alpha-beta pruning, adaptive null-move pruning, killer moves, LMR,
// enhanced check extensions, and deep quiescence search. Uses PVS at root.
// Target: 2-5 seconds per move with effective depth of 7-9 ply via extensions.
const BOT_BASE_DEPTH = 6; // Base search depth (increased from 4)
const BOT_ROOT_CANDIDATES = 25; // Deep-search top N root moves (increased from 20)

// Adaptive depth by game phase (ALL INCREASED BY 2 PLY)
function botGetSearchDepth(state) {
  const turnNumber = state.turnNumber || 0;

  // Opening (turns 1-10): 7-ply (increased from 5 for much stronger opening play)
  if (turnNumber <= 10) return 7;

  // Middlegame (turns 11-30): 7-ply (increased from 5, sees deep tactics)
  if (turnNumber <= 30) return 7;

  // Endgame (turns 31+): 8-ply (increased from 6, near-perfect endgame play)
  return 8;
}

// Killer moves: track moves that caused beta cutoffs at each depth (2 per depth)
// Increased size for deeper searches (now 16 for depth 8+ searches)
const BOT_KILLERS = Array.from({ length: 16 }, () => [null, null]);

// History heuristic: track which from-to moves are generally good
const BOT_HISTORY = {};

// Transposition table: cache position evaluations
// Using Zobrist-style simple position hash
// INCREASED SIZE for deeper searches (10k -> 50k entries)
const BOT_TT_SIZE = 50000;
const BOT_TT = new Map(); // key: positionHash, value: { score, depth, flag, bestMove }
const BOT_TT_EXACT = 0;
const BOT_TT_ALPHA = 1; // Upper bound
const BOT_TT_BETA = 2;  // Lower bound

function botClearSearchTables() {
  for (let i = 0; i < 16; i++) BOT_KILLERS[i] = [null, null];
  for (const k in BOT_HISTORY) delete BOT_HISTORY[k];
  BOT_TT.clear();
}

// Simple position hash for transposition table
function botPositionHash(state) {
  let hash = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      // Simple hash: piece type (6 bits) + color (1 bit) + position (6 bits)
      const pieceCode = ({ P: 1, N: 2, B: 3, R: 4, Q: 5, K: 6 })[p.type] || 0;
      const colorBit = p.color === COLOR.WHITE ? 0 : 1;
      hash = (hash * 31 + (pieceCode * 128 + colorBit * 64 + r * 8 + c)) >>> 0;
    }
  }
  // Mix in turn to distinguish same position with different side to move
  hash = (hash * 31 + (state.turn === COLOR.WHITE ? 1 : 2)) >>> 0;
  return hash;
}

// Store position in transposition table
function botTTStore(hash, depth, score, flag, bestMove) {
  if (BOT_TT.size >= BOT_TT_SIZE) {
    // Simple replacement: clear oldest entries (FIFO-like)
    const firstKey = BOT_TT.keys().next().value;
    BOT_TT.delete(firstKey);
  }
  BOT_TT.set(hash, { depth, score, flag, bestMove });
}

// Probe transposition table
function botTTProbe(hash, depth, alpha, beta) {
  const entry = BOT_TT.get(hash);
  if (!entry || entry.depth < depth) return null;

  // Check if we can use cached score
  if (entry.flag === BOT_TT_EXACT) return { score: entry.score, bestMove: entry.bestMove };
  if (entry.flag === BOT_TT_ALPHA && entry.score <= alpha) return { score: alpha };
  if (entry.flag === BOT_TT_BETA && entry.score >= beta) return { score: beta };

  return { bestMove: entry.bestMove }; // At least return best move for ordering
}

function botHistoryKey(m) { return `${m.from.r}${m.from.c}${m.to.r}${m.to.c}`; }

function botStoreKiller(depth, m) {
  if (depth < 0 || depth >= BOT_KILLERS.length) return;
  const k = BOT_KILLERS[depth];
  if (k[0] && k[0].from.r === m.from.r && k[0].from.c === m.from.c && k[0].to.r === m.to.r && k[0].to.c === m.to.c) return;
  k[1] = k[0]; k[0] = m;
}

function botIsKiller(depth, m) {
  if (depth < 0 || depth >= BOT_KILLERS.length) return false;
  const k = BOT_KILLERS[depth];
  for (let i = 0; i < 2; i++) {
    if (k[i] && k[i].from.r === m.from.r && k[i].from.c === m.from.c && k[i].to.r === m.to.r && k[i].to.c === m.to.c) return true;
  }
  return false;
}

// Quick move-ordering score (no board copies — pure heuristics)
// Used in inner tree nodes: MUST be fast (no isSquareAttacked calls)
// Now includes killer/history bonuses for better pruning.
function botOrderScore(state, m, forColor, depth) {
  let s = 0;
  const piece = state.board[m.from.r][m.from.c];
  if (!piece) return 0; // Safety: invalid move with no piece at source
  const target = state.board[m.to.r][m.to.c];
  // MVV-LVA for captures
  if (target && target.color !== piece.color) {
    s += 10000 + BOT_PIECE_VALUES[target.type] * 10 - BOT_PIECE_VALUES[piece.type];
  }
  // Promotions
  if (piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) s += 9000;
  // Killer move bonus (non-capture moves that caused cutoffs at this depth)
  if (depth !== undefined && !target && botIsKiller(depth, m)) s += 8000;
  // History heuristic
  const hk = botHistoryKey(m);
  if (BOT_HISTORY[hk]) s += Math.min(BOT_HISTORY[hk], 4000);
  // PST improvement
  const phase = botGamePhase(state);
  s += botPieceSquareValue(piece, m.to.r, m.to.c, phase) - botPieceSquareValue(piece, m.from.r, m.from.c, phase);

  // ===== LAYER 5: FOUNTAIN & CENTER FIGHTING =====
  // Fountain occupation (worth +2 aether/turn)
  if (state.fountains.some(f => f.r === m.to.r && f.c === m.to.c)) {
    s += 300; // Very high priority! Worth ~3 pawns in move ordering
    // Even higher if capturing on fountain
    if (target && target.color !== piece.color) {
      s += 400; // Kick opponent off fountain!
    }
  }

  // Center occupation (worth +1 aether/turn)
  const centerSquares = [{r:4,c:3},{r:4,c:4},{r:3,c:3},{r:3,c:4}];
  if (centerSquares.some(sq => sq.r === m.to.r && sq.c === m.to.c)) {
    s += 200; // High priority
    // Even higher if capturing on center
    if (target && target.color !== piece.color) {
      s += 300; // Kick opponent out of center!
    }
  }
  // King aggression in endgame
  if (phase < 0.5 && piece.type !== PIECE.KING) {
    const oppKing = findKing(state.board, opposite(forColor));
    if (oppKing) {
      const dist = Math.abs(m.to.r - oppKing.r) + Math.abs(m.to.c - oppKing.c);
      if (dist <= 2) s += 300;
    }
  }
  return s;
}

// Root-level move ordering: includes safety checks (isSquareAttacked + SEE).
// Only called once at the root, so cost is acceptable.
function botRootOrderScore(state, m, forColor) {
  let s = botOrderScore(state, m, forColor);
  const opp = opposite(forColor);
  const piece = state.board[m.from.r][m.from.c];
  if (!piece) return 0; // Safety: invalid move with no piece at source
  const target = state.board[m.to.r][m.to.c];

  // Fountain priority at root level (strategic control)
  if (state.fountains.some(f => f.r === m.to.r && f.c === m.to.c)) {
    s += 30; // bonus for moves landing on fountains
  }

  if (target && target.color !== piece.color) {
    // USE SEE to evaluate capture safety (more accurate than simple attack checks)
    const seeScore = botSEE(state, m.to.r, m.to.c, m.from.r, m.from.c, forColor);

    // SEE negative = we lose material in the exchange
    if (seeScore < 0) {
      s += seeScore * 10; // Heavy penalty for bad trades
    } else if (seeScore > 0) {
      s += seeScore * 2; // Bonus for winning trades
    }
    // If SEE == 0, it's an even trade, keep base MVV-LVA score
  } else {
    // Non-capture: penalize moving to an attacked square (hanging piece)
    if (piece.type !== PIECE.PAWN && isSquareAttacked(state.board, m.to.r, m.to.c, opp)) {
      if (!isSquareAttacked(state.board, m.to.r, m.to.c, forColor)) {
        s -= BOT_PIECE_VALUES[piece.type] * 3; // heavy penalty: piece will be lost
      } else if (BOT_PIECE_VALUES[piece.type] > 320) {
        // Check SEE for moving into a contested square
        const seeScore = botSEE(state, m.to.r, m.to.c, m.from.r, m.from.c, forColor);
        if (seeScore < 0) {
          s -= BOT_PIECE_VALUES[piece.type]; // Penalize if SEE says we'll lose the piece
        }
      }
    }
  }

  // RETREAT BONUS: if a piece is currently attacked and moves to safety, boost it
  if (piece.type !== PIECE.PAWN && piece.type !== PIECE.KING) {
    const pieceVal = BOT_PIECE_VALUES[piece.type];
    if (isSquareAttacked(state.board, m.from.r, m.from.c, opp)) {
      // Piece is currently under attack — check if destination is safe
      if (!isSquareAttacked(state.board, m.to.r, m.to.c, opp)) {
        s += pieceVal * 2; // Retreating saves the piece: high priority
      }
    }
  }

  return s;
}

// Negamax with alpha-beta pruning, adaptive null-move pruning, enhanced extensions, LMR, and TT
function botNegamax(state, depth, alpha, beta, forColor, nullMoveAllowed, ply) {
  const opp = opposite(forColor);
  if (nullMoveAllowed === undefined) nullMoveAllowed = true;
  if (ply === undefined) ply = 0;

  // CRITICAL: Maximum ply safety check to prevent stack overflow
  // With endgame depth of 6 + extensions, we need a hard cap
  const MAX_PLY = 10;
  if (ply >= MAX_PLY) {
    return botEvaluate(state, forColor);
  }

  // Transposition table probe
  const posHash = botPositionHash(state);
  const ttEntry = botTTProbe(posHash, depth, alpha, beta);
  if (ttEntry && ttEntry.score !== undefined) return ttEntry.score;

  // Terminal check
  if (depth <= 0) {
    return botQuiesce(state, alpha, beta, forColor, 0);
  }

  const inCheck = isInCheck(state.board, forColor);
  const moves = allLegalMoves(state.board, forColor, state);

  // Checkmate / stalemate
  if (moves.length === 0) {
    if (inCheck) return -99999 + ply; // Checkmate (prefer faster mates)
    return 0; // Stalemate
  }

  // ENHANCED CHECK EXTENSION: +2 ply when in check (increased from +1)
  let extension = 0;
  if (inCheck) extension = 2;

  // ADAPTIVE NULL-MOVE PRUNING: adjust reduction based on depth
  // R = 3 at depth >= 6, R = 2 at depth 3-5, R = 1 at depth <= 2
  const shouldDisableNullMove = botShouldDisableNullMove(state, forColor);
  if (nullMoveAllowed && !inCheck && !shouldDisableNullMove && depth >= 3 && botCountMaterial(state, forColor) > 22000) {
    let R = 2; // default reduction
    if (depth >= 6) R = 3; // aggressive pruning in deep nodes
    else if (depth <= 2) R = 1; // careful pruning near leaves

    const nmScore = -botNegamax(state, depth - R - 1, -beta, -beta + 1, opp, false, ply + 1);
    if (nmScore >= beta) {
      // Multi-cut pruning: if we get beta cutoff at reduced depth, position is likely too good
      return beta;
    }
  }

  // TT move ordering: try TT move first if available
  let ttMove = ttEntry?.bestMove;

  // Move ordering: TT move first, then captures & promotions, then killers/history
  const currentDepth = ply;
  moves.sort((a, b) => {
    // Prioritize TT move
    if (ttMove) {
      const aTT = a.from.r === ttMove.from?.r && a.from.c === ttMove.from?.c &&
                  a.to.r === ttMove.to?.r && a.to.c === ttMove.to?.c;
      const bTT = b.from.r === ttMove.from?.r && b.from.c === ttMove.from?.c &&
                  b.to.r === ttMove.to?.r && b.to.c === ttMove.to?.c;
      if (aTT && !bTT) return -1;
      if (bTT && !aTT) return 1;
    }
    return botOrderScore(state, b, forColor, currentDepth) - botOrderScore(state, a, forColor, currentDepth);
  });

  let bestScore = -Infinity;
  let bestMove = null;
  let moveCount = 0;
  const originalAlpha = alpha;

  for (const m of moves) {
    moveCount++;
    const snap = snapshot(state.board);
    const piece = state.board[m.from.r][m.from.c];
    const target = state.board[m.to.r][m.to.c];
    const isCapture = !!(target && target.color !== piece.color);
    const isPawnTo7th = piece?.type === PIECE.PAWN && (forColor === COLOR.WHITE ? m.to.r === 1 : m.to.r === 6);
    const isPromotion = piece?.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7);

    const moveInfo = { r: m.to.r, c: m.to.c, capture: m.move.capture, castle: m.move.castle, enPassant: m.move.enPassant };
    applyMoveRaw(state.board, m.from.r, m.from.c, moveInfo, state);
    if (isPromotion) {
      state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, forColor);
    }

    // SELECTIVE SEARCH EXTENSIONS
    let moveExtension = extension;

    // Capture extension: +1 ply for captures of high-value pieces (Q/R)
    if (isCapture && target && BOT_PIECE_VALUES[target.type] >= 500) {
      moveExtension = Math.max(moveExtension, 1);
    }

    // Pawn-to-7th extension: +1 ply when pawn reaches 7th rank (promotion imminent)
    if (isPawnTo7th) {
      moveExtension = Math.max(moveExtension, 1);
    }

    // Passed pawn push extension: +1 ply when passed pawn advances in endgame
    if (piece?.type === PIECE.PAWN && botGamePhase(state) < 0.5) {
      // Check if this is a passed pawn advancing
      const dir = forColor === COLOR.WHITE ? -1 : 1;
      const promoRow = forColor === COLOR.WHITE ? 0 : 7;
      let isPassed = true;
      for (let scanR = m.to.r + dir; scanR !== promoRow + dir; scanR += dir) {
        if (scanR < 0 || scanR > 7) break;
        for (let dc = -1; dc <= 1; dc++) {
          const scanC = m.to.c + dc;
          if (scanC < 0 || scanC > 7) continue;
          const blocker = state.board[scanR][scanC];
          if (blocker && blocker.type === PIECE.PAWN && blocker.color !== forColor && !blocker.isSpectral) {
            isPassed = false;
            break;
          }
        }
        if (!isPassed) break;
      }
      if (isPassed && Math.abs(m.to.r - m.from.r) > 0) {
        moveExtension = Math.max(moveExtension, 1);
      }
    }

    // CRITICAL: Cap total extension to prevent runaway depth
    // Don't allow extensions if we're already near MAX_PLY
    if (ply >= MAX_PLY - 2) {
      moveExtension = 0;
    }

    const newDepth = depth - 1 + moveExtension;
    let score;

    // Late Move Reduction: for late quiet moves, search with reduced depth first
    if (moveCount > 4 && depth >= 3 && !inCheck && !isCapture && !botIsKiller(currentDepth, m) && moveExtension === 0) {
      // Reduced search (depth - 2 instead of depth - 1)
      score = -botNegamax(state, newDepth - 1, -alpha - 1, -alpha, opp, true, ply + 1);
      // If it fails high, re-search at full depth
      if (score > alpha) {
        score = -botNegamax(state, newDepth, -beta, -alpha, opp, true, ply + 1);
      }
    } else {
      score = -botNegamax(state, newDepth, -beta, -alpha, opp, true, ply + 1);
    }
    restore(state.board, snap);

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }

    if (score >= beta) {
      // Beta cutoff — store killer and history for move ordering
      if (!isCapture) {
        botStoreKiller(currentDepth, m);
        const hk = botHistoryKey(m);
        BOT_HISTORY[hk] = (BOT_HISTORY[hk] || 0) + depth * depth;
      }
      // Store in TT as lower bound
      botTTStore(posHash, depth, beta, BOT_TT_BETA, bestMove);
      return beta;
    }
    if (score > alpha) {
      alpha = score;
    }
  }

  // Store in TT
  const flag = bestScore <= originalAlpha ? BOT_TT_ALPHA : (bestScore >= beta ? BOT_TT_BETA : BOT_TT_EXACT);
  botTTStore(posHash, depth, bestScore, flag, bestMove);

  return alpha;
}

// ENHANCED Quiescence search: captures + promotions + check-giving moves + recaptures
// Deeper max depth (8) for better tactical vision. Delta pruning to cut futile branches.
function botQuiesce(state, alpha, beta, forColor, qDepth, lastCaptureSquare) {
  if (qDepth === undefined) qDepth = 0;
  if (lastCaptureSquare === undefined) lastCaptureSquare = null;

  const standPat = botEvaluate(state, forColor);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  // Delta pruning threshold: if even capturing a queen can't improve alpha, cut
  const DELTA = 975; // queen value + margin
  if (standPat + DELTA < alpha) return alpha;

  // Max quiescence depth: 12 (increased from 8 for even deeper tactical vision)
  // Combined with base depth 7-8, total effective depth can reach 19-20 ply in critical lines
  if (qDepth >= 12) return standPat;

  const opp = opposite(forColor);
  const moves = allLegalMoves(state.board, forColor, state);

  // ENHANCED tactical moves: captures + promotions + check-giving moves + recaptures
  const tacticalMoves = [];
  for (const m of moves) {
    const p = state.board[m.from.r][m.from.c];
    let isTactical = false;

    // 1. Captures
    if (m.move.capture) {
      isTactical = true;
    }

    // 2. Promotions
    if (p && p.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
      isTactical = true;
    }

    // 3. Check-giving moves (can lead to tactics)
    // Quick check: does this move attack enemy king?
    if (!isTactical && qDepth <= 2) { // Only check for checks in shallow qsearch
      const snap = snapshot(state.board);
      const moveInfo = { r: m.to.r, c: m.to.c, capture: m.move.capture, castle: m.move.castle, enPassant: m.move.enPassant };
      applyMoveRaw(state.board, m.from.r, m.from.c, moveInfo, state);
      if (p && p.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
        state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, forColor);
      }
      const givesCheck = isInCheck(state.board, opp);
      restore(state.board, snap);
      if (givesCheck) {
        isTactical = true;
        m.givesCheck = true; // mark for prioritization
      }
    }

    // 4. Recaptures on same square (exchange evaluation)
    if (!isTactical && lastCaptureSquare && m.to.r === lastCaptureSquare.r && m.to.c === lastCaptureSquare.c) {
      isTactical = true;
      m.isRecapture = true;
    }

    if (isTactical) {
      tacticalMoves.push(m);
    }
  }

  // Sort by MVV-LVA + promotion bonus + check bonus
  tacticalMoves.sort((a, b) => {
    let aVal = 0, bVal = 0;

    // Target value (victim)
    const aTarget = state.board[a.to.r][a.to.c];
    const bTarget = state.board[b.to.r][b.to.c];
    if (aTarget) aVal += BOT_PIECE_VALUES[aTarget.type] * 10;
    if (bTarget) bVal += BOT_PIECE_VALUES[bTarget.type] * 10;

    // Attacker value (subtract for MVV-LVA)
    const aP = state.board[a.from.r][a.from.c];
    const bP = state.board[b.from.r][b.from.c];
    if (aP) aVal -= BOT_PIECE_VALUES[aP.type];
    if (bP) bVal -= BOT_PIECE_VALUES[bP.type];

    // Promotion bonus
    if (aP && aP.type === PIECE.PAWN && (a.to.r === 0 || a.to.r === 7)) aVal += 9000;
    if (bP && bP.type === PIECE.PAWN && (b.to.r === 0 || b.to.r === 7)) bVal += 9000;

    // Check-giving move bonus
    if (a.givesCheck) aVal += 5000;
    if (b.givesCheck) bVal += 5000;

    // Recapture bonus
    if (a.isRecapture) aVal += 3000;
    if (b.isRecapture) bVal += 3000;

    return bVal - aVal;
  });

  // Evaluate top tactical moves (more at root of qsearch, fewer deeper)
  const limit = qDepth === 0 ? 12 : qDepth === 1 ? 8 : 5;
  const topMoves = tacticalMoves.slice(0, limit);

  for (const m of topMoves) {
    const target = state.board[m.to.r][m.to.c];
    const piece = state.board[m.from.r][m.from.c];

    // SEE-based pruning: skip obviously bad captures (but allow checks/promotions)
    if (target && piece && !m.givesCheck) {
      const tVal = BOT_PIECE_VALUES[target.type];
      const pVal = BOT_PIECE_VALUES[piece.type];
      // Skip captures where we lose material significantly
      if (pVal > tVal + 200 && qDepth > 1) {
        // Quick check: is our piece going to be captured back?
        if (isSquareAttacked(state.board, m.to.r, m.to.c, opp)) continue;
      }
    }

    const snap = snapshot(state.board);
    const moveInfo = { r: m.to.r, c: m.to.c, capture: m.move.capture, castle: m.move.castle, enPassant: m.move.enPassant };
    applyMoveRaw(state.board, m.from.r, m.from.c, moveInfo, state);
    if (piece && piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
      state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, forColor);
    }

    // Track last capture square for recapture detection
    const captureSquare = m.move.capture ? { r: m.to.r, c: m.to.c } : lastCaptureSquare;

    const score = -botQuiesce(state, -beta, -alpha, opp, qDepth + 1, captureSquare);
    restore(state.board, snap);

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

// Root-level search: picks the best move using PVS (Principal Variation Search)
// with iterative deepening for time management and aspiration windows.
function botSearchBestMove(state, moves, forColor) {
  const opp = opposite(forColor);
  botClearSearchTables(); // fresh killers/history each search

  // Quick-score all moves for ordering (root uses safety-aware scoring)
  const scored = moves.map(m => ({ m, s: botRootOrderScore(state, m, forColor) }));
  scored.sort((a, b) => b.s - a.s);

  // Only deep-search the top candidates
  const candidates = scored.slice(0, Math.min(BOT_ROOT_CANDIDATES, scored.length));

  // Iterative deepening with adaptive depth by game phase
  let bestMove = candidates[0].m;
  let bestScore = -Infinity;

  const startTime = Date.now();
  const maxTime = 4000; // Increased time budget to 4s for much deeper searches (from 1.8s)

  // ADAPTIVE DEPTH BY GAME PHASE
  const maxDepth = botGetSearchDepth(state);

  for (let searchDepth = 2; searchDepth <= maxDepth; searchDepth++) {
    let iterBest = candidates[0].m;
    let iterScore = -Infinity;

    // ASPIRATION WINDOWS: start with narrow window around previous score
    let alpha = searchDepth <= 2 ? -Infinity : bestScore - 50;
    let beta = searchDepth <= 2 ? Infinity : bestScore + 50;
    let aspirationFailed = false;

    // Put previous iteration's best move first
    const orderedCandidates = [...candidates];
    if (searchDepth > 2) {
      const pvIdx = orderedCandidates.findIndex(c => c.m === bestMove);
      if (pvIdx > 0) {
        const pv = orderedCandidates.splice(pvIdx, 1)[0];
        orderedCandidates.unshift(pv);
      }
    }

    let moveIdx = 0;
    for (const { m } of orderedCandidates) {
      moveIdx++;
      const snap = snapshot(state.board);
      const piece = state.board[m.from.r][m.from.c];
      if (!piece) {
        // Safety: skip invalid moves where source square has no piece
        restore(state.board, snap);
        continue;
      }
      const moveInfo = { r: m.to.r, c: m.to.c, capture: m.move.capture, castle: m.move.castle, enPassant: m.move.enPassant };
      applyMoveRaw(state.board, m.from.r, m.from.c, moveInfo, state);
      if (piece && piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
        state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, forColor);
      }

      let score;
      // PVS: first move gets full window, rest get zero-window first
      if (moveIdx === 1) {
        score = -botNegamax(state, searchDepth - 1, -beta, -alpha, opp, true, 0);

        // Aspiration window re-search if score falls outside
        if (searchDepth > 2 && (score <= alpha || score >= beta)) {
          alpha = -Infinity;
          beta = Infinity;
          score = -botNegamax(state, searchDepth - 1, -beta, -alpha, opp, true, 0);
          aspirationFailed = true;
        }
      } else {
        // Zero-window search
        score = -botNegamax(state, searchDepth - 1, -alpha - 1, -alpha, opp, true, 0);
        if (score > alpha && score < beta) {
          // Re-search with full window
          score = -botNegamax(state, searchDepth - 1, -beta, -alpha, opp, true, 0);
        }
      }
      restore(state.board, snap);

      // Repetition penalty: heavily discourage repeating the same move
      const repeats = botMoveRepeatCount(m.from, m.to);
      if (repeats > 0) score -= repeats * 200;

      if (score > iterScore) {
        iterScore = score;
        iterBest = m;
      }
      if (score > alpha) alpha = score;

      // Time check mid-iteration: stop if running out of time
      if (Date.now() - startTime > maxTime * 0.8) break;
    }

    bestMove = iterBest;
    bestScore = iterScore;

    // Time check: don't start next depth if we've used > 50% of budget
    // (more conservative to ensure we complete the current depth)
    const elapsed = Date.now() - startTime;
    if (elapsed > maxTime * 0.5) {
      // console.log(`[bot] Completed depth ${searchDepth} in ${elapsed}ms, stopping iterative deepening`);
      break;
    }
  }

  return bestMove;
}

// ===== LAYER 2: SMART TRADING SYSTEM =====
function botEvaluateTrade(myPiece, theirPiece, myAether, oppAether) {
  const myMaterialLoss = BOT_PIECE_VALUES[myPiece.type];
  const theirMaterialLoss = BOT_PIECE_VALUES[theirPiece.type];
  const materialDiff = theirMaterialLoss - myMaterialLoss;

  // Aether compensation: losing piece hurts less if you're high on aether
  let aetherCompensation = 0;
  if (myAether >= 20) {
    aetherCompensation = 50; // Have resources for powers
  }
  if (myAether >= 28) {
    aetherCompensation = 100; // Can afford any power
  }

  // Opponent's aether threat: trading down is good if opponent is high on aether
  let aetherThreat = 0;
  if (oppAether >= 18 && myPiece.type === PIECE.QUEEN) {
    aetherThreat = -150; // They can Vengeance your Queen!
  }
  if (oppAether >= 14 && theirPiece.type === PIECE.QUEEN) {
    aetherThreat = 100; // Remove their Queen before they shield it
  }

  return materialDiff + aetherCompensation + aetherThreat;
}

// ===== LAYER 3: POWER COMBO SYSTEM =====
function botEvaluatePowerCombos(state, forColor) {
  const aether = state.mana[forColor];
  const combos = [];

  // Shield + Attack combo
  if (aether >= 14) { // FORTIFY cost
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
      if (p.shieldHP > 0) continue; // Already shielded

      const moves = legalMoves(state.board, r, c, state);
      const profitableAttacks = moves.filter(m => {
        const target = state.board[m.r][m.c];
        return target && target.color !== forColor && BOT_PIECE_VALUES[target.type] >= 300;
      });

      if (profitableAttacks.length > 0) {
        combos.push({ type: 'SHIELD_ATTACK', priority: 200, piece: {r, c}, attacks: profitableAttacks });
      }
    }
  }

  // Double Attack combo (ALWAYS HIGH PRIORITY when 2+ captures available)
  if (aether >= 14) { // DOUBLE_ATTACK cost
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.KING) continue;
      if (p.isSpectral) continue;
      if (p.frozenUntil && p.frozenUntil > state.turnNumber) continue;

      const firstMoves = legalMoves(state.board, r, c, state);
      const firstCaptures = firstMoves.filter(m => m.capture);

      // Check if after first capture, we can make a second capture
      for (const m1 of firstCaptures) {
        const target1 = state.board[m1.r][m1.c];
        if (!target1 || target1.shieldHP > 0) continue; // Skip shielded

        // Simulate first move
        const snap = snapshot(state.board);
        state.board[m1.r][m1.c] = p;
        state.board[r][c] = null;

        const secondMoves = legalMoves(state.board, m1.r, m1.c, state);
        const secondCaptures = secondMoves.filter(m =>
          m.capture && !(m.r === m1.r && m.c === m1.c) // Not same square
        );

        restore(state.board, snap);

        if (secondCaptures.length > 0) {
          // Can capture first target, then capture another!
          combos.push({
            type: 'DOUBLE_ATTACK',
            priority: 300,
            from: {r, c},
            targets: [m1, secondCaptures[0]] // First capture and best second capture
          });
          break; // Found a combo, no need to check other first moves
        }
      }

      // Or: break shield + capture same piece
      const shieldedTargets = firstCaptures.filter(m => {
        const target = state.board[m.r][m.c];
        return target && target.shieldHP > 0;
      });
      if (shieldedTargets.length > 0) {
        combos.push({ type: 'DOUBLE_ATTACK_SHIELD', priority: 250, from: {r, c}, targets: shieldedTargets });
      }

      // ALTERNATE: If piece has 2+ capture options from current position, consider Double Attack
      // This is less selective but catches more opportunities
      if (firstCaptures.length >= 2) {
        const unshieldedCaptures = firstCaptures.filter(m => {
          const t = state.board[m.r][m.c];
          return t && t.shieldHP === 0;
        });
        if (unshieldedCaptures.length >= 2) {
          const totalValue = unshieldedCaptures.slice(0, 2).reduce((sum, m) =>
            sum + BOT_PIECE_VALUES[state.board[m.r][m.c].type], 0
          );
          if (totalValue >= 300) { // At least minor piece value
            combos.push({
              type: 'DOUBLE_ATTACK',
              priority: 200 + totalValue * 0.3,
              from: {r, c},
              targets: [unshieldedCaptures[0], unshieldedCaptures[1]]
            });
          }
        }
      }
    }
  }

  // Imprison + Attack combo
  if (aether >= 14) { // IMPRISON cost
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const defender = state.board[r][c];
      if (!defender || defender.color === forColor || defender.type === PIECE.KING) continue;
      if (defender.isSpectral) continue;

      // Check if imprisoning this piece enables capturing a high-value piece
      const protectedPieces = [];
      for (let pr = 0; pr < 8; pr++) for (let pc = 0; pc < 8; pc++) {
        const protected = state.board[pr][pc];
        if (!protected || protected.color === forColor) continue;
        if (BOT_PIECE_VALUES[protected.type] >= 500) { // Queen or high value
          // Check if defender protects this square
          const defMoves = legalMoves(state.board, r, c, state);
          if (defMoves.some(m => m.r === pr && m.c === pc)) {
            protectedPieces.push({r: pr, c: pc});
          }
        }
      }

      if (protectedPieces.length > 0) {
        combos.push({ type: 'IMPRISON_ATTACK', priority: 220, defender: {r, c}, targets: protectedPieces });
      }
    }
  }

  return combos;
}

// ===== LAYER 6: TACTICAL PATTERN RECOGNITION =====
// Advanced tactical pattern detector - recognizes chess tactics enhanced with powers
function botDetectTacticalPatterns(state, forColor) {
  const patterns = [];
  const opp = opposite(forColor);

  // Pattern 1: FORK - Piece attacks 2+ valuable targets
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece || piece.color !== forColor || piece.isSpectral) continue;
      if (piece.imprisoned || (piece.frozenUntil && piece.frozenUntil > state.turnNumber)) continue;

      const moves = legalMoves(state.board, r, c, state);
      for (const move of moves) {
        // Simulate move to new square
        const snap = snapshot(state.board);
        const captured = state.board[move.r][move.c];
        state.board[move.r][move.c] = piece;
        state.board[r][c] = null;

        // Check what this piece now attacks
        const attacks = typeof getAttackSquares === 'function' ?
          getAttackSquares(state.board, move.r, move.c) : [];

        const highValueTargets = attacks.filter(sq => {
          const target = state.board[sq.r][sq.c];
          return target && target.color === opp &&
                 BOT_PIECE_VALUES[target.type] >= 300 && // Knight or better
                 !target.isSpectral;
        });

        restore(state.board, snap);

        if (highValueTargets.length >= 2) {
          const totalValue = highValueTargets.reduce((sum, t) =>
            sum + BOT_PIECE_VALUES[state.board[t.r][t.c].type], 0);

          patterns.push({
            type: 'FORK',
            piece: {r, c},
            forkSquare: {r: move.r, c: move.c},
            targets: highValueTargets,
            value: totalValue,
            powerEnhancement: 'FORTIFY', // Shield forking piece
            enhancedValue: totalValue + 200
          });
        }
      }
    }
  }

  // Pattern 2: PIN - Long-range piece attacks through one piece to more valuable target
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece || piece.color !== forColor || piece.isSpectral) continue;
      if (![PIECE.ROOK, PIECE.BISHOP, PIECE.QUEEN].includes(piece.type)) continue;

      const directions = piece.type === PIECE.ROOK ?
        [[1,0],[-1,0],[0,1],[0,-1]] :
        piece.type === PIECE.BISHOP ?
        [[1,1],[1,-1],[-1,1],[-1,-1]] :
        [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

      for (const [dr, dc] of directions) {
        let pinnedPiece = null;
        let behindPiece = null;

        for (let i = 1; i < 8; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (!inBounds(nr, nc)) break;

          const target = state.board[nr][nc];
          if (!target) continue;

          if (!pinnedPiece) {
            if (target.color === opp) pinnedPiece = {r: nr, c: nc, piece: target};
          } else if (!behindPiece) {
            if (target.color === opp) {
              behindPiece = {r: nr, c: nc, piece: target};

              if (BOT_PIECE_VALUES[behindPiece.piece.type] >
                  BOT_PIECE_VALUES[pinnedPiece.piece.type] + 200) {
                patterns.push({
                  type: 'PIN',
                  attacker: {r, c},
                  pinned: pinnedPiece,
                  behind: behindPiece,
                  value: BOT_PIECE_VALUES[behindPiece.piece.type] - BOT_PIECE_VALUES[pinnedPiece.piece.type],
                  powerEnhancement: 'IMPRISON', // Imprison pinned piece
                  enhancedValue: BOT_PIECE_VALUES[behindPiece.piece.type] + 150
                });
              }
            }
            break;
          }
        }
      }
    }
  }

  // Pattern 3: OVERLOADED DEFENDER - One piece defends multiple targets
  const oppPieces = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.color === opp && !p.isSpectral) {
        oppPieces.push({r, c, piece: p});
      }
    }
  }

  for (const defender of oppPieces) {
    const defMoves = legalMoves(state.board, defender.r, defender.c, state);
    const defends = [];

    for (const dm of defMoves) {
      const target = state.board[dm.r][dm.c];
      if (target && target.color === opp && BOT_PIECE_VALUES[target.type] >= 300) {
        // Check if target is attacked by us
        let attackedByUs = false;
        for (let ar = 0; ar < 8; ar++) {
          for (let ac = 0; ac < 8; ac++) {
            const attacker = state.board[ar][ac];
            if (!attacker || attacker.color !== forColor) continue;
            const attacks = legalMoves(state.board, ar, ac, state);
            if (attacks.some(a => a.r === dm.r && a.c === dm.c)) {
              attackedByUs = true;
              break;
            }
          }
          if (attackedByUs) break;
        }

        if (attackedByUs) {
          defends.push({r: dm.r, c: dm.c, piece: target});
        }
      }
    }

    if (defends.length >= 2) {
      const totalValue = defends.reduce((sum, d) => sum + BOT_PIECE_VALUES[d.piece.type], 0);
      patterns.push({
        type: 'OVERLOADED_DEFENDER',
        defender: defender,
        targets: defends,
        value: totalValue * 0.5, // Can only win one
        powerEnhancement: 'IMPRISON', // Remove the overloaded defender
        enhancedValue: totalValue // Can now win both!
      });
    }
  }

  return patterns;
}

// ===== LAYER 7: THREAT EVALUATION ENGINE =====
// Multi-move threat calculation - what can opponent do?
function botEvaluateThreats(state, forColor) {
  const opp = opposite(forColor);
  const oppAether = state.mana[opp];
  const threats = [];

  // Threat 1: Vengeance on our high-value pieces
  if (oppAether >= POWER_COSTS[POWER.VENGEANCE]) {
    // Find our Queen
    let ourQueen = null;
    for (let r = 0; r < 8 && !ourQueen; r++) {
      for (let c = 0; c < 8 && !ourQueen; c++) {
        const p = state.board[r][c];
        if (p && p.color === forColor && p.type === PIECE.QUEEN) {
          ourQueen = {r, c};
        }
      }
    }
    if (ourQueen) {
      const threat = {
        type: 'VENGEANCE_THREAT',
        target: ourQueen,
        probability: oppAether >= 20 ? 0.9 : oppAether >= 18 ? 0.7 : 0.4,
        impact: -900,
        urgency: 'HIGH',
        counter: 'MOVE_QUEEN_DEFENSIVELY'
      };
      threats.push(threat);
    }

    // Also check for Rook threats
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (p && p.color === forColor && p.type === PIECE.ROOK) {
          threats.push({
            type: 'VENGEANCE_THREAT',
            target: {r, c},
            probability: oppAether >= 20 ? 0.6 : 0.3,
            impact: -500,
            urgency: 'MEDIUM',
            counter: 'ACTIVATE_ROOK'
          });
        }
      }
    }
  }

  // Threat 2: Double Attack fork potential
  if (oppAether >= POWER_COSTS[POWER.DOUBLE_ATTACK]) {
    const oppPieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (p && p.color === opp && !p.isSpectral && !p.imprisoned) {
          oppPieces.push({r, c, piece: p});
        }
      }
    }

    for (const oppPiece of oppPieces) {
      const moves = legalMoves(state.board, oppPiece.r, oppPiece.c, state);
      for (const move of moves) {
        if (!move.capture) continue;

        const target1 = state.board[move.r][move.c];
        if (!target1 || target1.color !== forColor) continue;

        // Simulate opponent capturing
        const snap = snapshot(state.board);
        state.board[move.r][move.c] = oppPiece.piece;
        state.board[oppPiece.r][oppPiece.c] = null;

        const secondCaptures = legalMoves(state.board, move.r, move.c, state)
          .filter(m => m.capture && m.r !== move.r && m.c !== move.c);

        restore(state.board, snap);

        if (secondCaptures.length > 0) {
          const totalValue = BOT_PIECE_VALUES[target1.type] +
                           BOT_PIECE_VALUES[state.board[secondCaptures[0].r][secondCaptures[0].c].type];

          if (totalValue >= 400) {
            threats.push({
              type: 'DOUBLE_ATTACK_THREAT',
              probability: oppAether >= 16 ? 0.7 : 0.4,
              impact: -totalValue,
              urgency: 'HIGH',
              counter: 'SEPARATE_TARGETS'
            });
          }
        }
      }
    }
  }

  // Threat 3: Imprison + Capture combo
  if (oppAether >= POWER_COSTS[POWER.IMPRISON]) {
    // Check if any of our pieces are defending high-value pieces
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const defender = state.board[r][c];
        if (!defender || defender.color !== forColor) continue;

        const defMoves = legalMoves(state.board, r, c, state);
        for (const dm of defMoves) {
          const protected = state.board[dm.r][dm.c];
          if (!protected || protected.color !== forColor) continue;
          if (BOT_PIECE_VALUES[protected.type] < 500) continue; // Only care about Queen+

          // Check if opponent attacks protected piece
          let oppAttacksProtected = false;
          for (let or = 0; or < 8; or++) {
            for (let oc = 0; oc < 8; oc++) {
              const opp = state.board[or][oc];
              if (!opp || opp.color === forColor) continue;
              const oppMoves = legalMoves(state.board, or, oc, state);
              if (oppMoves.some(m => m.r === dm.r && m.c === dm.c)) {
                oppAttacksProtected = true;
                break;
              }
            }
            if (oppAttacksProtected) break;
          }

          if (oppAttacksProtected) {
            threats.push({
              type: 'IMPRISON_THREAT',
              defender: {r, c},
              protected: {r: dm.r, c: dm.c, piece: protected},
              probability: 0.5,
              impact: -BOT_PIECE_VALUES[protected.type],
              urgency: 'MEDIUM',
              counter: 'ADD_SECOND_DEFENDER'
            });
          }
        }
      }
    }
  }

  // Sort by expected impact
  return threats.sort((a, b) =>
    (b.probability * Math.abs(b.impact)) - (a.probability * Math.abs(a.impact))
  );
}

// ===== LAYER 8: MULTI-MOVE COMBO GENERATOR =====
// Generate 2-3 move power sequences for maximum effectiveness
function botGeneratePowerSequences(state, forColor, horizon = 2) {
  const sequences = [];
  const aether = state.mana[forColor];
  const opp = opposite(forColor);

  // Sequence 1: FORTIFY → CAPTURE → PROMOTE
  // Shield a piece, use it to win material, then promote
  if (aether >= 14 + 15) { // Fortify + Promote
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = state.board[r][c];
        if (!piece || piece.color !== forColor || piece.shieldHP > 0) continue;

        // Check if piece can capture something valuable
        const moves = legalMoves(state.board, r, c, state);
        const goodCaptures = moves.filter(m => {
          const target = state.board[m.r][m.c];
          return target && target.color === opp &&
                 BOT_PIECE_VALUES[target.type] >= BOT_PIECE_VALUES[piece.type] - 100;
        });

        if (goodCaptures.length > 0) {
          // After capture, check if we have promotable pawn
          const ourPawns = [];
          for (let pr = 0; pr < 8; pr++) {
            for (let pc = 0; pc < 8; pc++) {
              const p = state.board[pr][pc];
              if (p && p.color === forColor && p.type === PIECE.PAWN) {
                const rank = forColor === 'white' ? pr : 7 - pr;
                if (rank >= 5) { // 6th or 7th rank
                  ourPawns.push({r: pr, c: pc});
                }
              }
            }
          }

          if (ourPawns.length > 0) {
            const captureValue = BOT_PIECE_VALUES[state.board[goodCaptures[0].r][goodCaptures[0].c].type];
            sequences.push({
              type: 'FORTIFY_CAPTURE_PROMOTE',
              moves: [
                { power: 'FORTIFY', target: {r, c} },
                { action: 'CAPTURE', from: {r, c}, to: goodCaptures[0] },
                { power: 'PROMOTE', target: ourPawns[0] }
              ],
              value: captureValue + 500, // Net material gain
              aetherCost: 14 + 15,
              priority: 400
            });
          }
        }
      }
    }
  }

  // Sequence 2: IMPRISON → CAPTURE_HIGH_VALUE
  // Already handled in combo detection, but add here for completeness

  // Sequence 3: FROST → REPOSITION → ATTACK
  // Freeze opponent's threats, reposition safely, then attack
  if (aether >= POWER_COSTS[POWER.FROST]) {
    const oppThreats = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const oppPiece = state.board[r][c];
        if (!oppPiece || oppPiece.color === forColor) continue;
        if (oppPiece.frozenUntil && oppPiece.frozenUntil > state.turnNumber) continue;

        const oppMoves = legalMoves(state.board, r, c, state);
        const attacksUs = oppMoves.filter(m => {
          const target = state.board[m.r][m.c];
          return target && target.color === forColor &&
                 BOT_PIECE_VALUES[target.type] >= 300;
        });

        if (attacksUs.length > 0) {
          oppThreats.push({r, c, piece: oppPiece, threatens: attacksUs});
        }
      }
    }

    if (oppThreats.length > 0) {
      sequences.push({
        type: 'FROST_REPOSITION_ATTACK',
        moves: [
          { power: 'FROST', target: oppThreats[0] }
        ],
        value: 200, // Defensive value
        aetherCost: POWER_COSTS[POWER.FROST],
        priority: 250
      });
    }
  }

  return sequences.sort((a, b) => b.priority - a.priority);
}

// ===== LAYER 4: ANTI-VENGEANCE-HOARDING =====
function botDynamicPowerSelection(state, forColor) {
  const aether = state.mana[forColor];
  const opp = opposite(forColor);
  const materialAdvantage = botCountMaterial(state, forColor) - botCountMaterial(state, opp);

  // OFFENSIVE PRIORITY (ahead in material, push advantage)
  if (materialAdvantage > 300 && aether >= 14) {
    // We're winning - use aether aggressively
    return { recommendedPowers: ['DOUBLE_ATTACK', 'IMPRISON', 'FORTIFY'], threshold: 14 };
  }

  // DEFENSIVE PRIORITY (behind in material, stabilize)
  if (materialAdvantage < -200) {
    // We're losing - focus on survival and counter-play
    if (aether >= 18) return { recommendedPowers: ['VENGEANCE'], threshold: 18 };
    if (aether >= 16) return { recommendedPowers: ['AETHER_BLOCK'], threshold: 16 };
    if (aether >= 14) return { recommendedPowers: ['FORTIFY', 'CLEANSE'], threshold: 14 };
  }

  // TACTICAL PRIORITY (even game, look for tactical shots)
  if (Math.abs(materialAdvantage) <= 200 && aether >= 14) {
    return { recommendedPowers: ['DOUBLE_ATTACK', 'IMPRISON'], threshold: 14 };
  }

  // DEFAULT: Don't hoard - spend at 20+ aether
  if (aether >= 25) {
    return { recommendedPowers: ['ANY'], threshold: 14, urgent: true };
  }

  return { recommendedPowers: [], threshold: 0, urgent: false };
}

// ---------- Power Decision ----------
// Returns an action object { type: 'power', exec: fn } or null
function botConsiderPowers(state, forColor) {
  if (state.aetherBlocked[forColor]) return null;
  const aether = state.mana[forColor];
  const opp = opposite(forColor);
  const phase = botGamePhase(state);
  const candidates = [];

  // ===== LAYER 4: ANTI-HOARDING CHECK =====
  const powerStrategy = botDynamicPowerSelection(state, forColor);

  // ===== LAYER 3: POWER COMBO DETECTION =====
  const combos = botEvaluatePowerCombos(state, forColor);
  if (combos.length > 0) {
    console.log(`[BOT] Found ${combos.length} combos:`, combos.map(c => c.type));
  }
  for (const combo of combos) {
    if (combo.type === 'DOUBLE_ATTACK' && combo.targets.length >= 2) {
      // High priority combo - can capture 2 pieces
      candidates.push({
        priority: combo.priority,
        exec: () => {
          const target1 = combo.targets[0];
          const target2 = combo.targets[1];
          return castDoubleAttack(state, combo.from.r, combo.from.c, target1.r, target1.c, target2.r, target2.c);
        },
        name: 'DOUBLE_ATTACK_COMBO',
        payload: { power: 'DOUBLE_ATTACK', from: combo.from, targets: combo.targets }
      });
    } else if (combo.type === 'DOUBLE_ATTACK_SHIELD' && combo.targets.length > 0) {
      // Break shield + capture same piece
      const target = combo.targets[0];
      candidates.push({
        priority: combo.priority,
        exec: () => castDoubleAttack(state, combo.from.r, combo.from.c, target.r, target.c, target.r, target.c),
        name: 'DOUBLE_ATTACK_SHIELD',
        payload: { power: 'DOUBLE_ATTACK', from: combo.from, target }
      });
    } else if (combo.type === 'SHIELD_ATTACK' && combo.attacks.length > 0) {
      // Shield piece then attack
      candidates.push({
        priority: combo.priority,
        exec: () => castFortify(state, combo.piece.r, combo.piece.c),
        name: 'SHIELD_ATTACK_COMBO',
        payload: { power: 'FORTIFY', piece: combo.piece }
      });
    }
    // Note: IMPRISON_ATTACK combo is more complex - let regular Imprison logic handle it
  }

  // ===== LAYER 6-8: ADVANCED TACTICAL INTELLIGENCE =====
  // Wrapped in try-catch to prevent errors from breaking bot
  let tacticalPatterns = [];
  let threats = [];
  let powerSequences = [];
  try {
    tacticalPatterns = botDetectTacticalPatterns(state, forColor);
    threats = botEvaluateThreats(state, forColor);
    powerSequences = botGeneratePowerSequences(state, forColor);
  } catch (e) {
    console.error('[bot] Error in tactical intelligence:', e);
    // Continue with empty arrays - bot will use basic power evaluation
  }

  // Analysis logging
  if (aether >= 14) {
    console.error(`[T${state.turnNumber}:${forColor[0]}] A=${aether} Pat=${tacticalPatterns.length} Thr=${threats.length}`);
  }

  // Add tactical pattern-based candidates (BOOSTED PRIORITIES)
  for (const pattern of tacticalPatterns) {
    if (pattern.type === 'FORK' && aether >= POWER_COSTS[POWER.FORTIFY]) {
      // Shield the forking piece for safe fork
      candidates.push({
        priority: pattern.enhancedValue * 1.5 + 300, // HUGE BOOST
        exec: () => castFortify(state, pattern.piece.r, pattern.piece.c),
        name: 'TACTICAL_FORK_SHIELD',
        payload: { power: 'FORTIFY', pattern: pattern }
      });
    } else if (pattern.type === 'PIN' && aether >= POWER_COSTS[POWER.IMPRISON]) {
      // Imprison the pinned piece to win the behind piece
      candidates.push({
        priority: pattern.enhancedValue * 1.5 + 300, // HUGE BOOST
        exec: () => castImprison(state, pattern.pinned.r, pattern.pinned.c),
        name: 'TACTICAL_PIN_IMPRISON',
        payload: { power: 'IMPRISON', pattern: pattern }
      });
    } else if (pattern.type === 'OVERLOADED_DEFENDER' && aether >= POWER_COSTS[POWER.IMPRISON]) {
      // Remove overloaded defender to win multiple pieces
      candidates.push({
        priority: pattern.enhancedValue * 2.0 + 500, // MASSIVE BOOST
        exec: () => castImprison(state, pattern.defender.r, pattern.defender.c),
        name: 'TACTICAL_OVERLOAD_IMPRISON',
        payload: { power: 'IMPRISON', pattern: pattern }
      });
    }
  }

  // Add power sequence-based candidates
  for (const sequence of powerSequences) {
    if (sequence.type === 'FORTIFY_CAPTURE_PROMOTE' && aether >= sequence.aetherCost) {
      // Multi-move tactical sequence
      candidates.push({
        priority: sequence.priority * 1.2, // Boost multi-move tactics
        exec: () => castFortify(state, sequence.moves[0].target.r, sequence.moves[0].target.c),
        name: 'TACTICAL_SEQUENCE_START',
        payload: { power: 'FORTIFY', sequence: sequence }
      });
    } else if (sequence.type === 'FROST_REPOSITION_ATTACK' && aether >= sequence.aetherCost) {
      candidates.push({
        priority: sequence.priority,
        exec: () => castFrost(state, sequence.moves[0].target.r, sequence.moves[0].target.c),
        name: 'TACTICAL_FROST_DEFENSE',
        payload: { power: 'FROST', sequence: sequence }
      });
    }
  }

  // Respond to critical threats
  const criticalThreat = threats.find(t => t.urgency === 'HIGH' && t.probability > 0.7);
  if (criticalThreat) {
    console.log(`[BOT INTELLIGENCE] Critical threat detected: ${criticalThreat.type}`);

    if (criticalThreat.type === 'VENGEANCE_THREAT' && aether >= POWER_COSTS[POWER.BLINK]) {
      // Blink Queen/Rook to safety
      const target = criticalThreat.target;
      const piece = state.board[target.r][target.c];
      if (piece) {
        const safeMoves = legalMoves(state.board, target.r, target.c, state).filter(m => {
          // Check if destination is safe
          const snap = snapshot(state.board);
          state.board[m.r][m.c] = piece;
          state.board[target.r][target.c] = null;
          const safe = !isSquareAttacked(state.board, m.r, m.c, opp);
          restore(state.board, snap);
          return safe;
        });

        if (safeMoves.length > 0) {
          candidates.push({
            priority: 600, // Very high priority - save Queen!
            exec: () => castBlink(state, target.r, target.c, safeMoves[0].r, safeMoves[0].c),
            name: 'THREAT_RESPONSE_BLINK',
            payload: { power: 'BLINK', threat: criticalThreat }
          });
        }
      }
    }
  }

  // If hoarding past 25 aether, boost ALL power priorities to force spending
  const hoardingMultiplier = (powerStrategy.urgent && aether >= 25) ? 1.5 : 1.0;

  // VENGEANCE: Destroy the most valuable enemy piece — TOP PRIORITY
  // This is the most impactful power for gaining/converting advantage.
  if (aether >= POWER_COSTS[POWER.VENGEANCE]) {
    let bestTarget = null, bestVal = 0;
    const oppKing = findKing(state.board, opp);
    const myMat = botCountMaterial(state, forColor);
    const oppMat = botCountMaterial(state, opp);
    const materialBalance = myMat - oppMat;

    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color === forColor || p.type === PIECE.KING) continue;
      if (p.isSpectral) continue;
      let val = BOT_PIECE_VALUES[p.type];

      // OPTIMIZED: If target is attacking our king, add huge bonus
      const myKing = findKing(state.board, forColor);
      if (myKing) {
        const attacks = typeof getAttackSquares === 'function' ? getAttackSquares(state.board, r, c) : [];
        if (attacks.some(a => a.r === myKing.r && a.c === myKing.c)) {
          val += 150; // Destroy attacker threatening our king
        }
      }

      // OPTIMIZED: If target is only defender of enemy king (mating attack)
      if (oppKing && Math.max(Math.abs(r - oppKing.r), Math.abs(c - oppKing.c)) <= 2) {
        // Check if this is the only defender
        let defenderCount = 0;
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
          const nr = oppKing.r + dr, nc = oppKing.c + dc;
          if (!inBounds(nr, nc)) continue;
          const def = state.board[nr][nc];
          if (def && def.color === opp && def.type !== PIECE.KING && !def.isSpectral) defenderCount++;
        }
        if (defenderCount <= 2) {
          val += 200; // Only defender - mating attack enabled
        } else {
          val += 80; // Multiple defenders, still valuable
        }
      }

      // Extra value if piece is a captor holding our piece
      if (p.imprisoned && p.imprisoned.color === forColor) {
        val += BOT_PIECE_VALUES[p.imprisoned.type] * 0.7;
      }

      // FIX 5: HUGE VALUE for destroying ENEMY pawns on 7th rank with Vengeance
      if (p.type === PIECE.PAWN) {
        const distToPromo = p.color === COLOR.WHITE ? r : (7 - r);
        if (distToPromo === 1) {
          val += 750; // Critical - destroy pawn about to promote!
        }
      }

      if (val > bestVal) { bestVal = val; bestTarget = { r, c }; }
    }
    // In endgame, use on ANY piece to strip defenses. In middlegame, target high-value.
    const threshold = phase < 0.5 ? 100 : 300;
    if (bestTarget && bestVal >= threshold) {
      // OPTIMIZED: Scale by game phase and material balance
      let prio;
      if (materialBalance > 300) {
        // We're ahead: lower priority (0.2), save aether UNLESS hoarding
        prio = bestVal * 0.20;
      } else if (materialBalance < -200) {
        // We're behind: higher priority (0.4), desperate for material
        prio = bestVal * 0.40;
      } else {
        // Balanced: medium priority
        prio = bestVal * (phase < 0.5 ? 0.32 : 0.27);
      }

      // LAYER 4: Apply anti-hoarding multiplier
      prio *= hoardingMultiplier;

      candidates.push({
        priority: prio,
        exec: () => castVengeance(state, bestTarget.r, bestTarget.c),
        name: 'VENGEANCE',
        payload: { power: 'VENGEANCE', r: bestTarget.r, c: bestTarget.c }
      });
    }
  }

  // PROMOTE: If we have a pawn, promote it — very high priority
  // But DON'T promote if opponent has enough aether for Vengeance (they'll just destroy it)
  const oppCanVengeance = state.mana[opp] >= POWER_COSTS[POWER.VENGEANCE] && !state.aetherBlocked[opp];
  if (aether >= POWER_COSTS[POWER.PROMOTE] && !oppCanVengeance) {
    let bestPawn = null, bestDist = 99, bestSafe = false, bestTacticalBonus = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.color === forColor && p.type === PIECE.PAWN && !p.isSpectral) {
        const distToPromo = forColor === COLOR.WHITE ? r : (7 - r);
        const attacked = isSquareAttacked(state.board, r, c, opp);
        const defended = isSquareAttacked(state.board, r, c, forColor);
        const safe = !attacked || defended;

        // OPTIMIZED: Check tactical value of promoting this pawn
        let tacticalBonus = 0;

        // Simulate promotion to check if it gives checkmate
        const snap = snapshot(state.board);
        state.board[r][c] = makePiece(PIECE.QUEEN, forColor);
        const givesCheck = isInCheck(state.board, opp);
        let givesMate = false;
        if (givesCheck) {
          const oppMoves = allLegalMoves(state.board, opp, state);
          if (oppMoves.length === 0) {
            givesMate = true;
            tacticalBonus += 100; // Promotion gives checkmate!
          } else {
            tacticalBonus += 80; // Promotion gives check
          }
        }

        // Check if promoted queen controls critical squares near enemy king
        if (!givesMate) {
          const oppKing = findKing(state.board, opp);
          if (oppKing) {
            const queenAttacks = typeof getAttackSquares === 'function' ? getAttackSquares(state.board, r, c) : [];
            let criticalSquares = 0;
            for (const att of queenAttacks) {
              const dist = Math.max(Math.abs(att.r - oppKing.r), Math.abs(att.c - oppKing.c));
              if (dist <= 2) criticalSquares++;
            }
            if (criticalSquares >= 4) tacticalBonus += 60; // Controls many squares near king
          }
        }
        restore(state.board, snap);

        // Check if opponent can immediately capture promoted piece (reduce priority)
        let canCapture = false;
        if (attacked && !defended) {
          canCapture = true;
          tacticalBonus -= 50; // Opponent can capture
        }

        if (safe && (!bestSafe || distToPromo < bestDist || (distToPromo === bestDist && tacticalBonus > bestTacticalBonus))) {
          bestDist = distToPromo; bestPawn = { r, c }; bestSafe = true; bestTacticalBonus = tacticalBonus;
        } else if (!bestSafe && (distToPromo < bestDist || (distToPromo === bestDist && tacticalBonus > bestTacticalBonus))) {
          bestDist = distToPromo; bestPawn = { r, c }; bestTacticalBonus = tacticalBonus;
        }
      }
    }
    if (bestPawn) {
      const basePrio = 80 + (7 - bestDist) * 15 + bestTacticalBonus;
      let prio = phase < 0.5 ? basePrio * 1.5 : basePrio;
      if (!bestSafe) prio *= 0.4;
      candidates.push({
        priority: prio,
        exec: () => castPromote(state, bestPawn.r, bestPawn.c, PIECE.QUEEN),
        name: 'PROMOTE',
        payload: { power: 'PROMOTE', r: bestPawn.r, c: bestPawn.c, newType: PIECE.QUEEN }
      });
    }
  }

  // IMPRISON: Capture an adjacent high-value enemy piece — very strong, removes piece from play
  if (aether >= POWER_COSTS[POWER.IMPRISON] && !isInCheck(state.board, forColor)) {
    let bestImprison = null, bestImpVal = 0;
    const myMat = botCountMaterial(state, forColor);
    const oppMat = botCountMaterial(state, opp);
    const materialBalance = myMat - oppMat;

    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const captor = state.board[r][c];
      if (!captor || captor.color !== forColor || captor.type === PIECE.KING) continue;
      if (captor.isSpectral || captor.imprisoned) continue;
      if (captor.frozenUntil && captor.frozenUntil > state.turnNumber) continue;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const captive = state.board[nr][nc];
        if (!captive || captive.color === forColor || captive.type === PIECE.KING) continue;
        if (captive.isSpectral || captive.imprisoned) continue;
        if (captive.frozenUntil && captive.frozenUntil > state.turnNumber) continue;
        if (captive.shieldHP > 0) continue;
        let val = BOT_PIECE_VALUES[captive.type];

        // OPTIMIZED: Check if imprisoning enables winning capture next move
        const snap = snapshot(state.board);
        state.board[nr][nc] = null; // Simulate removal
        let enablesCapture = 0;
        for (let mr = 0; mr < 8; mr++) for (let mc = 0; mc < 8; mc++) {
          const myP = state.board[mr][mc];
          if (!myP || myP.color !== forColor || myP.isSpectral) continue;
          if (myP.imprisoned || (myP.frozenUntil && myP.frozenUntil > state.turnNumber)) continue;
          const mvs = legalMoves(state.board, mr, mc, state);
          for (const mv of mvs) {
            const t = state.board[mv.r][mv.c];
            if (t && t.color === opp && t.type !== PIECE.KING && BOT_PIECE_VALUES[t.type] > val) {
              enablesCapture = Math.max(enablesCapture, BOT_PIECE_VALUES[t.type]);
            }
          }
        }
        restore(state.board, snap);
        if (enablesCapture > 0) val += 100; // Imprisoning defender allows winning capture

        // OPTIMIZED: Check if imprisoning only defender of enemy king
        const oppKing = findKing(state.board, opp);
        if (oppKing && Math.max(Math.abs(nr - oppKing.r), Math.abs(nc - oppKing.c)) <= 2) {
          let defenderCount = 0;
          for (let dr2 = -2; dr2 <= 2; dr2++) for (let dc2 = -2; dc2 <= 2; dc2++) {
            const nr2 = oppKing.r + dr2, nc2 = oppKing.c + dc2;
            if (!inBounds(nr2, nc2)) continue;
            const def = state.board[nr2][nc2];
            if (def && def.color === opp && def.type !== PIECE.KING && !def.isSpectral) defenderCount++;
          }
          if (defenderCount <= 2) val += 80; // Only defender of enemy king
        }

        // OPTIMIZED: If target is attacking our king
        const myKing = findKing(state.board, forColor);
        if (myKing) {
          const attacks = typeof getAttackSquares === 'function' ? getAttackSquares(state.board, nr, nc) : [];
          if (attacks.some(a => a.r === myKing.r && a.c === myKing.c)) {
            val += 40; // Target attacking our king
          }
        }

        // Imprison is especially good on pieces that are hard to capture normally
        if (isSquareAttacked(state.board, nr, nc, opp)) val += 50;
        if (val > bestImpVal) {
          bestImpVal = val;
          bestImprison = { captorR: r, captorC: c, captiveR: nr, captiveC: nc };
        }
      }
    }
    // EXTREMELY AGGRESSIVE: Use even for minor pieces (150+)
    // Massive priority boost to make bot actually use this power!

    if (aether >= 14) {
      console.error(`  IMP check: val=${bestImpVal||0} found=${bestImprison?'Y':'N'}`);
    }

    if (bestImprison && bestImpVal >= 150) {
      // HUGE priority boost - make this competitive with Promote/Vengeance
      let prio = bestImpVal * 0.60 + 250; // MASSIVE boost + high base priority
      if (materialBalance > 500) {
        prio *= 0.95; // Almost no scaling down
      }

      console.error(`  ✓✓ IMP CANDIDATE prio=${prio.toFixed(0)}`);

      candidates.push({
        priority: prio,
        exec: () => castImprison(state, bestImprison.captorR, bestImprison.captorC, bestImprison.captiveR, bestImprison.captiveC),
        name: 'IMPRISON',
        payload: { power: 'IMPRISON', captor: { r: bestImprison.captorR, c: bestImprison.captorC }, captive: { r: bestImprison.captiveR, c: bestImprison.captiveC } }
      });
    }
  }

  // CLEANSE: Free our imprisoned pieces, or kill an imprisoner by targeting their captor.
  // Also useful to unfreeze our own key pieces.
  if (aether >= POWER_COSTS[POWER.CLEANSE] && !isInCheck(state.board, forColor)) {
    let bestCleanse = null, bestCleanseVal = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.type === PIECE.KING) continue;
      let cleanseVal = 0;

      // OPTIMIZED: Remove shield from opponent's queen (makes it vulnerable)
      if (p.color === opp && p.type === PIECE.QUEEN && p.shieldHP > 0) {
        cleanseVal = 150; // Removing shield from queen
      }

      // Case 1: Enemy piece is holding OUR piece captive → free it
      if (p.color === opp && p.imprisoned && p.imprisoned.color === forColor) {
        cleanseVal = Math.max(cleanseVal, BOT_PIECE_VALUES[p.imprisoned.type] * 0.8);
        // OPTIMIZED: Freeing our queen is critical
        if (p.imprisoned.type === PIECE.QUEEN) cleanseVal += 100;
      }

      // OPTIMIZED: Cleanse imprisoner to free our piece (attack the captor)
      if (p.color === opp && p.imprisoned && p.imprisoned.color === forColor) {
        const snap = snapshot(state.board);
        // Simulate cleanse
        const freedPiece = p.imprisoned;
        p.imprisoned = null;
        // Check if freed piece can now do something valuable
        if (freedPiece) {
          const freedMoves = legalMoves(state.board, r, c, state);
          for (const mv of freedMoves) {
            const t = state.board[mv.r][mv.c];
            if (t && t.color === opp && t.type !== PIECE.KING) {
              cleanseVal += BOT_PIECE_VALUES[t.type] * 0.3; // Can capture after being freed
            }
          }
        }
        restore(state.board, snap);
      }

      // Case 2: Our own piece is frozen → unfreeze it
      if (p.color === forColor && p.frozenUntil && p.frozenUntil > state.turnNumber) {
        cleanseVal = Math.max(cleanseVal, BOT_PIECE_VALUES[p.type] * 0.5);

        // OPTIMIZED: Check if unfrozen piece delivers checkmate
        const snap = snapshot(state.board);
        p.frozenUntil = 0; // Simulate unfreeze
        const mvs = legalMoves(state.board, r, c, state);
        for (const mv of mvs) {
          const captured = state.board[mv.r][mv.c];
          state.board[mv.r][mv.c] = p;
          state.board[r][c] = null;
          if (isInCheck(state.board, opp)) {
            const oppMoves = allLegalMoves(state.board, opp, state);
            if (oppMoves.length === 0) {
              cleanseVal += 80; // Unfreezing delivers checkmate!
              restore(state.board, snap);
              break;
            }
          }
          restore(state.board, snap);
          p.frozenUntil = state.turnNumber + 3;
        }
        restore(state.board, snap);

        // ENDGAME: Huge bonus for unfreezing passed pawn about to promote
        if (phase < 0.5 && p.type === PIECE.PAWN) {
          const distToPromo = forColor === COLOR.WHITE ? r : (7 - r);
          if (distToPromo <= 2) {
            cleanseVal += 180; // Unfreezing passed pawn on 6th/7th rank is critical
          }
        }
      }

      // Case 3: Our own piece is holding an enemy piece (maybe we want to release for tactical reasons)
      // — generally don't do this unless the captor is in danger
      if (cleanseVal > bestCleanseVal) {
        bestCleanseVal = cleanseVal;
        bestCleanse = { r, c };
      }
    }
    if (bestCleanse && bestCleanseVal >= 150) {
      candidates.push({
        priority: bestCleanseVal * 0.20,
        exec: () => castCleanse(state, bestCleanse.r, bestCleanse.c),
        name: 'CLEANSE',
        payload: { power: 'CLEANSE', r: bestCleanse.r, c: bestCleanse.c }
      });
    }
  }

  // FROST: Freeze opponent's most threatening piece (value + proximity to our king)
  if (aether >= POWER_COSTS[POWER.FROST] && !isInCheck(state.board, forColor)) {
    const myKing = findKing(state.board, forColor);
    const oppKing = findKing(state.board, opp);
    let bestTarget = null, bestScore = 0;

    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color === forColor || p.type === PIECE.KING || p.isSpectral) continue;
      if (p.imprisoned) continue;
      if (p.frozenUntil && p.frozenUntil > state.turnNumber) continue;
      let frostScore = BOT_PIECE_VALUES[p.type];

      // OPTIMIZED: Check if freezing only defender of enemy king (mate threat)
      if (oppKing && Math.max(Math.abs(r - oppKing.r), Math.abs(c - oppKing.c)) <= 2) {
        let defenderCount = 0;
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
          const nr = oppKing.r + dr, nc = oppKing.c + dc;
          if (!inBounds(nr, nc)) continue;
          const def = state.board[nr][nc];
          if (def && def.color === opp && def.type !== PIECE.KING && !def.isSpectral) {
            if (!(def.frozenUntil && def.frozenUntil > state.turnNumber)) defenderCount++;
          }
        }
        if (defenderCount <= 2) {
          frostScore += 200; // Only defender - freezing creates mate threat
        }
      }

      // OPTIMIZED: Check if freezing piece that threatens our king
      if (myKing) {
        const attacks = typeof getAttackSquares === 'function' ? getAttackSquares(state.board, r, c) : [];
        if (attacks.some(a => a.r === myKing.r && a.c === myKing.c)) {
          frostScore += 150; // Piece threatens our king
        }
        const distToMyKing = Math.max(Math.abs(r - myKing.r), Math.abs(c - myKing.c));
        if (distToMyKing <= 3) frostScore += (4 - distToMyKing) * 60;
      }

      // OPTIMIZED: Check if freezing piece guards critical square
      // A critical square is one near enemy king that we could use for attack
      if (oppKing) {
        const snap = snapshot(state.board);
        state.board[r][c] = null; // Simulate piece not defending
        let criticalSquareCount = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const nr = oppKing.r + dr, nc = oppKing.c + dc;
          if (!inBounds(nr, nc)) continue;
          if (!isSquareAttacked(state.board, nr, nc, opp) && isSquareAttacked(state.board, nr, nc, forColor)) {
            criticalSquareCount++;
          }
        }
        restore(state.board, snap);
        if (criticalSquareCount >= 2) frostScore += 100; // Guards critical squares
      }

      // Extra value if the piece is attacking one of our high-value pieces
      for (let mr = 0; mr < 8; mr++) for (let mc = 0; mc < 8; mc++) {
        const myP = state.board[mr][mc];
        if (myP && myP.color === forColor && BOT_PIECE_VALUES[myP.type] >= 500) {
          if (isSquareAttacked(state.board, mr, mc, opp)) {
            frostScore += 80;
            break;
          }
        }
      }

      // ENDGAME: Extra value for freezing piece blocking passed pawn promotion
      if (phase < 0.5) {
        const dir = forColor === COLOR.WHITE ? -1 : 1;
        const checkRank = r + dir;
        if (checkRank >= 0 && checkRank < 8) {
          const behind = state.board[checkRank][c];
          if (behind && behind.type === PIECE.PAWN && behind.color === forColor && !behind.isSpectral) {
            const distToPromo = forColor === COLOR.WHITE ? checkRank : (7 - checkRank);
            if (distToPromo <= 2) {
              frostScore += 140; // Freeze blocker of passed pawn on 6th/7th rank
            }
          }
        }
      }

      // FIX 4: HUGE PRIORITY for freezing ENEMY pawns on 7th rank
      if (p.type === PIECE.PAWN) {
        const distToPromo = p.color === COLOR.WHITE ? r : (7 - r);
        if (distToPromo === 1) {
          frostScore += 700; // Emergency - enemy pawn about to promote!
        }
      }

      if (frostScore > bestScore) { bestScore = frostScore; bestTarget = { r, c }; }
    }
    const threshold = phase < 0.5 ? 200 : 350;
    if (bestTarget && bestScore >= threshold) {
      // OPTIMIZED: Only use if we can capitalize next turn (check if we have attacking moves)
      let canCapitalize = false;
      const snap = snapshot(state.board);
      const target = state.board[bestTarget.r][bestTarget.c];
      if (target) target.frozenUntil = state.turnNumber + 3;
      const myMoves = allLegalMoves(state.board, forColor, state);
      for (const mv of myMoves) {
        const t = state.board[mv.to.r][mv.to.c];
        if ((t && t.color === opp && BOT_PIECE_VALUES[t.type] >= 300) ||
            (mv.to.r === bestTarget.r && mv.to.c === bestTarget.c)) {
          canCapitalize = true;
          break;
        }
      }
      restore(state.board, snap);

      if (canCapitalize || bestScore >= 400) { // High-value freezes don't need follow-up
        candidates.push({
          priority: bestScore * 0.06,
          exec: () => castFrost(state, bestTarget.r, bestTarget.c),
          name: 'FROST',
          payload: { power: 'FROST', r: bestTarget.r, c: bestTarget.c }
        });
      }
    }
  }

  // FORTIFY: Shield our most valuable unshielded piece that's under threat
  // Also: shield a piece that can deliver checkmate (survives recapture on mate square)
  if (aether >= POWER_COSTS[POWER.FORTIFY] && !isInCheck(state.board, forColor)) {
    let bestPiece = null, bestVal = 0, bestReason = null;

    // OPTIMIZED Strategy 1: Shield piece that delivers checkmate next turn
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
      if (p.imprisoned || p.shieldHP > 0) continue;
      if (p.frozenUntil && p.frozenUntil > state.turnNumber) continue;
      // Check if this piece has a move that delivers checkmate
      const mvs = legalMoves(state.board, r, c, state);
      for (const mv of mvs) {
        const snap = snapshot(state.board);
        state.board[mv.r][mv.c] = p;
        state.board[r][c] = null;
        const givesCheck = isInCheck(state.board, opp);
        let isMate = false;
        if (givesCheck) {
          const oppEscapes = allLegalMoves(state.board, opp, state);
          if (oppEscapes.length === 0) isMate = true;
        }
        restore(state.board, snap);
        if (isMate && isSquareAttacked(state.board, mv.r, mv.c, opp)) {
          // The mate square is attacked — fortify ensures our piece survives to deliver
          bestVal = 300;
          bestPiece = { r, c };
          bestReason = 'checkmate';
          break;
        }
      }
      if (bestVal >= 300 && bestReason === 'checkmate') break;
    }

    // OPTIMIZED Strategy 2: Shield queen about to capture enemy queen
    if (!bestPiece) {
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p || p.color !== forColor || p.type !== PIECE.QUEEN || p.isSpectral) continue;
        if (p.imprisoned || p.shieldHP > 0) continue;
        if (p.frozenUntil && p.frozenUntil > state.turnNumber) continue;
        const mvs = legalMoves(state.board, r, c, state);
        for (const mv of mvs) {
          const t = state.board[mv.r][mv.c];
          if (t && t.color === opp && t.type === PIECE.QUEEN) {
            // Can capture enemy queen, but is the square attacked?
            if (isSquareAttacked(state.board, mv.r, mv.c, opp)) {
              bestVal = 200;
              bestPiece = { r, c };
              bestReason = 'queen-trade';
              break;
            }
          }
        }
        if (bestVal >= 200 && bestReason === 'queen-trade') break;
      }
    }

    // OPTIMIZED Strategy 3: Shield piece on fountain square under attack
    if (!bestPiece) {
      for (const f of state.fountains) {
        const p = state.board[f.r][f.c];
        if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
        if (p.imprisoned || p.shieldHP > 0) continue;
        if (isSquareAttacked(state.board, f.r, f.c, opp)) {
          const val = 150 + BOT_PIECE_VALUES[p.type] * 0.5;
          if (val > bestVal) {
            bestVal = val;
            bestPiece = { r: f.r, c: f.c };
            bestReason = 'fountain';
          }
        }
      }
    }

    // Strategy 4: Endgame — shield passed pawn on 6th/7th rank (unstoppable if shielded)
    if (!bestPiece && phase < 0.5) {
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p || p.color !== forColor || p.type !== PIECE.PAWN || p.isSpectral) continue;
        if (p.imprisoned || p.shieldHP > 0) continue;
        const distToPromo = forColor === COLOR.WHITE ? r : (7 - r);
        if (distToPromo <= 2) {
          // Check if this is a passed pawn
          const dir = forColor === COLOR.WHITE ? -1 : 1;
          const promoRow = forColor === COLOR.WHITE ? 0 : 7;
          let passed = true;
          for (let scanR = r + dir; scanR !== promoRow + dir; scanR += dir) {
            if (scanR < 0 || scanR > 7) break;
            for (let dc = -1; dc <= 1; dc++) {
              const scanC = c + dc;
              if (scanC < 0 || scanC > 7) continue;
              const blocker = state.board[scanR][scanC];
              if (blocker && blocker.type === PIECE.PAWN && blocker.color !== forColor && !blocker.isSpectral) {
                passed = false;
                break;
              }
            }
            if (!passed) break;
          }
          if (passed) {
            const val = 160; // High value for shielded passed pawn
            if (val > bestVal) { bestVal = val; bestPiece = { r, c }; bestReason = 'passed-pawn'; }
          }
        }
      }
    }

    // Strategy 5: Standard — shield most valuable threatened piece
    if (!bestPiece) {
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
        if (p.imprisoned || p.shieldHP > 0) continue;
        if (isSquareAttacked(state.board, r, c, opp)) {
          const val = BOT_PIECE_VALUES[p.type];
          if (val > bestVal) { bestVal = val; bestPiece = { r, c }; bestReason = 'threatened'; }
        }
      }
    }

    // OPTIMIZED: Don't waste on pieces that aren't threatened (unless strategic reasons)
    if (bestPiece && bestVal >= 100) {
      // Only fortify if piece is actually threatened OR it's for checkmate/fountain/passed-pawn
      const piece = state.board[bestPiece.r][bestPiece.c];
      const threatened = isSquareAttacked(state.board, bestPiece.r, bestPiece.c, opp);
      const strategic = bestReason === 'checkmate' || bestReason === 'queen-trade' || bestReason === 'fountain' || bestReason === 'passed-pawn';

      if (threatened || strategic) {
        candidates.push({
          priority: bestVal * 0.25 + 150, // HUGE BOOST to make bot use Fortify more
          exec: () => castFortify(state, bestPiece.r, bestPiece.c),
          name: 'FORTIFY',
          payload: { power: 'FORTIFY', r: bestPiece.r, c: bestPiece.c }
        });
      }
    }
  }

  // BLINK: Multi-purpose teleport - escape, attack, checkmate delivery
  if (aether >= POWER_COSTS[POWER.BLINK]) {
    let bestBlink = null, bestBlinkScore = 0, bestReason = null;
    const oppKing = findKing(state.board, opp);

    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
      if (p.imprisoned || (p.frozenUntil && p.frozenUntil > state.turnNumber)) continue;
      const isAttacked = isSquareAttacked(state.board, r, c, opp);

      // Check if piece is in bomb blast radius
      let inBombRadius = false;
      let bombTurnsLeft = 999;
      for (const bomb of state.bombs || []) {
        if (bomb.owner === forColor) continue;
        const distFromBomb = Math.max(Math.abs(r - bomb.r), Math.abs(c - bomb.c));
        if (distFromBomb <= 1) {
          inBombRadius = true;
          bombTurnsLeft = Math.min(bombTurnsLeft, bomb.turnsLeft);
        }
      }

      // In endgame: also blink pieces into attacking positions (not just escape)
      // NOW also blink if in bomb radius (even if not attacked)
      if (!isAttacked && !inBombRadius && phase > 0.5) continue;
      const top = Math.max(0, Math.min(r - 1, 5));
      const left = Math.max(0, Math.min(c - 1, 5));
      for (let nr = top; nr < top + 3; nr++) for (let nc = left; nc < left + 3; nc++) {
        if (nr === r && nc === c) continue;
        if (state.board[nr][nc]) continue;

        // SAFETY CHECK: simulate the blink and verify landing square isn't en-prise
        const snap = snapshot(state.board);
        state.board[nr][nc] = p;
        state.board[r][c] = null;
        const attackedAfter = isSquareAttacked(state.board, nr, nc, opp);
        const defendedAfter = isSquareAttacked(state.board, nr, nc, forColor);

        // OPTIMIZED: Check if blinking to deliver checkmate
        let deliversMate = false;
        if (isInCheck(state.board, opp)) {
          const oppMoves = allLegalMoves(state.board, opp, state);
          if (oppMoves.length === 0) deliversMate = true;
        }

        restore(state.board, snap);
        const myValue = BOT_PIECE_VALUES[p.type] || 0;
        if (attackedAfter && (myValue >= 4 || !defendedAfter) && !deliversMate) continue;

        let blinkScore = 0;
        let reason = 'general';

        // OPTIMIZED: Blinking to deliver checkmate (highest priority)
        if (deliversMate) {
          blinkScore = 200;
          reason = 'checkmate';
        } else if (isAttacked) {
          blinkScore = myValue * 0.3; // escape value
          reason = 'escape';
        }

        // OPTIMIZED: Escape bomb blast radius with severity-based priority
        if (inBombRadius) {
          let destSafe = true;
          for (const bomb of state.bombs || []) {
            if (bomb.owner === forColor) continue;
            const distToBomb = Math.max(Math.abs(nr - bomb.r), Math.abs(nc - bomb.c));
            if (distToBomb <= 1) {
              destSafe = false;
              break;
            }
          }
          if (destSafe) {
            // OPTIMIZED: Scale by detonation timing
            let bombEscapeBonus = myValue * 0.4;
            if (myValue >= 500) bombEscapeBonus += 80;
            if (bombTurnsLeft <= 2) bombEscapeBonus += 150; // Detonates within 2 turns
            if (bombTurnsLeft <= 1) bombEscapeBonus += 100; // Extra urgency
            blinkScore = Math.max(blinkScore, bombEscapeBonus);
            if (reason === 'general') reason = 'bomb-escape';
          }
        }

        // OPTIMIZED: Blink to occupy fountain square
        if (state.fountains.some(f => f.r === nr && f.c === nc)) {
          blinkScore += 100;
          if (reason === 'general') reason = 'fountain';
        }

        // OPTIMIZED: Blink to fork enemy king and queen
        if (oppKing) {
          const snap2 = snapshot(state.board);
          state.board[nr][nc] = p;
          state.board[r][c] = null;
          const attacks = typeof getAttackSquares === 'function' ? getAttackSquares(state.board, nr, nc) : [];
          let forksKing = attacks.some(a => a.r === oppKing.r && a.c === oppKing.c);
          let forksQueen = false;
          for (const att of attacks) {
            const tgt = state.board[att.r][att.c];
            if (tgt && tgt.color === opp && tgt.type === PIECE.QUEEN) forksQueen = true;
          }
          restore(state.board, snap2);
          if (forksKing && forksQueen) {
            blinkScore += 80;
            if (reason === 'general') reason = 'fork';
          }
        }

        // In endgame: bonus for blinking closer to enemy king (only if safe)
        if (phase < 0.5 && !attackedAfter && oppKing) {
          const distBefore = botManhattan(r, c, oppKing.r, oppKing.c);
          const distAfter = botManhattan(nr, nc, oppKing.r, oppKing.c);
          if (distAfter < distBefore) blinkScore += (distBefore - distAfter) * 30;
        }
        if (blinkScore > bestBlinkScore) {
          bestBlinkScore = blinkScore;
          bestBlink = { fromR: r, fromC: c, toR: nr, toC: nc };
          bestReason = reason;
        }
      }
    }
    if (bestBlink && bestBlinkScore > 50) {
      candidates.push({
        priority: bestBlinkScore,
        exec: () => castBlink(state, bestBlink.fromR, bestBlink.fromC, bestBlink.toR, bestBlink.toC),
        name: 'BLINK',
        payload: { power: 'BLINK', from: { r: bestBlink.fromR, c: bestBlink.fromC }, to: { r: bestBlink.toR, c: bestBlink.toC } }
      });
    }
  }

  // WALL: Directional wall strategy - defense and attack
  if (aether >= POWER_COSTS[POWER.WALL]) {
    let bestWall = null, bestWallScore = 0, bestDirection = null;
    const myKing = findKing(state.board, forColor);
    const oppKing = findKing(state.board, opp);

    // Helper: score a wall cast with a given anchor and direction
    function scoreWallDirection(anchorR, anchorC, dir) {
      let score = 0;
      let emptyCount = 0;
      const promoRank = forColor === COLOR.WHITE ? 0 : 7;

      // Count empty squares in this direction
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = anchorR + dr, nc = anchorC + dc;
        if (!inBounds(nr, nc) || state.board[nr][nc] || nr === promoRank) continue;

        // Check if square is in the chosen direction
        let inDirection = false;
        if (dir === 'N' && nr < anchorR) inDirection = true;
        else if (dir === 'S' && nr > anchorR) inDirection = true;
        else if (dir === 'E' && nc > anchorC) inDirection = true;
        else if (dir === 'W' && nc < anchorC) inDirection = true;

        if (inDirection) {
          emptyCount++;

          // OPTIMIZED: Check if wall blocks enemy king's escape (mating net)
          if (oppKing) {
            const distToOppKing = Math.abs(nr - oppKing.r) + Math.abs(nc - oppKing.c);
            if (distToOppKing <= 2) {
              // Simulate wall and check if king has fewer escape squares
              const snap = snapshot(state.board);
              state.board[nr][nc] = makePiece(PIECE.PAWN, forColor);
              const escapesAfter = allLegalMoves(state.board, opp, state).filter(mv =>
                mv.from.r === oppKing.r && mv.from.c === oppKing.c
              );
              restore(state.board, snap);
              if (escapesAfter.length <= 2) score += 150; // Blocks king escape
            }
          }

          // OPTIMIZED: Wall controls center
          if (nr >= 3 && nr <= 4 && nc >= 3 && nc <= 4) {
            score += 100; // Central control
          }

          // Bonus for spawning toward enemy king (pressure)
          if (oppKing) {
            const distToOppKing = Math.abs(nr - oppKing.r) + Math.abs(nc - oppKing.c);
            if (distToOppKing <= 3) score += 15;
          }
          // Bonus for spawning toward promotion rank (offensive)
          if (phase < 0.6) {
            const distToPromo = Math.abs(nr - promoRank);
            score += (7 - distToPromo) * 3;
          }
        }
      }

      return { score: score + emptyCount * 10, count: emptyCount };
    }

    // OPTIMIZED Strategy 1: Wall protects our king in endgame
    if (myKing && phase < 0.5) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = myKing.r + dr, nc = myKing.c + dc;
        if (!inBounds(nr, nc)) continue;
        const p = state.board[nr][nc];
        if (p && p.color === forColor && p.type !== PIECE.KING && !p.isSpectral) {
          for (const dir of ['N', 'S', 'E', 'W']) {
            const result = scoreWallDirection(nr, nc, dir);
            if (result.count === 0) continue;
            const wallScore = 120 + result.score;
            if (wallScore > bestWallScore) {
              bestWallScore = wallScore;
              bestWall = { r: nr, c: nc };
              bestDirection = dir;
            }
          }
        }
      }
    }

    // Strategy 2: Wall near king when under pressure (not just in check)
    if (myKing && !bestWall) {
      // Count attackers near our king
      let nearbyThreats = 0;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p || p.color === forColor || p.isSpectral) continue;
        const dist = Math.max(Math.abs(r - myKing.r), Math.abs(c - myKing.c));
        if (dist <= 2 && p.type !== PIECE.PAWN) nearbyThreats++;
      }
      if (nearbyThreats >= 1 || isInCheck(state.board, forColor)) {
        // Find an anchor piece near king and best direction
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = myKing.r + dr, nc = myKing.c + dc;
          if (!inBounds(nr, nc)) continue;
          const p = state.board[nr][nc];
          if (p && p.color === forColor && p.type !== PIECE.KING && !p.isSpectral) {
            // Try all 4 directions, pick best
            for (const dir of ['N', 'S', 'E', 'W']) {
              const result = scoreWallDirection(nr, nc, dir);
              if (result.count === 0) continue;
              const wallScore = (isInCheck(state.board, forColor) ? 100 : 50) + nearbyThreats * 20 + result.score;
              if (wallScore > bestWallScore) {
                bestWallScore = wallScore;
                bestWall = { r: nr, c: nc };
                bestDirection = dir;
              }
            }
          }
        }
      }
    }

    // Strategy 3: Offensive wall — create pawn mass toward enemy territory
    if (phase < 0.6 && !bestWall) {
      const promoRank = forColor === COLOR.WHITE ? 0 : 7;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
        // Try all 4 directions, pick best
        for (const dir of ['N', 'S', 'E', 'W']) {
          const result = scoreWallDirection(r, c, dir);
          if (result.count === 0) continue;
          const distToPromo = Math.abs(r - promoRank);
          const wallScore = result.score + (7 - distToPromo) * 5 + (phase < 0.3 ? 30 : 0);
          if (wallScore > bestWallScore) {
            bestWallScore = wallScore;
            bestWall = { r, c };
            bestDirection = dir;
          }
        }
      }
    }

    if (bestWall && bestDirection && bestWallScore >= 40) {
      candidates.push({
        priority: bestWallScore * 0.7,
        exec: () => castWall(state, bestWall.r, bestWall.c, bestDirection),
        name: 'WALL',
        payload: { power: 'WALL', r: bestWall.r, c: bestWall.c, direction: bestDirection }
      });
    }
  }

  // DOUBLE ATTACK: Free material evaluation - two captures or capture + reposition
  const daEnabled = aether >= POWER_COSTS[POWER.DOUBLE_ATTACK] && !isInCheck(state.board, forColor);
  if (daEnabled) {
    let bestDA = null, bestDAScore = 0;
    let daOpportunities = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
      if (p.imprisoned || (p.frozenUntil && p.frozenUntil > state.turnNumber)) continue;
      const firstMoves = legalMoves(state.board, r, c, state);
      // Only consider first moves that are captures (Double Attack rule: first must capture)
      for (const m1 of firstMoves) {
        if (!m1.capture) continue;
        const target1 = state.board[m1.r][m1.c];
        if (!target1 || target1.type === PIECE.KING || target1.color === forColor) continue;
        if (target1.shieldHP > 0) continue; // skip shielded targets
        const captureVal = BOT_PIECE_VALUES[target1.type];
        // Simulate first move to find second moves
        const snap = snapshot(state.board);
        state.board[m1.r][m1.c] = p;
        state.board[r][c] = null;
        if (isInCheck(state.board, forColor)) { restore(state.board, snap); continue; }
        const secondMoves = legalMoves(state.board, m1.r, m1.c, state);
        let bestSecondVal = 0, bestSecondMove = null, secondReason = null;
        for (const m2 of secondMoves) {
          if (m2.r === m1.r && m2.c === m1.c) continue;
          const target2 = state.board[m2.r][m2.c];
          let secondVal = 0;

          // OPTIMIZED: Check if second capture wins enemy queen
          if (target2 && target2.color === opp && target2.type !== PIECE.KING && target2.shieldHP <= 0) {
            secondVal = BOT_PIECE_VALUES[target2.type];
            if (target2.type === PIECE.QUEEN) {
              secondVal += 150; // Second capture wins queen!
              secondReason = 'queen-capture';
            }

            // OPTIMIZED: Check if both captures are clean (undefended)
            const target1Defended = isSquareAttacked(state.board, r, c, opp);
            const target2Defended = isSquareAttacked(state.board, m2.r, m2.c, opp);
            if (!target1Defended && !target2Defended) {
              secondVal += 100; // Both captures are free material
              if (!secondReason) secondReason = 'clean-captures';
            }
          }

          // OPTIMIZED: Check if creates mating attack
          if (target2 || !target2) {
            const snap2 = snapshot(state.board);
            state.board[m2.r][m2.c] = p;
            state.board[m1.r][m1.c] = null;
            const givesCheck = isInCheck(state.board, opp);
            if (givesCheck) {
              const oppMoves = allLegalMoves(state.board, opp, state);
              if (oppMoves.length <= 2) {
                secondVal += 80; // Creates mating attack
                if (!secondReason) secondReason = 'mating-attack';
              }
            }
            restore(state.board, snap2);
          }

          // Also value safe retreat after capture
          if (!target2) {
            const safeAfter = !isSquareAttacked(state.board, m2.r, m2.c, opp);
            if (safeAfter) secondVal = Math.max(secondVal, 30);
          }
          if (secondVal > bestSecondVal) {
            bestSecondVal = secondVal;
            bestSecondMove = m2;
          }
        }
        restore(state.board, snap);
        if (bestSecondMove) {
          const totalVal = captureVal + bestSecondVal;
          daOpportunities++;
          if (totalVal > bestDAScore) {
            bestDAScore = totalVal;
            bestDA = { fromR: r, fromC: c, toR: m1.r, toC: m1.c, jumpR: bestSecondMove.r, jumpC: bestSecondMove.c };
          }
        }
      }
    }

    if (aether >= 14) {
      console.error(`  DA check: opps=${daOpportunities} score=${bestDAScore} found=${bestDA?'Y':'N'}`);
    }

    // Double attack - EXTREMELY AGGRESSIVE: use if ANY value
    // Lowered threshold to 100 (basically any capture) and MASSIVE priority boost
    if (bestDA && bestDAScore >= 100) { // Any capture worth using!
      const prio = bestDAScore * 0.40 + 250; // HUGE priority boost

      console.error(`  ✓✓ DA CANDIDATE prio=${prio.toFixed(0)}`);

      candidates.push({
        priority: prio,
        exec: () => castDoubleAttack(state, bestDA.fromR, bestDA.fromC, bestDA.toR, bestDA.toC, bestDA.jumpR, bestDA.jumpC),
        name: 'DOUBLE_ATTACK',
        payload: { power: 'DOUBLE_ATTACK', from: { r: bestDA.fromR, c: bestDA.fromC }, to: { r: bestDA.toR, c: bestDA.toC }, jump: { r: bestDA.jumpR, c: bestDA.jumpC } }
      });
    }
  }

  // SPAWN: Hard bot NEVER spawns (spectral pawns vanish next turn, waste of aether)
  // Only easy/medium might use it
  if (BOT.difficulty !== 'hard' && phase > 0.5 && aether >= POWER_COSTS[POWER.SPAWN] && !isInCheck(state.board, forColor)) {
    for (const f of state.fountains) {
      if (state.board[f.r][f.c]) continue;
      const rankFP = forColor === COLOR.WHITE ? (8 - f.r) : (f.r + 1);
      if (rankFP >= 1 && rankFP <= 4) {
        candidates.push({
          priority: 15,
          exec: () => castSpawn(state, f.r, f.c),
          name: 'SPAWN',
          payload: { power: 'SPAWN', r: f.r, c: f.c }
        });
        break;
      }
    }
  }

  // AETHER BLOCK: Predictive blocking - deny critical escape/counterplay powers
  if (aether >= POWER_COSTS[POWER.AETHER_BLOCK] && !state.aetherBlocked[opp] && !isInCheck(state.board, forColor)) {
    const oppAether = state.mana[opp];
    let blockPrio = 0;

    // OPTIMIZED Strategy 1: Block when opponent is 1 turn from mate and needs power to escape
    if (oppAether >= POWER_COSTS[POWER.BLINK]) {
      const myMoves = allLegalMoves(state.board, forColor, state);
      let hasMateOrNearMate = false;
      for (const mv of myMoves) {
        const snap = snapshot(state.board);
        const captured = state.board[mv.to.r][mv.to.c];
        state.board[mv.to.r][mv.to.c] = state.board[mv.from.r][mv.from.c];
        state.board[mv.from.r][mv.from.c] = null;
        if (isInCheck(state.board, opp)) {
          const oppMoves = allLegalMoves(state.board, opp, state);
          if (oppMoves.length === 0) {
            hasMateOrNearMate = true; // Checkmate threat!
          } else if (oppMoves.length <= 2) {
            hasMateOrNearMate = true; // Near-mate (very few escapes)
          }
        }
        restore(state.board, snap);
        if (hasMateOrNearMate) break;
      }
      if (hasMateOrNearMate) {
        blockPrio = 200; // TOP PRIORITY: block opponent's escape powers
      }
    }

    // OPTIMIZED Strategy 2: Block when we're about to destroy their queen and they have Chronobreak
    if (blockPrio === 0 && oppAether >= POWER_COSTS[POWER.CHRONOBREAK]) {
      const myMoves = allLegalMoves(state.board, forColor, state);
      for (const mv of myMoves) {
        const target = state.board[mv.to.r][mv.to.c];
        if (target && target.color === opp && target.type === PIECE.QUEEN) {
          blockPrio = 150; // Block chronobreak to secure queen capture
          break;
        }
      }
    }

    // OPTIMIZED Strategy 3: Block escape powers (Blink/Fortify) when we're attacking
    if (blockPrio === 0 && oppAether >= POWER_COSTS[POWER.FORTIFY]) {
      // Check if we're attacking high-value opponent pieces
      let attackingHighValue = false;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p || p.color !== opp || p.type === PIECE.KING) continue;
        if (BOT_PIECE_VALUES[p.type] >= 500) { // Queen or Rook
          if (isSquareAttacked(state.board, r, c, forColor)) {
            attackingHighValue = true;
            break;
          }
        }
      }
      if (attackingHighValue) {
        blockPrio = 100; // Block their defensive powers
      }
    }

    // Strategy 4: Block when opponent is close to dangerous powers (original logic, enhanced)
    if (blockPrio === 0) {
      const oppThreshold = POWER_COSTS[POWER.FROST]; // 8 — they can start using powers
      if (oppAether >= oppThreshold) {
        blockPrio = 25;
        if (oppAether >= POWER_COSTS[POWER.VENGEANCE]) blockPrio = 65;
        else if (oppAether >= POWER_COSTS[POWER.PROMOTE]) blockPrio = 55;
        else if (oppAether >= POWER_COSTS[POWER.IMPRISON]) blockPrio = 40;
      }

      // OPTIMIZED: Don't use if opponent has low aether anyway
      if (oppAether < POWER_COSTS[POWER.FROST]) blockPrio = 0;
    }

    if (blockPrio > 0) {
      candidates.push({
        priority: blockPrio,
        exec: () => castAetherBlock(state),
        name: 'AETHER_BLOCK',
        payload: { power: 'AETHER_BLOCK' }
      });
    }
  }

  // BOMBA: Area denial strategy - force enemy king into worse position
  if (aether >= POWER_COSTS[POWER.BOMBA] && !isInCheck(state.board, forColor)) {
    let bestBomba = null, bestBombaScore = 0;
    const oppKing = findKing(state.board, opp);

    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (state.board[r][c]) continue;
      if (!validBombaTarget(state, forColor, r, c)) continue;
      let blastVal = 0;

      // Calculate immediate blast value
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const p = state.board[nr][nc];
        if (p && p.color === opp && p.type !== PIECE.KING && p.shieldHP <= 0) {
          blastVal += BOT_PIECE_VALUES[p.type];
        }
      }

      // OPTIMIZED: Check if bomb forces enemy king into worse position
      if (oppKing) {
        const distToKing = Math.max(Math.abs(r - oppKing.r), Math.abs(c - oppKing.c));
        if (distToKing <= 3) {
          // Bomb near enemy king creates pressure
          blastVal += 150;

          // Check if king will have fewer safe squares after bomb detonates
          const snap = snapshot(state.board);
          // Simulate bomb squares becoming unavailable
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (inBounds(nr, nc) && !state.board[nr][nc]) {
              state.board[nr][nc] = makePiece(PIECE.PAWN, forColor); // Temporary blocker
            }
          }
          const kingMovesAfter = allLegalMoves(state.board, opp, state).filter(mv =>
            mv.from.r === oppKing.r && mv.from.c === oppKing.c
          );
          restore(state.board, snap);
          if (kingMovesAfter.length <= 3) blastVal += 100; // Restricts king movement
        }
      }

      // OPTIMIZED: Check if bomb detonates near enemy queen (forces retreat)
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const p = state.board[nr][nc];
        if (p && p.color === opp && p.type === PIECE.QUEEN && p.shieldHP <= 0) {
          blastVal += 100; // Forces queen to move
        }
      }

      // OPTIMIZED: Check if bomb controls key central squares
      if (r >= 3 && r <= 4 && c >= 3 && c <= 4) {
        blastVal += 80; // Central bomb controls board
      }

      if (blastVal > bestBombaScore) {
        bestBombaScore = blastVal;
        bestBomba = { r, c };
      }
    }
    if (bestBomba && bestBombaScore >= 150) {
      candidates.push({
        priority: bestBombaScore * 0.12,
        exec: () => castBomba(state, bestBomba.r, bestBomba.c),
        name: 'BOMBA',
        payload: { power: 'BOMBA', r: bestBomba.r, c: bestBomba.c }
      });
    }
  }

  // CHRONOBREAK: Undo opponent's last turn to recover from devastating moves
  // High priority when we lost material, got checked, or opponent used powerful moves
  if (aether >= POWER_COSTS[POWER.CHRONOBREAK] && state.history && state.history.length >= 2) {
    let chronoPriority = 0;
    const myMat = botCountMaterial(state, forColor);
    const oppMat = botCountMaterial(state, opp);
    const materialDeficit = oppMat - myMat;

    // Check recent actions to detect what opponent did last turn
    // Look at last ~4 actions (opponent's turn might include multiple moves/powers)
    const recentActions = typeof UI !== 'undefined' && UI.gameActions ? UI.gameActions.slice(-4) : [];

    for (const action of recentActions) {
      if (!action || action.by !== opp) continue;

      // Material loss detection: opponent captured our pieces
      if (action.type === 'MOVE' && action.payload && action.payload.captured) {
        const capturedPiece = action.payload.captured;
        if (capturedPiece && capturedPiece.color === forColor) {
          // +100 if opponent captured our Queen last turn
          if (capturedPiece.type === PIECE.QUEEN) chronoPriority += 100;
          // +80 if opponent captured our Rook last turn
          else if (capturedPiece.type === PIECE.ROOK) chronoPriority += 80;
          // +40 per other piece captured last turn
          else if (capturedPiece.type !== PIECE.PAWN) chronoPriority += 40;
        }
      }

      // +60 if opponent used Vengeance/Promote last turn (game-changing powers)
      if (action.type === 'POWER_CAST' && action.payload) {
        const powerUsed = action.payload.power;
        if (powerUsed === POWER.VENGEANCE) chronoPriority += 60;
        else if (powerUsed === POWER.PROMOTE) chronoPriority += 60;
        else if (powerUsed === POWER.IMPRISON) chronoPriority += 50;
      }
    }

    // +50 if opponent put us in check last turn
    if (isInCheck(state.board, forColor)) chronoPriority += 50;

    // Extra urgency if we're in a losing position (down 300+ material)
    if (materialDeficit >= 300) chronoPriority += 30;

    // Hard mode: cast Chronobreak if priority >= 80 OR we're losing badly (down 300+)
    if (BOT.difficulty === 'hard' && chronoPriority >= 80) {
      candidates.push({
        priority: chronoPriority,
        exec: () => castChronobreak(state),
        name: 'CHRONOBREAK',
        payload: { power: 'CHRONOBREAK' }
      });
    }
  }

  if (candidates.length === 0) return null;

  // --- POWER COMBINATION BONUSES (Hard only) ---
  // Powers that don't end the turn can SET UP the regular move that follows.
  // Boost priority when a power enables a strong follow-up move this same turn.
  if (BOT.difficulty === 'hard') {
    for (const cand of candidates) {
      // FROST → frozen piece becomes free target for our pieces on the same turn
      // FROST → also freezes a defender, enabling checkmate
      if (cand.name === 'FROST' && cand.payload) {
        const { r, c } = cand.payload;
        const frozenPiece = state.board[r][c];
        // Combo 1: Can we capture the frozen piece?
        for (let mr = 0; mr < 8; mr++) for (let mc = 0; mc < 8; mc++) {
          const myP = state.board[mr][mc];
          if (!myP || myP.color !== forColor || myP.type === PIECE.KING || myP.isSpectral) continue;
          if (myP.imprisoned || (myP.frozenUntil && myP.frozenUntil > state.turnNumber)) continue;
          const mvs = legalMoves(state.board, mr, mc, state);
          for (const mv of mvs) {
            if (mv.r === r && mv.c === c) {
              if (frozenPiece) cand.priority += BOT_PIECE_VALUES[frozenPiece.type] * 0.15;
              break;
            }
          }
        }
        // Combo 2: Freezing a key defender enables checkmate (Frost doesn't end turn!)
        if (frozenPiece && frozenPiece.type !== PIECE.PAWN) {
          // Simulate the piece being unable to move (frozen) — does that create a mate?
          const snap = snapshot(state.board);
          // Mark as frozen in the simulation
          const origFrozen = frozenPiece.frozenUntil;
          frozenPiece.frozenUntil = state.turnNumber + 3;
          // Check all our moves for mate
          const myMoves = allLegalMoves(state.board, forColor, state);
          for (const mv of myMoves) {
            const captured = state.board[mv.to.r][mv.to.c];
            state.board[mv.to.r][mv.to.c] = state.board[mv.from.r][mv.from.c];
            state.board[mv.from.r][mv.from.c] = null;
            if (isInCheck(state.board, opp)) {
              const oppMoves = allLegalMoves(state.board, opp, state);
              if (oppMoves.length === 0) {
                cand.priority += 150; // Frost enables checkmate!
                restore(state.board, snap);
                frozenPiece.frozenUntil = origFrozen;
                break;
              }
            }
            restore(state.board, snap);
            frozenPiece.frozenUntil = state.turnNumber + 3;
          }
          frozenPiece.frozenUntil = origFrozen;
          restore(state.board, snap);
        }
      }
      // IMPRISON → we removed a defender, check if that opens an attack
      if (cand.name === 'IMPRISON' && cand.payload) {
        const captiveR = cand.payload.captive.r, captiveC = cand.payload.captive.c;
        const captive = state.board[captiveR][captiveC];
        if (captive) {
          // Simulate removing the captive and check if we can now attack something
          const snap = snapshot(state.board);
          state.board[captiveR][captiveC] = null;
          // Check if removing this piece exposes a higher-value piece behind it
          for (let mr = 0; mr < 8; mr++) for (let mc = 0; mc < 8; mc++) {
            const myP = state.board[mr][mc];
            if (!myP || myP.color !== forColor || myP.isSpectral) continue;
            if (myP.imprisoned || (myP.frozenUntil && myP.frozenUntil > state.turnNumber)) continue;
            const mvs = legalMoves(state.board, mr, mc, state);
            for (const mv of mvs) {
              const t = state.board[mv.r][mv.c];
              if (t && t.color === opp && t.type !== PIECE.KING) {
                // We can now capture something that was defended by the imprisoned piece
                cand.priority += BOT_PIECE_VALUES[t.type] * 0.10;
                break;
              }
            }
          }
          restore(state.board, snap);
        }
      }
      // FORTIFY → a shielded piece can trade favorably (go into attacked squares)
      if (cand.name === 'FORTIFY' && cand.payload) {
        // Fortified piece survives first hit, so it can attack with impunity
        cand.priority += 10; // slight combo bonus for enabling aggressive play
      }
      // AETHER_BLOCK → especially good if we're about to attack (denies counter-powers)
      if (cand.name === 'AETHER_BLOCK') {
        // Check if we have a strong capture available this turn
        const moves = allLegalMoves(state.board, forColor, state);
        for (const mv of moves) {
          const t = state.board[mv.to.r][mv.to.c];
          if (t && t.color === opp && BOT_PIECE_VALUES[t.type] >= 500) {
            cand.priority += 15; // combo: block then take their queen/rook
            break;
          }
        }
      }
    }
  }

  // Sort by priority, pick the best (or random for easy)
  candidates.sort((a, b) => b.priority - a.priority);

  if (candidates.length > 0 && aether >= 14) {
    const top3 = candidates.slice(0,3).map(c=>`${c.name}(${c.priority.toFixed(0)})`).join(' ');
    console.error(`  Candidates: ${top3}`);
  }

  if (BOT.difficulty === 'easy') {
    // 20% chance to cast a random power, 80% skip
    if (Math.random() > 0.2) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  if (BOT.difficulty === 'medium') {
    // 40% chance to use the best power if priority is high enough
    if (candidates[0].priority < 30) return null;
    if (Math.random() > 0.4) return null;
    return candidates[0];
  }

  // Hard: use powers strategically — balance spending vs saving for bigger powers
  const best = candidates[0];
  if (best.priority < 15) {
    if (aether >= 14) console.error(`  → SKIP low prio`);
    return null;
  }

  const aetherNow = state.mana[forColor];
  const isBigPower = best.name === 'VENGEANCE' || best.name === 'PROMOTE' || best.name === 'WALL';
  const isMidPower = best.name === 'IMPRISON' || best.name === 'DOUBLE_ATTACK' || best.name === 'CLEANSE' || best.name === 'AETHER_BLOCK' || best.name === 'BOMBA';

  // --- Tier 1: Always cast big powers (Vengeance, Promote, Wall) ---
  // These are the highest-impact powers and afford-gated at 15-18 aether.
  if (isBigPower) {
    console.error(`  → USE ${best.name}`);
    return best;
  }

  // --- Tier 2: Mid-tier powers (Imprison, Double Attack, Cleanse, Aether Block, Bomba) ---
  // Already cost 10-14 aether, so afford-check is sufficient gating.
  // BUT if we're close to a big power (within 4 aether of Vengeance/Wall), prefer saving.
  if (isMidPower) {
    const gapToVengeance = POWER_COSTS[POWER.VENGEANCE] - aetherNow;
    // If we just spent on mid-tier, can we STILL reach Vengeance in ~4 turns?
    // Don't block mid-tier forever — they're still very impactful.
    // Only defer if we're VERY close to Vengeance (within 3 aether after spending)
    if (gapToVengeance <= 3 && best.priority < 60) {
      console.error(`  → SKIP ${best.name} (save4Veng)`);
      return null;
    }

    console.error(`  → USE ${best.name}`);
    return best;
  }

  // --- Tier 3: Cheap powers (Frost 8, Fortify 7, Blink 8) ---
  // These must be heavily gated to allow aether accumulation.

  // CRITICAL: Blink to save a high-value piece always wins (piece > aether)
  if (best.name === 'BLINK' && best.priority >= 100) return best; // Rook+ escape

  // Fortify to save queen/rook is urgent
  if (best.name === 'FORTIFY' && best.priority >= 50) return best;

  // If we already have surplus aether (can afford Vengeance), cheap powers are free
  if (aetherNow >= POWER_COSTS[POWER.VENGEANCE]) return best;

  // "SAVING ZONE" (8+ aether): We need progressive strictness.
  // The closer we are to mid/big tier thresholds, the stricter the gate.
  if (aetherNow >= 8) {
    // Within 4 of Imprison (14) — strict, only urgent escapes
    if (aetherNow >= 10) {
      // In 10-17 range: accumulating toward mid/big powers
      // Only cast for truly emergency situations (piece definitely dying)
      if (best.priority >= 120) return best;
      return null;
    }
    // 8-9: less strict, but still prefer saving
    if (best.priority >= 60) return best;
    return null;
  }

  // Aether < 8: far from anything meaningful, use cheap powers if worthwhile
  if (best.priority >= 25) return best;
  return null;
}

// ---------- Sacrifice Decision ----------
function botConsiderSacrifice(state, forColor) {
  if (state.aetherBlocked[forColor]) return null;
  if (state.sacrificedThisTurn[forColor]) return null;

  const aether = state.mana[forColor];
  const phase = botGamePhase(state);
  const opp = opposite(forColor);

  // HARD MODE: only sacrifice when it DIRECTLY enables a high-impact power THIS TURN
  if (BOT.difficulty === 'hard') {
    // Never sacrifice if already have enough for the best available power
    if (aether >= POWER_COSTS[POWER.VENGEANCE]) return null;
    // Only sacrifice in endgame when clearly ahead and close to affording Vengeance/Promote
    const myMat = botCountMaterial(state, forColor);
    const oppMat = botCountMaterial(state, opp);
    if (myMat - oppMat < 300) return null; // must be significantly ahead to sacrifice
    // Only sacrifice if it gets us to Vengeance or Promote threshold
    const neededForVengeance = POWER_COSTS[POWER.VENGEANCE] - aether;
    const neededForPromote = POWER_COSTS[POWER.PROMOTE] - aether;
    // Only sacrifice pawns (never pieces) and only far-from-promo pawns
    let bestSac = null;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type !== PIECE.PAWN || p.isSpectral) continue;
      const distToPromo = forColor === COLOR.WHITE ? r : (7 - r);
      if (distToPromo <= 3) continue; // don't sac pawns that are advancing well
      bestSac = { r, c };
      break; // just need one pawn
    }
    if (!bestSac) return null;
    const gain = SACRIFICE_VALUES[state.board[bestSac.r][bestSac.c].type];
    const afterAether = Math.min(AETHER_CAP, aether + gain);
    // Only sacrifice if it reaches Vengeance or Promote threshold
    if (afterAether < Math.min(neededForVengeance <= gain ? POWER_COSTS[POWER.VENGEANCE] : Infinity,
                               neededForPromote <= gain ? POWER_COSTS[POWER.PROMOTE] : Infinity)) {
      // Actually simpler: does afterAether reach vengeance or promote cost?
      if (afterAether < POWER_COSTS[POWER.PROMOTE]) return null;
    }
    // Only 30% chance even when conditions are met (don't spam)
    if (Math.random() > 0.3) return null;
    return bestSac;
  }

  // EASY/MEDIUM: original logic
  const aetherCap = phase < 0.5 ? 20 : 15;
  if (aether >= aetherCap) return null;

  let bestSac = null, bestCost = Infinity;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
    if (p.type === PIECE.QUEEN || p.type === PIECE.ROOK) continue;
    const val = BOT_PIECE_VALUES[p.type];
    if (p.type === PIECE.PAWN) {
      const distToPromo = forColor === COLOR.WHITE ? r : (7 - r);
      if (distToPromo <= 2) continue;
    }
    if (val < bestCost) { bestCost = val; bestSac = { r, c }; }
  }

  if (!bestSac) return null;

  const gain = SACRIFICE_VALUES[state.board[bestSac.r][bestSac.c].type];
  const afterAether = Math.min(AETHER_CAP, aether + gain);
  const usefulThreshold = phase < 0.5 ? POWER_COSTS[POWER.PROMOTE] : POWER_COSTS[POWER.BLINK];
  if (afterAether < usefulThreshold) return null;

  const chance = BOT.difficulty === 'easy' ? 0.1 : 0.25;
  if (Math.random() > chance) return null;
  return bestSac;
}

// ---------- Emergency Escape (when in check with no legal moves) ----------
// Mirrors canOpponentEscapeMateWithPowers logic: tries ALL possible power escapes.
// Must find every escape the game engine considers valid, or the bot gets stuck.
// Uses a probe approach: test on a copy, execute on real state only when confirmed.
function botEmergencyEscape(state, forColor) {
  if (state.aetherBlocked[forColor]) return null;
  const aether = state.mana[forColor];
  const opp = opposite(forColor);
  const kingPos = findKing(state.board, forColor);
  if (!kingPos) return null;

  // Find the attacking piece(s)
  const attackers = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.color !== opp) continue;
    const attacks = typeof getAttackSquares === 'function' ? getAttackSquares(state.board, r, c) : [];
    if (attacks.some(a => a.r === kingPos.r && a.c === kingPos.c)) {
      attackers.push({ r, c, piece: p });
    }
  }

  // Helper: test a power on a clone to see if it resolves check
  function probeEscape(castFn) {
    const boardSnap = snapshot(state.board);
    const manaBefore = state.mana[forColor];
    const res = castFn(state);
    if (res && res.success && !isInCheck(state.board, forColor)) {
      return true; // Success! State is already modified correctly
    }
    // Failed or didn't resolve check — restore
    restore(state.board, boardSnap);
    state.mana[forColor] = manaBefore;
    return false;
  }

  // 1. Try VENGEANCE: destroy the attacker
  if (aether >= POWER_COSTS[POWER.VENGEANCE] && attackers.length > 0) {
    for (const atk of attackers) {
      if (atk.piece.type === PIECE.KING) continue;
      if (probeEscape(s => castVengeance(s, atk.r, atk.c))) {
        return { name: 'VENGEANCE', payload: { power: 'VENGEANCE', r: atk.r, c: atk.c } };
      }
    }
  }

  // 2. Try IMPRISON: cage the attacker with an adjacent friendly piece
  if (aether >= POWER_COSTS[POWER.IMPRISON]) {
    for (const atk of attackers) {
      if (atk.piece.type === PIECE.KING) continue;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const cr = atk.r + dr, cc = atk.c + dc;
        if (!inBounds(cr, cc)) continue;
        const captor = state.board[cr][cc];
        if (!captor || captor.color !== forColor || captor.type === PIECE.KING) continue;
        if (captor.isSpectral || captor.imprisoned) continue;
        if (probeEscape(s => castImprison(s, cr, cc, atk.r, atk.c))) {
          return { name: 'IMPRISON', payload: { power: 'IMPRISON', captor: { r: cr, c: cc }, captive: { r: atk.r, c: atk.c } } };
        }
      }
    }
  }

  // 3. Try BLINK: move any own piece to any adjacent square (brute force, mirrors engine)
  if (aether >= POWER_COSTS[POWER.BLINK]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.KING) continue;
      if (p.isSpectral || p.imprisoned) continue;
      if (p.frozenUntil && p.frozenUntil > state.turnNumber) continue;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        if (probeEscape(s => castBlink(s, r, c, nr, nc))) {
          return { name: 'BLINK', payload: { power: 'BLINK', from: { r, c }, to: { r: nr, c: nc } } };
        }
      }
    }
  }

  // 4. Try WALL: spawn pawns around any own piece to block check line
  if (aether >= POWER_COSTS[POWER.WALL]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
      // Try all 4 directions to find any that resolves check
      for (const dir of ['N', 'S', 'E', 'W']) {
        if (probeEscape(s => castWall(s, r, c, dir))) {
          return { name: 'WALL', payload: { power: 'WALL', r, c, direction: dir } };
        }
      }
    }
  }

  return null; // True checkmate — no power can save
}

// ---------- Main Bot Turn ----------
function botPlay() {
  if (!BOT.enabled || BOT.thinking) return;
  if (UI.state.winner) return;

  // In bot-vs-bot mode, either color triggers the bot
  if (!BOT.botVsBot && UI.state.turn !== BOT.color) return;

  BOT.thinking = true;

  const delay = BOT.botVsBot ? BOT.thinkDelay : BOT.thinkDelay;
  setTimeout(() => {
    let errorOccurred = false;
    try {
      botExecuteTurn();
    } catch (e) {
      console.error('[bot] Error during turn:', e);
      console.error('[bot] Bot disabled due to error. Refresh page to restart.');
      errorOccurred = true;
      // Disable bot to prevent infinite error loop
      BOT.enabled = false;
      BOT.thinking = false;
      setStatus('Bot error - please refresh page', 'error');
    }

    if (!errorOccurred) {
      // CRITICAL: Clear thinking flag BEFORE triggering next render/botCheckTurn
      // Otherwise botCheckTurn sees BOT.thinking=true and skips, breaking the loop.
      BOT.thinking = false;
      // Re-trigger to ensure next bot move fires (render inside botFinishTurn
      // may have called botCheckTurn while thinking was still true)
      if (BOT.enabled && !UI.state.winner) {
        setTimeout(() => botCheckTurn(), 16);
      }
    }
  }, delay);
}

function botExecuteTurn() {
  if (UI.state.winner) return;

  const color = UI.state.turn;

  // In single-bot mode, only play if it's our turn
  if (!BOT.botVsBot && color !== BOT.color) return;

  // Set difficulty based on which color is playing in bot-vs-bot
  const activeDifficulty = BOT.botVsBot
    ? (color === COLOR.WHITE ? BOT.whiteDifficulty : BOT.blackDifficulty)
    : BOT.difficulty;

  // Temporarily set difficulty for helper functions that read BOT.difficulty
  const savedDiff = BOT.difficulty;
  BOT.difficulty = activeDifficulty;

  // Phase 1: Consider sacrifice (before powers, to build aether)
  const sacTarget = botConsiderSacrifice(UI.state, color);
  if (sacTarget) {
    const res = sacrificePiece(UI.state, sacTarget.r, sacTarget.c);
    if (res.success) {
      if (typeof recordAction === 'function') recordAction('SACRIFICE', color, { r: sacTarget.r, c: sacTarget.c });
      setStatus(`Bot sacrificed for +${res.gain} Aether.`, 'ok');
      floatingText(`+${res.gain}`, sacTarget.r, sacTarget.c, 'aether');
      render();
      // Continue — still need to make a move (sacrifice doesn't end turn)
    }
  }

  // Phase 2: Consider casting MULTIPLE powers in sequence (multi-power combo system)
  // Powers that don't end the turn can be chained together (up to 3 powers per turn)
  const MAX_POWERS_PER_TURN = 3;
  const CONTINUE_TURN_PRIORITY_THRESHOLD = 40; // Priority needed to cast continue-turn powers in sequence
  const END_TURN_PRIORITY_THRESHOLD = 60; // Priority needed to cast end-turn powers after other powers
  const MIN_AETHER_RESERVE = 5; // Stop chaining if aether drops below this

  let powersCastThisTurn = 0;
  let lastPowerWasContinueTurn = false;

  while (powersCastThisTurn < MAX_POWERS_PER_TURN && UI.state.mana[color] >= MIN_AETHER_RESERVE) {
    const powerAction = botConsiderPowers(UI.state, color);
    if (!powerAction) break; // No more powers worth casting

    // Check if this power ends the turn
    const endsTurn = ['BLINK', 'VENGEANCE', 'WALL', 'PROMOTE', 'DOUBLE_ATTACK', 'CHRONOBREAK'].includes(powerAction.name);

    // Decision logic based on power type and priority
    if (endsTurn) {
      // End-turn powers: only cast if priority is very high OR this is the first power
      if (powersCastThisTurn === 0 || powerAction.priority >= END_TURN_PRIORITY_THRESHOLD) {
        const res = powerAction.exec();
        if (res && res.success) {
          if (typeof recordAction === 'function') recordAction('POWER_CAST', color, powerAction.payload || { power: powerAction.name });
          setStatus(`Bot cast ${powerAction.name}!`, 'ok');
          render();
          powersCastThisTurn++;
          // Turn ended, we're done
          if (UI.state.turn !== color) {
            botFinishTurn();
            return;
          }
        }
        break; // Even if it failed, stop trying powers
      } else {
        // Priority not high enough to use end-turn power after other powers
        break;
      }
    } else {
      // Continue-turn powers: cast if priority meets threshold (or if it's the first power)
      if (powersCastThisTurn === 0 || powerAction.priority >= CONTINUE_TURN_PRIORITY_THRESHOLD) {
        const res = powerAction.exec();
        if (res && res.success) {
          if (typeof recordAction === 'function') recordAction('POWER_CAST', color, powerAction.payload || { power: powerAction.name });
          setStatus(`Bot cast ${powerAction.name}!`, 'ok');
          render();
          powersCastThisTurn++;
          lastPowerWasContinueTurn = true;
          // Check if game ended or turn somehow changed
          if (UI.state.winner || UI.state.turn !== color) {
            botFinishTurn();
            return;
          }
          // Continue to next power in the loop
        } else {
          // Power failed, stop trying
          break;
        }
      } else {
        // Priority not high enough to chain another power
        break;
      }
    }
  }

  // Log combo usage for debugging (hard mode only) - disabled during search for performance
  // if (BOT.difficulty === 'hard' && powersCastThisTurn > 1) {
  //   console.log(`[bot] Multi-power combo: cast ${powersCastThisTurn} powers this turn`);
  // }

  // If game ended due to power
  if (UI.state.winner || UI.state.turn !== color) {
    botFinishTurn();
    return;
  }

  // Phase 3: Make a chess move
  const moves = allLegalMoves(UI.state.board, color, UI.state);
  if (moves.length === 0) {
    // No legal chess moves — try emergency powers to escape check
    if (isInCheck(UI.state.board, color)) {
      const escaped = botEmergencyEscape(UI.state, color);
      if (escaped) {
        if (typeof recordAction === 'function') recordAction('POWER_CAST', color, escaped.payload || { power: escaped.name });
        setStatus(`Bot used ${escaped.name} to escape check!`, 'ok');
        render();
      } else {
        // No escape found — this is checkmate. Force game end to prevent stuck state.
        console.log('[bot] No escape possible — declaring checkmate');
        UI.state.winner = opposite(color);
        UI.state.winReason = 'CHECKMATE';
        UI.state.log.push(`Checkmate! ${opposite(color) === COLOR.WHITE ? 'White' : 'Black'} wins.`);
      }
    } else {
      // Not in check but no moves = stalemate
      if (!UI.state.winner) {
        UI.state.winner = 'DRAW';
        UI.state.winReason = 'STALEMATE';
        UI.state.log.push('Stalemate - draw.');
      }
    }
    botFinishTurn();
    return;
  }

  let chosenMove;

  if (BOT.difficulty === 'easy') {
    // Pure random
    chosenMove = moves[Math.floor(Math.random() * moves.length)];
  } else if (BOT.difficulty === 'hard') {
    // Hard: Opening book for first moves, then 4-ply alpha-beta with quiescence
    const bookMove = botGetBookMove(UI.state, color, moves);
    if (bookMove) {
      chosenMove = bookMove;
    } else {
      chosenMove = botSearchBestMove(UI.state, moves, color);
    }
  } else {
    // Medium: Score all moves and pick from top 3 with randomness
    const scored = moves.map(m => ({
      move: m,
      score: botScoreMove(UI.state, m.from, m.to, color)
    }));

    scored.sort((a, b) => b.score - a.score);

    // Pick from top 3 with weighted randomness
    const top = scored.slice(0, Math.min(3, scored.length));
    const weights = top.map((s, i) => Math.max(1, 10 - i * 3));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;
    for (let i = 0; i < top.length; i++) {
      r -= weights[i];
      if (r <= 0) { chosenMove = top[i].move; break; }
    }
    if (!chosenMove) chosenMove = top[0].move;
  }

  // Determine promotion type if needed
  const piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
  let promoType = undefined;
  if (piece && piece.type === PIECE.PAWN && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) {
    promoType = PIECE.QUEEN; // always promote to queen
  }

  // Record move for repetition avoidance
  botRecordMove(chosenMove.from, chosenMove.to);

  // Capture the piece at target BEFORE making the move (for Chronobreak detection)
  const capturedPiece = UI.state.board[chosenMove.to.r][chosenMove.to.c];

  const res = makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promoType);
  if (res.error) {
    // Shouldn't happen since we used allLegalMoves, but fallback to random
    console.warn('[bot] Move failed:', res.error, 'trying random fallback');
    const fallback = moves[Math.floor(Math.random() * moves.length)];
    const fallbackCapture = UI.state.board[fallback.to.r][fallback.to.c];
    makeMove(UI.state, fallback.from.r, fallback.from.c, fallback.to.r, fallback.to.c, promoType);
    if (typeof recordAction === 'function') recordAction('MOVE', color, { from: fallback.from, to: fallback.to, promotion: promoType, captured: fallbackCapture });
  } else {
    if (typeof recordAction === 'function') recordAction('MOVE', color, { from: chosenMove.from, to: chosenMove.to, promotion: promoType, captured: capturedPiece });
  }

  // Restore difficulty
  BOT.difficulty = savedDiff;
  botFinishTurn();
}

function botFinishTurn() {
  if (typeof render === 'function') render();
  if (UI.state.winner) {
    if (typeof showGameOverModal === 'function') showGameOverModal();
    // Bot vs Bot: record result and possibly start next game
    if (BOT.botVsBot) {
      botVsBotGameEnd();
    }
  }
}

// ---------- Integration with game loop ----------
// Called after every render / state change when the bot is enabled.
function botCheckTurn() {
  if (!BOT.enabled) return;
  if (UI.state.winner) return;
  if (BOT.thinking) return;
  // In bot-vs-bot, always trigger; in single-bot, only on bot's color
  if (!BOT.botVsBot && UI.state.turn !== BOT.color) return;
  // Minimal delay in bot-vs-bot (just enough for a paint frame), longer for human watching
  const uiDelay = BOT.botVsBot ? 16 : 100;
  setTimeout(() => botPlay(), uiDelay);
}

// ---------- Bot Setup ----------
function botStart(color, difficulty) {
  BOT.enabled = true;
  BOT.botVsBot = false;
  BOT.color = color || COLOR.BLACK;
  BOT.difficulty = difficulty || 'medium';
  BOT.thinking = false;
  BOT.thinkDelay = difficulty === 'easy' ? 400 : difficulty === 'hard' ? 300 : 600;
  botClearHistory();
  console.log(`[bot] Started as ${BOT.color === COLOR.WHITE ? 'White' : 'Black'}, difficulty: ${BOT.difficulty}`);
  botCheckTurn();
}

function botStop() {
  BOT.enabled = false;
  BOT.botVsBot = false;
  BOT.thinking = false;
  if (BOT.autoPlayInterval) { clearInterval(BOT.autoPlayInterval); BOT.autoPlayInterval = null; }
  console.log('[bot] Stopped');
}

// ---------- Bot vs Bot Mode ----------
function botVsBotStart(opts = {}) {
  const whiteDiff = opts.white || 'medium';
  const blackDiff = opts.black || 'medium';
  const numGames = opts.games || 1;
  const speed = opts.speed || 'normal'; // 'fast' | 'normal' | 'slow'

  BOT.enabled = true;
  BOT.botVsBot = true;
  BOT.whiteDifficulty = whiteDiff;
  BOT.blackDifficulty = blackDiff;
  BOT.thinking = false;
  BOT.gameCount = 0;
  BOT.maxGames = numGames;
  BOT.results = { white: 0, black: 0, draw: 0 };
  BOT.onGameEnd = opts.onGameEnd || null;

  // Speed presets
  // Speed presets: instant (no visual), blitz (quick but watchable), fast, normal, slow
  BOT.thinkDelay = speed === 'instant' ? 1 : speed === 'blitz' ? 80 : speed === 'fast' ? 150 : speed === 'slow' ? 800 : 300;

  console.log(`[bot-vs-bot] Starting ${numGames} game(s): White=${whiteDiff} vs Black=${blackDiff} (speed: ${speed})`);

  // Start first game
  botVsBotNewGame();
}

function botVsBotNewGame() {
  BOT.gameCount++;
  BOT.thinking = false;
  botClearHistory();

  // Re-init game state
  if (typeof UI !== 'undefined' && UI.state) {
    UI.state = initGame();
    UI.gameActions = [];
    UI.selected = null;
    if (typeof UI.activePower !== 'undefined') UI.activePower = null;
    if (typeof UI.powerState !== 'undefined') UI.powerState = {};
    if (typeof UI.prevAether !== 'undefined') {
      UI.prevAether = { w: UI.state.mana[COLOR.WHITE], b: UI.state.mana[COLOR.BLACK] };
    }
    if (typeof buildBoard === 'function') buildBoard();
    if (typeof render === 'function') render();
  }

  console.log(`[bot-vs-bot] Game ${BOT.gameCount}/${BOT.maxGames} started`);
  if (typeof setStatus === 'function') {
    setStatus(`Bot vs Bot — Game ${BOT.gameCount}/${BOT.maxGames} (W:${BOT.whiteDifficulty} vs B:${BOT.blackDifficulty})`, 'ok');
  }

  // Trigger the first move
  botCheckTurn();
}

function botVsBotGameEnd() {
  const winner = UI.state.winner;
  const reason = UI.state.winReason;

  if (winner === COLOR.WHITE) BOT.results.white++;
  else if (winner === COLOR.BLACK) BOT.results.black++;
  else BOT.results.draw++;

  const winnerName = winner === COLOR.WHITE ? 'White' : winner === COLOR.BLACK ? 'Black' : 'Draw';
  console.log(`[bot-vs-bot] Game ${BOT.gameCount} result: ${winnerName} (${reason || 'unknown'}) | Turn ${Math.ceil(UI.state.turnNumber / 2)}`);
  console.log(`[bot-vs-bot] Score — W:${BOT.results.white} B:${BOT.results.black} D:${BOT.results.draw}`);

  if (BOT.onGameEnd) {
    BOT.onGameEnd({
      game: BOT.gameCount,
      winner,
      reason,
      turns: Math.ceil(UI.state.turnNumber / 2),
      results: { ...BOT.results }
    });
  }

  if (typeof setStatus === 'function') {
    setStatus(`Game ${BOT.gameCount}: ${winnerName} wins (${reason}) | W:${BOT.results.white} B:${BOT.results.black} D:${BOT.results.draw}`, 'ok');
  }

  // Update live test panel if visible
  botUpdateTestPanel(winner, reason);

  // Check if more games to play
  if (BOT.gameCount < BOT.maxGames) {
    setTimeout(() => botVsBotNewGame(), Math.max(200, BOT.thinkDelay * 2));
  } else {
    console.log(`[bot-vs-bot] Series complete: W:${BOT.results.white} B:${BOT.results.black} D:${BOT.results.draw}`);
    if (typeof setStatus === 'function') {
      setStatus(`Series done! White ${BOT.results.white} – Black ${BOT.results.black} – Draw ${BOT.results.draw}`, 'ok');
    }
    BOT.botVsBot = false;
    botFinalizeTestPanel();
  }
}

// ---------- Live Test Panel ----------
// Shows real-time stats when bot-vs-bot runs in the UI
function botShowTestPanel() {
  if (document.getElementById('bot-test-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'bot-test-panel';
  panel.className = 'bot-test-panel';
  panel.innerHTML = `
    <div class="btp-header">
      <span class="btp-icon">🧪</span>
      <span class="btp-title">LIVE TEST MODE</span>
      <button id="btp-stop" class="btp-stop" title="Stop test">■ Stop</button>
    </div>
    <div class="btp-stats">
      <div class="btp-row"><span class="btp-label">Progress</span><span id="btp-progress">0 / ${BOT.maxGames}</span></div>
      <div class="btp-row"><span class="btp-label">White wins</span><span id="btp-white" class="btp-white">0</span></div>
      <div class="btp-row"><span class="btp-label">Black wins</span><span id="btp-black" class="btp-black">0</span></div>
      <div class="btp-row"><span class="btp-label">Draws</span><span id="btp-draws">0</span></div>
      <div class="btp-row"><span class="btp-label">Violations</span><span id="btp-violations" class="btp-ok">0</span></div>
    </div>
    <div class="btp-log-header">Game Results</div>
    <div id="btp-log" class="btp-log"></div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('#btp-stop').addEventListener('click', () => {
    botStop();
    botFinalizeTestPanel();
  });
}

function botUpdateTestPanel(winner, reason) {
  const panel = document.getElementById('bot-test-panel');
  if (!panel) return;

  panel.querySelector('#btp-progress').textContent = `${BOT.gameCount} / ${BOT.maxGames}`;
  panel.querySelector('#btp-white').textContent = BOT.results.white;
  panel.querySelector('#btp-black').textContent = BOT.results.black;
  panel.querySelector('#btp-draws').textContent = BOT.results.draw;

  // Violation check: detect if non-mover is in check (illegal state)
  const violations = botCountViolations();
  const violEl = panel.querySelector('#btp-violations');
  violEl.textContent = violations;
  violEl.className = violations > 0 ? 'btp-fail' : 'btp-ok';

  // Add to game log
  const log = panel.querySelector('#btp-log');
  const entry = document.createElement('div');
  entry.className = 'btp-log-entry';
  const winLabel = winner === COLOR.WHITE ? 'W' : winner === COLOR.BLACK ? 'B' : 'D';
  const turns = Math.ceil(UI.state.turnNumber / 2);
  entry.innerHTML = `<span class="btp-game-num">#${BOT.gameCount}</span> <span class="btp-result-${winLabel.toLowerCase()}">${winLabel}</span> <span class="btp-reason">${reason || '?'} (${turns}t)</span>`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function botFinalizeTestPanel() {
  const panel = document.getElementById('bot-test-panel');
  if (!panel) return;
  const header = panel.querySelector('.btp-title');
  if (header) header.textContent = 'TEST COMPLETE';
  const stopBtn = panel.querySelector('#btp-stop');
  if (stopBtn) { stopBtn.textContent = '✕ Close'; stopBtn.onclick = () => panel.remove(); }
}

function botCountViolations() {
  // Quick check: the non-mover should NOT be in check
  if (!UI.state || UI.state.winner) return 0;
  const nonMover = opposite(UI.state.turn);
  if (isInCheck(UI.state.board, nonMover)) return 1;
  return 0;
}
