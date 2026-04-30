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
  // Tier 1 (Start Game: 4-7)
  FROST: 'FROST',
  FORTIFY: 'FORTIFY',
  BLINK: 'BLINK',
  SPAWN: 'SPAWN',
  // Tier 2 (Mid Game: 8-13)
  GHOST: 'GHOST',
  BOMBA: 'BOMBA',
  CHAIN_LIGHTNING: 'CHAIN_LIGHTNING',
  IMPRISON: 'IMPRISON',
  AETHER_BLOCK: 'AETHER_BLOCK',
  // Tier 3 (End Game: 14-30)
  PROMOTE: 'PROMOTE',
  CHRONOBREAK: 'CHRONOBREAK',
  VENGEANCE: 'VENGEANCE',
  WALL: 'WALL'
};

const POWER_TIER = {
  [POWER.FROST]: 1, [POWER.FORTIFY]: 1, [POWER.BLINK]: 1, [POWER.SPAWN]: 1,
  [POWER.GHOST]: 2, [POWER.BOMBA]: 2, [POWER.CHAIN_LIGHTNING]: 2,
  [POWER.IMPRISON]: 2, [POWER.AETHER_BLOCK]: 2,
  [POWER.PROMOTE]: 3, [POWER.CHRONOBREAK]: 3, [POWER.VENGEANCE]: 3, [POWER.WALL]: 3
};

const POWER_COSTS = {
  // Tier 1 · Start Game (4-7)
  [POWER.FROST]: 4,
  [POWER.SPAWN]: 4,
  [POWER.FORTIFY]: 5,
  [POWER.BLINK]: 6,
  // Tier 2 · Mid Game (6-13) — Ghost intentionally cheap per v3.2
  [POWER.GHOST]: 6,
  [POWER.BOMBA]: 10,
  [POWER.CHAIN_LIGHTNING]: 11,
  [POWER.IMPRISON]: 12,
  [POWER.AETHER_BLOCK]: 13,
  // Tier 3 · End Game (18-20)
  [POWER.CHRONOBREAK]: 18,
  [POWER.PROMOTE]: 18,
  [POWER.VENGEANCE]: 20,
  [POWER.WALL]: 20
};

const POWER_DISPLAY_NAMES = {
  [POWER.FROST]: 'Frost',
  [POWER.FORTIFY]: 'Fortify',
  [POWER.BLINK]: 'Blink',
  [POWER.SPAWN]: 'Spawn',
  [POWER.GHOST]: 'Ghost',
  [POWER.BOMBA]: 'Bomba',
  [POWER.CHAIN_LIGHTNING]: 'Chain Lightning',
  [POWER.IMPRISON]: 'Imprison',
  [POWER.AETHER_BLOCK]: 'Aether Block',
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
  [POWER.GHOST]: 'Move your piece through other pieces for 1 turn. Respects pins. Cannot land on a King. Turn ends. Cannot deliver checkmate.',
  [POWER.BOMBA]: 'Plant a bomb on an empty square. Detonates next turn — destroys unshielded ENEMY non-King pieces in the 3×3 blast. Your pieces, Kings, and shielded pieces are safe. Shields absorb 1 blast then break. Defusable by moving onto the bomb square. Turn continues.',
  [POWER.CHAIN_LIGHTNING]: 'Capture an enemy piece, then teleport onto an adjacent enemy piece to capture it too. Attacker ends on the 2nd target square. Cannot leave your King in check. Cannot deliver mate. Shields absorb 1 hit and end the chain. Turn ends.',
  [POWER.IMPRISON]: 'Capture an adjacent enemy non-King piece INSIDE your piece. Captive is released (promoted form preserved) when your captor dies. Captor cannot move while holding. Cannot imprison frozen/Spectral/nested pieces. Turn continues.',
  [POWER.AETHER_BLOCK]: "Silence your opponent — they cannot spend Aether on their next turn. Active effects still tick. Turn continues.",
  [POWER.PROMOTE]: 'Instantly promote any of your pawns to Queen, Rook, Bishop, or Knight (not Spectral). Turn ends.',
  [POWER.CHRONOBREAK]: "Undo opponent's last move. Their spent Aether is NOT refunded. Cannot Chronobreak a Chronobreak. Turn continues.",
  [POWER.VENGEANCE]: 'Destroy any 1 enemy non-King piece anywhere on the board. Bypasses shield (absorbs 1 then kills). Cannot leave your King in check. Cannot deliver checkmate. Turn ends.',
  [POWER.WALL]: 'Spawn friendly pawns on every empty adjacent square around one of your pieces (up to 8). Skips promotion squares. If Wall creates a stalemate, the player with more Aether wins (no draw). Turn ends.'
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
// In v3.1 of the model: Aether generation happens at END of the player's turn
// (see generateAetherForPlayer below, called from endOfTurn before the switch).
// Phase 1 at turn start now only handles: spectral cleanup, ghost decay, bomb ticks.
function startOfTurn(state) {
  if (state.winner) return;
  state.phase = 'START';
  const color = state.turn;

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

  state.phase = 'ACTION';
  state.startProcessed = true;
}

// Generate Aether for a player at the END of their turn.
// First turn is still "skipped" so players don't start their first turn already charged.
// v3.2: base gen scales by fullTurnsPlayed (1-10:+1, 11-20:+2, 21+:+3).
function generateAetherForPlayer(state, color) {
  state.fullTurnsPlayed[color] = (state.fullTurnsPlayed[color] || 0) + 1;
  if (!state.firstGenSkipped[color]) {
    state.firstGenSkipped[color] = true;
    return;
  }
  let gain = aetherBaseGenForTurn(state.fullTurnsPlayed[color]);
  if (controlsCenter(state, color)) gain += CENTER_BONUS;
  const fountainsOccupied = occupiedFountains(state, color);
  gain += fountainsOccupied * FOUNTAIN_BONUS;
  const before = state.mana[color];
  state.mana[color] = Math.min(AETHER_CAP, state.mana[color] + gain);
  const actual = state.mana[color] - before;
  state.log.push(`${colorName(color)} +${actual} Aether (${state.mana[color]}/${AETHER_CAP})${fountainsOccupied ? ` [${fountainsOccupied}f]` : ''}`);
}

function colorName(c) { return c === COLOR.WHITE ? 'White' : 'Black'; }

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

  // Check win conditions for opponent (who is about to move)
  const opp = opposite(state.turn);
  if (isCheckmate(state.board, opp, state)) {
    state.winner = state.turn;
    state.winReason = 'CHECKMATE';
    state.log.push(`Checkmate! ${colorName(state.turn)} wins.`);
    return;
  }
  if (isStalemate(state.board, opp, state)) {
    state.winner = 'DRAW';
    state.winReason = 'STALEMATE';
    state.log.push(`Stalemate - draw.`);
    return;
  }

  // Generate Aether for the player whose turn just ended (new model: end-of-turn gen)
  generateAetherForPlayer(state, state.turn);

  // Pass turn
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
  if (piece.imprisoned) return { error: 'Captor cannot move while holding captive' };

  const legal = legalMoves(state.board, fromR, fromC, state);
  const move = legal.find(m => m.r === toR && m.c === toC);
  if (!move) return { error: 'Illegal move' };

  pushHistory(state);

  const target = state.board[toR][toC];
  let capturedPiece = null;
  let shieldBroke = false;

  // Fortify: 2-HP shield absorbs capture — attacker does NOT move.
  if (target && move.capture && target.shieldHP > 0) {
    target.shieldHP -= 1;
    shieldBroke = true;
    state.log.push(`Shield on ${algebraic(toR,toC)} absorbed attack (${target.shieldHP} HP left).`);
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

  // Release captive from captured captor — place on captor's square (toR,toC) if attacker doesn't occupy it,
  // otherwise nearest empty of 8 surrounding; else destroy.
  if (releasedCaptive) {
    // attacker is now on toR,toC — find nearest empty neighbor
    let placed = false;
    const neighbors = [[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1]];
    for (const [dr, dc] of neighbors) {
      const nr = toR + dr, nc = toC + dc;
      if (inBounds(nr, nc) && !state.board[nr][nc]) {
        state.board[nr][nc] = releasedCaptive;
        placed = true;
        state.log.push(`Captive ${releasedCaptive.type} released at ${algebraic(nr,nc)}.`);
        break;
      }
    }
    if (!placed) {
      state.log.push(`Captive ${releasedCaptive.type} destroyed (no empty square).`);
    }
  }

  if (move.doublePush) {
    const epRow = (fromR + toR) / 2;
    state.pendingEnPassant = { r: epRow, c: toC };
  }

  // Promotion (normal, via pawn move to last rank)
  if (piece.type === PIECE.PAWN && (toR === 0 || toR === 7)) {
    piece.type = promotionType || PIECE.QUEEN;
  }

  // Defuse bomb if landed on one
  const defused = defuseBombAt(state, toR, toC);

  state.lastMoveInfo = { type:'MOVE', from:{r:fromR,c:fromC}, to:{r:toR,c:toC}, captured:capturedPiece, defused };
  state.lastActionKind = 'MOVE';
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, captured: capturedPiece, defused };
}

// ---------- Sacrifice ----------
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
  state.log.push(`Sacrificed ${piece.type}: +${state.mana[color] - before} Aether.`);
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

  pushHistory(state);
  // Freeze until end of target's next turn. Turn numbers increment by 1 each half-move.
  // Target's next turn is state.turnNumber + 1 (their turn). They skip that. Unfreeze at turnNumber + 2.
  target.frozenUntil = state.turnNumber + 2;
  spendAether(state, color, POWER_COSTS[POWER.FROST]);
  state.log.push(`Frost: ${target.type} at ${algebraic(r,c)} frozen for 1 turn.`);
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
  if (p.isSpectral) return { error: 'Cannot Fortify Spectral pieces' };
  if (p.imprisoned) return { error: 'Cannot Fortify captor' };
  if (p.shieldHP > 0) return { error: 'Already shielded' };

  pushHistory(state);
  p.shieldHP = 1;
  // v3.2: shield expires at end of caster's NEXT turn if unused.
  p.shieldExpiresOn = state.turnNumber + 2;
  spendAether(state, color, POWER_COSTS[POWER.FORTIFY]);
  state.log.push(`Fortified ${p.type} at ${algebraic(r,c)}. Lasts 1 turn.`);
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
  const dr = Math.abs(toR - fromR), dc = Math.abs(toC - fromC);
  if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) {
    return { error: 'Blink range is the 8 adjacent squares' };
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
  state.log.push(`Blinked ${p.type}: ${algebraic(fromR,fromC)} → ${algebraic(toR,toC)}.`);
  state.lastActionKind = 'POWER';
  state.lastMoveInfo = { type: 'BLINK', from: {r:fromR,c:fromC}, to: {r:toR,c:toC} };
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
  const pawn = makePiece(PIECE.PAWN, color, {
    isSpectral: true,
    spectralExpireTurn: state.turnNumber + 2 // survives through opponent's turn, vanishes on your next turn start
  });
  pawn.hasMoved = true;
  state.board[r][c] = pawn;

  // Validate no self-check
  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Spawn would leave King in check' };
  }

  spendAether(state, color, POWER_COSTS[POWER.SPAWN]);
  state.log.push(`Spawned Spectral Pawn at ${algebraic(r,c)}.`);
  return { success: true };
}

// GHOST (1 turn only, turn ends, cannot mate)
function castGhost(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.GHOST); if (err) return { error: err };
  const p = state.board[r][c];
  if (!p) return { error: 'No piece' };
  if (p.color !== color) return { error: 'Not your piece' };
  if (p.isSpectral || p.imprisoned || (p.frozenUntil && p.frozenUntil > state.turnNumber)) {
    return { error: 'Piece cannot be Ghosted' };
  }

  // Ghost is cast AND then the player must make a move with this piece. We model this by
  // setting isPhased and requiring the player to move a phased piece this turn. For simplicity,
  // we set the flag and end-of-turn will decrement. Turn does NOT end inside cast — player
  // must manually move the phased piece for full flow. BUT spec says "turn ends after use":
  // we end the turn here. That means Ghost = free board-traversal buff for the next move cycle,
  // used as a single-action power that simply marks the piece as phased for the upcoming attacks.
  // Cleaner: treat Ghost as: during this single cast, the player picks a piece AND a destination
  // (moving it as if phased). Implement accordingly.
  return { error: 'Ghost must include a destination (use castGhostMove)' };
}

// Ghost with source + destination (move phased for this move)
function castGhostMove(state, fromR, fromC, toR, toC) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.GHOST); if (err) return { error: err };
  const p = state.board[fromR][fromC];
  if (!p) return { error: 'No source' };
  if (p.color !== color) return { error: 'Not your piece' };
  if (p.isSpectral || p.imprisoned || (p.frozenUntil && p.frozenUntil > state.turnNumber)) {
    return { error: 'Piece cannot be Ghosted' };
  }

  // Enable phasing on piece for the simulation
  p.isPhased = true;
  p.phaseTurnsLeft = 1;
  const moves = legalMoves(state.board, fromR, fromC, state);
  const m = moves.find(mv => mv.r === toR && mv.c === toC);
  if (!m) { p.isPhased = false; p.phaseTurnsLeft = 0; return { error: 'Illegal Ghost move' }; }

  // Check no self-check after
  const snap = snapshot(state.board);
  state.board[toR][toC] = p;
  state.board[fromR][fromC] = null;
  if (isInCheck(state.board, color)) {
    restore(state.board, snap);
    p.isPhased = false; p.phaseTurnsLeft = 0;
    return { error: 'Would leave King in check' };
  }
  // Cannot deliver mate
  if (isCheckmate(state.board, opposite(color), state)) {
    restore(state.board, snap);
    p.isPhased = false; p.phaseTurnsLeft = 0;
    return { error: 'Ghost cannot deliver checkmate' };
  }
  restore(state.board, snap);
  p.isPhased = false; p.phaseTurnsLeft = 0;

  pushHistory(state);

  // Now apply for real: move (respecting shields on target if any, simple capture)
  const target = state.board[toR][toC];
  if (target && target.shieldHP > 0) {
    target.shieldHP -= 1;
    spendAether(state, color, POWER_COSTS[POWER.GHOST]);
    state.log.push(`Ghost: shield absorbed attack on ${algebraic(toR,toC)}.`);
    clearPerTurnEffects(state, state.turn);
    endOfTurn(state);
    return { success: true, shieldBroke: true };
  }
  state.board[toR][toC] = p;
  state.board[fromR][fromC] = null;
  p.hasMoved = true;
  defuseBombAt(state, toR, toC);
  spendAether(state, color, POWER_COSTS[POWER.GHOST]);
  state.log.push(`Ghost move: ${p.type} phased to ${algebraic(toR,toC)}.`);
  state.lastMoveInfo = { type: 'GHOST', from: {r:fromR,c:fromC}, to: {r:toR,c:toC} };
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, captured: target };
}

// BOMBA
function castBomba(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.BOMBA); if (err) return { error: err };
  if (state.board[r][c]) return { error: 'Bomba must be planted on an empty square' };
  if (state.bombs.some(b => b.r === r && b.c === c)) return { error: 'Already a bomb here' };

  pushHistory(state);
  state.bombs.push({ r, c, owner: color, turnsLeft: 2, revealed: true });
  state.timeBombs = state.bombs;
  spendAether(state, color, POWER_COSTS[POWER.BOMBA]);
  state.log.push(`Bomba planted at ${algebraic(r,c)}. Detonates next turn.`);
  return { success: true };
}

// CHAIN LIGHTNING
function castChainLightning(state, fromR, fromC, toR, toC, jumpR, jumpC) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.CHAIN_LIGHTNING); if (err) return { error: err };
  const attacker = state.board[fromR][fromC];
  if (!attacker) return { error: 'No attacker' };
  if (attacker.color !== color) return { error: 'Not your piece' };
  if (attacker.imprisoned || attacker.isSpectral || (attacker.frozenUntil && attacker.frozenUntil > state.turnNumber)) {
    return { error: 'Piece cannot cast Chain Lightning' };
  }

  const legal = legalMoves(state.board, fromR, fromC, state);
  const firstMove = legal.find(m => m.r === toR && m.c === toC && m.capture);
  if (!firstMove) return { error: 'First target must be a legal capture' };

  const firstTarget = state.board[toR][toC];
  if (!firstTarget || firstTarget.color === color) return { error: 'First target must be enemy' };

  const dr = Math.abs(jumpR - toR), dc = Math.abs(jumpC - toC);
  if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) return { error: 'Second target must be adjacent to first' };
  const secondTarget = state.board[jumpR][jumpC];
  if (!secondTarget) return { error: 'No piece at second target' };
  if (secondTarget.color === color) return { error: 'Cannot chain onto own piece' };
  if (secondTarget.type === PIECE.KING) return { error: 'Cannot chain to King' };

  pushHistory(state);

  // v3.2 behavior:
  // Step 1: attacker destroys first target.
  //   - If first target is shielded, shield absorbs, attacker stays put, chain ENDS.
  //   - Otherwise, first target is removed (attacker has NOT moved yet).
  // Step 2: attacker teleports to second target's square.
  //   - If second target is shielded, shield absorbs, attacker stays on source, chain ENDS here
  //     (first target has already been destroyed — that damage sticks).
  //   - Otherwise, second target is removed AND attacker relocates to (jumpR, jumpC).
  let endedEarly = null;
  let firstHit = false, secondHit = false;

  if (firstTarget.shieldHP > 0) {
    firstTarget.shieldHP -= 1;
    endedEarly = 'first shield';
  } else {
    state.board[toR][toC] = null;
    firstHit = true;
  }

  if (!endedEarly) {
    if (secondTarget.shieldHP > 0) {
      secondTarget.shieldHP -= 1;
      endedEarly = 'second shield';
    } else {
      state.board[jumpR][jumpC] = null;
      // Move the attacker to the 2nd target square
      state.board[fromR][fromC] = null;
      state.board[jumpR][jumpC] = attacker;
      attacker.hasMoved = true;
      secondHit = true;
    }
  }

  // v3.2 "Leapfrog" fix: if landing leaves king in check (e.g. attacker was pinned),
  // or chain would deliver mate, reject entirely.
  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Chain Lightning would leave your King in check' };
  }
  if (isCheckmate(state.board, opposite(color), state)) {
    popHistory(state);
    return { error: 'Chain Lightning cannot deliver checkmate' };
  }

  spendAether(state, color, POWER_COSTS[POWER.CHAIN_LIGHTNING]);
  if (endedEarly === 'first shield') state.log.push(`Chain Lightning blocked by shield on first target.`);
  else if (endedEarly === 'second shield') state.log.push(`Chain Lightning: captured ${algebraic(toR,toC)}; second target's shield absorbed hit.`);
  else state.log.push(`Chain Lightning: captured ${algebraic(toR,toC)} and ${algebraic(jumpR,jumpC)} — attacker landed on ${algebraic(jumpR,jumpC)}.`);
  state.lastMoveInfo = { type:'CHAIN', from:{r:fromR,c:fromC}, to:{r:toR,c:toC}, jump:{r:jumpR,c:jumpC} };
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, firstHit, secondHit };
}

// IMPRISON
function castImprison(state, captorR, captorC, captiveR, captiveC) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.IMPRISON); if (err) return { error: err };
  const captor = state.board[captorR][captorC];
  if (!captor) return { error: 'No captor' };
  if (captor.color !== color) return { error: 'Captor must be your piece' };
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

  pushHistory(state);
  // Strip shields/phases from captive when imprisoned
  const caged = { ...captive };
  captor.imprisoned = caged;
  state.board[captiveR][captiveC] = null;

  // Verify no self-check
  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Imprison would leave your King in check' };
  }

  spendAether(state, color, POWER_COSTS[POWER.IMPRISON]);
  state.log.push(`Imprisoned ${captive.type} inside ${captor.type} at ${algebraic(captorR,captorC)}.`);
  return { success: true };
}

// AETHER BLOCK
function castAetherBlock(state) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.AETHER_BLOCK); if (err) return { error: err };
  const opp = opposite(color);
  if (state.aetherBlocked[opp]) return { error: 'Opponent already blocked' };

  pushHistory(state);
  state.aetherBlocked[opp] = true;
  spendAether(state, color, POWER_COSTS[POWER.AETHER_BLOCK]);
  state.log.push(`Aether Block! ${colorName(opp)} cannot spend Aether next turn.`);
  return { success: true };
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
  spendAether(state, color, POWER_COSTS[POWER.PROMOTE]);
  state.log.push(`Promoted pawn to ${newType} at ${algebraic(r,c)}.`);

  // Check if this causes mate
  if (isCheckmate(state.board, opposite(color), state)) {
    state.winner = color;
    state.winReason = 'CHECKMATE';
    state.log.push(`Checkmate by Promote!`);
    return { success: true, mate: true };
  }
  state.lastActionKind = 'POWER';
  state.lastMoveInfo = { type: 'PROMOTE', to: {r,c} };
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true };
}

// CHRONOBREAK
function castChronobreak(state) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.CHRONOBREAK); if (err) return { error: err };
  if (state.history.length === 0) return { error: 'Nothing to rewind' };
  if (state.lastActionKind === 'CHRONOBREAK') return { error: 'Cannot Chronobreak a Chronobreak' };

  const snap = state.history.pop();
  restore(state.board, snap.board);
  state.enPassantTarget = snap.enPassantTarget ? { ...snap.enPassantTarget } : null;
  state.bombs = snap.bombs.map(b => ({ ...b }));
  state.timeBombs = state.bombs;
  // Opponent's mana stays current (they don't get refund). Our mana reduces by cost.
  spendAether(state, color, POWER_COSTS[POWER.CHRONOBREAK]);
  state.log.push(`CHRONOBREAK! Opponent's last move undone.`);
  state.lastActionKind = 'CHRONOBREAK';
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

  // Release captive if any
  if (releasedCaptive) {
    const neighbors = [[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1]];
    let placed = false;
    for (const [dr, dc] of neighbors) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && !state.board[nr][nc]) {
        state.board[nr][nc] = releasedCaptive;
        placed = true;
        break;
      }
    }
    if (!placed) state.log.push(`Captive destroyed (no empty space).`);
  }

  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Vengeance would leave your King in check' };
  }
  if (isCheckmate(state.board, opposite(color), state)) {
    popHistory(state);
    return { error: 'Vengeance cannot deliver checkmate' };
  }

  spendAether(state, color, POWER_COSTS[POWER.VENGEANCE]);
  state.log.push(`Vengeance: ${target.type} at ${algebraic(r,c)} destroyed.`);
  state.lastMoveInfo = { type: 'VENGEANCE', to: {r,c} };
  state.lastActionKind = 'POWER';
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true };
}

// THE WALL
function castWall(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.WALL); if (err) return { error: err };
  const anchor = state.board[r][c];
  if (!anchor) return { error: 'No anchor piece' };
  if (anchor.color !== color) return { error: 'Anchor must be your piece' };

  // Determine eligible neighbor squares
  const spawnSquares = [];
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    if (state.board[nr][nc]) continue;
    // Skip promotion squares
    if (nr === 0 || nr === 7) continue;
    spawnSquares.push({ r: nr, c: nc });
  }
  if (spawnSquares.length === 0) return { error: 'No empty adjacent squares to spawn' };

  pushHistory(state);
  for (const sq of spawnSquares) {
    const p = makePiece(PIECE.PAWN, color);
    p.hasMoved = true;
    state.board[sq.r][sq.c] = p;
  }

  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Wall would leave your King in check' };
  }

  spendAether(state, color, POWER_COSTS[POWER.WALL]);
  state.log.push(`The Wall: ${spawnSquares.length} pawns spawned around ${algebraic(r,c)}.`);

  // Mate check
  const opp = opposite(color);
  if (isCheckmate(state.board, opp, state)) {
    state.winner = color;
    state.winReason = 'CHECKMATE';
    state.log.push('Checkmate by The Wall!');
    return { success: true, mate: true };
  }
  // v3.2: If Wall creates stalemate (no moves, not in check), convert to
  // "Aether Battle" win for the Aether leader rather than a draw.
  if (isStalemate(state.board, opp, state)) {
    const myA = state.mana[color], theirA = state.mana[opp];
    if (myA >= theirA) {
      state.winner = color;
      state.winReason = 'AETHER_STALEMATE_WIN';
      state.log.push(`Wall stalemate — ${colorName(color)} wins on Aether (${myA} vs ${theirA}).`);
    } else {
      state.winner = opp;
      state.winReason = 'AETHER_STALEMATE_WIN';
      state.log.push(`Wall stalemate — ${colorName(opp)} wins on Aether (${theirA} vs ${myA}).`);
    }
    return { success: true };
  }
  state.lastMoveInfo = { type: 'WALL', to: {r,c} };
  state.lastActionKind = 'POWER';
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, spawned: spawnSquares.length };
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
    if (a.piece.shieldHP > 0) { a.piece.shieldHP -= 1; continue; } // shield absorbs
    state.board[a.r][a.c] = null;
    destroyedCount++;
  }
  state.log.push(`Bomba detonated at ${algebraic(bomb.r, bomb.c)} — ${destroyedCount} piece${destroyedCount===1?'':'s'} destroyed.`);
}

// ---------- History ----------
function pushHistory(state) {
  state.history.push({
    board: snapshot(state.board),
    mana: { ...state.mana },
    turn: state.turn,
    turnNumber: state.turnNumber,
    enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
    bombs: state.bombs.map(b => ({ ...b }))
  });
  if (state.history.length > 200) state.history.shift();
}
function popHistory(state) {
  const snap = state.history.pop();
  if (snap) {
    restore(state.board, snap.board);
    state.mana = { ...snap.mana };
    state.enPassantTarget = snap.enPassantTarget ? { ...snap.enPassantTarget } : null;
    state.bombs = snap.bombs.map(b => ({ ...b }));
    state.timeBombs = state.bombs;
  }
}

// ---------- Init ----------
function initGame(opts = {}) {
  const state = createGameState(opts);
  startOfTurn(state);
  return state;
}

// Back-compat shims to old names used by some tests/UI
const castPhaseShift = castGhost; // old name mapped to Ghost (tests may call this)
const castNova = () => ({ error: 'Nova removed in v3.0' });
const castManaBurn = () => ({ error: 'Mana Burn replaced by Aether Block' });
const castMitosis = () => ({ error: 'Mitosis removed in v3.0' });
const castRewind = castChronobreak;
const castTimeBomb = castBomba;
const FOUNTAIN_SQUARES = []; // deprecated — fountains are per-game random now; accessible via state.fountains

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
    castGhost, castGhostMove, castBomba, castChainLightning, castImprison, castAetherBlock,
    castPromote, castChronobreak, castVengeance, castWall,
    // Back-compat
    castPhaseShift, castNova, castManaBurn, castMitosis, castRewind, castTimeBomb,
    detonateBomb, defuseBombAt, controlsCenter, occupiedFountains, canAfford, colorName,
    randomFountains
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
    castGhost, castGhostMove, castBomba, castChainLightning, castImprison, castAetherBlock,
    castPromote, castChronobreak, castVengeance, castWall,
    detonateBomb, defuseBombAt, controlsCenter, occupiedFountains, canAfford, colorName,
    randomFountains
  };
}
