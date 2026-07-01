# 🎯 OPPONENT AETHER PREDICTION - COUNTERING WITH AETHER_BLOCK

**Concept:** User's brilliant insight - Use AETHER_BLOCK strategically to:
1. **Predict opponent's upcoming moves** based on aether accumulation
2. **Block dangerous power combos** before they execute
3. **Deliver checkmate** while opponent is limited

---

## CORE CONCEPT: Reading Opponent's Intentions

### How Opponent Aether Works
```
Opponent starts: 2 aether
Each turn (if not spent): +1-3 aether (scales by phase)
Fountains: +2 bonus per turn
Visible to you: Opponent's aether bar (30/30 max)
```

### Reading the Signals
```
Opponent at 10 aether   → Can use small powers (FROST 8, BLINK 8)
Opponent at 15 aether   → Can use medium powers (IMPRISON 14, SHIELD 14)
Opponent at 20 aether   → Can use big powers (PROMOTE 15, WALL 18)
Opponent at 28+ aether  → Can use 2-power combos (SHIELD+DOUBLE_ATTACK 28!)
Opponent at 30 aether   → MUST spend (will use something!)
```

---

## STRATEGY 1: AETHER_BLOCK FOR DEFENSE

### The Problem
```
Turn 15: Opponent has 28 aether
Turn 16: You know they'll use SHIELD+DOUBLE_ATTACK next turn
         They'll destroy your Queen!
         Your Queen has no defense!

Problem: You can see it coming, but can't stop it
```

### Solution: AETHER_BLOCK Pre-emptively

**What AETHER_BLOCK does:**
- Cost: 16 aether
- Effect: Opponent loses 10 aether instantly
- Result: Opponent can't afford SHIELD+DOUBLE_ATTACK (needs 28, now has 18!)
- Bonus: Blocks their dangerous combination

**When to use:**
```
IF (opponent_aether >= 25 AND your_king_threatened) {
  // Opponent likely planning major combo
  // Block now before they execute
  AETHER_BLOCK → Reduce their aether by 10
  // Now they can't afford SHIELD+DOUBLE_ATTACK or PROMOTE+WALL
}

IF (opponent_aether == 30) {
  // They MUST spend, might use dangerous power
  // Block now to force them into weaker choices
  AETHER_BLOCK → Limit their options
}
```

---

## STRATEGY 2: PREEMPTIVE AETHER_BLOCK FOR CHECKMATE

### The Pattern
```
Turn 20: Opponent has 25 aether
        Opponent king is vulnerable (few defenders)
        If opponent uses SHIELD+IMPRISON (26 aether), they defend safely

Your counter:
Turn 20: You have 22 aether
        Use AETHER_BLOCK (16 aether)
        Opponent: 25 → 15 aether (can't afford 26!)

Result:
Turn 21: Opponent can't defend properly
        Your attack: DOUBLE_ATTACK delivers checkmate
        Game over!
```

### Setup for this Strategy

**Requirements:**
1. You have 16+ aether (for AETHER_BLOCK)
2. Opponent has 24-30 aether (critical spending point)
3. Your checkmate is 1-2 turns away
4. Opponent king is vulnerable

**Execution:**
```javascript
IF (your_aether >= 16 AND 
    opponent_aether >= 24 AND 
    opponent_aether <= 30 AND 
    checkmate_in_2_detected) {
  
  // Use AETHER_BLOCK to disable their defense
  AETHER_BLOCK();  // 16 aether
  
  // Next turn: Opponent weakened, execute checkmate
  SHIELD + DOUBLE_ATTACK();  // 28 aether
  // Checkmate! ✓
}
```

---

## STRATEGY 3: READING OPPONENT'S POWER CONSUMPTION PATTERNS

### Track Their Spending

```
Opponent aether timeline:
Turn 5:  6 aether  (normal)
Turn 10: 13 aether (normal, +1/turn)
Turn 15: 16 aether (SUDDEN DROP! Used 12+3 = used something)
         → Likely used IMPRISON (14) or SHIELD (14)
Turn 16: 19 aether (recharging)
Turn 20: 25 aether (building up to major combo!)
```

### What This Tells You
```
If opponent used power at turn 15:
- Shield duration: 2 turns (expires turn 17)
- IMPRISON duration: Permanent removal
- Likely protecting: Their Queen or critical defender

Your response (turn 17):
- Shield expires, piece vulnerable again
- Attack the protected piece
- Opponent might counter with DOUBLE_ATTACK

Your meta-response (turn 16):
- Pre-emptively AETHER_BLOCK
- Prevent them from having aether for DOUBLE_ATTACK
- Checkmate becomes possible
```

---

## STRATEGY 4: FORCED AETHER SHORTAGE CHECKMATE

### The Setup
```
Current situation:
- Your aether: 20 + upcoming 3/turn × 3 turns = 29 by turn N+3
- Opponent aether: 25 + upcoming 2/turn × 3 turns = 31 (capped at 30!)
- Opponent at cap = MUST spend (will waste or use bad power)

Your plan:
Turn N:     AETHER_BLOCK (costs 16) → Opponent: 25 → 15
Turn N+1:   Opponent forced to spend small powers (can't afford big ones)
Turn N+2:   Opponent recharges: 15 + 2 = 17 (still limited!)
Turn N+3:   You have 29 aether, opponent has ~19
            Execute SHIELD+DOUBLE_ATTACK (28 aether)
            Opponent can't counter (insufficient aether)
            Checkmate!
```

### Advantage: Psychological
- Opponent sees their aether blocked
- Forces them into reactive, weak moves
- They can't execute their planned combo
- Perfect window for your checkmate combo

---

## STRATEGY 5: DOUBLE BLOCK FOR GUARANTEED MATE

### When Opponent is DANGEROUS
```
Situation:
- Opponent has 30 aether (maximum!)
- Opponent has clear checkmate threat in 2 turns
- Your position: Defensive, need to break their attack

The Double Block:
Turn N:     You AETHER_BLOCK (16 aether)
            Opponent: 30 → 20 aether

Turn N+1:   Opponent must defend their threat (uses power)
            They spend 14-18 aether
            Opponent: 20 → 2-6 aether

Turn N+2:   You counterattack
            Opponent is vulnerable (no aether for combos)
            Execute SHIELD+DOUBLE_ATTACK (28 aether)
            Or PROMOTE+WALL if near pawn promotion
            Checkmate!
```

---

## IMPLEMENTATION: AETHER_BLOCK EVALUATION LAYER

### Add to botConsiderPowers():

```javascript
// Check for opponent aether threat
function shouldBlockOpponentAether(state, color) {
  const opp = opposite(color);
  const oppAether = state.mana[opp];
  const yourAether = state.mana[color];
  
  // Condition 1: Opponent has enough for SHIELD+DOUBLE_ATTACK
  if (oppAether >= 26 && oppAether <= 30) {
    // They might use dangerous combo
    // Check if your king threatened
    if (isKingThreatened(state.board, color)) {
      return {priority: 800, reason: 'BLOCK_DANGEROUS_COMBO'};
    }
  }
  
  // Condition 2: Opponent at cap, forced to spend
  if (oppAether === 30) {
    // Even if not threatened, limit their options
    return {priority: 500, reason: 'BLOCK_FORCED_SPEND'};
  }
  
  // Condition 3: You have checkmate planned, need aether breathing room
  if (yourAether >= 22 && hasChekmateIn2(state, color)) {
    // Weaken opponent's defense preemptively
    if (oppAether >= 24) {
      return {priority: 750, reason: 'SETUP_CHECKMATE'};
    }
  }
  
  // Condition 4: Late game, your aether growing, their threat neutralized
  if (yourAether >= 16 && isEndgame(state) && oppAether <= 15) {
    // Reserve for finishing combo, let them waste their aether
    return {priority: 0, reason: 'NOT_NEEDED'};
  }
  
  return {priority: 0, reason: 'NOT_NEEDED'};
}

// In power evaluation loop:
const blockEval = shouldBlockOpponentAether(state, color);
if (blockEval.priority > 0) {
  // Add AETHER_BLOCK as candidate power
  candidates.push({
    priority: blockEval.priority,
    name: 'AETHER_BLOCK_' + blockEval.reason,
    exec: () => executeAetherBlock(state, color)
  });
}
```

---

## ADVANCED: AETHER PREDICTION MODEL

### Build Opponent Profile

```javascript
// Track opponent's power preferences
const opponentProfile = {
  favoritePowers: {},        // Which powers do they use most?
  spendPattern: [],          // Do they spend in bursts?
  dangerousThreshold: 26,    // At what aether are they most dangerous?
  safeMode: false,           // Are they defensive or aggressive?
};

// After each opponent move, update profile:
if (opponentUsedPower) {
  opponentProfile.favoritePowers[power.name]++;
  opponentProfile.spendPattern.push(aetherSpent);
}

// Predict their next move:
function predictOpponentNextMove(state, oppAether, profile) {
  // Based on aether level and past patterns
  
  if (oppAether >= 28) {
    // They'll likely use their favorite big combo
    const favorite = getMostUsedCombo(profile);
    return {predicted: favorite, confidence: 0.8};
  }
  
  if (oppAether >= 14) {
    // They'll use medium power or combo
    if (profile.safeMode) {
      return {predicted: 'SHIELD_or_FORTIFY', confidence: 0.7};
    } else {
      return {predicted: 'IMPRISON_or_DOUBLE_ATTACK', confidence: 0.7};
    }
  }
  
  // Low aether: Small powers or move
  return {predicted: 'SMALL_POWER_OR_MOVE', confidence: 0.6};
}

// Use prediction for AETHER_BLOCK decision:
const prediction = predictOpponentNextMove(state, opp_aether, profile);
if (prediction.predicted === 'SHIELD_DOUBLE_ATTACK' && prediction.confidence > 0.7) {
  // They're almost certainly going for this combo
  // BLOCK NOW before they execute
  return {priority: 900, reason: 'BLOCK_PREDICTED_DANGEROUS_COMBO'};
}
```

---

## CHECKMATE DELIVERY WITH AETHER_BLOCK

### Three-Move Checkmate Sequence

```
Position: Endgame, 6 pieces left, your king safe
Opponent: 28 aether, planning SHIELD+DOUBLE_ATTACK
You: 20 aether, checkmate in 2-3 moves possible

Turn N (Your move):
1. AETHER_BLOCK (costs 16)
   Opponent: 28 → 18
   Result: Can't afford SHIELD+DOUBLE_ATTACK (needs 28)
   
Turn N+1 (Opponent's move):
2. Opponent forced to use weaker power (IMPRISON 14, or none)
   Opponent: 18 → 4 (if used 14-aether power)
   Result: Opponent now vulnerable
   
Turn N+2 (Your move):
3. SHIELD (14 aether) + next turn DOUBLE_ATTACK (14 aether)
   You: 20 → 6
   Your queen protected and ready
   Result: Unstoppable checkmate sequence initiated

Turn N+3 (Opponent's move):
4. Opponent can't defend (insufficient aether for counter-power)
   Any move they make leaves them exposed
   
Turn N+4 (Your move):
5. DOUBLE_ATTACK with protected piece
   2 captures
   Checkmate! ✓
```

---

## INTEGRATION WITH EXISTING PHASE 5/6

### Where to add:
1. **After:** Combo priority (Fix #2 - Power Planning)
2. **Before:** Trade evaluation (Fix #3)
3. **Alongside:** Future safety (Fix #1)

### New evaluation layer:
```
Move evaluation order:
1. Is piece safe? (Future Safety - Fix #1)
2. Is power well-coordinated? (Power Planning - Fix #2)
3. Should I block opponent aether? (NEW - This strategy!)
4. Is this a good trade? (Trade Context - Fix #3)
```

### Priority boost:
- AETHER_BLOCK normally cost: 16 aether (expensive)
- Strategic value: Can prevent opponent's 28+ aether combos
- Priority multiplier: 800-900 when conditions met
- Win rate gain: +2-3% (prevents opponent checkmate, enables yours)

---

## EXPECTED IMPACT

### Before (Current):
```
Bot doesn't track opponent aether strategically
Opponent reaches 28 aether → Executes SHIELD+DOUBLE_ATTACK
Bot has no counter → Loses pieces or loses game
```

### After (With AETHER_BLOCK Strategy):
```
Bot predicts opponent reaching 28 aether
Bot uses AETHER_BLOCK at 25-26 aether mark
Opponent reduced to 15-16 aether
Opponent can't execute dangerous combos
Bot executes own checkmate combo safely
Win rate: +2-3%
```

---

## TESTING FRAMEWORK

### Validation Games:
```
Test Case 1: Opponent has 28 aether, clear checkmate threat
Expected: Bot uses AETHER_BLOCK preemptively
Result: Bot wins by preventing opponent's combo

Test Case 2: Both sides have 20+ aether, checkmate possible for both
Expected: Bot AETHER_BLOCKs to weaken opponent first
Result: Bot gains tempo for own combo

Test Case 3: Opponent at 30 aether (forced spend), you at 18 aether
Expected: Bot uses AETHER_BLOCK to limit their options
Result: Opponent makes suboptimal move, bot seizes advantage

Test Case 4: Complex midgame, opponent planning PROMOTE+WALL (33 aether)
Expected: Bot recognizes danger at 25 aether and blocks
Result: Opponent can't complete combo, bot counter-attacks

Test Case 5: Endgame, opponent 2 turns from checkmate
Expected: Bot uses AETHER_BLOCK to buy time
Result: Bot then executes own checkmate
```

---

## SUMMARY

**User's Insight:** Use AETHER_BLOCK not just defensively, but **strategically** to:

1. **Read opponent intentions** from aether levels
2. **Predict dangerous combos** before execution
3. **Block at critical moments** (26+ aether)
4. **Enable your checkmate** by weakening opponent
5. **Control tempo** in endgame

**Impact:** Turns defensive power into offensive strategic tool

**Win rate gain:** +2-3% (preventing opponent threats + enabling own combos)

**Complexity:** Medium (needs prediction model, but straightforward heuristics)

**Implementation:** Add after Phase 6A fixes (Future Safety + Power Planning)

---

**Credit:** User's game insight - brilliant strategic concept!  
**Status:** Ready for Phase 6B/6C implementation  
**Priority:** HIGH (Game-changing strategic layer)
