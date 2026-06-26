# Phase 3: Intelligence Upgrade - Combo Generation & Tactical Learning

## Objective
Transform bot from "reactive player" to "tactical genius" by:
1. **Advanced Combo Generation** - Create multi-move power sequences
2. **Tactical Pattern Recognition** - Recognize 20+ chess/power tactical patterns
3. **Position Learning** - Learn from games and build tactical database
4. **Threat Calculation** - Multi-move threat analysis
5. **Opening Book** - Aether-optimized opening repertoire

---

## Current State Analysis

### What's Working ✅
- Basic power evaluation (Promote, Vengeance, Frost)
- Material evaluation
- Center control awareness
- Anti-hoarding behavior

### What's Missing ❌
1. **No multi-move thinking** - Bot only considers 1-power-per-turn
2. **No tactical patterns** - Doesn't recognize forks, pins, skewers with powers
3. **No position memory** - Doesn't learn from mistakes
4. **No power sequencing** - Doesn't plan "Shield → Attack → Promote"
5. **No threat evaluation** - Doesn't see opponent's power threats

---

## Implementation Plan

### Layer 6: Advanced Combo Generator
**Generate 20+ power combo patterns**

#### Combo Type 1: Sequential Power Chains
```
SHIELD → ATTACK → PROMOTE
- Shield valuable piece
- Use it to win exchange
- Promote pawn afterward
- Value: 800+ points
```

#### Combo Type 2: Aether Economy Loops
```
CONTROL FOUNTAIN → FREEZE ATTACKER → ACCUMULATE
- Take fountain square
- Frost opponent's threats
- Bank to 20+ aether
- Unleash power combo
```

#### Combo Type 3: Tactical Forks with Powers
```
DOUBLE ATTACK FORK
- Move piece to fork position
- Use Double Attack to capture both
- Net: 600+ material
```

#### Combo Type 4: Pin & Imprison
```
PIN → IMPRISON DEFENDER → CAPTURE HIGH VALUE
- Pin opponent piece to king
- Imprison the pinned piece
- Capture undefended Queen
```

#### Combo Type 5: Vengeance Setup
```
SACRIFICE → VENGEANCE QUEEN
- Trade pieces to accumulate aether
- Let opponent take material
- Destroy their Queen with Vengeance
- Net advantage: 400+
```

### Layer 7: Tactical Pattern Library
**Recognize standard chess tactics enhanced with powers**

#### Pattern 1: Fork (basic)
- Piece attacks 2+ valuable targets
- **Power enhancement**: Shield the forking piece

#### Pattern 2: Pin
- Piece attacks through one piece to more valuable target
- **Power enhancement**: Imprison pinned piece

#### Pattern 3: Skewer
- Piece forces valuable target to move, exposing lesser target
- **Power enhancement**: Freeze target so it can't move

#### Pattern 4: Discovered Attack
- Move reveals attack from another piece
- **Power enhancement**: Double Attack after discovery

#### Pattern 5: Deflection
- Force defender away from key square
- **Power enhancement**: Imprison defender first

#### Pattern 6: Decoy
- Lure piece to bad square
- **Power enhancement**: Wall creation to trap

#### Pattern 7: Zugzwang
- Any move worsens position
- **Power enhancement**: Frost to force passes

#### Pattern 8: Breakthrough
- Sacrifice for passed pawn
- **Power enhancement**: Blink pawn forward

#### Pattern 9: Mating Net
- Restrict king movement for checkmate
- **Power enhancement**: Wall + Frost combo

#### Pattern 10: Back Rank Weakness
- King trapped on back rank
- **Power enhancement**: Chronobreak to replay attack

### Layer 8: Threat Evaluation Engine
**Multi-move threat calculation**

```javascript
function evaluateThreatTree(state, forColor, depth = 3) {
  // Calculate opponent's best power-enhanced threats
  // Returns: { threat, counterplay, netEvaluation }
  
  const oppThreats = [];
  const myCounters = [];
  
  // Opponent's perspective
  for (const oppPower of viablePowers(state, opponent)) {
    const threatValue = simulatePower(oppPower);
    oppThreats.push({ power: oppPower, value: threatValue });
  }
  
  // My counterplay options
  for (const myPower of viablePowers(state, forColor)) {
    const counterValue = simulatePower(myPower);
    myCounters.push({ power: myPower, value: counterValue });
  }
  
  // Net evaluation
  return {
    maxThreat: Math.max(...oppThreats.map(t => t.value)),
    bestCounter: Math.max(...myCounters.map(c => c.value)),
    urgency: maxThreat - bestCounter
  };
}
```

### Layer 9: Position Learning System
**Learn tactical patterns from games**

```javascript
const TACTICAL_DATABASE = {
  // Key: position hash
  // Value: { bestMove, powerUsed, outcome, frequency }
  
  '5k2/8/8/8/3P4/8/8/4K3': {
    pattern: 'pawn_endgame_promotion',
    bestPower: 'PROMOTE',
    frequency: 127,
    winRate: 0.89
  },
  
  'r3k2r/8/8/8/8/8/8/R3K2R': {
    pattern: 'rook_endgame_fortress',
    bestPower: 'FORTIFY',
    frequency: 43,
    winRate: 0.73
  }
};

function learnFromGame(gameHistory, result) {
  for (const position of gameHistory) {
    const hash = hashPosition(position.board);
    const powerUsed = position.powerUsed;
    
    if (!TACTICAL_DATABASE[hash]) {
      TACTICAL_DATABASE[hash] = {
        pattern: detectPattern(position),
        bestPower: powerUsed,
        frequency: 0,
        totalValue: 0
      };
    }
    
    const entry = TACTICAL_DATABASE[hash];
    entry.frequency++;
    entry.totalValue += evaluateOutcome(result);
    entry.winRate = entry.totalValue / entry.frequency;
  }
}
```

### Layer 10: Opening Book
**Aether-optimized opening sequences**

```javascript
const OPENING_BOOK = {
  // Move 1-3: Control center and fountains
  'e4': { response: 'e5', aetherValue: 2, powerPlan: 'fountain_control' },
  'd4': { response: 'd5', aetherValue: 2, powerPlan: 'center_control' },
  
  // Fountain openings (Nova Gambit specific)
  'fountain_opening_1': {
    moves: ['e4', 'Nf3', 'Bb5'], // Control e4 fountain
    aetherGain: 6,
    powerPlan: ['accumulate_to_14', 'FORTIFY_knight', 'pressure']
  },
  
  'fountain_opening_2': {
    moves: ['d4', 'Nc3', 'Bf4'], // Control d4 fountain
    aetherGain: 6,
    powerPlan: ['accumulate_to_14', 'DOUBLE_ATTACK', 'breakthrough']
  }
};
```

---

## Detailed Implementation

### Step 1: Multi-Move Combo Generator

```javascript
function generatePowerCombos(state, forColor, horizon = 3) {
  const combos = [];
  const aether = state.mana[forColor];
  
  // Try all 1-move combos
  for (const power1 of VIABLE_POWERS) {
    if (aether < POWER_COSTS[power1]) continue;
    
    const state1 = simulatePower(state, power1);
    const value1 = evaluate(state1);
    
    if (horizon > 1) {
      // Try all 2-move sequences
      for (const power2 of VIABLE_POWERS) {
        if (state1.mana[forColor] < POWER_COSTS[power2]) continue;
        
        const state2 = simulatePower(state1, power2);
        const value2 = evaluate(state2);
        
        if (value2 > value1 + 100) {
          combos.push({
            sequence: [power1, power2],
            totalValue: value2,
            aetherCost: POWER_COSTS[power1] + POWER_COSTS[power2]
          });
        }
        
        if (horizon > 2) {
          // Try 3-move sequences
          // ... recursive expansion
        }
      }
    }
  }
  
  return combos.sort((a, b) => b.totalValue - a.totalValue);
}
```

### Step 2: Tactical Pattern Detector

```javascript
function detectTacticalPatterns(state, forColor) {
  const patterns = [];
  
  // Pattern 1: Fork detection
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece || piece.color !== forColor) continue;
      
      const moves = legalMoves(state.board, r, c, state);
      for (const move of moves) {
        const attacks = getAttackSquares(state.board, move.r, move.c);
        const highValueTargets = attacks.filter(sq => {
          const target = state.board[sq.r][sq.c];
          return target && target.color !== forColor && 
                 BOT_PIECE_VALUES[target.type] >= 300;
        });
        
        if (highValueTargets.length >= 2) {
          patterns.push({
            type: 'FORK',
            piece: {r, c},
            forkSquare: {r: move.r, c: move.c},
            targets: highValueTargets,
            value: highValueTargets.reduce((sum, t) => 
              sum + BOT_PIECE_VALUES[state.board[t.r][t.c].type], 0),
            powerEnhancement: 'FORTIFY', // Shield the forking piece
            enhancedValue: 800
          });
        }
      }
    }
  }
  
  // Pattern 2: Pin detection
  patterns.push(...detectPins(state, forColor));
  
  // Pattern 3: Skewer detection
  patterns.push(...detectSkewers(state, forColor));
  
  // Pattern 4-10: More patterns...
  
  return patterns;
}

function detectPins(state, forColor) {
  const pins = [];
  
  // Find all our long-range pieces (Rook, Bishop, Queen)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece || piece.color !== forColor) continue;
      if (![PIECE.ROOK, PIECE.BISHOP, PIECE.QUEEN].includes(piece.type)) continue;
      
      // Check all directions
      const directions = piece.type === PIECE.ROOK ? 
        [[1,0],[-1,0],[0,1],[0,-1]] :
        piece.type === PIECE.BISHOP ?
        [[1,1],[1,-1],[-1,1],[-1,-1]] :
        [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      
      for (const [dr, dc] of directions) {
        let pinnedPiece = null;
        let behindPiece = null;
        
        for (let i = 1; i < 8; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (!inBounds(nr, nc)) break;
          
          const target = state.board[nr][nc];
          if (!target) continue;
          
          if (!pinnedPiece) {
            if (target.color !== forColor) pinnedPiece = {r: nr, c: nc, piece: target};
          } else if (!behindPiece) {
            if (target.color !== forColor) {
              behindPiece = {r: nr, c: nc, piece: target};
              
              // Check if behind piece is more valuable
              if (BOT_PIECE_VALUES[behindPiece.piece.type] > 
                  BOT_PIECE_VALUES[pinnedPiece.piece.type]) {
                pins.push({
                  type: 'PIN',
                  attacker: {r, c},
                  pinned: pinnedPiece,
                  behind: behindPiece,
                  value: BOT_PIECE_VALUES[behindPiece.piece.type],
                  powerEnhancement: 'IMPRISON', // Imprison the pinned piece
                  enhancedValue: BOT_PIECE_VALUES[behindPiece.piece.type] + 100
                });
              }
            }
            break;
          }
        }
      }
    }
  }
  
  return pins;
}
```

### Step 3: Threat Calculator

```javascript
function calculateThreats(state, forColor) {
  const opp = opposite(forColor);
  const threats = [];
  
  // Check opponent's aether level
  const oppAether = state.mana[opp];
  
  // Threat 1: Vengeance on our Queen
  if (oppAether >= 18) {
    const ourQueen = findPiece(state.board, forColor, PIECE.QUEEN);
    if (ourQueen) {
      threats.push({
        type: 'VENGEANCE_THREAT',
        target: ourQueen,
        probability: oppAether >= 20 ? 0.8 : 0.5,
        impact: -900,
        counter: 'MOVE_QUEEN_TO_SAFETY'
      });
    }
  }
  
  // Threat 2: Double Attack fork
  if (oppAether >= 14) {
    const oppPieces = findAllPieces(state.board, opp);
    for (const oppPiece of oppPieces) {
      const moves = legalMoves(state.board, oppPiece.r, oppPiece.c, state);
      for (const move of moves) {
        if (!move.capture) continue;
        
        // Simulate opponent capturing
        const snap = snapshot(state.board);
        state.board[move.r][move.c] = oppPiece.piece;
        state.board[oppPiece.r][oppPiece.c] = null;
        
        const secondCaptures = legalMoves(state.board, move.r, move.c, state)
          .filter(m => m.capture);
        
        restore(state.board, snap);
        
        if (secondCaptures.length > 0) {
          const totalValue = BOT_PIECE_VALUES[state.board[move.r][move.c].type] +
                           BOT_PIECE_VALUES[state.board[secondCaptures[0].r][secondCaptures[0].c].type];
          threats.push({
            type: 'DOUBLE_ATTACK_THREAT',
            probability: 0.7,
            impact: -totalValue,
            counter: 'MOVE_PIECES_APART'
          });
        }
      }
    }
  }
  
  // Threat 3: Imprison + Capture
  // ... more threats
  
  return threats.sort((a, b) => 
    (b.probability * b.impact) - (a.probability * a.impact)
  );
}
```

### Step 4: Learning System

```javascript
// Persistent database (save to file)
let TACTICAL_DB = {
  positions: {},
  patterns: {},
  powerEffectiveness: {}
};

function recordGameOutcome(gameHistory, winner, loser) {
  // Analyze critical positions
  for (let i = 0; i < gameHistory.length; i++) {
    const position = gameHistory[i];
    const hash = hashPosition(position.board, position.currentPlayer);
    
    if (!TACTICAL_DB.positions[hash]) {
      TACTICAL_DB.positions[hash] = {
        seen: 0,
        powerChoices: {},
        outcomes: { win: 0, lose: 0, draw: 0 }
      };
    }
    
    const entry = TACTICAL_DB.positions[hash];
    entry.seen++;
    
    if (position.powerUsed) {
      if (!entry.powerChoices[position.powerUsed]) {
        entry.powerChoices[position.powerUsed] = { used: 0, winRate: 0 };
      }
      entry.powerChoices[position.powerUsed].used++;
    }
    
    // Record outcome
    if (position.currentPlayer === winner) {
      entry.outcomes.win++;
    } else if (position.currentPlayer === loser) {
      entry.outcomes.lose++;
    }
  }
  
  // Save to disk
  saveTacticalDB(TACTICAL_DB);
}

function consultTacticalDB(state, forColor) {
  const hash = hashPosition(state.board, forColor);
  const entry = TACTICAL_DB.positions[hash];
  
  if (!entry || entry.seen < 3) return null; // Not enough data
  
  // Find best power from historical data
  let bestPower = null;
  let bestWinRate = 0;
  
  for (const [power, data] of Object.entries(entry.powerChoices)) {
    const winRate = data.used > 0 ? 
      (entry.outcomes.win / entry.seen) : 0;
    if (winRate > bestWinRate) {
      bestWinRate = winRate;
      bestPower = power;
    }
  }
  
  return bestPower;
}
```

---

## Expected Improvements

### Before Phase 3
- Double Attack: 0/game
- Imprison: 0/game
- Tactical patterns: None recognized
- Multi-move planning: None

### After Phase 3 (Projected)
- Double Attack: 2-4/game ✅
- Imprison: 2-3/game ✅
- Tactical patterns: 10+ recognized per game
- Multi-move combos: 5+ per game
- Power diversity: 7-8 powers
- Win rate vs humans: +40%

---

## Implementation Priority

### High Priority (Implement First)
1. ✅ Tactical Pattern Detector (Fork, Pin, Skewer)
2. ✅ Threat Calculator (3-move lookahead)
3. ✅ Multi-move Combo Generator (2-move sequences)

### Medium Priority
4. ⏳ Learning System (position database)
5. ⏳ Opening Book (5-move sequences)

### Low Priority (Polish)
6. ⏳ Advanced patterns (Zugzwang, Breakthrough)
7. ⏳ 4+ move combo sequences
8. ⏳ Endgame tablebase

---

## Next Steps

Let me implement these systems now, starting with:
1. **Tactical Pattern Library** - 10+ patterns
2. **Threat Evaluation** - Multi-move analysis  
3. **Combo Generator** - 2-3 move sequences
4. **Pattern Recognition** - Fork/Pin/Skewer detection

This will make the bot MUCH smarter!
