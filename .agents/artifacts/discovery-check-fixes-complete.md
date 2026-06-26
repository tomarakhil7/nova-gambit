# Complete Discovery Check Fixes - All Powers

## Overview
Discovery checks occur when removing or moving a piece exposes an attack on the opponent's king from another piece. When a discovery check happens, the turn must pass IMMEDIATELY to the opponent (they're in check and must respond).

## All Powers Analyzed

### ✅ Powers That Correctly Handle Discovery Checks

#### 1. **Imprison** (Line 1212)
- **Action**: Removes captive from board
- **Fix**: Uses `resolveContinuesTurnCast()` which checks for discovery checks
- **Status**: ✅ Already fixed in v3.5

#### 2. **Cleanse** (Line 1291)
- **Action**: Releases prisoner back to board, removes shield/frost
- **Fix**: Uses `resolveContinuesTurnCast()` which checks for discovery checks
- **Status**: ✅ Already fixed in v3.5

#### 3. **Spawn** (Line 1021)
- **Action**: Adds spectral pawn
- **Fix**: Uses `resolveContinuesTurnCast()` which checks for discovery checks
- **Status**: ✅ Already fixed in v3.5

#### 4. **Sacrifice** (Previously fixed)
- **Action**: Removes piece from board
- **Fix**: Added explicit discovery check handling
- **Status**: ✅ Fixed in Bug #3

#### 5. **Chronobreak** (Line 1373)
- **Action**: Rewinds board state (can restore pieces that block checks)
- **Fix**: Added discovery check handling at end of function
- **Status**: ✅ Fixed today

#### 6. **Vengeance** (Line 1427) - **NEWLY FIXED**
- **Action**: Destroys enemy piece
- **Before**: Only checked for checkmate, not simple checks
- **After**: Now checks if removal exposes check on opponent
- **Code Added**:
```javascript
// Bug fix: Check if Vengeance caused discovery check on opponent
const opp = opposite(color);
if (isInCheck(state.board, opp)) {
  state.log.push(`${colorName(opp)} is in check.`);
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, passedTurn: true };
}
```

#### 7. **Blink** (Line 969) - **NEWLY FIXED**
- **Action**: Teleports piece to new location
- **Before**: Only checked for checkmate, not discovery checks
- **After**: Now checks if moving piece exposes check on opponent
- **Code Added**:
```javascript
// Bug fix: Check if Blink caused discovery check on opponent
const opp = opposite(color);
if (isInCheck(state.board, opp)) {
  state.log.push(`${colorName(opp)} is in check.`);
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, passedTurn: true };
}
```

#### 8. **Double Attack** (Line 1095) - **NEWLY FIXED**
- **Action**: Makes two moves/captures in one turn
- **Before**: Only checked for checkmate
- **After**: Now checks if moves expose check on opponent
- **Code Added**:
```javascript
// Bug fix: Check if Double Attack caused discovery check on opponent
const opp = opposite(color);
if (isInCheck(state.board, opp)) {
  state.log.push(`${colorName(opp)} is in check.`);
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, firstShieldBlock, secondShieldBlock, passedTurn: true };
}
```

#### 9. **Promote** (Line 1331) - **NEWLY FIXED**
- **Action**: Changes pawn to Queen/Rook/Bishop/Knight
- **Before**: Only checked for checkmate
- **After**: Now checks if promoted piece gives check
- **Note**: Promote doesn't cause *discovery* checks (piece stays on same square), but the promoted piece itself can give check
- **Code Added**:
```javascript
// Bug fix: Check if Promote caused check on opponent
if (isInCheck(state.board, opp)) {
  state.log.push(`${colorName(opp)} is in check.`);
  state.lastActionKind = 'POWER';
  state.lastMoveInfo = { type: 'PROMOTE', to: {r,c} };
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, passedTurn: true };
}
```

---

### ❌ Powers That CANNOT Cause Discovery Checks (No Fix Needed)

#### 1. **Frost** (Line 914)
- **Action**: Freezes piece (doesn't move/remove anything)
- **Why safe**: Board state unchanged, no pieces moved or removed
- **Status**: ✅ No fix needed

#### 2. **Fortify** (Line 943)
- **Action**: Adds shield to piece
- **Why safe**: Board state unchanged, no pieces moved or removed
- **Status**: ✅ No fix needed

#### 3. **Aether Block** (Line 1270)
- **Action**: Blocks opponent's aether
- **Why safe**: Doesn't affect piece positions
- **Status**: ✅ No fix needed

#### 4. **Bomba** (Line 1052)
- **Action**: Plants bomb on empty square
- **Why safe**: Doesn't move existing pieces
- **Status**: ✅ No fix needed

#### 5. **Wall** (Line 1463)
- **Action**: Spawns pawns around anchor piece
- **Why safe**: Only adds pieces, doesn't remove. Already checks if it gives direct check (not discovery)
- **Status**: ✅ No fix needed

---

## Discovery Check Examples

### Example 1: Vengeance Discovery Check
```
Setup:
- White Bishop on a1
- Black Pawn on a3 (blocking diagonal)
- Black King on a5

Action:
White casts Vengeance on Black Pawn at a3

Result:
- Pawn removed
- Bishop now attacks King on a5 (discovery check!)
- Turn passes immediately to Black
- Black must address check
```

### Example 2: Blink Discovery Check
```
Setup:
- White Rook on e1
- White Knight on e4 (blocking vertical line)
- Black King on e8

Action:
White casts Blink: Knight e4 → c5

Result:
- Knight moves away
- Rook now attacks King on e8 (discovery check!)
- Turn passes immediately to Black
- Black must address check
```

### Example 3: Double Attack Discovery Check
```
Setup:
- White Queen on d1
- White Bishop on d4 (blocking vertical line)
- Black King on d8
- Black Pawns on a7 and h7

Action:
White casts Double Attack: Bishop d4×a7 → h7

Result:
- Bishop moves away from d-file
- Queen now attacks King on d8 (discovery check!)
- Turn passes immediately to Black
- Black must address check
```

### Example 4: Chronobreak Discovery Check
```
Setup:
Turn 50: Black moved Rook from e5 to e1
Turn 51: White casts Chronobreak

Result:
- Rook returns to e5
- Restoring Rook to e5 now blocks White Queen's attack on White King
- But also: Rook removal from e1 exposes Black King to check from White Bishop
- Turn passes immediately to Black
- Black must address check
```

---

## Testing Scenarios

### Test 1: Vengeance Discovery Check
```javascript
// Setup board with Bishop → Pawn → King alignment
// Cast Vengeance on pawn
// Expected: Turn passes, opponent in check
```

### Test 2: Blink Discovery Check
```javascript
// Setup board with Rook → Knight → King alignment
// Blink knight away
// Expected: Turn passes, opponent in check
```

### Test 3: Double Attack Discovery Check
```javascript
// Setup board with Queen → Piece → King alignment
// Double Attack moves piece away
// Expected: Turn passes, opponent in check
```

### Test 4: Promote Check (Not Discovery)
```javascript
// Setup board with Pawn on 7th rank near enemy King
// Promote to Queen giving check
// Expected: Turn passes, opponent in check
```

### Test 5: Chronobreak Discovery Check
```javascript
// Opponent moved piece creating blocking
// Chronobreak rewinds, exposes check
// Expected: Turn passes, opponent in check
```

---

## Implementation Pattern

All fixes follow the same pattern:

```javascript
// After spending aether and modifying board:
const opp = opposite(color);
if (isInCheck(state.board, opp)) {
  state.log.push(`${colorName(opp)} is in check.`);
  clearPerTurnEffects(state, state.turn);
  endOfTurn(state);
  return { success: true, passedTurn: true };
}

// Normal continuation if no check
clearPerTurnEffects(state, state.turn);
endOfTurn(state);
return { success: true };
```

---

## Summary

### Total Powers Analyzed: 13
- **Already Fixed (v3.5)**: 3 (Imprison, Cleanse, Spawn)
- **Previously Fixed**: 2 (Sacrifice, Chronobreak)
- **Newly Fixed Today**: 4 (Vengeance, Blink, Double Attack, Promote)
- **No Fix Needed**: 5 (Frost, Fortify, Aether Block, Bomba, Wall)

### All Discovery Check Issues: ✅ RESOLVED

Every power that can cause a discovery check now correctly:
1. Detects the check
2. Logs it
3. Passes turn immediately to opponent
4. Returns `passedTurn: true` flag

---

*Last Updated: 2026-06-26*
*Version: Nova Gambit v3.6.1*
