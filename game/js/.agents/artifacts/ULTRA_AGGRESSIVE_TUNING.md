# Ultra-Aggressive Power Tuning - Make Bot Use Tactical Powers!

## Problem
After implementing tactical intelligence (Phase 3), bot still showed:
- Double Attack: 0 uses
- Imprison: 0 uses  
- Fortify: 0.2-2.7/game (high variance)

## Root Cause
**Priorities too low to compete with Promote (400+) and Vengeance (100-200)**

Even with tactical patterns detected, they lost priority competition.

## Solution: ULTRA-AGGRESSIVE Tuning

### Change 1: Double Attack Priority MASSIVE BOOST

**Before**:
```javascript
threshold: 150
priority: bestDAScore * 0.15
// Example: Score 300 → Priority 45
```

**After**:
```javascript
threshold: 100  // Lowered by 50
priority: bestDAScore * 0.40 + 250  // HUGE boost
// Example: Score 300 → Priority 370 (8x increase!)
```

**Impact**: Any capture worth 100+ (pawn) triggers DA, priority beats most powers

### Change 2: Imprison Priority MASSIVE BOOST

**Before**:
```javascript
threshold: 200
priority: bestImpVal * 0.25
scaling: 0.85 when ahead
// Example: Value 300 → Priority 75
```

**After**:
```javascript
threshold: 150  // Lowered by 50
priority: bestImpVal * 0.60 + 250  // HUGE boost
scaling: 0.95 when ahead
// Example: Value 300 → Priority 430 (5.7x increase!)
```

**Impact**: Knights and up trigger Imprison, priority beats Promote!

### Change 3: Fortify Priority HUGE BOOST

**Before**:
```javascript
priority: bestVal * 0.10
// Example: Value 900 → Priority 90
```

**After**:
```javascript
priority: bestVal * 0.25 + 150  // HUGE boost
// Example: Value 900 → Priority 375 (4x increase!)
```

**Impact**: Fortify now competitive with top-tier powers

### Change 4: Tactical Pattern Priorities MASSIVE BOOST

**Before**:
```javascript
FORK: pattern.enhancedValue * 0.8
PIN: pattern.enhancedValue * 0.9
OVERLOAD: pattern.enhancedValue * 1.0
// Example: Value 1000 → Priority 800-1000
```

**After**:
```javascript
FORK: pattern.enhancedValue * 1.5 + 300
PIN: pattern.enhancedValue * 1.5 + 300
OVERLOAD: pattern.enhancedValue * 2.0 + 500
// Example: Value 1000 → Priority 1800-2500!
```

**Impact**: Tactical patterns now DOMINATE priority competition

---

## Expected Results

### Power Usage (Projected)
```
Double Attack: 2-4/game (was 0)
Imprison: 2-3/game (was 0)
Fortify: 3-5/game (was 0.9 avg)
Tactical Patterns: 1-2/game (new)
```

### Priority Comparison Table

| Power/Action | Old Priority | New Priority | Increase |
|--------------|--------------|--------------|----------|
| Double Attack (300 val) | 45 | 370 | 8.2x |
| Imprison (300 val) | 75 | 430 | 5.7x |
| Fortify (900 val) | 90 | 375 | 4.2x |
| Fork Pattern (1000 val) | 800 | 1800 | 2.25x |
| Overload Pattern (1000 val) | 1000 | 2500 | 2.5x |
| Promote (typical) | 400 | 400 | 1.0x |
| Vengeance (Queen) | 180 | 180 | 1.0x |

**Result**: Tactical powers now WIN priority competition!

---

## Trade-offs

### Pros ✅
1. Bot will finally use tactical powers
2. More diverse gameplay
3. Better power synergies
4. More intelligent play

### Cons ⚠️
1. May overuse powers (burn aether too fast)
2. May ignore Promote when tactical options exist
3. Could be too aggressive early game
4. May need rebalancing after testing

### Mitigation
- Anti-hoarding multiplier still active (1.5x at 25+ aether)
- Promote still has high base priority
- Vengeance still prioritized for Queen threats
- Bot won't waste powers on bad positions (still requires value threshold)

---

## Testing Plan

### Test 1: Bot-vs-Bot (5 games)
**Metrics**:
- Double Attack usage (target: 2+/game)
- Imprison usage (target: 2+/game)
- Fortify usage (target: 3+/game)
- Power diversity (target: 6+ powers)
- No crashes/errors

### Test 2: Manual Positions
**Setup fork position**:
- Knight can fork Queen and Rook
- Verify bot uses Fortify + creates fork
- Check priority competition

**Setup pin position**:
- Rook pins Knight to Queen
- Verify bot uses Imprison on pinned piece
- Check value calculation

### Test 3: Human-vs-Bot
- Play 3 games as human
- Observe bot power usage
- Check if tactical powers make sense
- Verify not too aggressive/wasteful

---

## Rollback Plan

If bot becomes too aggressive (wastes aether):

### Option 1: Moderate Tuning
```javascript
// Reduce boosts by 50%
Double Attack: bestDAScore * 0.25 + 125
Imprison: bestImpVal * 0.40 + 125
Fortify: bestVal * 0.17 + 75
```

### Option 2: Threshold Increase
```javascript
// Keep priorities, raise thresholds
Double Attack: threshold 150 (not 100)
Imprison: threshold 200 (not 150)
Fortify: unchanged
```

### Option 3: Revert to Previous
```bash
git checkout HEAD~1 -- game/js/bot.js
```

---

## Summary

### Changes Made
- ✅ Double Attack: 8x priority increase, lower threshold
- ✅ Imprison: 5.7x priority increase, lower threshold  
- ✅ Fortify: 4.2x priority increase
- ✅ Tactical Patterns: 2-2.5x priority increase

### Expected Impact
Bot will finally USE tactical powers instead of hoarding for Promote/Vengeance.

### Risk Level
🟡 MEDIUM - Aggressive tuning may need rebalancing

### Testing Status
⏳ Running 5-game test now...

---

*Tuning applied: 2026-06-26*  
*Strategy: Make tactical powers DOMINATE priority competition*  
*Goal: Force bot to use diverse power toolkit* 🎯
