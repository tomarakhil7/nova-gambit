// Detailed analysis: Hard vs Hard - full game log with power decisions
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
UI.state = initGame();
botClearHistory();
let turnCount = 0;
const maxTurns = 200;

const gameLog = [];
const powerAttempts = { cast: [], skipped: [] };
const aetherHistory = [];
const materialHistory = [];

function countPieces(color) {
  let count = { P: 0, N: 0, B: 0, R: 0, Q: 0, K: 0, total: 0, material: 0 };
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = UI.state.board[r][c];
    if (!p || p.color !== color || p.isSpectral) continue;
    count[p.type]++;
    count.total++;
    count.material += ({ P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 })[p.type] || 0;
  }
  return count;
}

while (!UI.state.winner && turnCount < maxTurns) {
  const color = UI.state.turn;
  const colorName = color === 'w' ? 'White' : 'Black';
  BOT.difficulty = 'hard';
  BOT.enabled = true;
  BOT.botVsBot = true;

  const wAether = UI.state.mana['w'];
  const bAether = UI.state.mana['b'];
  aetherHistory.push({ turn: turnCount, w: wAether, b: bAether });

  const wPieces = countPieces('w');
  const bPieces = countPieces('b');
  materialHistory.push({ turn: turnCount, w: wPieces.material, b: bPieces.material });

  const moves = allLegalMoves(UI.state.board, color, UI.state);
  if (moves.length === 0) {
    if (isInCheck(UI.state.board, color)) {
      UI.state.winner = opposite(color);
      UI.state.winReason = 'CHECKMATE';
      gameLog.push('T' + turnCount + ' ' + colorName + ': CHECKMATE - ' + (color === 'w' ? 'Black' : 'White') + ' wins');
    } else {
      UI.state.winner = 'DRAW';
      UI.state.winReason = 'STALEMATE';
      gameLog.push('T' + turnCount + ' ' + colorName + ': STALEMATE');
    }
    break;
  }

  const power = botConsiderPowers(UI.state, color);
  if (power) {
    const aetherBefore = UI.state.mana[color];
    const r = power.exec();
    if (r && r.success) {
      const aetherAfter = UI.state.mana[color];
      const spent = aetherBefore - aetherAfter;
      powerAttempts.cast.push({ turn: turnCount, color: colorName, power: power.name, spent: spent, aetherBefore: aetherBefore });
      gameLog.push('T' + turnCount + ' ' + colorName + ': CAST ' + power.name + ' (spent ' + spent + ', had ' + aetherBefore + ')');
      if (UI.state.turn !== color) {
        turnCount++;
        continue;
      }
    }
  }

  if (UI.state.winner) break;

  let chosenMove;
  const bookMove = botGetBookMove(UI.state, color, moves);
  chosenMove = bookMove || botSearchBestMove(UI.state, moves, color);
  const piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
  let promo;
  if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) promo = 'Q';

  const fromSq = String.fromCharCode(97 + chosenMove.from.c) + (8 - chosenMove.from.r);
  const toSq = String.fromCharCode(97 + chosenMove.to.c) + (8 - chosenMove.to.r);
  const target = UI.state.board[chosenMove.to.r][chosenMove.to.c];
  const moveDesc = piece.type + ' ' + fromSq + (target ? 'x' : '-') + toSq + (promo ? '=' + promo : '');

  makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);

  gameLog.push('T' + turnCount + ' ' + colorName + ': ' + moveDesc);
  turnCount++;
}

if (!UI.state.winner && turnCount >= maxTurns) {
  UI.state.winner = 'DRAW'; UI.state.winReason = 'MAX_TURNS';
  gameLog.push('T' + turnCount + ' MAX_TURNS reached - draw');
}

console.log('=== GAME RESULT ===');
console.log('Winner: ' + (UI.state.winner === 'w' ? 'White' : UI.state.winner === 'b' ? 'Black' : 'Draw'));
console.log('Reason: ' + UI.state.winReason);
console.log('Total turns: ' + turnCount);
console.log('');

console.log('=== FULL GAME LOG ===');
for (const line of gameLog) console.log('  ' + line);
console.log('');

console.log('=== POWER USAGE ANALYSIS ===');
const powersByColor = { White: {}, Black: {} };
for (const p of powerAttempts.cast) {
  powersByColor[p.color][p.power] = (powersByColor[p.color][p.power] || 0) + 1;
}
console.log('White powers:');
for (const [name, count] of Object.entries(powersByColor.White).sort((a,b) => b[1] - a[1])) {
  console.log('  ' + name + ': ' + count);
}
console.log('Black powers:');
for (const [name, count] of Object.entries(powersByColor.Black).sort((a,b) => b[1] - a[1])) {
  console.log('  ' + name + ': ' + count);
}
console.log('');

console.log('=== AETHER TRACKING (every 10 turns) ===');
for (let i = 0; i < aetherHistory.length; i += 10) {
  const a = aetherHistory[i];
  console.log('  T' + a.turn + ': W=' + a.w + ' B=' + a.b);
}
console.log('');

console.log('=== MATERIAL TRACKING (every 10 turns) ===');
for (let i = 0; i < materialHistory.length; i += 10) {
  const m = materialHistory[i];
  console.log('  T' + m.turn + ': W=' + m.w + ' B=' + m.b + ' (diff=' + (m.w - m.b) + ')');
}
console.log('');

console.log('=== POTENTIAL ISSUES ===');
let maxGapW = 0, maxGapB = 0;
let lastW = -1, lastB = -1;
for (const p of powerAttempts.cast) {
  if (p.color === 'White') {
    if (lastW >= 0 && p.turn - lastW > maxGapW) maxGapW = p.turn - lastW;
    lastW = p.turn;
  } else {
    if (lastB >= 0 && p.turn - lastB > maxGapB) maxGapB = p.turn - lastB;
    lastB = p.turn;
  }
}
if (maxGapW > 20) console.log('  [!] White had a ' + maxGapW + '-turn gap without casting powers');
if (maxGapB > 20) console.log('  [!] Black had a ' + maxGapB + '-turn gap without casting powers');

let maxAetherW = 0, maxAetherB = 0;
for (const a of aetherHistory) {
  if (a.w > maxAetherW) maxAetherW = a.w;
  if (a.b > maxAetherB) maxAetherB = a.b;
}
if (maxAetherW >= 25) console.log('  [!] White reached ' + maxAetherW + ' aether without spending (hoarding)');
if (maxAetherB >= 25) console.log('  [!] Black reached ' + maxAetherB + ' aether without spending (hoarding)');

const totalPowers = powerAttempts.cast.length;
const blinkCount = powerAttempts.cast.filter(function(p) { return p.power === 'BLINK'; }).length;
if (blinkCount > totalPowers * 0.6 && totalPowers > 5) {
  console.log('  [!] BLINK is ' + Math.round(blinkCount/totalPowers*100) + '% of all powers (' + blinkCount + '/' + totalPowers + ') - over-reliant');
}

const usedPowers = {};
for (const p of powerAttempts.cast) usedPowers[p.power] = true;
const expectedPowers = ['VENGEANCE', 'PROMOTE', 'IMPRISON', 'WALL', 'CLEANSE', 'DOUBLE_ATTACK'];
const missing = expectedPowers.filter(function(p) { return !usedPowers[p]; });
if (missing.length > 0) console.log('  [i] Never used: ' + missing.join(', '));

let repetitions = 0;
for (let i = 2; i < gameLog.length; i++) {
  if (gameLog[i].indexOf('CAST') >= 0 || gameLog[i-2].indexOf('CAST') >= 0) continue;
  const curr = gameLog[i].replace(/T[0-9]+ (White|Black): /, '');
  const prev = gameLog[i-2].replace(/T[0-9]+ (White|Black): /, '');
  if (curr === prev) repetitions++;
}
if (repetitions > 3) console.log('  [!] ' + repetitions + ' repetitive moves detected (same piece shuttling)');

const noIssues = (missing.length === 0 && maxGapW <= 20 && maxGapB <= 20 && blinkCount <= totalPowers * 0.6 && repetitions <= 3);
if (noIssues) console.log('  No major issues detected!');
`;

console.log('Running detailed Hard vs Hard analysis...');
console.log('');
const start = Date.now();
vm.runInContext(testCode, ctx, { timeout: 600000 });
console.log('');
console.log('Analysis time: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
