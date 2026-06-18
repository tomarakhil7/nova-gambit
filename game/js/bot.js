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

function botPST(type) {
  switch (type) {
    case PIECE.PAWN: return BOT_PST_PAWN;
    case PIECE.KNIGHT: return BOT_PST_KNIGHT;
    case PIECE.BISHOP: return BOT_PST_BISHOP;
    case PIECE.KING: return BOT_PST_KING;
    default: return null; // Rook/Queen use no table (mobility more important)
  }
}

function botPieceSquareValue(piece, r, c) {
  const table = botPST(piece.type);
  if (!table) return 0;
  // Tables are from white's perspective (row 0 = rank 8)
  const idx = piece.color === COLOR.WHITE ? (r * 8 + c) : ((7 - r) * 8 + c);
  return table[idx];
}

// ---------- Board Evaluation ----------
function botEvaluate(state, forColor) {
  let score = 0;
  const opp = opposite(forColor);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      if (p.isSpectral) continue; // don't value spectral pawns highly

      const val = BOT_PIECE_VALUES[p.type] + botPieceSquareValue(p, r, c);
      if (p.color === forColor) {
        score += val;
        // Bonus for shields
        if (p.shieldHP > 0) score += 50;
        // Bonus for holding a prisoner
        if (p.imprisoned) score += BOT_PIECE_VALUES[p.imprisoned.type] * 0.5;
      } else {
        score -= val;
        if (p.shieldHP > 0) score -= 50;
        if (p.imprisoned) score -= BOT_PIECE_VALUES[p.imprisoned.type] * 0.5;
      }

      // Frozen penalty
      if (p.frozenUntil && p.frozenUntil > state.turnNumber) {
        const penalty = BOT_PIECE_VALUES[p.type] * 0.15;
        if (p.color === forColor) score -= penalty;
        else score += penalty;
      }
    }
  }

  // Aether advantage
  score += (state.mana[forColor] - state.mana[opp]) * 8;

  // Center control bonus
  if (controlsCenter(state, forColor)) score += 30;
  if (controlsCenter(state, opp)) score -= 30;

  // Fountain occupation bonus
  score += occupiedFountains(state, forColor) * 25;
  score -= occupiedFountains(state, opp) * 25;

  // Check bonus
  if (isInCheck(state.board, opp)) score += 40;
  if (isInCheck(state.board, forColor)) score -= 40;

  return score;
}

// ---------- Move Scoring ----------
function botScoreMove(state, from, to, forColor) {
  let score = 0;
  const piece = state.board[from.r][from.c];
  const target = state.board[to.r][to.c];

  // Captures scored by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
  if (target && target.color !== piece.color) {
    score += BOT_PIECE_VALUES[target.type] * 10 - BOT_PIECE_VALUES[piece.type];
    // Extra bonus for capturing shielded pieces (won't actually capture, but engine handles)
    if (target.shieldHP > 0) score -= 200; // avoid hitting shields with valuable pieces
  }

  // Positional improvement
  score += botPieceSquareValue(piece, to.r, to.c) - botPieceSquareValue(piece, from.r, from.c);

  // Promotions
  if (piece.type === PIECE.PAWN && (to.r === 0 || to.r === 7)) score += 800;

  // Moving to a fountain
  if (state.fountains.some(f => f.r === to.r && f.c === to.c)) score += 60;

  // Moving to center
  if (CENTER_SQUARES.some(sq => sq.r === to.r && sq.c === to.c)) score += 25;

  // Defusing a bomb
  if (state.bombs.some(b => b.r === to.r && b.c === to.c && b.owner !== forColor)) score += 150;

  return score;
}

// ---------- Power Decision ----------
// Returns an action object { type: 'power', exec: fn } or null
function botConsiderPowers(state, forColor) {
  if (state.aetherBlocked[forColor]) return null;
  const aether = state.mana[forColor];
  const opp = opposite(forColor);
  const candidates = [];

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
    if (bestTarget && bestVal >= 320) { // only freeze knights or better
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
      // Check if this piece is attacked
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

  // BLINK: Blink a piece to a better position (especially escaping attacks)
  if (aether >= POWER_COSTS[POWER.BLINK]) {
    let bestBlink = null, bestBlinkScore = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
      if (p.imprisoned || (p.frozenUntil && p.frozenUntil > state.turnNumber)) continue;
      // If piece is attacked, consider blinking it away
      if (!isSquareAttacked(state.board, r, c, opp)) continue;
      const top = Math.max(0, Math.min(r - 1, 5));
      const left = Math.max(0, Math.min(c - 1, 5));
      for (let nr = top; nr < top + 3; nr++) for (let nc = left; nc < left + 3; nc++) {
        if (nr === r && nc === c) continue;
        if (state.board[nr][nc]) continue;
        const escapeScore = BOT_PIECE_VALUES[p.type] * 0.3;
        if (escapeScore > bestBlinkScore) {
          bestBlinkScore = escapeScore;
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

  // SPAWN: Place a spectral pawn to block an attack or on a fountain
  if (aether >= POWER_COSTS[POWER.SPAWN] && !isInCheck(state.board, forColor)) {
    // Try spawning on a fountain in our half
    for (const f of state.fountains) {
      if (state.board[f.r][f.c]) continue;
      const rankFP = forColor === COLOR.WHITE ? (8 - f.r) : (f.r + 1);
      if (rankFP >= 1 && rankFP <= 4) {
        candidates.push({
          priority: 20,
          exec: () => castSpawn(state, f.r, f.c),
          name: 'SPAWN'
        });
        break;
      }
    }
  }

  // AETHER BLOCK: Use when opponent is aether-rich and we're not already blocking them
  if (aether >= POWER_COSTS[POWER.AETHER_BLOCK] && !state.aetherBlocked[opp] && !isInCheck(state.board, forColor)) {
    if (state.mana[opp] >= 14) { // only block if opponent has a meaningful amount
      candidates.push({
        priority: 35,
        exec: () => castAetherBlock(state),
        name: 'AETHER_BLOCK'
      });
    }
  }

  // VENGEANCE: Destroy the most valuable enemy piece (if we can afford it)
  if (aether >= POWER_COSTS[POWER.VENGEANCE]) {
    let bestTarget = null, bestVal = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color === forColor || p.type === PIECE.KING) continue;
      const val = BOT_PIECE_VALUES[p.type];
      if (val > bestVal) { bestVal = val; bestTarget = { r, c }; }
    }
    if (bestTarget && bestVal >= 500) { // only use on rook or better
      candidates.push({
        priority: bestVal * 0.12,
        exec: () => castVengeance(state, bestTarget.r, bestTarget.c),
        name: 'VENGEANCE'
      });
    }
  }

  // PROMOTE: If we have a pawn, promote it
  if (aether >= POWER_COSTS[POWER.PROMOTE]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.color === forColor && p.type === PIECE.PAWN && !p.isSpectral) {
        // Prefer pawns closer to promotion rank
        const distToPromo = forColor === COLOR.WHITE ? r : (7 - r);
        candidates.push({
          priority: 80 + (7 - distToPromo) * 10,
          exec: () => castPromote(state, r, c, PIECE.QUEEN),
          name: 'PROMOTE'
        });
        break; // one is enough
      }
    }
  }

  // BOMBA: Plant a bomb in front of enemy piece concentrations
  if (aether >= POWER_COSTS[POWER.BOMBA] && !isInCheck(state.board, forColor)) {
    let bestBomba = null, bestBombaScore = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (state.board[r][c]) continue;
      if (!validBombaTarget(state, forColor, r, c)) continue;
      // Count enemy non-King pieces in 3x3 blast radius
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
  // Only sacrifice if we're low on aether and could benefit from a power soon
  if (aether >= 15) return null; // already rich

  // Find the least valuable piece we'd be willing to sacrifice
  let bestSac = null, bestCost = Infinity;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.color !== forColor || p.type === PIECE.KING || p.isSpectral) continue;
    // Don't sacrifice queens or rooks lightly
    if (BOT.difficulty !== 'hard' && (p.type === PIECE.QUEEN || p.type === PIECE.ROOK)) continue;
    const val = BOT_PIECE_VALUES[p.type];
    // Only sacrifice pawns that aren't in great positions
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

  // Heuristic: sacrifice if the aether gain would let us cast something useful soon
  const gain = SACRIFICE_VALUES[state.board[bestSac.r][bestSac.c].type];
  const afterAether = Math.min(AETHER_CAP, aether + gain);

  // Check if any useful power becomes affordable
  const usefulThreshold = BOT.difficulty === 'hard' ? POWER_COSTS[POWER.FROST] : POWER_COSTS[POWER.BLINK];
  if (afterAether < usefulThreshold) return null;

  // Don't sacrifice too eagerly
  const chance = BOT.difficulty === 'easy' ? 0.1 : BOT.difficulty === 'medium' ? 0.25 : 0.4;
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
  } else {
    // Score all moves and pick the best (with some randomness for medium)
    const scored = moves.map(m => ({
      move: m,
      score: botScoreMove(UI.state, m.from, m.to, color)
    }));

    scored.sort((a, b) => b.score - a.score);

    if (BOT.difficulty === 'medium') {
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
    } else {
      // Hard: always pick the best move
      chosenMove = scored[0].move;
    }
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
  // Small extra delay to let the UI update first
  setTimeout(() => botPlay(), 100);
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
  BOT.thinkDelay = speed === 'instant' ? 10 : speed === 'fast' ? 50 : speed === 'slow' ? 1200 : 300;

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
    setTimeout(() => botVsBotNewGame(), BOT.thinkDelay * 3);
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
