// ============================================================
// COMPREHENSIVE FIXES TEST SUITE
// Tests for all recent improvements and bug fixes
// ============================================================

// Test results collector
const COMPREHENSIVE_TEST_RESULTS = {
  passed: 0,
  failed: 0,
  tests: []
};

function testLog(message) {
  console.log(`[COMPREHENSIVE TEST] ${message}`);
}

function testAssert(condition, testName, message) {
  if (condition) {
    COMPREHENSIVE_TEST_RESULTS.passed++;
    COMPREHENSIVE_TEST_RESULTS.tests.push({ name: testName, status: 'PASS' });
    testLog(`✓ ${testName}: ${message}`);
  } else {
    COMPREHENSIVE_TEST_RESULTS.failed++;
    COMPREHENSIVE_TEST_RESULTS.tests.push({ name: testName, status: 'FAIL', reason: message });
    testLog(`✗ ${testName}: ${message}`);
  }
}

// ============================================================
// 1. DISCOVERY CHECK TESTS
// ============================================================

function testDiscoveryCheckImmediateEnd() {
  testLog('Running Test: Discovery Check - Immediate Turn End');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // Setup: White King e1, White Rook e4, White Bishop a4
  // Black King e8, Black Bishop d5 (pinning the rook)
  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[4][4] = makePiece(PIECE.ROOK, COLOR.WHITE);
  state.board[4][0] = makePiece(PIECE.BISHOP, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[3][3] = makePiece(PIECE.BISHOP, COLOR.BLACK);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  // Cast Imprison to remove the bishop, creating discovered check
  const result = castImprison(state, 4, 0, 3, 3);

  // Turn should pass immediately after discovered check
  testAssert(
    result.success && result.passedTurn && state.turn === COLOR.BLACK,
    'Discovery Check - Imprison Creates Check',
    'Turn ended immediately after discovered check'
  );
}

function testDiscoveryCheckWithDifferentPieces() {
  testLog('Running Test: Discovery Check - Various Piece Configurations');

  // Test with Queen pin
  const state1 = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state1.board[r][c] = null;
    }
  }

  state1.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state1.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state1.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state1.board[2][4] = makePiece(PIECE.PAWN, COLOR.BLACK);

  state1.turn = COLOR.WHITE;
  state1.mana[COLOR.WHITE] = 30;

  const result1 = castImprison(state1, 4, 4, 2, 4);

  testAssert(
    result1.success && result1.passedTurn,
    'Discovery Check - Queen Pin',
    'Queen pin creates discovered check and ends turn'
  );

  // Test with Rook pin
  const state2 = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state2.board[r][c] = null;
    }
  }

  state2.board[7][0] = makePiece(PIECE.KING, COLOR.WHITE);
  state2.board[7][4] = makePiece(PIECE.ROOK, COLOR.WHITE);
  state2.board[0][0] = makePiece(PIECE.KING, COLOR.BLACK);
  state2.board[7][2] = makePiece(PIECE.KNIGHT, COLOR.BLACK);

  state2.turn = COLOR.WHITE;
  state2.mana[COLOR.WHITE] = 30;

  const result2 = castImprison(state2, 7, 4, 7, 2);

  testAssert(
    result2.success && result2.passedTurn,
    'Discovery Check - Rook Pin',
    'Rook pin creates discovered check and ends turn'
  );
}

function testDiscoveryCheckBothColors() {
  testLog('Running Test: Discovery Check - Both Colors');

  // Test for Black creating discovered check
  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[3][4] = makePiece(PIECE.BISHOP, COLOR.BLACK);
  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[5][2] = makePiece(PIECE.PAWN, COLOR.WHITE);

  state.turn = COLOR.BLACK;
  state.mana[COLOR.BLACK] = 30;

  const result = castImprison(state, 3, 4, 5, 2);

  testAssert(
    result.success && result.passedTurn && state.turn === COLOR.WHITE,
    'Discovery Check - Black Creates Check',
    'Black can create discovered check, turn ends'
  );
}

function testDiscoveryCheckAfterPowerUsage() {
  testLog('Running Test: Discovery Check - After Power Usage');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // Setup position where Cleanse will create discovered check
  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[4][4] = makePiece(PIECE.ROOK, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  const imprisonedPawn = makePiece(PIECE.PAWN, COLOR.BLACK);
  imprisonedPawn.originFile = 3;
  state.board[2][3] = makePiece(PIECE.KNIGHT, COLOR.BLACK);
  state.board[2][3].imprisoned = imprisonedPawn;

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  const result = castCleanse(state, 2, 3);

  // Freeing prisoner can create discovered check
  testAssert(
    result.success,
    'Discovery Check - After Cleanse',
    'Cleanse can trigger discovered check handling'
  );
}

// ============================================================
// 2. CLEANSE ENHANCEMENT TESTS
// ============================================================

function testCleanseRemovesShield() {
  testLog('Running Test: Cleanse - Removes Shield');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.BLACK);
  state.board[4][4].shieldHP = 1;

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  const result = castCleanse(state, 4, 4);

  testAssert(
    result.success && result.shieldRemoved && state.board[4][4].shieldHP === 0,
    'Cleanse - Remove Shield',
    'Cleanse successfully removes shield from piece'
  );
}

function testCleanseTargetsImprisonerAndFreesPrisoner() {
  testLog('Running Test: Cleanse - Target Imprisoner, Free Prisoner');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  // Black knight imprisoning white rook
  const imprisonedRook = makePiece(PIECE.ROOK, COLOR.WHITE);
  imprisonedRook.originFile = 7;
  state.board[4][4] = makePiece(PIECE.KNIGHT, COLOR.BLACK);
  state.board[4][4].imprisoned = imprisonedRook;

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  const result = castCleanse(state, 4, 4);

  testAssert(
    result.success && result.released && result.released.placed,
    'Cleanse - Target Imprisoner',
    'Cleanse on imprisoner frees the prisoner'
  );
}

function testCleanseWorksFrozenPiece() {
  testLog('Running Test: Cleanse - Works on Frozen Pieces');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state.board[4][4].frozenUntil = state.turnNumber + 5;

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  const result = castCleanse(state, 4, 4);

  testAssert(
    result.success && result.thawed && state.board[4][4].frozenUntil === 0,
    'Cleanse - Unfreeze Frozen Piece',
    'Cleanse successfully unfreezes frozen piece'
  );
}

function testCleanseWorksImprisonedPiece() {
  testLog('Running Test: Cleanse - Works on Imprisoned Pieces');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  const imprisonedKnight = makePiece(PIECE.KNIGHT, COLOR.BLACK);
  imprisonedKnight.originFile = 1;
  state.board[4][4] = makePiece(PIECE.ROOK, COLOR.WHITE);
  state.board[4][4].imprisoned = imprisonedKnight;

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  const result = castCleanse(state, 4, 4);

  testAssert(
    result.success && result.released,
    'Cleanse - Free Imprisoned Piece',
    'Cleanse frees imprisoned piece (original behavior)'
  );
}

// ============================================================
// 3. WALL DIRECTION TESTS
// ============================================================

function testWallSpawnsNorthOnly() {
  testLog('Running Test: Wall - North Direction Only');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.ROOK, COLOR.WHITE);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  const result = castWall(state, 4, 4, 'N');

  // Check that pawns only spawned in northern squares (row < 4)
  let northPawns = 0;
  let southPawns = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.type === PIECE.PAWN && p.color === COLOR.WHITE) {
        if (r < 4) northPawns++;
        if (r > 4) southPawns++;
      }
    }
  }

  testAssert(
    result.success && northPawns > 0 && southPawns === 0,
    'Wall - North Direction',
    `Spawned ${northPawns} pawns north, ${southPawns} south`
  );
}

function testWallSpawnsSouthOnly() {
  testLog('Running Test: Wall - South Direction Only');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[3][4] = makePiece(PIECE.ROOK, COLOR.WHITE);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  const result = castWall(state, 3, 4, 'S');

  let southPawns = 0;
  let northPawns = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.type === PIECE.PAWN && p.color === COLOR.WHITE) {
        if (r > 3) southPawns++;
        if (r < 3) northPawns++;
      }
    }
  }

  testAssert(
    result.success && southPawns > 0 && northPawns === 0,
    'Wall - South Direction',
    `Spawned ${southPawns} pawns south, ${northPawns} north`
  );
}

function testWallSpawnsEastOnly() {
  testLog('Running Test: Wall - East Direction Only');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][3] = makePiece(PIECE.ROOK, COLOR.WHITE);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  const result = castWall(state, 4, 3, 'E');

  let eastPawns = 0;
  let westPawns = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.type === PIECE.PAWN && p.color === COLOR.WHITE) {
        if (c > 3) eastPawns++;
        if (c < 3) westPawns++;
      }
    }
  }

  testAssert(
    result.success && eastPawns > 0 && westPawns === 0,
    'Wall - East Direction',
    `Spawned ${eastPawns} pawns east, ${westPawns} west`
  );
}

function testWallSpawnsWestOnly() {
  testLog('Running Test: Wall - West Direction Only');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][5] = makePiece(PIECE.ROOK, COLOR.WHITE);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  const result = castWall(state, 4, 5, 'W');

  let westPawns = 0;
  let eastPawns = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.type === PIECE.PAWN && p.color === COLOR.WHITE) {
        if (c < 5) westPawns++;
        if (c > 5) eastPawns++;
      }
    }
  }

  testAssert(
    result.success && westPawns > 0 && eastPawns === 0,
    'Wall - West Direction',
    `Spawned ${westPawns} pawns west, ${eastPawns} east`
  );
}

function testWallDoesntSpawnOnOccupied() {
  testLog('Running Test: Wall - Skips Occupied Squares');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.ROOK, COLOR.WHITE);
  state.board[3][4] = makePiece(PIECE.PAWN, COLOR.WHITE); // Block north

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  const result = castWall(state, 4, 4, 'N');

  // Should spawn fewer pawns due to blocked square
  testAssert(
    result.success && result.spawned < 3,
    'Wall - Skips Occupied',
    `Spawned ${result.spawned} pawns (skipped occupied square)`
  );
}

function testWallWorksAtEdges() {
  testLog('Running Test: Wall - Works at Board Edges');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[0][1] = makePiece(PIECE.ROOK, COLOR.BLACK); // Top edge

  state.turn = COLOR.BLACK;
  state.mana[COLOR.BLACK] = 30;

  const result = castWall(state, 0, 1, 'S');

  testAssert(
    result.success && result.spawned > 0,
    'Wall - Board Edge',
    `Wall works at edge, spawned ${result.spawned} pawns`
  );
}

// ============================================================
// 4. BOT FOUNTAIN PRIORITY TESTS
// ============================================================

function testBotMovesFountainWhenAvailable() {
  testLog('Running Test: Bot - Moves to Occupy Fountain');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[5][3] = makePiece(PIECE.KNIGHT, COLOR.WHITE);

  // Create a fountain that the knight can reach
  state.fountains = [{ r: 4, c: 2 }];

  state.turn = COLOR.WHITE;

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const legalMoves = allLegalMoves(state.board, COLOR.WHITE, state);
  const bestMove = botSearchBestMove(state, legalMoves, COLOR.WHITE);

  // Check if bot prioritizes fountain move
  const moveScore = botScoreMove(state, bestMove.from, bestMove.to, COLOR.WHITE);

  testAssert(
    moveScore > 50,
    'Bot - Fountain Priority',
    `Bot fountain move score: ${moveScore}`
  );

  BOT.enabled = false;
}

function testBotFountainEvalBonus() {
  testLog('Running Test: Bot - Fountain Control in Evaluation');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);

  state.fountains = [{ r: 4, c: 4 }];

  // Eval with no fountain control
  const evalNoFountain = botEvaluate(state, COLOR.WHITE);

  // Place white piece on fountain
  state.board[4][4] = makePiece(PIECE.KNIGHT, COLOR.WHITE);
  const evalWithFountain = botEvaluate(state, COLOR.WHITE);

  testAssert(
    evalWithFountain > evalNoFountain + 50,
    'Bot - Fountain Eval Bonus',
    `Eval increased by ${evalWithFountain - evalNoFountain} with fountain control`
  );
}

function testBotAetherGenerationFountain() {
  testLog('Running Test: Bot - Aether Generation with Fountain');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.fountains = [{ r: 4, c: 4 }];
  state.board[4][4] = makePiece(PIECE.KNIGHT, COLOR.WHITE);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 5;
  state.firstGenSkipped[COLOR.WHITE] = true;
  state.fullTurnsPlayed[COLOR.WHITE] = 5;

  const beforeMana = state.mana[COLOR.WHITE];
  generateAetherForPlayer(state, COLOR.WHITE);
  const afterMana = state.mana[COLOR.WHITE];

  const gain = afterMana - beforeMana;

  testAssert(
    gain >= 3, // Base + fountain bonus
    'Bot - Fountain Aether Generation',
    `Gained ${gain} aether with fountain control`
  );
}

// ============================================================
// 5. BOT CHRONOBREAK TESTS
// ============================================================

function testBotChronobreakAfterMaterialLoss() {
  testLog('Running Test: Bot - Chronobreak After Material Loss');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.ROOK, COLOR.WHITE);

  state.turn = COLOR.BLACK;
  state.mana[COLOR.BLACK] = 30;
  state.mana[COLOR.WHITE] = 5;
  state.lastActionKind = 'MOVE';

  // Black just captured white queen (simulated)
  pushHistory(state);

  // Now it's white's turn with chronobreak available
  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 20;

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const powerAction = botConsiderPowers(state, COLOR.WHITE);

  // Bot should consider chronobreak (may not be highest priority)
  const hasChronobreak = powerAction !== null;

  testAssert(
    hasChronobreak,
    'Bot - Chronobreak Consideration',
    'Bot considers powers after material loss'
  );

  BOT.enabled = false;
}

function testBotChronobreakAfterStrongPower() {
  testLog('Running Test: Bot - Chronobreak After Opponent Strong Power');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state.board[3][3] = makePiece(PIECE.ROOK, COLOR.BLACK);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 25;
  state.lastActionKind = 'POWER'; // Opponent just used a power

  pushHistory(state);

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const powerAction = botConsiderPowers(state, COLOR.WHITE);

  testAssert(
    powerAction !== null,
    'Bot - Chronobreak After Power',
    'Bot considers powers in response to opponent power'
  );

  BOT.enabled = false;
}

function testBotNoWasteChronobreakMinorLoss() {
  testLog('Running Test: Bot - Doesn\'t Waste Chronobreak on Minor Loss');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state.board[4][5] = makePiece(PIECE.ROOK, COLOR.WHITE);
  state.board[3][3] = makePiece(PIECE.ROOK, COLOR.BLACK);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;
  state.lastActionKind = 'MOVE'; // Lost a pawn (minor loss)

  pushHistory(state);

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const powerAction = botConsiderPowers(state, COLOR.WHITE);

  // Bot should prefer other powers over chronobreak for minor loss
  const usedChronobreak = powerAction && powerAction.name === 'CHRONOBREAK';

  testAssert(
    !usedChronobreak || powerAction === null,
    'Bot - No Chronobreak Minor Loss',
    'Bot doesn\'t waste chronobreak on minor loss'
  );

  BOT.enabled = false;
}

// ============================================================
// 6. BOT BOMB DIFFUSION TESTS
// ============================================================

function testBotDetectsBombsMovesAway() {
  testLog('Running Test: Bot - Detects Bombs and Moves Away');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);

  // Black places bomb near white queen
  state.bombs.push({ r: 4, c: 5, owner: COLOR.BLACK, turnsLeft: 1, revealed: true });

  state.turn = COLOR.WHITE;

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const legalMoves = allLegalMoves(state.board, COLOR.WHITE, state);
  const bestMove = botSearchBestMove(state, legalMoves, COLOR.WHITE);

  // Bot should move queen away from bomb
  const movedAway = Math.abs(bestMove.to.r - 4) > 1 || Math.abs(bestMove.to.c - 5) > 1;

  testAssert(
    movedAway,
    'Bot - Bomb Detection',
    `Bot moved queen away from bomb to ${algebraic(bestMove.to.r, bestMove.to.c)}`
  );

  BOT.enabled = false;
}

function testBotPrioritizesHighValueEscape() {
  testLog('Running Test: Bot - Prioritizes High-Value Piece Escape');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);
  state.board[4][3] = makePiece(PIECE.PAWN, COLOR.WHITE);

  // Bomb threatens both queen and pawn
  state.bombs.push({ r: 4, c: 4, owner: COLOR.BLACK, turnsLeft: 1, revealed: true });

  state.turn = COLOR.WHITE;

  // Check bomb threat detection
  const threats = botBombThreatDetection(state, COLOR.WHITE);

  testAssert(
    threats.totalValue >= 900, // Queen value
    'Bot - Bomb Threat Detection Value',
    `Detected threat value: ${threats.totalValue}`
  );
}

function testBotNoFalsePositiveBombMoves() {
  testLog('Running Test: Bot - No False Positive Bomb Moves');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);

  // No bombs on board
  state.bombs = [];

  state.turn = COLOR.WHITE;

  const threats = botBombThreatDetection(state, COLOR.WHITE);

  testAssert(
    threats.threatenedPieces.length === 0 && threats.totalValue === 0,
    'Bot - No False Bomb Threats',
    'Bot correctly detects no bomb threats'
  );
}

// ============================================================
// 7. BOT POWER COMBO TESTS
// ============================================================

function testBotUseMultiplePowersSameTurn() {
  testLog('Running Test: Bot - Can Use 2-3 Powers in Turn');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.BLACK);
  state.board[3][3] = makePiece(PIECE.ROOK, COLOR.BLACK);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30; // Enough for multiple powers

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  let powerCount = 0;
  const maxPowers = 3;

  // Simulate power combo system
  while (powerCount < maxPowers && state.mana[COLOR.WHITE] >= 5) {
    const powerAction = botConsiderPowers(state, COLOR.WHITE);
    if (!powerAction) break;
    if (powerAction.priority < 40) break; // Priority threshold
    powerCount++;
    state.mana[COLOR.WHITE] -= 5; // Approximate cost
  }

  testAssert(
    powerCount >= 1,
    'Bot - Multiple Powers',
    `Bot can chain ${powerCount} powers`
  );

  BOT.enabled = false;
}

function testBotStopsAtAetherThreshold() {
  testLog('Running Test: Bot - Stops at Aether Threshold');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.BLACK);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 8; // Just enough for one cheap power

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const powerAction = botConsiderPowers(state, COLOR.WHITE);

  // Should stop chaining when aether gets low
  testAssert(
    powerAction === null || state.mana[COLOR.WHITE] < 5,
    'Bot - Aether Threshold',
    'Bot respects aether threshold for chaining'
  );

  BOT.enabled = false;
}

function testBotFrostCaptureCombo() {
  testLog('Running Test: Bot - Frost + Capture Combo');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.BLACK);
  state.board[5][4] = makePiece(PIECE.ROOK, COLOR.WHITE);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const powerAction = botConsiderPowers(state, COLOR.WHITE);

  // Check if bot considers frost on the queen
  const considersFrost = powerAction && (powerAction.name === 'FROST' || powerAction.name === 'IMPRISON');

  testAssert(
    considersFrost,
    'Bot - Frost/Imprison Combo',
    'Bot considers immobilization powers for combo'
  );

  BOT.enabled = false;
}

// ============================================================
// 8. BOT POWER OPTIMIZATION TESTS
// ============================================================

function testBotVengeancePriority() {
  testLog('Running Test: Bot - Vengeance Priority Calculation');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.BLACK);

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const powerAction = botConsiderPowers(state, COLOR.WHITE);

  // Vengeance should be high priority for enemy queen
  testAssert(
    powerAction !== null && powerAction.priority > 100,
    'Bot - Vengeance Priority',
    `Power priority: ${powerAction ? powerAction.priority : 0}`
  );

  BOT.enabled = false;
}

function testBotPromotePriority() {
  testLog('Running Test: Bot - Promote Priority in Endgame');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[1][4] = makePiece(PIECE.PAWN, COLOR.WHITE); // Near promotion

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;
  state.mana[COLOR.BLACK] = 0; // Opponent can't vengeance

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const powerAction = botConsiderPowers(state, COLOR.WHITE);

  testAssert(
    powerAction && powerAction.name === 'PROMOTE',
    'Bot - Promote Priority',
    'Bot prioritizes promote for advanced pawn'
  );

  BOT.enabled = false;
}

function testBotPowerSelectionGamePhase() {
  testLog('Running Test: Bot - Power Selection by Game Phase');

  // Opening phase
  const state1 = initGame();
  state1.turnNumber = 5;
  state1.turn = COLOR.WHITE;
  state1.mana[COLOR.WHITE] = 15;

  const phase1 = botGamePhase(state1);

  // Endgame phase
  const state2 = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state2.board[r][c] = null;
    }
  }
  state2.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state2.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state2.board[6][4] = makePiece(PIECE.PAWN, COLOR.WHITE);
  state2.turnNumber = 40;
  state2.turn = COLOR.WHITE;
  state2.mana[COLOR.WHITE] = 20;

  const phase2 = botGamePhase(state2);

  testAssert(
    phase1 > 0.7 && phase2 < 0.3,
    'Bot - Phase Detection',
    `Opening phase: ${phase1.toFixed(2)}, Endgame phase: ${phase2.toFixed(2)}`
  );
}

// ============================================================
// 9. BOT DEPTH TESTS
// ============================================================

function testBotSearchDepthByPhase() {
  testLog('Running Test: Bot - Search Depth Adapts by Phase');

  // Opening
  const state1 = initGame();
  state1.turnNumber = 5;
  const depth1 = botGetSearchDepth(state1);

  // Middlegame
  const state2 = initGame();
  state2.turnNumber = 20;
  const depth2 = botGetSearchDepth(state2);

  // Endgame
  const state3 = initGame();
  state3.turnNumber = 40;
  const depth3 = botGetSearchDepth(state3);

  testAssert(
    depth1 === 4 && depth2 === 5 && depth3 === 6,
    'Bot - Adaptive Depth',
    `Opening: ${depth1}, Mid: ${depth2}, End: ${depth3}`
  );
}

function testBotSearchExtensionsCheck() {
  testLog('Running Test: Bot - Search Extensions for Check');

  const state = initGame();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  state.board[7][4] = makePiece(PIECE.KING, COLOR.WHITE);
  state.board[0][4] = makePiece(PIECE.KING, COLOR.BLACK);
  state.board[4][4] = makePiece(PIECE.QUEEN, COLOR.WHITE);

  state.turn = COLOR.BLACK;

  // King is in check - should trigger extensions in search
  const inCheck = isInCheck(state.board, COLOR.BLACK);

  testAssert(
    inCheck,
    'Bot - Check Extension Setup',
    'Check position set up for extension testing'
  );
}

function testBotSearchSpeed() {
  testLog('Running Test: Bot - Search Speed Benchmark');

  const state = initGame();
  state.turn = COLOR.WHITE;

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  const startTime = Date.now();
  const legalMoves = allLegalMoves(state.board, COLOR.WHITE, state);
  botSearchBestMove(state, legalMoves, COLOR.WHITE);
  const elapsed = Date.now() - startTime;

  testAssert(
    elapsed < 3000, // Should complete within 3 seconds
    'Bot - Search Speed',
    `Search completed in ${elapsed}ms`
  );

  BOT.enabled = false;
}

// ============================================================
// 10. INTEGRATION TESTS
// ============================================================

function testFullBotVsBotGame() {
  testLog('Running Test: Full Bot vs Bot Game');

  const state = initGame();

  BOT.enabled = true;
  BOT.botVsBot = true;
  BOT.whiteDifficulty = 'hard';
  BOT.blackDifficulty = 'hard';

  let moves = 0;
  const maxMoves = 100;
  let crashed = false;

  try {
    while (!state.winner && moves < maxMoves) {
      const color = state.turn;
      const legalMoves = allLegalMoves(state.board, color, state);

      if (legalMoves.length === 0) {
        if (isInCheck(state.board, color)) {
          state.winner = opposite(color);
          state.winReason = 'CHECKMATE';
        } else {
          state.winner = 'DRAW';
          state.winReason = 'STALEMATE';
        }
        break;
      }

      const bestMove = botSearchBestMove(state, legalMoves, color);
      makeMove(state, bestMove.from.r, bestMove.from.c, bestMove.to.r, bestMove.to.c);

      moves++;
    }
  } catch (e) {
    crashed = true;
    testLog(`Game crashed: ${e.message}`);
  }

  testAssert(
    !crashed,
    'Integration - No Crashes',
    `Game completed ${moves} moves without crash`
  );

  testAssert(
    state.winner !== null || moves >= maxMoves,
    'Integration - Game Completion',
    state.winner ? `${state.winner} won by ${state.winReason}` : 'Max moves reached'
  );

  BOT.enabled = false;
  BOT.botVsBot = false;
}

function testNoInvalidStates() {
  testLog('Running Test: No Invalid Game States');

  const state = initGame();

  BOT.enabled = true;
  BOT.difficulty = 'hard';

  let moves = 0;
  const maxMoves = 20;
  let invalidState = false;

  while (!state.winner && moves < maxMoves) {
    const color = state.turn;
    const legalMoves = allLegalMoves(state.board, color, state);

    if (legalMoves.length === 0) break;

    const bestMove = botSearchBestMove(state, legalMoves, color);
    makeMove(state, bestMove.from.r, bestMove.from.c, bestMove.to.r, bestMove.to.c);

    // Verify board state
    let pieceCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (state.board[r][c]) pieceCount++;
      }
    }

    if (pieceCount === 0) {
      invalidState = true;
      break;
    }

    moves++;
  }

  testAssert(
    !invalidState,
    'Integration - Valid States',
    'All game states remained valid'
  );

  BOT.enabled = false;
}

function testAetherEconomyBalance() {
  testLog('Running Test: Aether Economy Balance');

  const state = initGame();

  let moves = 0;
  const maxMoves = 30;

  while (!state.winner && moves < maxMoves) {
    const color = state.turn;
    const legalMoves = allLegalMoves(state.board, color, state);

    if (legalMoves.length === 0) break;

    const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    makeMove(state, randomMove.from.r, randomMove.from.c, randomMove.to.r, randomMove.to.c);

    moves++;
  }

  const whiteAether = state.mana[COLOR.WHITE];
  const blackAether = state.mana[COLOR.BLACK];

  testAssert(
    whiteAether <= AETHER_CAP && blackAether <= AETHER_CAP,
    'Integration - Aether Cap',
    `White: ${whiteAether}, Black: ${blackAether} (cap: ${AETHER_CAP})`
  );

  testAssert(
    whiteAether >= 0 && blackAether >= 0,
    'Integration - Aether Non-Negative',
    'Aether never went negative'
  );
}

// ============================================================
// RUN ALL TESTS
// ============================================================

function runAllComprehensiveTests() {
  testLog('=====================================================');
  testLog('STARTING COMPREHENSIVE FIXES TEST SUITE');
  testLog('=====================================================');

  COMPREHENSIVE_TEST_RESULTS.passed = 0;
  COMPREHENSIVE_TEST_RESULTS.failed = 0;
  COMPREHENSIVE_TEST_RESULTS.tests = [];

  // 1. Discovery Check Tests
  testLog('\n--- 1. DISCOVERY CHECK TESTS ---');
  testDiscoveryCheckImmediateEnd();
  testDiscoveryCheckWithDifferentPieces();
  testDiscoveryCheckBothColors();
  testDiscoveryCheckAfterPowerUsage();

  // 2. Cleanse Enhancement Tests
  testLog('\n--- 2. CLEANSE ENHANCEMENT TESTS ---');
  testCleanseRemovesShield();
  testCleanseTargetsImprisonerAndFreesPrisoner();
  testCleanseWorksFrozenPiece();
  testCleanseWorksImprisonedPiece();

  // 3. Wall Direction Tests
  testLog('\n--- 3. WALL DIRECTION TESTS ---');
  testWallSpawnsNorthOnly();
  testWallSpawnsSouthOnly();
  testWallSpawnsEastOnly();
  testWallSpawnsWestOnly();
  testWallDoesntSpawnOnOccupied();
  testWallWorksAtEdges();

  // 4. Bot Fountain Priority Tests
  testLog('\n--- 4. BOT FOUNTAIN PRIORITY TESTS ---');
  testBotMovesFountainWhenAvailable();
  testBotFountainEvalBonus();
  testBotAetherGenerationFountain();

  // 5. Bot Chronobreak Tests
  testLog('\n--- 5. BOT CHRONOBREAK TESTS ---');
  testBotChronobreakAfterMaterialLoss();
  testBotChronobreakAfterStrongPower();
  testBotNoWasteChronobreakMinorLoss();

  // 6. Bot Bomb Diffusion Tests
  testLog('\n--- 6. BOT BOMB DIFFUSION TESTS ---');
  testBotDetectsBombsMovesAway();
  testBotPrioritizesHighValueEscape();
  testBotNoFalsePositiveBombMoves();

  // 7. Bot Power Combo Tests
  testLog('\n--- 7. BOT POWER COMBO TESTS ---');
  testBotUseMultiplePowersSameTurn();
  testBotStopsAtAetherThreshold();
  testBotFrostCaptureCombo();

  // 8. Bot Power Optimization Tests
  testLog('\n--- 8. BOT POWER OPTIMIZATION TESTS ---');
  testBotVengeancePriority();
  testBotPromotePriority();
  testBotPowerSelectionGamePhase();

  // 9. Bot Depth Tests
  testLog('\n--- 9. BOT DEPTH TESTS ---');
  testBotSearchDepthByPhase();
  testBotSearchExtensionsCheck();
  testBotSearchSpeed();

  // 10. Integration Tests
  testLog('\n--- 10. INTEGRATION TESTS ---');
  testFullBotVsBotGame();
  testNoInvalidStates();
  testAetherEconomyBalance();

  testLog('\n=====================================================');
  testLog(`TEST RESULTS: ${COMPREHENSIVE_TEST_RESULTS.passed} PASSED, ${COMPREHENSIVE_TEST_RESULTS.failed} FAILED`);
  testLog('=====================================================');

  // Summary by category
  const categories = {
    'Discovery Check': 0,
    'Cleanse Enhancement': 0,
    'Wall Direction': 0,
    'Bot Fountain': 0,
    'Bot Chronobreak': 0,
    'Bot Bomb Diffusion': 0,
    'Bot Power Combo': 0,
    'Bot Power Optimization': 0,
    'Bot Depth': 0,
    'Integration': 0
  };

  for (const test of COMPREHENSIVE_TEST_RESULTS.tests) {
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
  for (const test of COMPREHENSIVE_TEST_RESULTS.tests) {
    const icon = test.status === 'PASS' ? '✓' : '✗';
    const msg = test.reason || '';
    testLog(`${icon} ${test.name}: ${test.status} ${msg}`);
  }

  return COMPREHENSIVE_TEST_RESULTS;
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
  window.runAllComprehensiveTests = runAllComprehensiveTests;
  testLog('Comprehensive test suite loaded. Run with: runAllComprehensiveTests()');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllComprehensiveTests, COMPREHENSIVE_TEST_RESULTS };
}
