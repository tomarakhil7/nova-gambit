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
const gameLog = [];
const powersCast = [];
const moveList = [];

function addLog(msg) {
  gameLog.push(msg);
  console.log(msg);
}

UI.state = initGame();
botClearHistory();
let turnCount = 0;
const maxTurns = 200;

addLog('='.repeat(100));
addLog('HARD VS HARD GAME - COMPLETE LOG');
addLog('='.repeat(100));
addLog('');

while (!UI.state.winner && turnCount < maxTurns) {
  const color = UI.state.turn;
  const colorName = color === 'w' ? 'WHITE' : 'BLACK';
  const oppColor = color === 'w' ? 'b' : 'w';
  
  BOT.difficulty = 'hard';
  BOT.enabled = true;
  BOT.botVsBot = true;

  // Check for legal moves
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

  // Get aether state
  const whiteAether = UI.state.mana['w'] || 0;
  const blackAether = UI.state.mana['b'] || 0;

  // Try to cast a power
  const power = botConsiderPowers(UI.state, color);
  if (power) {
    const r = power.exec();
    if (r && r.success && UI.state.turn !== color) {
      const powerName = power.name || power.id || 'Unknown';
      powersCast.push('Turn ' + (turnCount + 1) + ' (' + colorName + '): ' + powerName);
      addLog('Turn ' + (turnCount + 1) + ' (' + colorName + '): Aether W[' + whiteAether + '/30] B[' + blackAether + '/30]');
      addLog('  -> CAST POWER: ' + powerName);
      turnCount++;
      continue;
    }
  }

  // Make a regular move
  const bookMove = botGetBookMove(UI.state, color, moves);
  const chosenMove = bookMove || botSearchBestMove(UI.state, moves, color);

  const piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
  let promo;
  if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) promo = 'Q';
  
  // Convert to algebraic notation
  const fromFile = String.fromCharCode(97 + chosenMove.from.c);
  const fromRank = 8 - chosenMove.from.r;
  const toFile = String.fromCharCode(97 + chosenMove.to.c);
  const toRank = 8 - chosenMove.to.r;
  const moveNotation = fromFile + fromRank + toFile + toRank;
  
  moveList.push(moveNotation);
  
  makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);
  
  addLog('Turn ' + (turnCount + 1) + ' (' + colorName + '): Aether W[' + whiteAether + '/30] B[' + blackAether + '/30]');
  if (promo) {
    addLog('  -> MOVE: ' + moveNotation + ' (promote to Q)');
  } else {
    addLog('  -> MOVE: ' + moveNotation);
  }
  turnCount++;
}

if (!UI.state.winner && turnCount >= maxTurns) {
  UI.state.winner = 'DRAW';
  UI.state.winReason = 'MAX_TURNS';
}

const finalWhiteAether = UI.state.mana['w'] || 0;
const finalBlackAether = UI.state.mana['b'] || 0;

addLog('');
addLog('='.repeat(100));
addLog('GAME RESULT: ' + (UI.state.winReason || '?'));
addLog('WINNER: ' + (UI.state.winner === 'w' ? 'WHITE' : UI.state.winner === 'b' ? 'BLACK' : 'DRAW'));
addLog('TURNS: ' + turnCount);
addLog('MOVES: ' + moveList.join(', '));
addLog('POWERS_USED: ' + (powersCast.length > 0 ? powersCast.join(' | ') : 'None'));
addLog('FINAL_AETHER: White [' + finalWhiteAether + '/30], Black [' + finalBlackAether + '/30]');
addLog('='.repeat(100));
addLog('');

if (powersCast.length > 0) {
  addLog('POWERS CAST (Chronological):');
  powersCast.forEach(p => addLog('  ' + p));
  addLog('');
}

addLog('DETAILED GAME LOG:');
addLog('');
gameLog.forEach(line => console.log(line));
`;

console.log('Starting Hard vs Hard Game...\n');
vm.runInContext(testCode, ctx, { timeout: 600000 });
