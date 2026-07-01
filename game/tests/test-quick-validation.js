// Quick validation test: verify bot doesn't crash, BLINK safety works, PROMOTE awareness works
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

console.log('=== QUICK VALIDATION TEST ===\n');

const testCode = `
// Test 1: BLINK safety - bot should NOT blink a piece that exposes its queen
console.log('TEST 1: BLINK does not expose Queen');
(function() {
  UI.state = initGame();
  UI.gameActions = [];
  botClearHistory();
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) UI.state.board[r][c] = null;
  UI.state.board[0][4] = makePiece(PIECE.KING, 'black');
  UI.state.board[0][3] = makePiece(PIECE.QUEEN, 'black');
  UI.state.board[3][3] = makePiece(PIECE.PAWN, 'black');
  UI.state.board[3][4] = makePiece(PIECE.PAWN, 'black');
  UI.state.board[2][2] = makePiece(PIECE.KNIGHT, 'black');
  UI.state.board[7][4] = makePiece(PIECE.KING, 'white');
  UI.state.board[7][3] = makePiece(PIECE.QUEEN, 'white');
  UI.state.board[5][5] = makePiece(PIECE.KNIGHT, 'white');

  UI.state.turn = 'b';
  UI.state.mana = { w: 15, b: 10 };
  UI.state.aetherBlocked = { w: false, b: false };
  UI.state.turnNumber = 8;
  UI.state.bombs = [];
  UI.state.fountains = [{r: 3, c: 0}, {r: 3, c: 7}];

  BOT.difficulty = 'hard';
  BOT.enabled = true;
  BOT.botVsBot = true;

  var power = botConsiderPowers(UI.state, 'b');
  if (power && power.name === 'BLINK') {
    var from = power.payload ? power.payload.from : null;
    if (from && from.r === 3 && from.c === 3) {
      console.log('  [FAIL] Bot tries to blink d5 pawn - would expose queen!');
    } else {
      console.log('  [PASS] Bot blinks a different piece (safe)');
    }
  } else {
    console.log('  [PASS] Bot does NOT suggest dangerous BLINK');
  }
})();

// Test 2: PROMOTE threat awareness
console.log('\\nTEST 2: PROMOTE threat recognized in evaluation');
(function() {
  UI.state = initGame();
  UI.gameActions = [];
  botClearHistory();
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) UI.state.board[r][c] = null;
  UI.state.board[0][4] = makePiece(PIECE.KING, 'black');
  UI.state.board[1][0] = makePiece(PIECE.ROOK, 'black');
  UI.state.board[7][4] = makePiece(PIECE.KING, 'white');
  UI.state.board[4][5] = makePiece(PIECE.PAWN, 'white');   // f4 pawn (advanced)
  UI.state.board[6][0] = makePiece(PIECE.PAWN, 'white');   // a2 pawn (not advanced)

  UI.state.turn = 'b';
  UI.state.mana = { w: 17, b: 5 };
  UI.state.aetherBlocked = { w: false, b: false };
  UI.state.turnNumber = 30;
  UI.state.bombs = [];
  UI.state.fountains = [];

  var score = botEvaluate(UI.state, 'b');
  UI.state.mana.w = 10;
  var scoreNoThreat = botEvaluate(UI.state, 'b');

  var diff = scoreNoThreat - score;
  if (diff > 20) {
    console.log('  [PASS] PROMOTE threat detected (penalty diff=' + diff + ')');
  } else {
    console.log('  [WARN] PROMOTE threat weak (diff=' + diff + ')');
  }
})();

// Test 3: Opening guard - no wasteful BLINK in first 12 turns
console.log('\\nTEST 3: Opening BLINK guard');
(function() {
  UI.state = initGame();
  UI.gameActions = [];
  botClearHistory();
  UI.state.turn = 'b';
  UI.state.mana = { w: 5, b: 10 };
  UI.state.aetherBlocked = { w: false, b: false };
  UI.state.turnNumber = 6;
  UI.state.bombs = [];

  BOT.difficulty = 'hard';
  BOT.enabled = true;
  BOT.botVsBot = true;

  var power = botConsiderPowers(UI.state, 'b');
  var blinkUsed = power && power.name === 'BLINK';
  if (!blinkUsed) {
    console.log('  [PASS] No wasteful BLINK in opening (turn 6)');
  } else {
    var reason = power.payload ? power.payload.reason : '?';
    if (reason === 'escape' || reason === 'checkmate' || reason === 'bomb-escape') {
      console.log('  [PASS] BLINK in opening for valid reason: ' + reason);
    } else {
      console.log('  [FAIL] Wasteful BLINK at turn 6: ' + reason);
    }
  }
})();

// Test 4: Quick game (depth-limited)
console.log('\\nTEST 4: Game completion');
(function() {
  var start = Date.now();
  UI.state = initGame();
  UI.gameActions = [];
  botClearHistory();
  var tc = 0;
  var origGetDepth = botGetSearchDepth;
  botGetSearchDepth = function(s) { return Math.min(4, origGetDepth(s)); };

  while (!UI.state.winner && tc < 20) {
    var color = UI.state.turn;
    BOT.difficulty = color === 'w' ? 'hard' : 'medium';
    BOT.enabled = true; BOT.botVsBot = true;
    var moves = allLegalMoves(UI.state.board, color, UI.state);
    if (moves.length === 0) {
      if (isInCheck(UI.state.board, color)) { UI.state.winner = opposite(color); UI.state.winReason = 'CHECKMATE'; }
      else { UI.state.winner = 'DRAW'; }
      break;
    }
    var power = botConsiderPowers(UI.state, color);
    if (power) {
      var r = power.exec();
      if (r && r.success) {
        UI.gameActions.push({type: 'POWER_CAST', by: color, payload: power.payload});
        if (UI.state.turn !== color) { tc++; continue; }
      }
    }
    var chosenMove;
    if (BOT.difficulty === 'hard') {
      var bookMove = botGetBookMove(UI.state, color, moves);
      chosenMove = bookMove || botSearchBestMove(UI.state, moves, color);
    } else {
      var scored = moves.map(function(m) { return { move: m, score: botScoreMove(UI.state, m.from, m.to, color) }; });
      scored.sort(function(a,b) { return b.score - a.score; });
      chosenMove = scored[0].move;
    }
    if (!chosenMove) break;
    var piece = UI.state.board[chosenMove.from.r][chosenMove.from.c];
    var promo;
    if (piece && piece.type === 'P' && (chosenMove.to.r === 0 || chosenMove.to.r === 7)) promo = 'Q';
    makeMove(UI.state, chosenMove.from.r, chosenMove.from.c, chosenMove.to.r, chosenMove.to.c, promo);
    UI.gameActions.push({type: 'MOVE', by: color, payload: {from: chosenMove.from, to: chosenMove.to}});
    tc++;
  }
  botGetSearchDepth = origGetDepth;
  var elapsed = ((Date.now() - start) / 1000).toFixed(1);
  var w = UI.state.winner === 'w' ? 'WHITE' : UI.state.winner === 'b' ? 'BLACK' : 'ongoing';
  console.log('  [PASS] ' + tc + ' turns in ' + elapsed + 's (' + w + ' ' + (UI.state.winReason||'') + ')');
})();

console.log('\\n=== ALL TESTS COMPLETE ===');
`;

const start = Date.now();
vm.runInContext(testCode, ctx, { timeout: 60000 });
console.log('Total: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
