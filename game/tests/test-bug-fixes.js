// ============================================================
// Bug Fix Tests - Test suite for all reported bugs
// Run: node game/tests/test-bug-fixes.js
// ============================================================

const { initGame, makeMove, castCleanse, castFortify, castDoubleAttack,
        castImprison, castAetherBlock, castSpawn, sacrificePiece, PIECE, COLOR,
        POWER_COSTS, POWER, opposite } = require('../js/mana-system.js');

function log(msg) {
  console.log(`[TEST] ${msg}`);
}

function assert(condition, msg) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ ${msg}`);
}

// ============================================================
// Bug 1: Cleanse not removing shield
// ============================================================
function testCleanseRemovesShield() {
  log('\n=== Bug 1: Cleanse should remove shield ===');

  const state = initGame();
  // Give white enough aether
  state.mana[COLOR.WHITE] = 30;

  // Place a white pawn and fortify it
  const pawnR = 6, pawnC = 4;
  assert(state.board[pawnR][pawnC].type === PIECE.PAWN, 'Pawn exists at e2');

  const fortifyRes = castFortify(state, pawnR, pawnC);
  assert(fortifyRes.success, 'Fortify succeeded');
  assert(state.board[pawnR][pawnC].shieldHP === 1, 'Shield applied');

  // Give black enough aether
  state.mana[COLOR.BLACK] = 30;
  state.turn = COLOR.BLACK;

  // Cleanse the shielded pawn
  const cleanseRes = castCleanse(state, pawnR, pawnC);
  assert(cleanseRes.success, 'Cleanse succeeded');
  assert(cleanseRes.shieldRemoved, 'Cleanse reported shield removed');
  assert(state.board[pawnR][pawnC].shieldHP === 0, 'Shield HP is 0 after cleanse');

  log('✅ Bug 1 FIXED: Cleanse removes shield correctly');
}

// ============================================================
// Bug 2: Knight unable to double attack when imprisoned
// ============================================================
function testDoubleAttackWithImprisonedPiece() {
  log('\n=== Bug 2: Double Attack should work even if piece held a prisoner ===');

  const state = initGame();

  // Set up clean board for testing
  // White knight at c3, holding a prisoner
  // Black pawns at a5 and e5 as targets
  state.board[5][2] = { type: PIECE.KNIGHT, color: COLOR.WHITE, hasMoved: true,
                        imprisoned: { type: PIECE.PAWN, color: COLOR.BLACK } };
  state.board[3][0] = { type: PIECE.PAWN, color: COLOR.BLACK, hasMoved: true };
  state.board[3][4] = { type: PIECE.PAWN, color: COLOR.BLACK, hasMoved: true };

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  // Try Double Attack: Knight c3 captures a5, then captures e5
  const daRes = castDoubleAttack(state, 5, 2, 3, 0, 3, 4);

  assert(daRes.success, 'Captor can use Double Attack (Bug #2 fixed)');
  assert(state.board[3][0] === null, 'First target captured');
  assert(state.board[3][4] === null || state.board[3][4].color === COLOR.WHITE, 'Second target captured or occupied by attacker');

  log('✅ Bug 2 FIXED: Captors can use Double Attack');
}

// ============================================================
// Bug 3: Discovery check after sacrifice should pass turn
// ============================================================
function testDiscoveryCheckPassesTurn() {
  log('\n=== Bug 3: Discovery check after sacrifice should pass turn ===');

  const state = initGame();

  // Set up discovery check scenario:
  // White bishop on a1, Black pawn on a3 (blocking), Black king on a5
  // Sacrifice the black pawn -> discovery check on black king -> turn should pass

  // Clear board and set up pieces
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // White king at h1, Black king at a5
  state.board[7][7] = { type: PIECE.KING, color: COLOR.WHITE, hasMoved: false };
  state.board[3][0] = { type: PIECE.KING, color: COLOR.BLACK, hasMoved: false };

  // White bishop at a1 (aims at black king on diagonal)
  state.board[7][0] = { type: PIECE.BISHOP, color: COLOR.WHITE, hasMoved: false };

  // Black pawn at a3 (blocking the check)
  state.board[5][0] = { type: PIECE.PAWN, color: COLOR.BLACK, hasMoved: true };

  state.turn = COLOR.BLACK;
  state.mana[COLOR.BLACK] = 30;

  const turnBefore = state.turn;

  // Sacrifice the blocking pawn - should create discovery check
  const sacRes = sacrificePiece(state, 5, 0);

  assert(sacRes.success, 'Sacrifice succeeded');
  assert(sacRes.passedTurn === true, 'Turn passed due to discovery check (Bug #3 fixed)');
  assert(state.turn === COLOR.WHITE, 'Turn changed to opponent');

  log('✅ Bug 3 FIXED: Discovery check from sacrifice passes turn');
}

// ============================================================
// Bug 4: Spectral pawn should last only 1 turn, not 2
// ============================================================
function testSpectralPawnDuration() {
  log('\n=== Bug 4: Spectral pawn should vanish after current turn, not next turn ===');

  const state = initGame();
  state.mana[COLOR.WHITE] = 30;

  // Spawn a spectral pawn
  const spawnRes = castSpawn(state, 4, 4); // e4
  assert(spawnRes.success, 'Spawn succeeded');

  const spectral = state.board[4][4];
  assert(spectral && spectral.isSpectral, 'Spectral pawn placed');

  const currentTurn = state.turnNumber;
  log(`Spectral spawned on turn ${currentTurn}, expires on turn ${spectral.spectralExpireTurn}`);

  // Currently: spectralExpireTurn = state.turnNumber + 2 (line 1012)
  // This means it expires at START of turn N+2 (after opponent's turn N+1)
  // Bug says it should expire SOONER - after current turn only

  // Expected: spawn on turn N, vanish at start of turn N+1 (your next turn)
  // Current: spawn on turn N, vanish at start of turn N+2

  assert(spectral.spectralExpireTurn === currentTurn + 2, 'Current implementation: expires turn+2');
  log('Bug confirmed: should be turn+1 for "current turn only"');
  log('✅ Bug 4 needs fix: change line 1012 to spectralExpireTurn: state.turnNumber + 1');
}

// ============================================================
// Bug 5: Aether Block should prevent aether gain for opponent's next turn
// ============================================================
function testAetherBlockPreventsGain() {
  log('\n=== Bug 5: Aether Block should stop opponent aether gain on their next turn ===');

  const state = initGame();

  // Skip first turn setup
  state.firstGenSkipped[COLOR.WHITE] = true;
  state.firstGenSkipped[COLOR.BLACK] = true;
  state.fullTurnsPlayed[COLOR.WHITE] = 5;
  state.fullTurnsPlayed[COLOR.BLACK] = 5;

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;
  state.mana[COLOR.BLACK] = 5;

  // Cast Aether Block on black
  const blockRes = castAetherBlock(state);
  assert(blockRes.success, 'Aether Block cast');
  assert(state.aetherBlocked[COLOR.BLACK] === true, 'Black is aether blocked');

  // It's now black's turn (after endOfTurn in castAetherBlock)
  // Black should gain 0 aether despite being at turn 5+ with potential center/fountain bonuses

  const blackManaBefore = state.mana[COLOR.BLACK];

  // Manually call the start of turn aether generation
  const { generateAetherForPlayer } = require('../js/mana-system.js');
  generateAetherForPlayer(state, COLOR.BLACK);

  const blackManaAfter = state.mana[COLOR.BLACK];

  assert(blackManaAfter === blackManaBefore, `Black gained 0 aether (was ${blackManaBefore}, now ${blackManaAfter}) - Bug #5 fixed`);

  log('✅ Bug 5 FIXED: Aether Block prevents aether gain');
}

// ============================================================
// Bug 6: Double Attack should work against shielded pieces (2 hits)
// ============================================================
function testDoubleAttackBreaksShield() {
  log('\n=== Bug 6: Double Attack should kill shielded piece with 2 hits ===');

  const state = initGame();

  // Clear center area for clean test
  for (let r = 2; r < 6; r++) {
    for (let c = 0; c < 8; c++) {
      state.board[r][c] = null;
    }
  }

  // Place white queen at d4
  state.board[4][3] = { type: PIECE.QUEEN, color: COLOR.WHITE, hasMoved: true };

  // Place shielded black pawn at e5
  state.board[3][4] = { type: PIECE.PAWN, color: COLOR.BLACK, shieldHP: 1, hasMoved: true };

  state.turn = COLOR.WHITE;
  state.mana[COLOR.WHITE] = 30;

  // Double Attack: Q d4 → e5 (break shield, stay at d4) → e5 again (capture)
  const daRes = castDoubleAttack(state, 4, 3, 3, 4, 3, 4);

  assert(daRes.success, 'Double Attack succeeded');
  assert(daRes.firstShieldBlock === true, 'First hit broke shield');
  assert(state.board[3][4] === null || state.board[3][4].color === COLOR.WHITE, 'Second hit captured piece (Bug #6 fixed)');

  log('✅ Bug 6 FIXED: Double Attack can kill shielded piece');
}

// ============================================================
// Bug 7: Adjust aether costs
// ============================================================
function testAetherCosts() {
  log('\n=== Bug 7: Verify new aether costs ===');

  // Shield -> 14 (currently 7)
  // Aether Block -> 16 (currently 10)
  // Double Attack -> 14 (currently 12)

  assert(POWER_COSTS[POWER.FORTIFY] === 7, 'Current Fortify cost: 7 (should be 14)');
  assert(POWER_COSTS[POWER.AETHER_BLOCK] === 10, 'Current Aether Block cost: 10 (should be 16)');
  assert(POWER_COSTS[POWER.DOUBLE_ATTACK] === 12, 'Current Double Attack cost: 12 (should be 14)');

  log('✅ Bug 7: Need to update POWER_COSTS object');
}

// ============================================================
// Human Game Analysis Tests
// ============================================================
function testChronobreakAfterSacrifice() {
  log('\n=== Human Game Bug: Chronobreak after sacrifice with discovery check ===');

  // From game: "Black sacrificed Pawn at h7: +1 Aether. Black ♛ Promote..."
  // Then chronobreak triggered unexpectedly

  // The issue: if sacrifice creates a discovery check, chronobreak shouldn't trigger
  // because the position is valid - opponent IS in check but that's allowed

  // Chronobreak should only trigger on CHECKMATE that was delivered
  // But rule says "CANNOT undo a checkmate (the game is already over)"

  log('Need to review sacrifice + discovery check interaction');
  log('Sacrifice should check if opponent is in check after, and if so, end turn');
}

// ============================================================
// Run all tests
// ============================================================
function runAllTests() {
  try {
    testCleanseRemovesShield();
    testDoubleAttackWithImprisonedPiece();
    testDiscoveryCheckPassesTurn();
    testSpectralPawnDuration();
    testAetherBlockPreventsGain();
    testDoubleAttackBreaksShield();
    testAetherCosts();
    testChronobreakAfterSacrifice();

    log('\n=== ✅ ALL TESTS COMPLETED ===');
  } catch (e) {
    log('\n=== ❌ TESTS FAILED ===');
    console.error(e);
    process.exit(1);
  }
}

runAllTests();
