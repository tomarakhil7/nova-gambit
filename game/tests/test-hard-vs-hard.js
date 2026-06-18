// Quick test: hard vs hard - 3 games (stress test)
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
const results = { white: 0, black: 0, draw: 0, turns: [] };
const GAMES = 3;
const timings = [];

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
  timings.push(parseFloat(elapsed));
  const w = UI.state.winner;
  if (w === 'w') results.white++;
  else if (w === 'b') results.black++;
  else results.draw++;
  results.turns.push(turnCount);
  const wName = w === 'w' ? 'W' : w === 'b' ? 'B' : 'D';
  console.log('  Game ' + (g+1) + ': ' + wName + ' (' + (UI.state.winReason || '?') + ', ' + turnCount + ' turns, ' + elapsed + 's)');
}

console.log('');
console.log('Results: W ' + results.white + ' - B ' + results.black + ' - D ' + results.draw);
console.log('Avg turns: ' + Math.round(results.turns.reduce((a,b)=>a+b,0)/GAMES));
console.log('Avg time/game: ' + (timings.reduce((a,b)=>a+b,0)/GAMES).toFixed(1) + 's');
`;

console.log('Testing Hard vs Hard - 3 games (stress test)...');
console.log('');
const start = Date.now();
vm.runInContext(testCode, ctx, { timeout: 600000 });
console.log('');
console.log('Total: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
