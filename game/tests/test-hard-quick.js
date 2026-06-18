// Quick test: hard (white) vs medium (black) - 5 games
const fs = require('fs');
const vm = require('vm');

// Create a sandbox context
const sandbox = {
  console,
  Math,
  Date,
  Array,
  Object,
  String,
  Number,
  Boolean,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  undefined,
  Infinity,
  NaN,
  setTimeout: (fn) => fn(),
  clearInterval: () => {},
  setInterval: () => {},
  document: { getElementById: () => null, createElement: () => ({ innerHTML: '', appendChild: () => {}, addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild: () => {} } },
};

// Stubs
sandbox.UI = { state: null, gameActions: [], selected: null, activePower: null, powerState: {}, prevAether: {} };
sandbox.render = function() {};
sandbox.setStatus = function() {};
sandbox.floatingText = function() {};
sandbox.buildBoard = function() {};
sandbox.showGameOverModal = function() {};
sandbox.recordAction = function() {};

const ctx = vm.createContext(sandbox);

// Load files in order
const engineCode = fs.readFileSync('game/js/chess-engine.js', 'utf8');
const manaCode = fs.readFileSync('game/js/mana-system.js', 'utf8');
const botCode = fs.readFileSync('game/js/bot.js', 'utf8');

vm.runInContext(engineCode, ctx);
vm.runInContext(manaCode, ctx);
vm.runInContext(botCode, ctx);

// Run the test
const testCode = `
const results = { white: 0, black: 0, draw: 0, turns: [] };
const GAMES = 5;

for (let g = 0; g < GAMES; g++) {
  UI.state = initGame();
  botClearHistory();
  let turnCount = 0;
  const maxTurns = 200;

  while (!UI.state.winner && turnCount < maxTurns) {
    const color = UI.state.turn;
    BOT.difficulty = color === 'w' ? 'hard' : 'medium';
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

    // Powers (for both)
    const power = botConsiderPowers(UI.state, color);
    if (power) {
      const r = power.exec();
      if (r && r.success && UI.state.turn !== color) { turnCount++; continue; }
    }

    // Move
    let chosenMove;
    if (BOT.difficulty === 'hard') {
      const bookMove = botGetBookMove(UI.state, color, moves);
      chosenMove = bookMove || botSearchBestMove(UI.state, moves, color);
    } else {
      const scored = moves.map(m => ({ move: m, score: botScoreMove(UI.state, m.from, m.to, color) }));
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, 3);
      chosenMove = top[Math.floor(Math.random() * Math.min(3, top.length))].move;
    }

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

  const w = UI.state.winner;
  if (w === 'w') results.white++;
  else if (w === 'b') results.black++;
  else results.draw++;
  results.turns.push(turnCount);
  const wName = w === 'w' ? 'W' : w === 'b' ? 'B' : 'D';
  console.log('  Game ' + (g+1) + ': ' + wName + ' (' + (UI.state.winReason || '?') + ', ' + turnCount + ' turns)');
}

console.log('\\nResults: Hard(W) ' + results.white + ' - Medium(B) ' + results.black + ' - Draw ' + results.draw);
console.log('Avg turns: ' + Math.round(results.turns.reduce((a,b)=>a+b,0)/GAMES));
`;

console.log('Testing Hard (White) vs Medium (Black) - 5 games...\\n');
const start = Date.now();
vm.runInContext(testCode, ctx, { timeout: 300000 });
console.log('\\nTotal time: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
