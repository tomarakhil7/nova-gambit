// ============================================================
// NOVA GAMBIT - Heuristic Bot (v1.0)
// A CPU opponent that plays both chess moves AND Aether powers.
// Difficulty levels: easy (random), medium (heuristic), hard (deeper eval).
// ============================================================

const BOT = {
  enabled: false,
  color: null,       // 'w' or 'b' — the color the bot plays (single-bot mode)
  difficulty: 'medium', // 'easy' | 'medium' | 'hard'
  thinkDelay: 600,   // ms delay before bot plays (feels more natural)
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
          else score -= passedBonus;
        }
      }
    }
  }

  // Aether advantage (scaled down in endgame — pieces matter more)
  score += (state.mana[forColor] - state.mana[opp]) * (phase > 0.5 ? 8 : 4);

  // Center control bonus (less important in endgame)
  if (controlsCenter(state, forColor)) score += 30 * phase;
  if (controlsCenter(state, opp)) score -= 30 * phase;

  // Fountain occupation bonus
  score += occupiedFountains(state, forColor) * 25;
  score -= occupiedFountains(state, opp) * 25;

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
    score += shieldPawns * 20;
    // Penalize king on open file (no own pawn on same file)
    let ownPawnOnFile = false;
    for (let scanR = 0; scanR < 8; scanR++) {
      const p = state.board[scanR][myKingPos.c];
      if (p && p.type === PIECE.PAWN && p.color === forColor) { ownPawnOnFile = true; break; }
    }
    if (!ownPawnOnFile) score -= 30;
  }

  // ===== OPPONENT KING SAFETY (exploit weakness) =====
  if (phase > 0.5 && oppKingPos) {
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
    if (oppShieldPawns < 2) score += (2 - oppShieldPawns) * 25;
  }

  // ===== PIECE ACTIVITY / DEVELOPMENT =====
  // Penalize undeveloped minor pieces in the opening (still on back rank)
  if (phase > 0.7) {
    const backRank = forColor === COLOR.WHITE ? 7 : 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[backRank][c];
      if (p && p.color === forColor && (p.type === PIECE.KNIGHT || p.type === PIECE.BISHOP)) {
        score -= 25; // penalty for undeveloped minor piece
      }
    }
    const oppBackRank = opp === COLOR.WHITE ? 7 : 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[oppBackRank][c];
      if (p && p.color === opp && (p.type === PIECE.KNIGHT || p.type === PIECE.BISHOP)) {
        score += 25; // reward opponent being undeveloped
      }
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
  if (myBishops >= 2) score += 40;
  if (oppBishops >= 2) score -= 40;

  // ===== ROOK ON OPEN FILE =====
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.type !== PIECE.ROOK || p.isSpectral) continue;
    let pawnsOnFile = 0;
    for (let scanR = 0; scanR < 8; scanR++) {
      const fp = state.board[scanR][c];
      if (fp && fp.type === PIECE.PAWN && !fp.isSpectral) pawnsOnFile++;
    }
    const bonus = pawnsOnFile === 0 ? 30 : pawnsOnFile === 1 ? 15 : 0;
    if (p.color === forColor) score += bonus;
    else score -= bonus;
  }

  return score;
}

// ---------- Move Scoring ----------
function botScoreMove(state, from, to, forColor) {
  let score = 0;
  const piece = state.board[from.r][from.c];
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

  // Moving to a fountain
  if (state.fountains.some(f => f.r === to.r && f.c === to.c)) score += 60;

  // Moving to center (less important in endgame)
  if (CENTER_SQUARES.some(sq => sq.r === to.r && sq.c === to.c)) score += 25 * phase;

  // Defusing a bomb
  if (state.bombs.some(b => b.r === to.r && b.c === to.c && b.owner !== forColor)) score += 150;

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

// ---------- Alpha-Beta Search (Hard mode) ----------
// 2-ply with alpha-beta pruning + quiescence on captures.
// Fast enough for browser: move ordering ensures early cutoffs, and we limit
// the candidate set at the root to keep wall-clock under ~200ms.
const BOT_SEARCH_DEPTH = 3; // 3-ply = my move + response + my follow-up
const BOT_ROOT_CANDIDATES = 10; // Only deep-search the top N root moves (tighter at depth 3)

// Quick move-ordering score (no board copies — pure heuristics)
function botOrderScore(state, m, forColor) {
  let s = 0;
  const piece = state.board[m.from.r][m.from.c];
  const target = state.board[m.to.r][m.to.c];
  // MVV-LVA for captures
  if (target && target.color !== piece.color) {
    s += 10000 + BOT_PIECE_VALUES[target.type] * 10 - BOT_PIECE_VALUES[piece.type];
  }
  // Promotions
  if (piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) s += 9000;
  // PST improvement
  const phase = botGamePhase(state);
  s += botPieceSquareValue(piece, m.to.r, m.to.c, phase) - botPieceSquareValue(piece, m.from.r, m.from.c, phase);
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

// Negamax with alpha-beta pruning
function botNegamax(state, depth, alpha, beta, forColor) {
  const opp = opposite(forColor);

  // Terminal check
  if (depth === 0) {
    return botQuiesce(state, alpha, beta, forColor);
  }

  const moves = allLegalMoves(state.board, forColor, state);

  // Checkmate / stalemate
  if (moves.length === 0) {
    if (isInCheck(state.board, forColor)) return -99999 + (BOT_SEARCH_DEPTH - depth); // Checkmate (prefer faster mates)
    return 0; // Stalemate
  }

  // Move ordering: captures & promotions first, then by heuristic
  moves.sort((a, b) => botOrderScore(state, b, forColor) - botOrderScore(state, a, forColor));

  for (const m of moves) {
    const snap = snapshot(state.board);
    const piece = state.board[m.from.r][m.from.c];
    const moveInfo = { r: m.to.r, c: m.to.c, capture: m.move.capture, castle: m.move.castle, enPassant: m.move.enPassant };
    applyMoveRaw(state.board, m.from.r, m.from.c, moveInfo, state);
    if (piece && piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
      state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, forColor);
    }

    const score = -botNegamax(state, depth - 1, -beta, -alpha, opp);
    restore(state.board, snap);

    if (score >= beta) return beta; // Beta cutoff
    if (score > alpha) alpha = score;
  }

  return alpha;
}

// Quiescence search: only evaluate captures to avoid horizon effect
function botQuiesce(state, alpha, beta, forColor) {
  const standPat = botEvaluate(state, forColor);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  // Generate only captures
  const opp = opposite(forColor);
  const moves = allLegalMoves(state.board, forColor, state);
  const captures = moves.filter(m => m.move.capture);

  // Sort captures by MVV-LVA
  captures.sort((a, b) => {
    const aVal = state.board[a.to.r][a.to.c] ? BOT_PIECE_VALUES[state.board[a.to.r][a.to.c].type] : 0;
    const bVal = state.board[b.to.r][b.to.c] ? BOT_PIECE_VALUES[state.board[b.to.r][b.to.c].type] : 0;
    return bVal - aVal;
  });

  // Only look at top captures (limit for speed)
  const topCaptures = captures.slice(0, 5);

  for (const m of topCaptures) {
    const snap = snapshot(state.board);
    const piece = state.board[m.from.r][m.from.c];
    const moveInfo = { r: m.to.r, c: m.to.c, capture: true, castle: m.move.castle, enPassant: m.move.enPassant };
    applyMoveRaw(state.board, m.from.r, m.from.c, moveInfo, state);
    if (piece && piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
      state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, forColor);
    }

    const score = -botQuiesce(state, -beta, -alpha, opp);
    restore(state.board, snap);

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

// Root-level search: picks the best move using iterative candidate pruning
function botSearchBestMove(state, moves, forColor) {
  const opp = opposite(forColor);

  // Quick-score all moves for ordering
  const scored = moves.map(m => ({ m, s: botOrderScore(state, m, forColor) }));
  scored.sort((a, b) => b.s - a.s);

  // Only deep-search the top candidates
  const candidates = scored.slice(0, Math.min(BOT_ROOT_CANDIDATES, scored.length));

  let bestMove = candidates[0].m;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const { m } of candidates) {
    const snap = snapshot(state.board);
    const piece = state.board[m.from.r][m.from.c];
    const moveInfo = { r: m.to.r, c: m.to.c, capture: m.move.capture, castle: m.move.castle, enPassant: m.move.enPassant };
    applyMoveRaw(state.board, m.from.r, m.from.c, moveInfo, state);
    if (piece && piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
      state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, forColor);
    }

    // 2-ply: evaluate from opponent's perspective (negated)
    let score = -botNegamax(state, BOT_SEARCH_DEPTH - 1, -beta, -alpha, opp);
    restore(state.board, snap);

    // Repetition penalty: heavily discourage repeating the same move
    const repeats = botMoveRepeatCount(m.from, m.to);
    if (repeats > 0) score -= repeats * 150;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (score > alpha) alpha = score;
  }

  return bestMove;
}

// ---------- Power Decision ----------
// Returns an action object { type: 'power', exec: fn } or null
function botConsiderPowers(state, forColor) {
  if (state.aetherBlocked[forColor]) return null;
  const aether = state.mana[forColor];
  const opp = opposite(forColor);
  const phase = botGamePhase(state);
  const candidates = [];

  // VENGEANCE: Destroy the most valuable enemy piece — TOP PRIORITY in endgame
  // This is the most impactful power for converting advantage into checkmate.
  if (aether >= POWER_COSTS[POWER.VENGEANCE]) {
    let bestTarget = null, bestVal = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color === forColor || p.type === PIECE.KING) continue;
      if (p.isSpectral) continue;
      const val = BOT_PIECE_VALUES[p.type];
      if (val > bestVal) { bestVal = val; bestTarget = { r, c }; }
    }
    // In endgame, use on ANY piece (even knights/pawns) to strip defenses.
    // In middlegame, only on rook or better.
    const threshold = phase < 0.5 ? 100 : 500;
    if (bestTarget && bestVal >= threshold) {
      // Higher priority in endgame to finish the game
      const prio = phase < 0.5 ? bestVal * 0.25 : bestVal * 0.12;
      candidates.push({
        priority: prio,
        exec: () => castVengeance(state, bestTarget.r, bestTarget.c),
        name: 'VENGEANCE',
        payload: { power: 'VENGEANCE', r: bestTarget.r, c: bestTarget.c }
      });
    }
  }

  // PROMOTE: If we have a pawn, promote it — very high priority
  if (aether >= POWER_COSTS[POWER.PROMOTE]) {
    let bestPawn = null, bestDist = 99;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.color === forColor && p.type === PIECE.PAWN && !p.isSpectral) {
        const distToPromo = forColor === COLOR.WHITE ? r : (7 - r);
        if (distToPromo < bestDist) { bestDist = distToPromo; bestPawn = { r, c }; }
      }
    }
    if (bestPawn) {
      // Priority increases sharply with closeness to promotion and in endgame
      const basePrio = 80 + (7 - bestDist) * 15;
      const prio = phase < 0.5 ? basePrio * 1.5 : basePrio;
      candidates.push({
        priority: prio,
        exec: () => castPromote(state, bestPawn.r, bestPawn.c, PIECE.QUEEN),
        name: 'PROMOTE',
        payload: { power: 'PROMOTE', r: bestPawn.r, c: bestPawn.c, newType: PIECE.QUEEN }
      });
    }
  }

  // FROST: Freeze opponent's most valuable unshielded piece
  if (aether >= POWER_COSTS[POWER.FROST] && !isInCheck(state.board, forColor)) {
    let bestTarget = null, bestVal = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color === forColor || p.type === PIECE.KING || p.isSpectral) continue;
      if (p.imprisoned) continue;
      if (p.frozenUntil && p.frozenUntil > state.turnNumber) continue;
      const val = BOT_PIECE_VALUES[p.type];
      if (val > bestVal) { bestVal = val; bestTarget = { r, c }; }
    }
    // In endgame, freeze any piece to limit defenders. In middlegame, only knights+.
    const threshold = phase < 0.5 ? 100 : 320;
    if (bestTarget && bestVal >= threshold) {
      candidates.push({
        priority: bestVal * 0.1,
        exec: () => castFrost(state, bestTarget.r, bestTarget.c),
        name: 'FROST',
        payload: { power: 'FROST', r: bestTarget.r, c: bestTarget.c }
      });
    }
  }

  // FORTIFY: Shield our most valuable unshielded piece that's under threat
  if (aether >= POWER_COSTS[POWER.FORTIFY] && !isInCheck(state.board, forColor)) {
    let bestPiece = null, bestVal = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
      if (p.imprisoned || p.shieldHP > 0) continue;
      if (isSquareAttacked(state.board, r, c, opp)) {
        const val = BOT_PIECE_VALUES[p.type];
        if (val > bestVal) { bestVal = val; bestPiece = { r, c }; }
      }
    }
    if (bestPiece && bestVal >= 300) {
      candidates.push({
        priority: bestVal * 0.08,
        exec: () => castFortify(state, bestPiece.r, bestPiece.c),
        name: 'FORTIFY',
        payload: { power: 'FORTIFY', r: bestPiece.r, c: bestPiece.c }
      });
    }
  }

  // BLINK: Blink a piece to escape or to attack (more aggressive in endgame)
  if (aether >= POWER_COSTS[POWER.BLINK]) {
    let bestBlink = null, bestBlinkScore = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
      if (p.imprisoned || (p.frozenUntil && p.frozenUntil > state.turnNumber)) continue;
      const isAttacked = isSquareAttacked(state.board, r, c, opp);
      // In endgame: also blink pieces into attacking positions (not just escape)
      if (!isAttacked && phase > 0.5) continue;
      const top = Math.max(0, Math.min(r - 1, 5));
      const left = Math.max(0, Math.min(c - 1, 5));
      for (let nr = top; nr < top + 3; nr++) for (let nc = left; nc < left + 3; nc++) {
        if (nr === r && nc === c) continue;
        if (state.board[nr][nc]) continue;
        let blinkScore = 0;
        if (isAttacked) {
          blinkScore = BOT_PIECE_VALUES[p.type] * 0.3; // escape value
        }
        // In endgame: bonus for blinking closer to enemy king
        if (phase < 0.5) {
          const oppKing = findKing(state.board, opp);
          if (oppKing) {
            const distBefore = botManhattan(r, c, oppKing.r, oppKing.c);
            const distAfter = botManhattan(nr, nc, oppKing.r, oppKing.c);
            if (distAfter < distBefore) blinkScore += (distBefore - distAfter) * 30;
          }
        }
        if (blinkScore > bestBlinkScore) {
          bestBlinkScore = blinkScore;
          bestBlink = { fromR: r, fromC: c, toR: nr, toC: nc };
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

  // AETHER BLOCK: Only when opponent is close to Vengeance/Promote
  if (aether >= POWER_COSTS[POWER.AETHER_BLOCK] && !state.aetherBlocked[opp] && !isInCheck(state.board, forColor)) {
    // Only block if opponent could cast Vengeance or Promote soon
    const oppThreshold = POWER_COSTS[POWER.PROMOTE] - 3; // at least 12 aether
    if (state.mana[opp] >= oppThreshold) {
      candidates.push({
        priority: phase < 0.5 ? 25 : 35, // lower in endgame (our powers matter more)
        exec: () => castAetherBlock(state),
        name: 'AETHER_BLOCK',
        payload: { power: 'AETHER_BLOCK' }
      });
    }
  }

  // BOMBA: Plant a bomb near enemy piece concentrations
  if (aether >= POWER_COSTS[POWER.BOMBA] && !isInCheck(state.board, forColor)) {
    let bestBomba = null, bestBombaScore = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (state.board[r][c]) continue;
      if (!validBombaTarget(state, forColor, r, c)) continue;
      let blastVal = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const p = state.board[nr][nc];
        if (p && p.color === opp && p.type !== PIECE.KING && p.shieldHP <= 0) {
          blastVal += BOT_PIECE_VALUES[p.type];
        }
      }
      if (blastVal > bestBombaScore) {
        bestBombaScore = blastVal;
        bestBomba = { r, c };
      }
    }
    if (bestBomba && bestBombaScore >= 200) {
      candidates.push({
        priority: bestBombaScore * 0.06,
        exec: () => castBomba(state, bestBomba.r, bestBomba.c),
        name: 'BOMBA',
        payload: { power: 'BOMBA', r: bestBomba.r, c: bestBomba.c }
      });
    }
  }

  // IMPRISON: Capture an adjacent high-value enemy piece
  if (aether >= POWER_COSTS[POWER.IMPRISON] && !isInCheck(state.board, forColor)) {
    let bestImprison = null, bestImpVal = 0;
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
        const val = BOT_PIECE_VALUES[captive.type];
        if (val > bestImpVal) {
          bestImpVal = val;
          bestImprison = { captorR: r, captorC: c, captiveR: nr, captiveC: nc };
        }
      }
    }
    if (bestImprison && bestImpVal >= 300) {
      candidates.push({
        priority: bestImpVal * 0.09,
        exec: () => castImprison(state, bestImprison.captorR, bestImprison.captorC, bestImprison.captiveR, bestImprison.captiveC),
        name: 'IMPRISON',
        payload: { power: 'IMPRISON', captor: { r: bestImprison.captorR, c: bestImprison.captorC }, captive: { r: bestImprison.captiveR, c: bestImprison.captiveC } }
      });
    }
  }

  // WALL: Defensive — use if our king area is exposed (simplified heuristic)
  if (aether >= POWER_COSTS[POWER.WALL]) {
    const kingPos = findKing(state.board, forColor);
    if (kingPos && isInCheck(state.board, forColor)) {
      // Find a piece adjacent to king that could anchor The Wall
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = kingPos.r + dr, nc = kingPos.c + dc;
        if (!inBounds(nr, nc)) continue;
        const p = state.board[nr][nc];
        if (p && p.color === forColor && p.type !== PIECE.KING) {
          candidates.push({
            priority: 45,
            exec: () => castWall(state, nr, nc),
            name: 'WALL',
            payload: { power: 'WALL', r: nr, c: nc }
          });
          break;
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Sort by priority, pick the best (or random for easy)
  candidates.sort((a, b) => b.priority - a.priority);

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

  // Hard: use powers strategically
  const best = candidates[0];
  if (best.priority < 15) return null;

  // CRITICAL: Don't waste aether on cheap powers when we should save for game-changers.
  // FROST costs 4 but VENGEANCE costs 18 — casting 4-5 Frosts starves Vengeance.
  // Only allow cheap powers if:
  //   (a) We already have enough for Vengeance/Promote, OR
  //   (b) We're at very low aether (< 8) so saving wouldn't reach big powers soon anyway, OR
  //   (c) The power IS Vengeance/Promote
  const aetherNow = state.mana[forColor];
  const canAffordVengeance = aetherNow >= POWER_COSTS[POWER.VENGEANCE];
  const canAffordPromote = aetherNow >= POWER_COSTS[POWER.PROMOTE];
  const isBigPower = best.name === 'VENGEANCE' || best.name === 'PROMOTE';

  if (!isBigPower && !canAffordVengeance && !canAffordPromote) {
    // We can't afford game-changers yet. Only use cheap powers if aether is very low
    // (meaning we're far from affording anyway) or if it's high-value Fortify on queen
    if (aetherNow >= 8) return null; // Save aether — we're getting close to Promote range
  }
  return best;
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
// Tries powers that can resolve a check situation: Blink to block, Vengeance to destroy attacker
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

  // Try VENGEANCE: destroy the attacker
  if (aether >= POWER_COSTS[POWER.VENGEANCE] && attackers.length > 0) {
    // Destroy the most valuable attacker
    let best = attackers[0];
    for (const a of attackers) {
      if (BOT_PIECE_VALUES[a.piece.type] > BOT_PIECE_VALUES[best.piece.type]) best = a;
    }
    if (best.piece.type !== PIECE.KING) {
      const res = castVengeance(state, best.r, best.c);
      if (res && res.success) {
        return { name: 'VENGEANCE', payload: { power: 'VENGEANCE', r: best.r, c: best.c } };
      }
    }
  }

  // Try BLINK: move a piece to block the check line
  if (aether >= POWER_COSTS[POWER.BLINK] && attackers.length === 1) {
    const attacker = attackers[0];
    // Find squares between attacker and king (for sliding pieces)
    const betweenSquares = [];
    const dr = Math.sign(kingPos.r - attacker.r);
    const dc = Math.sign(kingPos.c - attacker.c);
    if (dr !== 0 || dc !== 0) {
      let r = attacker.r + dr, c = attacker.c + dc;
      while (r !== kingPos.r || c !== kingPos.c) {
        if (inBounds(r, c)) betweenSquares.push({ r, c });
        r += dr; c += dc;
      }
    }

    // Try to blink any own non-king piece to a blocking square
    for (const blockSq of betweenSquares) {
      if (state.board[blockSq.r][blockSq.c]) continue; // must be empty
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
        if (p.imprisoned || (p.frozenUntil && p.frozenUntil > state.turnNumber)) continue;
        // Check if blockSq is in blink range of this piece
        const top = Math.max(0, Math.min(r - 1, 5));
        const left = Math.max(0, Math.min(c - 1, 5));
        if (blockSq.r >= top && blockSq.r < top + 3 && blockSq.c >= left && blockSq.c < left + 3) {
          const res = castBlink(state, r, c, blockSq.r, blockSq.c);
          if (res && res.success) {
            return { name: 'BLINK', payload: { power: 'BLINK', from: { r, c }, to: blockSq } };
          }
        }
      }
    }
  }

  // Try WALL: might help if there's a piece adjacent to king
  if (aether >= POWER_COSTS[POWER.WALL]) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = kingPos.r + dr, nc = kingPos.c + dc;
      if (!inBounds(nr, nc)) continue;
      const p = state.board[nr][nc];
      if (p && p.color === forColor && p.type !== PIECE.KING) {
        const res = castWall(state, nr, nc);
        if (res && res.success) {
          return { name: 'WALL', payload: { power: 'WALL', r: nr, c: nc } };
        }
      }
    }
  }

  return null; // No escape found — checkmate
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
    try {
      botExecuteTurn();
    } catch (e) {
      console.error('[bot] Error during turn:', e);
      // Ensure the loop continues even after an error
      BOT.thinking = false;
      if (typeof render === 'function') render();
      return;
    }
    BOT.thinking = false;
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

  // Phase 2: Consider casting a "continues turn" power (Frost, Fortify, Spawn, Bomba, AetherBlock, Imprison)
  const powerAction = botConsiderPowers(UI.state, color);
  if (powerAction) {
    const res = powerAction.exec();
    if (res && res.success) {
      if (typeof recordAction === 'function') recordAction('POWER_CAST', color, powerAction.payload || { power: powerAction.name });
      setStatus(`Bot cast ${powerAction.name}!`, 'ok');
      render();
      // If the power ended the turn (Blink, Vengeance, Wall, Promote, DoubleAttack), we're done
      if (UI.state.turn !== color) {
        botFinishTurn();
        return;
      }
      // Otherwise the turn continues — fall through to make a chess move
    }
  }

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
    // Hard: 2-ply alpha-beta with quiescence search
    chosenMove = botSearchBestMove(UI.state, moves, color);
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

  const res = makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promoType);
  if (res.error) {
    // Shouldn't happen since we used allLegalMoves, but fallback to random
    console.warn('[bot] Move failed:', res.error, 'trying random fallback');
    const fallback = moves[Math.floor(Math.random() * moves.length)];
    makeMove(UI.state, fallback.from.r, fallback.from.c, fallback.to.r, fallback.to.c, promoType);
    if (typeof recordAction === 'function') recordAction('MOVE', color, { from: fallback.from, to: fallback.to, promotion: promoType });
  } else {
    if (typeof recordAction === 'function') recordAction('MOVE', color, { from: chosenMove.from, to: chosenMove.to, promotion: promoType });
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
  BOT.thinkDelay = difficulty === 'easy' ? 400 : difficulty === 'hard' ? 500 : 600;
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
