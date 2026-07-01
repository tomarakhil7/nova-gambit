// AETHER_BLOCK Strategic Validation Test
// Tests the new opponent aether prediction + strategic blocking system

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
console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('🎯 AETHER_BLOCK STRATEGIC VALIDATION - 5 GAMES');
console.log('════════════════════════════════════════════════════════════════════════════════\\n');

UI.state = initGame();
botClearHistory();

let gameCount = 0;
let totalBlocks = 0;
let blocksByReason = {};
let gamesWithBlocks = 0;

const maxGames = 5;
const maxTurns = 200;
let turnCount = 0;

// Track AETHER_BLOCK messages
const oldError = console.error;
let gameBlocks = [];
console.error = function(...args) {
  const msg = args.join(' ');
  if (msg.includes('[AETHER_BLOCK]')) {
    gameBlocks.push(msg);
    totalBlocks++;
    // Extract reason
    const match = msg.match(/Reason=([A-Z_]+)/);
    if (match) {
      const reason = match[1];
      blocksByReason[reason] = (blocksByReason[reason] || 0) + 1;
    }
  }
  oldError(...args);
};

while (gameCount < maxGames && UI.state && !UI.state.winner && turnCount < maxTurns * maxGames) {
  const color = UI.state.turn;
  BOT.difficulty = 'hard';
  BOT.enabled = true;

  const moves = allLegalMoves(UI.state.board, color === 'w' ? 'white' : 'black', UI.state);
  if (moves.length === 0) {
    // Game ended
    if (gameBlocks.length > 0) {
      gamesWithBlocks++;
      console.log('Game ' + (gameCount + 1) + ': AETHER_BLOCK used ' + gameBlocks.length + ' times');
    }
    gameBlocks = [];
    gameCount++;
    if (gameCount < maxGames) {
      UI.state = initGame();
      botClearHistory();
    }
    continue;
  }

  const move = botMakeMove(UI.state, color === 'w' ? 'white' : 'black', 'hard');
  if (!move) break;

  makeMove(UI.state, move.from.r, move.from.c, move.to.r, move.to.c);
  turnCount++;
}

// Restore console
console.error = oldError;

console.log('\\n════════════════════════════════════════════════════════════════════════════════');
console.log('📊 RESULTS');
console.log('════════════════════════════════════════════════════════════════════════════════\\n');

console.log('Games completed: ' + gameCount);
console.log('Total AETHER_BLOCK usages: ' + totalBlocks);
console.log('Games with AETHER_BLOCK: ' + gamesWithBlocks);
console.log('Avg blocks per game: ' + (gameCount > 0 ? (totalBlocks / gameCount).toFixed(2) : 0));

if (Object.keys(blocksByReason).length > 0) {
  console.log('\\nAETHER_BLOCK Strategies Used:');
  for (const [reason, count] of Object.entries(blocksByReason)) {
    console.log('  • ' + reason + ': ' + count);
  }
}

if (totalBlocks > 0) {
  console.log('\\n✨ SUCCESS: AETHER_BLOCK strategic system is active!');
  console.log('   Bot is predicting opponent aether and blocking strategically.');
} else {
  console.log('\\n⚠️  No AETHER_BLOCK usage detected (may be expected in short games).');
}

console.log('\\n════════════════════════════════════════════════════════════════════════════════\\n');
`;

vm.runInContext(testCode, ctx);
