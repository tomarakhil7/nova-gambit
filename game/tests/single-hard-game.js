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
console.log('========== HARD vs HARD BOT GAME (Medium Search) ==========\\n');

const moves = [];
const powerUsed = [];
const aetherLog = [];

UI.state = initGame();
botClearHistory();
let turnCount = 0;
const maxTurns = 150;
const gameStart = Date.now();

while (!UI.state.winner && turnCount < maxTurns) {
  const color = UI.state.turn;
  const colorName = color === COLOR.WHITE ? 'White' : 'Black';
  
  // Record aether
  aetherLog.push({
    turn: turnCount + 1,
    color: colorName,
    whiteAether: UI.state.mana[COLOR.WHITE],
    blackAether: UI.state.mana[COLOR.BLACK]
  });
  
  // Get legal moves
  const legalMoves = allLegalMoves(UI.state.board, color, UI.state);
  if (legalMoves.length === 0) {
    if (isInCheck(UI.state.board, color)) {
      UI.state.winner = opposite(color);
      UI.state.winReason = 'CHECKMATE';
    } else {
      UI.state.winner = 'DRAW';
      UI.state.winReason = 'STALEMATE';
    }
    break;
  }
  
  // Set difficulty
  BOT.difficulty = 'hard';
  BOT.enabled = true;
  BOT.botVsBot = true;
  BOT.color = color;
  
  // Try to cast a power
  const power = botConsiderPowers(UI.state, color);
  if (power) {
    try {
      const r = power.exec();
      if (r && r.success && UI.state.turn !== color) {
        const powerName = power.payload?.power || 'UNKNOWN';
        powerUsed.push({
          turn: turnCount + 1,
          color: colorName,
          power: powerName,
          whiteAether: UI.state.mana[COLOR.WHITE],
          blackAether: UI.state.mana[COLOR.BLACK]
        });
        console.log('Turn ' + (turnCount + 1) + ': ' + colorName + ' casts ' + powerName + ' (W=' + UI.state.mana[COLOR.WHITE] + ', B=' + UI.state.mana[COLOR.BLACK] + ')');
        turnCount++;
        continue;
      }
    } catch (e) {
      // Ignore power errors
    }
  }
  
  // Choose best move
  let chosenMove = null;
  const bookMove = botGetBookMove(UI.state, color, legalMoves);
  if (bookMove) {
    chosenMove = bookMove;
  } else {
    chosenMove = botSearchBestMove(UI.state, legalMoves, color);
  }
  
  if (!chosenMove) {
    chosenMove = legalMoves[0];
  }
  
  // Get notation
  const fromFile = String.fromCharCode(97 + chosenMove.from.c);
  const fromRank = 8 - chosenMove.from.r;
  const toFile = String.fromCharCode(97 + chosenMove.to.c);
  const toRank = 8 - chosenMove.to.r;
  const notation = fromFile + fromRank + toFile + toRank;
  
  moves.push(notation);
  
  // Execute move
  const piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
  let promo;
  if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) promo = 'Q';
  
  try {
    makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);
  } catch (e) {
    break;
  }
  
  console.log('Turn ' + (turnCount + 1) + ': ' + colorName + ' ' + notation + ' (W=' + UI.state.mana[COLOR.WHITE] + ', B=' + UI.state.mana[COLOR.BLACK] + ')');
  turnCount++;
}

// Finalize
if (!UI.state.winner && turnCount >= maxTurns) {
  UI.state.winner = 'DRAW';
  UI.state.winReason = 'MAX_TURNS';
}

const elapsed = ((Date.now() - gameStart) / 1000).toFixed(1);
const winner = UI.state.winner === COLOR.WHITE ? 'White' : UI.state.winner === COLOR.BLACK ? 'Black' : 'DRAW';
const result = UI.state.winReason || 'INCOMPLETE';

console.log('');
console.log('========== GAME SUMMARY ==========');
console.log('GAME_RESULT: ' + result);
console.log('WINNER: ' + winner);
console.log('TURNS: ' + turnCount);
console.log('MOVES: ' + moves.join(' '));
console.log('POWERS_USED: ' + (powerUsed.length > 0 ? powerUsed.map(p => p.power).join(', ') : 'None'));
console.log('FINAL_AETHER: White ' + UI.state.mana[COLOR.WHITE] + '/30, Black ' + UI.state.mana[COLOR.BLACK] + '/30');

console.log('');
console.log('========== DETAILED GAME LOG ==========');
console.log('Result: ' + result);
console.log('Winner: ' + winner);
console.log('Total Turns: ' + turnCount);
console.log('Game Duration: ' + elapsed + 's');
console.log('Final Aether: White ' + UI.state.mana[COLOR.WHITE] + '/30, Black ' + UI.state.mana[COLOR.BLACK] + '/30');

console.log('');
console.log('--- Move Sequence (Algebraic Notation) ---');
let moveNum = 1;
for (let i = 0; i < moves.length; i += 2) {
  const whiteMv = moves[i] || '';
  const blackMv = moves[i + 1] || '';
  console.log(moveNum + '. ' + whiteMv.padEnd(8) + (blackMv ? blackMv : ''));
  moveNum++;
}

if (powerUsed.length > 0) {
  console.log('');
  console.log('--- Power Casts ---');
  powerUsed.forEach(p => {
    console.log('Turn ' + p.turn + ': ' + p.color + ' casts ' + p.power + ' (W=' + p.whiteAether + ', B=' + p.blackAether + ')');
  });
} else {
  console.log('');
  console.log('--- Power Casts ---');
  console.log('None');
}

console.log('');
console.log('--- Aether State History (All Turns) ---');
aetherLog.forEach(log => {
  console.log('Turn ' + log.turn + ' (' + log.color + '): White=' + log.whiteAether + ', Black=' + log.blackAether);
});
`;

console.log('Loading game modules and starting game...');
const start = Date.now();
vm.runInContext(testCode, ctx, { timeout: 120000 });
console.log('');
console.log('Total execution time: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
