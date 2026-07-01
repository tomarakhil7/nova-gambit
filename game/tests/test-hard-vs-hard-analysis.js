// Hard vs Hard Bot Analysis - 20 games with detailed statistics
const fs = require('fs');
const vm = require('vm');

const sandbox = {
  console, Math, Date, Array, Object, String, Number, Boolean, JSON,
  parseInt, parseFloat, isNaN, isFinite, undefined, Infinity, NaN,
  setTimeout: (fn) => fn(), clearInterval: () => {}, setInterval: () => {},
  document: { getElementById: () => null, createElement: () => ({ innerHTML: '', appendChild: () => {}, addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild: () => {} } },
};
sandbox.UI = { state: null, gameActions: [], selected: null, activePower: null, powerState: {}, prevAether: {} };
sandbox.render = function() {};
sandbox.setStatus = function() {};
sandbox.floatingText = function() {};
sandbox.buildBoard = function() {};
sandbox.showGameOverModal = function() {};
sandbox.recordAction = function() {};

const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('game/js/chess-engine.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('game/js/mana-system.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('game/js/bot.js', 'utf8'), ctx);

const testCode = `
const GAMES = 20;
const allGames = [];
const powerStats = {
  FROST: 0, FORTIFY: 0, SPAWN: 0, BLINK: 0,
  IMPRISON: 0, AETHER_BLOCK: 0, CLEANSE: 0, BOMBA: 0, DOUBLE_ATTACK: 0,
  PROMOTE: 0, VENGEANCE: 0, WALL: 0, CHRONOBREAK: 0
};
const comboUsed = [];
const fountainOccupation = { totalTurns: 0, occupied: 0 };
const searchDepthReached = [];
const avgTimePerMove = [];

// Track bot decisions
let currentGameStats = null;

// Hook into botConsiderPowers to track power usage
const originalBotConsiderPowers = botConsiderPowers;
botConsiderPowers = function(state, color) {
  const result = originalBotConsiderPowers(state, color);
  if (result && currentGameStats) {
    currentGameStats.powersUsed.push(result.power);
    if (powerStats[result.power] !== undefined) {
      powerStats[result.power]++;
    }
  }
  return result;
};

// Hook into botSearchBestMove to track search depth
const originalBotSearchBestMove = botSearchBestMove;
botSearchBestMove = function(state, moves, color) {
  const start = Date.now();
  const result = originalBotSearchBestMove(state, moves, color);
  const elapsed = Date.now() - start;
  if (currentGameStats) {
    currentGameStats.searchTimes.push(elapsed);
  }
  return result;
};

console.log('='.repeat(80));
console.log('HARD BOT vs HARD BOT ANALYSIS - 20 GAMES');
console.log('='.repeat(80));
console.log('');

for (let g = 0; g < GAMES; g++) {
  UI.state = initGame();
  botClearHistory();

  currentGameStats = {
    gameNumber: g + 1,
    outcome: null,
    winReason: null,
    turns: 0,
    powersUsed: [],
    aetherHistory: { w: [], b: [] },
    fountainOccupation: 0,
    fountainChecks: 0,
    bombsPlanted: 0,
    bombsDetonated: 0,
    bombsDefused: 0,
    chronobreakUsed: 0,
    powerCombos: [],
    searchTimes: [],
    duration: 0
  };

  const maxTurns = 150;
  const gameStart = Date.now();

  while (!UI.state.winner && currentGameStats.turns < maxTurns) {
    const color = UI.state.turn;
    BOT.difficulty = 'hard';
    BOT.enabled = true;
    BOT.botVsBot = true;

    // Track aether
    currentGameStats.aetherHistory[color].push(UI.state.mana[color] || 0);

    // Track fountain occupation
    if (UI.state.fountains) {
      for (const fount of UI.state.fountains) {
        const piece = UI.state.board[fount.r][fount.c];
        if (piece && piece.color === color) {
          currentGameStats.fountainOccupation++;
        }
      }
      currentGameStats.fountainChecks++;
    }

    // Track bombs before turn
    const bombsBefore = (UI.state.bombs || []).length;

    const moves = allLegalMoves(UI.state.board, color, UI.state);
    if (moves.length === 0) {
      if (isInCheck(UI.state.board, color)) {
        UI.state.winner = opposite(color);
        UI.state.winReason = 'CHECKMATE';
      } else {
        UI.state.winner = 'DRAW';
        UI.state.winReason = 'STALEMATE';
      }
      break;
    }

    // Track power usage (including combos)
    const powersBefore = currentGameStats.powersUsed.length;
    const power = botConsiderPowers(UI.state, color);
    if (power) {
      const r = power.exec();
      if (r && r.success) {
        // Track Chronobreak
        if (power.power === 'CHRONOBREAK') {
          currentGameStats.chronobreakUsed++;
        }

        // Check if combo (multiple powers in one turn)
        const powersAfter = currentGameStats.powersUsed.length;
        if (powersAfter - powersBefore > 1) {
          currentGameStats.powerCombos.push(
            currentGameStats.powersUsed.slice(powersBefore, powersAfter).join(' + ')
          );
        }

        if (UI.state.turn !== color) {
          currentGameStats.turns++;
          continue;
        }
      }
    }

    const bookMove = botGetBookMove(UI.state, color, moves);
    const chosenMove = bookMove || botSearchBestMove(UI.state, moves, color);

    const piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
    let promo;
    if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) promo = 'Q';

    makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);

    // Track bombs after turn
    const bombsAfter = (UI.state.bombs || []).length;
    if (bombsAfter > bombsBefore) {
      currentGameStats.bombsPlanted += (bombsAfter - bombsBefore);
    } else if (bombsAfter < bombsBefore) {
      // Bomb detonated or defused
      currentGameStats.bombsDetonated += (bombsBefore - bombsAfter);
    }

    currentGameStats.turns++;
  }

  if (!UI.state.winner && currentGameStats.turns >= maxTurns) {
    UI.state.winner = 'DRAW';
    UI.state.winReason = 'MAX_TURNS';
  }

  currentGameStats.duration = (Date.now() - gameStart) / 1000;
  currentGameStats.outcome = UI.state.winner;
  currentGameStats.winReason = UI.state.winReason;

  // Calculate averages for this game
  const avgAetherW = currentGameStats.aetherHistory.w.length > 0
    ? currentGameStats.aetherHistory.w.reduce((a,b)=>a+b,0) / currentGameStats.aetherHistory.w.length
    : 0;
  const avgAetherB = currentGameStats.aetherHistory.b.length > 0
    ? currentGameStats.aetherHistory.b.reduce((a,b)=>a+b,0) / currentGameStats.aetherHistory.b.length
    : 0;
  const fountainRate = currentGameStats.fountainChecks > 0
    ? (currentGameStats.fountainOccupation / currentGameStats.fountainChecks * 100)
    : 0;
  const avgSearchTime = currentGameStats.searchTimes.length > 0
    ? currentGameStats.searchTimes.reduce((a,b)=>a+b,0) / currentGameStats.searchTimes.length
    : 0;

  allGames.push(currentGameStats);

  const outcome = currentGameStats.outcome === 'w' ? 'WHITE' :
                  currentGameStats.outcome === 'b' ? 'BLACK' : 'DRAW';

  console.log(\`Game \${g+1}/\${GAMES}: \${outcome} (\${currentGameStats.winReason}, \${currentGameStats.turns} turns, \${currentGameStats.duration.toFixed(1)}s)\`);
  console.log(\`  Powers: \${currentGameStats.powersUsed.length} used, \${currentGameStats.powerCombos.length} combos\`);
  console.log(\`  Aether: W=\${avgAetherW.toFixed(1)}, B=\${avgAetherB.toFixed(1)}\`);
  console.log(\`  Fountain: \${fountainRate.toFixed(0)}% occupation\`);
  console.log(\`  Bombs: \${currentGameStats.bombsPlanted} planted, \${currentGameStats.bombsDetonated} detonated\`);
  if (currentGameStats.chronobreakUsed > 0) {
    console.log(\`  Chronobreak: used \${currentGameStats.chronobreakUsed} times\`);
  }
  console.log('');
}

console.log('='.repeat(80));
console.log('AGGREGATE STATISTICS');
console.log('='.repeat(80));
console.log('');

// Outcome distribution
const outcomes = { white: 0, black: 0, draw: 0 };
const winReasons = {};
allGames.forEach(g => {
  if (g.outcome === 'w') outcomes.white++;
  else if (g.outcome === 'b') outcomes.black++;
  else outcomes.draw++;

  winReasons[g.winReason] = (winReasons[g.winReason] || 0) + 1;
});

console.log('OUTCOMES:');
console.log(\`  White wins: \${outcomes.white} (\${(outcomes.white/GAMES*100).toFixed(0)}%)\`);
console.log(\`  Black wins: \${outcomes.black} (\${(outcomes.black/GAMES*100).toFixed(0)}%)\`);
console.log(\`  Draws: \${outcomes.draw} (\${(outcomes.draw/GAMES*100).toFixed(0)}%)\`);
console.log('');

console.log('WIN REASONS:');
Object.keys(winReasons).sort((a,b) => winReasons[b] - winReasons[a]).forEach(reason => {
  console.log(\`  \${reason}: \${winReasons[reason]} (\${(winReasons[reason]/GAMES*100).toFixed(0)}%)\`);
});
console.log('');

// Game length
const avgTurns = allGames.reduce((sum, g) => sum + g.turns, 0) / GAMES;
const avgDuration = allGames.reduce((sum, g) => sum + g.duration, 0) / GAMES;
const avgSearchTime = allGames.reduce((sum, g) => {
  return sum + (g.searchTimes.length > 0 ? g.searchTimes.reduce((a,b)=>a+b,0) / g.searchTimes.length : 0);
}, 0) / GAMES;

console.log('GAME METRICS:');
console.log(\`  Avg turns per game: \${avgTurns.toFixed(1)}\`);
console.log(\`  Avg duration: \${avgDuration.toFixed(1)}s\`);
console.log(\`  Avg search time per move: \${avgSearchTime.toFixed(0)}ms\`);
console.log('');

// Power usage
const totalPowers = Object.values(powerStats).reduce((a,b)=>a+b, 0);
console.log(\`POWER USAGE (total: \${totalPowers}):\`);
Object.keys(powerStats)
  .sort((a,b) => powerStats[b] - powerStats[a])
  .forEach(power => {
    if (powerStats[power] > 0) {
      const pct = (powerStats[power] / totalPowers * 100).toFixed(1);
      const perGame = (powerStats[power] / GAMES).toFixed(1);
      console.log(\`  \${power}: \${powerStats[power]} (\${pct}%, \${perGame}/game)\`);
    }
  });
console.log('');

// Combos
const totalCombos = allGames.reduce((sum, g) => sum + g.powerCombos.length, 0);
console.log(\`POWER COMBOS (total: \${totalCombos}, \${(totalCombos/GAMES).toFixed(1)}/game):\`);
const comboTypes = {};
allGames.forEach(g => {
  g.powerCombos.forEach(combo => {
    comboTypes[combo] = (comboTypes[combo] || 0) + 1;
  });
});
Object.keys(comboTypes)
  .sort((a,b) => comboTypes[b] - comboTypes[a])
  .slice(0, 10)
  .forEach(combo => {
    console.log(\`  \${combo}: \${comboTypes[combo]} times\`);
  });
console.log('');

// Aether economy
const avgAetherW = allGames.reduce((sum, g) => {
  return sum + (g.aetherHistory.w.length > 0 ? g.aetherHistory.w.reduce((a,b)=>a+b,0) / g.aetherHistory.w.length : 0);
}, 0) / GAMES;
const avgAetherB = allGames.reduce((sum, g) => {
  return sum + (g.aetherHistory.b.length > 0 ? g.aetherHistory.b.reduce((a,b)=>a+b,0) / g.aetherHistory.b.length : 0);
}, 0) / GAMES;

console.log('AETHER ECONOMY:');
console.log(\`  White avg aether: \${avgAetherW.toFixed(1)}\`);
console.log(\`  Black avg aether: \${avgAetherB.toFixed(1)}\`);
console.log('');

// Fountain control
const avgFountainRate = allGames.reduce((sum, g) => {
  return sum + (g.fountainChecks > 0 ? (g.fountainOccupation / g.fountainChecks * 100) : 0);
}, 0) / GAMES;

console.log('FOUNTAIN CONTROL:');
console.log(\`  Avg occupation rate: \${avgFountainRate.toFixed(1)}%\`);
console.log('');

// Bombs
const totalBombsPlanted = allGames.reduce((sum, g) => sum + g.bombsPlanted, 0);
const totalBombsDetonated = allGames.reduce((sum, g) => sum + g.bombsDetonated, 0);
const gamesWithBombs = allGames.filter(g => g.bombsPlanted > 0).length;

console.log('BOMB MECHANICS:');
console.log(\`  Total bombs planted: \${totalBombsPlanted} (\${(totalBombsPlanted/GAMES).toFixed(1)}/game)\`);
console.log(\`  Total bombs detonated: \${totalBombsDetonated} (\${(totalBombsDetonated/GAMES).toFixed(1)}/game)\`);
console.log(\`  Games with bombs: \${gamesWithBombs} (\${(gamesWithBombs/GAMES*100).toFixed(0)}%)\`);
if (totalBombsPlanted > 0) {
  console.log(\`  Detonation rate: \${(totalBombsDetonated/totalBombsPlanted*100).toFixed(0)}%\`);
}
console.log('');

// Chronobreak
const totalChronobreak = allGames.reduce((sum, g) => sum + g.chronobreakUsed, 0);
const gamesWithChronobreak = allGames.filter(g => g.chronobreakUsed > 0).length;

console.log('CHRONOBREAK:');
console.log(\`  Total uses: \${totalChronobreak} (\${(totalChronobreak/GAMES).toFixed(2)}/game)\`);
console.log(\`  Games with Chronobreak: \${gamesWithChronobreak} (\${(gamesWithChronobreak/GAMES*100).toFixed(0)}%)\`);
console.log('');

console.log('='.repeat(80));
`;

console.log('Running Hard vs Hard Bot Analysis...');
console.log('');
const start = Date.now();
vm.runInContext(testCode, ctx, { timeout: 1200000 }); // 20 minutes timeout
console.log('');
console.log('Total execution time: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
