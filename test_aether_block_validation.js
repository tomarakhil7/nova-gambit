#!/usr/bin/env node
/**
 * AETHER_BLOCK Validation Test
 *
 * Tests the new opponent aether prediction + strategic blocking system
 * Validates:
 * 1. Forced spend block detection (30 aether)
 * 2. Preemptive combo block (24-27 aether)
 * 3. Checkmate threat block detection
 * 4. Enable our checkmate scenario
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Load game code into VM
const gameCode = fs.readFileSync(path.join(__dirname, 'game', 'js', 'game.js'), 'utf8');
const chessCode = fs.readFileSync(path.join(__dirname, 'game', 'js', 'chess-engine.js'), 'utf8');
const manaCode = fs.readFileSync(path.join(__dirname, 'game', 'js', 'mana-system.js'), 'utf8');
const botCode = fs.readFileSync(path.join(__dirname, 'game', 'js', 'bot.js'), 'utf8');

const context = {
  console,
  require: require,
  __dirname: __dirname,
};

vm.runInNewContext(gameCode, context);
vm.runInNewContext(chessCode, context);
vm.runInNewContext(manaCode, context);
vm.runInNewContext(botCode, context);

const {
  newGameState,
  makeMove,
  allLegalMoves,
  getGameStatus,
} = context;

const {
  botMakeMove,
} = context;

console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('AETHER_BLOCK STRATEGIC VALIDATION TEST');
console.log('════════════════════════════════════════════════════════════════════════════════');

// Helper to run games
function runTestGames(numGames) {
  let blocksDetected = 0;
  let forcedSpendBlocks = 0;
  let preemptiveBlocks = 0;
  let checkmateThreatBlocks = 0;
  let enableOurMateBlocks = 0;
  let gamesCompleted = 0;

  for (let g = 0; g < numGames; g++) {
    const state = newGameState();
    let moveCount = 0;
    const maxMoves = 100;

    while (getGameStatus(state) === 'ongoing' && moveCount < maxMoves) {
      const color = state.turnNumber % 2 === 0 ? 'white' : 'black';

      try {
        // Get bot move with full candidate analysis
        const moves = allLegalMoves(state.board, color, state);
        if (moves.length === 0) break;

        // Make the move (capture AETHER_BLOCK debug output)
        const oldLog = console.error;
        let debugOutput = '';
        console.error = (msg) => {
          debugOutput += msg + '\n';
          oldLog(msg);
        };

        const bestMove = botMakeMove(state, color, 'hard');

        console.error = oldLog;

        if (!bestMove) break;

        // Analyze debug output for AETHER_BLOCK usage
        if (debugOutput.includes('AETHER_BLOCK')) {
          blocksDetected++;
          if (debugOutput.includes('FORCED_SPEND_AT_CAP')) forcedSpendBlocks++;
          if (debugOutput.includes('SETUP_CHECKMATE_PREEMPT')) preemptiveBlocks++;
          if (debugOutput.includes('BLOCK_CHECKMATE_THREAT')) checkmateThreatBlocks++;
          if (debugOutput.includes('ENABLE_OUR_CHECKMATE')) enableOurMateBlocks++;
        }

        makeMove(state, bestMove.from.r, bestMove.from.c, bestMove.to.r, bestMove.to.c);
        moveCount++;
      } catch (e) {
        console.error(`Game ${g+1}: Error at move ${moveCount}:`, e.message);
        break;
      }
    }

    gamesCompleted++;
    if ((g + 1) % 5 === 0) {
      console.log(`Progress: ${g + 1}/${numGames} games completed...`);
    }
  }

  return {
    gamesCompleted,
    blocksDetected,
    forcedSpendBlocks,
    preemptiveBlocks,
    checkmateThreatBlocks,
    enableOurMateBlocks,
    avgBlocksPerGame: gamesCompleted > 0 ? (blocksDetected / gamesCompleted).toFixed(2) : 0,
  };
}

// Run validation
console.log('\n🔍 Running 5 validation games...\n');
const results = runTestGames(5);

console.log('\n════════════════════════════════════════════════════════════════════════════════');
console.log('📊 AETHER_BLOCK VALIDATION RESULTS');
console.log('════════════════════════════════════════════════════════════════════════════════\n');

console.log(`✅ Games completed: ${results.gamesCompleted}/5`);
console.log(`🎯 Total AETHER_BLOCK usages: ${results.blocksDetected}`);
console.log(`📊 Avg blocks per game: ${results.avgBlocksPerGame}\n`);

console.log('Strategic Blocks by Type:');
console.log(`  • FORCED_SPEND (opponent at 30ae): ${results.forcedSpendBlocks}`);
console.log(`  • PREEMPTIVE_COMBO (24-27ae build): ${results.preemptiveBlocks}`);
console.log(`  • CHECKMATE_THREAT (26+ with mate): ${results.checkmateThreatBlocks}`);
console.log(`  • ENABLE_OUR_MATE (setup our combo): ${results.enableOurMateBlocks}\n`);

if (results.blocksDetected > 0) {
  console.log('✨ SUCCESS: AETHER_BLOCK strategy is being used!');
  console.log('   Bot is now predicting opponent aether and blocking strategically.');
} else {
  console.log('⚠️  No AETHER_BLOCK usage detected in 5 games.');
  console.log('   This may be expected if games end quickly.');
  console.log('   Try running longer games or checking diagnostic output.');
}

console.log('\n════════════════════════════════════════════════════════════════════════════════');
console.log('✅ AETHER_BLOCK validation test complete!');
console.log('════════════════════════════════════════════════════════════════════════════════\n');

process.exit(results.blocksDetected > 0 ? 0 : 1);
