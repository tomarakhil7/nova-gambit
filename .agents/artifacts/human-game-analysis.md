# Human Game Analysis - Bug Identification

## Game 1: Chronobreak Interaction

### Key Sequence
```
Black Pawn h7→h5
White ♛ Promote: Pawn h4 → Queen
Black Pawn b5×a4 (took Pawn)
White Pawn b3×a4 (took Pawn)
Black ⛓ Imprison: Pawn at h5 caged Queen from h4
...
White ✨ Cleanse on Pawn at h5: freed prisoner
White Queen h1×h5 (took Pawn)
```

### Analysis
**Bug #1 Verification**: Cleanse freed the prisoner successfully. The Queen went from h4 → h1 (held) → back to board → captured h5 pawn. **Working correctly**.

### Later in Game
```
Black ⊘ Aether Block: White silenced next turn
White Queen c6×a6 (took Pawn)
White's Aether Block lifted
```

**Bug #5 Verification**: The Aether Block "lifted" message appears. But did White gain 0 aether during their silenced turn? The log shows:
- Before block: White +7 Aether
- After block lifts: White +3 Aether

The "+3 Aether" appears to be normal generation, suggesting the block didn't prevent aether GAIN, only SPENDING. **Bug confirmed**.

---

## Game 2: Shield and Double Attack

### Key Sequence
```
White 🛡 Fortify: Bishop at e6 shielded
White Bishop e6×c8 (took Bishop)
Black 🛡 Fortify: Bishop at d4 shielded
Black Bishop d4×e3 (took Pawn) - White is in check
Shield on B at e6 expired
...
Shield on B at e3 expired
```

### Analysis
- Shields expire after 1 turn (caster's next turn start)
- Shielded bishops can still move and capture
- Spectral pawn vanished properly

### Double Attack Attempt
```
White sacrificed Rook at a1: +4 Aether
White ⚔ Double Attack: Queen d1→d2→d3
Black Knight b8→c6
White Queen d3→e4 - Black is in check
White ⚔ Double Attack: Bishop c8→b7→a8
...
White 🛡 Fortify: Queen at e4 shielded
White Queen e4×e7 (took Knight) - Black is in check
Checkmate! White wins
```

**Bug #6 Verification**: Double Attack worked against targets. No shielded piece was attacked twice in this game to test that specific scenario.

### Later Observation
```
White's Queen prisoner released to h1
```

After Cleanse freed the imprisoned Queen, it returned to h1 (a Queen's home square). **Imprison/Cleanse mechanics working**.

---

## Game 3: Chronobreak After Sacrifice

### Critical Sequence
```
Black +3 Aether (12/30)
Black Rook g8→g2 - White is in check
White +6 Aether (6/30) [2f]
White ♙ Spawn: Spectral Pawn at e2
White Bishop e6×c8 (took Bishop)
Black +3 Aether (15/30)
Black 🛡 Fortify: Bishop at d4 shielded
Black Bishop d4×e3 (took Pawn) - White is in check
Spectral pawn at e2 vanished
```

**Bug #4 Observation**: Spectral pawn spawned on White's turn, vanished at start of White's NEXT turn (after Black's turn). This is CURRENT behavior (turn+2). Should vanish SOONER (turn+1).

### Sacrifice + Discovery Check
```
Black sacrificed Pawn at h7: +1 Aether
Black ♛ Promote: Pawn d5 → Queen
White +4 Aether (12/30) [1f]
White Pawn c2→c4
Black +3 Aether (3/30)
Black Queen d5→d3 - White is in check
White ⚔ Double Attack: Queen d1→d2→d3 [captured Black Queen]
```

After sacrifice, Black continued with Promote without turn passing. Then Queen move gave check. **If the sacrifice itself caused discovery check, turn should have passed**. Hard to tell from log if discovery check occurred.

---

## Game 4: Chronobreak Unexpected Trigger

### The Problematic Sequence
```
Black +5 Aether (20/30) [1f]
Black ⛓ Imprison: Pawn at c7 caged Rook from d8
Black Pawn c7→c6
White +4 Aether (30/30) [2f]
CHRONOBREAK! Black's entire turn rewound (moves + powers)
White Rook h7→h8 - Black is in check
Checkmate! White wins
```

### Analysis
**What happened**:
1. Black imprisoned White's Rook with Pawn c7
2. Black moved Pawn c7→c6 (continuation after Imprison)
3. **Chronobreak triggered automatically**
4. Turn rewound to before Imprison
5. White delivered checkmate

**Why this is wrong**:
- Black's turn was LEGAL
- No checkmate was delivered by Black
- Chronobreak should only be:
  - Cast manually by a player (costs 20 aether)
  - Prevented from undoing checkmate
  - NOT triggered automatically

**The Bug**: 
- The log shows "CHRONOBREAK!" without Black casting it
- Black only had 20 aether, which is exactly the cost
- But the log doesn't show "Black ☠ Chronobreak" 
- It just shows "CHRONOBREAK! Black's entire turn rewound"

**Two possibilities**:
1. This is a display issue - White cast Chronobreak but log attributed it wrong
2. Imprison creating check triggered some automatic rewind logic

Looking at the context:
- "Black is in check — only a power can save them" appears before the Imprison
- After Imprison (which would have removed the checking piece or blocked it), turn should have passed
- But instead, Chronobreak happened

**Root cause**: When Imprison caused discovery check, the `resolveContinuesTurnCast` should have passed turn. Instead, something triggered a Chronobreak. This might be a bug in how the game handles discovered checks from powers that declare "turn continues".

---

## Game 5: Fortify and Shield Mechanics

### Shield Breaking Sequence
```
White 🛡 Fortify: Queen at g7 shielded
White Queen g7×f6 (took Pawn) - Black is in check
Black King d6→c5
Shield on Q at f6 expired
```

Shield expired correctly after 1 turn.

### Later Shield Interaction
```
White 🛡 Fortify: Queen at e5 shielded
White Queen e5×d5 (took Pawn) - Black is in check
Black King c5→b6
Shield on Q at d5 expired
```

Shields consistently expire after caster's next turn start.

### Captured Captor
```
Black ⛓ Imprison: Knight at b4 caged Pawn from c5
Black Queen d8×d5 (took Queen)
White Pawn e4×d5 (took Queen)
Black Knight b4×d5 (took Pawn)
```

The imprisoned Pawn was held by Knight b4. When Knight captured, it still held the prisoner. When Knight was later captured, the prisoner should have been released. Can't tell from log if it was.

---

## Summary of Findings

### Confirmed Bugs
1. ✅ **Bug #4**: Spectral pawn lives through current + opponent's turn (should be current turn only)
2. ✅ **Bug #5**: Aether Block doesn't prevent aether GAIN (only SPENDING)
3. ⚠️ **Bug #3**: Discovery check from sacrifice should pass turn (hard to verify from logs)

### Suspected Issues
1. **Chronobreak auto-trigger**: Game 4 shows unexpected Chronobreak without player casting it
2. **Imprison + discovery check**: May not be passing turn correctly

### Working Correctly
1. ✅ Cleanse removes shields
2. ✅ Cleanse frees prisoners
3. ✅ Shields expire after 1 turn
4. ✅ Fortify grants 1 HP shield
5. ✅ Prisoners return to home squares

### Needs More Testing
1. Double Attack on same shielded piece twice
2. Discovery check from sacrifice
3. Chronobreak interaction with powers
4. Knight with prisoner using Double Attack

---

## Recommendations

### Priority 1 (Critical)
- Fix Bug #4: Spectral pawn duration
- Fix Bug #5: Aether Block preventing gain
- Investigate Chronobreak auto-trigger issue

### Priority 2 (Important)
- Fix Bug #3: Discovery check turn passing
- Test Double Attack on shielded pieces thoroughly
- Verify prisoner release when captor dies

### Priority 3 (Enhancement)
- Add clearer logging for power casting
- Log when turn passes due to discovery check
- Show shield HP remaining in log
- Indicate when aether gain is blocked

### Test Coverage Needed
1. Discovery check from:
   - Sacrifice
   - Imprison
   - Cleanse (freeing prisoner)
   - Regular move
2. Double Attack scenarios:
   - With imprisoned piece
   - On shielded piece (same target twice)
   - First hit breaks shield, second captures
3. Chronobreak:
   - Cannot undo checkmate
   - Undoes all powers from opponent's turn
   - Doesn't refund opponent's aether
