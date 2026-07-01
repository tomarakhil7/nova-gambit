const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { module: { exports: {} }, console, Math, Array, String, Object, JSON, Date, parseInt };
ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'game', 'js', 'chess-engine.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'game', 'js', 'mana-system.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'game', 'js', 'bot.js'), 'utf8'), ctx);

const testCode = `
BOT.difficulty = 'hard';
BOT.botVsBot = true;

const state = initGame();
const moveList = [];
const powersCast = [];
const turnLog = [];
let moveCount = 0;
const maxMoves = 150;
const gameStart = Date.now();
const timeLimit = 45000; // 45 seconds

while (!state.winner && moveCount < maxMoves) {
  // Time limit check
  if (Date.now() - gameStart > timeLimit) {
    state.winner = 'DRAW';
    state.winReason = 'TIMEOUT';
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
    let chosenMove = null;
    
    if (bookMove) {
      chosenMove = bookMove;
    } else if (Date.now() - gameStart < timeLimit - 5000) {
      // Only search if we have time
      const moveStart = Date.now();
      const maxSearchTime = 2000; // Max 2 seconds per move
      chosenMove = botSearchBestMove(state, moves, color);
      const searchTime = Date.now() - moveStart;
      if (searchTime > 5000) {
        // Search is too slow, just pick first move
        chosenMove = moves[0];
      }
    } else {
      chosenMove = moves[0];
    }

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

console.log('Running Hard Bot vs Hard Bot Game...\n');
try {
  vm.runInContext(testCode, ctx, { timeout: 50000 });
} catch (e) {
  console.error('Game error:', e.message);
  process.exit(1);
}
