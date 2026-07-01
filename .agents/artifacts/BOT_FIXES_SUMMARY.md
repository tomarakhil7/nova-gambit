# Bot Fixes Summary - 2026-06-26

## Problems Found & Fixed

### 1. ✅ Spectral Pawn Duration Bug (commit 82fc4a7)
**Problem**: Spectral pawns lasted 1.5+ turns instead of 1 ply (half-move)
**Cause**: `spectralExpireTurn = turnNumber + 1` and cleanup at START of next turn
**Fix**: `spectralExpireTurn = turnNumber` and cleanup at END of turn
**Impact**: Spectral pawns now correctly vanish immediately after spawner's turn ends

### 2. ✅ SEE Board Corruption Bug (commit 5191fd3) - CRITICAL
**Problem**: Bot hanging pieces, playing like random moves
**Cause**: `restore(state.board, boardCopy)` in SEE function corrupted game state
**Fix**: Removed the erroneous `restore()` call (boardCopy was local, no restore needed)
**Impact**: Bot can now properly evaluate positions and see attacked pieces

### 3. ✅ Missing findPiece() Function (commit e1a06ee) - CRITICAL
**Problem**: Bot stuck in infinite retry loop
**Cause**: `botEvaluateThreats()` called `findPiece()` which doesn't exist
**Fix**: Replaced with inline board scan to find Queen
**Impact**: Bot no longer crashes when evaluating threats

### 4. ✅ Infinite Error Loop (commit ea009ec)
**Problem**: Bot would retry infinitely when errors occurred
**Cause**: try-catch logged error but continued to retry
**Fix**: Added `errorOccurred` flag, disable bot on error, show user message
**Impact**: Bot gracefully handles errors instead of freezing browser

### 5. ✅ Missing getAttackSquares() Function (commit dc13507)
**Problem**: All tactical pattern detection returning empty results
**Cause**: `getAttackSquares()` didn't exist, all calls fell back to `[]`
**Fix**: Implemented complete function for all piece types with path blocking
**Impact**: Fork/Pin/Overload detection now works properly

## Remaining Issues to Investigate

### Bot Still Losing Games

**Potential causes:**

1. **Tactical Intelligence Not Helping**
   - The advanced tactical layers (6-8) may be adding overhead without benefit
   - Need to verify they're actually finding useful patterns
   - May need to tune thresholds/priorities

2. **Power Usage Strategy**
   - Bot may be using powers at wrong times
   - Need to analyze: When does bot use Fortify? Is it effective?
   - Are Frost/Aether Block being used optimally?

3. **Evaluation Function Issues**
   - Added aether economy evaluation might be too aggressive
   - Center control bonus (+150) might be overvalued
   - Need to verify material counting is correct

4. **Search Depth/Time**
   - Increased to 4s timeout (from 1.8s)
   - May be too slow for practical play
   - May not be completing full depth searches

## Next Steps

### Option A: Disable Tactical Intelligence (Quick)
Comment out layers 6-8 in `botConsiderPowers()` to see if bot plays better without them.

### Option B: Add Detailed Logging (Debug)
Add console logging to see:
- What tactical patterns are detected
- What powers are being considered
- What move scores look like
- Why certain moves are chosen

### Option C: Run Controlled Tests (Analysis)
- Bot vs Bot with old code (commit 0193fdb)
- Bot vs Bot with new code (commit dc13507)
- Compare win rates, power usage, game quality

### Option D: Revert to Known-Good State
Go back to commit 0193fdb which was described as "unbeatable hard bot"

## Code Statistics

**Files Modified**: 2
- `game/js/bot.js` - ~750 lines added/changed
- `game/js/mana-system.js` - ~50 lines changed

**Commits Today**: 6
1. 2b82665 - Major bot intelligence upgrade (introduced bugs)
2. 82fc4a7 - Spectral pawn fix
3. 5191fd3 - SEE corruption fix (CRITICAL)
4. e1a06ee - findPiece fix (CRITICAL)
5. ea009ec - Infinite loop prevention
6. dc13507 - getAttackSquares implementation

**Time Spent**: ~4 hours debugging and fixing

## Recommendation

**Test the current code** (commit dc13507) with a few games and see:
1. Does bot still hang/crash? (Should be fixed)
2. Does bot play reasonably? (Check move quality)
3. Does bot use powers intelligently? (Check console logs)

If bot still loses badly:
- **Short term**: Revert to 0193fdb (known working)
- **Long term**: Debug tactical intelligence with detailed logging
