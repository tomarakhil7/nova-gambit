const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { module: { exports: {} }, console, Math, Array, String, Object, JSON, Date };
ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'game', 'js', 'chess-engine.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'game', 'js', 'mana-system.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'game', 'js', 'bot.js'), 'utf8'), ctx);

const testCode = `
BOT.difficulty = 'easy';
BOT.botVsBot = true;

const state = initGame();
const moveList = [];
const powersCast = [];
const turnLog = [];
let moveCount = 0;
const maxMoves = 60;
const gameStart = Date.now();

while (!state.winner && moveCount < maxMoves) {
  // Time limit check
  if (Date.now() - gameStart > 45000) {
    console.log('[TIMEOUT]');
    break;
  }

  const color = state.turn;
  const colorName = color === 'w' ? 'WHITE' : 'BLACK';
  const whiteAether = state.mana['w'] || 0;
  const blackAether = state.mana['b'] || 0;

  try {
    const moves = allLegalMoves(state.board, color, state);
    
    if (moves.length === 0) {
      if (isInCheck(state.board, color)) {
        state.winner = opposite(color);
        state.winReason = 'CHECKMATE';
      } else {
        state.winner = 'DRAW';
        state.winReason = 'STALEMATE';
      }
      break;
    }

    const bookMove = botGetBookMove(state, color, moves);
    const chosenMove = bookMove || (moves.length > 0 ? moves[0] : null);

    if (!chosenMove) {
      break;
    }

    const fromFile = String.fromCharCode(97 + chosenMove.from.c);
    const fromRank = 8 - chosenMove.from.r;
    const toFile = String.fromCharCode(97 + chosenMove.to.c);
    const toRank = 8 - chosenMove.to.r;
    const moveNotation = fromFile + fromRank + toFile + toRank;
    
    moveList.push(moveNotation);

    const piece = state.board[chosenMove.from.r][chosenMove.from.c];
    let promo = null;
    if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) {
      promo = 'Q';
    }

    makeMove(state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);
    
    if (promo) {
      turnLog.push('Turn ' + (moveCount + 1) + ' (' + colorName + '): Aether W[' + whiteAether + '/30] B[' + blackAether + '/30] - ' + moveNotation + '=Q');
    } else {
      turnLog.push('Turn ' + (moveCount + 1) + ' (' + colorName + '): Aether W[' + whiteAether + '/30] B[' + blackAether + '/30] - ' + moveNotation);
    }
    
    moveCount++;
  } catch (e) {
    console.log('[ERROR]', e.message);
    break;
  }
}

if (!state.winner && moveCount >= maxMoves) {
  state.winner = 'DRAW';
  state.winReason = 'MAX_MOVES';
}

const finalWhiteAether = state.mana['w'] || 0;
const finalBlackAether = state.mana['b'] || 0;
const winnerName = state.winner === 'w' ? 'WHITE' : state.winner === 'b' ? 'BLACK' : 'DRAW';

console.log('');
console.log('GAME_RESULT: ' + state.winReason);
console.log('WINNER: ' + winnerName);
console.log('TURNS: ' + moveCount);
console.log('MOVES: ' + moveList.join(', '));
console.log('POWERS_USED: ' + (powersCast.length > 0 ? powersCast.join(' | ') : 'None'));
console.log('FINAL_AETHER: White [' + finalWhiteAether + '/30], Black [' + finalBlackAether + '/30]');
console.log('');
console.log('DETAILED GAME LOG:');
console.log('');
turnLog.forEach(line => console.log(line));
`;

console.log('Running Easy Bot vs Easy Bot Game (Hard Difficulty)...\n');
try {
  vm.runInContext(testCode, ctx, { timeout: 50000 });
} catch (e) {
  console.error('Game error:', e.message);
  process.exit(1);
}
