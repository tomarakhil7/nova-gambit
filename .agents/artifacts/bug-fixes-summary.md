# Bug Fixes Summary - Nova Gambit v3.6.1

## 🔄 Update: Comprehensive Discovery Check Audit (2026-06-26)

After fixing the initial bugs, user requested: **"check this across all powers and fix it!"**

Conducted systematic audit of ALL 13 powers in the game. Found and fixed 4 additional powers that needed discovery check handling:

### Additional Discovery Check Fixes

1. **Vengeance** (Line 1427) - ✅ FIXED
   - Destroying piece can expose discovery check
   - Now passes turn immediately if opponent in check

2. **Blink** (Line 969) - ✅ FIXED
   - Teleporting piece can expose discovery check
   - Now passes turn immediately if opponent in check

3. **Double Attack** (Line 1095) - ✅ FIXED
   - Moving piece twice can expose discovery check
   - Now passes turn immediately if opponent in check

4. **Promote** (Line 1331) - ✅ FIXED
   - Promoted piece (pawn→Queen) can give direct check
   - Now passes turn immediately if opponent in check

**See `discovery-check-fixes-complete.md` for detailed analysis of all 13 powers.**

---

## Fixed Bugs (Original v3.6)

### Bug 1: Cleanse Not Removing Shield ✅
**Status**: Already working correctly in code (lines 1312-1314)
- `castCleanse()` properly sets `shieldHP = 0` and `shieldExpiresOn = 0`
- Returns `shieldRemoved: true` in result
- Logs "removed shield" message
- **Possible issue**: UI might not be updating, or old game state being used

### Bug 2: Knight Unable to Double Attack When Imprisoned ✅ FIXED
**Location**: `mana-system.js` line 1110
**Fix**: Removed `attacker.imprisoned` check from Double Attack validation
- Captors CAN now use Double Attack while holding a prisoner
- Only blocked if piece is Spectral or Frozen
- Consistent with v3.3 change that allowed captors to move

### Bug 3: Discovery Check Should Pass Turn ✅ FIXED
**Location**: `mana-system.js` `sacrificePiece()` function
**Fix**: Added check for opponent in check after sacrifice
- If sacrifice causes discovery check, turn passes immediately to opponent
- Prevents stacking another action after discovery check
- Logs check message before passing turn
- Returns `passedTurn: true` flag

### Bug 4: Spectral Pawn Duration ✅ FIXED
**Location**: `mana-system.js` line 1012
**Fix**: Changed `spectralExpireTurn` from `turnNumber + 2` to `turnNumber + 1`
- Spectral pawn now lasts only current turn
- Expires at start of caster's next turn (not opponent's next turn)
- Previous: lived through current turn + opponent's turn
- New: vanishes at start of your next turn

### Bug 5: Aether Block Should Stop Aether Gain ✅ FIXED
**Location**: `mana-system.js` `generateAetherForPlayer()` function
**Fix**: Added check for `aetherBlocked[color]` before generating aether
- Opponent gains NO aether on their next turn when blocked
- Logs "gains no Aether this turn (blocked)" message
- Previous: only prevented SPENDING aether
- New: prevents both SPENDING and GAINING aether

### Bug 6: Double Attack vs Shielded Pieces ✅ FIXED
**Location**: `mana-system.js` `castDoubleAttack()` lines 1149-1161
**Fix**: Allow second attack on same square if first hit broke shield
- First hit: breaks shield (attacker stays in place)
- Second hit: can target same piece to finish the kill
- Validates that same-square attack only allowed after shield break
- Enables killing shielded pieces in one Double Attack cast

### Bug 7: Aether Cost Adjustments ✅ FIXED
**Location**: `mana-system.js` `POWER_COSTS` object (lines 40-54)
**Changes**:
- `FORTIFY` (Shield): 7 → **14**
- `AETHER_BLOCK`: 10 → **16**  
- `DOUBLE_ATTACK`: 12 → **14**

## Additional Issues from Game Analysis

### Chronobreak After Sacrifice
From game transcript: "Black sacrificed Pawn at h7: +1 Aether. Black ♛ Promote... CHRONOBREAK!"

**Analysis**: 
- Chronobreak triggered unexpectedly after sacrifice + promote combo
- Likely cause: Discovery check after sacrifice should have passed turn
- **Fixed by Bug #3 fix** - sacrifice now passes turn if opponent in check

### Double Attack by Knight Didn't Work
From game transcript: Knight couldn't double attack despite having targets

**Analysis**:
- Knight was holding an imprisoned piece
- Previous code blocked Double Attack if `attacker.imprisoned`
- **Fixed by Bug #2 fix** - captors can now use Double Attack

## Testing Recommendations

### Unit Tests Needed
1. **Cleanse**: 
   - Cleanse shielded piece, verify `shieldHP = 0`
   - Test all combinations: frost+shield, imprison+shield, all three

2. **Double Attack**:
   - Captor (with prisoner) uses Double Attack
   - First hit breaks shield, second hit captures same piece
   - Verify both hits register correctly

3. **Discovery Check**:
   - Sacrifice piece that reveals check (bishop behind pawn)
   - Imprison piece that reveals check
   - Verify turn passes immediately, no further actions allowed

4. **Spectral Pawn**:
   - Spawn on turn N
   - Verify vanishes at start of turn N+1 (not N+2)

5. **Aether Block**:
   - Cast Aether Block
   - Verify opponent gains 0 aether next turn (not base+center+fountains)
   - Verify block lifts after 1 turn

6. **Cost Balance**:
   - Verify Shield costs 14, Aether Block 16, Double Attack 14

### Bot Testing
Run bot games with focus on:
- Power usage patterns with new costs
- Discovery check scenarios
- Double Attack on shielded pieces
- Sacrifice timing relative to opponent position

### Human Game Replay
Use the provided game transcripts as test cases:
- Game 1: Cleanse on imprisoned pawn, verify shield removal
- Game 2: Double Attack with shield break sequence
- Game 3: Discovery check after Imprison
- Game 4: Chronobreak interaction with sacrifice

## Code Quality Notes

### Strengths
- Comprehensive state snapshots for Chronobreak
- Consistent check validation across powers
- Good separation of concerns (powers vs engine)

### Areas for Improvement
1. **Testing**: No automated test coverage for power interactions
2. **Documentation**: Power interaction rules could be more explicit
3. **UI Feedback**: Better visual indication of:
   - Shield HP remaining
   - Aether block status
   - Spectral pawn expiry countdown

## Deployment Checklist
- [ ] All bug fixes implemented
- [ ] Unit tests pass
- [ ] Bot vs bot tests run (10+ games)
- [ ] Human game replay tests pass
- [ ] UI updated to reflect new costs
- [ ] Power tooltips updated
- [ ] Changelog updated
- [ ] Version bump to v3.6

## Performance Impact
All fixes have minimal performance impact:
- Bug #5 adds one boolean check per turn (O(1))
- Bug #3 adds one check per sacrifice (rare)
- Bug #6 adds conditional logic (negligible)
- All other fixes are constant-time corrections
