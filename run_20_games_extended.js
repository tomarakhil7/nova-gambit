// Extended 20-game analysis with power combo tracking
const fs = require('fs');
const vm = require('vm');

console.log('\n' + '═'.repeat(120));
console.log('EXTENDED 20-GAME ANALYSIS - POWER COMBOS & CHECKMATE STRATEGIES');
console.log('═'.repeat(120));
console.log('');

const stats = {
  games: 0, white: 0, black: 0, draws: 0, moves: 0,
  combos: {DOUBLE_ATTACK: 0, SHIELD: 0, FORTIFY: 0, OTHER: 0},
  checkmates: 0, cleanGames: 0
};

for (let gameNum = 1; gameNum <= 20; gameNum++) {
  process.stdout.write(`Game ${gameNum.toString().padStart(2)}/20: `);

  try {
    const sandbox = {
      console, Math, Date, Array, Object, String, Number, Boolean, JSON,
      parseInt, parseFloat, isNaN, isFinite, undefined, Infinity, NaN,
      setTimeout: (fn) => fn(), clearInterval: () => {}, setInterval: () => {},
      document: {getElementById: () => null, createElement: () => ({innerHTML: '', appendChild: () => {}, addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => []}), body: {appendChild: () => {}}},
    };
    sandbox.UI = { state: null, gameActions: [], selected: null, activePower: null, powerState: {}, prevAether: {} };
    sandbox.render = sandbox.setStatus = sandbox.floatingText = sandbox.buildBoard = sandbox.showGameOverModal = sandbox.recordAction = function() {};

    const ctx = vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync('game/js/chess-engine.js', 'utf8'), ctx);
    vm.runInContext(fs.readFileSync('game/js/mana-system.js', 'utf8'), ctx);
    vm.runInContext(fs.readFileSync('game/js/bot.js', 'utf8'), ctx);

    let output = '';
    const origLog = console.log;
    console.log = (msg) => { output += msg + '\n'; };

    const code = `
      UI.state = initGame(); botClearHistory();
      let turn = 0; const powerLog = []; const combosFound = [];
      while (!UI.state.winner && turn < 200) {
        const color = UI.state.turn;
        const moves = allLegalMoves(UI.state.board, color, UI.state);
        if (moves.length === 0) {
          UI.state.winner = isInCheck(UI.state.board, color) ? opposite(color) : 'DRAW';
          break;
        }
        BOT.difficulty = 'hard'; BOT.enabled = true;
        const aBefore = UI.state.mana[color];
        const power = botConsiderPowers(UI.state, color);
        if (power) {
          const r = power.exec();
          if (r && r.success) {
            powerLog.push(power.name);
            if (['DOUBLE_ATTACK', 'SHIELD', 'FORTIFY'].includes(power.name)) {
              combosFound.push(power.name);
            }
            if (UI.state.turn !== color) { turn++; continue; }
          }
        }
        if (UI.state.winner) break;
        const move = botSearchBestMove(UI.state, moves, color);
        if (!move) break;
        const piece = UI.state.board[move.from.r][move.from.c];
        if (!piece) break;
        let promo = piece.type === 'P' && (move.to.r === 0 || move.to.r === 7) ? 'Q' : null;
        makeMove(UI.state, move.from.r, move.from.c, move.to.r, move.to.c, promo);
        turn++;
      }
      if (!UI.state.winner) UI.state.winner = 'DRAW';
      console.log(JSON.stringify({
        winner: UI.state.winner === 'w' ? 'White' : UI.state.winner === 'b' ? 'Black' : 'Draw',
        moves: turn,
        powers: powerLog.length,
        combos: combosFound.length,
        combo_types: combosFound.join(','),
        aether_w: UI.state.mana['w'],
        aether_b: UI.state.mana['b']
      }));
    `;

    vm.runInContext(code, ctx, { timeout: 180000 });
    console.log = origLog;

    const result = JSON.parse(output.trim().split('\n').pop());
    stats.games++;
    stats.moves += result.moves;
    if (result.winner === 'White') stats.white++;
    else if (result.winner === 'Black') stats.black++;
    else stats.draws++;

    if (result.combo_types) {
      for (const combo of result.combo_types.split(',').filter(x => x)) {
        if (combo === 'DOUBLE_ATTACK') stats.combos.DOUBLE_ATTACK++;
        else if (combo === 'SHIELD') stats.combos.SHIELD++;
        else if (combo === 'FORTIFY') stats.combos.FORTIFY++;
        else stats.combos.OTHER++;
      }
    }

    if (result.winner !== 'Draw') {
      stats.checkmates++;
      process.stdout.write(`✓ ${result.winner.padEnd(6)} checkmate | ${result.moves}m ${result.powers}p ${result.combos}c\n`);
    } else {
      process.stdout.write(`✓ Draw | ${result.moves}m ${result.powers}p ${result.combos}c\n`);
    }

  } catch (err) {
    process.stdout.write(`✗ Error\n`);
    stats.games++;
  }
}

console.log('\n' + '═'.repeat(120));
console.log('📊 FINAL ANALYSIS - 20 GAMES');
console.log('═'.repeat(120));
console.log(`\nResults:`);
console.log(`  Total games: ${stats.games}`);
console.log(`  White wins: ${stats.white} (${(stats.white/stats.games*100).toFixed(1)}%)`);
console.log(`  Black wins: ${stats.black} (${(stats.black/stats.games*100).toFixed(1)}%)`);
console.log(`  Draws: ${stats.draws} (${(stats.draws/stats.games*100).toFixed(1)}%)`);
console.log(`  Decisive games: ${stats.checkmates} (${(stats.checkmates/stats.games*100).toFixed(1)}%)`);
console.log(`  Avg moves/game: ${(stats.moves/stats.games).toFixed(1)}`);

console.log(`\nPower Combos Executed:`);
console.log(`  DOUBLE_ATTACK: ${stats.combos.DOUBLE_ATTACK}`);
console.log(`  SHIELD: ${stats.combos.SHIELD}`);
console.log(`  FORTIFY: ${stats.combos.FORTIFY}`);
console.log(`  OTHER: ${stats.combos.OTHER}`);
console.log(`  TOTAL: ${stats.combos.DOUBLE_ATTACK + stats.combos.SHIELD + stats.combos.FORTIFY + stats.combos.OTHER} (${((stats.combos.DOUBLE_ATTACK + stats.combos.SHIELD + stats.combos.FORTIFY + stats.combos.OTHER)/stats.games).toFixed(1)}/game)`);

console.log('\n✅ ANALYSIS COMPLETE');
console.log('═'.repeat(120) + '\n');

