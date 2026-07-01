const Game = require('./game/js/game.js');
const Bot = require('./game/js/bot.js');

const game = new Game();
const whiteBot = new Bot('white', 'hard');
const blackBot = new Bot('black', 'hard');

let moves = [];
let powersCast = [];
let turnLog = [];
let moveCount = 0;

console.log('Starting Hard vs Hard Game...\n');

while (!game.gameOver && moveCount < 300) {
  const currentColor = game.currentPlayer === 1 ? 'white' : 'black';
  const bot = currentColor === 'white' ? whiteBot : blackBot;
  
  // Log aether state before move
  const whiteAether = game.aether[1] || 0;
  const blackAether = game.aether[2] || 0;
  
  try {
    // Get bot move
    const move = bot.getMove(game);
    
    if (move.type === 'power') {
      const powerName = move.power;
      powersCast.push(`Turn ${game.moveCount + 1} (${currentColor}): ${powerName}`);
      turnLog.push(`Turn ${game.moveCount + 1} (${currentColor}): Aether W[${whiteAether}/30] B[${blackAether}/30] - Cast Power: ${powerName}`);
      game.castPower(move.power);
    } else {
      const fromFile = move.from % 8;
      const fromRank = 8 - Math.floor(move.from / 8);
      const toFile = move.to % 8;
      const toRank = 8 - Math.floor(move.to / 8);
      
      const fromSquare = String.fromCharCode(97 + fromFile) + fromRank;
      const toSquare = String.fromCharCode(97 + toFile) + toRank;
      const moveNotation = fromSquare + toSquare;
      
      moves.push(moveNotation);
      turnLog.push(`Turn ${game.moveCount + 1} (${currentColor}): Aether W[${whiteAether}/30] B[${blackAether}/30] - Move: ${moveNotation}`);
      
      game.movePiece(move.from, move.to);
      moveCount++;
    }
  } catch (err) {
    console.error(`Error on turn ${game.moveCount + 1}: ${err.message}`);
    break;
  }
}

// Final state
const whiteAether = game.aether[1] || 0;
const blackAether = game.aether[2] || 0;
let result = 'UNKNOWN';
let winner = 'UNKNOWN';

if (game.isCheckmate) {
  result = 'CHECKMATE';
  winner = game.currentPlayer === 1 ? 'black' : 'white';
} else if (game.isStalemate) {
  result = 'STALEMATE';
  winner = 'DRAW';
} else if (game.isInsufficientMaterial) {
  result = 'INSUFFICIENT_MATERIAL';
  winner = 'DRAW';
} else if (game.moveCount >= 300) {
  result = 'MOVES_LIMIT';
  winner = 'DRAW';
}

console.log('\n' + '='.repeat(100));
console.log('GAME_RESULT:', result);
console.log('WINNER:', winner);
console.log('TURNS:', game.moveCount);
console.log('MOVES:', moves.join(', '));
console.log('POWERS_USED:', powersCast.length > 0 ? powersCast.join(' | ') : 'None');
console.log('FINAL_AETHER: White [' + whiteAether + '/30], Black [' + blackAether + '/30]');
console.log('='.repeat(100));

console.log('\n\nDETAILED GAME LOG:\n');
turnLog.forEach(line => console.log(line));

console.log('\n\n='.repeat(100));
console.log('POWERS CAST (Chronological):');
powersCast.forEach(p => console.log('  ' + p));
