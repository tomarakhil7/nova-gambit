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
}

UI.state = initGame();
botClearHistory();
let turnCount = 0;
const maxTurns = 80;

while (!UI.state.winner && turnCount < maxTurns) {
  const color = UI.state.turn;
  const colorName = color === 'w' ? 'WHITE' : 'BLACK';
  
  BOT.difficulty = 'hard';
  BOT.enabled = true;
  BOT.botVsBot = true;

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

  const whiteAether = UI.state.mana['w'] || 0;
  const blackAether = UI.state.mana['b'] || 0;

  const power = botConsiderPowers(UI.state, color);
  if (power) {
    const r = power.exec();
    if (r && r.success && UI.state.turn !== color) {
      const powerName = power.name || power.id || 'Unknown';
      powersCast.push('Turn ' + (turnCount + 1) + ' (' + colorName + '): ' + powerName);
      addLog('Turn ' + (turnCount + 1) + ' (' + colorName + '): Aether W[' + whiteAether + '/30] B[' + blackAether + '/30] - CAST: ' + powerName);
      turnCount++;
      continue;
    }
  }

  const bookMove = botGetBookMove(UI.state, color, moves);
  const chosenMove = bookMove || botSearchBestMove(UI.state, moves, color);

  const piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
  let promo;
  if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) promo = 'Q';
  
  const fromFile = String.fromCharCode(97 + chosenMove.from.c);
  const fromRank = 8 - chosenMove.from.r;
  const toFile = String.fromCharCode(97 + chosenMove.to.c);
  const toRank = 8 - chosenMove.to.r;
  const moveNotation = fromFile + fromRank + toFile + toRank;
  
  moveList.push(moveNotation);
  
  makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);
  
  addLog('Turn ' + (turnCount + 1) + ' (' + colorName + '): Aether W[' + whiteAether + '/30] B[' + blackAether + '/30] - ' + moveNotation);
  turnCount++;
}

if (!UI.state.winner && turnCount >= maxTurns) {
  UI.state.winner = 'DRAW';
  UI.state.winReason = 'MAX_TURNS';
}

const finalWhiteAether = UI.state.mana['w'] || 0;
const finalBlackAether = UI.state.mana['b'] || 0;
const winnerName = UI.state.winner === 'w' ? 'WHITE' : UI.state.winner === 'b' ? 'BLACK' : 'DRAW';

console.log('');
console.log('GAME_RESULT: ' + UI.state.winReason);
console.log('WINNER: ' + winnerName);
console.log('TURNS: ' + turnCount);
console.log('MOVES: ' + moveList.join(', '));
console.log('POWERS_USED: ' + (powersCast.length > 0 ? powersCast.join(' | ') : 'None'));
console.log('FINAL_AETHER: White [' + finalWhiteAether + '/30], Black [' + finalBlackAether + '/30]');
console.log('');
console.log('DETAILED GAME LOG:');
gameLog.forEach(line => console.log(line));

if (powersCast.length > 0) {
  console.log('');
  console.log('POWERS CAST (Chronological):');
  powersCast.forEach(p => console.log('  ' + p));
}
`;

console.log('Running Hard vs Hard Game (max 80 turns)...');
vm.runInContext(testCode, ctx, { timeout: 120000 });
