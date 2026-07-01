// Medium vs Medium Bot Analysis - faster for analysis purposes
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

console.log('='.repeat(80));
console.log('MEDIUM BOT vs MEDIUM BOT ANALYSIS - 20 GAMES');
console.log('(Using medium difficulty for faster analysis of power mechanics)');
console.log('='.repeat(80));
console.log('');

for (let g = 0; g < GAMES; g++) {
  UI.state = initGame();
  botClearHistory();

  const gameStats = {
    gameNumber: g + 1,
    outcome: null,
    winReason: null,
    turns: 0,
    powersUsed: [],
    aetherW: [],
    aetherB: [],
    bombsPlanted: 0,
    bombsDetonated: 0,
    chronobreakUsed: 0,
    duration: 0
  };

  const maxTurns = 150;
  const gameStart = Date.now();

  while (!UI.state.winner && gameStats.turns < maxTurns) {
    const color = UI.state.turn;
    BOT.difficulty = 'medium';
    BOT.enabled = true;
    BOT.botVsBot = true;

    gameStats.aetherW.push(UI.state.mana['w'] || 0);
    gameStats.aetherB.push(UI.state.mana['b'] || 0);

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

    const power = botConsiderPowers(UI.state, color);
    if (power) {
      if (powerStats[power.power] !== undefined) {
        powerStats[power.power]++;
        gameStats.powersUsed.push(power.power);
      }
      if (power.power === 'CHRONOBREAK') {
        gameStats.chronobreakUsed++;
      }
      const r = power.exec();
      if (r && r.success && UI.state.turn !== color) {
        gameStats.turns++;
        continue;
      }
    }

    const bookMove = botGetBookMove(UI.state, color, moves);
    const chosenMove = bookMove || botSearchBestMove(UI.state, moves, color);

    const piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
    let promo;
    if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) promo = 'Q';

    makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);

    const bombsAfter = (UI.state.bombs || []).length;
    if (bombsAfter > bombsBefore) {
      gameStats.bombsPlanted += (bombsAfter - bombsBefore);
    } else if (bombsAfter < bombsBefore) {
      gameStats.bombsDetonated += (bombsBefore - bombsAfter);
    }

    gameStats.turns++;
  }

  if (!UI.state.winner && gameStats.turns >= maxTurns) {
    UI.state.winner = 'DRAW';
    UI.state.winReason = 'MAX_TURNS';
  }

  gameStats.duration = (Date.now() - gameStart) / 1000;
  gameStats.outcome = UI.state.winner;
  gameStats.winReason = UI.state.winReason;

  allGames.push(gameStats);

  const outcome = gameStats.outcome === 'w' ? 'WHITE' :
                  gameStats.outcome === 'b' ? 'BLACK' : 'DRAW';
  const avgAetherW = gameStats.aetherW.reduce((a,b)=>a+b,0) / gameStats.aetherW.length;
  const avgAetherB = gameStats.aetherB.reduce((a,b)=>a+b,0) / gameStats.aetherB.length;

  console.log(\`Game \${g+1}/\${GAMES}: \${outcome} (\${gameStats.winReason}, \${gameStats.turns} turns, \${gameStats.duration.toFixed(1)}s)\`);
  console.log(\`  Powers: \${gameStats.powersUsed.length}, Aether: W=\${avgAetherW.toFixed(1)} B=\${avgAetherB.toFixed(1)}\`);
}

console.log('');
console.log('='.repeat(80));
console.log('AGGREGATE STATISTICS');
console.log('='.repeat(80));
console.log('');

const outcomes = { white: 0, black: 0, draw: 0 };
const winReasons = {};
allGames.forEach(g => {
  if (g.outcome === 'w') outcomes.white++;
  else if (g.outcome === 'b') outcomes.black++;
  else outcomes.draw++;
  winReasons[g.winReason] = (winReasons[g.winReason] || 0) + 1;
});

console.log('OUTCOMES:');
console.log(\`  White: \${outcomes.white} (\${(outcomes.white/GAMES*100).toFixed(0)}%)\`);
console.log(\`  Black: \${outcomes.black} (\${(outcomes.black/GAMES*100).toFixed(0)}%)\`);
console.log(\`  Draw: \${outcomes.draw} (\${(outcomes.draw/GAMES*100).toFixed(0)}%)\`);
console.log('');

console.log('WIN REASONS:');
Object.keys(winReasons).sort((a,b) => winReasons[b] - winReasons[a]).forEach(reason => {
  console.log(\`  \${reason}: \${winReasons[reason]}\`);
});
console.log('');

const avgTurns = allGames.reduce((sum, g) => sum + g.turns, 0) / GAMES;
const avgDuration = allGames.reduce((sum, g) => sum + g.duration, 0) / GAMES;

console.log('GAME METRICS:');
console.log(\`  Avg turns: \${avgTurns.toFixed(1)}\`);
console.log(\`  Avg duration: \${avgDuration.toFixed(1)}s\`);
console.log('');

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

const avgAetherW = allGames.reduce((sum, g) => {
  return sum + g.aetherW.reduce((a,b)=>a+b,0) / g.aetherW.length;
}, 0) / GAMES;
const avgAetherB = allGames.reduce((sum, g) => {
  return sum + g.aetherB.reduce((a,b)=>a+b,0) / g.aetherB.length;
}, 0) / GAMES;

console.log('AETHER ECONOMY:');
console.log(\`  White avg: \${avgAetherW.toFixed(1)}\`);
console.log(\`  Black avg: \${avgAetherB.toFixed(1)}\`);
console.log('');

const totalBombsPlanted = allGames.reduce((sum, g) => sum + g.bombsPlanted, 0);
const totalBombsDetonated = allGames.reduce((sum, g) => sum + g.bombsDetonated, 0);
const gamesWithBombs = allGames.filter(g => g.bombsPlanted > 0).length;

console.log('BOMB MECHANICS:');
console.log(\`  Total planted: \${totalBombsPlanted} (\${(totalBombsPlanted/GAMES).toFixed(1)}/game)\`);
console.log(\`  Total detonated: \${totalBombsDetonated}\`);
console.log(\`  Games with bombs: \${gamesWithBombs} (\${(gamesWithBombs/GAMES*100).toFixed(0)}%)\`);
if (totalBombsPlanted > 0) {
  console.log(\`  Detonation rate: \${(totalBombsDetonated/totalBombsPlanted*100).toFixed(0)}%\`);
}
console.log('');

const totalChronobreak = allGames.reduce((sum, g) => sum + g.chronobreakUsed, 0);
console.log('CHRONOBREAK:');
console.log(\`  Total uses: \${totalChronobreak}\`);
console.log(\`  Games with Chronobreak: \${allGames.filter(g => g.chronobreakUsed > 0).length}\`);
console.log('');

console.log('='.repeat(80));
`;

console.log('Running Medium Bot Analysis...');
console.log('');
const start = Date.now();
vm.runInContext(testCode, ctx, { timeout: 600000 });
console.log('');
console.log('Total execution time: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
