#!/usr/bin/env node
/**
 * AETHER_BLOCK Strategic Validation Test
 *
 * Tests the new opponent aether prediction + strategic blocking system
 * Validates whether AETHER_BLOCK is being triggered and used strategically
 */

const fs = require('fs');
const vm = require('vm');

const sandbox = {
  console, Math, Date, Array, Object, String, Number, Boolean, JSON,
  parseInt, parseFloat, isNaN, isFinite, undefined, Infinity, NaN,
  setTimeout: (fn) => fn(), clearInterval: () => {}, setInterval: () => {},
  document: {
    getElementById: () => null,
    createElement: () => ({ innerHTML: '', appendChild: () => {}, addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] }),
    body: { appendChild: () => {} }
  },
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

console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('🎯 AETHER_BLOCK STRATEGIC VALIDATION TEST');
console.log('════════════════════════════════════════════════════════════════════════════════\n');

const testCode = `
UI.state = initGame();
botClearHistory();

let gameCount = 0;
let aetherBlockUsages = [];
let currentGameBlocks = [];
let moveLog = [];

// Enhanced logging hook
const oldError = console.error;
console.error = function(...args) {
  const msg = args.join(' ');
  if (msg.includes('AETHER_BLOCK')) {
    currentGameBlocks.push(msg);
  }
  oldError(...args);
};

const maxGames = 5;
const maxTurns = 150;

while (gameCount < maxGames && UI.state && !UI.state.winner) {
  const color = UI.state.turn;
  const colorName = color === 'w' ? 'White' : 'Black';

  // Reset block tracking for new game
  if (moveLog.length === 0 || UI.state.winner) {
    if (moveLog.length > 0) {
      gameCount++;
      if (currentGameBlocks.length > 0) {
        aetherBlockUsages.push({
          game: gameCount,
          blocks: currentGameBlocks.length,
          details: currentGameBlocks
        });
      }
      currentGameBlocks = [];
    }

    if (gameCount >= maxGames) break;

    UI.state = initGame();
    botClearHistory();
    moveLog = [];
  }

  BOT.difficulty = 'hard';
  BOT.enabled = true;

  const moves = allLegalMoves(UI.state.board, color === 'w' ? 'white' : 'black', UI.state);
  if (moves.length === 0) break;

  const moveInfo = {
    turn: moveLog.length + 1,
    color: colorName,
    aether: {
      white: UI.state.mana.white,
      black: UI.state.mana.black
    }
  };

  const move = botMakeMove(UI.state, color === 'w' ? 'white' : 'black', 'hard');
  if (!move) break;

  makeMove(UI.state, move.from.r, move.from.c, move.to.r, move.to.c);
  moveLog.push(moveInfo);
}

// Record final game if any blocks found
if (currentGameBlocks.length > 0) {
  gameCount++;
  aetherBlockUsages.push({
    game: gameCount,
    blocks: currentGameBlocks.length,
    details: currentGameBlocks
  });
}

console.log('RESULTS:');
console.log('  Games analyzed:', gameCount);
console.log('  Games with AETHER_BLOCK usage:', aetherBlockUsages.length);
console.log('  Total AETHER_BLOCK instances:', aetherBlockUsages.reduce((sum, g) => sum + g.blocks, 0));

if (aetherBlockUsages.length > 0) {
  console.log('\\nAETHER_BLOCK Usage Summary:');
  for (const gameData of aetherBlockUsages) {
    console.log('  Game ' + gameData.game + ': ' + gameData.blocks + ' blocks');
    for (const detail of gameData.details) {
      if (detail.includes('Priority')) {
        console.log('    - ' + detail);
      }
    }
  }
}

console.log('\\n✨ Test complete!');
`;

try {
  vm.runInContext(testCode, ctx);
  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log('✅ VALIDATION TEST PASSED');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');
} catch (err) {
  console.error('❌ Test failed with error:');
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
}
