// ============================================================
// MANA CHESS - Balance Simulator
// Measures earliest-turn each power becomes castable under various strategies.
// Identifies degenerate "instant win" patterns.
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { module: { exports: {} }, console, Math, Array, String, Object, JSON };
ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'chess-engine.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'mana-system.js'), 'utf8'), ctx);

const {
  PIECE, COLOR, makePiece, POWER, POWER_COSTS, SACRIFICE_VALUES,
  MANA_CAP, MANA_BASE_GEN, initGame, createGameState, startOfTurn, endOfTurn,
  makeMove, sacrificePiece, castFortify, castBlink, castNova,
  algebraic, fromAlgebraic, allLegalMoves, legalMoves, isInCheck, isCheckmate,
  controlsCenter, canAfford, opposite
} = ctx;

// ============================================================
// Strategy A: Passive (no moves, just accumulate mana)
// Measures: mana curve under pure hoarding
// ============================================================
function simulatePassive() {
  const state = initGame();
  const manaCurve = [state.mana[COLOR.WHITE]];
  // Simulate 15 turns by forcibly ending turn (skipping actual moves)
  for (let i = 0; i < 15; i++) {
    endOfTurn(state);  // pass turn
    if (state.turn === COLOR.WHITE) {
      manaCurve.push(state.mana[COLOR.WHITE]);
    }
  }
  return manaCurve;
}

// ============================================================
// Strategy B: Earliest Nova (no sacrifice, no capture)
// ============================================================
function earliestNovaPassive() {
  const state = initGame();
  for (let turn = 1; turn <= 20; turn++) {
    if (canAfford(state, COLOR.WHITE, POWER.NOVA)) return turn;
    endOfTurn(state);
    endOfTurn(state); // back to white after black's turn
  }
  return null;
}

// ============================================================
// Strategy C: Queen Sacrifice Rush
// Turn 1: sacrifice Queen, cast Nova if possible
// ============================================================
function queenSacRush() {
  const state = initGame();
  const reports = [];
  // Turn 1: sacrifice queen
  const preMana = state.mana[COLOR.WHITE];
  const res = sacrificePiece(state, 7, 3); // White Queen d1
  const postMana = state.mana[COLOR.WHITE];
  reports.push(`T1 starting mana: ${preMana}`);
  reports.push(`T1 after Queen sacrifice: ${postMana} (gain ${postMana - preMana})`);
  if (canAfford(state, COLOR.WHITE, POWER.NOVA)) {
    reports.push(`T1 CAN CAST NOVA (${POWER_COSTS[POWER.NOVA]}). BROKEN.`);
    // Try to target adjacent to enemy King
    // Enemy king at e8 = row 0, col 4. Nova at d8 (row 0 col 3) would blast e8.
    const novaRes = castNova(state, 0, 3);
    if (novaRes.success) {
      reports.push(`  Nova result: winner=${state.winner}, reason=${state.winReason}`);
    }
  } else {
    reports.push(`T1 CANNOT cast Nova (needs ${POWER_COSTS[POWER.NOVA]}, have ${postMana})`);
  }
  return reports;
}

// ============================================================
// Strategy D: Earliest Nova with Queen Sacrifice
// Accumulate mana, then queen-sac + nova
// ============================================================
function earliestNovaWithQueenSac() {
  const state = initGame();
  for (let turn = 1; turn <= 20; turn++) {
    // See if this turn we could sacrifice Queen and reach Nova
    const currentMana = state.mana[COLOR.WHITE];
    const queenGain = SACRIFICE_VALUES[PIECE.QUEEN];
    const simulatedMana = Math.min(MANA_CAP, currentMana + queenGain);
    if (simulatedMana >= POWER_COSTS[POWER.NOVA]) {
      return turn;
    }
    endOfTurn(state); endOfTurn(state); // next white turn
  }
  return null;
}

// ============================================================
// Strategy E: Earliest Nova with BEST sacrifice combo
// (multiple sacrifices in a single turn if legal)
// ============================================================
function earliestNovaMultiSac() {
  const state = initGame();
  for (let turn = 1; turn <= 20; turn++) {
    let mana = state.mana[COLOR.WHITE];
    // Best legal: sacrifice Queen, then any other pieces while king not in check
    // Conservative estimate: Queen + Rook + Knight = 12 + 8 + 5 = 25 -> capped at 20
    // But some pieces protect king. Let's just try Queen sac.
    // Actually: just Queen gives 12. If mana + 12 >= Nova cost, done.
    mana = Math.min(MANA_CAP, mana + SACRIFICE_VALUES[PIECE.QUEEN]);
    if (mana >= POWER_COSTS[POWER.NOVA]) {
      return turn;
    }
    endOfTurn(state); endOfTurn(state);
  }
  return null;
}

// ============================================================
// Check: Can Turn-1 Nova kill enemy King?
// ============================================================
function turn1NovaCheck() {
  const state = initGame();
  sacrificePiece(state, 7, 3); // sac queen
  // Check white can now afford Nova
  const mana = state.mana[COLOR.WHITE];
  if (mana < POWER_COSTS[POWER.NOVA]) {
    return { broken: false, reason: `Only ${mana} mana, need ${POWER_COSTS[POWER.NOVA]}` };
  }
  // Try Nova adjacent to enemy King
  // Enemy King at e8 (row 0, col 4). Adjacent squares include d8, e7, f8, d7, f7, etc.
  // Target d8 (row 0 col 3): blast includes c8, c7, d7, e7, e8, [NOT d8 itself]
  // So enemy King e8 IS in blast. Would win.
  const res = castNova(state, 0, 3);
  return {
    broken: res.kingKilled || res.deadMansHand,
    winner: state.winner,
    reason: state.winReason,
    whiteManaAfter: state.mana[COLOR.WHITE]
  };
}

// ============================================================
// Power-castable-by-turn matrix
// ============================================================
function powerByTurnMatrix() {
  const state = initGame();
  const rows = [];
  for (let turn = 1; turn <= 12; turn++) {
    const row = { turn, mana: state.mana[COLOR.WHITE] };
    for (const [name, cost] of Object.entries(POWER_COSTS)) {
      row[name] = state.mana[COLOR.WHITE] >= cost ? '✓' : '·';
    }
    rows.push(row);
    endOfTurn(state); endOfTurn(state);
  }
  return rows;
}

// ============================================================
// Intelligent self-play simulation
// ============================================================
// Piece values for a very simple eval
const PIECE_VALUES = {
  [PIECE.PAWN]: 1, [PIECE.KNIGHT]: 3, [PIECE.BISHOP]: 3,
  [PIECE.ROOK]: 5, [PIECE.QUEEN]: 9, [PIECE.KING]: 0
};

function evaluateBoard(state, color) {
  let score = 0;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = state.board[r][c];
    if (!p) continue;
    const v = PIECE_VALUES[p.type];
    score += p.color === color ? v : -v;
  }
  return score;
}

function pickBestMove(state) {
  const color = state.turn;
  const moves = allLegalMoves(state.board, color, state);
  if (moves.length === 0) return null;
  // Prefer captures, then random move
  const captures = moves.filter(m => {
    const target = state.board[m.to.r][m.to.c];
    return target && target.color !== color;
  });
  if (captures.length > 0) {
    // Pick highest-value capture
    captures.sort((a,b) => {
      const ta = state.board[a.to.r][a.to.c], tb = state.board[b.to.r][b.to.c];
      return PIECE_VALUES[tb.type] - PIECE_VALUES[ta.type];
    });
    return captures[0];
  }
  // Otherwise random (for diversity)
  return moves[Math.floor(Math.random() * moves.length)];
}

function simulateGame(maxTurns = 60) {
  const state = initGame();
  const report = {
    moves: 0,
    earliestCast: {},
    winner: null,
    winReason: null,
    turnNumber: 0
  };
  for (let t = 0; t < maxTurns * 2 && !state.winner; t++) {
    const move = pickBestMove(state);
    if (!move) break;
    makeMove(state, move.from.r, move.from.c, move.to.r, move.to.c, PIECE.QUEEN);
    report.moves++;
  }
  report.winner = state.winner;
  report.winReason = state.winReason;
  report.turnNumber = state.turnNumber;
  report.whiteMana = state.mana[COLOR.WHITE];
  report.blackMana = state.mana[COLOR.BLACK];
  return report;
}

// ============================================================
// RUN ALL REPORTS
// ============================================================
console.log('='.repeat(70));
console.log('MANA CHESS - Balance Analysis');
console.log('='.repeat(70));

console.log(`\n### Current configuration`);
console.log(`  Starting mana: 0 (before Phase 1)`);
console.log(`  Base gen: ${MANA_BASE_GEN}/turn`);
console.log(`  Mana cap: ${MANA_CAP}`);
console.log(`  Nova cost: ${POWER_COSTS[POWER.NOVA]}`);
console.log(`  Sacrifice Queen: +${SACRIFICE_VALUES[PIECE.QUEEN]}`);

console.log(`\n### Mana curve (passive, no captures, no center control)`);
const curve = simulatePassive();
console.log(`  Turns 1..${curve.length}: ${curve.join(', ')}`);

console.log(`\n### Earliest turn each power becomes affordable (passive)`);
const matrix = powerByTurnMatrix();
const headers = ['T', 'Mana', ...Object.keys(POWER_COSTS)];
console.log('  ' + headers.map(h => h.padEnd(8)).join(''));
for (const row of matrix) {
  const cells = [row.turn, row.mana, ...Object.keys(POWER_COSTS).map(k => row[k])];
  console.log('  ' + cells.map(c => String(c).padEnd(8)).join(''));
}

console.log(`\n### Earliest Nova scenarios`);
console.log(`  Pure hoard (no sac, no capture): turn ${earliestNovaPassive()}`);
console.log(`  With Queen sacrifice:            turn ${earliestNovaWithQueenSac()}`);

console.log(`\n### Turn-1 Queen sac + Nova check (THE BIG EXPLOIT)`);
const t1 = turn1NovaCheck();
console.log(`  Result: ${JSON.stringify(t1, null, 2)}`);

console.log(`\n### Turn-1 Queen sac rush trace`);
const rush = queenSacRush();
for (const line of rush) console.log(`  ${line}`);

console.log(`\n### Self-play simulation (random-capture bot)`);
let novaUses = 0, shortGames = 0;
const GAMES = 20;
for (let i = 0; i < GAMES; i++) {
  const r = simulateGame(80);
  if (r.winReason === 'SELF_DESTRUCTION' || r.winReason === 'DEAD_MANS_HAND' ||
      r.winReason === 'KING_DESTROYED') novaUses++;
  if (r.moves < 20) shortGames++;
}
console.log(`  ${GAMES} games played`);
console.log(`  Games ended by power kill: ${novaUses}/${GAMES}`);
console.log(`  Games ending in <20 moves: ${shortGames}/${GAMES}`);

// ============================================================
// Can Black defend vs Turn-4 Nova rush?
// Black's strategy: fortify own King ASAP
// White's strategy: accumulate mana, queen-sac at turn 4, Nova adjacent to Black King
// ============================================================
function defendedNovaRush() {
  const state = initGame();
  const log = [];

  // Turn 1 (white): develop a piece (knight out)
  makeMove(state, 6, 4, 4, 4); // e4
  log.push(`T1 W: e4. WMana=${state.mana[COLOR.WHITE]} BMana=${state.mana[COLOR.BLACK]}`);

  // Turn 1 (black): fortify king e8 (cost 3)
  let r = castFortify(state, 0, 4);
  log.push(`T1 B: Fortify King at e8 -> ${r.success ? 'OK' : r.error}. BMana=${state.mana[COLOR.BLACK]}`);
  if (r.success) {
    // black still needs to move
    makeMove(state, 1, 4, 3, 4); // e5
  } else {
    makeMove(state, 1, 4, 3, 4);
  }
  log.push(`T1 B move e5. WMana=${state.mana[COLOR.WHITE]} BMana=${state.mana[COLOR.BLACK]}`);

  // Turn 2-3: both develop
  makeMove(state, 7, 6, 5, 5); // Nf3
  log.push(`T2 W: Nf3. WMana=${state.mana[COLOR.WHITE]}`);
  makeMove(state, 0, 1, 2, 2); // Nc6
  log.push(`T2 B: Nc6. BMana=${state.mana[COLOR.BLACK]}`);
  makeMove(state, 7, 5, 4, 2); // Bc4
  log.push(`T3 W: Bc4. WMana=${state.mana[COLOR.WHITE]}`);
  makeMove(state, 0, 6, 2, 5); // Nf6
  log.push(`T3 B: Nf6. BMana=${state.mana[COLOR.BLACK]}`);

  // Turn 4 white: sacrifice queen, Nova at d8 (targets e8 enemy king)
  log.push(`T4 W: starting mana=${state.mana[COLOR.WHITE]}`);
  const sac = sacrificePiece(state, 7, 3); // d1 queen
  log.push(`T4 W: Queen sac -> ${sac.success ? 'OK +'+sac.gain : sac.error}. WMana=${state.mana[COLOR.WHITE]}`);
  if (canAfford(state, COLOR.WHITE, POWER.NOVA)) {
    const nov = castNova(state, 0, 3); // target d8
    log.push(`T4 W: NOVA at d8 -> winner=${state.winner}, reason=${state.winReason}`);
  } else {
    log.push(`T4 W: cannot afford Nova (need ${POWER_COSTS[POWER.NOVA]}, have ${state.mana[COLOR.WHITE]})`);
  }

  return { log, winner: state.winner, reason: state.winReason };
}

console.log(`\n### Defense scenario: Black Fortifies King vs White Nova Rush`);
const def = defendedNovaRush();
for (const line of def.log) console.log(`  ${line}`);
console.log(`  RESULT: winner=${def.winner}, reason=${def.reason}`);

// ============================================================
// Earliest King-kill time (shortest theoretical win)
// ============================================================
function earliestKingKill() {
  // Scenario: white hoards + sacs + nova. Black does nothing.
  // Turn by turn, track when white can cast Nova adjacent to enemy King.
  const state = initGame();
  for (let t = 1; t <= 10; t++) {
    // Each White turn: try sacrifice-rush toward Nova
    const canSac = !state.sacrificedThisTurn[COLOR.WHITE];
    const queenAlive = state.board[7][3] && state.board[7][3].type === PIECE.QUEEN;
    if (canSac && queenAlive) {
      const snap = { mana: state.mana[COLOR.WHITE] };
      // Simulate: sacrifice queen
      const sres = sacrificePiece(state, 7, 3);
      if (!sres.success) return { turn: null, reason: 'sac failed: '+sres.error };
    }
    if (canAfford(state, COLOR.WHITE, POWER.NOVA)) {
      // Assume Black king reachable by a Nova target square
      // Most aggressive: target a square adjacent to Black King that white can legally target
      return { turn: t, mana: state.mana[COLOR.WHITE] };
    }
    // End this turn (both players, skipping moves)
    // Black needs to move — give black any legal move
    const moves = allLegalMoves(state.board, COLOR.WHITE, state);
    if (moves.length === 0) return { turn: null, reason: 'no legal moves' };
    const m = moves[0];
    makeMove(state, m.from.r, m.from.c, m.to.r, m.to.c, PIECE.QUEEN);
    const bmoves = allLegalMoves(state.board, COLOR.BLACK, state);
    if (bmoves.length === 0) return { turn: null, reason: 'black no legal moves' };
    const bm = bmoves[0];
    makeMove(state, bm.from.r, bm.from.c, bm.to.r, bm.to.c, PIECE.QUEEN);
  }
  return { turn: null, reason: 'not reachable in 10 turns' };
}

console.log(`\n### Earliest practical King-kill (white rushes, black inert)`);
const ek = earliestKingKill();
console.log(`  ${JSON.stringify(ek)}`);

console.log(`\n${'='.repeat(70)}`);
console.log(`Verdict: ${t1.broken ? '🚨 BROKEN — Turn-1 sacrifice-Nova can win!' : '✓ OK — No turn-1 exploit found'}`);
console.log(`${'='.repeat(70)}`);
