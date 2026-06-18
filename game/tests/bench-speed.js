// Benchmark: measure hard-mode search speed per move
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

const benchCode = `
UI.state = initGame();
// Play a few opening moves to reach middlegame
const openMoves = [
  {fr:6,fc:4,tr:4,tc:4},
  {fr:1,fc:4,tr:3,tc:4},
  {fr:7,fc:6,tr:5,tc:5},
  {fr:0,fc:1,tr:2,tc:2},
  {fr:7,fc:5,tr:4,tc:2},
  {fr:0,fc:5,tr:3,tc:2},
];
for (const m of openMoves) {
  makeMove(UI.state, m.fr, m.fc, m.tr, m.tc);
}

BOT.difficulty = 'hard';
BOT.enabled = true;

// Time 5 search calls from alternating positions
const times = [];
for (let i = 0; i < 5; i++) {
  const color = UI.state.turn;
  const moves = allLegalMoves(UI.state.board, color, UI.state);
  const start = Date.now();
  const best = botSearchBestMove(UI.state, moves, color);
  const elapsed = Date.now() - start;
  times.push(elapsed);
  const fromSq = 'abcdefgh'[best.from.c] + (8-best.from.r);
  const toSq = 'abcdefgh'[best.to.c] + (8-best.to.r);
  console.log('  Search ' + (i+1) + ': ' + elapsed + 'ms (' + fromSq + '-' + toSq + ')');
  const piece = UI.state.board[best.from.r][best.from.c];
  let promo;
  if (piece && piece.type === 'P' && (best.to.r === 0 || best.to.r === 7)) promo = 'Q';
  makeMove(UI.state, best.from.r, best.from.c, best.to.r, best.to.c, promo);
}
const avg = Math.round(times.reduce((a,b)=>a+b,0)/times.length);
const maxT = Math.max(...times);
console.log('');
console.log('  Avg: ' + avg + 'ms, Max: ' + maxT + 'ms');
console.log('  ' + (maxT <= 1000 ? 'PASS' : 'WARN') + ': Target < 1000ms per search');
`;

console.log('Benchmarking hard-mode search speed (4-ply)...\n');
vm.runInContext(benchCode, ctx, { timeout: 60000 });
