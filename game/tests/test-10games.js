// Run 10 Hard vs Hard games and produce a full analysis
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

const NUM_GAMES = 10;

const gameCode = `
function runOneGame(gameNum) {
  UI.state = initGame();
  botClearHistory();
  var turnCount = 0;
  var maxTurns = 200;
  var powersCast = [];
  var aetherPeaks = { w: 0, b: 0 };
  var combos = 0;

  while (!UI.state.winner && turnCount < maxTurns) {
    var color = UI.state.turn;
    BOT.difficulty = 'hard';
    BOT.enabled = true;
    BOT.botVsBot = true;

    if (UI.state.mana['w'] > aetherPeaks.w) aetherPeaks.w = UI.state.mana['w'];
    if (UI.state.mana['b'] > aetherPeaks.b) aetherPeaks.b = UI.state.mana['b'];

    var moves = allLegalMoves(UI.state.board, color, UI.state);
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

    var power = botConsiderPowers(UI.state, color);
    if (power) {
      var aetherBefore = UI.state.mana[color];
      var r = power.exec();
      if (r && r.success) {
        var spent = aetherBefore - UI.state.mana[color];
        powersCast.push({ turn: turnCount, color: color === 'w' ? 'White' : 'Black', power: power.name, spent: spent, aetherBefore: aetherBefore });
        if (UI.state.turn === color) combos++;
        if (UI.state.turn !== color) { turnCount++; continue; }
      }
    }

    if (UI.state.winner) break;

    var chosenMove;
    var bookMove = botGetBookMove(UI.state, color, moves);
    chosenMove = bookMove || botSearchBestMove(UI.state, moves, color);
    var piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
    var promo;
    if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) promo = 'Q';
    makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);
    turnCount++;
  }

  if (!UI.state.winner && turnCount >= maxTurns) {
    UI.state.winner = 'DRAW'; UI.state.winReason = 'MAX_TURNS';
  }

  return {
    gameNum: gameNum,
    winner: UI.state.winner === 'w' ? 'White' : UI.state.winner === 'b' ? 'Black' : 'Draw',
    reason: UI.state.winReason,
    turns: turnCount,
    powersCast: powersCast,
    aetherPeaks: aetherPeaks,
    combos: combos
  };
}

var results = [];
for (var i = 1; i <= ${NUM_GAMES}; i++) {
  results.push(runOneGame(i));
}

console.log('==============================================================');
console.log('          10-GAME HARD vs HARD ANALYSIS REPORT');
console.log('==============================================================');
console.log('');

for (var gi = 0; gi < results.length; gi++) {
  var g = results[gi];
  var powerList = {};
  for (var pi = 0; pi < g.powersCast.length; pi++) {
    var p = g.powersCast[pi];
    powerList[p.power] = (powerList[p.power] || 0) + 1;
  }
  var pwrEntries = Object.keys(powerList).map(function(k) { return [k, powerList[k]]; }).sort(function(a,b) { return b[1]-a[1]; });
  var pwrStr = pwrEntries.map(function(e) { return e[0] + '(' + e[1] + ')'; }).join(', ');
  console.log('Game ' + g.gameNum + ': ' + g.winner + ' wins (' + g.reason + ') in ' + g.turns + ' turns | Peaks W=' + g.aetherPeaks.w + ' B=' + g.aetherPeaks.b + ' | Combos: ' + g.combos);
  console.log('  Powers: ' + (pwrStr || 'NONE'));
}
console.log('');

var totalPowers = 0;
var totalTurns = 0;
var totalCombos = 0;
for (var i = 0; i < results.length; i++) {
  totalPowers += results[i].powersCast.length;
  totalTurns += results[i].turns;
  totalCombos += results[i].combos;
}
var avgTurns = (totalTurns / results.length).toFixed(1);
var avgPowers = (totalPowers / results.length).toFixed(1);

console.log('=== AGGREGATE STATS ===');
console.log('Average game length: ' + avgTurns + ' turns');
console.log('Total powers cast: ' + totalPowers + ' (avg ' + avgPowers + '/game)');
console.log('Total power+move combos: ' + totalCombos);
console.log('');

var allPowers = {};
for (var i = 0; i < results.length; i++) {
  for (var j = 0; j < results[i].powersCast.length; j++) {
    var p = results[i].powersCast[j];
    allPowers[p.power] = (allPowers[p.power] || 0) + 1;
  }
}
console.log('=== POWER DISTRIBUTION (all games) ===');
var sorted = Object.keys(allPowers).map(function(k) { return [k, allPowers[k]]; }).sort(function(a,b) { return b[1]-a[1]; });
for (var i = 0; i < sorted.length; i++) {
  var name = sorted[i][0];
  var count = sorted[i][1];
  var pct = Math.round(count / totalPowers * 100);
  var bar = '';
  for (var b = 0; b < Math.ceil(pct / 3); b++) bar += '#';
  console.log('  ' + name + ': ' + count + ' (' + pct + '%) ' + bar);
}
console.log('');

var expectedPowers = ['VENGEANCE', 'PROMOTE', 'IMPRISON', 'WALL', 'CLEANSE', 'DOUBLE_ATTACK', 'FROST', 'BLINK', 'FORTIFY', 'AETHER_BLOCK', 'BOMBA'];
var neverUsed = expectedPowers.filter(function(p) { return !allPowers[p]; });
if (neverUsed.length > 0) {
  console.log('=== NEVER USED POWERS ===');
  console.log('  ' + neverUsed.join(', '));
  console.log('');
}

var wWins = results.filter(function(g) { return g.winner === 'White'; }).length;
var bWins = results.filter(function(g) { return g.winner === 'Black'; }).length;
var draws = results.filter(function(g) { return g.winner === 'Draw'; }).length;
console.log('=== WIN DISTRIBUTION ===');
console.log('  White: ' + wWins + ' | Black: ' + bWins + ' | Draws: ' + draws);
console.log('');

var sumPeakW = 0, sumPeakB = 0;
for (var i = 0; i < results.length; i++) { sumPeakW += results[i].aetherPeaks.w; sumPeakB += results[i].aetherPeaks.b; }
var avgPeakW = (sumPeakW / results.length).toFixed(1);
var avgPeakB = (sumPeakB / results.length).toFixed(1);
console.log('=== AETHER PEAKS (average) ===');
console.log('  White: ' + avgPeakW + ' | Black: ' + avgPeakB);
console.log('');

console.log('=== POTENTIAL ISSUES ===');
var issues = 0;
if (neverUsed.length > 3) { console.log('  [!] ' + neverUsed.length + ' powers never used across 10 games'); issues++; }
if (sorted.length > 0 && sorted[0][1] > totalPowers * 0.5) { console.log('  [!] ' + sorted[0][0] + ' dominates at ' + Math.round(sorted[0][1]/totalPowers*100) + '% of all casts'); issues++; }
if (totalCombos < 5) { console.log('  [!] Very few power+move combos (' + totalCombos + ') - bot not exploiting non-turn-ending powers'); issues++; }
var avgPeakAll = (parseFloat(avgPeakW) + parseFloat(avgPeakB)) / 2;
if (avgPeakAll < 12) { console.log('  [!] Low average aether peaks (' + avgPeakAll.toFixed(1) + ') - bot spending too early?'); issues++; }
if (issues === 0) console.log('  No major issues detected!');
`;

console.log('Running 10 Hard vs Hard games...');
console.log('');
var start = Date.now();
vm.runInContext(gameCode, ctx, { timeout: 600000 });
console.log('');
console.log('Total time: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
