# Testing Checklist - Bug Fixes v3.6

## Quick Test Commands

```bash
# Run unit tests (once Node.js is available)
node game/tests/test-bug-fixes.js

# Run bot game tests
node game/tests/test-bug-fix-games.js

# Run full test suite
npm test

# Run bot vs bot (multiple games)
node game/tests/test-10games.js
```

## Manual Testing Scenarios

### Test 1: Cleanse Removes Shield ✓
**Setup**:
1. Start new game
2. White: Fortify pawn at e2 (14 aether)
3. Black: Cleanse pawn at e2 (14 aether)

**Expected**:
- Pawn shield HP goes to 0
- Log shows "removed shield"
- Cleanse returns `shieldRemoved: true`

**Bug if**: Shield remains after cleanse

---

### Test 2: Captor Uses Double Attack ✓
**Setup**:
1. Place Knight at c3
2. Imprison black pawn at d5 (Knight now holding prisoner)
3. Place black pawns at a5 and e5
4. Use Double Attack: Knight c3 → a5 → e5

**Expected**:
- Double Attack succeeds
- Knight captures both pawns
- Knight still holds prisoner after both attacks

**Bug if**: Error "Piece cannot cast Double Attack"

---

### Test 3: Discovery Check Passes Turn ✓
**Setup**:
1. Place White Bishop on a1
2. Place Black King on a5
3. Place Black Pawn on a3 (blocking check)
4. Black sacrifices pawn at a3

**Expected**:
- Sacrifice succeeds
- Log shows "White is in check"
- Turn immediately passes to White
- Black cannot make another move

**Bug if**: Black can continue with another action

---

### Test 4: Spectral Pawn Duration ✓
**Setup**:
1. White spawns Spectral Pawn at e4 (turn N)
2. Black makes any move (turn N+1)
3. White's turn starts (turn N+2)

**Expected**:
- Spectral pawn vanishes at start of turn N+1 (White's next turn)
- Log shows "Spectral pawn at e4 vanished"

**Bug if**: Pawn survives until turn N+2

---

### Test 5: Aether Block Prevents Gain ✓
**Setup**:
1. White casts Aether Block on Black (16 aether)
2. Give Black control of center + 2 fountains
3. Black's turn starts (would normally gain 1+1+4=6 aether)

**Expected**:
- Black gains 0 aether
- Log shows "Black gains no Aether this turn (blocked)"
- Black's aether stays at previous amount

**Bug if**: Black gains aether despite block

---

### Test 6: Double Attack Kills Shielded Piece ✓
**Setup**:
1. Place White Queen at d4
2. Place Black Knight at e5 with shield (1 HP)
3. Cast Double Attack: Queen d4 → e5 (break shield) → e5 (capture)

**Expected**:
- First move breaks shield
- Queen stays at d4
- Second move captures Knight at e5
- Knight is removed from board

**Bug if**: Can't target same square twice, or Knight survives

---

### Test 7: New Power Costs ✓
**Setup**:
1. Check POWER_COSTS object in mana-system.js

**Expected**:
```javascript
FORTIFY: 14,
AETHER_BLOCK: 16,
DOUBLE_ATTACK: 14,
```

**Bug if**: Costs are old values (7, 10, 12)

---

## Integration Tests

### Scenario A: Full Power Cycle
1. Fortify a piece (14)
2. Opponent tries to capture → shield breaks
3. Cleanse the piece (14) → shield removed (already 0)
4. Imprison another piece (14)
5. Captor uses Double Attack (14)
6. Opponent casts Aether Block (16)
7. You gain 0 aether next turn
8. You cast Chronobreak (20) → undo Aether Block

**Expected**: All powers work as described

---

### Scenario B: Discovery Check Chain
1. Set up pin: Rook → Pawn → King
2. Sacrifice pawn → discovery check → turn passes
3. Opponent must address check
4. Later: Imprison pawn → discovery check → turn passes
5. Opponent must address check

**Expected**: Turn passes immediately after discovery check from any source

---

### Scenario C: Shield + Double Attack
1. Fortify Queen (14) → 1 HP shield
2. Opponent Double Attacks Queen:
   - First hit: breaks shield
   - Second hit: captures Queen
3. Queen should be captured in one turn

**Expected**: Shielded piece can be killed by one Double Attack

---

### Scenario D: Spectral Timing
1. Spawn Spectral Pawn on turn 10
2. Opponent moves (turn 11)
3. Your turn starts (turn 11 for you, turn 12 global)
4. Spectral vanishes immediately

**Expected**: Spectral lives only through opponent's one turn

---

## Regression Tests

### Check these still work:
- [ ] Regular moves (pawn, knight, bishop, rook, queen, king)
- [ ] Castling (kingside and queenside)
- [ ] En passant capture
- [ ] Pawn promotion (via move, not power)
- [ ] Check detection
- [ ] Checkmate detection
- [ ] Stalemate detection
- [ ] Insufficient material draw
- [ ] Imprison (without discovery check)
- [ ] Frost (freeze piece)
- [ ] Blink (teleport)
- [ ] Bomba (plant bomb, detonate next turn)
- [ ] Promote (power version)
- [ ] Vengeance (destroy piece)
- [ ] Wall (spawn pawns in direction)
- [ ] Chronobreak (undo opponent's turn)
- [ ] Prisoner return to home square
- [ ] Off-board prisoner re-entry
- [ ] Shield expiry after 1 turn
- [ ] Fountain bonuses
- [ ] Center control bonuses
- [ ] Aether generation scaling (turns 1-10, 11-20, 21+)

---

## Performance Tests

### Bot Response Time
```bash
# Measure time for bot to choose move
time node game/tests/test-hard-quick.js
```

**Expected**: < 2 seconds per move on Hard difficulty

### Memory Usage
```bash
# Check for memory leaks in long games
node --expose-gc game/tests/test-hard-vs-hard.js
```

**Expected**: Stable memory, no leaks over 100+ moves

---

## UI Tests (Manual)

### Visual Verification
- [ ] Power cost tooltips show new values (14, 16, 14)
- [ ] Shield icon shows on Fortified pieces
- [ ] Shield HP counter decrements on hit
- [ ] Spectral pawn has ghostly appearance
- [ ] Spectral pawn fades when expiring
- [ ] Aether Block icon shows on blocked player
- [ ] Discovery check highlights checking piece
- [ ] Double Attack shows two-step animation
- [ ] Cleanse shows particle effects on target
- [ ] Imprison shows "prisoner inside" icon

### Audio Tests
- [ ] Shield break sound
- [ ] Cleanse sound effect
- [ ] Aether Block applied sound
- [ ] Discovery check warning
- [ ] Double Attack impact sounds (x2)
- [ ] Spectral spawn sound
- [ ] Spectral vanish sound

---

## Edge Cases

### Test Edge Case 1: Double Attack with Shield on Both Targets
Setup:
- Two shielded pieces in range
- Double Attack breaks shield on first, breaks shield on second
- Neither piece captured (both shields absorbed hits)

Expected: Both shields broken, attacker moved to second target

---

### Test Edge Case 2: Sacrifice Creates Check on Own King
Setup:
- Sacrifice would leave own king in check (pin situation)

Expected: Error "Sacrifice would leave King in check"

---

### Test Edge Case 3: Cleanse on King
Setup:
- Try to Cleanse the King

Expected: Error "Cannot target the King"

---

### Test Edge Case 4: Aether Block While Already Blocked
Setup:
- Cast Aether Block on opponent
- Try to cast it again before it expires

Expected: Error "Opponent already blocked"

---

### Test Edge Case 5: Chronobreak Itself
Setup:
- Opponent casts Chronobreak
- You cast Chronobreak to undo their Chronobreak

Expected: Error "Cannot Chronobreak a Chronobreak"

---

### Test Edge Case 6: Spectral Pawn Sacrifice
Setup:
- Spawn Spectral Pawn
- Try to sacrifice it for aether

Expected: Error "Cannot sacrifice Spectral pieces"

---

### Test Edge Case 7: Multiple Prisoners Waiting Off-Board
Setup:
- Imprison 3 pieces whose home squares are all occupied
- Free home squares one by one

Expected: Prisoners return to home squares as they become available

---

## Bot Quality Tests

### Strategy Validation
Run 50 bot games and verify:
- [ ] Bot uses Fortify less often (more expensive)
- [ ] Bot uses Aether Block more strategically (not randomly)
- [ ] Bot uses Double Attack on shielded pieces when available
- [ ] Bot recognizes discovery check opportunities
- [ ] Bot doesn't waste Spectral spawns
- [ ] Bot doesn't gain aether when blocked

### Power Usage Statistics
From 50 games, record:
```
Fortify: X uses → expect < 5 per game
Aether Block: Y uses → expect < 3 per game
Double Attack: Z uses → expect 3-8 per game
Spectral Spawn: W uses → expect < 5 per game
```

---

## Acceptance Criteria

### All bugs fixed: ✓
- [x] Bug 1: Cleanse removes shields
- [x] Bug 2: Captors can Double Attack
- [x] Bug 3: Discovery check passes turn
- [x] Bug 4: Spectral duration = 1 turn
- [x] Bug 5: Aether Block prevents gain
- [x] Bug 6: Double Attack kills shielded
- [x] Bug 7: Costs updated (14, 16, 14)

### Tests pass:
- [ ] Unit tests (test-bug-fixes.js)
- [ ] Game tests (test-bug-fix-games.js)
- [ ] Bot tests (test-10games.js)
- [ ] Regression tests (existing test suite)

### Documentation complete:
- [x] Bug fixes summary
- [x] Human game analysis
- [x] Implementation summary
- [x] Bot training recommendations
- [x] Testing checklist (this file)

### Ready for deployment:
- [ ] All tests pass
- [ ] No regression in existing functionality
- [ ] UI updated with new costs
- [ ] Changelog updated
- [ ] Version bumped to v3.6

---

## Sign-Off

### Developer: _____________ Date: _______
Confirmed all bugs fixed and code reviewed.

### QA: _____________ Date: _______
Confirmed all tests pass and no regressions.

### Product: _____________ Date: _______
Approved for deployment to production.

---

*Last updated: 2026-06-26*
*Version: Nova Gambit v3.6*
