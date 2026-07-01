#!/usr/bin/env node
/**
 * Standalone Bot vs Bot Test Runner
 * Runs multiple bot games and collects statistics
 */

// Mock browser globals
global.console = console;
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
};
global.window = global;

// Load game modules
const fs = require('fs');
const path = require('path');

function loadModule(filename) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', filename), 'utf8');
  // Remove any import/export statements and eval
  const cleanCode = code.replace(/export\s+/g, '').replace(/import\s+.*from.*['"];?/g, '');
  eval(cleanCode);
}

console.log('Loading game modules...');
loadModule('chess-engine.js');
loadModule('mana-system.js');
loadModule('bot.js');

console.log('Modules loaded successfully!\n');

// Game runner
function runBotGame(gameNum, whiteDiff, blackDiff) {
  console.log(`\n========== Game ${gameNum}: ${whiteDiff} vs ${blackDiff} ==========`);

  const state = createInitialGameState();
  let moveCount = 0;
  const maxMoves = 200;

  const stats = {
    gameNum,
    whiteDiff,
    blackDiff,
    moves: 0,
    winner: null,
    reason: null,
    whiteAether: [],
    blackAether: [],
    powerUsage: { white: {}, black: {} }
  };

  while (!state.winner && moveCount < maxMoves) {
    moveCount++;
    const color = state.turn;

    // Record aether
    stats.whiteAether.push(state.mana[COLOR.WHITE]);
    stats.blackAether.push(state.mana[COLOR.BLACK]);

    // Bot move
    BOT.difficulty = color === COLOR.WHITE ? whiteDiff : blackDiff;
    const move = botChooseMove(state, color);

    if (!move) {
      console.log(`Turn ${moveCount}: ${color === COLOR.WHITE ? 'White' : 'Black'} has no legal moves`);
      break;
    }

    // Execute move
    if (move.type === 'move') {
      const result = makeMove(state, move.from.r, move.from.c, move.to.r, move.to.c);
      if (result.error) {
        console.log(`Turn ${moveCount}: Move error: ${result.error}`);
        break;
      }
    } else if (move.type === 'power') {
      const result = move.exec();
      if (result.error) {
        console.log(`Turn ${moveCount}: Power error: ${result.error}`);
      } else {
        // Track power usage
        const powerName = move.payload?.power || 'UNKNOWN';
        const colorKey = color === COLOR.WHITE ? 'white' : 'black';
        stats.powerUsage[colorKey][powerName] = (stats.powerUsage[colorKey][powerName] || 0) + 1;
      }
    }

    if (moveCount % 20 === 0) {
      console.log(`Turn ${moveCount}: W=${state.mana[COLOR.WHITE]} aether, B=${state.mana[COLOR.BLACK]} aether`);
    }
  }

  stats.moves = moveCount;
  if (state.winner) {
    stats.winner = state.winner === COLOR.WHITE ? 'white' : 'black';
    stats.reason = state.winReason || 'CHECKMATE';
    console.log(`\nGame ${gameNum} Result: ${stats.winner} wins by ${stats.reason} in ${moveCount} moves`);
  } else {
    stats.winner = 'draw';
    stats.reason = 'MAX_MOVES';
    console.log(`\nGame ${gameNum} Result: Draw (max moves)`);
  }

  // Statistics
  const avgWhiteAether = stats.whiteAether.reduce((a,b) => a+b, 0) / stats.whiteAether.length;
  const avgBlackAether = stats.blackAether.reduce((a,b) => a+b, 0) / stats.blackAether.length;
  console.log(`Average Aether: White ${avgWhiteAether.toFixed(1)}, Black ${avgBlackAether.toFixed(1)}`);
  console.log(`White Powers:`, Object.keys(stats.powerUsage.white).length > 0 ? stats.powerUsage.white : 'None');
  console.log(`Black Powers:`, Object.keys(stats.powerUsage.black).length > 0 ? stats.powerUsage.black : 'None');

  return stats;
}

// Run multiple games
function runBotTournament(numGames = 10) {
  console.log(`\n🤖 NOVA GAMBIT BOT TOURNAMENT - ${numGames} GAMES\n`);
  console.log('Testing new bot improvements:');
  console.log('- Aether economy awareness');
  console.log('- Smart trading');
  console.log('- Power combo detection');
  console.log('- Anti-hoarding behavior');
  console.log('- Enhanced fountain/center fighting\n');

  const results = [];
  let whiteWins = 0, blackWins = 0, draws = 0;

  for (let i = 1; i <= numGames; i++) {
    const stats = runBotGame(i, 'hard', 'hard');
    results.push(stats);

    if (stats.winner === 'white') whiteWins++;
    else if (stats.winner === 'black') blackWins++;
    else draws++;
  }

  // Aggregate statistics
  console.log('\n========================================');
  console.log('TOURNAMENT RESULTS');
  console.log('========================================');
  console.log(`Total Games: ${numGames}`);
  console.log(`White Wins: ${whiteWins} (${(whiteWins/numGames*100).toFixed(1)}%)`);
  console.log(`Black Wins: ${blackWins} (${(blackWins/numGames*100).toFixed(1)}%)`);
  console.log(`Draws: ${draws} (${(draws/numGames*100).toFixed(1)}%)`);

  const avgMoves = results.reduce((sum, r) => sum + r.moves, 0) / numGames;
  console.log(`\nAverage Game Length: ${avgMoves.toFixed(1)} moves`);

  // Aggregate power usage
  const allWhitePowers = {};
  const allBlackPowers = {};
  results.forEach(r => {
    Object.entries(r.powerUsage.white).forEach(([power, count]) => {
      allWhitePowers[power] = (allWhitePowers[power] || 0) + count;
    });
    Object.entries(r.powerUsage.black).forEach(([power, count]) => {
      allBlackPowers[power] = (allBlackPowers[power] || 0) + count;
    });
  });

  console.log('\nPower Usage (White):');
  Object.entries(allWhitePowers).sort((a,b) => b[1] - a[1]).forEach(([power, count]) => {
    console.log(`  ${power}: ${count} (avg ${(count/numGames).toFixed(1)}/game)`);
  });

  console.log('\nPower Usage (Black):');
  Object.entries(allBlackPowers).sort((a,b) => b[1] - a[1]).forEach(([power, count]) => {
    console.log(`  ${power}: ${count} (avg ${(count/numGames).toFixed(1)}/game)`);
  });

  // Aether statistics
  const allWhiteAether = results.flatMap(r => r.whiteAether);
  const allBlackAether = results.flatMap(r => r.blackAether);
  const avgWhite = allWhiteAether.reduce((a,b) => a+b, 0) / allWhiteAether.length;
  const avgBlack = allBlackAether.reduce((a,b) => a+b, 0) / allBlackAether.length;
  const maxWhite = Math.max(...allWhiteAether);
  const maxBlack = Math.max(...allBlackAether);

  console.log('\nAether Statistics:');
  console.log(`  White: avg ${avgWhite.toFixed(1)}, max ${maxWhite}`);
  console.log(`  Black: avg ${avgBlack.toFixed(1)}, max ${maxBlack}`);

  // Check for hoarding (>25 aether)
  const whiteHoarding = allWhiteAether.filter(a => a > 25).length;
  const blackHoarding = allBlackAether.filter(a => a > 25).length;
  const totalSamples = allWhiteAether.length + allBlackAether.length;
  const hoardingRate = (whiteHoarding + blackHoarding) / totalSamples * 100;

  console.log(`\nHoarding Analysis:`);
  console.log(`  Turns with >25 aether: ${whiteHoarding + blackHoarding} / ${totalSamples} (${hoardingRate.toFixed(1)}%)`);
  console.log(`  Target: <5% hoarding rate`);

  return results;
}

// Run tournament
const numGames = process.argv[2] ? parseInt(process.argv[2]) : 10;
try {
  runBotTournament(numGames);
} catch (error) {
  console.error('Error running tournament:', error);
  console.error(error.stack);
  process.exit(1);
}
