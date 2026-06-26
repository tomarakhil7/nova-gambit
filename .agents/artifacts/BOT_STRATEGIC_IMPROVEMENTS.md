# Bot Strategic Improvements - Phase 2

## Current Bot Weaknesses (User Feedback)

1. **Doesn't play for aether generation**
   - Ignores center control (worth +1 aether/turn)
   - Ignores fountain squares (worth +2 aether each/turn)
   - Doesn't prioritize aether economy

2. **Makes senseless trades**
   - Trades pieces without evaluating aether impact
   - Doesn't consider material vs aether balance

3. **Hoards aether for Vengeance**
   - Waits for 18 aether to cast Vengeance
   - Misses opportunities for cheaper, stronger combos

4. **Doesn't use power combos**
   - Shield (14) + Attack = protected aggression
   - Double Attack (14) = kill 2 pieces or break shield + capture
   - Imprison (14) + pressure = remove defender

5. **Lacks strategic diversity**
   - Predictable power usage
   - Doesn't adapt to game state

---

## Solution: Multi-Layered Bot Improvements

### Layer 1: Aether Economy Awareness (CRITICAL)

#### A. Center Control Bonus
**Current**: Bot has PST bonus for center (~10-25 points)
**Problem**: Not enough to compete with material value

**Fix**:
```javascript
// In evaluatePosition, add after material count:

// AETHER GENERATION TERRITORY BONUS
let aetherGenBonus = 0;

// Center control (d4, d5, e4, e5)
const centerSquares = [{r:4,c:3},{r:4,c:4},{r:3,c:3},{r:3,c:4}];
let myCenterPieces = 0, oppCenterPieces = 0;
for (const sq of centerSquares) {
  const p = state.board[sq.r][sq.c];
  if (!p || p.isSpectral) continue;
  if (p.color === forColor) myCenterPieces++;
  else oppCenterPieces++;
}
if (myCenterPieces > oppCenterPieces) {
  aetherGenBonus += 150; // Worth 1.5 pawns - very strong!
}

// Fountain control (each fountain = +2 aether/turn in late game)
let myFountains = 0, oppFountains = 0;
for (const f of state.fountains) {
  const p = state.board[f.r][f.c];
  if (p && !p.isSpectral) {
    if (p.color === forColor) myFountains++;
    else oppFountains++;
  }
}
const fountainDiff = myFountains - oppFountains;
aetherGenBonus += fountainDiff * 200; // Each fountain worth 2 pawns!

score += aetherGenBonus;
```

**Why this works**:
- Center = +1 aether/turn = +10 aether by turn 10 = ~500 points value
- Fountain = +2 aether/turn = +20 aether by turn 10 = ~1000 points value
- Makes bot FIGHT for these squares

---

#### B. Aether Reserve Value
**Current**: Bot values current material, ignores aether bank
**Problem**: Doesn't recognize that aether IS power

**Fix**:
```javascript
// In evaluatePosition, after piece values:

// AETHER BANK VALUE
// Each aether point is worth ~10-15 points (can be spent on powers)
const myAether = state.mana[forColor];
const oppAether = state.mana[opp];

// Aether has diminishing returns (first 10 points worth more than last 10)
function aetherValue(a) {
  if (a <= 10) return a * 20; // Early aether very valuable
  if (a <= 20) return 200 + (a-10) * 15; // Mid aether valuable
  return 350 + (a-20) * 10; // Late aether less valuable (capped soon)
}

const aetherAdvantage = aetherValue(myAether) - aetherValue(oppAether);
score += aetherAdvantage;
```

**Example**:
- Bot at 15 aether, opponent at 5 aether
- Difference: (200 + 5*15) - (5*20) = 275 - 100 = 175 points
- Worth almost 2 pawns! Bot should PROTECT this advantage

---

### Layer 2: Smart Trading (Material vs Aether)

#### Trade Evaluation Formula
**Current**: Bot only looks at material value
**Problem**: Doesn't consider aether cost of recovering lost material

**Fix**:
```javascript
function evaluateTrade(myPiece, theirPiece, myAether, oppAether) {
  const myMaterialLoss = BOT_PIECE_VALUES[myPiece.type];
  const theirMaterialLoss = BOT_PIECE_VALUES[theirPiece.type];
  const materialDiff = theirMaterialLoss - myMaterialLoss;
  
  // Aether impact: losing piece hurts less if you're high on aether
  // (can use powers to compensate)
  let aetherCompensation = 0;
  if (myAether >= 20) {
    aetherCompensation = 50; // Have resources for powers
  }
  if (myAether >= 28) {
    aetherCompensation = 100; // Can afford any power
  }
  
  // Opponent's aether threat: trading down is good if opponent is high on aether
  // (removes their targets for Vengeance/Double Attack)
  let aetherThreat = 0;
  if (oppAether >= 18 && myPiece.type === PIECE.QUEEN) {
    aetherThreat = -150; // They can Vengeance your Queen!
  }
  if (oppAether >= 14 && theirPiece.type === PIECE.QUEEN) {
    aetherThreat = 100; // Remove their Queen before they shield it
  }
  
  return materialDiff + aetherCompensation + aetherThreat;
}

// Use in move evaluation:
// if (move.capture) {
//   const tradeValue = evaluateTrade(piece, target, myAether, oppAether);
//   if (tradeValue < -100) continue; // Skip bad trades
// }
```

**Example**:
- Trade Knight (320) for Bishop (330) when you have 28 aether
- Material: +10 points (slightly good)
- Aether compensation: +100 (you can use powers)
- Result: +110 → TAKE THE TRADE

- Trade Knight (320) for Bishop (330) when opponent has 20 aether
- Material: +10
- Aether threat: +50 (opponent has fewer targets now)
- Result: +60 → TAKE THE TRADE

---

### Layer 3: Power Combo System

#### Combo Priority Matrix

| Combo | Cost | Situation | Priority | Effectiveness |
|-------|------|-----------|----------|---------------|
| **Shield + Attack** | 14 + 0 | Threaten key piece | HIGH | 80% |
| **Double Attack + Any** | 14 | 2 captures available | VERY HIGH | 90% |
| **Imprison + Attack** | 14 + 0 | Remove defender | HIGH | 85% |
| **Cleanse + Activate** | 14 + 0 | Free own frozen piece | MEDIUM | 70% |
| **Frost + Capture** | 8 + 0 | Freeze, then take | MEDIUM | 75% |
| **Aether Block + Attack** | 16 + 0 | Deny counter-play | LOW | 60% |

**Implementation**:
```javascript
function evaluatePowerCombo(state, power1, power2, forColor) {
  // Shield + Attack combo
  if (power1 === POWER.FORTIFY) {
    // After shielding, check if we have profitable attacks
    const shieldedPiece = findBestShieldTarget(state, forColor);
    if (shieldedPiece) {
      const attacks = legalMoves(state.board, shieldedPiece.r, shieldedPiece.c, state);
      const profitableAttacks = attacks.filter(m => {
        const target = state.board[m.r][m.c];
        return target && BOT_PIECE_VALUES[target.type] >= 300;
      });
      if (profitableAttacks.length > 0) {
        return { combo: 'SHIELD_ATTACK', priority: 150, moves: profitableAttacks };
      }
    }
  }
  
  // Double Attack combo (ALWAYS HIGH PRIORITY)
  if (power1 === POWER.DOUBLE_ATTACK) {
    // Find pieces that can capture twice
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p || p.color !== forColor) continue;
        
        const moves = legalMoves(state.board, r, c, state);
        const captures = moves.filter(m => m.capture);
        
        if (captures.length >= 2) {
          // Can capture 2 pieces in one turn!
          return { combo: 'DOUBLE_ATTACK', priority: 200, from: {r,c}, targets: captures };
        }
        
        // Or: break shield + capture
        const shieldedTargets = captures.filter(m => {
          const target = state.board[m.r][m.c];
          return target && target.shieldHP > 0;
        });
        if (shieldedTargets.length > 0) {
          return { combo: 'DOUBLE_ATTACK_SHIELD', priority: 180, from: {r,c}, targets: shieldedTargets };
        }
      }
    }
  }
  
  // Imprison + Attack combo
  if (power1 === POWER.IMPRISON) {
    // Find defenders we can imprison
    const defenders = findDefenders(state, forColor);
    for (const defender of defenders) {
      const protecting = findProtectedPieces(state, defender);
      if (protecting.some(p => BOT_PIECE_VALUES[p.type] >= 500)) {
        return { combo: 'IMPRISON_ATTACK', priority: 160, target: defender, followup: protecting };
      }
    }
  }
  
  return null;
}
```

---

### Layer 4: Anti-Vengeance-Hoarding

**Current Problem**: Bot saves 18+ aether for Vengeance, sits passive

**Fix**: Dynamic power selection based on situation

```javascript
function choosePowerByGameState(state, aether, forColor) {
  const opp = opposite(forColor);
  const myKing = findKing(state.board, forColor);
  const oppKing = findKing(state.board, opp);
  
  // OFFENSIVE PRIORITY (ahead in material, push advantage)
  const materialAdvantage = calculateMaterialAdvantage(state, forColor);
  if (materialAdvantage > 300) {
    // We're winning - use aether aggressively
    if (aether >= 14) {
      // Double Attack (14) > Imprison (14) > Fortify (14)
      const daCombo = evaluatePowerCombo(state, POWER.DOUBLE_ATTACK, null, forColor);
      if (daCombo) return { power: POWER.DOUBLE_ATTACK, priority: 200 };
      
      const imprisonCombo = evaluatePowerCombo(state, POWER.IMPRISON, null, forColor);
      if (imprisonCombo) return { power: POWER.IMPRISON, priority: 180 };
    }
  }
  
  // DEFENSIVE PRIORITY (behind in material, stabilize)
  if (materialAdvantage < -200) {
    // We're losing - focus on survival and counter-play
    if (aether >= 18 && hasHighValueTarget(state, opp)) {
      return { power: POWER.VENGEANCE, priority: 180 };
    }
    if (aether >= 16) {
      return { power: POWER.AETHER_BLOCK, priority: 160 }; // Deny their powers
    }
    if (aether >= 14) {
      const bestShield = findCriticalPieceToShield(state, forColor);
      if (bestShield) return { power: POWER.FORTIFY, priority: 150 };
    }
  }
  
  // TACTICAL PRIORITY (even game, look for tactical shots)
  if (Math.abs(materialAdvantage) <= 200) {
    // Balanced position - use powers tactically
    if (aether >= 14) {
      // Try Double Attack first
      const daTargets = findDoubleAttackTargets(state, forColor);
      if (daTargets.length >= 2) {
        return { power: POWER.DOUBLE_ATTACK, priority: 190 };
      }
      
      // Try Imprison on key defenders
      const keyDefenders = findKeyDefenders(state, forColor);
      if (keyDefenders.length > 0) {
        return { power: POWER.IMPRISON, priority: 170 };
      }
    }
  }
  
  // DEFAULT: Don't hoard - spend at 20+ aether
  if (aether >= 20) {
    // Sitting on too much aether - SPEND IT!
    if (aether >= 20 && canChronobreak(state, forColor)) {
      return { power: POWER.CHRONOBREAK, priority: 150 };
    }
    if (aether >= 18) {
      return { power: POWER.VENGEANCE, priority: 140 };
    }
    if (aether >= 16) {
      return { power: POWER.AETHER_BLOCK, priority: 130 };
    }
    if (aether >= 15) {
      return { power: POWER.PROMOTE, priority: 160 };
    }
    if (aether >= 14) {
      return { power: POWER.DOUBLE_ATTACK, priority: 170 };
    }
  }
  
  return null;
}
```

**Key Principle**: **Don't save aether past 20-25** - you're wasting potential!

---

### Layer 5: Fountain & Center Fighting

#### Position Evaluation Weights (NEW)

```javascript
const STRATEGIC_WEIGHTS = {
  // Aether generation
  CENTER_CONTROL: 150,        // +1 aether/turn
  FOUNTAIN_CONTROL: 200,      // +2 aether/turn per fountain
  AETHER_ADVANTAGE: 15,       // per point of aether lead (up to 20)
  
  // Power readiness
  POWER_THREAT_READY: 100,    // Have aether for Vengeance/Chronobreak
  POWER_COMBO_READY: 80,      // Have aether for Double Attack + follow-up
  
  // Defensive
  PROTECTED_FOUNTAIN: 50,     // Fountain square defended
  PROTECTED_CENTER: 30,       // Center square defended
  
  // Aggressive
  ATTACK_FOUNTAIN: 120,       // Threaten opponent's fountain piece
  ATTACK_CENTER: 80,          // Threaten opponent's center piece
};
```

#### Move Ordering for Strategic Squares

```javascript
function enhancedMoveOrdering(moves, state, forColor) {
  return moves.map(m => {
    let bonus = 0;
    
    // Landing on fountain
    if (state.fountains.some(f => f.r === m.to.r && f.c === m.to.c)) {
      bonus += 300; // Very high priority
    }
    
    // Landing on center
    const centerSquares = [{r:4,c:3},{r:4,c:4},{r:3,c:3},{r:3,c:4}];
    if (centerSquares.some(s => s.r === m.to.r && s.c === m.to.c)) {
      bonus += 200;
    }
    
    // Capturing piece on fountain/center (even better!)
    if (m.capture) {
      const target = state.board[m.to.r][m.to.c];
      if (state.fountains.some(f => f.r === m.to.r && f.c === m.to.c)) {
        bonus += 400; // Kick them off fountain!
      }
      if (centerSquares.some(s => s.r === m.to.r && s.c === m.to.c)) {
        bonus += 300; // Kick them out of center!
      }
    }
    
    return { ...m, strategicBonus: bonus };
  }).sort((a, b) => (b.strategicBonus || 0) - (a.strategicBonus || 0));
}
```

---

## Implementation Priority

### Phase 1: Critical Fixes (DO FIRST)
1. ✅ Fix all 7 bugs (DONE)
2. **Add aether economy evaluation** (Layer 1A, 1B)
3. **Fix center/fountain prioritization** (Layer 5)

### Phase 2: Strategic Depth
4. **Add trade evaluation** (Layer 2)
5. **Implement power combo system** (Layer 3)
6. **Fix Vengeance hoarding** (Layer 4)

### Phase 3: Fine-Tuning
7. Test bot vs bot (100 games)
8. Adjust weights based on win rate
9. Add opening book for aether generation
10. Implement adaptive difficulty

---

## Expected Impact

### Before Fixes
- Bot ignores fountains
- Bot makes equal trades mindlessly
- Bot hoards 25+ aether waiting for Vengeance
- Bot doesn't use Shield + Attack combos
- Win rate: ~40% vs smart human

### After Fixes
- Bot fights for center & fountains
- Bot evaluates trades with aether in mind
- Bot uses 14-aether powers aggressively
- Bot chains powers (Shield → Attack, Imprison → Attack)
- Win rate: ~65-70% vs smart human

---

## Testing Plan

### Test 1: Aether Economy
- Set up game with fountains
- Bot should prioritize occupying fountains
- Bot should defend fountain squares
- Bot should attack opponent's fountain pieces

### Test 2: Center Control
- Opening game
- Bot should fight for d4/d5/e4/e5
- Bot should value center more than edge pieces

### Test 3: Power Diversity
- Run 50 bot games
- Track power usage:
  - Fortify: 2-4 times per game (not 0)
  - Double Attack: 3-6 times per game (not 0-1)
  - Imprison: 2-5 times per game
  - Vengeance: 1-2 times per game (not 5+)
  - Aether Block: 1-3 times per game

### Test 4: No Hoarding
- Track aether levels throughout game
- Bot should rarely exceed 25 aether
- Bot should use powers at 14-20 aether

---

## Commit Messages

```
feat(bot): Add aether economy awareness
- Value center control (+150 points)
- Value fountain control (+200 per fountain)
- Include aether bank in position evaluation

feat(bot): Implement smart trading system
- Evaluate trades with aether compensation
- Consider opponent's aether threat level
- Avoid bad trades when low on aether

feat(bot): Add power combo system
- Shield + Attack combo detection
- Double Attack priority when 2+ captures
- Imprison + Attack on defenders

fix(bot): Remove Vengeance hoarding behavior
- Use 14-aether powers at appropriate times
- Spend aether above 20 threshold
- Dynamic power selection by game state

feat(bot): Enhance strategic square awareness
- Prioritize fountain occupation in move ordering
- Prioritize center control in opening
- Bonus for capturing pieces on strategic squares
```

---

*This addresses all user feedback: aether positioning, avoiding bad trades, not hoarding for Vengeance, using power combos, and strategic diversity.*
