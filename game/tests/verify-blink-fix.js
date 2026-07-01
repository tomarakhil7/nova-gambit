#!/usr/bin/env node
/**
 * Verification test for BLINK safety fix.
 *
 * Tests:
 * 1. In the exact position from the lost game (Black pawn on d5, queen on d8),
 *    the bot should NOT try to BLINK d5->e6 because it exposes the queen on d8.
 * 2. Two quick Hard vs Medium games complete without crashes.
 */

// Mock browser globals
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} }, appendChild: () => {} }),
  body: { appendChild: () => {} }
};
global.window = global;

// Stub UI and other browser-only functions
global.UI = { state: null, gameActions: [] };
global.setStatus = () => {};
global.render = () => {};
global.floatingText = () => {};
global.recordAction = () => {};

// Load game modules
const fs = require('fs');
const path = require('path');

// Load all three modules as a single combined script so that const/function
// declarations from each are visible to subsequent ones (like in the browser).
const engineCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'chess-engine.js'), 'utf8');
const manaCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'mana-system.js'), 'utf8');
const botCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'bot.js'), 'utf8');

// Clean import/export statements
function clean(code) {
  return code.replace(/export\s+/g, '').replace(/import\s+.*from.*['"];?/g, '');
}

// Combine and wrap in a function that returns the needed globals
const combined = `
${clean(engineCode)}
${clean(manaCode)}
${clean(botCode)}

// Return all needed symbols
module.exports = {
  PIECE, COLOR, makePiece, createInitialBoard, inBounds, algebraic, fromAlgebraic,
  findKing, allLegalMoves, isInCheck, isSquareAttacked, opposite, snapshot, restore,
  getAttackSquares,
  POWER, POWER_COSTS, createGameState, initGame, startOfTurn, endOfTurn, makeMove,
  castBlink, randomFountains,
  BOT, botConsiderPowers, botScoreMove, botPowerSafetyCheck, botSearchBestMove,
  BOT_PIECE_VALUES
};
`;

// Write to temp file and require it (avoids eval scope issues with const)
const tmpFile = path.join(__dirname, '_tmp_verify_blink.js');
fs.writeFileSync(tmpFile, combined);

let mod;
try {
  mod = require(tmpFile);
} finally {
  fs.unlinkSync(tmpFile);
}

const {
  PIECE, COLOR, makePiece, createInitialBoard, inBounds, algebraic, fromAlgebraic,
  findKing, allLegalMoves, isInCheck, isSquareAttacked, opposite, snapshot, restore,
  getAttackSquares,
  POWER, POWER_COSTS, createGameState, initGame, startOfTurn, endOfTurn, makeMove,
  castBlink, randomFountains,
  BOT, botConsiderPowers, botScoreMove, botPowerSafetyCheck, botSearchBestMove,
  BOT_PIECE_VALUES
} = mod;

console.log('Modules loaded successfully!\n');

// ============================================================
// TEST 1: Verify BLINK d5->e6 is NOT chosen in the blunder position
// ============================================================

console.log('='.repeat(60));
console.log('TEST 1: BLINK d5->e6 blunder check');
console.log('='.repeat(60));

// Set up position:
// The game in question had Black with:
//   - Pawns: a7, b7, c7, d5, e5, f7, g7, h7
//   - Knights: c6, g8
//   - Bishops: c8, c5 (dark-sq bishop from f8 captured on c5)
//   - Queen: d8
//   - King: e8
//   - Rooks: a8, h8
// White had:
//   - Pawns: a2, b3, c2, e2, f2, g2, h4
//   - Knights: b1, f3
//   - Bishops: c1, f1
//   - Queen: d1
//   - King: e1
//   - Rooks: a1, h1
// After: White played b3, h4, d4, Blink(d4->c5), Nf3
// After: Black played d5, Nc6, e5, Bxc5

function setupBlunderPosition() {
  const state = createGameState({ fountains: [{r:2, c:1}, {r:3, c:6}, {r:4, c:2}, {r:5, c:5}] });

  // Clear the board
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) state.board[r][c] = null;

  // --- BLACK pieces ---
  state.board[0][0] = makePiece(PIECE.ROOK, COLOR.BLACK, { originFile: 0 });   // Ra8
  state.board[0][2] = makePiece(PIECE.BISHOP, COLOR.BLACK, { originFile: 2 }); // Bc8
  state.board[0][3] = makePiece(PIECE.QUEEN, COLOR.BLACK, { originFile: 3 });  // Qd8
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK, { originFile: 4 });   // Ke8
  state.board[0][6] = makePiece(PIECE.KNIGHT, COLOR.BLACK, { originFile: 6 }); // Ng8
  state.board[0][7] = makePiece(PIECE.ROOK, COLOR.BLACK, { originFile: 7 });   // Rh8

  // Black pawns
  state.board[1][0] = makePiece(PIECE.PAWN, COLOR.BLACK, { originFile: 0 }); // a7
  state.board[1][1] = makePiece(PIECE.PAWN, COLOR.BLACK, { originFile: 1 }); // b7
  state.board[1][2] = makePiece(PIECE.PAWN, COLOR.BLACK, { originFile: 2 }); // c7
  state.board[3][3] = makePiece(PIECE.PAWN, COLOR.BLACK, { originFile: 3 }); // d5
  state.board[3][3].hasMoved = true;
  state.board[3][4] = makePiece(PIECE.PAWN, COLOR.BLACK, { originFile: 4 }); // e5
  state.board[3][4].hasMoved = true;
  state.board[1][5] = makePiece(PIECE.PAWN, COLOR.BLACK, { originFile: 5 }); // f7
  state.board[1][6] = makePiece(PIECE.PAWN, COLOR.BLACK, { originFile: 6 }); // g7
  state.board[1][7] = makePiece(PIECE.PAWN, COLOR.BLACK, { originFile: 7 }); // h7

  // Black knight on c6 (from b8)
  state.board[2][2] = makePiece(PIECE.KNIGHT, COLOR.BLACK, { originFile: 1 }); // Nc6
  state.board[2][2].hasMoved = true;

  // Black bishop on c5 (dark-sq bishop from f8 captured White pawn on c5)
  state.board[3][2] = makePiece(PIECE.BISHOP, COLOR.BLACK, { originFile: 5 }); // Bc5
  state.board[3][2].hasMoved = true;

  // --- WHITE pieces ---
  state.board[7][0] = makePiece(PIECE.ROOK, COLOR.WHITE, { originFile: 0 });   // Ra1
  state.board[7][1] = makePiece(PIECE.KNIGHT, COLOR.WHITE, { originFile: 1 }); // Nb1
  state.board[7][2] = makePiece(PIECE.BISHOP, COLOR.WHITE, { originFile: 2 }); // Bc1
  state.board[7][3] = makePiece(PIECE.QUEEN, COLOR.WHITE, { originFile: 3 });  // Qd1
  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE, { originFile: 4 });   // Ke1
  state.board[7][5] = makePiece(PIECE.BISHOP, COLOR.WHITE, { originFile: 5 }); // Bf1
  state.board[7][7] = makePiece(PIECE.ROOK, COLOR.WHITE, { originFile: 7 });   // Rh1

  // White Nf3
  state.board[5][5] = makePiece(PIECE.KNIGHT, COLOR.WHITE, { originFile: 6 }); // Nf3
  state.board[5][5].hasMoved = true;

  // White pawns
  state.board[6][0] = makePiece(PIECE.PAWN, COLOR.WHITE, { originFile: 0 }); // a2
  state.board[5][1] = makePiece(PIECE.PAWN, COLOR.WHITE, { originFile: 1 }); // b3
  state.board[5][1].hasMoved = true;
  state.board[6][2] = makePiece(PIECE.PAWN, COLOR.WHITE, { originFile: 2 }); // c2
  // d4 pawn blinked to c5, then captured by Black (gone)
  state.board[6][4] = makePiece(PIECE.PAWN, COLOR.WHITE, { originFile: 4 }); // e2
  state.board[6][5] = makePiece(PIECE.PAWN, COLOR.WHITE, { originFile: 5 }); // f2
  state.board[6][6] = makePiece(PIECE.PAWN, COLOR.WHITE, { originFile: 6 }); // g2
  state.board[4][7] = makePiece(PIECE.PAWN, COLOR.WHITE, { originFile: 7 }); // h4
  state.board[4][7].hasMoved = true;

  // Set game state
  state.turn = COLOR.BLACK;
  state.turnNumber = 10;
  state.mana[COLOR.BLACK] = 10;
  state.mana[COLOR.WHITE] = 8;
  state.startProcessed = true;

  return state;
}

// Run the blink blunder test
const testState = setupBlunderPosition();
console.log('\nPosition set up. Black to move with 10 aether.');
console.log('Black pawn on d5 (row 3, col 3), Black queen on d8 (row 0, col 3)');
console.log('If bot blinks d5->e6, it opens the d-file exposing Qd8 to Qd1.\n');

// Set bot difficulty to hard
BOT.difficulty = 'hard';

// Call botConsiderPowers directly to see what the bot suggests
const powerAction = botConsiderPowers(testState, COLOR.BLACK);

let blinkD5E6Found = false;
let blinkDetails = null;

if (powerAction) {
  console.log(`Power action suggested: ${powerAction.name} (priority: ${powerAction.priority})`);
  if (powerAction.payload) {
    console.log(`  Payload: ${JSON.stringify(powerAction.payload)}`);
  }

  // Check if it's a BLINK from d5 to e6
  if (powerAction.name === 'BLINK' && powerAction.payload) {
    const from = powerAction.payload.from;
    const to = powerAction.payload.to;
    if (from && to) {
      const fromSq = algebraic(from.r, from.c);
      const toSq = algebraic(to.r, to.c);
      console.log(`  BLINK from ${fromSq} to ${toSq}`);
      if (fromSq === 'd5' && toSq === 'e6') {
        blinkD5E6Found = true;
        blinkDetails = `BLINK d5->e6 with priority ${powerAction.priority}`;
      }
    }
  }
} else {
  console.log('No power action suggested (bot chose not to use powers).');
}

// Manual check: Would BLINK d5->e6 expose the queen?
console.log('\n--- Manual safety analysis: BLINK d5->e6 ---');
const snapTest = snapshot(testState.board);
const pawnD5 = testState.board[3][3];
if (pawnD5) {
  testState.board[2][4] = pawnD5;
  testState.board[3][3] = null;

  const queenAttacked = isSquareAttacked(testState.board, 0, 3, COLOR.WHITE);
  console.log(`After BLINK d5->e6: Black queen on d8 attacked? ${queenAttacked ? 'YES (dangerous!)' : 'No'}`);

  if (queenAttacked) {
    console.log('  White Queen on d1 attacks along the open d-file.');
  }

  const safetyResult = botPowerSafetyCheck(testState.board, COLOR.BLACK);
  console.log(`botPowerSafetyCheck result: ${safetyResult} (negative = unsafe)`);

  restore(testState.board, snapTest);
} else {
  console.log('ERROR: No pawn found on d5!');
}

console.log('\n' + '='.repeat(60));
if (blinkD5E6Found) {
  console.log('RESULT: FAIL - Bot still tries to BLINK d5->e6!');
  console.log(`  Details: ${blinkDetails}`);
} else {
  console.log('RESULT: PASS - Bot does NOT try to BLINK d5->e6');
  if (powerAction) {
    console.log(`  Instead chose: ${powerAction.name} (priority ${powerAction.priority})`);
  } else {
    console.log('  Bot chose to save aether (no power cast).');
  }
}
console.log('='.repeat(60));

// ============================================================
// TEST 2: Run 2 quick Hard vs Medium games (max 60 turns)
// ============================================================

console.log('\n\n' + '='.repeat(60));
console.log('TEST 2: Quick bot games (Hard vs Medium, max 60 turns each)');
console.log('='.repeat(60));

let gamesCompleted = 0;
let gameCrashes = [];

function runQuickGame(gameNum, whiteDiff, blackDiff, maxTurns) {
  console.log(`\n--- Game ${gameNum}: ${whiteDiff} (White) vs ${blackDiff} (Black), max ${maxTurns} turns ---`);

  const state = createGameState({ seed: gameNum * 12345 });
  startOfTurn(state);

  let turnCount = 0;

  while (!state.winner && turnCount < maxTurns) {
    turnCount++;
    const color = state.turn;
    const diff = color === COLOR.WHITE ? whiteDiff : blackDiff;
    BOT.difficulty = diff;

    // Consider power
    let powerCast = false;
    try {
      const power = botConsiderPowers(state, color);
      if (power && power.exec) {
        const result = power.exec();
        if (result && !result.error) {
          powerCast = true;
        }
      }
    } catch (e) {
      // Power evaluation error - continue with chess move
    }

    // If power ended the turn, continue
    if (state.turn !== color) {
      if (turnCount % 20 === 0) {
        console.log(`  Turn ${turnCount}: W=${state.mana[COLOR.WHITE]}, B=${state.mana[COLOR.BLACK]} aether`);
      }
      continue;
    }

    // Get chess moves
    const moves = allLegalMoves(state.board, color, state);
    if (moves.length === 0) {
      if (isInCheck(state.board, color)) {
        state.winner = opposite(color);
        state.winReason = 'CHECKMATE';
      } else {
        state.winner = 'draw';
        state.winReason = 'STALEMATE';
      }
      break;
    }

    // Pick a move using bot scoring
    const scored = moves.map(m => ({
      move: m,
      score: botScoreMove(state, m.from, m.to, color)
    }));
    scored.sort((a, b) => b.score - a.score);
    const bestMove = scored[0].move;

    // Execute the move
    const result = makeMove(state, bestMove.from.r, bestMove.from.c, bestMove.to.r, bestMove.to.c);
    if (result.error) {
      // Try first legal move as fallback
      for (const m of moves) {
        const res = makeMove(state, m.from.r, m.from.c, m.to.r, m.to.c);
        if (!res.error) break;
      }
      if (state.turn === color) {
        console.log(`  Turn ${turnCount}: Stuck, breaking.`);
        break;
      }
    }

    if (turnCount % 20 === 0) {
      console.log(`  Turn ${turnCount}: W=${state.mana[COLOR.WHITE]}, B=${state.mana[COLOR.BLACK]} aether`);
    }
  }

  if (state.winner) {
    const winnerName = state.winner === COLOR.WHITE ? 'White' : state.winner === COLOR.BLACK ? 'Black' : 'Draw';
    console.log(`  Result: ${winnerName} wins (${state.winReason}) in ${turnCount} turns`);
  } else {
    console.log(`  Result: Draw (max turns reached) after ${turnCount} turns`);
  }

  return { completed: true, turns: turnCount };
}

for (let g = 1; g <= 2; g++) {
  try {
    runQuickGame(g, 'hard', 'medium', 60);
    gamesCompleted++;
  } catch (e) {
    console.error(`\nGame ${g} CRASHED: ${e.message}`);
    console.error(e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : '');
    gameCrashes.push(`Game ${g}: ${e.message}`);
  }
}

// ============================================================
// FINAL SUMMARY
// ============================================================

console.log('\n\n' + '='.repeat(60));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(60));
console.log(`1. BLINK d5->e6 blunder: ${blinkD5E6Found ? 'STILL PRESENT (FAIL)' : 'FIXED (not chosen)'}`);
console.log(`2. Games completed: ${gamesCompleted}/2`);
if (gameCrashes.length > 0) {
  console.log(`3. Crashes: ${gameCrashes.join('; ')}`);
} else {
  console.log(`3. Crashes: None`);
}
console.log('='.repeat(60));

if (blinkD5E6Found || gameCrashes.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
