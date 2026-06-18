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
  isSquareAttacked, opposite, snapshot, restore, inBounds
} = ctx;

const {
  POWER, POWER_COSTS, AETHER_CAP, CENTER_SQUARES,
  createGameState, initGame, startOfTurn, endOfTurn, makeMove, sacrificePiece,
  castFrost, castFortify, castBlink, castSpawn,
  castBomba, castDoubleAttack, castImprison, castAetherBlock, castCleanse,
  castPromote, castChronobreak, castVengeance, castWall,
  validBombaTarget
} = ctx;

// ---------- Minimal Bot Logic (extracted for headless) ----------
const BOT_PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

const BOT_PST_PAWN = [
  0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
  5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
  5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0
];
const BOT_PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40,
  -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
  -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
  -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50
];

function botPieceSquareValue(piece, r, c) {
  let table = null;
  if (piece.type === PIECE.PAWN) table = BOT_PST_PAWN;
  else if (piece.type === PIECE.KNIGHT) table = BOT_PST_KNIGHT;
  if (!table) return 0;
  const idx = piece.color === COLOR.WHITE ? (r * 8 + c) : ((7 - r) * 8 + c);
  return table[idx];
}

function botScoreMove(state, from, to, forColor) {
  let score = 0;
  const piece = state.board[from.r][from.c];
  const target = state.board[to.r][to.c];
  if (target && target.color !== piece.color) {
    score += BOT_PIECE_VALUES[target.type] * 10 - BOT_PIECE_VALUES[piece.type];
    if (target.shieldHP > 0) score -= 200;
  }
  score += botPieceSquareValue(piece, to.r, to.c) - botPieceSquareValue(piece, from.r, from.c);
  if (piece.type === PIECE.PAWN && (to.r === 0 || to.r === 7)) score += 800;
  if (state.fountains && state.fountains.some(f => f.r === to.r && f.c === to.c)) score += 60;
  if (CENTER_SQUARES && CENTER_SQUARES.some(sq => sq.r === to.r && sq.c === to.c)) score += 25;
  if (state.bombs && state.bombs.some(b => b.r === to.r && b.c === to.c && b.owner !== forColor)) score += 150;
  return score;
}

function botPickMove(state, color, difficulty) {
  const moves = allLegalMoves(state.board, color, state);
  if (moves.length === 0) return null;
  if (difficulty === 'easy') return moves[Math.floor(Math.random() * moves.length)];
  const scored = moves.map(m => ({ move: m, score: botScoreMove(state, m.from, m.to, color) }));
  scored.sort((a, b) => b.score - a.score);
  if (difficulty === 'medium') {
    const top = scored.slice(0, Math.min(3, scored.length));
    const weights = top.map((s, i) => Math.max(1, 10 - i * 3));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;
    for (let i = 0; i < top.length; i++) { r -= weights[i]; if (r <= 0) return top[i].move; }
    return top[0].move;
  }
  return scored[0].move;
}

function botTryPower(state, color, difficulty) {
  if (!state.aetherBlocked) return null;
  if (state.aetherBlocked[color]) return null;
  const aether = state.mana[color];
  const opp = opposite(color);
  const candidates = [];

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
    if (bestTarget && bestVal >= 320) candidates.push({ priority: bestVal * 0.1, exec: () => castFrost(state, bestTarget.r, bestTarget.c), name: 'FROST' });
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
    if (state.mana[opp] >= 14) candidates.push({ priority: 35, exec: () => castAetherBlock(state), name: 'AETHER_BLOCK' });
  }

  // VENGEANCE
  if (aether >= POWER_COSTS[POWER.VENGEANCE]) {
    let bestTarget = null, bestVal = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color === color || p.type === PIECE.KING) continue;
      if (BOT_PIECE_VALUES[p.type] > bestVal) { bestVal = BOT_PIECE_VALUES[p.type]; bestTarget = { r, c }; }
    }
    if (bestTarget && bestVal >= 500) candidates.push({ priority: bestVal * 0.12, exec: () => castVengeance(state, bestTarget.r, bestTarget.c), name: 'VENGEANCE' });
  }

  // SPAWN
  if (aether >= POWER_COSTS[POWER.SPAWN] && !isInCheck(state.board, color) && state.fountains) {
    for (const f of state.fountains) {
      if (state.board[f.r][f.c]) continue;
      const rankFP = color === COLOR.WHITE ? (8 - f.r) : (f.r + 1);
      if (rankFP >= 1 && rankFP <= 4) { candidates.push({ priority: 20, exec: () => castSpawn(state, f.r, f.c), name: 'SPAWN' }); break; }
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
  if (state.mana[color] >= 15) return null;
  let bestSac = null, bestCost = Infinity;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.color !== color || p.type === PIECE.KING || p.isSpectral) continue;
    if (difficulty !== 'hard' && (p.type === PIECE.QUEEN || p.type === PIECE.ROOK)) continue;
    if (p.type === PIECE.PAWN) { const d = color === COLOR.WHITE ? r : (7 - r); if (d <= 2) continue; }
    if (BOT_PIECE_VALUES[p.type] < bestCost) { bestCost = BOT_PIECE_VALUES[p.type]; bestSac = { r, c }; }
  }
  if (!bestSac) return null;
  const chance = difficulty === 'easy' ? 0.1 : difficulty === 'medium' ? 0.25 : 0.4;
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
  const mover = state.turn;
  const nonMover = opposite(mover);
  if (!state.winner && isInCheck(state.board, nonMover)) {
    violations.push({ turn: turnNum, msg: `${nonMover === COLOR.WHITE ? 'White' : 'Black'} (not-to-move) is in check - illegal state` });
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

  // Violations
  console.log('');
  console.log('========================================================');
  console.log('RULE VIOLATIONS (Classical Chess Checks)');
  console.log('========================================================');
  if (allViolations.length === 0) {
    console.log('  [PASS] No violations detected across all games!');
  } else {
    console.log('  [FAIL] ' + allViolations.length + ' game(s) with violations:');
    console.log('');
    for (const { game, violations } of allViolations) {
      console.log('  Game ' + game + ':');
      for (const v of violations) {
        console.log('    Turn ' + v.turn + ': ' + v.msg);
      }
    }
  }

  console.log('');
  console.log('========================================================');
  const exitCode = allViolations.length > 0 ? 1 : 0;
  if (exitCode) console.log('[FAIL] Rule violations detected');
  else console.log('[PASS] ALL CLEAR - no rule violations');
  process.exit(exitCode);
}

main();
