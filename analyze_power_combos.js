// Comprehensive Power Combo Analysis - 15 games strategic focus
const fs = require('fs');
const vm = require('vm');

const sandbox = {
  console, Math, Date, Array, Object, String, Number, Boolean, JSON,
  parseInt, parseFloat, isNaN, isFinite, undefined, Infinity, NaN,
  setTimeout: (fn) => fn(), clearInterval: () => {}, setInterval: () => {},
  document: {getElementById: () => null, createElement: () => ({innerHTML: '', appendChild: () => {}, addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => []}), body: {appendChild: () => {}}},
};

sandbox.UI = { state: null, gameActions: [], selected: null, activePower: null, powerState: {}, prevAether: {} };
sandbox.render = sandbox.setStatus = sandbox.floatingText = sandbox.buildBoard = sandbox.showGameOverModal = sandbox.recordAction = function() {};

const ctx = vm.createContext(sandbox);

console.log('═'.repeat(120));
console.log('POWER COMBO ANALYSIS - 15 GAMES WITH STRATEGIC FOCUS');
console.log('═'.repeat(120));

vm.runInContext(fs.readFileSync('game/js/chess-engine.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('game/js/mana-system.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('game/js/bot.js', 'utf8'), ctx);

const allStats = {
  totalGames: 0, whiteWins: 0, blackWins: 0, draws: 0, totalMoves: 0,
  combos: {}, powerUsage: {white: {}, black: {}}, endgameAnalysis: [], games: []
};

const gameCode = (n) => `
UI.state = initGame(); botClearHistory();
let turnCount = 0; const gameLog = []; const powerLog = []; const combosFound = []; const endgameEvents = [];

while (!UI.state.winner && turnCount < 200) {
  const color = UI.state.turn;
  const moves = allLegalMoves(UI.state.board, color, UI.state);
  if (moves.length === 0) {
    UI.state.winner = isInCheck(UI.state.board, color) ? opposite(color) : 'DRAW';
    if (UI.state.winner !== 'DRAW') endgameEvents.push({turn: turnCount, event: 'CHECKMATE', winner: UI.state.winner});
    break;
  }
  
  BOT.difficulty = 'hard'; BOT.enabled = true;
  const aetherBefore = UI.state.mana[color];
  const power = botConsiderPowers(UI.state, color);
  if (power) { const r = power.exec(); if (r && r.success) { powerLog.push({power: power.name, spent: aetherBefore - UI.state.mana[color]}); if (['DOUBLE_ATTACK', 'SHIELD', 'FORTIFY'].includes(power.name)) combosFound.push({turn: turnCount, power: power.name}); if (UI.state.turn !== color) { turnCount++; continue; } } }
  if (UI.state.winner) break;
  
  const chosenMove = botSearchBestMove(UI.state, moves, color);
  const piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
  if (!piece) break;
  let material = 0; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = UI.state.board[r][c]; if (p && !p.isSpectral) material++; }
  if (material <= 6 && endgameEvents.length === 0) endgameEvents.push({turn: turnCount, event: 'ENDGAME_START', material});
  
  let promo = piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7) ? 'Q' : null;
  makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);
  turnCount++;
}

if (!UI.state.winner) { UI.state.winner = 'DRAW'; }

const gameStats = {
  gameNum: ${n},
  winner: UI.state.winner === 'w' ? 'White' : UI.state.winner === 'b' ? 'Black' : 'Draw',
  moves: turnCount,
  powers_cast: powerLog.length,
  combos: combosFound.length,
  combo_types: combosFound.map(c => c.power).join(','),
  powers_used: powerLog.map(p => p.power).join('|'),
  endgame: endgameEvents.length > 0,
  final_aether_w: UI.state.mana['w'],
  final_aether_b: UI.state.mana['b']
};

console.log(JSON.stringify({gameStats, powerLog, combosFound, endgameEvents}));
`;

console.log('Running 15 games...\n');
const start = Date.now();

for (let gameNum = 1; gameNum <= 15; gameNum++) {
  process.stdout.write(`Game ${gameNum.toString().padEnd(2)}/15: `);
  try {
    const gameCtx = vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync('game/js/chess-engine.js', 'utf8'), gameCtx);
    vm.runInContext(fs.readFileSync('game/js/mana-system.js', 'utf8'), gameCtx);
    vm.runInContext(fs.readFileSync('game/js/bot.js', 'utf8'), gameCtx);

    let output = '';
    const origLog = console.log;
    console.log = (msg) => { output += msg + '\n'; };
    vm.runInContext(gameCode(gameNum), gameCtx, { timeout: 180000 });
    console.log = origLog;

    const parsed = JSON.parse(output.trim().split('\n').pop());
    const {gameStats, powerLog, combosFound, endgameEvents} = parsed;
    allStats.games.push(gameStats);
    allStats.totalGames++;
    allStats.totalMoves += gameStats.moves;
    if (gameStats.winner === 'White') allStats.whiteWins++;
    else if (gameStats.winner === 'Black') allStats.blackWins++;
    else allStats.draws++;

    if (gameStats.combo_types) {
      for (const c of gameStats.combo_types.split(',').filter(x => x)) {
        allStats.combos[c] = (allStats.combos[c] || 0) + 1;
      }
    }

    process.stdout.write(`✓ ${gameStats.winner.padEnd(6)} (${gameStats.moves}m, ${gameStats.powers_cast}p, ${gameStats.combos}c)\n`);
  } catch (err) {
    process.stdout.write(`✗ ${err.message.substring(0, 40)}\n`);
    allStats.totalGames++;
  }
}

const time = ((Date.now() - start) / 1000).toFixed(1);

console.log('\n' + '═'.repeat(120));
console.log('📊 RESULTS:');
console.log(`  Games: ${allStats.totalGames} | White: ${allStats.whiteWins} | Black: ${allStats.blackWins} | Draws: ${allStats.draws}`);
console.log(`  Avg moves: ${(allStats.totalMoves / allStats.totalGames).toFixed(1)}`);
console.log('');

console.log('🎯 COMBOS:');
let totalCombos = 0;
for (const [combo, count] of Object.entries(allStats.combos).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${combo}: ${count}`);
  totalCombos += count;
}
console.log(`  TOTAL: ${totalCombos} (${(totalCombos / allStats.totalGames).toFixed(2)}/game)`);
console.log('');

console.log('📈 PER-GAME:');
console.log('Game  Winner  Moves  Powers  Combos');
for (const g of allStats.games) {
  console.log(`${String(g.gameNum).padEnd(4)}  ${g.winner.padEnd(6)}  ${String(g.moves).padEnd(5)}  ${String(g.powers_cast).padEnd(6)}  ${g.combos}`);
}

console.log('');
console.log('═'.repeat(120));
console.log(`✅ COMPLETE in ${time}s`);
