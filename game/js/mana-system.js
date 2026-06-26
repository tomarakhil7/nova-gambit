// ============================================================
// NOVA GAMBIT - Aether Economy & Power System (v3.0)
// Depends on: chess-engine.js
// ============================================================

// Node-compat: pull engine symbols into local scope when running via require()
if (typeof module !== 'undefined' && module.exports && typeof PIECE === 'undefined') {
  const eng = require('./chess-engine.js');
  // eslint-disable-next-line no-global-assign
  for (const k of Object.keys(eng)) global[k] = eng[k];
}

const POWER = {
  // Tier 1 — cheap utility
  FROST: 'FROST',
  FORTIFY: 'FORTIFY',
  SPAWN: 'SPAWN',
  BLINK: 'BLINK',
  // Tier 2 — mid-cost tactical
  IMPRISON: 'IMPRISON',
  AETHER_BLOCK: 'AETHER_BLOCK',
  CLEANSE: 'CLEANSE',
  BOMBA: 'BOMBA',
  DOUBLE_ATTACK: 'DOUBLE_ATTACK',
  // Tier 3 — expensive finishers
  PROMOTE: 'PROMOTE',
  VENGEANCE: 'VENGEANCE',
  WALL: 'WALL',
  CHRONOBREAK: 'CHRONOBREAK'
};

const POWER_TIER = {
  [POWER.FROST]: 1, [POWER.FORTIFY]: 1, [POWER.BLINK]: 1, [POWER.SPAWN]: 1,
  [POWER.IMPRISON]: 2, [POWER.AETHER_BLOCK]: 2, [POWER.CLEANSE]: 2,
  [POWER.BOMBA]: 2, [POWER.DOUBLE_ATTACK]: 2,
  [POWER.PROMOTE]: 3, [POWER.VENGEANCE]: 3, [POWER.WALL]: 3, [POWER.CHRONOBREAK]: 3
};

// v3.5 cost rebalance — Imprison + Cleanse aligned at 14.
// v3.6: Shield -> 14, Aether Block -> 16, Double Attack -> 14 (Bug fix #7)
const POWER_COSTS = {
  [POWER.SPAWN]: 6,
  [POWER.FROST]: 8,
  [POWER.FORTIFY]: 14,
  [POWER.BLINK]: 8,
  [POWER.IMPRISON]: 14,
  [POWER.AETHER_BLOCK]: 16,
  [POWER.CLEANSE]: 14,
  [POWER.BOMBA]: 14,
  [POWER.DOUBLE_ATTACK]: 14,
  [POWER.PROMOTE]: 15,
  [POWER.VENGEANCE]: 18,
  [POWER.WALL]: 18,
  [POWER.CHRONOBREAK]: 20
};

const POWER_DISPLAY_NAMES = {
  [POWER.FROST]: 'Frost',
  [POWER.FORTIFY]: 'Fortify',
  [POWER.BLINK]: 'Blink',
  [POWER.SPAWN]: 'Spawn',
  [POWER.BOMBA]: 'Bomba',
  [POWER.DOUBLE_ATTACK]: 'Double Attack',
  [POWER.IMPRISON]: 'Imprison',
  [POWER.AETHER_BLOCK]: 'Aether Block',
  [POWER.CLEANSE]: 'Cleanse',
  [POWER.PROMOTE]: 'Promote',
  [POWER.CHRONOBREAK]: 'Chronobreak',
  [POWER.VENGEANCE]: 'Vengeance',
  [POWER.WALL]: 'The Wall'
};

const POWER_DESCRIPTIONS = {
  [POWER.FROST]: 'Freeze one enemy non-King piece for 1 turn. Frozen pieces cannot move and block castling. Turn continues.',
  [POWER.FORTIFY]: 'Grant a 1-hit shield to your piece. Shield absorbs the next capture attempt (attacker does NOT land), then breaks. Shield expires at end of your next turn if unused. Turn continues.',
  [POWER.BLINK]: 'Teleport one of your pieces (not King) to any empty square within a 3×3 grid (the 8 adjacent squares). Turn ends. Cannot deliver checkmate.',
  [POWER.SPAWN]: 'Summon a Spectral Pawn on an empty square in your half (ranks 1–4). It cannot move or be sacrificed and vanishes on your next turn. Turn continues.',
  [POWER.BOMBA]: 'Pawn-only power. Pick one of your pawns and plant a bomb on an empty square that is directly ahead of it OR diagonally adjacent to it (the 3 squares in front-left / front / front-right). Detonates next turn — destroys unshielded ENEMY non-King pieces in the 3×3 blast. Kings, shielded pieces, and your own pieces are safe. Shields absorb one blast. Defused if a piece moves onto the bomb square. Turn continues.',
  [POWER.DOUBLE_ATTACK]: 'Choose one of your pieces and take TWO actions with it this turn. Each step can be a move OR a capture (any legal action for that piece). The second step starts from wherever the first one landed. Cannot target the King. Cannot deliver checkmate. Turn ends.',
  [POWER.IMPRISON]: 'Capture an adjacent enemy non-King piece INSIDE your piece. Captor can still move normally. If the captor dies, the prisoner returns to its OWN starting tile (e.g. a black knight from b8 returns to b8); if that tile is occupied, the prisoner waits OFF-BOARD until the home tile becomes free, then re-enters automatically at the start of its owner\'s turn. Cannot imprison frozen, Spectral, or already-captor pieces. Turn continues.',
  [POWER.AETHER_BLOCK]: 'Silence your opponent — they cannot spend Aether on their next turn. Active effects still tick. Turn continues.',
  [POWER.CLEANSE]: 'Remove Imprisonment and/or Frost and/or Shield from any piece (yours or theirs). Can target the imprisoner to free the prisoner, or the imprisoned piece directly. Releases any prisoner inside — the prisoner returns to its OWN starting tile (e.g. b8 knight → b8). If that tile is occupied, the prisoner waits OFF-BOARD until the home tile becomes free, then re-enters at the start of its owner\'s turn. Removes shields from shielded pieces. Turn continues.',
  [POWER.PROMOTE]: 'Instantly promote any of your pawns to Queen, Rook, Bishop, or Knight (not Spectral). Turn ends.',
  [POWER.CHRONOBREAK]: "Undo opponent's ENTIRE previous turn — every move, capture, and power they cast (Frost, Fortify, Blink, Spawn, Bomba, Double Attack, Imprison, Aether Block, Cleanse, Promote, Vengeance, The Wall) — restoring board, prisoners, shields, freezes, bombs, blocks, and per-turn flags. Their spent Aether is NOT refunded. Cannot Chronobreak a Chronobreak. CANNOT undo a checkmate (the game is already over). Turn continues.",
  [POWER.VENGEANCE]: 'Destroy any 1 enemy non-King piece anywhere on the board. Bypasses shield (shield absorbs 1 then piece dies). Cannot leave your King in check. Cannot deliver checkmate. Turn ends.',
  [POWER.WALL]: 'Choose one direction (North, South, East, or West) and spawn friendly pawns on empty adjacent squares in that direction around one of your pieces (up to 3). Skips last-rank squares. Cannot be cast if the spawned pawns would give check or mate to the enemy King. Turn ends.'
};

const SACRIFICE_VALUES = {
  [PIECE.PAWN]: 1,
  [PIECE.KNIGHT]: 2,
  [PIECE.BISHOP]: 2,
  [PIECE.ROOK]: 4,
  [PIECE.QUEEN]: 6
};

const AETHER_CAP = 30;
// Base gen scales by full-turn number (each player's own turn count):
//   turns 1-10: +1, turns 11-20: +2, turns 21+: +3.
// Track via state.fullTurnsPlayed[color] (increments when a player's turn ends).
function aetherBaseGenForTurn(fullTurnsPlayed) {
  if (fullTurnsPlayed >= 21) return 3;
  if (fullTurnsPlayed >= 11) return 2;
  return 1;
}
const AETHER_BASE_GEN = 1; // legacy (used only as a fallback)
const STARTING_AETHER_WHITE = 0;
const STARTING_AETHER_BLACK = 1;

// Legacy aliases
const MANA_CAP = AETHER_CAP;
const MANA_BASE_GEN = AETHER_BASE_GEN;
const STARTING_MANA = STARTING_AETHER_WHITE;
const STARTING_AETHER = STARTING_AETHER_WHITE;

// Center squares: d4, e4, d5, e5 (row 4 col 3/4 and row 3 col 3/4).
const CENTER_SQUARES = [{r:4,c:3},{r:4,c:4},{r:3,c:3},{r:3,c:4}];
const CENTER_BONUS = 1; // +1 to the player with MAJORITY in the center (strict)
const FOUNTAIN_BONUS = 2; // +2 per occupying piece on a fountain (stacks)

// ---------- Game State ----------
function createGameState(opts = {}) {
  const fountains = opts.fountains || randomFountains(opts.seed);
  return {
    board: createInitialBoard(),
    turn: COLOR.WHITE,
    turnNumber: 1,
    mana: { [COLOR.WHITE]: STARTING_AETHER_WHITE, [COLOR.BLACK]: STARTING_AETHER_BLACK },
    history: [],
    enPassantTarget: null,
    pendingEnPassant: null,
    bombs: [], // renamed from timeBombs for clarity
    timeBombs: [], // alias referencing same array below
    winner: null,
    winReason: null,
    lastMoveInfo: null,
    phase: 'ACTION',
    log: [],
    sacrificedThisTurn: { [COLOR.WHITE]: false, [COLOR.BLACK]: false },
    aetherBlocked: { [COLOR.WHITE]: false, [COLOR.BLACK]: false }, // opponent casts Aether Block
    firstGenSkipped: { [COLOR.WHITE]: false, [COLOR.BLACK]: false },
    fullTurnsPlayed: { [COLOR.WHITE]: 0, [COLOR.BLACK]: 0 }, // v3.2: scaling base gen
    // v3.5: prisoners released by Cleanse/captor-death whose home tile was occupied
    // wait off-board here. Each entry: { piece, color, type, originFile }. They re-enter
    // automatically at the start of their owner's turn when the home tile is free.
    pendingPrisoners: [],
    // lastMoveCausedBy: what power, if any, produced the opponent's last move (for Chronobreak rules)
    lastActionKind: null, // 'MOVE' | 'CHRONOBREAK' | 'POWER'
    fountains, // array of {r, c}
    startProcessed: false
  };
}

function randomFountains(seed) {
  // Seed-stable RNG (mulberry32)
  let s = (typeof seed === 'number') ? seed : Math.floor(Math.random() * 2 ** 31);
  function rand() { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  // Candidate squares: ranks 3-6 (rows 2..5 in array), excluding center squares and starting-occupied squares.
  const candidates = [];
  for (let r = 2; r <= 5; r++) {
    for (let c = 0; c < 8; c++) {
      if (CENTER_SQUARES.some(sq => sq.r === r && sq.c === c)) continue;
      candidates.push({ r, c });
    }
  }
  // Shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  // Pick 4 with no two on same rank/file
  const picked = [];
  for (const sq of candidates) {
    if (picked.some(p => p.r === sq.r || p.c === sq.c)) continue;
    picked.push(sq);
    if (picked.length === 4) break;
  }
  return picked;
}

// ---------- Center & Fountain ----------
// v3.2: "more pieces in center than opponent" (strict majority).
function controlsCenter(state, color) {
  let mine = 0, theirs = 0;
  const opp = opposite(color);
  for (const sq of CENTER_SQUARES) {
    const p = state.board[sq.r][sq.c];
    if (!p || p.isSpectral) continue;
    if (p.color === color) mine++;
    else if (p.color === opp) theirs++;
  }
  return mine > theirs && mine > 0;
}

// v3.2: returns the NUMBER of pieces of `color` occupying fountains (stacks).
function occupiedFountains(state, color) {
  let n = 0;
  for (const f of state.fountains) {
    const p = state.board[f.r][f.c];
    if (p && p.color === color && !p.isSpectral) n++;
  }
  return n;
}

// ---------- Phase 1: Start of Turn ----------
// v3.4: Aether generation happens at the START of the player's turn (was end-of-turn).
// Phase 1 also handles: spectral cleanup, ghost decay, bomb ticks.
function startOfTurn(state) {
  if (state.winner) return;
  state.phase = 'START';
  const color = state.turn;

  // v3.5: try to seat any off-board prisoners (Imprison/Cleanse held them out
  // because their home tile was occupied) — both colours, every turn start.
  reseatPendingPrisoners(state);

  // Remove expired Spectral Pawns of this player
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.isSpectral && p.color === color && p.spectralExpireTurn <= state.turnNumber) {
        state.board[r][c] = null;
        state.log.push(`Spectral pawn at ${algebraic(r,c)} vanished.`);
      }
    }
  }

  // v3.2: Expire Fortify shields that have timed out (on the caster's next turn start)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.shieldHP > 0 && p.shieldExpiresOn && p.shieldExpiresOn <= state.turnNumber) {
        p.shieldHP = 0;
        p.shieldExpiresOn = 0;
        state.log.push(`Shield on ${p.type} at ${algebraic(r,c)} expired.`);
      }
    }
  }

  // Advance Ghost timer (1-turn ghost for owner)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.color === color && p.isPhased) {
        p.phaseTurnsLeft -= 1;
        if (p.phaseTurnsLeft <= 0) {
          p.isPhased = false;
          p.phaseTurnsLeft = 0;
        }
      }
    }
  }

  // Bomb ticks
  const detonations = [];
  for (const bomb of state.bombs) {
    bomb.turnsLeft -= 1;
    if (bomb.turnsLeft <= 0) detonations.push(bomb);
  }
  for (const bomb of detonations) {
    detonateBomb(state, bomb);
    if (state.winner) return;
  }
  state.bombs = state.bombs.filter(b => b.turnsLeft > 0);
  state.timeBombs = state.bombs;

  // v3.4: Aether disbursed at the START of this player's turn, except on probe states
  // (used by mate detection). startProcessed gates this so the bonus isn't re-applied
  // on hot reloads / re-renders.
  if (!state._probing && !state.startProcessed) {
    generateAetherForPlayer(state, color);
  }

  state.phase = 'ACTION';
  state.startProcessed = true;
}

// Generate Aether for a player. First turn is "skipped" so players don't start their
// very first turn already charged.
// v3.2: base gen scales by fullTurnsPlayed (1-10:+1, 11-20:+2, 21+:+3).
// v3.6: Bug fix #5 - Aether Block prevents aether GAIN on opponent's next turn
function generateAetherForPlayer(state, color) {
  state.fullTurnsPlayed[color] = (state.fullTurnsPlayed[color] || 0) + 1;
  if (!state.firstGenSkipped[color]) {
    state.firstGenSkipped[color] = true;
    return;
  }

  // Bug fix #5: If this player is aether-blocked, they don't gain aether this turn
  if (state.aetherBlocked[color]) {
    state.log.push(`${colorName(color)} gains no Aether this turn (blocked).`);
    return;
  }

  let gain = aetherBaseGenForTurn(state.fullTurnsPlayed[color]);
  if (controlsCenter(state, color)) gain += CENTER_BONUS;
  const fountainsOccupied = occupiedFountains(state, color);
  gain += fountainsOccupied * FOUNTAIN_BONUS;
  const before = state.mana[color];
  state.mana[color] = Math.min(AETHER_CAP, state.mana[color] + gain);
  const actual = state.mana[color] - before;
  // Skip the log line when the player gained nothing (e.g. capped at 30) so move
  // entries aren't drowned by no-op aether messages.
  if (actual <= 0) return;
  state.log.push(`${colorName(color)} +${actual} Aether (${state.mana[color]}/${AETHER_CAP})${fountainsOccupied ? ` [${fountainsOccupied}f]` : ''}`);
}

function colorName(c) { return c === COLOR.WHITE ? 'White' : 'Black'; }

// ---------- Power-aware mate detection (v3.3) ----------
// Deep-clones the state into a plain-data snapshot so we can probe casts without
// corrupting the live game. `_probing` tells endOfTurn to skip recursive mate checks
// (prevents infinite recursion when a cast triggers endOfTurn, which triggers
// isCheckmate, which calls back into this function).
function cloneStateForProbe(state) {
  const clone = JSON.parse(JSON.stringify({
    board: state.board,
    turn: state.turn,
    turnNumber: state.turnNumber,
    mana: state.mana,
    enPassantTarget: state.enPassantTarget,
    pendingEnPassant: state.pendingEnPassant,
    bombs: state.bombs,
    phase: state.phase,
    sacrificedThisTurn: state.sacrificedThisTurn,
    aetherBlocked: state.aetherBlocked,
    firstGenSkipped: state.firstGenSkipped,
    fullTurnsPlayed: state.fullTurnsPlayed,
    pendingPrisoners: state.pendingPrisoners || [],
    lastActionKind: state.lastActionKind,
    fountains: state.fountains,
    startProcessed: state.startProcessed
  }));
  clone.history = [];
  clone.log = [];
  clone.timeBombs = clone.bombs;
  clone.winner = null;
  clone.winReason = null;
  clone.lastMoveInfo = null;
  clone._probing = true;
  return clone;
}

// Returns true if `color` (currently in check with no regular legal move) could cast
// some affordable single power to escape. 1-ply search over the power space, run against
// a deep-cloned state so we never mutate the live game.
function canOpponentEscapeMateWithPowers(state, color) {
  if (state.aetherBlocked[color]) return false;
  const aether = state.mana[color];

  const tryOn = (castFn) => {
    const probe = cloneStateForProbe(state);
    probe.turn = color;
    const res = castFn(probe);
    if (!res || !res.success) return false;
    return !isInCheck(probe.board, color);
  };

  // Blink — move a blocker into the check line or move the King's attacker-protector.
  if (aether >= POWER_COSTS[POWER.BLINK]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== color || p.type === PIECE.KING) continue;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        if (tryOn(p2 => castBlink(p2, r, c, nr, nc))) return true;
      }
    }
  }

  // Vengeance — destroy the checker.
  if (aether >= POWER_COSTS[POWER.VENGEANCE]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color === color || p.type === PIECE.KING) continue;
      if (tryOn(p2 => castVengeance(p2, r, c))) return true;
    }
  }

  // Imprison — cage the adjacent checker.
  if (aether >= POWER_COSTS[POWER.IMPRISON]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const captor = state.board[r][c];
      if (!captor || captor.color !== color) continue;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const captive = state.board[nr][nc];
        if (!captive || captive.color === color || captive.type === PIECE.KING) continue;
        if (tryOn(p2 => castImprison(p2, r, c, nr, nc))) return true;
      }
    }
  }

  // Chronobreak — undo opponent's entire previous turn.
  if (aether >= POWER_COSTS[POWER.CHRONOBREAK] && state.history.length > 0) {
    // Clone pulls its own shallow copy of history, but we need the real snapshots
    // for chronobreak to work. Deep clone just the history too.
    const probe = cloneStateForProbe(state);
    probe.turn = color;
    probe.history = state.history.map(h => ({
      board: h.board.map(row => row.map(p => p ? { ...p, imprisoned: p.imprisoned ? { ...p.imprisoned } : null } : null)),
      mana: { ...h.mana },
      turn: h.turn,
      turnNumber: h.turnNumber,
      enPassantTarget: h.enPassantTarget ? { ...h.enPassantTarget } : null,
      bombs: (h.bombs || []).map(b => ({ ...b })),
      aetherBlocked: h.aetherBlocked ? { ...h.aetherBlocked } : { w: false, b: false },
      sacrificedThisTurn: h.sacrificedThisTurn ? { ...h.sacrificedThisTurn } : { w: false, b: false },
      pendingEnPassant: h.pendingEnPassant ? { ...h.pendingEnPassant } : null,
      lastActionKind: h.lastActionKind || null,
      fullTurnsPlayed: h.fullTurnsPlayed ? { ...h.fullTurnsPlayed } : { w: 0, b: 0 },
      firstGenSkipped: h.firstGenSkipped ? { ...h.firstGenSkipped } : { w: false, b: false }
    }));
    const res = castChronobreak(probe);
    if (res && res.success && !isInCheck(probe.board, color)) return true;
  }

  // Double Attack — capture the checker (and make a second legal move).
  if (aether >= POWER_COSTS[POWER.DOUBLE_ATTACK]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== color || p.type === PIECE.KING) continue;
      const firstMoves = legalMoves(state.board, r, c, state);
      for (const m1 of firstMoves) {
        // Simulate first step on a throwaway clone to enumerate second-move options.
        const look = cloneStateForProbe(state);
        const tgt = look.board[m1.r][m1.c];
        if (tgt && tgt.type === PIECE.KING) continue;
        const shieldBlock = !!(tgt && tgt.shieldHP > 0);
        if (!shieldBlock) {
          look.board[m1.r][m1.c] = look.board[r][c];
          look.board[r][c] = null;
          if (look.board[m1.r][m1.c]) look.board[m1.r][m1.c].hasMoved = true;
        }
        const curR = shieldBlock ? r : m1.r;
        const curC = shieldBlock ? c : m1.c;
        const secondMoves = legalMoves(look.board, curR, curC, look);
        for (const m2 of secondMoves) {
          if (m2.r === curR && m2.c === curC) continue;
          if (tryOn(p2 => castDoubleAttack(p2, r, c, m1.r, m1.c, m2.r, m2.c))) return true;
        }
      }
    }
  }

  // Spawn — place a spectral pawn on the check line.
  if (aether >= POWER_COSTS[POWER.SPAWN]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (state.board[r][c]) continue;
      if (tryOn(p2 => castSpawn(p2, r, c))) return true;
    }
  }

  // Wall — spawn pawns around an anchor that may block the check (try all directions)
  if (aether >= POWER_COSTS[POWER.WALL]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== color) continue;
      for (const dir of ['N', 'S', 'E', 'W']) {
        if (tryOn(p2 => castWall(p2, r, c, dir))) return true;
      }
    }
  }

  // Cleanse — freeing an imprisoned friendly returns it home and may block the check, or removing shield.
  if (aether >= POWER_COSTS[POWER.CLEANSE]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.type === PIECE.KING) continue;
      const hasFrost = !!(p.frozenUntil && p.frozenUntil > state.turnNumber);
      const hasShield = !!(p.shieldHP && p.shieldHP > 0);
      if (!hasFrost && !p.imprisoned && !hasShield) continue;
      if (tryOn(p2 => castCleanse(p2, r, c))) return true;
    }
  }

  return false;
}

// 1-ply power probe for stalemate. Spawn/Wall/Cleanse can introduce legal moves.
function canOpponentEscapeStalemateWithPowers(state, color) {
  if (state.aetherBlocked[color]) return false;
  const aether = state.mana[color];

  const tryOn = (castFn) => {
    const probe = cloneStateForProbe(state);
    probe.turn = color;
    const res = castFn(probe);
    if (!res || !res.success) return false;
    return allLegalMoves(probe.board, color, probe).length > 0;
  };

  if (aether >= POWER_COSTS[POWER.SPAWN]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (state.board[r][c]) continue;
      if (tryOn(p2 => castSpawn(p2, r, c))) return true;
    }
  }
  if (aether >= POWER_COSTS[POWER.WALL]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== color) continue;
      for (const dir of ['N', 'S', 'E', 'W']) {
        if (tryOn(p2 => castWall(p2, r, c, dir))) return true;
      }
    }
  }
  if (aether >= POWER_COSTS[POWER.CLEANSE]) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.type === PIECE.KING) continue;
      const hasFrost = !!(p.frozenUntil && p.frozenUntil > state.turnNumber);
      const hasShield = !!(p.shieldHP && p.shieldHP > 0);
      if (!hasFrost && !p.imprisoned && !hasShield) continue;
      if (tryOn(p2 => castCleanse(p2, r, c))) return true;
    }
  }
  return false;
}

// ---------- Imprison release ----------
// Sends the prisoner back to its OWN base tile (the canonical home tile for its
// piece type, on the prisoner's home rank). When a piece type has two start tiles
// (Knight: b/g, Bishop: c/f, Rook: a/h), pick the nearest of the two by file
// distance, optionally favouring the piece's recorded `originFile` if it matches
// one of the canonical files. This guarantees that a promoted Knight goes to a
// Knight's home (b1/g1), not the originating pawn's file.
// If the chosen tile is occupied, the prisoner is destroyed.
function homeFilesForType(type) {
  switch (type) {
    case PIECE.ROOK:   return [0, 7];
    case PIECE.KNIGHT: return [1, 6];
    case PIECE.BISHOP: return [2, 5];
    case PIECE.QUEEN:  return [3];
    case PIECE.KING:   return [4];
    default:           return null; // pawn / other — handled below
  }
}

// v3.5 home-tile resolution. Always returns the SAME tile the piece originally
// started on — for canonical types this is (homeRank, originFile). When a prisoner
// has no recorded originFile (legacy data), fall back to the nearest canonical
// start tile for the piece type.
function homeTileFor(prisoner, fromC) {
  let homeRank;
  if (prisoner.type === PIECE.PAWN) {
    homeRank = prisoner.color === COLOR.WHITE ? 6 : 1;
  } else {
    homeRank = prisoner.color === COLOR.WHITE ? 7 : 0;
  }
  let file;
  if (prisoner.type === PIECE.PAWN) {
    file = (prisoner.originFile != null) ? prisoner.originFile : 4;
  } else if (prisoner.originFile != null) {
    // Honour originFile literally — promoted pieces keep their pawn's file, regular
    // back-rank pieces return to their actual start (e.g. b8 knight → b8, not g8).
    file = prisoner.originFile;
  } else {
    const homes = homeFilesForType(prisoner.type) || [4];
    if (homes.length === 1) file = homes[0];
    else {
      const ref = (typeof fromC === 'number') ? fromC : 4;
      file = homes.reduce((best, f) => Math.abs(f - ref) < Math.abs(best - ref) ? f : best, homes[0]);
    }
  }
  return { r: homeRank, c: file };
}

function releasePrisonerToHome(state, prisoner, fromR, fromC) {
  if (!prisoner) return null;
  const home = homeTileFor(prisoner, fromC);
  // Reset transient state so the released piece behaves normally.
  prisoner.hasMoved = true;      // no double-push, no castle
  prisoner.imprisoned = null;
  prisoner.frozenUntil = 0;
  prisoner.shieldHP = 0;
  prisoner.shieldExpiresOn = 0;
  prisoner.isPhased = false;
  prisoner.phaseTurnsLeft = 0;
  if (state.board[home.r][home.c]) {
    // v3.5: home tile occupied — hold the prisoner OFF-BOARD until it frees up.
    // It re-enters automatically at the start of its owner's turn (see startOfTurn).
    state.pendingPrisoners = state.pendingPrisoners || [];
    state.pendingPrisoners.push(prisoner);
    state.log.push(`${colorName(prisoner.color)}'s ${pieceTypeShort(prisoner.type)} prisoner waiting off-board — home tile ${algebraic(home.r, home.c)} occupied.`);
    return { placed: false, pending: true, destroyed: false, r: home.r, c: home.c };
  }
  state.board[home.r][home.c] = prisoner;
  state.log.push(`${colorName(prisoner.color)}'s ${pieceTypeShort(prisoner.type)} prisoner released to ${algebraic(home.r, home.c)}.`);
  return { placed: true, pending: false, destroyed: false, r: home.r, c: home.c };
}

// At the start of every turn, try to seat any off-board prisoners whose home
// tile is now free. Owner-agnostic: we attempt every pending prisoner each turn
// so a black prisoner can re-enter when its home opens up, even on white's turn.
function reseatPendingPrisoners(state) {
  if (!state.pendingPrisoners || state.pendingPrisoners.length === 0) return;
  const remaining = [];
  for (const prisoner of state.pendingPrisoners) {
    const home = homeTileFor(prisoner, null);
    if (!state.board[home.r][home.c]) {
      state.board[home.r][home.c] = prisoner;
      state.log.push(`${colorName(prisoner.color)}'s ${pieceTypeShort(prisoner.type)} prisoner returned to ${algebraic(home.r, home.c)}.`);
    } else {
      remaining.push(prisoner);
    }
  }
  state.pendingPrisoners = remaining;
}

// Used only when originFile wasn't recorded (shouldn't normally happen post-v3.3).
function defaultStartFile(type) {
  switch (type) {
    case PIECE.ROOK: return 0;
    case PIECE.KNIGHT: return 1;
    case PIECE.BISHOP: return 2;
    case PIECE.QUEEN: return 3;
    case PIECE.KING: return 4;
    default: return 4; // pawn: pick a sensible middle file
  }
}

// ---------- Phase 3: End of Turn ----------
function endOfTurn(state) {
  if (state.winner) return;
  state.phase = 'END';

  // Frost: unfreeze pieces of current color if their frozen timer expired
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.frozenUntil && p.frozenUntil <= state.turnNumber + 1 && p.color === state.turn) {
        // Piece gets to skip this turn; unfreeze at end of owner's turn.
        p.frozenUntil = 0;
      }
    }
  }

  // Insufficient material: only Kings on the board → immediate draw.
  if (isKingsOnly(state.board, state)) {
    state.winner = 'DRAW';
    state.winReason = 'INSUFFICIENT_MATERIAL';
    state.log.push('Draw — only Kings remain (insufficient material).');
    return;
  }

  // Check win conditions for opponent (who is about to move).
  // _probing flag is set on cloned states used by canOpponentEscape* — skip the
  // power-aware mate probe there to avoid infinite recursion.
  const opp = opposite(state.turn);
  if (isCheckmate(state.board, opp, state)) {
    const escapable = !state._probing && canOpponentEscapeMateWithPowers(state, opp);
    if (!escapable) {
      state.winner = state.turn;
      state.winReason = 'CHECKMATE';
      state.log.push(`Checkmate! ${colorName(state.turn)} wins.`);
      return;
    }
    // Mate is NOT unavoidable — continue; opponent will have to cast a power on their turn.
    state.log.push(`${colorName(opp)} is in check — only a power can save them.`);
  } else if (isStalemate(state.board, opp, state)) {
    const escapable = !state._probing && canOpponentEscapeStalemateWithPowers(state, opp);
    if (!escapable) {
      state.winner = 'DRAW';
      state.winReason = 'STALEMATE';
      state.log.push(`Stalemate - draw.`);
      return;
    }
  }

  // Pass turn (v3.4: Aether is now generated at start-of-turn inside startOfTurn)
  state.turn = opp;
  state.turnNumber += 1;
  state.sacrificedThisTurn[opp] = false;
  state.enPassantTarget = state.pendingEnPassant || null;
  state.pendingEnPassant = null;
  state.startProcessed = false;

  startOfTurn(state);
}

// Called when a turn completes (at end-of-turn handoff) to clear one-turn effects
function clearPerTurnEffects(state, colorWhoseTurnEnded) {
  // Clear aetherBlocked for the player whose turn just ended (if it was active on them)
  if (state.aetherBlocked[colorWhoseTurnEnded]) {
    state.aetherBlocked[colorWhoseTurnEnded] = false;
    state.log.push(`${colorName(colorWhoseTurnEnded)}'s Aether Block lifted.`);
  }
}

// ---------- Move ----------
function makeMove(state, fromR, fromC, toR, toC, promotionType) {
  if (state.winner) return { error: 'Game over' };
  const piece = state.board[fromR][fromC];
  if (!piece) return { error: 'No piece at source' };
  if (piece.color !== state.turn) return { error: 'Not your piece' };
  if (piece.isSpectral) return { error: 'Spectral pieces cannot move' };
  if (piece.frozenUntil && piece.frozenUntil > state.turnNumber) return { error: 'Piece is frozen' };
  // NOTE (v3.3): captors CAN now move while holding a prisoner.

  const legal = legalMoves(state.board, fromR, fromC, state);
  const move = legal.find(m => m.r === toR && m.c === toC);
  if (!move) return { error: 'Illegal move' };

  pushHistory(state);

  const target = state.board[toR][toC];
  let capturedPiece = null;
  let shieldBroke = false;

  // En passant: check shield on the ACTUAL pawn being captured (not the empty target square)
  if (move.enPassant) {
    const capturedPawnRow = piece.color === COLOR.WHITE ? toR + 1 : toR - 1;
    const epTarget = state.board[capturedPawnRow][toC];
    if (epTarget && epTarget.shieldHP > 0) {
      epTarget.shieldHP -= 1;
      shieldBroke = true;
      state.log.push(`${colorName(piece.color)} ${pieceTypeShort(piece.type)} ${algebraic(fromR,fromC)}×${algebraic(toR,toC)} (en passant) blocked by shield on ${pieceTypeShort(epTarget.type)} (${epTarget.shieldHP} HP left).`);
      piece.hasMoved = true;
      state.lastMoveInfo = { type: 'SHIELD_BLOCK', from:{r:fromR,c:fromC}, to:{r:toR,c:toC} };
      state.lastActionKind = 'MOVE';
      clearPerTurnEffects(state, state.turn);
      endOfTurn(state);
      return { success: true, shieldBroke: true, remainingHP: epTarget.shieldHP };
    }
  }

  // Fortify: 2-HP shield absorbs capture — attacker does NOT move.
  if (target && move.capture && target.shieldHP > 0) {
    target.shieldHP -= 1;
    shieldBroke = true;
    state.log.push(`${colorName(piece.color)} ${pieceTypeShort(piece.type)} ${algebraic(fromR,fromC)}×${algebraic(toR,toC)} blocked by shield on ${pieceTypeShort(target.type)} (${target.shieldHP} HP left).`);
    piece.hasMoved = true;
    state.lastMoveInfo = { type: 'SHIELD_BLOCK', from:{r:fromR,c:fromC}, to:{r:toR,c:toC} };
    state.lastActionKind = 'MOVE';
    clearPerTurnEffects(state, state.turn);
    endOfTurn(state);
    return { success: true, shieldBroke: true, remainingHP: target.shieldHP };
  }

  // Capture: if target was a captor holding an imprisoned piece → release captive.
  let releasedCaptive = null;
  if (target && move.capture && target.imprisoned) {
    releasedCaptive = target.imprisoned;
  }

  if (target && move.capture) capturedPiece = target;

  // En passant
  if (move.enPassant) {
    const capturedPawnRow = piece.color === COLOR.WHITE ? toR + 1 : toR - 1;
    capturedPiece = state.board[capturedPawnRow][toC];
    state.board[capturedPawnRow][toC] = null;
  }

  // Castling — reject if the castling Rook is frozen
  if (move.castle) {
    const rookFromC = move.castle === 'K' ? 7 : 0;
    const rook = state.board[fromR][rookFromC];
    if (rook && rook.frozenUntil && rook.frozenUntil > state.turnNumber) {
      popHistory(state);
      return { error: 'Castling blocked: Rook is frozen' };
    }
    const rookToC = move.castle === 'K' ? 5 : 3;
    state.board[fromR][rookFromC] = null;
    state.board[fromR][rookToC] = rook;
    if (rook) rook.hasMoved = true;
  }

  // Execute move
  state.board[toR][toC] = piece;
  state.board[fromR][fromC] = null;
  piece.hasMoved = true;

  // v3.3: when a captor dies by capture, the prisoner returns to its OWN base tile.
  // Pass the captor's square so the nearest-home tie-break picks the closest home file.
  if (releasedCaptive) releasePrisonerToHome(state, releasedCaptive, toR, toC);

  if (move.doublePush) {
    const epRow = (fromR + toR) / 2;
    state.pendingEnPassant = { r: epRow, c: toC };
  }

  // Promotion (normal, via pawn move to last rank)
  let promotedTo = null;
  if (piece.type === PIECE.PAWN && (toR === 0 || toR === 7)) {
    piece.type = promotionType || PIECE.QUEEN;
    promotedTo = piece.type;
  }

  // Defuse bomb if landed on one
  const defused = defuseBombAt(state, toR, toC);

  // Log entry for the move so active-game and replay logs show every step.
  // Format: "White P e2→e4" or "Black N g8×f6 (captured P)" or "White K e1 O-O".
  const movedName = pieceTypeShort(piece.type);
  const sep = capturedPiece ? '×' : '→';
  let line;
  if (move.castle) {
    line = `${colorName(piece.color)} ${movedName} ${move.castle === 'K' ? 'O-O' : 'O-O-O'}`;
  } else {
    line = `${colorName(piece.color)} ${movedName} ${algebraic(fromR, fromC)}${sep}${algebraic(toR, toC)}`;
    if (capturedPiece) line += ` (took ${pieceTypeShort(capturedPiece.type)})`;
    if (promotedTo) line += ` =${promotedTo}`;
    if (defused) line += ` [defused 💣]`;
  }
  state.log.push(line);

  state.lastMoveInfo = { type:'MOVE', from:{r:fromR,c:fromC}, to:{r:toR,c:toC}, captured:capturedPiece, defused };
  state.lastActionKind = 'MOVE';

  // Check if move put opponent in check (including discovered check)
  const opp = opposite(state.turn);
  if (isInCheck(state.board, opp)) {
    state.log.push(`${colorName(opp)} is in check.`);
  }

  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, captured: capturedPiece, defused };
}

// Short, readable piece label for log entries.
function pieceTypeShort(t) {
  return ({ K:'King', Q:'Queen', R:'Rook', B:'Bishop', N:'Knight', P:'Pawn' })[t] || t;
}

// ---------- Sacrifice ----------
// v3.6: Bug fix #3 - If sacrifice causes discovery check on opponent, turn passes immediately
function sacrificePiece(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  if (state.aetherBlocked[color]) return { error: 'Aether Block prevents sacrifice this turn' };
  if (state.sacrificedThisTurn[color]) return { error: 'Already sacrificed this turn (max 1)' };
  const piece = state.board[r][c];
  if (!piece) return { error: 'No piece' };
  if (piece.color !== color) return { error: 'Not your piece' };
  if (piece.type === PIECE.KING) return { error: 'Cannot sacrifice King' };
  if (piece.isSpectral) return { error: 'Cannot sacrifice Spectral pieces' };

  const snap = snapshot(state.board);
  state.board[r][c] = null;
  if (isInCheck(state.board, color)) {
    restore(state.board, snap);
    return { error: 'Sacrifice would leave King in check' };
  }

  pushHistory(state);
  state.board[r][c] = null;
  const gain = SACRIFICE_VALUES[piece.type];
  const before = state.mana[color];
  state.mana[color] = Math.min(AETHER_CAP, state.mana[color] + gain);
  state.sacrificedThisTurn[color] = true;
  state.log.push(`${colorName(color)} sacrificed ${pieceTypeShort(piece.type)} at ${algebraic(r,c)}: +${state.mana[color] - before} Aether.`);
  // v3.3: if the sacrificed piece was a captor, the prisoner dies too.
  if (piece.imprisoned) {
    state.log.push(`${piece.imprisoned.color === COLOR.WHITE ? 'White' : 'Black'}'s imprisoned ${piece.imprisoned.type} perished with its captor.`);
  }

  // Bug fix #3: Check if sacrifice caused discovery check on opponent
  const opp = opposite(color);
  if (isInCheck(state.board, opp)) {
    state.log.push(`${colorName(opp)} is in check.`);
    state.lastActionKind = 'MOVE'; // Treat as move-like action
    clearPerTurnEffects(state, state.turn);
    endOfTurn(state);
    return { success: true, gain, passedTurn: true };
  }

  return { success: true, gain };
}

// ---------- Utility for power casting ----------
function canAfford(state, color, powerKey) {
  if (state.aetherBlocked[color]) return false;
  return state.mana[color] >= POWER_COSTS[powerKey];
}

function spendAether(state, color, cost) {
  state.mana[color] = Math.max(0, state.mana[color] - cost);
}

function requireAether(state, color, powerKey) {
  if (state.aetherBlocked[color]) return 'Aether Block active — cannot spend Aether this turn';
  if (state.mana[color] < POWER_COSTS[powerKey]) return 'Not enough Aether';
  return null;
}

// ---------- POWERS ----------

// v3.5: shared post-cast resolver for "continues turn" powers. If the cast leaves
// the caster's own King in check, roll back. If the cast puts the OPPONENT in
// check (e.g. discovered check from Imprison), control passes to the opponent
// IMMEDIATELY — the caster cannot keep playing and stack another action that
// could lead to checkmate from a discovered check.
function resolveContinuesTurnCast(state, color, opts = {}) {
  if (isInCheck(state.board, color)) return { rollback: true, error: opts.selfCheckMsg || 'Cast would leave your King in check' };
  const opp = opposite(color);
  if (isInCheck(state.board, opp)) {
    state.log.push(`${colorName(opp)} is in check.`);
    state.lastActionKind = 'POWER';
    clearPerTurnEffects(state, state.turn);
    endOfTurn(state);
    return { passedTurn: true };
  }
  return {};
}

// FROST
function castFrost(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.FROST); if (err) return { error: err };
  const target = state.board[r][c];
  if (!target) return { error: 'No target' };
  if (target.color === color) return { error: 'Cannot freeze own pieces' };
  if (target.type === PIECE.KING) return { error: 'Cannot freeze King' };
  if (target.isSpectral) return { error: 'Cannot freeze Spectral' };
  if (target.imprisoned) return { error: 'Cannot freeze imprisoned captor' };
  if (target.frozenUntil && target.frozenUntil > state.turnNumber) return { error: 'Already frozen' };
  // v3.5: if you're in check, you must address the check first. Frost doesn't move
  // pieces — it cannot resolve check.
  if (isInCheck(state.board, color)) return { error: 'You are in check — must move out of check or cast a power that resolves it.' };

  pushHistory(state);
  // Freeze until end of target's next turn. Turn numbers increment by 1 each half-move.
  // Target's next turn is state.turnNumber + 1 (their turn). They skip that. Unfreeze at turnNumber + 2.
  target.frozenUntil = state.turnNumber + 2;
  spendAether(state, color, POWER_COSTS[POWER.FROST]);
  state.log.push(`${colorName(color)} ❄ Frost: ${pieceTypeShort(target.type)} at ${algebraic(r,c)} frozen 1 turn.`);
  // Frost cannot give check by itself, but for symmetry route through resolver.
  const post = resolveContinuesTurnCast(state, color);
  if (post.rollback) { popHistory(state); return { error: post.error }; }
  return { success: true };
}

// FORTIFY — shield absorbs 1 attack (attacker doesn't move), then piece is vulnerable.
// "Killed twice": 1st attack kills the shield, 2nd attack captures the piece.
function castFortify(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.FORTIFY); if (err) return { error: err };
  const p = state.board[r][c];
  if (!p) return { error: 'No piece' };
  if (p.color !== color) return { error: 'Can only Fortify own pieces' };
  if (p.type === PIECE.KING) return { error: 'Powers cannot target the King' };
  if (p.isSpectral) return { error: 'Cannot Fortify Spectral pieces' };
  if (p.imprisoned) return { error: 'Cannot Fortify captor' };
  if (p.shieldHP > 0) return { error: 'Already shielded' };
  // v3.5: in check → must resolve check; Fortify can't move pieces.
  if (isInCheck(state.board, color)) return { error: 'You are in check — must move out of check or cast a power that resolves it.' };

  pushHistory(state);
  p.shieldHP = 1;
  // v3.2: shield expires at end of caster's NEXT turn if unused.
  p.shieldExpiresOn = state.turnNumber + 2;
  spendAether(state, color, POWER_COSTS[POWER.FORTIFY]);
  state.log.push(`${colorName(color)} 🛡 Fortify: ${pieceTypeShort(p.type)} at ${algebraic(r,c)} shielded.`);
  const post = resolveContinuesTurnCast(state, color);
  if (post.rollback) { popHistory(state); return { error: post.error }; }
  return { success: true };
}

// BLINK (turn ends, cannot mate). v3.2: must land in 3x3 grid around source (8 neighbors).
function castBlink(state, fromR, fromC, toR, toC) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.BLINK); if (err) return { error: err };
  const p = state.board[fromR][fromC];
  if (!p) return { error: 'No source' };
  if (p.color !== color) return { error: 'Not your piece' };
  if (p.type === PIECE.KING) return { error: 'Cannot Blink a King' };
  if (p.isSpectral || p.imprisoned || (p.frozenUntil && p.frozenUntil > state.turnNumber)) {
    return { error: 'Piece cannot be Blinked' };
  }
  // v3.4 Blink range: a fixed 3×3 area. When the source is in the middle of the
  // board the source sits at the centre; when the source is on an edge or corner
  // the 3×3 is SHIFTED so the source is on the edge/corner of the area (so a piece
  // in a corner can still reach 8 destinations). Compute the shifted top-left so
  // the source stays inside the 3×3 box, then validate the destination is in box.
  const top  = Math.max(0, Math.min(fromR - 1, 5));
  const left = Math.max(0, Math.min(fromC - 1, 5));
  const inBox = (toR >= top && toR < top + 3 && toC >= left && toC < left + 3);
  if (!inBox || (toR === fromR && toC === fromC)) {
    return { error: 'Blink range is a 3×3 grid around the piece' };
  }
  if (state.board[toR][toC]) return { error: 'Destination not empty' };

  // Simulate
  const snap = snapshot(state.board);
  state.board[toR][toC] = p;
  state.board[fromR][fromC] = null;
  if (isInCheck(state.board, color)) {
    restore(state.board, snap);
    return { error: 'Cannot Blink into check' };
  }
  // Check if this would deliver checkmate — NOT allowed.
  const oppInMate = isCheckmate(state.board, opposite(color), state);
  restore(state.board, snap);
  if (oppInMate) return { error: 'Blink cannot deliver checkmate' };

  pushHistory(state);
  state.board[toR][toC] = p;
  state.board[fromR][fromC] = null;
  p.hasMoved = true;
  defuseBombAt(state, toR, toC);
  spendAether(state, color, POWER_COSTS[POWER.BLINK]);
  state.log.push(`${colorName(color)} ✦ Blink: ${pieceTypeShort(p.type)} ${algebraic(fromR,fromC)}→${algebraic(toR,toC)}.`);
  state.lastActionKind = 'POWER';
  state.lastMoveInfo = { type: 'BLINK', from: {r:fromR,c:fromC}, to: {r:toR,c:toC} };

  // Bug fix: Check if Blink caused discovery check on opponent
  // (moving the piece can expose checks from pieces behind it)
  const opp = opposite(color);
  if (isInCheck(state.board, opp)) {
    state.log.push(`${colorName(opp)} is in check.`);
    clearPerTurnEffects(state, state.turn);
    endOfTurn(state);
    return { success: true, passedTurn: true };
  }

  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true };
}

// SPAWN (Spectral Pawn; lasts until caster's next turn start)
function castSpawn(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.SPAWN); if (err) return { error: err };
  if (state.board[r][c]) return { error: 'Square not empty' };
  // Must be in caster's half
  const rankFromPerspective = color === COLOR.WHITE ? (8 - r) : (r + 1);
  if (rankFromPerspective < 1 || rankFromPerspective > 4) return { error: 'Must spawn in your half (ranks 1–4)' };

  pushHistory(state);
  // Bug fix #4: Spectral pawn lasts only current turn, expires at start of caster's next turn
  const pawn = makePiece(PIECE.PAWN, color, {
    isSpectral: true,
    spectralExpireTurn: state.turnNumber + 1,
    originFile: c
  });
  pawn.hasMoved = true;
  state.board[r][c] = pawn;

  spendAether(state, color, POWER_COSTS[POWER.SPAWN]);
  state.log.push(`${colorName(color)} ♙ Spawn: Spectral Pawn at ${algebraic(r,c)}.`);
  // v3.5: shared post-cast resolver. If Spawn left us in check, roll back. If it
  // delivers check (a Spectral pawn can attack the enemy King), pass turn.
  const post = resolveContinuesTurnCast(state, color, { selfCheckMsg: 'Spawn would leave King in check' });
  if (post.rollback) { popHistory(state); return { error: post.error }; }
  return { success: true };
}

// BOMBA — v3.5: pawn-only power.
// Placement must be IN FRONT of one of your (non-spectral) pawns: directly
// forward, or diagonally forward (the 3 squares the pawn could attack/advance to).
function castBomba(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.BOMBA); if (err) return { error: err };
  if (state.board[r][c]) return { error: 'Bomba must be planted on an empty square' };
  if (state.bombs.some(b => b.r === r && b.c === c)) return { error: 'Already a bomb here' };

  if (!validBombaTarget(state, color, r, c)) {
    return { error: 'Bomba must land in front of one of your pawns (forward, or diagonally forward).' };
  }
  // v3.5: caster cannot be in check; planting a bomb doesn't move pieces and so
  // can't resolve check.
  if (isInCheck(state.board, color)) return { error: 'You are in check — must move out of check or cast a power that resolves it.' };

  pushHistory(state);
  state.bombs.push({ r, c, owner: color, turnsLeft: 2, revealed: true });
  state.timeBombs = state.bombs;
  spendAether(state, color, POWER_COSTS[POWER.BOMBA]);
  state.log.push(`${colorName(color)} 💣 Bomba planted at ${algebraic(r,c)}. Detonates next turn.`);
  // Bomba doesn't change position; can't give check. Still route through resolver
  // for symmetry — no-op.
  return { success: true };
}

// v3.5: (r, c) is a valid Bomba placement for `color` if some friendly,
// non-spectral pawn sits ONE rank behind it on the same file (forward) or on
// either diagonal-back file (diagonal-forward).
function validBombaTarget(state, color, r, c) {
  // For white pawns dir = -1 (move up the array). The pawn that would "reach"
  // (r, c) sits at (r - dir, c-1 / c / c+1) = (r + 1, ...) for white; (r - 1, ...) for black.
  const dir = color === COLOR.WHITE ? -1 : 1;
  const pawnRow = r - dir;
  if (!inBounds(pawnRow, 0)) return false;
  for (const dc of [-1, 0, 1]) {
    const pc = c + dc;
    if (!inBounds(pawnRow, pc)) continue;
    const p = state.board[pawnRow][pc];
    if (p && p.type === PIECE.PAWN && p.color === color && !p.isSpectral) return true;
  }
  return false;
}

// CHAIN LIGHTNING
function castDoubleAttack(state, fromR, fromC, toR, toC, jumpR, jumpC) {
  // v3.3 Double Attack: the same piece makes TWO legal moves in one turn.
  // Signature kept from Chain Lightning for wire compatibility:
  //   fromR,fromC  — attacker square
  //   toR,toC      — first destination (must be a legal move from source)
  //   jumpR,jumpC  — second destination (must be a legal move from the first landing)
  // Captures are allowed on either step. Cannot target or capture the King.
  // Cannot deliver checkmate, cannot leave own King in check at any intermediate step.
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.DOUBLE_ATTACK); if (err) return { error: err };
  const attacker = state.board[fromR][fromC];
  if (!attacker) return { error: 'No attacker' };
  if (attacker.color !== color) return { error: 'Not your piece' };
  if (attacker.type === PIECE.KING) return { error: 'Double Attack cannot target the King' };
  // Bug fix #2: Captors CAN use Double Attack (removed attacker.imprisoned check)
  // Only block if piece is Spectral or Frozen
  if (attacker.isSpectral || (attacker.frozenUntil && attacker.frozenUntil > state.turnNumber)) {
    return { error: 'Piece cannot cast Double Attack' };
  }

  const firstLegal = legalMoves(state.board, fromR, fromC, state);
  const firstMove = firstLegal.find(m => m.r === toR && m.c === toC);
  if (!firstMove) return { error: 'First move must be legal for this piece' };

  // First move of Double Attack MUST be a capture.
  if (!firstMove.capture) return { error: 'First move of Double Attack must capture an enemy piece' };

  // Reject if either destination would land on a King.
  const firstTarget = state.board[toR][toC];
  if (firstTarget && firstTarget.type === PIECE.KING) return { error: 'Cannot attack the King' };

  pushHistory(state);

  // Step 1 — apply the first move in full (respect shields, imprison-release, etc.)
  // We re-use makeMove's rules by simulating locally.
  const firstCaptor = (firstTarget && firstMove.capture) ? firstTarget : null;
  let firstShieldBlock = false;
  if (firstCaptor && firstCaptor.shieldHP > 0) {
    firstCaptor.shieldHP -= 1;
    firstShieldBlock = true;
    // Attacker did NOT move; turn still continues via second move.
  } else {
    // Release prisoner if the captured piece was a captor
    if (firstCaptor && firstCaptor.imprisoned) releasePrisonerToHome(state, firstCaptor.imprisoned, toR, toC);
    state.board[toR][toC] = attacker;
    state.board[fromR][fromC] = null;
    attacker.hasMoved = true;
  }

  // If first step left our own king in check, abort.
  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'First move would leave your King in check' };
  }

  // Step 2 — from attacker's current square. If the first step was shield-blocked,
  // the attacker is still on fromR,fromC; else on toR,toC.
  const curR = firstShieldBlock ? fromR : toR;
  const curC = firstShieldBlock ? fromC : toC;
  // Bug fix #6: Allow second attack on same square if first hit broke shield (can finish the kill)
  // Otherwise require distinct moves
  const sameSquareAsFirst = (jumpR === toR && jumpC === toC);
  if (sameSquareAsFirst && !firstShieldBlock) {
    // Same square but no shield break = invalid (already moved there or captured it)
    popHistory(state);
    return { error: 'Second move must target a different square (unless breaking shield on same piece)' };
  }
  if (jumpR === curR && jumpC === curC) {
    popHistory(state);
    return { error: 'Second move must differ from current position' };
  }

  const secondTarget = state.board[jumpR][jumpC];
  if (secondTarget && secondTarget.type === PIECE.KING) {
    popHistory(state);
    return { error: 'Cannot attack the King' };
  }

  const secondLegal = legalMoves(state.board, curR, curC, state);
  const secondMove = secondLegal.find(m => m.r === jumpR && m.c === jumpC);
  if (!secondMove) {
    popHistory(state);
    return { error: 'Second move must be legal for this piece' };
  }

  const secondCaptor = (secondTarget && secondMove.capture) ? secondTarget : null;
  let secondShieldBlock = false;
  if (secondCaptor && secondCaptor.shieldHP > 0) {
    secondCaptor.shieldHP -= 1;
    secondShieldBlock = true;
  } else {
    if (secondCaptor && secondCaptor.imprisoned) releasePrisonerToHome(state, secondCaptor.imprisoned, jumpR, jumpC);
    state.board[jumpR][jumpC] = attacker;
    state.board[curR][curC] = null;
    attacker.hasMoved = true;
  }

  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Double Attack would leave your King in check' };
  }
  if (isCheckmate(state.board, opposite(color), state)) {
    popHistory(state);
    return { error: 'Double Attack cannot deliver checkmate' };
  }

  spendAether(state, color, POWER_COSTS[POWER.DOUBLE_ATTACK]);
  state.log.push(`${colorName(color)} ⚔ Double Attack: ${pieceTypeShort(attacker.type)} ${algebraic(fromR,fromC)}→${algebraic(toR,toC)}→${algebraic(jumpR,jumpC)}.`);
  state.lastMoveInfo = { type:'DOUBLE_ATTACK', from:{r:fromR,c:fromC}, to:{r:toR,c:toC}, jump:{r:jumpR,c:jumpC} };
  state.lastActionKind = 'POWER';

  // Bug fix: Check if Double Attack caused discovery check on opponent
  // (moving the piece can expose checks from pieces behind it)
  const opp = opposite(color);
  if (isInCheck(state.board, opp)) {
    state.log.push(`${colorName(opp)} is in check.`);
    clearPerTurnEffects(state, state.turn);
    endOfTurn(state);
    return { success: true, firstShieldBlock, secondShieldBlock, passedTurn: true };
  }

  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, firstShieldBlock, secondShieldBlock };
}

// IMPRISON
function castImprison(state, captorR, captorC, captiveR, captiveC) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.IMPRISON); if (err) return { error: err };
  const captor = state.board[captorR][captorC];
  if (!captor) return { error: 'No captor' };
  if (captor.color !== color) return { error: 'Captor must be your piece' };
  if (captor.type === PIECE.KING) return { error: 'King cannot use powers' };
  if (captor.imprisoned) return { error: 'Captor already holds a captive' };
  if (captor.isSpectral) return { error: 'Spectral cannot imprison' };
  if (captor.frozenUntil && captor.frozenUntil > state.turnNumber) return { error: 'Frozen piece cannot imprison' };

  const dr = Math.abs(captiveR - captorR), dc = Math.abs(captiveC - captorC);
  if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) return { error: 'Captive must be adjacent' };
  const captive = state.board[captiveR][captiveC];
  if (!captive) return { error: 'No captive' };
  if (captive.color === color) return { error: 'Cannot imprison own piece' };
  if (captive.type === PIECE.KING) return { error: 'Cannot imprison King' };
  if (captive.isSpectral) return { error: 'Cannot imprison Spectral' };
  if (captive.frozenUntil && captive.frozenUntil > state.turnNumber) return { error: 'Frost blocks Imprison' };
  if (captive.imprisoned) return { error: 'No nested cages' };

  // Shield blocks Imprison: consume shield, spend aether, but do NOT imprison.
  if (captive.shieldHP > 0) {
    pushHistory(state);
    captive.shieldHP -= 1;
    spendAether(state, color, POWER_COSTS[POWER.IMPRISON]);
    state.log.push(`${colorName(color)} ⛓ Imprison blocked by shield on ${pieceTypeShort(captive.type)} at ${algebraic(captiveR,captiveC)}.`);
    return { success: true, shieldAbsorbed: true };
  }

  pushHistory(state);
  // Preserve the captive's *own* origin file so Cleanse / captor-death sends the
  // prisoner back to its OWN starting tile (e.g. a Knight to b8, not the imprisoner's
  // home). Pieces from createInitialBoard carry originFile; if missing, fall back to
  // the piece-type default (the canonical starting file for that role). We don't use
  // captiveC here — that's where the piece happened to be when imprisoned, NOT its
  // start tile, and using it would land prisoners on wrong squares.
  const originFile = (captive.originFile != null)
    ? captive.originFile
    : defaultStartFile(captive.type);
  const caged = { ...captive, originFile };
  captor.imprisoned = caged;
  state.board[captiveR][captiveC] = null;

  spendAether(state, color, POWER_COSTS[POWER.IMPRISON]);
  state.log.push(`${colorName(color)} ⛓ Imprison: ${pieceTypeShort(captor.type)} at ${algebraic(captorR,captorC)} caged ${pieceTypeShort(captive.type)} from ${algebraic(captiveR,captiveC)}.`);
  // v3.5: removing the captive can EXPOSE a discovered check on the enemy King.
  // If that happens, control passes to the opponent IMMEDIATELY — caster cannot
  // continue and stack another action that would amount to checkmate from a
  // discovered check (mate from discovered check is fine — the engine will detect
  // it in endOfTurn). If the cast leaves OUR own King in check, roll back.
  const post = resolveContinuesTurnCast(state, color, { selfCheckMsg: 'Imprison would leave your King in check' });
  if (post.rollback) { popHistory(state); return { error: post.error }; }
  return { success: true, passedTurn: !!post.passedTurn };
}

// AETHER BLOCK
function castAetherBlock(state) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.AETHER_BLOCK); if (err) return { error: err };
  const opp = opposite(color);
  if (state.aetherBlocked[opp]) return { error: 'Opponent already blocked' };
  // v3.5: doesn't move pieces, so cannot resolve check.
  if (isInCheck(state.board, color)) return { error: 'You are in check — must move out of check or cast a power that resolves it.' };

  pushHistory(state);
  state.aetherBlocked[opp] = true;
  spendAether(state, color, POWER_COSTS[POWER.AETHER_BLOCK]);
  state.log.push(`${colorName(color)} ⊘ Aether Block: ${colorName(opp)} silenced next turn.`);
  return { success: true };
}

// CLEANSE — remove Imprison and/or Frost and/or Shield from any piece (own or enemy).
// If the target is a captor, its prisoner is released to its home tile (or destroyed if occupied).
// If the target has a shield, the shield is removed.
// Does not target the King (kings can't be frozen or imprisoned anyway, but explicit for clarity).
// Turn continues.
function castCleanse(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.CLEANSE); if (err) return { error: err };
  const target = state.board[r][c];
  if (!target) return { error: 'No target' };
  if (target.type === PIECE.KING) return { error: 'Cannot target the King' };
  const wasFrozen = !!(target.frozenUntil && target.frozenUntil > state.turnNumber);
  const wasCaptor = !!target.imprisoned;
  const hadShield = !!(target.shieldHP && target.shieldHP > 0);
  if (!wasFrozen && !wasCaptor && !hadShield) return { error: 'Nothing to cleanse on this piece' };

  pushHistory(state);
  let releasedInfo = null;
  if (wasCaptor) {
    releasedInfo = releasePrisonerToHome(state, target.imprisoned, r, c);
    target.imprisoned = null;
  }
  if (wasFrozen) {
    target.frozenUntil = 0;
  }
  if (hadShield) {
    target.shieldHP = 0;
    target.shieldExpiresOn = 0;
  }

  spendAether(state, color, POWER_COSTS[POWER.CLEANSE]);
  const parts = [];
  if (wasCaptor) parts.push('freed prisoner');
  if (wasFrozen) parts.push('thawed frost');
  if (hadShield) parts.push('removed shield');
  state.log.push(`${colorName(color)} ✨ Cleanse on ${pieceTypeShort(target.type)} at ${algebraic(r,c)}: ${parts.join(' + ')}.`);
  // v3.5: rollback on self-check; pass-turn if we put opponent in check.
  const post = resolveContinuesTurnCast(state, color, { selfCheckMsg: 'Cleanse would leave your King in check' });
  if (post.rollback) { popHistory(state); return { error: post.error }; }
  state.lastActionKind = 'POWER';
  return { success: true, released: releasedInfo, thawed: wasFrozen, shieldRemoved: hadShield, passedTurn: !!post.passedTurn };
}

// PROMOTE
function castPromote(state, r, c, newType) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.PROMOTE); if (err) return { error: err };
  const p = state.board[r][c];
  if (!p) return { error: 'No piece' };
  if (p.color !== color) return { error: 'Not your piece' };
  if (p.type !== PIECE.PAWN) return { error: 'Only pawns can be promoted' };
  if (p.isSpectral) return { error: 'Cannot promote Spectral pawn' };
  const validTypes = [PIECE.QUEEN, PIECE.ROOK, PIECE.BISHOP, PIECE.KNIGHT];
  if (!validTypes.includes(newType)) return { error: 'Invalid promotion type' };

  pushHistory(state);
  p.type = newType;
  // v3.5: rollback if Promote leaves us in check (it shouldn't, but be airtight).
  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Promote would leave your King in check' };
  }
  spendAether(state, color, POWER_COSTS[POWER.PROMOTE]);
  state.log.push(`${colorName(color)} ♛ Promote: Pawn ${algebraic(r,c)} → ${pieceTypeShort(newType)}.`);

  // Check if this causes mate
  const opp = opposite(color);
  if (isCheckmate(state.board, opp, state)) {
    state.winner = color;
    state.winReason = 'CHECKMATE';
    state.log.push(`Checkmate by Promote!`);
    return { success: true, mate: true };
  }

  // Bug fix: Check if Promote caused check on opponent (turn should pass)
  if (isInCheck(state.board, opp)) {
    state.log.push(`${colorName(opp)} is in check.`);
    state.lastActionKind = 'POWER';
    state.lastMoveInfo = { type: 'PROMOTE', to: {r,c} };
    clearPerTurnEffects(state, state.turn);
    endOfTurn(state);
    return { success: true, passedTurn: true };
  }

  state.lastActionKind = 'POWER';
  state.lastMoveInfo = { type: 'PROMOTE', to: {r,c} };
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true };
}

// CHRONOBREAK — undo opponent's ENTIRE previous turn. Reverses every action they
// took (moves, captures, AND every power cast: Frost, Fortify, Blink, Spawn,
// Bomba, Double Attack, Imprison, Aether Block, Cleanse, Promote, Vengeance,
// Wall) — restoring board, prisoners, shields, freezes, bombs, blocks, and
// per-turn flags. The opponent's spent Aether is NOT refunded. Caster keeps its
// own current mana minus the chronobreak cost. CANNOT undo a checkmate (game over).
function castChronobreak(state) {
  if (state.winner) return { error: 'Cannot Chronobreak: the game is already over (checkmate cannot be reversed).' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.CHRONOBREAK); if (err) return { error: err };
  if (state.history.length === 0) return { error: 'Nothing to rewind' };
  if (state.lastActionKind === 'CHRONOBREAK') return { error: 'Cannot Chronobreak a Chronobreak' };

  const opp = opposite(color);
  // Pop consecutive snapshots taken during opp's most recent turn. The earliest
  // popped snapshot captures the position at the start of opp's turn — that's our
  // restore target.
  let target = null;
  while (state.history.length > 0 && state.history[state.history.length - 1].turn === opp) {
    target = state.history.pop();
  }
  if (!target) return { error: 'Nothing from opponent to rewind' };

  // Board: restore to the position at the start of opp's turn. Because each power
  // pushHistory()s before mutating, the snapshot at the start of opp's turn is
  // guaranteed to capture the board, prisoners, shields, freezes, bombs, etc. as
  // they were before opp acted — so this single restore reverses ALL their moves
  // AND ALL their power casts (Frost, Fortify, Blink, Spawn, Bomba, Double Attack,
  // Imprison, Aether Block, Cleanse, Promote, Vengeance, Wall) in one shot.
  restore(state.board, target.board);

  // Per-turn / power-modified state: restore everything we snapshot in pushHistory.
  state.enPassantTarget = target.enPassantTarget ? { ...target.enPassantTarget } : null;
  state.pendingEnPassant = target.pendingEnPassant ? { ...target.pendingEnPassant } : null;
  state.bombs = (target.bombs || []).map(b => ({ ...b }));
  state.timeBombs = state.bombs;
  if (target.aetherBlocked) state.aetherBlocked = { ...target.aetherBlocked };
  if (target.sacrificedThisTurn) state.sacrificedThisTurn = { ...target.sacrificedThisTurn };
  if (target.pendingPrisoners) state.pendingPrisoners = target.pendingPrisoners.map(p => ({ ...p }));

  // Mana: opp keeps their current (post-spend) mana — Chronobreak rule. Caster pays
  // the cost from current mana.
  spendAether(state, color, POWER_COSTS[POWER.CHRONOBREAK]);

  state.log.push(`CHRONOBREAK! ${colorName(opp)}'s entire turn rewound (moves + powers).`);
  state.lastActionKind = 'CHRONOBREAK';

  // Bug fix: Check if Chronobreak caused discovery check on opponent
  // (rewinding board state can expose checks)
  if (isInCheck(state.board, opp)) {
    state.log.push(`${colorName(opp)} is in check.`);
    clearPerTurnEffects(state, state.turn);
    endOfTurn(state);
    return { success: true, passedTurn: true };
  }

  return { success: true };
}

// VENGEANCE
function castVengeance(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.VENGEANCE); if (err) return { error: err };
  const target = state.board[r][c];
  if (!target) return { error: 'No target' };
  if (target.color === color) return { error: 'Cannot Vengeance own piece' };
  if (target.type === PIECE.KING) return { error: 'Cannot target King' };

  // Simulate destruction
  pushHistory(state);
  const releasedCaptive = target.imprisoned || null;
  state.board[r][c] = null;

  // Release captive (consistent with capture/cleanse: send to home tile, destroyed if occupied).
  if (releasedCaptive) releasePrisonerToHome(state, releasedCaptive, r, c);

  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Vengeance would leave your King in check' };
  }
  if (isCheckmate(state.board, opposite(color), state)) {
    popHistory(state);
    return { error: 'Vengeance cannot deliver checkmate' };
  }

  spendAether(state, color, POWER_COSTS[POWER.VENGEANCE]);
  state.log.push(`${colorName(color)} ☠ Vengeance: destroyed ${pieceTypeShort(target.type)} at ${algebraic(r,c)}.`);
  state.lastMoveInfo = { type: 'VENGEANCE', to: {r,c} };
  state.lastActionKind = 'POWER';

  // Bug fix: Check if Vengeance caused discovery check on opponent
  // (removing the piece can expose checks)
  const opp = opposite(color);
  if (isInCheck(state.board, opp)) {
    state.log.push(`${colorName(opp)} is in check.`);
    clearPerTurnEffects(state, state.turn);
    endOfTurn(state);
    return { success: true, passedTurn: true };
  }

  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true };
}

// THE WALL
function castWall(state, r, c, direction) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.WALL); if (err) return { error: err };
  const anchor = state.board[r][c];
  if (!anchor) return { error: 'No anchor piece' };
  if (anchor.color !== color) return { error: 'Anchor must be your piece' };
  if (anchor.type === PIECE.KING) return { error: 'King cannot anchor The Wall' };
  if (!direction) return { error: 'Direction required: N, S, E, or W' };

  // Validate direction
  const validDirections = ['N', 'S', 'E', 'W'];
  if (!validDirections.includes(direction)) {
    return { error: 'Invalid direction. Use N, S, E, or W' };
  }

  // Determine eligible neighbor squares in the chosen direction only.
  // Skip the *caster's* promotion rank — a pawn placed there would immediately
  // become a Queen on the next move, which would feel like a free promotion.
  // White pawns promote on row 0; black on row 7.
  const promoRank = color === COLOR.WHITE ? 0 : 7;
  const spawnSquares = [];

  // Direction mapping: N = lower row, S = higher row, E = higher col, W = lower col
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    if (state.board[nr][nc]) continue;
    if (nr === promoRank) continue;

    // Filter by direction: only spawn in the chosen direction
    let inDirection = false;
    if (direction === 'N' && nr < r) inDirection = true;       // North: squares above
    else if (direction === 'S' && nr > r) inDirection = true;  // South: squares below
    else if (direction === 'E' && nc > c) inDirection = true;  // East: squares to right
    else if (direction === 'W' && nc < c) inDirection = true;  // West: squares to left

    if (inDirection) {
      spawnSquares.push({ r: nr, c: nc });
    }
  }

  if (spawnSquares.length === 0) return { error: 'No empty adjacent squares in that direction' };

  pushHistory(state);
  for (const sq of spawnSquares) {
    // Wall-spawned pawns follow normal pawn rules: a pawn on its home rank can double-step.
    // originFile = spawn square so any future Imprison-then-Cleanse returns it here.
    state.board[sq.r][sq.c] = makePiece(PIECE.PAWN, color, { originFile: sq.c });
  }

  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Wall would leave your King in check' };
  }

  // v3.3 + v3.5: Wall cannot be cast if the resulting position gives check or mate
  // to the enemy King — Wall is a defensive/positional power. (It still ends the
  // turn, so a pawn-attacks-king pattern that doesn't deliver check is fine.)
  const opp = opposite(color);
  if (isInCheck(state.board, opp)) {
    popHistory(state);
    return { error: 'Wall cannot put the enemy King in check — powers do not target the King.' };
  }

  spendAether(state, color, POWER_COSTS[POWER.WALL]);
  const dirName = { N: 'North', S: 'South', E: 'East', W: 'West' }[direction];
  state.log.push(`${colorName(color)} ▧ The Wall (${dirName}): ${spawnSquares.length} pawns spawned around ${pieceTypeShort(anchor.type)} at ${algebraic(r,c)}.`);
  state.lastMoveInfo = { type: 'WALL', to: {r,c}, direction };
  state.lastActionKind = 'POWER';
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, spawned: spawnSquares.length, direction };
}

// ---------- Bomb mechanics ----------
function defuseBombAt(state, r, c) {
  const idx = state.bombs.findIndex(b => b.r === r && b.c === c);
  if (idx >= 0) {
    state.bombs.splice(idx, 1);
    state.timeBombs = state.bombs;
    state.log.push(`Bomba at ${algebraic(r,c)} defused!`);
    return true;
  }
  return false;
}

// v3.2: Bomba only destroys UNSHIELDED ENEMY NON-KING pieces in the 3x3.
// Friendlies, Kings, and shielded pieces are all safe.
function detonateBomb(state, bomb) {
  const affected = [];
  const opp = opposite(bomb.owner);
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,0],[0,1],[1,-1],[1,0],[1,1]]) {
    const nr = bomb.r + dr, nc = bomb.c + dc;
    if (inBounds(nr, nc) && state.board[nr][nc]) {
      affected.push({ r: nr, c: nc, piece: state.board[nr][nc] });
    }
  }
  let destroyedCount = 0;
  for (const a of affected) {
    if (a.piece.color === bomb.owner) continue;          // friendly: skip
    if (a.piece.type === PIECE.KING) continue;           // King: always safe
    if (a.piece.shieldHP > 0) { continue; } // shielded pieces fully immune (shield stays)
    state.board[a.r][a.c] = null;
    destroyedCount++;
  }
  state.log.push(`Bomba detonated at ${algebraic(bomb.r, bomb.c)} — ${destroyedCount} piece${destroyedCount===1?'':'s'} destroyed.`);
}

// ---------- History ----------
// v3.5 Chronobreak: snapshot every piece of mutable state a power can change
// (pendingPrisoners, enPassant, bombs, aetherBlocked, sacrificed, etc.) so
// rewinding undoes ALL power effects of the opponent's turn, not just board moves.
function pushHistory(state) {
  state.history.push({
    board: snapshot(state.board),
    mana: { ...state.mana },
    turn: state.turn,
    turnNumber: state.turnNumber,
    enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
    pendingEnPassant: state.pendingEnPassant ? { ...state.pendingEnPassant } : null,
    bombs: state.bombs.map(b => ({ ...b })),
    aetherBlocked: { ...state.aetherBlocked },
    sacrificedThisTurn: { ...state.sacrificedThisTurn },
    fullTurnsPlayed: { ...state.fullTurnsPlayed },
    firstGenSkipped: { ...state.firstGenSkipped },
    pendingPrisoners: (state.pendingPrisoners || []).map(p => ({ ...p })),
    lastActionKind: state.lastActionKind || null
  });
  if (state.history.length > 200) state.history.shift();
}
function popHistory(state) {
  const snap = state.history.pop();
  if (snap) {
    restore(state.board, snap.board);
    state.mana = { ...snap.mana };
    state.enPassantTarget = snap.enPassantTarget ? { ...snap.enPassantTarget } : null;
    state.pendingEnPassant = snap.pendingEnPassant ? { ...snap.pendingEnPassant } : null;
    state.bombs = snap.bombs.map(b => ({ ...b }));
    state.timeBombs = state.bombs;
    if (snap.aetherBlocked) state.aetherBlocked = { ...snap.aetherBlocked };
    if (snap.sacrificedThisTurn) state.sacrificedThisTurn = { ...snap.sacrificedThisTurn };
    if (snap.pendingPrisoners) state.pendingPrisoners = snap.pendingPrisoners.map(p => ({ ...p }));
  }
}

// ---------- Init ----------
function initGame(opts = {}) {
  const state = createGameState(opts);
  startOfTurn(state);
  return state;
}

// Back-compat shims to old names (tests may still reference some)
const castNova = () => ({ error: 'Nova removed in v3.0' });
const castManaBurn = () => ({ error: 'Mana Burn replaced by Aether Block' });
const castMitosis = () => ({ error: 'Mitosis removed in v3.0' });
const castGhost = () => ({ error: 'Ghost removed in v3.3' });
const castGhostMove = () => ({ error: 'Ghost removed in v3.3' });
const castPhaseShift = castGhost;
const castChainLightning = castDoubleAttack;  // renamed to Double Attack in v3.3
const castRewind = castChronobreak;
const castTimeBomb = castBomba;
const FOUNTAIN_SQUARES = []; // deprecated — fountains are per-game random; accessible via state.fountains

// Expose
(function() {
  const g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : this);
  Object.assign(g, {
    POWER, POWER_COSTS, POWER_DESCRIPTIONS, POWER_DISPLAY_NAMES, POWER_TIER, SACRIFICE_VALUES,
    AETHER_CAP, AETHER_BASE_GEN, STARTING_AETHER, STARTING_AETHER_WHITE, STARTING_AETHER_BLACK,
    MANA_CAP, MANA_BASE_GEN, STARTING_MANA,
    CENTER_SQUARES, CENTER_BONUS, FOUNTAIN_BONUS, FOUNTAIN_SQUARES,
    aetherBaseGenForTurn,
    createGameState, initGame, startOfTurn, endOfTurn, makeMove, sacrificePiece,
    castFrost, castFortify, castBlink, castSpawn,
    castBomba, castDoubleAttack, castImprison, castAetherBlock, castCleanse,
    castPromote, castChronobreak, castVengeance, castWall,
    // Back-compat
    castGhost, castGhostMove, castPhaseShift, castChainLightning,
    castNova, castManaBurn, castMitosis, castRewind, castTimeBomb,
    detonateBomb, defuseBombAt, controlsCenter, occupiedFountains, canAfford, colorName,
    randomFountains, validBombaTarget,
    pieceTypeShort, canOpponentEscapeMateWithPowers, canOpponentEscapeStalemateWithPowers
  });
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    POWER, POWER_COSTS, POWER_DESCRIPTIONS, POWER_DISPLAY_NAMES, POWER_TIER, SACRIFICE_VALUES,
    AETHER_CAP, AETHER_BASE_GEN, STARTING_AETHER, STARTING_AETHER_WHITE, STARTING_AETHER_BLACK,
    CENTER_SQUARES, CENTER_BONUS, FOUNTAIN_BONUS,
    aetherBaseGenForTurn,
    createGameState, initGame, startOfTurn, endOfTurn, makeMove, sacrificePiece,
    castFrost, castFortify, castBlink, castSpawn,
    castBomba, castDoubleAttack, castImprison, castAetherBlock, castCleanse,
    castPromote, castChronobreak, castVengeance, castWall,
    // Back-compat
    castGhost, castGhostMove, castChainLightning,
    detonateBomb, defuseBombAt, controlsCenter, occupiedFountains, canAfford, colorName,
    randomFountains, validBombaTarget,
    pieceTypeShort, canOpponentEscapeMateWithPowers, canOpponentEscapeStalemateWithPowers
  };
}
