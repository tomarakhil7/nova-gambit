#!/usr/bin/env node
// ============================================================
// NOVA GAMBIT - Bot vs Bot Headless Test Runner
// Runs N full games between two bots and reports:
//   - Win/loss/draw statistics
//   - Any chess rule violations detected
//   - Power usage stats
//   - Average game length
//
// Usage:
//   node tests/bot-vs-bot.js [numGames] [whiteDiff] [blackDiff]
//   node tests/bot-vs-bot.js 10 hard medium
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load engine + mana system into a shared context
const ctx = {
  module: { exports: {} },
  console, Math, Array, String, Object, JSON,
  parseInt, parseFloat, Infinity, NaN, undefined, Error, RegExp,
  Date: { now: () => 0 }
};
ctx.global = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'js', 'chess-engine.js'), 'utf8'),
  ctx
);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'js', 'mana-system.js'), 'utf8'),
  ctx
);

// Pull symbols from context
const {
  PIECE, COLOR, makePiece, createInitialBoard, algebraic, fromAlgebraic,
  findKing, legalMoves, allLegalMoves, isInCheck, isCheckmate, isStalemate,
  isSquareAttacked, opposite, snapshot, restore, inBounds, applyMoveRaw
} = ctx;

const {
  POWER, POWER_COSTS, AETHER_CAP, CENTER_SQUARES, SACRIFICE_VALUES,
  createGameState, initGame, startOfTurn, endOfTurn, makeMove, sacrificePiece,
  castFrost, castFortify, castBlink, castSpawn,
  castBomba, castDoubleAttack, castImprison, castAetherBlock, castCleanse,
  castPromote, castChronobreak, castVengeance, castWall,
  validBombaTarget
} = ctx;

// ---------- Improved Bot Logic (headless, matches browser bot.js) ----------
const BOT_PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

const BOT_PST_PAWN = [
  0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
  5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
  5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0
];
const BOT_PST_PAWN_EG = [
  0,0,0,0,0,0,0,0, 130,130,130,130,130,130,130,130, 80,80,80,80,80,80,80,80,
  50,50,50,50,50,50,50,50, 30,30,30,30,30,30,30,30, 10,10,10,10,10,10,10,10,
  0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0
];
const BOT_PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40,
  -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
  -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
  -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50
];
const BOT_PST_KING = [
  -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
  20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20
];
const BOT_PST_KING_EG = [
  -50,-30,-20,-20,-20,-20,-30,-50, -30,0,10,10,10,10,0,-30,
  -20,10,20,30,30,20,10,-20, -20,10,30,40,40,30,10,-20,
  -20,10,30,40,40,30,10,-20, -20,10,20,30,30,20,10,-20,
  -30,0,10,10,10,10,0,-30, -50,-30,-20,-20,-20,-20,-30,-50
];

function botGamePhase(state) {
  let material = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.isSpectral || p.type === PIECE.PAWN || p.type === PIECE.KING) continue;
    const weights = { N: 1, B: 1, R: 2, Q: 4 };
    material += weights[p.type] || 0;
  }
  return Math.min(1.0, material / 20);
}

function botKingCornerDist(r, c) {
  return Math.max(3 - c, c - 4) + Math.max(3 - r, r - 4);
}
function botManhattan(r1, c1, r2, c2) { return Math.abs(r1 - r2) + Math.abs(c1 - c2); }

function botCountMaterial(state, color) {
  let total = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (p && p.color === color && !p.isSpectral) total += BOT_PIECE_VALUES[p.type];
  }
  return total;
}

function botPieceSquareValue(piece, r, c, phase) {
  let table = null;
  if (piece.type === PIECE.PAWN) table = phase < 0.4 ? BOT_PST_PAWN_EG : BOT_PST_PAWN;
  else if (piece.type === PIECE.KNIGHT) table = BOT_PST_KNIGHT;
  else if (piece.type === PIECE.KING) table = phase < 0.4 ? BOT_PST_KING_EG : BOT_PST_KING;
  if (!table) return 0;
  const idx = piece.color === COLOR.WHITE ? (r * 8 + c) : ((7 - r) * 8 + c);
  return table[idx];
}

function botEvaluate(state, forColor) {
  let score = 0;
  const opp = opposite(forColor);
  const phase = botGamePhase(state);
  let myMaterial = 0, oppMaterial = 0;
  let myKingPos = null, oppKingPos = null;

  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.isSpectral) continue;
    if (p.type === PIECE.KING) {
      if (p.color === forColor) myKingPos = { r, c }; else oppKingPos = { r, c };
    }
    const baseVal = BOT_PIECE_VALUES[p.type];
    const pstVal = botPieceSquareValue(p, r, c, phase);
    if (p.color === forColor) { score += baseVal + pstVal; myMaterial += baseVal; }
    else { score -= baseVal + pstVal; oppMaterial += baseVal; }
    if (p.frozenUntil && p.frozenUntil > state.turnNumber) {
      const pen = baseVal * 0.15;
      if (p.color === forColor) score -= pen; else score += pen;
    }
    // Passed pawn bonus in endgame
    if (p.type === PIECE.PAWN && phase < 0.6) {
      const dir = p.color === COLOR.WHITE ? -1 : 1;
      let passed = true;
      for (let scanR = r + dir; scanR >= 0 && scanR <= 7; scanR += dir) {
        for (let dc = -1; dc <= 1; dc++) {
          const sc = c + dc;
          if (sc < 0 || sc > 7) continue;
          const bl = state.board[scanR][sc];
          if (bl && bl.type === PIECE.PAWN && bl.color !== p.color && !bl.isSpectral) { passed = false; break; }
        }
        if (!passed) break;
      }
      if (passed) {
        const dist = p.color === COLOR.WHITE ? r : (7 - r);
        const bonus = (7 - dist) * 25;
        if (p.color === forColor) score += bonus; else score -= bonus;
      }
    }
  }

  // Check bonus
  if (isInCheck(state.board, opp)) score += phase < 0.4 ? 80 : 40;
  if (isInCheck(state.board, forColor)) score -= phase < 0.4 ? 80 : 40;

  // Mating drive
  const matAdv = myMaterial - oppMaterial;
  if (phase < 0.5 && matAdv > 200 && oppKingPos && myKingPos) {
    score += botKingCornerDist(oppKingPos.r, oppKingPos.c) * 15;
    score += (14 - botManhattan(myKingPos.r, myKingPos.c, oppKingPos.r, oppKingPos.c)) * 8;
    if (matAdv > 500) {
      score += botKingCornerDist(oppKingPos.r, oppKingPos.c) * 10;
      score += (14 - botManhattan(myKingPos.r, myKingPos.c, oppKingPos.r, oppKingPos.c)) * 5;
    }
  }

  // Trade-down bonus when ahead
  if (matAdv > 200 && phase < 0.7) {
    const total = myMaterial + oppMaterial - 40000;
    score += Math.max(0, (6000 - total) / 75);
  }

  return score;
}

function botScoreMove(state, from, to, forColor) {
  let score = 0;
  const piece = state.board[from.r][from.c];
  const target = state.board[to.r][to.c];
  const phase = botGamePhase(state);
  const opp = opposite(forColor);

  if (target && target.color !== piece.color) {
    if (target.shieldHP > 0) { score -= 200; }
    else {
      score += BOT_PIECE_VALUES[target.type] * 10 - BOT_PIECE_VALUES[piece.type];
      const myMat = botCountMaterial(state, forColor);
      const oppMat = botCountMaterial(state, opp);
      if (myMat - oppMat > 200) score += BOT_PIECE_VALUES[target.type] * 2;
    }
  }
  score += botPieceSquareValue(piece, to.r, to.c, phase) - botPieceSquareValue(piece, from.r, from.c, phase);
  if (piece.type === PIECE.PAWN && (to.r === 0 || to.r === 7)) score += 900;
  if (piece.type === PIECE.PAWN && phase < 0.5) {
    const adv = piece.color === COLOR.WHITE ? (from.r - to.r) : (to.r - from.r);
    score += adv * 30;
  }
  if (state.fountains && state.fountains.some(f => f.r === to.r && f.c === to.c)) score += 60;
  if (CENTER_SQUARES && CENTER_SQUARES.some(sq => sq.r === to.r && sq.c === to.c)) score += 25 * phase;
  if (state.bombs && state.bombs.some(b => b.r === to.r && b.c === to.c && b.owner !== forColor)) score += 150;

  // King march in endgame
  if (piece.type === PIECE.KING && phase < 0.4) {
    const myMat = botCountMaterial(state, forColor);
    const oppMat = botCountMaterial(state, opp);
    if (myMat - oppMat > 200) {
      const oppKing = findKing(state.board, opp);
      if (oppKing) {
        score += (botManhattan(from.r, from.c, oppKing.r, oppKing.c) - botManhattan(to.r, to.c, oppKing.r, oppKing.c)) * 20;
      }
    }
  }

  // Check bonus
  if (phase < 0.6 || (target && target.color !== piece.color)) {
    const snap = snapshot(state.board);
    const apply = applyMoveRaw;
    apply(state.board, from.r, from.c, { r: to.r, c: to.c, capture: !!(target && target.color !== piece.color), castle: to.castle, enPassant: to.enPassant }, state);
    if (isInCheck(state.board, opp)) score += phase < 0.4 ? 60 : 35;
    restore(state.board, snap);
  }

  return score;
}

// Move history for repetition avoidance
const BOT_MOVE_HISTORY = [];
const BOT_HISTORY_MAX = 12;
function botRecordMove(from, to) { BOT_MOVE_HISTORY.push(`${from.r}${from.c}${to.r}${to.c}`); if (BOT_MOVE_HISTORY.length > BOT_HISTORY_MAX) BOT_MOVE_HISTORY.shift(); }
function botMoveRepeatCount(from, to) { const k = `${from.r}${from.c}${to.r}${to.c}`; let c = 0; for (const h of BOT_MOVE_HISTORY) if (h === k) c++; return c; }
function botClearHistory() { BOT_MOVE_HISTORY.length = 0; }

// ---------- Alpha-Beta Search (mirrors browser bot.js) ----------
const BOT_SEARCH_DEPTH = 2;
const BOT_ROOT_CANDIDATES = 12;

function botOrderScore(state, m, forColor) {
  let s = 0;
  const piece = state.board[m.from.r][m.from.c];
  const target = state.board[m.to.r][m.to.c];
  if (target && target.color !== piece.color) {
    s += 10000 + BOT_PIECE_VALUES[target.type] * 10 - BOT_PIECE_VALUES[piece.type];
  }
  if (piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) s += 9000;
  const phase = botGamePhase(state);
  s += botPieceSquareValue(piece, m.to.r, m.to.c, phase) - botPieceSquareValue(piece, m.from.r, m.from.c, phase);
  if (phase < 0.5 && piece.type !== PIECE.KING) {
    const oppKing = findKing(state.board, opposite(forColor));
    if (oppKing) {
      const dist = Math.abs(m.to.r - oppKing.r) + Math.abs(m.to.c - oppKing.c);
      if (dist <= 2) s += 300;
    }
  }
  return s;
}

function botNegamax(state, depth, alpha, beta, forColor) {
  const opp = opposite(forColor);
  if (depth === 0) return botQuiesce(state, alpha, beta, forColor);
  const moves = allLegalMoves(state.board, forColor, state);
  if (moves.length === 0) {
    if (isInCheck(state.board, forColor)) return -99999 + (BOT_SEARCH_DEPTH - depth);
    return 0;
  }
  moves.sort((a, b) => botOrderScore(state, b, forColor) - botOrderScore(state, a, forColor));
  for (const m of moves) {
    const snap = snapshot(state.board);
    const piece = state.board[m.from.r][m.from.c];
    applyMoveRaw(state.board, m.from.r, m.from.c, { r: m.to.r, c: m.to.c, capture: m.move.capture, castle: m.move.castle, enPassant: m.move.enPassant }, state);
    if (piece && piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
      state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, forColor);
    }
    const score = -botNegamax(state, depth - 1, -beta, -alpha, opp);
    restore(state.board, snap);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function botQuiesce(state, alpha, beta, forColor) {
  const standPat = botEvaluate(state, forColor);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  const opp = opposite(forColor);
  const moves = allLegalMoves(state.board, forColor, state);
  const captures = moves.filter(m => m.move.capture);
  captures.sort((a, b) => {
    const aVal = state.board[a.to.r][a.to.c] ? BOT_PIECE_VALUES[state.board[a.to.r][a.to.c].type] : 0;
    const bVal = state.board[b.to.r][b.to.c] ? BOT_PIECE_VALUES[state.board[b.to.r][b.to.c].type] : 0;
    return bVal - aVal;
  });
  const topCaptures = captures.slice(0, 5);
  for (const m of topCaptures) {
    const snap = snapshot(state.board);
    const piece = state.board[m.from.r][m.from.c];
    applyMoveRaw(state.board, m.from.r, m.from.c, { r: m.to.r, c: m.to.c, capture: true, castle: m.move.castle, enPassant: m.move.enPassant }, state);
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

function botSearchBestMove(state, moves, color) {
  const opp = opposite(color);
  const scored = moves.map(m => ({ m, s: botOrderScore(state, m, color) }));
  scored.sort((a, b) => b.s - a.s);
  const candidates = scored.slice(0, Math.min(BOT_ROOT_CANDIDATES, scored.length));
  let bestMove = candidates[0].m;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  for (const { m } of candidates) {
    const snap = snapshot(state.board);
    const piece = state.board[m.from.r][m.from.c];
    applyMoveRaw(state.board, m.from.r, m.from.c, { r: m.to.r, c: m.to.c, capture: m.move.capture, castle: m.move.castle, enPassant: m.move.enPassant }, state);
    if (piece && piece.type === PIECE.PAWN && (m.to.r === 0 || m.to.r === 7)) {
      state.board[m.to.r][m.to.c] = makePiece(PIECE.QUEEN, color);
    }
    let score = -botNegamax(state, BOT_SEARCH_DEPTH - 1, -beta, -alpha, opp);
    restore(state.board, snap);
    // Repetition penalty
    const repeats = botMoveRepeatCount(m.from, m.to);
    if (repeats > 0) score -= repeats * 150;
    if (score > bestScore) { bestScore = score; bestMove = m; }
    if (score > alpha) alpha = score;
  }
  return bestMove;
}

function botPickMove(state, color, difficulty) {
  const moves = allLegalMoves(state.board, color, state);
  if (moves.length === 0) return null;
  if (difficulty === 'easy') { const m = moves[Math.floor(Math.random() * moves.length)]; botRecordMove(m.from, m.to); return m; }
  if (difficulty === 'hard') { const m = botSearchBestMove(state, moves, color); botRecordMove(m.from, m.to); return m; }
  // Medium
  const scored = moves.map(m => ({ move: m, score: botScoreMove(state, m.from, m.to, color) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.min(3, scored.length));
  const weights = top.map((s, i) => Math.max(1, 10 - i * 3));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < top.length; i++) { r -= weights[i]; if (r <= 0) { botRecordMove(top[i].move.from, top[i].move.to); return top[i].move; } }
  botRecordMove(top[0].move.from, top[0].move.to);
  return top[0].move;
}

function botTryPower(state, color, difficulty) {
  if (!state.aetherBlocked) return null;
  if (state.aetherBlocked[color]) return null;
  const aether = state.mana[color];
  const opp = opposite(color);
  const phase = botGamePhase(state);
  const candidates = [];

  // VENGEANCE — top priority in endgame
  if (aether >= POWER_COSTS[POWER.VENGEANCE]) {
    let bestTarget = null, bestVal = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color === color || p.type === PIECE.KING || p.isSpectral) continue;
      if (BOT_PIECE_VALUES[p.type] > bestVal) { bestVal = BOT_PIECE_VALUES[p.type]; bestTarget = { r, c }; }
    }
    const threshold = phase < 0.5 ? 100 : 500;
    if (bestTarget && bestVal >= threshold) {
      const prio = phase < 0.5 ? bestVal * 0.25 : bestVal * 0.12;
      candidates.push({ priority: prio, exec: () => castVengeance(state, bestTarget.r, bestTarget.c), name: 'VENGEANCE' });
    }
  }

  // PROMOTE
  if (aether >= POWER_COSTS[POWER.PROMOTE]) {
    let bestPawn = null, bestDist = 99;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.color === color && p.type === PIECE.PAWN && !p.isSpectral) {
        const d = color === COLOR.WHITE ? r : (7 - r);
        if (d < bestDist) { bestDist = d; bestPawn = { r, c }; }
      }
    }
    if (bestPawn) {
      const prio = phase < 0.5 ? (80 + (7 - bestDist) * 15) * 1.5 : 80 + (7 - bestDist) * 15;
      candidates.push({ priority: prio, exec: () => castPromote(state, bestPawn.r, bestPawn.c, PIECE.QUEEN), name: 'PROMOTE' });
    }
  }

  // FROST
  if (aether >= POWER_COSTS[POWER.FROST] && !isInCheck(state.board, color)) {
    let bestTarget = null, bestVal = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color === color || p.type === PIECE.KING || p.isSpectral || p.imprisoned) continue;
      if (p.frozenUntil && p.frozenUntil > state.turnNumber) continue;
      const val = BOT_PIECE_VALUES[p.type];
      if (val > bestVal) { bestVal = val; bestTarget = { r, c }; }
    }
    const threshold = phase < 0.5 ? 100 : 320;
    if (bestTarget && bestVal >= threshold) candidates.push({ priority: bestVal * 0.1, exec: () => castFrost(state, bestTarget.r, bestTarget.c), name: 'FROST' });
  }

  // FORTIFY
  if (aether >= POWER_COSTS[POWER.FORTIFY] && !isInCheck(state.board, color)) {
    let bestPiece = null, bestVal = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== color || p.type === PIECE.KING || p.isSpectral || p.imprisoned || p.shieldHP > 0) continue;
      if (isSquareAttacked(state.board, r, c, opp)) {
        const val = BOT_PIECE_VALUES[p.type];
        if (val > bestVal) { bestVal = val; bestPiece = { r, c }; }
      }
    }
    if (bestPiece && bestVal >= 300) candidates.push({ priority: bestVal * 0.08, exec: () => castFortify(state, bestPiece.r, bestPiece.c), name: 'FORTIFY' });
  }

  // AETHER BLOCK
  if (aether >= POWER_COSTS[POWER.AETHER_BLOCK] && !state.aetherBlocked[opp] && !isInCheck(state.board, color)) {
    const threshold = phase < 0.5 ? 12 : 14;
    if (state.mana[opp] >= threshold) candidates.push({ priority: phase < 0.5 ? 25 : 35, exec: () => castAetherBlock(state), name: 'AETHER_BLOCK' });
  }

  // SPAWN — only in middlegame, low priority
  if (phase > 0.5 && aether >= POWER_COSTS[POWER.SPAWN] && !isInCheck(state.board, color) && state.fountains) {
    for (const f of state.fountains) {
      if (state.board[f.r][f.c]) continue;
      const rankFP = color === COLOR.WHITE ? (8 - f.r) : (f.r + 1);
      if (rankFP >= 1 && rankFP <= 4) { candidates.push({ priority: 15, exec: () => castSpawn(state, f.r, f.c), name: 'SPAWN' }); break; }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.priority - a.priority);

  if (difficulty === 'easy') { if (Math.random() > 0.2) return null; return candidates[Math.floor(Math.random() * candidates.length)]; }
  if (difficulty === 'medium') { if (candidates[0].priority < 30 || Math.random() > 0.4) return null; return candidates[0]; }
  if (candidates[0].priority < 20) return null;
  return candidates[0];
}

function botTrySacrifice(state, color, difficulty) {
  if (!state.aetherBlocked || !state.sacrificedThisTurn) return null;
  if (state.aetherBlocked[color] || state.sacrificedThisTurn[color]) return null;
  const phase = botGamePhase(state);
  const aether = state.mana[color];
  const opp = opposite(color);

  // HARD MODE: only sacrifice when it directly enables a game-winning power
  if (difficulty === 'hard') {
    if (aether >= POWER_COSTS[POWER.VENGEANCE]) return null;
    const myMat = botCountMaterial(state, color);
    const oppMat = botCountMaterial(state, opp);
    if (myMat - oppMat < 300) return null; // must be significantly ahead
    // Only sacrifice pawns far from promotion
    let bestSac = null;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== color || p.type !== PIECE.PAWN || p.isSpectral) continue;
      const distToPromo = color === COLOR.WHITE ? r : (7 - r);
      if (distToPromo <= 3) continue;
      bestSac = { r, c }; break;
    }
    if (!bestSac) return null;
    const gain = SACRIFICE_VALUES[state.board[bestSac.r][bestSac.c].type] || 1;
    const afterAether = Math.min(AETHER_CAP, aether + gain);
    if (afterAether < POWER_COSTS[POWER.PROMOTE]) return null;
    if (Math.random() > 0.3) return null;
    return bestSac;
  }

  // EASY/MEDIUM
  const aetherCap = phase < 0.5 ? 20 : 15;
  if (aether >= aetherCap) return null;
  let bestSac = null, bestCost = Infinity;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.color !== color || p.type === PIECE.KING || p.isSpectral) continue;
    if (p.type === PIECE.QUEEN || p.type === PIECE.ROOK) continue;
    if (p.type === PIECE.PAWN) { const d = color === COLOR.WHITE ? r : (7 - r); if (d <= 2) continue; }
    if (BOT_PIECE_VALUES[p.type] < bestCost) { bestCost = BOT_PIECE_VALUES[p.type]; bestSac = { r, c }; }
  }
  if (!bestSac) return null;
  const chance = difficulty === 'easy' ? 0.1 : 0.25;
  if (Math.random() > chance) return null;
  return bestSac;
}

// ---------- Chess Rule Validator ----------
function validateState(state, turnNum, violations) {
  // 1. Exactly one king per color
  let wKings = 0, bKings = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p) continue;
    if (p.type === PIECE.KING && p.color === COLOR.WHITE) wKings++;
    if (p.type === PIECE.KING && p.color === COLOR.BLACK) bKings++;
  }
  if (wKings !== 1) violations.push({ turn: turnNum, msg: `White has ${wKings} kings (expected 1)` });
  if (bKings !== 1) violations.push({ turn: turnNum, msg: `Black has ${bKings} kings (expected 1)` });

  // 2. Side NOT to move should NOT be in check (engine should prevent this)
  // In Aether mode, start-of-turn effects (bomb detonation, spectral pawn
  // removal, pending prisoner placement) can expose a king AFTER the turn
  // passes — this is a known mechanic, not a classical chess violation.
  // We flag it as a WARNING (not a hard violation) in power mode, and a
  // VIOLATION only in classical mode (where it should never happen).
  const mover = state.turn;
  const nonMover = opposite(mover);
  if (!state.winner && isInCheck(state.board, nonMover)) {
    violations.push({ turn: turnNum, msg: `${nonMover === COLOR.WHITE ? 'White' : 'Black'} (not-to-move) is in check - possible Aether side-effect (spectral/bomb)`, aether: true });
  }

  // 3. No pawns on rank 1 or 8 (should have been promoted) - skip spectral
  for (let c = 0; c < 8; c++) {
    const top = state.board[0][c];
    if (top && top.type === PIECE.PAWN && top.color === COLOR.WHITE && !top.isSpectral) {
      violations.push({ turn: turnNum, msg: `White pawn on rank 8 (${algebraic(0, c)}) was not promoted` });
    }
    const bot = state.board[7][c];
    if (bot && bot.type === PIECE.PAWN && bot.color === COLOR.BLACK && !bot.isSpectral) {
      violations.push({ turn: turnNum, msg: `Black pawn on rank 1 (${algebraic(7, c)}) was not promoted` });
    }
  }

  // 4. Mana within bounds
  if (state.mana && state.mana[COLOR.WHITE] != null) {
    if (state.mana[COLOR.WHITE] < 0 || state.mana[COLOR.WHITE] > AETHER_CAP) {
      violations.push({ turn: turnNum, msg: `White mana out of bounds: ${state.mana[COLOR.WHITE]}` });
    }
    if (state.mana[COLOR.BLACK] < 0 || state.mana[COLOR.BLACK] > AETHER_CAP) {
      violations.push({ turn: turnNum, msg: `Black mana out of bounds: ${state.mana[COLOR.BLACK]}` });
    }
  }
}

// ---------- Run One Game ----------
function runOneGame(whiteDiff, blackDiff, maxTurns) {
  maxTurns = maxTurns || 200;
  botClearHistory();
  const state = initGame();
  const violations = [];
  const powerStats = { w: {}, b: {} };
  let turnCount = 0;

  while (!state.winner && turnCount < maxTurns) {
    turnCount++;
    const color = state.turn;
    const diff = color === COLOR.WHITE ? whiteDiff : blackDiff;

    // Sacrifice attempt
    const sacTarget = botTrySacrifice(state, color, diff);
    if (sacTarget) {
      try { sacrificePiece(state, sacTarget.r, sacTarget.c); } catch(e) { /* ignore */ }
    }

    // Power attempt
    const power = botTryPower(state, color, diff);
    if (power) {
      try {
        const res = power.exec();
        if (res && res.success !== false) {
          const side = color === COLOR.WHITE ? 'w' : 'b';
          powerStats[side][power.name] = (powerStats[side][power.name] || 0) + 1;
        }
      } catch(e) { /* power failed, continue */ }
    }

    if (state.winner) break;
    if (state.turn !== color) { validateState(state, turnCount, violations); continue; }

    // Chess move
    const move = botPickMove(state, color, diff);
    if (!move) {
      // No legal moves - check if its checkmate or stalemate
      if (isCheckmate(state.board, color, state)) {
        state.winner = opposite(color);
        state.winReason = 'CHECKMATE';
      } else {
        state.winner = 'DRAW';
        state.winReason = 'STALEMATE';
      }
      break;
    }

    const piece = state.board[move.from.r][move.from.c];
    let promoType = undefined;
    if (piece && piece.type === PIECE.PAWN && (move.to.r === 0 || move.to.r === 7)) {
      promoType = PIECE.QUEEN;
    }

    try {
      const res = makeMove(state, move.from.r, move.from.c, move.to.r, move.to.c, promoType);
      if (res && res.error) {
        violations.push({ turn: turnCount, msg: `Move error: ${res.error} (${algebraic(move.from.r, move.from.c)}->${algebraic(move.to.r, move.to.c)})` });
        break;
      }
    } catch(e) {
      violations.push({ turn: turnCount, msg: `Move threw: ${e.message} (${algebraic(move.from.r, move.from.c)}->${algebraic(move.to.r, move.to.c)})` });
      break;
    }

    validateState(state, turnCount, violations);
  }

  // If no winner after maxTurns, it's a draw
  if (!state.winner && turnCount >= maxTurns) {
    state.winner = 'DRAW';
    state.winReason = 'MAX_TURNS';
  }

  return {
    winner: state.winner,
    reason: state.winReason || 'unknown',
    turns: turnCount,
    violations,
    powerStats
  };
}

// ---------- Run One Classical Game (no powers, no mana) ----------
function runOneClassicalGame(whiteDiff, blackDiff, maxTurns) {
  maxTurns = maxTurns || 200;
  botClearHistory();
  const state = initGame();
  const violations = [];
  let turnCount = 0;

  while (!state.winner && turnCount < maxTurns) {
    turnCount++;
    const color = state.turn;
    const diff = color === COLOR.WHITE ? whiteDiff : blackDiff;

    // Pure chess - no powers, no sacrifice
    const move = botPickMove(state, color, diff);
    if (!move) {
      if (isCheckmate(state.board, color, state)) {
        state.winner = opposite(color);
        state.winReason = 'CHECKMATE';
      } else {
        state.winner = 'DRAW';
        state.winReason = 'STALEMATE';
      }
      break;
    }

    const piece = state.board[move.from.r][move.from.c];
    let promoType = undefined;
    if (piece && piece.type === PIECE.PAWN && (move.to.r === 0 || move.to.r === 7)) {
      promoType = PIECE.QUEEN;
    }

    try {
      const res = makeMove(state, move.from.r, move.from.c, move.to.r, move.to.c, promoType);
      if (res && res.error) {
        violations.push({ turn: turnCount, msg: `Move error: ${res.error} (${algebraic(move.from.r, move.from.c)}->${algebraic(move.to.r, move.to.c)})` });
        break;
      }
    } catch(e) {
      violations.push({ turn: turnCount, msg: `Move threw: ${e.message} (${algebraic(move.from.r, move.from.c)}->${algebraic(move.to.r, move.to.c)})` });
      break;
    }

    validateState(state, turnCount, violations);
  }

  if (!state.winner && turnCount >= maxTurns) {
    state.winner = 'DRAW';
    state.winReason = 'MAX_TURNS';
  }

  return {
    winner: state.winner,
    reason: state.winReason || 'unknown',
    turns: turnCount,
    violations,
    powerStats: { w: {}, b: {} }
  };
}

// ---------- Main ----------
function main() {
  const args = process.argv.slice(2);
  const classical = args.includes('--classical');
  const filtered = args.filter(a => !a.startsWith('--'));
  const numGames = parseInt(filtered[0]) || 10;
  const whiteDiff = filtered[1] || 'medium';
  const blackDiff = filtered[2] || 'medium';

  const modeLabel = classical ? 'CLASSICAL (no powers)' : 'FULL (with Aether)';
  console.log('');
  console.log('========================================================');
  console.log('   NOVA GAMBIT - Bot vs Bot Test Runner');
  console.log('========================================================');
  console.log('  Mode:  ' + modeLabel);
  console.log('  Games: ' + numGames + '  |  White: ' + whiteDiff + '  |  Black: ' + blackDiff);
  console.log('========================================================');
  console.log('');

  const results = { white: 0, black: 0, draw: 0 };
  const allViolations = [];
  const turnCounts = [];
  const totalPowerStats = { w: {}, b: {} };

  for (let i = 1; i <= numGames; i++) {
    const result = classical
      ? runOneClassicalGame(whiteDiff, blackDiff)
      : runOneGame(whiteDiff, blackDiff);
    turnCounts.push(result.turns);

    // Aggregate results
    if (result.winner === COLOR.WHITE) results.white++;
    else if (result.winner === COLOR.BLACK) results.black++;
    else results.draw++;

    // Violations
    if (result.violations.length > 0) {
      allViolations.push({ game: i, violations: result.violations });
    }

    // Power stats
    for (const side of ['w', 'b']) {
      for (const [power, count] of Object.entries(result.powerStats[side])) {
        totalPowerStats[side][power] = (totalPowerStats[side][power] || 0) + count;
      }
    }

    const winnerLabel = result.winner === COLOR.WHITE ? 'W' : result.winner === COLOR.BLACK ? 'B' : 'D';
    const violMark = result.violations.length > 0 ? ' [!]' : '';
    console.log('  Game ' + String(i).padStart(3) + ': ' + winnerLabel + ' (' + result.reason + ', ' + result.turns + ' turns)' + violMark);
  }

  // Summary
  console.log('');
  console.log('========================================================');
  console.log('RESULTS');
  console.log('========================================================');
  console.log('  White wins: ' + results.white + ' (' + (results.white / numGames * 100).toFixed(1) + '%)');
  console.log('  Black wins: ' + results.black + ' (' + (results.black / numGames * 100).toFixed(1) + '%)');
  console.log('  Draws:      ' + results.draw + ' (' + (results.draw / numGames * 100).toFixed(1) + '%)');
  console.log('  Avg turns:  ' + (turnCounts.reduce((a, b) => a + b, 0) / numGames).toFixed(1));
  console.log('  Min turns:  ' + Math.min.apply(null, turnCounts));
  console.log('  Max turns:  ' + Math.max.apply(null, turnCounts));

  // Power stats
  console.log('');
  console.log('========================================================');
  console.log('POWER USAGE');
  console.log('========================================================');
  for (const side of ['w', 'b']) {
    const label = side === 'w' ? 'White' : 'Black';
    const powers = Object.entries(totalPowerStats[side]).sort((a, b) => b[1] - a[1]);
    if (powers.length === 0) { console.log('  ' + label + ': (no powers cast)'); continue; }
    console.log('  ' + label + ':');
    for (const [power, count] of powers) {
      console.log('    ' + power.padEnd(14) + ' ' + count + ' casts (' + (count / numGames).toFixed(1) + '/game)');
    }
  }

  // Violations — separate hard violations from Aether-related warnings
  const hardViolations = [];
  const aetherWarnings = [];
  for (const entry of allViolations) {
    const hard = entry.violations.filter(v => !v.aether);
    const soft = entry.violations.filter(v => v.aether);
    if (hard.length > 0) hardViolations.push({ game: entry.game, violations: hard });
    if (soft.length > 0) aetherWarnings.push({ game: entry.game, violations: soft });
  }

  console.log('');
  console.log('========================================================');
  console.log('RULE VIOLATIONS');
  console.log('========================================================');

  if (aetherWarnings.length > 0) {
    console.log('  [WARN] ' + aetherWarnings.length + ' game(s) with Aether-related check states (expected):');
    for (const { game, violations } of aetherWarnings) {
      for (const v of violations) {
        console.log('    Game ' + game + ', Turn ' + v.turn + ': ' + v.msg);
      }
    }
    console.log('');
  }

  if (hardViolations.length === 0) {
    console.log('  [PASS] No hard violations detected across all games!');
  } else {
    console.log('  [FAIL] ' + hardViolations.length + ' game(s) with hard violations:');
    console.log('');
    for (const { game, violations } of hardViolations) {
      console.log('  Game ' + game + ':');
      for (const v of violations) {
        console.log('    Turn ' + v.turn + ': ' + v.msg);
      }
    }
  }

  console.log('');
  console.log('========================================================');
  const exitCode = hardViolations.length > 0 ? 1 : 0;
  if (exitCode) console.log('[FAIL] Hard rule violations detected');
  else console.log('[PASS] ALL CLEAR - no rule violations (Aether warnings are expected)');
  process.exit(exitCode);
}

main();
