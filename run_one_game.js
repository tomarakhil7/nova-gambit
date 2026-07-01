const { initGame, makeMove, opposite, allLegalMoves, isInCheck, startOfTurn, endOfTurn } = require('./game/js/mana-system.js');
const { evaluatePosition, chooseBestMove, DIFFICULTY, botClearHistory, botConsiderPowers, botGetBookMove, botSearchBestMove } = require('./game/js/bot.js');

console.log('Running Hard vs Hard Game...\n');

const state = initGame();
botClearHistory();
let moveCount = 0;
const maxMoves = 100;
const moveList = [];
const powersCast = [];
const turnLog = [];

while (!state.winner && moveCount < maxMoves) {
  const color = state.turn;
  const colorName = color === 'w' ? 'WHITE' : 'BLACK';
  const whiteAether = state.mana['w'] || 0;
  const blackAether = state.mana['b'] || 0;

  // Get legal moves
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

  // Try to cast a power
  const power = botConsiderPowers(state, color);
  if (power) {
    const r = power.exec();
    if (r && r.success && state.turn !== color) {
      const powerName = power.name || power.id || 'Unknown';
      powersCast.push(`Turn ${moveCount + 1} (${colorName}): ${powerName}`);
      turnLog.push(`Turn ${moveCount + 1} (${colorName}): Aether W[${whiteAether}/30] B[${blackAether}/30] - CAST: ${powerName}`);
      moveCount++;
      continue;
    }
  }

  // Get best move
  const bookMove = botGetBookMove(state, color, moves);
  const chosenMove = bookMove || botSearchBestMove(state, moves, color);

  if (!chosenMove) {
    console.error('No move found!');
    break;
  }

  // Convert to algebraic notation
  const fromFile = String.fromCharCode(97 + chosenMove.from.c);
  const fromRank = 8 - chosenMove.from.r;
  const toFile = String.fromCharCode(97 + chosenMove.to.c);
  const toRank = 8 - chosenMove.to.r;
  const moveNotation = fromFile + fromRank + toFile + toRank;
  
  moveList.push(moveNotation);

  // Get piece for promotion check
  const piece = state.board[chosenMove.from.r][chosenMove.from.c];
  let promo = null;
  if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) {
    promo = 'Q';
  }

  makeMove(state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);
  
  if (promo) {
    turnLog.push(`Turn ${moveCount + 1} (${colorName}): Aether W[${whiteAether}/30] B[${blackAether}/30] - ${moveNotation}=Q`);
  } else {
    turnLog.push(`Turn ${moveCount + 1} (${colorName}): Aether W[${whiteAether}/30] B[${blackAether}/30] - ${moveNotation}`);
  }
  
  moveCount++;
}

if (!state.winner && moveCount >= maxMoves) {
  state.winner = 'DRAW';
  state.winReason = 'MAX_MOVES';
}

const finalWhiteAether = state.mana['w'] || 0;
const finalBlackAether = state.mana['b'] || 0;
const winnerName = state.winner === 'w' ? 'WHITE' : state.winner === 'b' ? 'BLACK' : 'DRAW';

console.log('='.repeat(100));
console.log('GAME_RESULT:', state.winReason);
console.log('WINNER:', winnerName);
console.log('TURNS:', moveCount);
console.log('MOVES:', moveList.join(', '));
console.log('POWERS_USED:', powersCast.length > 0 ? powersCast.join(' | ') : 'None');
console.log('FINAL_AETHER: White [' + finalWhiteAether + '/30], Black [' + finalBlackAether + '/30]');
console.log('='.repeat(100));
console.log('\n');

console.log('DETAILED GAME LOG:\n');
turnLog.forEach(line => console.log(line));

if (powersCast.length > 0) {
  console.log('\n\nPOWERS CAST (Chronological):');
  powersCast.forEach(p => console.log('  ' + p));
}
