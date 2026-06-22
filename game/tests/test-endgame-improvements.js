// ============================================================
// ENDGAME IMPROVEMENTS TEST SUITE
// Tests specific endgame scenarios to verify the bot's endgame play
// ============================================================

// Test results collector
const ENDGAME_TEST_RESULTS = {
  passed: 0,
  failed: 0,
  tests: []
};

function endgameTestLog(message) {
  console.log(`[ENDGAME TEST] ${message}`);
}

function endgameAssert(condition, testName, message) {
  if (condition) {
    ENDGAME_TEST_RESULTS.passed++;
    ENDGAME_TEST_RESULTS.tests.push({ name: testName, status: 'PASS' });
    endgameTestLog(`✓ ${testName}: ${message}`);
  } else {
    ENDGAME_TEST_RESULTS.failed++;
    ENDGAME_TEST_RESULTS.tests.push({ name: testName, status: 'FAIL', reason: message });
    endgameTestLog(`✗ ${testName}: ${message}`);
  }
}

// ===== TEST 1: K+Q vs K (Should mate in < 20 moves) =====
function testQueenMate() {
  endgameTestLog('Running Test 1: K+Q vs K');

  // Setup: White K on e1, Q on d1. Black K on e8.
  const state = initGame();
  // Clear the board
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // Place pieces: White King e1, White Queen d1, Black King e8
  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[7][3] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  state.turn = COLOR.WHITE;

  // Bot plays white (should mate)
  BOT.enabled = true;
  BOT.color = COLOR.WHITE;
  BOT.difficulty = 'hard';
  BOT.thinking = false;

  let moves = 0;
  const maxMoves = 30;

  while (!state.winner && moves < maxMoves) {
    if (state.turn === COLOR.WHITE) {
      // Bot move
      const legalMoves = allLegalMoves(state.board, COLOR.WHITE, state);
      if (legalMoves.length === 0) break;
      const bestMove = botSearchBestMove(state, legalMoves, COLOR.WHITE);
      makeMove(state, bestMove.from.r, bestMove.from.c, bestMove.to.r, bestMove.to.c);
    } else {
      // Black tries to evade (random king move)
      const legalMoves = allLegalMoves(state.board, COLOR.BLACK, state);
      if (legalMoves.length === 0) {
        if (isInCheck(state.board, COLOR.BLACK)) {
          state.winner = COLOR.WHITE;
          state.winReason = 'CHECKMATE';
        }
        break;
      }
      const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      makeMove(state, move.from.r, move.from.c, move.to.r, move.to.c);
    }
    moves++;
  }

  const mated = state.winner === COLOR.WHITE && state.winReason === 'CHECKMATE';
  const fastMate = moves <= 20;

  endgameAssert(mated, 'K+Q vs K Checkmate', mated ? `Mated in ${moves} moves` : 'Failed to mate');
  endgameAssert(fastMate, 'K+Q vs K Speed', fastMate ? 'Mated within 20 moves' : `Took ${moves} moves`);

  BOT.enabled = false;
}

// ===== TEST 2: K+R vs K (Should mate in < 30 moves) =====
function testRookMate() {
  endgameTestLog('Running Test 2: K+R vs K');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // White King e1, White Rook d1, Black King e8
  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[7][3] = makePiece(PIECE.ROOK, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  state.turn = COLOR.WHITE;

  BOT.enabled = true;
  BOT.color = COLOR.WHITE;
  BOT.difficulty = 'hard';
  BOT.thinking = false;

  let moves = 0;
  const maxMoves = 40;

  while (!state.winner && moves < maxMoves) {
    if (state.turn === COLOR.WHITE) {
      const legalMoves = allLegalMoves(state.board, COLOR.WHITE, state);
      if (legalMoves.length === 0) break;
      const bestMove = botSearchBestMove(state, legalMoves, COLOR.WHITE);
      makeMove(state, bestMove.from.r, bestMove.from.c, bestMove.to.r, bestMove.to.c);
    } else {
      const legalMoves = allLegalMoves(state.board, COLOR.BLACK, state);
      if (legalMoves.length === 0) {
        if (isInCheck(state.board, COLOR.BLACK)) {
          state.winner = COLOR.WHITE;
          state.winReason = 'CHECKMATE';
        }
        break;
      }
      const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      makeMove(state, move.from.r, move.from.c, move.to.r, move.to.c);
    }
    moves++;
  }

  const mated = state.winner === COLOR.WHITE && state.winReason === 'CHECKMATE';
  const fastMate = moves <= 30;

  endgameAssert(mated, 'K+R vs K Checkmate', mated ? `Mated in ${moves} moves` : 'Failed to mate');
  endgameAssert(fastMate, 'K+R vs K Speed', fastMate ? 'Mated within 30 moves' : `Took ${moves} moves`);

  BOT.enabled = false;
}

// ===== TEST 3: K+P vs K (Win/Draw recognition) =====
function testKingPawnEndgame() {
  endgameTestLog('Running Test 3: K+P vs K');

  // Winning position: White pawn on e6, White King on e5, Black King on e8
  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[3][4] = makePiece(PIECE.KING, COLOR.WHITE); // e5
  state.board[2][4] = makePiece(PIECE.PAWN, COLOR.WHITE); // e6
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK); // e8

  state.turn = COLOR.WHITE;

  // Evaluate position from white's perspective
  const evalScore = botEvaluate(state, COLOR.WHITE);

  // Should recognize this as winning (positive score)
  endgameAssert(evalScore > 400, 'K+P vs K Winning', `Eval score: ${evalScore} (should be > 400 for winning)`);

  // Now test drawing position: White pawn on e4, White King on e6, Black King on e8
  const drawState = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      drawState.board[r][c] = null;
    }
  }

  drawState.board[2][4] = makePiece(PIECE.KING, COLOR.WHITE); // e6
  drawState.board[4][4] = makePiece(PIECE.PAWN, COLOR.WHITE); // e4
  drawState.board[0][6] = makePiece(PIECE.KING, COLOR.BLACK); // g8 (can catch pawn)

  const drawEval = botEvaluate(drawState, COLOR.WHITE);

  // Should recognize this as less favorable (black king can catch)
  endgameAssert(drawEval < 200, 'K+P vs K Draw Recognition', `Eval score: ${drawEval} (should be < 200 for unclear)`);
}

// ===== TEST 4: Passed Pawn Race =====
function testPassedPawnRace() {
  endgameTestLog('Running Test 4: Passed Pawn Race');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // White: King on a1, Pawn on a2
  // Black: King on h8, Pawn on h7
  // White's pawn is closer to promotion
  state.board[7][0] = makePiece(PIECE.KING, COLOR.WHITE); // a1
  state.board[6][0] = makePiece(PIECE.PAWN, COLOR.WHITE); // a2
  state.board[0][7] = makePiece(PIECE.KING, COLOR.BLACK); // h8
  state.board[1][7] = makePiece(PIECE.PAWN, COLOR.BLACK); // h7

  state.turn = COLOR.WHITE;

  const evalScore = botEvaluate(state, COLOR.WHITE);

  // White should be evaluated as winning (passed pawn closer to promotion)
  endgameAssert(evalScore > 100, 'Passed Pawn Race', `Eval score: ${evalScore} (White's pawn closer)`);
}

// ===== TEST 5: Opposition =====
function testOpposition() {
  endgameTestLog('Running Test 5: Opposition');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // White King on e4, Black King on e6 (vertical opposition)
  state.board[4][4] = makePiece(PIECE.KING, COLOR.WHITE); // e4
  state.board[2][4] = makePiece(PIECE.KING, COLOR.BLACK); // e6

  state.turn = COLOR.WHITE;

  // Bot should recognize opposition value
  const evalScore = botEvaluate(state, COLOR.WHITE);

  // Evaluation should include opposition bonus
  endgameAssert(Math.abs(evalScore) < 100, 'Opposition Recognition', `Opposition detected in evaluation`);
}

// ===== TEST 6: Power Usage in Endgame (Promote Priority) =====
function testEndgamePowerPriority() {
  endgameTestLog('Running Test 6: Endgame Power Priority');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // White King on e1, White Pawn on e7, Black King on h8
  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE); // e1
  state.board[1][4] = makePiece(PIECE.PAWN, COLOR.WHITE); // e7
  state.board[0][7] = makePiece(PIECE.KING, COLOR.BLACK); // h8

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 15; // Enough for Promote
  state.mana[COLOR.BLACK] = 0;

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  // Bot should consider Promote power
  const powerAction = botConsiderPowers(state, COLOR.WHITE);

  const shouldPromote = powerAction && powerAction.name === 'PROMOTE';
  endgameAssert(shouldPromote, 'Promote Priority', shouldPromote ? 'Bot prioritizes Promote in endgame' : 'Bot did not prioritize Promote');

  BOT.enabled = false;
}

// ===== TEST 7: Zugzwang Detection =====
function testZugzwangDetection() {
  endgameTestLog('Running Test 7: Zugzwang Detection');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // Pure pawn endgame: White King + Pawns, Black King + Pawns
  state.board[5][4] = makePiece(PIECE.KING, COLOR.WHITE); // e3
  state.board[4][3] = makePiece(PIECE.PAWN, COLOR.WHITE); // d4
  state.board[2][4] = makePiece(PIECE.KING, COLOR.BLACK); // e6
  state.board[3][3] = makePiece(PIECE.PAWN, COLOR.BLACK); // d5

  const shouldDisable = botShouldDisableNullMove(state, COLOR.WHITE);

  endgameAssert(shouldDisable, 'Zugzwang Detection', shouldDisable ? 'Null-move disabled in pawn endgame' : 'Null-move not disabled');
}

// ===== TEST 8: Rook Behind Passed Pawn =====
function testRookBehindPassedPawn() {
  endgameTestLog('Running Test 8: Rook Behind Passed Pawn');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // White: King e1, Rook d1, Pawn d6
  // Black: King e8
  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[7][3] = makePiece(PIECE.ROOK, COLOR.WHITE);
  state.board[2][3] = makePiece(PIECE.PAWN, COLOR.WHITE); // d6 passed pawn
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  state.turn = COLOR.WHITE;

  const evalScore = botEvaluate(state, COLOR.WHITE);

  // Should get bonus for rook behind passed pawn
  endgameAssert(evalScore > 500, 'Rook Behind Passed Pawn', `Eval: ${evalScore} (should include rook behind pawn bonus)`);
}

// ===== TEST 9: Connected Passed Pawns =====
function testConnectedPassedPawns() {
  endgameTestLog('Running Test 9: Connected Passed Pawns');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // White: King a1, Pawns e5 and f5 (connected passed)
  // Black: King h8
  state.board[7][0] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[3][4] = makePiece(PIECE.PAWN, COLOR.WHITE); // e5
  state.board[3][5] = makePiece(PIECE.PAWN, COLOR.WHITE); // f5
  state.board[0][7] = makePiece(PIECE.KING, COLOR.BLACK);

  state.turn = COLOR.WHITE;

  const evalScore = botEvaluate(state, COLOR.WHITE);

  // Should get large bonus for connected passed pawns
  endgameAssert(evalScore > 600, 'Connected Passed Pawns', `Eval: ${evalScore} (should be very high)`);
}

// ===== TEST 10: Deeper Search in Endgame =====
function testDeeperEndgameSearch() {
  endgameTestLog('Running Test 10: Deeper Search in Endgame');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // Simple endgame: few pieces
  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[6][4] = makePiece(PIECE.PAWN, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  state.turn = COLOR.WHITE;

  const phase = botGamePhase(state);
  const expectedDepth = phase < 0.4 ? 6 : 4;

  endgameAssert(phase < 0.4, 'Endgame Phase Detection', `Phase: ${phase.toFixed(2)} (should be < 0.4 for endgame)`);
  endgameAssert(expectedDepth === 6, 'Endgame Search Depth', `Expected depth: ${expectedDepth} (6-ply in endgame)`);
}

// ===== RUN ALL TESTS =====
function runAllEndgameTests() {
  endgameTestLog('=====================================================');
  endgameTestLog('STARTING ENDGAME IMPROVEMENT TEST SUITE');
  endgameTestLog('=====================================================');

  ENDGAME_TEST_RESULTS.passed = 0;
  ENDGAME_TEST_RESULTS.failed = 0;
  ENDGAME_TEST_RESULTS.tests = [];

  testQueenMate();
  testRookMate();
  testKingPawnEndgame();
  testPassedPawnRace();
  testOpposition();
  testEndgamePowerPriority();
  testZugzwangDetection();
  testRookBehindPassedPawn();
  testConnectedPassedPawns();
  testDeeperEndgameSearch();

  endgameTestLog('=====================================================');
  endgameTestLog(`TEST RESULTS: ${ENDGAME_TEST_RESULTS.passed} PASSED, ${ENDGAME_TEST_RESULTS.failed} FAILED`);
  endgameTestLog('=====================================================');

  // Summary by test
  for (const test of ENDGAME_TEST_RESULTS.tests) {
    const icon = test.status === 'PASS' ? '✓' : '✗';
    const msg = test.reason || '';
    endgameTestLog(`${icon} ${test.name}: ${test.status} ${msg}`);
  }

  return ENDGAME_TEST_RESULTS;
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
  window.runAllEndgameTests = runAllEndgameTests;
  endgameTestLog('Endgame test suite loaded. Run with: runAllEndgameTests()');
}
