// COMPREHENSIVE STRATEGY TEST - All Phase 5/6 features
// Hard (White) vs Medium (Black) - tests all Hard bot strategies
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

const GAMES = 5;
console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('COMPREHENSIVE STRATEGY TEST - ' + GAMES + ' Games (Hard vs Medium)');
console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('Testing ALL strategic implementations (White=Hard, Black=Medium):');
console.log('  AETHER_BLOCK prediction and usage');
console.log('  Power combos (SHIELD+DA, IMPRISON+DA, FROST+IMP)');
console.log('  Checkmate delivery quality');
console.log('  Tactical patterns (forks, pins, overloaded defenders)');
console.log('  Win rate and game quality metrics');
console.log('════════════════════════════════════════════════════════════════════════════════\n');

const testCode = `
var stats = {
  games: 0,
  whiteWins: 0, blackWins: 0, draws: 0,
  checkmates: 0, stalemates: 0, maxTurnGames: 0,
  totalTurns: 0,
  aetherBlockAttempts: 0,
  aetherBlockReasons: {},
  powersUsed: { white: {}, black: {} },
  totalPowersUsed: { white: 0, black: 0 },
  combosDetected: 0,
  comboTypes: {},
  tacticalPatterns: { FORK: 0, PIN: 0, OVERLOADED_DEFENDER: 0 },
  gamesWithCombos: 0,
  gamesWithAetherBlock: 0,
  impCandidates: 0,
  daCandidates: 0
};

var origError = console.error;
var currentGameDiag = [];

console.error = function() {
  var msg = Array.prototype.join.call(arguments, ' ');
  currentGameDiag.push(msg);
  if (msg.indexOf('[AETHER_BLOCK]') !== -1) {
    stats.aetherBlockAttempts++;
    var m = msg.match(/Reason=([A-Z_]+)/);
    if (m) stats.aetherBlockReasons[m[1]] = (stats.aetherBlockReasons[m[1]] || 0) + 1;
  }
  if (msg.indexOf('[BOT] Found') !== -1 && msg.indexOf('combos:') !== -1) {
    stats.combosDetected++;
  }
  if (msg.indexOf('TACTICAL_FORK') !== -1) stats.tacticalPatterns.FORK++;
  if (msg.indexOf('TACTICAL_PIN') !== -1) stats.tacticalPatterns.PIN++;
  if (msg.indexOf('TACTICAL_OVERLOAD') !== -1) stats.tacticalPatterns.OVERLOADED_DEFENDER++;
  if (msg.indexOf('IMP CANDIDATE') !== -1) stats.impCandidates++;
  if (msg.indexOf('DA CANDIDATE') !== -1) stats.daCandidates++;
  origError.apply(console, arguments);
};

for (var g = 0; g < ${GAMES}; g++) {
  UI.state = initGame();
  botClearHistory();
  var turnCount = 0;
  var maxTurns = 120;
  currentGameDiag = [];
  var gamePowers = { white: {}, black: {} };
  var gameHadCombo = false;
  var gameHadBlock = false;

  while (!UI.state.winner && turnCount < maxTurns) {
    var color = UI.state.turn;
    var forColor = color === 'w' ? 'white' : 'black';
    BOT.difficulty = color === 'w' ? 'hard' : 'medium';
    BOT.enabled = true;
    BOT.botVsBot = true;

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
      var r = power.exec();
      if (r && r.success) {
        var pName = power.payload ? power.payload.power : (power.name || 'UNKNOWN');
        gamePowers[forColor][pName] = (gamePowers[forColor][pName] || 0) + 1;
        stats.powersUsed[forColor][pName] = (stats.powersUsed[forColor][pName] || 0) + 1;
        stats.totalPowersUsed[forColor]++;
        if (pName.indexOf('AETHER_BLOCK') !== -1) gameHadBlock = true;
        if (pName === 'DOUBLE_ATTACK' || pName === 'FORTIFY') gameHadCombo = true;
        if (UI.state.turn !== color) { turnCount++; continue; }
      }
    }

    var chosenMove;
    if (BOT.difficulty === 'hard') {
      var bookMove = botGetBookMove(UI.state, color, moves);
      chosenMove = bookMove || botSearchBestMove(UI.state, moves, color);
    } else {
      var scored = moves.map(function(m) { return { move: m, score: botScoreMove(UI.state, m.from, m.to, color) }; });
      scored.sort(function(a, b) { return b.score - a.score; });
      var top = scored.slice(0, 3);
      chosenMove = top[Math.floor(Math.random() * Math.min(3, top.length))].move;
    }
    if (!chosenMove) break;

    if (currentGameDiag.some(function(d) { return d.indexOf('combos:') !== -1; })) gameHadCombo = true;

    var piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
    var promo;
    if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) promo = 'Q';
    makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);
    turnCount++;
  }

  if (!UI.state.winner && turnCount >= maxTurns) {
    UI.state.winner = 'DRAW';
    UI.state.winReason = 'MAX_TURNS';
  }

  stats.games++;
  stats.totalTurns += turnCount;
  if (UI.state.winner === 'w') stats.whiteWins++;
  else if (UI.state.winner === 'b') stats.blackWins++;
  else stats.draws++;
  if (UI.state.winReason === 'CHECKMATE') stats.checkmates++;
  else if (UI.state.winReason === 'STALEMATE') stats.stalemates++;
  else stats.maxTurnGames++;
  if (gameHadCombo) stats.gamesWithCombos++;
  if (gameHadBlock) stats.gamesWithAetherBlock++;

  var w = UI.state.winner === 'w' ? 'WHITE' : UI.state.winner === 'b' ? 'BLACK' : 'DRAW';
  var pCount = Object.values(gamePowers.white).reduce(function(a,b){return a+b;},0) + Object.values(gamePowers.black).reduce(function(a,b){return a+b;},0);
  console.log('  Game ' + (g+1) + '/' + ${GAMES} + ': ' + w + ' | ' + (UI.state.winReason||'?') + ' | ' + turnCount + ' turns | ' + pCount + ' powers');
}

console.error = origError;

console.log('\\n════════════════════════════════════════════════════════════════════════════════');
console.log('RESULTS');
console.log('════════════════════════════════════════════════════════════════════════════════\\n');

console.log('GAME RESULTS:');
console.log('  Games: ' + stats.games + ' | Hard(W): ' + stats.whiteWins + ' | Med(B): ' + stats.blackWins + ' | Draws: ' + stats.draws);
console.log('  Checkmates: ' + stats.checkmates + ' | Stalemates: ' + stats.stalemates + ' | MaxTurn: ' + stats.maxTurnGames);
console.log('  Hard win rate: ' + Math.round(stats.whiteWins/stats.games*100) + '%');
console.log('  Avg turns: ' + Math.round(stats.totalTurns / stats.games));

console.log('\\nAETHER_BLOCK STRATEGY:');
console.log('  Detections: ' + stats.aetherBlockAttempts);
console.log('  Games used: ' + stats.gamesWithAetherBlock + '/' + stats.games);
var reasons = Object.keys(stats.aetherBlockReasons);
if (reasons.length > 0) {
  console.log('  Reasons:');
  for (var i = 0; i < reasons.length; i++) {
    console.log('    ' + reasons[i] + ': ' + stats.aetherBlockReasons[reasons[i]]);
  }
}

console.log('\\nPOWER COMBOS:');
console.log('  Combo events: ' + stats.combosDetected);
console.log('  Games w/combos: ' + stats.gamesWithCombos + '/' + stats.games);

console.log('\\nTACTICAL INTELLIGENCE:');
console.log('  FORK: ' + stats.tacticalPatterns.FORK + ' | PIN: ' + stats.tacticalPatterns.PIN + ' | OVERLOAD: ' + stats.tacticalPatterns.OVERLOADED_DEFENDER);
console.log('  IMP candidates: ' + stats.impCandidates + ' | DA candidates: ' + stats.daCandidates);

console.log('\\nPOWER USAGE (White/Hard):');
var wp = Object.keys(stats.powersUsed.white);
wp.sort(function(a,b) { return stats.powersUsed.white[b] - stats.powersUsed.white[a]; });
for (var i = 0; i < Math.min(wp.length, 8); i++) {
  console.log('  ' + wp[i] + ': ' + stats.powersUsed.white[wp[i]]);
}
console.log('  Total: ' + stats.totalPowersUsed.white);

console.log('\\nPOWER USAGE (Black/Medium):');
var bp = Object.keys(stats.powersUsed.black);
bp.sort(function(a,b) { return stats.powersUsed.black[b] - stats.powersUsed.black[a]; });
for (var i = 0; i < Math.min(bp.length, 8); i++) {
  console.log('  ' + bp[i] + ': ' + stats.powersUsed.black[bp[i]]);
}
console.log('  Total: ' + stats.totalPowersUsed.black);

console.log('\\n════════════════════════════════════════════════════════════════════════════════');
console.log('STRATEGY ASSESSMENT:');
console.log('════════════════════════════════════════════════════════════════════════════════\\n');

var active = 0;
var total = 6;

if (stats.aetherBlockAttempts > 0) { console.log('  [PASS] AETHER_BLOCK: ACTIVE (' + stats.aetherBlockAttempts + ' detections)'); active++; }
else console.log('  [----] AETHER_BLOCK: Not triggered (games may be too short for 16+ aether)');

if (stats.combosDetected > 0) { console.log('  [PASS] POWER COMBOS: ACTIVE (' + stats.combosDetected + ' events)'); active++; }
else console.log('  [----] POWER COMBOS: Not detected');

var tp = stats.tacticalPatterns.FORK + stats.tacticalPatterns.PIN + stats.tacticalPatterns.OVERLOADED_DEFENDER;
if (tp > 0) { console.log('  [PASS] TACTICAL PATTERNS: ACTIVE (' + tp + ' found)'); active++; }
else console.log('  [----] TACTICAL PATTERNS: Not detected');

if (stats.checkmates > 0) { console.log('  [PASS] CHECKMATE DELIVERY: WORKING (' + stats.checkmates + '/' + stats.games + ')'); active++; }
else console.log('  [----] CHECKMATE DELIVERY: No checkmates');

if ((stats.impCandidates + stats.daCandidates) > 0) { console.log('  [PASS] IMP/DA CANDIDATES: ACTIVE (IMP:' + stats.impCandidates + ' DA:' + stats.daCandidates + ')'); active++; }
else console.log('  [----] IMP/DA: Not detected');

if (stats.whiteWins > stats.blackWins) { console.log('  [PASS] HARD BOT DOMINANCE: YES (Hard ' + stats.whiteWins + ' > Medium ' + stats.blackWins + ')'); active++; }
else console.log('  [----] HARD BOT DOMINANCE: NOT CLEAR');

console.log('\\n  SCORE: ' + active + '/' + total + ' strategies confirmed active');
console.log('════════════════════════════════════════════════════════════════════════════════\\n');
`;

var start = Date.now();
vm.runInContext(testCode, ctx, { timeout: 300000 });
console.log('Total time: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
