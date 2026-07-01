# NOVA GAMBIT BOT IMPLEMENTATION CHECKLIST

## Objective
This checklist ensures the chess bot correctly implements all 13 aether powers with proper priority weighting, synergy recognition, and game-phase awareness.

---

## 1. POWER PRIORITY FRAMEWORK

### ✅ Phase Detection
- [ ] Bot correctly identifies game phase:
  - Opening: Turns 1-10 (aether gen: +1/turn, total: ~10 by end)
  - Early Middlegame: Turns 11-15 (aether gen: +2/turn, total: ~20 by end)
  - Late Middlegame: Turns 16-25 (aether gen: +2/turn, total: ~30 capped by end)
  - Endgame: Turns 26+ (aether gen: +3/turn baseline, capped at 30)

### ✅ Base Priority Calculation
- [ ] Each power has base priority score calculated based on:
  - Target value (for offensive powers)
  - Piece safety (for defensive powers)
  - Positional advantage gained
  - Aether efficiency (cost vs. value)

### ✅ Multiplier Application
- [ ] Four multipliers applied to base priority:
  1. **Phase Multiplier** (0.1x to 2.0x):
     - Opening: Most powers penalized (expensive, no aether)
     - Early Mid: Balanced (aether flowing, powers affordable)
     - Late Mid: Tactical peak (expensive powers viable)
     - Endgame: Expensive powers prioritized (aether at cap)
  
  2. **Material Multiplier** (0.5x to 2.0x):
     - Up 300+: Consolidate (reduce offensive priority)
     - Balanced: Tactical (use powers freely)
     - Down 300+: Desperate (maximize offensive powers)
  
  3. **Threat Multiplier** (0.1x to 2.0x):
     - Safe: Reduce priority (no urgency)
     - Medium threat: Balanced
     - Checkmate threat: Defensive powers boosted
  
  4. **Aether Efficiency Multiplier** (0.5x to 1.5x):
     - 0-13: Powers unavailable
     - 14-19: Cheap to mid-tier powers viable
     - 20-25: All powers viable
     - 26-30: Expensive powers prioritized (cap relief)

### ✅ Final Priority = Base × Phase × Material × Threat × Aether

---

## 2. POWER-SPECIFIC IMPLEMENTATION

### FROST (8 aether)
- [ ] **Target Selection:**
  - Scan all opponent pieces
  - Calculate target value (Queen/Rook/Bishop/Knight/Pawn)
  - If Pawn on 7th rank: +750 priority bonus (OVERRIDE)
  - If piece attacks our King: +150 priority bonus
  - If piece is only defender of opponent King: +200 priority bonus
  
- [ ] **Priority Calculation:**
  ```
  frostScore = targetValue * 0.06 + bonuses
  threshold: 200 (late mid/endgame), 350 (mid)
  ```

- [ ] **Validation:**
  - Target is not frozen already
  - Target is not imprisoned already
  - Target is not spectral pawn (immune)
  - We're not in check

### FORTIFY (14 aether)
- [ ] **Target Selection:**
  - Own pieces under 2+ attack
  - Piece value >= 300 (Rook+)
  - Checkmate delivery piece (even if value 5)
  - Passed pawn 6th-7th rank (value 100, exception)
  
- [ ] **Priority Calculation:**
  ```
  baseVal = (piece_value * 0.60) + 250 if defensive
  baseVal = (piece_value * 0.75) + 280 if offensive (Queen attacking)
  bonuses: +100 if removes fork, +150 if enables checkmate
  threshold: 200
  ```

- [ ] **Validation:**
  - Piece not already shielded
  - Piece not frozen/imprisoned
  - We're not in check

### SPAWN (6 aether)
- [ ] **Target Selection:**
  - Opponent passed pawn on 5-6th rank (blocking priority 70)
  - We're at aether cap 26-30 (dump priority 40)
  - We're in King danger with no other defense (priority 50)
  
- [ ] **Priority Calculation:**
  ```
  baseScore = 0 (almost never cast)
  IF pawn_6_rank: +70 bonus
  IF aether_capped: +40 bonus
  IF king_threatened: +30 bonus
  threshold: 40 (hard mode only)
  ```

- [ ] **Validation:**
  - Adjacent empty square exists
  - Spectral pawn doesn't block existing pawn
  - We're not in check

### BLINK (8 aether)
- [ ] **Target Selection:**
  - Our piece in bomb radius (detonates in 1-2 turns)
  - Our piece attacked with no legal move escape
  - Endgame King approaching (reduce distance to opponent King by 3+)
  - Fountain occupation (aether generation boost)
  
- [ ] **Priority Calculation:**
  ```
  IF bomb_threat: +150 priority + urgency bonus
  IF escape: piece_value * 0.3
  IF fountain: +100 priority
  IF endgame_approach: (distance_before - distance_after) * 30
  threshold: 50
  ```

- [ ] **Validation:**
  - Destination not occupied
  - Destination not en prise (unless defended or piece high value)
  - Destination doesn't deliver checkmate (illegal)
  - We're not in check

### IMPRISON (14 aether)
- [ ] **Target Selection:**
  - Scan all adjacent squares (8 directions)
  - Find opponent pieces within reach
  - Prioritize: Queen (900) > Rook (500) > Bishop/Knight (320) > Pawn (100)
  - Secondary: Remove defender of key square
  
- [ ] **Priority Calculation:**
  ```
  baseScore = piece_value * 0.60 + 250
  bonuses:
    +100 if removes defender + enables capture
    +80 if target only defender of enemy King
    +50 if target attacking our King
  threshold: 200 (mid-game), 100 (hard mode aggressive)
  ```

- [ ] **Validation:**
  - Captor piece (our piece) is not frozen/imprisoned
  - Target not already imprisoned
  - Captor will survive (not immediately recaptured)
  - Imprisonment actually possible (target adjacent)
  - We're not in check

### AETHER_BLOCK (16 aether)
- [ ] **Trigger Conditions:**
  - Opponent aether >= 18 (can afford Vengeance/Wall/Chronobreak)
  - Opponent aether >= 15 (can afford Promote)
  - Opponent aether >= 14 (can afford mid-tier powers)
  - We have lethal move lined up (capture/checkmate)
  
- [ ] **Priority Calculation:**
  ```
  IF oppAether >= 18: priority = 70
  IF oppAether >= 15: priority = 55
  IF oppAether >= 14: priority = 40
  IF oppAether < 8: priority = 0
  
  bonuses: +20 if we have lethal capture
  penalties: -25 if we're in saving zone (aether 10-15)
  ```

- [ ] **Validation:**
  - Opponent aether > 13 (otherwise wasteful)
  - We have 16 aether (can afford)
  - We're not in check

### CLEANSE (14 aether)
- [ ] **Target Selection:**
  - Our pieces frozen (prioritize high-value)
  - Our pieces imprisoned (prioritize high-value)
  - Our Queen/Rook shields (remove if enabling capture)
  - Endgame pawns frozen on 6-7th rank
  
- [ ] **Priority Calculation:**
  ```
  IF queen_frozen: priority = (900 * 0.8) * 0.20 = 144
  IF rook_frozen: priority = (500 * 0.8) * 0.20 = 80
  IF pawn_race (endgame): (100 * 0.5 + 180) * 0.20 = 56
  bonuses: +80 if enables checkmate
  threshold: 40
  ```

- [ ] **Validation:**
  - Our piece actually frozen/imprisoned
  - We're not in check
  - Freed piece has beneficial moves after

### BOMBA (14 aether)
- [ ] **Placement Selection:**
  - Must place on empty square adjacent to friendly non-spectral pawn
  - Scan for opponent King in 3×3 radius (value +150)
  - Scan for unshielded pieces in blast radius (value = piece_value per piece)
  - Calculate total blast value
  
- [ ] **Priority Calculation:**
  ```
  blastValue = sum(unshielded_opponent_pieces_in_3x3)
  priority = blastValue * 0.12
  bonuses:
    +200 if opponent King in radius
    +100 if King escape squares <= 3
    +80 if bomb central (d4/e4/d5/e5)
  penalties:
    -50 per shield in radius
    -150 if opponent has Chronobreak (can undo)
  threshold: 60 (mid), 25 (hard mode)
  ```

- [ ] **Validation:**
  - Valid pawn anchor exists
  - Placement doesn't give check to opponent
  - Detonation won't destroy our pieces
  - We're not in check

### DOUBLE_ATTACK (14 aether)
- [ ] **Sequence Selection:**
  - Find our pieces that can make 2 consecutive captures
  - Scan all 2-capture sequences within reach
  - Calculate total material value of both captures
  - Verify both captures are undefended (or defended evenly)
  
- [ ] **Priority Calculation:**
  ```
  daScore = capture1_value + capture2_value + bonuses
  priority = daScore * 0.40 + 250
  bonuses:
    +150 if Queen captured
    +100 if both undefended
    +80 if creates mating attack
  penalties:
    -100 if first capture recaptured (net loss)
  threshold: 100 (hard mode), 150 (medium)
  ```

- [ ] **Validation:**
  - Our piece can reach both targets
  - Both captures are legal (not blocked)
  - At least first capture is undefended (or high ROI)
  - Sequence ends safely (attacker not left hanging)
  - We're not in check
  - Doesn't deliver checkmate (illegal)

### PROMOTE (15 aether)
- [ ] **Pawn Selection:**
  - Find our pawns on 6th rank (white) / 3rd rank (black)
  - Check pawn is not blocked (path to 7th/2nd clear)
  - Check pawn is not frozen
  - Verify opponent aether < 18 (cannot Vengeance new Queen)
  
- [ ] **Priority Calculation:**
  ```
  safeDist = distance_to_promotion_square (0 if 6th)
  basePriority = 80 + (7 - safeDist) * 15
  multipliers:
    * 2.0 if checkmate delivery
    * 1.5 if pawn on 6th + safe
    * 1.0 if pawn on 6th + threatened
    * 0.2 if opponent 18+ aether (Vengeance threat)
  threshold: 250 (if safe), 50 (if threatened)
  ```

- [ ] **Validation:**
  - Pawn not spectral (cannot promote)
  - King not in check
  - Pawn path not blocked
  - Pawn not frozen/imprisoned
  - Doesn't deliver checkmate (illegal)

### VENGEANCE (18 aether)
- [ ] **Target Selection:**
  - Opponent pawn on 7th rank (PRIORITY 1, +750 bonus)
  - Opponent Queen/Rook undefended (PRIORITY 2)
  - Opponent piece attacking our King (PRIORITY 3)
  - Opponent only defender of their King (PRIORITY 4)
  
- [ ] **Priority Calculation:**
  ```
  baseScore = piece_value * phase_multiplier
  IF pawn_7th_rank: priority += 750 (OVERRIDE)
  IF queen_undefended: baseScore = 900 * 0.27 = 243
  IF rook_undefended: baseScore = 500 * 0.27 = 135
  IF bishop_knight: baseScore = 320 * 0.27 = 86
  threshold: 300 (mid), 100 (endgame)
  ```

- [ ] **Validation:**
  - Target not King (illegal)
  - We're not in check
  - Doesn't deliver checkmate (illegal)

### WALL (18 aether)
- [ ] **Anchor Selection:**
  - Our King (create fortress)
  - Our Rook/Queen (protect from attack)
  - Opponent King (restrict escape)
  - Passed pawn (create promotion barrier)
  
- [ ] **Wall Direction Selection:**
  - N/S/E/W from anchor piece
  - Choose direction with 2-3 empty adjacent squares
  - Spawn pawns in forward direction (toward enemy)
  
- [ ] **Priority Calculation:**
  ```
  IF king_mating_net: priority = 200 (restricted to <3 squares)
  IF passed_pawn_6th: priority = 150
  IF fortress_defense: priority = 100
  IF strategic_position: priority = 80
  multipliers:
    * 1.5 if endgame (< 6 pieces)
    * 0.5 if opening (insufficient pieces)
  threshold: 60
  ```

- [ ] **Validation:**
  - Wall doesn't give check to opponent
  - At least 2 empty squares exist in direction
  - Anchor piece is not King (special rules)
  - We're not in check

### CHRONOBREAK (20 aether)
- [ ] **Trigger Conditions:**
  - Opponent just captured our Queen (900 value, ROI: 45x)
  - Opponent just captured our Rook (500 value, ROI: 25x)
  - Opponent just made mating attack
  - Opponent has 2+ pieces capturing our pieces (combo loss)
  
- [ ] **Priority Calculation:**
  ```
  IF queen_captured: priority = 900 * 0.30 = 270
  IF rook_captured: priority = 500 * 0.30 = 150
  IF mating_threat: priority = 200
  IF multi_piece_loss: priority = 100 + (total_value * 0.15)
  multipliers:
    * 1.5 if endgame (fewer pieces, more valuable each)
    * 0.5 if mid-game, only pawn lost
  threshold: 200 (mid), 100 (endgame)
  ```

- [ ] **Validation:**
  - Opponent made a move (history length > 0)
  - Material swing > 200 (at minimum)
  - We're not in check (from before rewind)

---

## 3. SYNERGY DETECTION

### ✅ Tier S Synergies
- [ ] FROST + IMPRISON
  - Freeze piece (8) → Next turn imprison (14) = 22 aether
  - Detect: Adjacent prisoner + frozen target
  - Boost: +100 priority to next-turn imprison
  
- [ ] FORTIFY + DOUBLE_ATTACK
  - Shield piece (14) → Double attack (14) = 28 aether
  - Detect: Multiple captures + piece under attack
  - Boost: +50 priority if shield makes sequence safe
  
- [ ] AETHER_BLOCK + VENGEANCE
  - Block opponent (16) → Vengeance (18) = 34 aether
  - Detect: Opponent 18+ aether + lethal capture available
  - Boost: +100 priority to Vengeance next turn
  
- [ ] WALL + PROMOTE
  - Wall (18) → Promote (15) = 33 aether
  - Detect: Pawn 5-6th rank + opponent threatening promotion square
  - Boost: +150 priority if combo available

### ✅ Anti-Synergies (NEVER Chain)
- [ ] CHRONOBREAK + CHRONOBREAK
  - Opponent gets free reset, wastes our power
  - Block: If opponent has Chronobreak available, reduce our Chronobreak priority

- [ ] DOUBLE_ATTACK + VENGEANCE
  - Both end turn, cannot chain
  - Block: Only evaluate one or the other

- [ ] WALL + BLINK
  - Wall ends turn, Blink cannot follow
  - Block: Use Blink on current turn, Wall on next

---

## 4. AETHER ECONOMY SYSTEM

### ✅ Generation Tracking
- [ ] Track aether per turn:
  - Baseline: +1/turn (opening), +2/turn (mid), +3/turn (late)
  - Per fountain controlled: +2/turn (stacks with baseline)
  - Max cap: 30 aether

### ✅ Hoarding Prevention
- [ ] At aether >= 26:
  - Force power casting (cannot be idle)
  - Prioritize powers >= 15 cost (Promote/Vengeance/Wall)
  - Penalty: -50 priority for any power < 15 cost (save them for gap filling)

### ✅ Spending Policy
- [ ] Aether 0-13: NO powers (accumulate only)
- [ ] Aether 14-19: Cheap/mid-tier powers OK (Frost/Imprison/Double)
- [ ] Aether 20-25: All powers OK (balanced)
- [ ] Aether 26-30: Aggressive spending (dump expensive powers)

### ✅ Sacrifice Strategy
- [ ] Pawn sacrifice: +6 aether for -100 material (justified if enables 1 power)
- [ ] Knight sacrifice: +5 aether for -320 material (poor trade, avoid)
- [ ] Rook sacrifice: +4 aether for -500 material (catastrophic, only last resort)
- [ ] Trigger sacrifice when:
  - Aether needed for critical power
  - Pawn is weak/blocked anyway
  - Fountain opportunity requires material outlay

---

## 5. GAME PHASE TRANSITIONS

### ✅ Opening → Early Middlegame (Turn 11)
- [ ] Shift from development to power usage
- [ ] Increase power evaluation frequency (every turn)
- [ ] Start considering Frost/Imprison on valuable targets
- [ ] Begin fountain control contest

### ✅ Early Middlegame → Late Middlegame (Turn 16)
- [ ] Start hoarding for expensive powers (15-20 cost)
- [ ] Increase Promote/Vengeance consideration
- [ ] Shift from cheap powers to high-impact powers
- [ ] Intensify fountain control battles

### ✅ Late Middlegame → Endgame (Turn 26)
- [ ] Aether reaches cap (30)
- [ ] MUST dump aether every turn
- [ ] Shift from accumulation to spending
- [ ] Prioritize material-conversion powers (Promote/Vengeance)

### ✅ Endgame Continuation (Turn 31+)
- [ ] Permanently at aether cap (3/turn generation)
- [ ] Focus on pawn races (Promote/Frost/Vengeance on pawns)
- [ ] Mating net construction (Wall/Imprison/Blink King approach)
- [ ] King distance calculation paramount

---

## 6. THREAT ASSESSMENT

### ✅ Checkmate Detection
- [ ] Check if opponent has mate in 1 move
- [ ] Check if opponent has mate in 2 moves (our turn limited options)
- [ ] If mate in 1: Priority = 0 for all powers except those that resolve mate
- [ ] If mate in 2: Boost defensive power priority ×2.0

### ✅ Material Threat Calculation
- [ ] For each opponent piece: Calculate if undefended
- [ ] Calculate material swing if piece captured (positive swing = threat)
- [ ] If threat > 300: Boost defensive power priority ×1.5

### ✅ King Safety Scoring
- [ ] Count escape squares for our King
- [ ] Count attacking pieces vs defending pieces
- [ ] If escape squares <= 2: Boost defensive priority
- [ ] If King in check: Require defensive power only

### ✅ Passed Pawn Threat
- [ ] Detect opponent pawns 5+ rank (advancement)
- [ ] Pawn 7th rank: CRITICAL (override all priorities)
- [ ] Pawn 6th rank: HIGH (freeze/Frost/Vengeance)
- [ ] Pawn 5th rank: MEDIUM (prepare defense)

---

## 7. VALIDATION LAYER

### ✅ Power Legality Checks
- [ ] For each power:
  - Can afford (aether >= cost)?
  - Our King not in check?
  - Targeting valid squares (occupied/empty as required)?
  - Doesn't deliver checkmate (illegal)?
  - Doesn't leave us in check?

### ✅ Board State Checks
- [ ] All piece positions valid
- [ ] No phantom pieces in blast radius
- [ ] Frozen/imprisoned pieces tracked correctly
- [ ] Shields applied and tracked
- [ ] Bombs planted and detonation timers correct

### ✅ History Tracking
- [ ] Previous turn recorded
- [ ] Power casting history (for Chronobreak evaluation)
- [ ] Material changes logged
- [ ] Aether changes logged

---

## 8. HARD MODE SPECIFIC TUNING

### ✅ Aggressive Multipliers
- [ ] IMPRISON: Threshold lowered to 100 (was 200)
- [ ] DOUBLE_ATTACK: Threshold lowered to 100 (was 150)
- [ ] PROMOTE: Threshold lowered to 200 (was 250)
- [ ] VENGEANCE: Threshold lowered to 200 (was 300)

### ✅ Combo Recognition
- [ ] Detect and prioritize Tier S synergies
- [ ] +100 priority boost for recognized combos next turn

### ✅ Fountain Control
- [ ] Aggressively contest fountains (sacrifice Pawn if ROI >= 100)
- [ ] Calculate fountain value: +2/turn × remaining_turns = total_aether
- [ ] Fountain on 6th rank worth +10 priority (promotion threat)

### ✅ Threat Anticipation
- [ ] Look ahead 2-3 turns for opponent threats
- [ ] Pre-cast defensive powers if checkmate threat emerging
- [ ] Pre-cast Frost on pieces that will threaten next turn

### ✅ King Safety
- [ ] If King has <= 2 escape squares: Defensive priority ×2.0
- [ ] Never leave King corner (1 escape square)
- [ ] Maintain 1-2 defenders near King at all times

---

## IMPLEMENTATION VERIFICATION CHECKLIST

### Phase 1: Power Framework
- [ ] All 13 powers have base priority calculation
- [ ] Phase multiplier applied correctly
- [ ] Material multiplier applied correctly
- [ ] Threat multiplier applied correctly
- [ ] Final priority = base × all multipliers

### Phase 2: Individual Powers
- [ ] FROST: Scans all opponent pieces, calculates target value, applies bonuses
- [ ] IMPRISON: Finds adjacent targets, prioritizes by value
- [ ] DOUBLE_ATTACK: Finds 2-capture sequences, validates defense status
- [ ] PROMOTE: Checks pawn state, opponent aether, threat level
- [ ] VENGEANCE: Prioritizes pawn 7th, then Queen/Rook
- [ ] WALL: Calculates fortress value, King safety value
- [ ] CHRONOBREAK: Detects material loss > 400
- [ ] (Remaining 5 powers similarly verified)

### Phase 3: Synergy Detection
- [ ] Tier S synergies recognized and boosted
- [ ] Anti-synergies blocked
- [ ] Multi-turn setups anticipated

### Phase 4: Aether Economy
- [ ] Generation tracked per turn
- [ ] Cap (30) enforced
- [ ] Hoarding penalty applied
- [ ] Spending policy enforced

### Phase 5: Game Phase Transitions
- [ ] Phase correctly identified
- [ ] Priority multipliers change appropriately
- [ ] Power preferences shift (opening: develop; mid: power; late: dump)

### Phase 6: Validation
- [ ] All powers checked for legality
- [ ] Board state valid after power cast
- [ ] No phantom pieces/effects

### Phase 7: Integration Testing
- [ ] Bot plays 10 games vs itself
- [ ] Verify powers cast in expected order
- [ ] Verify aether economy (never cap-locked)
- [ ] Verify no illegal moves
- [ ] Verify checkmate responses

---

## KNOWN EDGE CASES TO HANDLE

1. **Spectral Pawn Promotion:** Cannot promote spectral pawn (from SPAWN) → Skip
2. **Frozen + Imprisoned:** If frozen piece becomes imprisoned → Both states tracked
3. **Shield + Capture:** If shielded piece captured → Shield absorbed, piece still captured next turn
4. **Chronobreak Loop:** Opponent Chronobreaks us, we Chronobreak them → Only 1 reset per side, not infinite
5. **Bomb in Pawn Radius:** If bomb placed on pawn's advance square → Pawn cannot advance through bomb (defuse or sacrifice)
6. **King in Check + Power:** No power can be cast while King in check → Must move/block first
7. **Capture Sequence Interrupted:** If first capture defended, second cannot happen → Validate before casting
8. **Aether Cap at Exactly 30:** Reaching 30 aether mid-turn → No generation lost if power cast same turn

---

## SUCCESS CRITERIA

- [ ] Bot wins 70%+ vs Easy bot
- [ ] Bot wins 55%+ vs Medium bot
- [ ] Bot competitive vs Hard bot (50%+ winrate)
- [ ] No illegal moves cast
- [ ] Aether never wastes (never reaches 35+)
- [ ] Checkmate threats detected 1-2 turns in advance
- [ ] Passed pawn threats addressed immediately
- [ ] Power combos recognized and executed
- [ ] Game completes without errors/crashes
