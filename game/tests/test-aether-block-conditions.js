// Check AETHER_BLOCK preconditions in a real game

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
console.log('🔍 Checking AETHER_BLOCK Preconditions...\\n');

UI.state = initGame();
botClearHistory();

let turnCount = 0;
let checksPerformed = [];
const maxTurns = 80;

while (!UI.state.winner && turnCount < maxTurns) {
  const color = UI.state.turn;
  const forColor = color === 'w' ? 'white' : 'black';
  const opp = color === 'w' ? 'b' : 'w';
  const oppColor = opp === 'w' ? 'white' : 'black';

  const aether = UI.state.mana[color];
  const oppAether = UI.state.mana[opp];
  const isBlocked = UI.state.aetherBlocked[color];
  const inCheck = isInCheck(UI.state.board, forColor);

  // Check preconditions
  const cond1 = aether >= 16;  // AETHER_BLOCK costs 16
  const cond2 = !UI.state.aetherBlocked[opp];
  const cond3 = !inCheck;
  const allPassed = cond1 && cond2 && cond3;

  if (aether >= 10 || oppAether >= 20 || allPassed) {
    checksPerformed.push({
      turn: turnCount,
      color: forColor,
      aether,
      oppAether,
      cond1: cond1 ? '✓' : '✗',
      cond2: cond2 ? '✓' : '✗',
      cond3: cond3 ? '✓' : '✗',
      allPassed: allPassed ? '✓' : '✗'
    });
  }

  const moves = allLegalMoves(UI.state.board, forColor, UI.state);
  if (moves.length === 0) break;

  const move = botMakeMove(UI.state, forColor, 'hard');
  if (!move) break;

  makeMove(UI.state, move.from.r, move.from.c, move.to.r, move.to.c);
  turnCount++;
}

console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('PRECONDITION CHECKS');
console.log('════════════════════════════════════════════════════════════════════════════════\\n');
console.log('Legend:');
console.log('  cond1: aether >= 16 (AETHER_BLOCK cost)');
console.log('  cond2: opponent NOT already blocked');
console.log('  cond3: player NOT in check');
console.log('  allPassed: All 3 conditions met\\n');

console.log('Turn | Color | MyAether | OppAether | C1 | C2 | C3 | All');
console.log('──────────────────────────────────────────────────────────');

for (const check of checksPerformed) {
  const line = \`  \${check.turn.toString().padEnd(2)} | \${check.color[0].toUpperCase()} | \${check.aether.toString().padEnd(8)} | \${check.oppAether.toString().padEnd(9)} | \${check.cond1} | \${check.cond2} | \${check.cond3} | \${check.allPassed}\`;
  console.log(line);
}

console.log('\\nTotal turns analyzed: ' + turnCount);
console.log('Checks with aether >= 16: ' + checksPerformed.filter(c => c.cond1 === '✓').length);
console.log('Checks with ALL conditions met: ' + checksPerformed.filter(c => c.allPassed === '✓').length);

if (checksPerformed.filter(c => c.allPassed === '✓').length > 0) {
  console.log('\\n✨ AETHER_BLOCK PRECONDITIONS WERE MET!');
  console.log('   If no blocks were used, issue is in the logic/priorities.');
} else {
  console.log('\\n⚠️  Preconditions never met (might need longer games or specific positions).');
}
`;

vm.runInContext(testCode, ctx);
