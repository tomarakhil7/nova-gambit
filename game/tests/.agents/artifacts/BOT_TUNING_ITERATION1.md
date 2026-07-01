# Bot Tuning - Iteration 1

## Initial Test Results (5 games, hard vs hard)

### Power Usage - BEFORE Tuning
```
White:
  PROMOTE        27 casts (5.4/game)
  VENGEANCE      5 casts (1.0/game)
  FROST          3 casts (0.6/game)
  AETHER_BLOCK   3 casts (0.6/game)
  FORTIFY        1 casts (0.2/game)

Black:
  PROMOTE        27 casts (5.4/game)
  FROST          9 casts (1.8/game)
  VENGEANCE      9 casts (1.8/game)
```

### Issues Identified
1. ❌ **NO DOUBLE ATTACK** - Never used despite being priority power
2. ❌ **NO IMPRISON** - Never used despite tactical value
3. ❌ **NO CLEANSE, BLINK, WALL** - Completely unused
4. ❌ **Very low FORTIFY** - Only 0.2/game (target: 2-4)
5. ⚠️ **High draw rate** - 60% draws (3/5 games)
6. ✅ Good Promote usage (5.4/game)
7. ✅ Vengeance not overused (1-1.8/game)

---

## Tuning Changes Made

### 1. Increased Combo Priorities
**File**: `game/js/bot.js`

```javascript
// BEFORE:
- Shield + Attack: priority 150
- Double Attack 2-captures: priority 200
- Double Attack on shielded: priority 180
- Imprison + Attack: priority 160

// AFTER:
- Shield + Attack: priority 200 (+50)
- Double Attack 2-captures: priority 300 (+100) ← BIG INCREASE
- Double Attack on shielded: priority 250 (+70)
- Imprison + Attack: priority 220 (+60)
```

**Reasoning**: Combos weren't being selected because priorities were too low compared to Vengeance/Promote

### 2. Lowered Double Attack Threshold
**File**: `game/js/bot.js`, line ~3012

```javascript
// BEFORE:
if (bestDA && bestDAScore >= 300) {
  candidates.push({
    priority: bestDAScore * 0.10,
    ...
  });
}

// AFTER:
if (bestDA && bestDAScore >= 250) {  // -50 threshold
  candidates.push({
    priority: bestDAScore * 0.12,      // +20% priority
    ...
  });
}
```

**Reasoning**: 300-point threshold was too high, missed many good opportunities

### 3. Lowered Imprison Threshold
**File**: `game/js/bot.js`, line ~2295

```javascript
// BEFORE:
if (bestImprison && bestImpVal >= 250) {
  let prio = bestImpVal * 0.22;
  if (materialBalance > 500) {
    prio *= 0.8;
  }
}

// AFTER:
if (bestImprison && bestImpVal >= 200) {  // -50 threshold
  let prio = bestImpVal * 0.25;           // +14% priority
  if (materialBalance > 500) {
    prio *= 0.85;                          // Less scaling down
  }
}
```

**Reasoning**: 250-point threshold was too conservative

### 4. Integrated Smart Trading
**File**: `game/js/bot.js`, line ~1044

```javascript
// Added aether context to SEE evaluation:
if (seeScore < -100) {
  score += seeScore * 5;
  
  // NEW: Smart Trading - check aether context
  const tradeEval = botEvaluateTrade(piece, target, state.mana[forColor], state.mana[opp]);
  if (tradeEval > 50) {
    score += 100; // Offset penalty if aether makes trade acceptable
  }
  
  return score;
}

// NEW: For marginal trades, factor in aether
if (seeScore >= -100 && seeScore <= 0) {
  const tradeEval = botEvaluateTrade(piece, target, state.mana[forColor], state.mana[opp]);
  score += tradeEval * 0.5;
}
```

**Reasoning**: Bot was rejecting all negative-SEE trades even when aether advantage made them acceptable

---

## Expected Improvements

### Power Usage (Target)
```
DOUBLE_ATTACK:  2-4 per game (was 0)
IMPRISON:       2-4 per game (was 0)
FORTIFY:        2-4 per game (was 0.2)
VENGEANCE:      1-2 per game (maintain)
PROMOTE:        4-6 per game (maintain)
CLEANSE:        1-2 per game (was 0)
```

### Strategic Behavior
1. ✅ More aggressive power usage (14-aether powers)
2. ✅ Better tactical combinations
3. ✅ Smarter trading with aether context
4. ✅ More decisive games (fewer draws)

---

## Testing Iteration 2

Running 5 more games to validate changes...

**Command**: `bun bot-vs-bot.js 5 hard hard`

### Metrics to Track
- [ ] Double Attack usage (target: 2+ per game)
- [ ] Imprison usage (target: 2+ per game)
- [ ] Fortify usage (target: 2+ per game)
- [ ] Total power diversity (# different powers used)
- [ ] Draw rate (target: <40%)
- [ ] Average game length
- [ ] Power usage distribution

---

## Root Cause Analysis

### Why Powers Weren't Being Used

1. **Thresholds Too High**
   - Double Attack: 300 threshold = requires capturing ~Queen value
   - Imprison: 250 threshold = requires Knight+ value
   - These thresholds filtered out most opportunities

2. **Priorities Too Low**
   - Combo priorities (150-200) competed with:
     - Vengeance: ~100-200 (scaled by piece value)
     - Promote: ~400+ (huge priority)
   - Needed to be 250-300+ to compete

3. **Smart Trading Not Integrated**
   - Function existed but never called
   - Bot rejected all slightly-negative trades
   - Didn't consider aether advantage

4. **Hoarding Multiplier Too Weak**
   - 1.5x multiplier at 25+ aether wasn't enough
   - Still preferred to save for more expensive powers

---

## Additional Improvements (If Needed)

### If Double Attack still unused:
- Lower threshold to 200 (any capture)
- Increase priority multiplier to 0.15
- Add special case for 2-pawn captures

### If Imprison still unused:
- Lower threshold to 150 (any minor piece)
- Increase priority to 0.30
- Add bonus for imprisoning near fountains

### If draws still >50%:
- Reduce SEE penalty multiplier (5 → 3)
- Increase king aggression in endgame
- Add material-up trading bonus

### If power diversity still low:
- Add randomness factor (±10% priority)
- Implement exploration bonus (try unused powers)
- Add power cooldown (reduce priority after use)

---

## Performance Impact

All changes are computational optimizations with minimal overhead:
- Threshold changes: No impact (just comparison)
- Priority increases: No impact (just multiplication)
- Smart trading integration: +O(1) per capture evaluation
- Total overhead: <1ms per move

---

*Iteration 1 tuning complete - awaiting test results*
