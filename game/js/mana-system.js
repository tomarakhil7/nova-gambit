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

// v3.3 cost rebalance — user-provided values.
const POWER_COSTS = {
  [POWER.SPAWN]: 6,
  [POWER.FROST]: 7,
  [POWER.FORTIFY]: 7,
  [POWER.BLINK]: 8,
  [POWER.IMPRISON]: 10,
  [POWER.AETHER_BLOCK]: 10,
  [POWER.CLEANSE]: 12,
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
  [POWER.BOMBA]: 'Plant a bomb on an empty square one rank ahead of your furthest-advanced pawn. Pawns may also plant diagonally on empty squares. Detonates next turn — destroys unshielded ENEMY non-King pieces in the 3×3 blast. Kings, shielded pieces, and your own pieces are safe. Shields absorb one blast. Defused if a piece moves onto the bomb square. Turn continues.',
  [POWER.DOUBLE_ATTACK]: 'Choose one of your pieces and make TWO moves with it this turn (the second from the square the first lands on). Each step must be fully legal. Cannot target the King. Cannot deliver checkmate. Turn ends.',
  [POWER.IMPRISON]: 'Capture an adjacent enemy non-King piece INSIDE your piece. Captor can still move normally. Cannot imprison frozen, Spectral, or already-captor pieces. Turn continues.',
  [POWER.AETHER_BLOCK]: 'Silence your opponent — they cannot spend Aether on their next turn. Active effects still tick. Turn continues.',
  [POWER.CLEANSE]: 'Remove Imprisonment and/or Frost from any piece (yours or theirs). Releases any prisoner inside — the prisoner returns to its original starting square; if occupied, the prisoner is destroyed. Turn continues.',
  [POWER.PROMOTE]: 'Instantly promote any of your pawns to Queen, Rook, Bishop, or Knight (not Spectral). Turn ends.',
  [POWER.CHRONOBREAK]: "Undo opponent's last move. Their spent Aether is NOT refunded. Cannot Chronobreak a Chronobreak. Turn continues.",
  [POWER.VENGEANCE]: 'Destroy any 1 enemy non-King piece anywhere on the board. Bypasses shield (shield absorbs 1 then piece dies). Cannot leave your King in check. Cannot deliver checkmate. Turn ends.',
  [POWER.WALL]: 'Spawn friendly pawns on every empty adjacent square around one of your pieces (up to 8). Skips last-rank squares. Cannot be cast if the spawned pawns would give check or mate to the enemy King. Turn ends.'
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

// ---------- Power-aware mate detection (v3.3) ----------
// Returns true if `color` (currently in check with no regular legal move) could cast some
// affordable single power to get OUT of check. 1-ply search over the power space.
function canOpponentEscapeMateWithPowers(state, color) {
  if (state.aetherBlocked[color]) return false;  // opponent is silenced; can't cast anything
  const aether = state.mana[color];
  const snap = snapshot(state.board);
  const snapMana = { ...state.mana };
  const snapBombs = state.bombs.map(b => ({ ...b }));

  const tryPower = (fn) => {
    try { return !!fn(); }
    finally {
      // Always restore: deep-reset board + mana + bombs so the outer call is unaffected.
      restore(state.board, snap);
      state.mana = { ...snapMana };
      state.bombs = snapBombs.map(b => ({ ...b }));
      state.timeBombs = state.bombs;
    }
  };

  // Helper to test: did the cast leave `color` NOT in check?
  const escaped = () => !isInCheck(state.board, color);

  // Save turn so we can swap while casting (most cast functions read state.turn).
  const savedTurn = state.turn;
  state.turn = color;

  let saved = false;
  try {
    // --- Fortify (shield blocking a checker's attack after the checker tries to capture)
    // Fortify on the King itself is actually illegal target in castFortify, but Fortify on
    // a defender or blocker can indirectly save. Simplest: we try to cast Fortify on every
    // friendly piece. If any attempt succeeds and then removes check (it won't remove check
    // directly, but shield blocks upcoming capture — not "immediate escape" though).
    // Fortify doesn't resolve a current-board check. Skip.

    // --- Blink: move a friendly piece (including King? castBlink refuses King). So Blink
    // won't move the King out of check. But Blink could move a BLOCKING piece away... no,
    // that won't escape check either. Blink could move a defender to block a check line.
    // Cost is 8 — try every Blink from every friendly piece to every empty 3×3 square.
    if (aether >= POWER_COSTS[POWER.BLINK]) {
      for (let r = 0; r < 8 && !saved; r++) for (let c = 0; c < 8 && !saved; c++) {
        const p = state.board[r][c];
        if (!p || p.color !== color || p.type === PIECE.KING) continue;
        for (let dr = -1; dr <= 1 && !saved; dr++) for (let dc = -1; dc <= 1 && !saved; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          saved = tryPower(() => {
            const res = castBlink(state, r, c, nr, nc);
            return res && res.success && escaped();
          });
        }
      }
    }

    // --- Vengeance: destroy a checker. Bypass shield. Cost 18.
    if (!saved && aether >= POWER_COSTS[POWER.VENGEANCE]) {
      for (let r = 0; r < 8 && !saved; r++) for (let c = 0; c < 8 && !saved; c++) {
        const p = state.board[r][c];
        if (!p || p.color === color || p.type === PIECE.KING) continue;
        saved = tryPower(() => {
          const res = castVengeance(state, r, c);
          return res && res.success && escaped();
        });
      }
    }

    // --- Cleanse: un-freeze a friendly blocker (if frozen) so it can legally move next turn.
    //    BUT — this doesn't immediately resolve the current check. Skip.

    // --- Imprison: imprison the adjacent checker. Cost 10.
    if (!saved && aether >= POWER_COSTS[POWER.IMPRISON]) {
      for (let r = 0; r < 8 && !saved; r++) for (let c = 0; c < 8 && !saved; c++) {
        const captor = state.board[r][c];
        if (!captor || captor.color !== color) continue;
        for (let dr = -1; dr <= 1 && !saved; dr++) for (let dc = -1; dc <= 1 && !saved; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const captive = state.board[nr][nc];
          if (!captive || captive.color === color || captive.type === PIECE.KING) continue;
          saved = tryPower(() => {
            const res = castImprison(state, r, c, nr, nc);
            return res && res.success && escaped();
          });
        }
      }
    }

    // --- Frost: freeze the checker so it can't recapture on next turn. But doesn't resolve
    // current check. Skip.

    // --- Chronobreak: undoes opponent's last move, reverting the position before the
    // attacking move. If we had no check before, we won't after Chronobreak either.
    if (!saved && aether >= POWER_COSTS[POWER.CHRONOBREAK]) {
      saved = tryPower(() => {
        const res = castChronobreak(state);
        return res && res.success && escaped();
      });
    }

    // --- Double Attack: captures with the mover. Could capture the checker + move on. Cost 14.
    // Expensive search but needed for completeness. Limit: only try friendly pieces whose
    // first-move legal targets include the checker square.
    if (!saved && aether >= POWER_COSTS[POWER.DOUBLE_ATTACK]) {
      for (let r = 0; r < 8 && !saved; r++) for (let c = 0; c < 8 && !saved; c++) {
        const p = state.board[r][c];
        if (!p || p.color !== color || p.type === PIECE.KING) continue;
        const firstMoves = legalMoves(state.board, r, c, state);
        for (const m1 of firstMoves) {
          if (saved) break;
          // After first move, attacker is on m1.r/m1.c. Find any legal second move.
          const tempSnap = snapshot(state.board);
          const tempMana = { ...state.mana };
          // Simulate first step manually (shield-aware) to compute second-step options.
          const tgt = state.board[m1.r][m1.c];
          if (tgt && tgt.type === PIECE.KING) continue;
          if (tgt && tgt.shieldHP > 0) { /* shield blocks; attacker stays on r,c */ }
          else { state.board[m1.r][m1.c] = state.board[r][c]; state.board[r][c] = null; state.board[m1.r][m1.c].hasMoved = true; }
          const curR = (tgt && tgt.shieldHP > 0) ? r : m1.r;
          const curC = (tgt && tgt.shieldHP > 0) ? c : m1.c;
          const secondMoves = legalMoves(state.board, curR, curC, state);
          restore(state.board, tempSnap);
          state.mana = tempMana;
          for (const m2 of secondMoves) {
            if (saved) break;
            if (m2.r === curR && m2.c === curC) continue;
            saved = tryPower(() => {
              const res = castDoubleAttack(state, r, c, m1.r, m1.c, m2.r, m2.c);
              return res && res.success && escaped();
            });
          }
        }
      }
    }

    // --- Wall / Spawn: place pawns that might block the check line.
    if (!saved && aether >= POWER_COSTS[POWER.SPAWN]) {
      for (let r = 0; r < 8 && !saved; r++) for (let c = 0; c < 8 && !saved; c++) {
        if (state.board[r][c]) continue;
        saved = tryPower(() => {
          const res = castSpawn(state, r, c);
          return res && res.success && escaped();
        });
      }
    }
    if (!saved && aether >= POWER_COSTS[POWER.WALL]) {
      for (let r = 0; r < 8 && !saved; r++) for (let c = 0; c < 8 && !saved; c++) {
        const p = state.board[r][c];
        if (!p || p.color !== color) continue;
        saved = tryPower(() => {
          const res = castWall(state, r, c);
          return res && res.success && escaped();
        });
      }
    }
  } finally {
    state.turn = savedTurn;
  }

  return saved;
}

// Similar 1-ply check for stalemate: can the opponent cast some affordable power to give
// themselves a legal move? Simpler: any power that ADDS a friendly piece (Spawn, Wall) or
// removes a friendly blocker that's in their own way. For now, we just check Spawn / Wall.
function canOpponentEscapeStalemateWithPowers(state, color) {
  if (state.aetherBlocked[color]) return false;
  const aether = state.mana[color];
  if (aether < Math.min(POWER_COSTS[POWER.SPAWN], POWER_COSTS[POWER.WALL])) return false;

  const snap = snapshot(state.board);
  const snapMana = { ...state.mana };
  const snapBombs = state.bombs.map(b => ({ ...b }));
  const savedTurn = state.turn;
  state.turn = color;

  const tryIt = (fn) => {
    try { return !!fn(); }
    finally {
      restore(state.board, snap);
      state.mana = { ...snapMana };
      state.bombs = snapBombs.map(b => ({ ...b }));
      state.timeBombs = state.bombs;
    }
  };

  let saved = false;
  try {
    if (aether >= POWER_COSTS[POWER.SPAWN]) {
      // If Spawn works, we'll have at least one legal move next turn (the spawned pawn's).
      outer1:
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (state.board[r][c]) continue;
        if (tryIt(() => { const res = castSpawn(state, r, c); return res && res.success; })) { saved = true; break outer1; }
      }
    }
  } finally {
    state.turn = savedTurn;
  }
  return saved;
}

// ---------- Imprison release ----------
// When a captor piece dies and it was holding a prisoner, return the prisoner to its
// color's home rank on the file it remembers (stored on capture). If the starting tile
// is occupied, the prisoner is destroyed. Returns { placed, destroyed, r, c }.
function releasePrisonerToHome(state, prisoner) {
  if (!prisoner) return null;
  const homeRank = prisoner.color === COLOR.WHITE ? 7 : 0;
  // If we saved the original starting file when imprisoning, use it; else fall back
  // to the captive's current file is meaningless (they're not on the board any more),
  // so default to a piece-type best-guess starting file.
  const file = (prisoner.originFile != null)
    ? prisoner.originFile
    : defaultStartFile(prisoner.type);
  // Clear captive-flag fields before placing so the released piece behaves normally.
  delete prisoner.originFile;
  prisoner.hasMoved = true;      // released piece has "moved" — no double-push, no castle
  prisoner.imprisoned = null;
  prisoner.frozenUntil = 0;
  prisoner.shieldHP = 0;
  if (state.board[homeRank][file]) {
    state.log.push(`${colorName(prisoner.color)}'s ${prisoner.type} prisoner destroyed — home tile ${algebraic(homeRank, file)} was occupied.`);
    return { placed: false, destroyed: true, r: homeRank, c: file };
  }
  state.board[homeRank][file] = prisoner;
  state.log.push(`Prisoner ${prisoner.type} released to ${algebraic(homeRank, file)}.`);
  return { placed: true, destroyed: false, r: homeRank, c: file };
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

  // Check win conditions for opponent (who is about to move)
  const opp = opposite(state.turn);
  if (isCheckmate(state.board, opp, state)) {
    // v3.3: before declaring mate, verify the opponent can't escape with ANY affordable
    // single power cast either. If some power would relieve check, the game continues.
    if (!canOpponentEscapeMateWithPowers(state, opp)) {
      state.winner = state.turn;
      state.winReason = 'CHECKMATE';
      state.log.push(`Checkmate! ${colorName(state.turn)} wins.`);
      return;
    }
    // Mate is NOT unavoidable — continue; opponent will have to cast a power on their turn.
    state.log.push(`${colorName(opp)} is in check — only a power can save them.`);
  } else if (isStalemate(state.board, opp, state)) {
    // Stalemate: same logic. If a power could unlock a legal move, continue instead of draw.
    if (!canOpponentEscapeStalemateWithPowers(state, opp)) {
      state.winner = 'DRAW';
      state.winReason = 'STALEMATE';
      state.log.push(`Stalemate - draw.`);
      return;
    }
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
  // NOTE (v3.3): captors CAN now move while holding a prisoner.

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

  // v3.3: when a captor dies by capture, the prisoner returns to its ORIGINAL starting
  // tile (home rank + original file). If occupied, the prisoner is destroyed.
  if (releasedCaptive) releasePrisonerToHome(state, releasedCaptive);

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
  // v3.3: if the sacrificed piece was a captor, the prisoner dies too.
  if (piece.imprisoned) {
    state.log.push(`${piece.imprisoned.color === COLOR.WHITE ? 'White' : 'Black'}'s imprisoned ${piece.imprisoned.type} perished with its captor.`);
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

// BOMBA
function castBomba(state, r, c) {
  if (state.winner) return { error: 'Game over' };
  const color = state.turn;
  const err = requireAether(state, color, POWER.BOMBA); if (err) return { error: err };
  if (state.board[r][c]) return { error: 'Bomba must be planted on an empty square' };
  if (state.bombs.some(b => b.r === r && b.c === c)) return { error: 'Already a bomb here' };

  // v3.3 placement rules:
  // (1) Default: must be on the single row one rank AHEAD of the caster's
  //     furthest-advanced pawn — i.e., "the row just in front of your pawn line."
  // (2) Pawn-laid: if a friendly pawn exists diagonally adjacent to the target square,
  //     the placement is legal as long as the target square itself is empty.
  if (!validBombaTarget(state, color, r, c)) {
    return { error: 'Bomba must land on the row ahead of your furthest pawn, or diagonally from one of your pawns.' };
  }

  pushHistory(state);
  state.bombs.push({ r, c, owner: color, turnsLeft: 2, revealed: true });
  state.timeBombs = state.bombs;
  spendAether(state, color, POWER_COSTS[POWER.BOMBA]);
  state.log.push(`Bomba planted at ${algebraic(r,c)}. Detonates next turn.`);
  return { success: true };
}

// True if (r, c) is a valid Bomba placement for `color` under v3.3 rules.
function validBombaTarget(state, color, r, c) {
  // Rule 2 (pawn-laid): any friendly pawn diagonally adjacent?
  const adj = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for (const [dr, dc] of adj) {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    const p = state.board[nr][nc];
    if (p && p.type === PIECE.PAWN && p.color === color && !p.isSpectral) return true;
  }
  // Rule 1 (default): one row ahead of the player's furthest-advanced pawn.
  const dir = color === COLOR.WHITE ? -1 : 1;
  let furthestRow = null;
  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const p = state.board[rr][cc];
      if (!p || p.color !== color || p.type !== PIECE.PAWN || p.isSpectral) continue;
      if (furthestRow == null) { furthestRow = rr; continue; }
      // "furthest" = closest to opponent's back rank
      if (color === COLOR.WHITE ? rr < furthestRow : rr > furthestRow) furthestRow = rr;
    }
  }
  if (furthestRow == null) return false; // no pawns left, no default placement
  const allowedRow = furthestRow + dir;
  return r === allowedRow;
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
  if (attacker.imprisoned || attacker.isSpectral || (attacker.frozenUntil && attacker.frozenUntil > state.turnNumber)) {
    return { error: 'Piece cannot cast Double Attack' };
  }

  const firstLegal = legalMoves(state.board, fromR, fromC, state);
  const firstMove = firstLegal.find(m => m.r === toR && m.c === toC);
  if (!firstMove) return { error: 'First move must be legal for this piece' };

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
    if (firstCaptor && firstCaptor.imprisoned) releasePrisonerToHome(state, firstCaptor.imprisoned);
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
  // Can't move to same square; second move can be no-op only if first was a capture
  // (i.e. we allow player to "skip" second by choosing first==second==cur).
  // For simplicity: require a distinct, legal second move.
  if (jumpR === curR && jumpC === curC) {
    popHistory(state);
    return { error: 'Second move must differ from first landing' };
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
    if (secondCaptor && secondCaptor.imprisoned) releasePrisonerToHome(state, secondCaptor.imprisoned);
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
  state.log.push(`Double Attack: ${algebraic(fromR,fromC)} → ${algebraic(toR,toC)} → ${algebraic(jumpR,jumpC)}.`);
  state.lastMoveInfo = { type:'DOUBLE_ATTACK', from:{r:fromR,c:fromC}, to:{r:toR,c:toC}, jump:{r:jumpR,c:jumpC} };
  state.lastActionKind = 'POWER';
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
  // Strip shields/phases from captive when imprisoned. Remember its starting file
  // so Cleanse / captor-death can release the prisoner to its original home tile.
  const caged = { ...captive, originFile: captiveC };
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

// CLEANSE — remove Imprison and/or Frost from any piece (own or enemy).
// If the target is a captor, its prisoner is released to its home tile (or destroyed if occupied).
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
  if (!wasFrozen && !wasCaptor) return { error: 'Nothing to cleanse on this piece' };

  pushHistory(state);
  let releasedInfo = null;
  if (wasCaptor) {
    releasedInfo = releasePrisonerToHome(state, target.imprisoned);
    target.imprisoned = null;
  }
  if (wasFrozen) {
    target.frozenUntil = 0;
  }
  // Can't self-check by cleansing. But cleansing someone next to your king could theoretically
  // unfreeze an attacker. Validate.
  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Cleanse would leave your King in check' };
  }

  spendAether(state, color, POWER_COSTS[POWER.CLEANSE]);
  const parts = [];
  if (wasCaptor) parts.push('freed prisoner');
  if (wasFrozen) parts.push('thawed frost');
  state.log.push(`Cleanse on ${algebraic(r,c)}: ${parts.join(' + ')}.`);
  state.lastActionKind = 'POWER';
  return { success: true, released: releasedInfo, thawed: wasFrozen };
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
    // Wall-spawned pawns follow normal pawn rules: a pawn on its home rank can double-step.
    state.board[sq.r][sq.c] = makePiece(PIECE.PAWN, color);
  }

  if (isInCheck(state.board, color)) {
    popHistory(state);
    return { error: 'Wall would leave your King in check' };
  }

  // v3.3: Wall cannot be cast if the resulting position gives check or mate to the enemy King.
  // This enforces "no power can end the game by hitting the King" — Wall must be defensive/positional.
  const opp = opposite(color);
  if (isInCheck(state.board, opp)) {
    popHistory(state);
    return { error: 'Wall cannot put the enemy King in check — powers do not target the King.' };
  }

  spendAether(state, color, POWER_COSTS[POWER.WALL]);
  state.log.push(`The Wall: ${spawnSquares.length} pawns spawned around ${algebraic(r,c)}.`);
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
    randomFountains, validBombaTarget
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
    randomFountains, validBombaTarget
  };
}
