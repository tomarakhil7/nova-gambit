# Bot Training Recommendations

Based on human game analysis and bug fixes, here are specific improvements to make the bot stronger.

## 1. Discovery Check Recognition

### Current Gap
Bot may not recognize when removing a piece (via sacrifice, Imprison, or capture) creates a discovery check.

### Training Data Needed
Create positions where:
```
White Bishop on a1 → diagonal → Black King a5
Black Pawn on a3 (blocking)
White can capture/sacrifice/Imprison the pawn
Result: Discovery check on Black King
```

### Evaluation Function Addition
```javascript
function evaluateDiscoveryCheck(state, color) {
  // After each potential move, check if it creates discovery check
  // Discovery checks are tactically strong - bonus points
  
  const opp = opposite(color);
  
  // For each piece removal (capture, sacrifice, Imprison):
  // 1. Simulate removal
  // 2. Check if opponent king is in check
  // 3. If yes, identify the discovering piece
  // 4. Add bonus based on discovered piece value
  
  return discoveryCheckBonus; // +50 to +200 depending on discovered piece
}
```

### Bot Improvement
- Recognize sacrifice → discovery check as a forcing move
- Prioritize Imprison on pieces that block checks
- Don't immediately make another move after discovery - turn passes now (Bug #3 fix)

---

## 2. Power Usage Patterns (New Costs)

### Cost Changes Impact

| Power | Old | New | Δ | Strategic Change |
|-------|-----|-----|---|------------------|
| Fortify | 7 | 14 | +100% | Much more expensive - save for critical pieces |
| Aether Block | 10 | 16 | +60% | Major investment - use when opponent has 20+ aether |
| Double Attack | 12 | 14 | +17% | Slight increase - still strong tactical option |

### Bot Strategy Updates

#### Fortify (14 aether)
**Old strategy**: Shield any valuable piece when affordable
**New strategy**: 
- Only shield when:
  - Piece is critical (Queen, advanced Rook)
  - Opponent threatens immediate capture
  - You have 20+ aether (can afford follow-up)
- Don't shield pawns unless:
  - Passed pawn on 6th/7th rank
  - Pawn holds imprisoned piece

#### Aether Block (16 aether)
**Old strategy**: Block when opponent has 12+ aether
**New strategy**:
- Only block when:
  - Opponent has 18+ aether (can afford Vengeance/Chronobreak)
  - You're ahead and want to deny counter-play
  - Opponent is one power away from lethal combo
- Consider alternatives:
  - Imprison opponent's key piece instead (14 aether)
  - Double Attack to remove threats (14 aether)

#### Double Attack (14 aether)
**Old strategy**: Use for tactical two-move combinations
**New strategy**:
- High priority when:
  - Can break shield + capture (Bug #6 fix)
  - Can capture + give check
  - Can capture + escape danger
- Works even with imprisoned piece now (Bug #2 fix)
- Calculate both moves before committing

### Evaluation Weight Changes
```javascript
// Old weights
FORTIFY_VALUE: 150,
AETHER_BLOCK_VALUE: 180,
DOUBLE_ATTACK_VALUE: 250,

// New weights (adjusted for cost)
FORTIFY_VALUE: 200,        // More expensive = higher bar to use
AETHER_BLOCK_VALUE: 240,   // Major strategic investment
DOUBLE_ATTACK_VALUE: 280,  // Still strong, slight premium
```

---

## 3. Shielded Piece Interactions

### New Mechanic: Double Hit on Shield
With Bug #6 fix, bot can now:
1. First Double Attack move: break shield (stay in place)
2. Second Double Attack move: capture same piece

### Training Scenarios
```
Position: White Queen d4, Black Knight e5 (shielded, 1 HP)
Old: Queen attacks e5, shield breaks, Queen bounces back to d4, Knight survives
New: Double Attack d4→e5 (break shield) → e5 (capture Knight)
Cost: 14 aether
Value: Removes shielded piece in one turn
```

### Evaluation Function
```javascript
function evaluateDoubleAttackOnShield(state, from, target) {
  const piece = state.board[target.r][target.c];
  
  if (piece && piece.shieldHP > 0) {
    // Check if Double Attack can hit twice
    const firstHitBreaksShield = (piece.shieldHP === 1);
    const canReachAgain = legalMoves(board, from.r, from.c).includes(target);
    
    if (firstHitBreaksShield && canReachAgain) {
      // High value: removes shielded piece in one power
      return piece.value + 100; // e.g., Knight (300) + bonus = 400
    }
  }
  
  return 0;
}
```

---

## 4. Imprison + Double Attack Combos

### Bug #2 Fix: Captors Can Double Attack

**New combo available**:
```
Turn 1: Imprison enemy piece with Knight (14 aether)
Turn 2: Knight (holding prisoner) uses Double Attack (14 aether)
Result: Knight makes two attacks while carrying prisoner
```

### When This Is Strong
- Knight imprison a defensive piece (blocks your attack)
- Next turn, Knight double-attacks to capture 2 more pieces
- Opponent must either: recapture Knight (frees 3 pieces) or ignore (loses 2 more pieces)

### Evaluation
```javascript
function evaluateCaptorAttackPotential(state, captorPos) {
  const captor = state.board[captorPos.r][captorPos.c];
  
  if (!captor.imprisoned) return 0;
  
  // Captor holding prisoner can still attack
  // Check if Double Attack available next turn
  const attacks = legalMoves(state.board, captorPos.r, captorPos.c, state);
  const captures = attacks.filter(m => m.capture);
  
  if (captures.length >= 2 && state.mana[captor.color] >= 14) {
    return 150; // Bonus for captor with Double Attack potential
  }
  
  return 50; // Small bonus for captor mobility
}
```

---

## 5. Spectral Pawn Timing

### Bug #4 Fix: Shorter Duration

**Old**: Spawn turn N → expires turn N+2 (lives through opponent's turn)
**New**: Spawn turn N → expires turn N+1 (vanishes at your next turn start)

### Strategic Impact
- Spectral pawns are now **more urgent** for opponent to deal with
- Use for **immediate threats** only (not long-term blocking)
- Best uses:
  1. Block check this turn
  2. Create fork/pin this turn
  3. Defend key square until your next turn
- Avoid: Spawning for "future defense" (it'll be gone)

### Bot Timing Adjustment
```javascript
function evaluateSpectralPawnValue(state, pos) {
  // Only positive value if it accomplishes something THIS turn
  
  const checksOpponent = givesCheck(state, pos);
  const blocksCheck = resolvesCheck(state, pos);
  const forksMultiplePieces = countForks(state, pos) >= 2;
  const defendsKeySquare = protectsHighValuePiece(state, pos);
  
  if (checksOpponent) return 150;
  if (blocksCheck) return 200;
  if (forksMultiplePieces) return 180;
  if (defendsKeySquare) return 100;
  
  // Spawn for positional play is now MUCH weaker
  return 20; // Minimal value if no immediate impact
}
```

---

## 6. Aether Block Efficiency

### Bug #5 Fix: Blocks Aether GAIN Too

**Old**: Opponent can't spend aether next turn (can still gain)
**New**: Opponent gains 0 aether AND can't spend

### Increased Value
```
Opponent at 28/30 aether, controls center, on 2 fountains
Old block: Opponent gains 1+1+4=6 → 30/30 aether (capped, but maxed)
New block: Opponent gains 0 → 28/30 aether
```

One turn of blocked generation can be worth **6+ aether** late game!

### When To Block
```javascript
function evaluateAetherBlock(state, oppColor) {
  const oppAether = state.mana[oppColor];
  const oppGainNextTurn = calculateAetherGain(state, oppColor);
  
  // High value if:
  // 1. Opponent close to expensive power (Chronobreak 20, Vengeance 18)
  // 2. Denying gain is significant (5+ aether/turn)
  
  const deniesExpensivePower = (oppAether >= 18 && oppAether < 20);
  const denie sHighGain = (oppGainNextTurn >= 5);
  
  if (deniesExpensivePower) return 300; // Critical timing
  if (deniesHighGain) return oppGainNextTurn * 30; // Value scaled to gain denied
  
  return 100; // Base value for tempo
}
```

---

## 7. Cleanse Multi-Target

### Cleanse Can Remove: Frost + Imprison + Shield

From human games: "Cleanse on Pawn at h5: freed prisoner"

Bot should recognize Cleanse can target:
1. **Opponent's captor** → frees YOUR prisoner (gets your piece back)
2. **Your frozen piece** → unfreezes it (can move again)
3. **Opponent's shielded piece** → removes shield (can capture cleanly)

### Cleanse Priority
```javascript
function evaluateCleanseTarget(state, target) {
  const piece = state.board[target.r][target.c];
  
  let value = 0;
  
  // Freeing own imprisoned piece
  if (piece.imprisoned && piece.imprisoned.color === state.turn) {
    value += piece.imprisoned.value; // Get your piece back
  }
  
  // Unfreezing own piece
  if (piece.frozenUntil && piece.color === state.turn) {
    value += piece.value * 0.3; // Regain mobility
  }
  
  // Removing opponent's shield
  if (piece.shieldHP > 0 && piece.color !== state.turn) {
    value += 100; // Can capture next turn
  }
  
  return value;
}
```

Best use: Cleanse opponent's captor → your piece returns → immediate counter-attack

---

## 8. Turn Passing Awareness

### Discovery Check Passes Turn (Bug #3)

**Critical for bot**: After sacrifice/Imprison that creates discovery check, turn passes IMMEDIATELY.

```javascript
function evaluateActionWithTurnPass(state, action) {
  // Simulate action
  const result = simulateAction(state, action);
  
  if (result.passedTurn) {
    // Turn passed - you DON'T get another move
    // Evaluate as if opponent moves next
    
    // Penalty if you wanted to follow up
    // Bonus if opponent is in bad position
    
    const oppInCheck = isInCheck(result.state, opposite(state.turn));
    
    if (oppInCheck) {
      return 200; // Discovery check is strong
    } else {
      return -50; // Lost tempo
    }
  }
  
  return 0;
}
```

**Don't**: Sacrifice → plan to Promote next
**Do**: Sacrifice → if discovery check, opponent must respond

---

## 9. Cost-Benefit Analysis

### Aether Efficiency Table

| Action | Cost | Typical Value | Efficiency |
|--------|------|---------------|------------|
| Pawn sacrifice | -1 aether | ~100 points | Poor |
| Knight sacrifice | -2 aether | ~300 points | Poor |
| Bishop sacrifice | -2 aether | ~300 points | Poor |
| Rook sacrifice | -4 aether | ~500 points | Poor |
| Queen sacrifice | -6 aether | ~900 points | Poor |
| Spawn (6) | 6 | ~100 points | Poor |
| Frost (8) | 8 | ~100-200 | Okay |
| Fortify (14) | 14 | ~150-300 | Okay |
| Imprison (14) | 14 | ~300-500 | Good |
| Cleanse (14) | 14 | ~200-400 | Good |
| Double Attack (14) | 14 | ~400-700 | Strong |
| Promote (15) | 15 | ~800+ | Strong |
| Aether Block (16) | 16 | ~200-350 | Okay |
| Vengeance (18) | 18 | ~300-500 | Good |
| Wall (18) | 18 | ~200-400 | Okay |
| Chronobreak (20) | 20 | ~500-1000 | Situational |

### Bot Decision Priority
1. **High efficiency**: Double Attack, Promote, Imprison
2. **Situational**: Vengeance (remove key piece), Chronobreak (undo lethal)
3. **Defensive**: Fortify (expensive now), Aether Block (denies 20-aether plays)
4. **Low priority**: Spawn (short duration), Wall (passive), sacrifices (lose material)

---

## 10. Human Game Patterns

### Winning Patterns
From game analysis:

1. **Early Imprison → Late game advantage**
   - Imprison opponent's minor piece
   - Hold prisoner through midgame
   - Opponent must recapture or play down material

2. **Fortify Queen → Aggressive play**
   - Shield Queen with Fortify
   - Queen raids with 1-attack immunity
   - Must kill Queen twice to remove

3. **Double Attack finishes**
   - Capture + Checkmate in two moves
   - Break shield + Capture key defender

4. **Aether Block denial**
   - Block when opponent at 19-20 aether
   - Prevents Chronobreak/Vengeance
   - Creates tempo advantage

### Losing Patterns
What NOT to do:

1. **Premature Sacrifice**
   - Sacrificing material before aether pays off
   - Sacrifice should lead to immediate power or attack

2. **Wasteful Spawns**
   - Spawning Spectral pawns without immediate purpose
   - Remember: they vanish next turn (Bug #4 fix)

3. **Ignoring Discovery Checks**
   - Not recognizing when opponent can create discovery check
   - Leaving pieces in discovery check lines

4. **Poor Chronobreak timing**
   - Using Chronobreak when opponent's turn wasn't critical
   - Should save for undoing lethal attacks

---

## Implementation Priority

### Phase 1: Core Fixes (This Release)
- [x] Fix all 7 bugs
- [x] Update power costs in bot evaluation
- [x] Test discovery check turn passing

### Phase 2: Evaluation Improvements
- [ ] Add discovery check bonus (evaluateDiscoveryCheck)
- [ ] Update power value weights for new costs
- [ ] Improve Double Attack on shielded pieces evaluation
- [ ] Add Spectral pawn urgency check

### Phase 3: Strategic Depth
- [ ] Aether Block timing vs opponent aether level
- [ ] Cleanse multi-target optimization
- [ ] Imprison + Double Attack combo recognition
- [ ] Chronobreak value calculation

### Phase 4: Learning from Games
- [ ] Parse human game logs
- [ ] Extract winning move sequences
- [ ] Build opening book for first 10 moves
- [ ] Endgame tablebase for Kings + 1-2 pieces

---

## Testing Methodology

### Bot vs Bot Games
Run 100 games:
- Hard vs Hard (both using bug fixes)
- Record: win rate, average aether at end, power usage frequency
- Compare to previous version

### Specific Scenarios
Test each bug fix:
1. Give bot shielded piece + Double Attack aether → should attack twice
2. Give bot imprisoned captor + Double Attack aether → should attack
3. Set up discovery check scenario → bot should recognize and use
4. Spawn Spectral pawn → verify bot knows it expires turn+1
5. Opponent has 20+ aether → bot should consider Aether Block

### Human vs Bot
Play 10 games:
- Try to trigger each bug scenario
- Record if bot responds correctly
- Note any unexpected behavior

---

## Metrics to Track

### Power Usage Frequency
Before and after fixes:
```
Fortify: X → Y times per game (should decrease - more expensive)
Aether Block: A → B times per game (should decrease - more expensive)
Double Attack: M → N times per game (should stay same or increase)
```

### Aether Efficiency
```
Average aether spent per win: X
Average aether remaining at checkmate: Y
Power-to-material conversion rate: Z
```

### Tactical Sharpness
```
Discovery checks per game: X (should increase)
Shielded pieces killed via Double Attack: Y (should increase)
Successful Imprison → Double Attack combos: Z (should exist now)
```

---

*Use this document to guide bot improvements and measure impact of bug fixes.*
