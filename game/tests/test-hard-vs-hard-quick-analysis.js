// Quick analysis - 3 games to test improvements
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
const GAMES = 3;
const powerStats = {
  FROST: 0, FORTIFY: 0, SPAWN: 0, BLINK: 0,
  IMPRISON: 0, AETHER_BLOCK: 0, CLEANSE: 0, BOMBA: 0, DOUBLE_ATTACK: 0,
  PROMOTE: 0, VENGEANCE: 0, WALL: 0, CHRONOBREAK: 0
};

console.log('Testing Hard vs Hard - Quick Analysis (3 games)...');
console.log('');

for (let g = 0; g < GAMES; g++) {
  UI.state = initGame();
  botClearHistory();
  let turnCount = 0;
  const maxTurns = 150;
  const gameStart = Date.now();

  while (!UI.state.winner && turnCount < maxTurns) {
    const color = UI.state.turn;
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

    const power = botConsiderPowers(UI.state, color);
    if (power) {
      if (powerStats[power.power] !== undefined) {
        powerStats[power.power]++;
      }
      const r = power.exec();
      if (r && r.success && UI.state.turn !== color) { turnCount++; continue; }
    }

    const bookMove = botGetBookMove(UI.state, color, moves);
    const chosenMove = bookMove || botSearchBestMove(UI.state, moves, color);

    const piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
    let promo;
    if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) promo = 'Q';
    makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);
    turnCount++;
  }

  if (!UI.state.winner && turnCount >= maxTurns) {
    UI.state.winner = 'DRAW';
    UI.state.winReason = 'MAX_TURNS';
  }

  const elapsed = ((Date.now() - gameStart) / 1000).toFixed(1);
  const outcome = UI.state.winner === 'w' ? 'WHITE' : UI.state.winner === 'b' ? 'BLACK' : 'DRAW';
  console.log('Game ' + (g+1) + ': ' + outcome + ' (' + UI.state.winReason + ', ' + turnCount + ' turns, ' + elapsed + 's)');
}

console.log('');
console.log('Powers used:');
Object.keys(powerStats).forEach(p => {
  if (powerStats[p] > 0) console.log('  ' + p + ': ' + powerStats[p]);
});
`;

const start = Date.now();
vm.runInContext(testCode, ctx, { timeout: 300000 });
console.log('');
console.log('Total: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
