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
    score += shieldPawns * 15;
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

  // CHECK BONUS: moves that give check (very important in endgame)
  // Simulate the move to see if it gives check
  if (phase < 0.6 || (target && target.color !== piece.color)) {
    const snap = snapshot(state.board);
    applyMoveRaw(state.board, from.r, from.c, { r: to.r, c: to.c, capture: !!target, castle: to.castle, enPassant: to.enPassant }, state);
    if (isInCheck(state.board, opp)) score += phase < 0.4 ? 60 : 35;
    restore(state.board, snap);
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

// ---------- 1-Ply Search (Hard mode) ----------
// Evaluates position after each candidate move. Also checks for immediate checkmate.
function botSearchBestMove(state, moves, forColor) {
  const opp = opposite(forColor);
  let bestMove = null, bestScore = -Infinity;

  // First pass: check for instant checkmate (free win)
  for (const m of moves) {
    const snap = snapshot(state.board);
    const piece = state.board[m.from.r][m.from.c];
    const moveInfo = { r: m.to.r, c: m.to.c, capture: m.move.capture, castle: m.move.castle, enPassant: m.move.enPassant };
    applyMoveRaw(state.board, m.from.r, m.from.c, moveInfo, state);

    // Handle pawn promotion in simulation
    if (piece && piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
      state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, forColor);
    }

    if (isCheckmate(state.board, opp, state)) {
      restore(state.board, snap);
      return m; // Instant win!
    }
    restore(state.board, snap);
  }

  // Second pass: evaluate each move (compute move score BEFORE applying)
  for (const m of moves) {
    const moveScore = botScoreMove(state, m.from, m.to, forColor);
    const snap = snapshot(state.board);
    const piece = state.board[m.from.r][m.from.c];
    const moveInfo = { r: m.to.r, c: m.to.c, capture: m.move.capture, castle: m.move.castle, enPassant: m.move.enPassant };
    applyMoveRaw(state.board, m.from.r, m.from.c, moveInfo, state);

    // Handle pawn promotion in simulation
    if (piece && piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
      state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, forColor);
    }

    // Penalize moves that cause stalemate (we want to win, not draw!)
    if (isStalemate(state.board, opp, state)) {
      restore(state.board, snap);
      // Only penalize stalemate if we're ahead in material
      const myMat = botCountMaterial(state, forColor);
      const oppMat = botCountMaterial(state, opp);
      if (myMat > oppMat + 100) {
        // Heavily penalize — stalemate when winning is terrible
        const stalScore = -5000;
        if (stalScore > bestScore) { bestScore = stalScore; bestMove = m; }
        continue;
      }
    }

    // Evaluate the resulting position + move ordering bonus
    let evalScore = botEvaluate(state, forColor) + moveScore * 0.1;

    restore(state.board, snap);

    if (evalScore > bestScore) {
      bestScore = evalScore;
      bestMove = m;
    }
  }

  return bestMove || moves[0];
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
        name: 'VENGEANCE'
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
        name: 'PROMOTE'
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
        name: 'FROST'
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
        name: 'FORTIFY'
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
        name: 'BLINK'
      });
    }
  }

  // SPAWN: Place a spectral pawn — LOW priority, only on fountains (no spam)
  // In endgame, skip Spawn entirely (wastes aether better used for Vengeance/Promote)
  if (phase > 0.5 && aether >= POWER_COSTS[POWER.SPAWN] && !isInCheck(state.board, forColor)) {
    for (const f of state.fountains) {
      if (state.board[f.r][f.c]) continue;
      const rankFP = forColor === COLOR.WHITE ? (8 - f.r) : (f.r + 1);
      if (rankFP >= 1 && rankFP <= 4) {
        candidates.push({
          priority: 15, // lower than before
          exec: () => castSpawn(state, f.r, f.c),
          name: 'SPAWN'
        });
        break;
      }
    }
  }

  // AETHER BLOCK: Use when opponent is aether-rich
  if (aether >= POWER_COSTS[POWER.AETHER_BLOCK] && !state.aetherBlocked[opp] && !isInCheck(state.board, forColor)) {
    // Only block if opponent could cast something dangerous soon
    const oppThreshold = phase < 0.5 ? 12 : 14;
    if (state.mana[opp] >= oppThreshold) {
      candidates.push({
        priority: phase < 0.5 ? 25 : 35, // lower in endgame (our powers matter more)
        exec: () => castAetherBlock(state),
        name: 'AETHER_BLOCK'
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
        name: 'BOMBA'
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
        name: 'IMPRISON'
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
            name: 'WALL'
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

  // Hard: always use the best power if priority is good
  if (candidates[0].priority < 20) return null;
  return candidates[0];
}

// ---------- Sacrifice Decision ----------
function botConsiderSacrifice(state, forColor) {
  if (state.aetherBlocked[forColor]) return null;
  if (state.sacrificedThisTurn[forColor]) return null;

  const aether = state.mana[forColor];
  const phase = botGamePhase(state);

  // In endgame with material advantage, sacrifice more aggressively to fund Vengeance
  const aetherCap = phase < 0.5 ? 20 : 15;
  if (aether >= aetherCap) return null; // already rich enough

  // Find the least valuable piece we'd be willing to sacrifice
  let bestSac = null, bestCost = Infinity;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
    // Don't sacrifice queens or rooks lightly (unless hard+endgame)
    if (BOT.difficulty !== 'hard' && (p.type === PIECE.QUEEN || p.type === PIECE.ROOK)) continue;
    if (BOT.difficulty === 'hard' && phase > 0.5 && p.type === PIECE.QUEEN) continue;
    const val = BOT_PIECE_VALUES[p.type];
    // Only sacrifice pawns that aren't about to promote
    if (p.type === PIECE.PAWN) {
      const distToPromo = forColor === COLOR.WHITE ? r : (7 - r);
      if (distToPromo <= 2) continue; // don't sac advanced pawns
    }
    if (val < bestCost) {
      bestCost = val;
      bestSac = { r, c };
    }
  }

  if (!bestSac) return null;

  // Heuristic: sacrifice if the aether gain would let us cast something useful
  const gain = SACRIFICE_VALUES[state.board[bestSac.r][bestSac.c].type];
  const afterAether = Math.min(AETHER_CAP, aether + gain);

  // In endgame: target Vengeance (18) or Promote (15). In middlegame: Frost (4).
  const usefulThreshold = phase < 0.5
    ? POWER_COSTS[POWER.PROMOTE]  // 15 — aim for Promote or Vengeance
    : (BOT.difficulty === 'hard' ? POWER_COSTS[POWER.FROST] : POWER_COSTS[POWER.BLINK]);
  if (afterAether < usefulThreshold) return null;

  // More willing to sacrifice in endgame when ahead (faster win)
  const myMat = botCountMaterial(state, forColor);
  const oppMat = botCountMaterial(state, opposite(forColor));
  const aheadBonus = (myMat - oppMat > 300 && phase < 0.5) ? 0.3 : 0;

  const chance = BOT.difficulty === 'easy' ? 0.1 : BOT.difficulty === 'medium' ? 0.25 : (0.5 + aheadBonus);
  if (Math.random() > chance) return null;

  return bestSac;
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
    // No legal moves — engine should have caught this in endOfTurn. Shouldn't reach here.
    botFinishTurn();
    return;
  }

  let chosenMove;

  if (BOT.difficulty === 'easy') {
    // Pure random
    chosenMove = moves[Math.floor(Math.random() * moves.length)];
  } else if (BOT.difficulty === 'hard') {
    // Hard: 1-ply minimax — evaluate position AFTER each move
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

  const res = makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promoType);
  if (res.error) {
    // Shouldn't happen since we used allLegalMoves, but fallback to random
    console.warn('[bot] Move failed:', res.error, 'trying random fallback');
    const fallback = moves[Math.floor(Math.random() * moves.length)];
    makeMove(UI.state, fallback.from.r, fallback.from.c, fallback.to.r, fallback.to.c, promoType);
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
  BOT.thinkDelay = difficulty === 'easy' ? 400 : difficulty === 'hard' ? 1000 : 600;
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

  // Re-init game state
  if (typeof UI !== 'undefined' && UI.state) {
    UI.state = initGame();
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
