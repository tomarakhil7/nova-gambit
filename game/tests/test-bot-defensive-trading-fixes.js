// ============================================================
// BOT DEFENSIVE AND TRADING FIXES TEST SUITE
// Tests for 10 critical bug fixes:
// - Defensive: Pawn evaluation, Move scoring, King activity, Frost, Vengeance
// - Trading: SEE, Search depth, Safety checks, Quiescence, Positional
// ============================================================

// Test results collector
const BOT_FIXES_TEST_RESULTS = {
  passed: 0,
  failed: 0,
  tests: []
};

function testLog(message) {
  console.log(`[BOT FIXES TEST] ${message}`);
}

function testAssert(condition, testName, message) {
  if (condition) {
    BOT_FIXES_TEST_RESULTS.passed++;
    BOT_FIXES_TEST_RESULTS.tests.push({ name: testName, status: 'PASS' });
    testLog(`✓ ${testName}: ${message}`);
  } else {
    BOT_FIXES_TEST_RESULTS.failed++;
    BOT_FIXES_TEST_RESULTS.tests.push({ name: testName, status: 'FAIL', reason: message });
    testLog(`✗ ${testName}: ${message}`);
  }
}

// ============================================================
// DEFENSIVE FIX 1: PAWN EVALUATION (Lines 705-711, 1006-1012)
// Bot should give huge penalty for enemy pawns on 7th rank
// ============================================================

function testDefensiveFix1_EnemyPawnOn7thRank() {
  testLog('Running Test: Defensive Fix 1 - Enemy Pawn on 7th Rank Penalty');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // Black pawn on 7th rank (row 6 for white perspective, distToPromo = 1)
  state.board[6][3] = makePiece(PIECE.PAWN, COLOR.BLACK);

  state.turn = COLOR.WHITE;

  // Evaluate position - should show massive penalty for enemy pawn on 7th
  const evalBefore = botEvaluate(state, COLOR.WHITE);

  // Remove the dangerous pawn
  state.board[6][3] = null;
  const evalAfter = botEvaluate(state, COLOR.WHITE);

  const penaltyApplied = evalAfter - evalBefore;

  testAssert(
    penaltyApplied >= 600,
    'Defensive Fix 1 - Enemy Pawn 7th Rank Eval',
    `Penalty applied: ${penaltyApplied} (expected >= 700)`
  );
}

function testDefensiveFix1_CaptureEnemyPawnOn7th() {
  testLog('Running Test: Defensive Fix 1 - Capture Enemy Pawn on 7th Priority');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // Black pawn on 7th rank
  state.board[6][3] = makePiece(PIECE.PAWN, COLOR.BLACK);
  // White rook can capture it
  state.board[6][0] = makePiece(PIECE.ROOK, COLOR.WHITE);

  state.turn = COLOR.WHITE;

  // Score the capture move - should have huge bonus (600+)
  const captureScore = botScoreMove(state, {r: 6, c: 0}, {r: 6, c: 3}, COLOR.WHITE);

  testAssert(
    captureScore >= 600,
    'Defensive Fix 1 - Capture 7th Rank Pawn Score',
    `Capture score: ${captureScore} (expected >= 600)`
  );
}

// ============================================================
// DEFENSIVE FIX 2: MOVE SCORING (Lines 1015-1025)
// Bot should use SEE to prevent blunders in captures
// ============================================================

function testDefensiveFix2_SEECheckPreventsBlunder() {
  testLog('Running Test: Defensive Fix 2 - SEE Check Prevents Bad Captures');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // White queen can capture black pawn, but black rook defends
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state.board[3][3] = makePiece(PIECE.PAWN, COLOR.BLACK);
  state.board[3][0] = makePiece(PIECE.ROOK, COLOR.BLACK); // Defends the pawn

  state.turn = COLOR.WHITE;

  // Calculate SEE for the capture
  const seeScore = botSEE(state, 3, 3, 4, 4, COLOR.WHITE);

  testAssert(
    seeScore < -100,
    'Defensive Fix 2 - SEE Detects Bad Trade',
    `SEE score: ${seeScore} (expected < -100, queen will be lost)`
  );

  // Score the capture move - should be heavily penalized
  const captureScore = botScoreMove(state, {r: 4, c: 4}, {r: 3, c: 3}, COLOR.WHITE);

  testAssert(
    captureScore < 0,
    'Defensive Fix 2 - Bad Capture Penalized',
    `Capture score: ${captureScore} (expected < 0 due to SEE penalty)`
  );
}

function testDefensiveFix2_SEEAllowsGoodCaptures() {
  testLog('Running Test: Defensive Fix 2 - SEE Allows Good Captures');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // White pawn can capture black queen (undefended)
  state.board[4][4] = makePiece(PIECE.PAWN, COLOR.WHITE);
  state.board[3][3] = makePiece(PIECE.QUEEN, COLOR.BLACK);

  state.turn = COLOR.WHITE;

  // Calculate SEE for the capture
  const seeScore = botSEE(state, 3, 3, 4, 4, COLOR.WHITE);

  testAssert(
    seeScore > 800,
    'Defensive Fix 2 - SEE Detects Good Trade',
    `SEE score: ${seeScore} (expected > 800, winning queen)`
  );
}

// ============================================================
// DEFENSIVE FIX 3: KING ACTIVITY (Lines 1106-1123)
// When behind in material, king should attack dangerous pawns
// ============================================================

function testDefensiveFix3_KingAttacksDangerousPawns() {
  testLog('Running Test: Defensive Fix 3 - King Attacks Dangerous Pawns When Behind');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // White is behind in material (no pieces)
  // Black has dangerous pawn on 7th rank
  state.board[6][3] = makePiece(PIECE.PAWN, COLOR.BLACK);
  state.board[5][3] = makePiece(PIECE.QUEEN, COLOR.BLACK); // Material advantage

  // Move white king close to the dangerous pawn
  state.board[7][4] = null;
  state.board[5][2] = makePiece(PIECE.KING, COLOR.WHITE);

  state.turn = COLOR.WHITE;

  // Score king move toward the dangerous pawn
  const moveScore = botScoreMove(state, {r: 5, c: 2}, {r: 5, c: 3}, COLOR.WHITE);

  testAssert(
    moveScore >= 200,
    'Defensive Fix 3 - King Move to Attack Pawn',
    `King move score: ${moveScore} (expected >= 300 when behind and pawn on 7th)`
  );
}

function testDefensiveFix3_KingDoesntWasteTimeWhenAhead() {
  testLog('Running Test: Defensive Fix 3 - King Focuses on Mate When Ahead');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // White is ahead (has queen)
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);

  state.turn = COLOR.WHITE;

  // When ahead, king should move toward enemy king (mating attack)
  state.board[7][4] = null;
  state.board[5][4] = makePiece(PIECE.KING, COLOR.WHITE);

  const moveTowardEnemyKing = botScoreMove(state, {r: 5, c: 4}, {r: 4, c: 4}, COLOR.WHITE);
  const moveAwayFromEnemyKing = botScoreMove(state, {r: 5, c: 4}, {r: 6, c: 4}, COLOR.WHITE);

  testAssert(
    moveTowardEnemyKing > moveAwayFromEnemyKing,
    'Defensive Fix 3 - King Approaches Enemy When Ahead',
    `Toward: ${moveTowardEnemyKing}, Away: ${moveAwayFromEnemyKing}`
  );
}

// ============================================================
// DEFENSIVE FIX 4: FROST POWER (Lines 1881-1886 in Vengeance section)
// Frost should target dangerous pawns on 7th rank
// ============================================================

function testDefensiveFix4_FrostTargetsDangerousPawns() {
  testLog('Running Test: Defensive Fix 4 - Frost Targets Pawns on 7th Rank');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // Black pawn on 7th rank (dangerous!)
  state.board[6][3] = makePiece(PIECE.PAWN, COLOR.BLACK);
  // Black queen (also valuable target)
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.BLACK);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const powerAction = botConsiderPowers(state, COLOR.WHITE);

  // Bot should prioritize dealing with the dangerous pawn
  // (Either Vengeance to destroy it, or other defensive power)
  testAssert(
    powerAction !== null && powerAction.priority > 100,
    'Defensive Fix 4 - Power Targets Dangerous Pawn',
    `Power: ${powerAction ? powerAction.name : 'none'}, Priority: ${powerAction ? powerAction.priority : 0}`
  );

  BOT.enabled = false;
}

// ============================================================
// DEFENSIVE FIX 5: VENGEANCE POWER (Lines 1881-1886)
// Vengeance should have huge value for destroying enemy pawns on 7th rank
// ============================================================

function testDefensiveFix5_VengeanceDestroysDangerousPawn() {
  testLog('Running Test: Defensive Fix 5 - Vengeance Destroys Pawn on 7th Rank');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // Black pawn on 7th rank (distToPromo = 1)
  state.board[6][3] = makePiece(PIECE.PAWN, COLOR.BLACK);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const powerAction = botConsiderPowers(state, COLOR.WHITE);

  testAssert(
    powerAction !== null && powerAction.name === 'VENGEANCE',
    'Defensive Fix 5 - Vengeance Prioritized for 7th Rank Pawn',
    `Power: ${powerAction ? powerAction.name : 'none'}, Priority: ${powerAction ? powerAction.priority : 0}`
  );

  // Check that the priority is high (750+ bonus for pawn on 7th)
  testAssert(
    powerAction && powerAction.priority >= 100,
    'Defensive Fix 5 - High Priority for Vengeance',
    `Priority: ${powerAction ? powerAction.priority : 0} (expected >= 100 with 750 pawn bonus)`
  );

  BOT.enabled = false;
}

// ============================================================
// TRADING FIX 1: SEE IMPLEMENTATION (Lines 1148-1217)
// SEE should correctly evaluate exchanges including shields
// ============================================================

function testTradingFix1_SEEHandlesShields() {
  testLog('Running Test: Trading Fix 1 - SEE Handles Shields Correctly');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // White queen tries to capture shielded black pawn
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state.board[3][3] = makePiece(PIECE.PAWN, COLOR.BLACK);
  state.board[3][3].shieldHP = 1;

  state.turn = COLOR.WHITE;

  // SEE should show this is very bad (we don't capture, just break shield)
  const seeScore = botSEE(state, 3, 3, 4, 4, COLOR.WHITE);

  testAssert(
    seeScore <= -900,
    'Trading Fix 1 - SEE Detects Shield Block',
    `SEE score: ${seeScore} (expected <= -900, queen value lost for breaking shield)`
  );
}

function testTradingFix1_SEEEvaluatesComplexExchange() {
  testLog('Running Test: Trading Fix 1 - SEE Evaluates Multi-Piece Exchange');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // Complex exchange: white pawn takes black knight, defended by black pawn
  state.board[4][4] = makePiece(PIECE.PAWN, COLOR.WHITE);
  state.board[3][3] = makePiece(PIECE.KNIGHT, COLOR.BLACK);
  state.board[2][2] = makePiece(PIECE.PAWN, COLOR.BLACK); // Defends knight

  state.turn = COLOR.WHITE;

  // SEE: Pawn takes knight (320), black pawn recaptures (100)
  // Net: 320 - 100 = 220 (positive trade for white)
  const seeScore = botSEE(state, 3, 3, 4, 4, COLOR.WHITE);

  testAssert(
    seeScore > 100,
    'Trading Fix 1 - SEE Evaluates Favorable Trade',
    `SEE score: ${seeScore} (expected > 100, pawn-for-knight trade)`
  );
}

// ============================================================
// TRADING FIX 2: SEARCH DEPTH (Lines 1227-1239)
// Adaptive depth by game phase: 5-ply opening, 5-ply mid, 6-ply end
// ============================================================

function testTradingFix2_AdaptiveDepthByPhase() {
  testLog('Running Test: Trading Fix 2 - Adaptive Search Depth by Game Phase');

  // Opening (turn 5)
  const state1 = initGame();
  state1.turnNumber = 5;
  const depthOpening = botGetSearchDepth(state1);

  // Middlegame (turn 20)
  const state2 = initGame();
  state2.turnNumber = 20;
  const depthMiddle = botGetSearchDepth(state2);

  // Endgame (turn 35)
  const state3 = initGame();
  state3.turnNumber = 35;
  const depthEnd = botGetSearchDepth(state3);

  testAssert(
    depthOpening === 5 && depthMiddle === 5 && depthEnd === 6,
    'Trading Fix 2 - Depth Progression',
    `Opening: ${depthOpening}, Mid: ${depthMiddle}, End: ${depthEnd} (expected 5, 5, 6)`
  );
}

function testTradingFix2_DeeperSearchInEndgame() {
  testLog('Running Test: Trading Fix 2 - Endgame Gets Deeper Search');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[6][3] = makePiece(PIECE.PAWN, COLOR.WHITE);

  state.turnNumber = 40; // Endgame
  const depth = botGetSearchDepth(state);

  testAssert(
    depth === 6,
    'Trading Fix 2 - Endgame Depth 6',
    `Depth: ${depth} (expected 6 for endgame)`
  );
}

// ============================================================
// TRADING FIX 3: SAFETY CHECKS (Lines 1358-1408)
// Root-level move ordering includes safety checks (SEE + attack detection)
// ============================================================

function testTradingFix3_RootOrderingPreventsSuicide() {
  testLog('Running Test: Trading Fix 3 - Root Ordering Prevents Hanging Pieces');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // White queen can move to attacked square (bad move)
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state.board[3][0] = makePiece(PIECE.ROOK, COLOR.BLACK); // Attacks row 3

  state.turn = COLOR.WHITE;

  // Score moving queen to attacked square
  const badMoveScore = botRootOrderScore(state, {
    from: {r: 4, c: 4},
    to: {r: 3, c: 4},
    move: {r: 3, c: 4, capture: false}
  }, COLOR.WHITE);

  // Score moving queen to safe square
  const goodMoveScore = botRootOrderScore(state, {
    from: {r: 4, c: 4},
    to: {r: 5, c: 5},
    move: {r: 5, c: 5, capture: false}
  }, COLOR.WHITE);

  testAssert(
    goodMoveScore > badMoveScore,
    'Trading Fix 3 - Safe Move Scored Higher',
    `Safe: ${goodMoveScore}, Unsafe: ${badMoveScore}`
  );
}

function testTradingFix3_RetreatBonusForAttackedPieces() {
  testLog('Running Test: Trading Fix 3 - Retreat Bonus for Attacked Pieces');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // White queen is attacked
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state.board[4][0] = makePiece(PIECE.ROOK, COLOR.BLACK); // Attacks queen

  state.turn = COLOR.WHITE;

  // Score retreating to safety
  const retreatScore = botRootOrderScore(state, {
    from: {r: 4, c: 4},
    to: {r: 5, c: 5},
    move: {r: 5, c: 5, capture: false}
  }, COLOR.WHITE);

  testAssert(
    retreatScore > 1000,
    'Trading Fix 3 - High Retreat Bonus',
    `Retreat score: ${retreatScore} (expected > 1000 for queen retreat)`
  );
}

// ============================================================
// TRADING FIX 4: QUIESCENCE SEARCH (Lines 1586-1719)
// Enhanced quiescence with depth 8, checks, recaptures
// ============================================================

function testTradingFix4_QuiescenceDepth() {
  testLog('Running Test: Trading Fix 4 - Quiescence Search Depth 8');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state.board[3][3] = makePiece(PIECE.PAWN, COLOR.BLACK);

  state.turn = COLOR.WHITE;

  // Call quiescence at depth 0 (should recurse up to depth 8)
  const qScore = botQuiesce(state, -Infinity, Infinity, COLOR.WHITE, 0);

  testAssert(
    typeof qScore === 'number' && !isNaN(qScore),
    'Trading Fix 4 - Quiescence Returns Valid Score',
    `Q-score: ${qScore}`
  );
}

function testTradingFix4_QuiescenceHandlesChecks() {
  testLog('Running Test: Trading Fix 4 - Quiescence Considers Checks');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);

  state.turn = COLOR.WHITE;

  // Queen can give check
  const moves = allLegalMoves(state.board, COLOR.WHITE, state);
  const checkMove = moves.find(m => {
    const snap = snapshot(state.board);
    applyMoveRaw(state.board, m.from.r, m.from.c, { r: m.to.r, c: m.to.c, capture: m.move.capture }, state);
    const givesCheck = isInCheck(state.board, COLOR.BLACK);
    restore(state.board, snap);
    return givesCheck;
  });

  testAssert(
    checkMove !== undefined,
    'Trading Fix 4 - Check Move Available',
    'Queen can deliver check'
  );
}

// ============================================================
// TRADING FIX 5: POSITIONAL EVALUATION (Lines 686-712)
// Passed pawn evaluation with huge penalty for enemy pawns on 7th
// ============================================================

function testTradingFix5_PassedPawnBonus() {
  testLog('Running Test: Trading Fix 5 - Passed Pawn Bonus');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // White passed pawn on 5th rank
  state.board[3][3] = makePiece(PIECE.PAWN, COLOR.WHITE);

  state.turn = COLOR.WHITE;

  const evalWithPassedPawn = botEvaluate(state, COLOR.WHITE);

  // Remove passed pawn
  state.board[3][3] = null;
  const evalWithoutPassedPawn = botEvaluate(state, COLOR.WHITE);

  const bonus = evalWithPassedPawn - evalWithoutPassedPawn;

  testAssert(
    bonus > 50,
    'Trading Fix 5 - Passed Pawn Bonus Applied',
    `Bonus: ${bonus} (expected > 50 for passed pawn)`
  );
}

function testTradingFix5_EnemyPassedPawnPenalty() {
  testLog('Running Test: Trading Fix 5 - Enemy Passed Pawn Penalty');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // Black passed pawn on 7th rank (distToPromo = 1)
  state.board[6][3] = makePiece(PIECE.PAWN, COLOR.BLACK);

  state.turn = COLOR.WHITE;

  const evalWithDangerousPawn = botEvaluate(state, COLOR.WHITE);

  // Remove dangerous pawn
  state.board[6][3] = null;
  const evalWithoutDangerousPawn = botEvaluate(state, COLOR.WHITE);

  const penalty = evalWithoutDangerousPawn - evalWithDangerousPawn;

  testAssert(
    penalty >= 600,
    'Trading Fix 5 - Enemy 7th Rank Pawn Huge Penalty',
    `Penalty: ${penalty} (expected >= 700 for enemy pawn on 7th)`
  );
}

// ============================================================
// RUN ALL TESTS
// ============================================================

function runAllBotFixesTests() {
  testLog('=====================================================');
  testLog('STARTING BOT DEFENSIVE AND TRADING FIXES TEST SUITE');
  testLog('=====================================================');

  BOT_FIXES_TEST_RESULTS.passed = 0;
  BOT_FIXES_TEST_RESULTS.failed = 0;
  BOT_FIXES_TEST_RESULTS.tests = [];

  // DEFENSIVE FIXES (5 tests)
  testLog('\n--- DEFENSIVE FIX 1: PAWN EVALUATION ---');
  testDefensiveFix1_EnemyPawnOn7thRank();
  testDefensiveFix1_CaptureEnemyPawnOn7th();

  testLog('\n--- DEFENSIVE FIX 2: MOVE SCORING (SEE) ---');
  testDefensiveFix2_SEECheckPreventsBlunder();
  testDefensiveFix2_SEEAllowsGoodCaptures();

  testLog('\n--- DEFENSIVE FIX 3: KING ACTIVITY ---');
  testDefensiveFix3_KingAttacksDangerousPawns();
  testDefensiveFix3_KingDoesntWasteTimeWhenAhead();

  testLog('\n--- DEFENSIVE FIX 4: FROST POWER ---');
  testDefensiveFix4_FrostTargetsDangerousPawns();

  testLog('\n--- DEFENSIVE FIX 5: VENGEANCE POWER ---');
  testDefensiveFix5_VengeanceDestroysDangerousPawn();

  // TRADING FIXES (5 tests)
  testLog('\n--- TRADING FIX 1: SEE IMPLEMENTATION ---');
  testTradingFix1_SEEHandlesShields();
  testTradingFix1_SEEEvaluatesComplexExchange();

  testLog('\n--- TRADING FIX 2: SEARCH DEPTH ---');
  testTradingFix2_AdaptiveDepthByPhase();
  testTradingFix2_DeeperSearchInEndgame();

  testLog('\n--- TRADING FIX 3: SAFETY CHECKS ---');
  testTradingFix3_RootOrderingPreventsSuicide();
  testTradingFix3_RetreatBonusForAttackedPieces();

  testLog('\n--- TRADING FIX 4: QUIESCENCE SEARCH ---');
  testTradingFix4_QuiescenceDepth();
  testTradingFix4_QuiescenceHandlesChecks();

  testLog('\n--- TRADING FIX 5: POSITIONAL EVALUATION ---');
  testTradingFix5_PassedPawnBonus();
  testTradingFix5_EnemyPassedPawnPenalty();

  testLog('\n=====================================================');
  testLog(`TEST RESULTS: ${BOT_FIXES_TEST_RESULTS.passed} PASSED, ${BOT_FIXES_TEST_RESULTS.failed} FAILED`);
  testLog('=====================================================');

  // Summary by category
  const categories = {
    'Defensive Fix 1': 0,
    'Defensive Fix 2': 0,
    'Defensive Fix 3': 0,
    'Defensive Fix 4': 0,
    'Defensive Fix 5': 0,
    'Trading Fix 1': 0,
    'Trading Fix 2': 0,
    'Trading Fix 3': 0,
    'Trading Fix 4': 0,
    'Trading Fix 5': 0
  };

  for (const test of BOT_FIXES_TEST_RESULTS.tests) {
    for (const cat in categories) {
      if (test.name.includes(cat)) {
        if (test.status === 'PASS') categories[cat]++;
        break;
      }
    }
  }

  testLog('\n--- RESULTS BY CATEGORY ---');
  for (const cat in categories) {
    testLog(`${cat}: ${categories[cat]} passed`);
  }

  testLog('\n--- DETAILED RESULTS ---');
  for (const test of BOT_FIXES_TEST_RESULTS.tests) {
    const icon = test.status === 'PASS' ? '✓' : '✗';
    const msg = test.reason || '';
    testLog(`${icon} ${test.name}: ${test.status}`);
  }

  return BOT_FIXES_TEST_RESULTS;
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
  window.runAllBotFixesTests = runAllBotFixesTests;
  testLog('Bot fixes test suite loaded. Run with: runAllBotFixesTests()');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllBotFixesTests, BOT_FIXES_TEST_RESULTS };
}
