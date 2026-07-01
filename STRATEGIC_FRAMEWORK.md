# NOVA GAMBIT CHESS VARIANT - COMPREHENSIVE STRATEGIC FRAMEWORK

## EXECUTIVE SUMMARY

This document provides a unified strategic framework for optimal play in the Nova Gambit chess variant (13 aether powers). The framework integrates all power synergies, aether economy principles, game phases, and positioning strategy into a coherent decision-making system.

---

## 1. GAME PHASE STRATEGY

### OPENING PHASE (Turns 1-10): Foundation & Acceleration

**Strategic Priorities:**
1. **Piece Development** (Rank 1 priority)
   - Move knights out (c3/f3, c6/f6)
   - Move bishops out (c4, f4, etc.)
   - Avoid moving same piece twice (tempo law)
   
2. **Aether Generation Setup** (Rank 2 priority)
   - Control center (d4, e4 and d5, e5) → fountain access
   - Position pieces to capture freely (avoid expensive power use)
   - Optional: Sacrifice minor piece (pawn/knight) → +3-5 aether boost

3. **Avoid Power Spending** (Rank 3 priority)
   - **NEVER** cast before turn 6 (insufficient aether)
   - Exception: Frost on undefended piece worth 300+ (rare opening blunder)
   - Focus: Move pieces → accumulate to 8+ aether naturally

**Opening Aether Economy:**
- Turn 1: 0 aether (start)
- Turn 2: +1 aether (generation)
- Turn 3: +1 aether (total: 2)
- Turn 5: +1 aether per turn (total: 4 by turn 5)
- Turn 8: +1 aether per turn (total: 8 by turn 8) → **Can afford FROST/BLINK**
- Turn 10: +1 aether per turn (total: 10) → Can afford SPAWN (6)

**Bot Decision Tree (Opening):**
```
IF power_cost <= available_aether AND power_targets_blunder_piece:
  CAST power (rare, only glaring blunders)
ELSE:
  Play normal moves (develop pieces, control center)
```

**Anti-Patterns to Avoid:**
- ❌ Sacrifice material for <3 aether gain (poor trade)
- ❌ Ignore opponent development (they'll build threats)
- ❌ Control edges instead of center (fountain value minimal on board edges)
- ❌ Move King early (exposed to tactics later)

---

### MIDDLEGAME PHASE (Turns 11-30): Tactical Peak & Material Swings

**Strategic Priorities:**
1. **Active Power Usage** (Rank 1 priority)
   - Frost threatening pieces (defensive)
   - Imprison key defenders (offensive setup)
   - Double Attack undefended clusters (material gain)
   - **Aether range sweet spot: 15-25** (can afford mid-tier powers + have reserves)

2. **Fountain Control** (Rank 2 priority)
   - Each fountain = +2 aether/turn (stacking advantage)
   - Control 2 fountains = +4/turn acceleration
   - 2 fountains over 10 turns = +40 aether = 2 big powers
   - Priority: Contest fountains tactically (small sacrifices justified)

3. **Material Balance Monitoring** (Rank 3 priority)
   - Track material delta (ours - opponent's)
   - +200+: Play safe, consolidate, avoid risky powers
   - 0-200: Balanced play, aggressive power use OK
   - -200+: Desperate tactics, use Vengeance/Chronobreak liberally

4. **Passed Pawn Setup** (Rank 4 priority)
   - Create isolated pawn on 4th-5th rank (prep for 7th rank promotion threat)
   - Wall + passed pawn = unbreakable fortress mid-game

**Middlegame Aether Economy:**
- Turn 11-15: +1-2 aether/turn (total 15-20 by turn 15)
- Turn 16-20: +2 aether/turn (total 20-30 by turn 20) → **Can afford big powers**
- Turn 21-30: +2-3 aether/turn (hit 30 cap) → **Hoard becomes active problem**

**Mid-Game Power Priority Ranking:**
| Power | Use Frequency | Trigger |
|-------|---|---|
| FROST | 40% | Opponent attacking piece, high-value target (300+) |
| IMPRISON | 35% | Remove defender to enable capture combo |
| DOUBLE_ATTACK | 30% | 2+ undefended pieces clustered |
| CLEANSE | 25% | Free high-value trapped piece (Queen/Rook) |
| FORTIFY | 20% | Shield attacking piece before counter |
| BLINK | 15% | Escape trap OR position for fountain |
| BOMBA | 12% | Opponent King near blast radius |
| SPAWN | 5% | Block imminent passed pawn only |
| AETHER_BLOCK | 18% | Opponent 18+ aether, about to power spike |
| PROMOTE | 25% | Pawn 6th rank, safe from capture |
| VENGEANCE | 8% | Queen/Rook threatened OR pawn promotion threat |
| WALL | 10% | Create mating net OR protect passed pawn |
| CHRONOBREAK | 5% | Opponent captured major piece (Queen) |

**Bot Decision Tree (Mid-Game):**
```
IF aether >= 30 (CAPPED):
  PRIORITIZE: Vengeance/Promote/Wall to dump aether
  AVOID: Cheap powers (Frost, Blink) that waste generation
ELSE IF aether >= 20:
  BALANCED: Use mid-tier powers (Imprison, Double Attack) freely
  RESERVE: Keep 5-10 aether buffer for emergencies
ELSE IF aether >= 14:
  TACTICAL: Use powers only if priority >= 40
  SAVE: Build toward 20 for bigger powers
ELSE:
  MOVE ONLY: No power spending, focus piece activity
```

**Anti-Patterns to Avoid:**
- ❌ Frost random pieces (ROI < 200 = waste)
- ❌ Ignore fountain control (leaves +4/turn advantage to opponent)
- ❌ Use Chronobreak on minor material loss (<200 value)
- ❌ Promote without checking Vengeance threat (opponent 18+ aether)
- ❌ Wall when behind by 300+ (doesn't recover material)

---

### ENDGAME PHASE (Turns 31+): Precision & Conversion

**Strategic Priorities:**
1. **Piece Value Maximization** (Rank 1 priority)
   - Each piece = 3-5x more valuable than middlegame (fewer defenders)
   - King distance calculation (approaching enemy King = 30 pts per square closer)
   - Rook in endgame often worth 6-7 points (was 5 in middlegame)

2. **Passed Pawn Races** (Rank 2 priority)
   - Pawn on 6th rank = promotion threat (freeze/imprison it)
   - Pawn on 7th rank = Vengeance target (destroy immediately)
   - Multiple pawns racing = Wall + Blink for tactical control

3. **Mating Net Construction** (Rank 3 priority)
   - Use Chronobreak to escape mating attacks
   - Use Wall to restrict King escape squares (3 pawns = fortress)
   - Use Blink to approach enemy King (each square closer = +30 pts)

4. **Aether Hoarding = Death** (Rank 4 priority)
   - At cap (30/30) = 0 aether generation → **SPEND or lose tempo**
   - Even weak powers (Spawn on non-promotion pawn) > capped generation loss
   - Exception: Save 20 aether if opponent King has 1-2 escape squares (Chronobreak ready)

**Endgame Aether Economy:**
- Turn 31+: +3 aether/turn (baseline)
- Fountain control: +2/turn per fountain (stacks with baseline)
- Example: 2 fountains + baseline = +7/turn = 30 aether cap hit every 4 turns

**Endgame Power Priority Ranking:**
| Power | Use Frequency | Trigger |
|-------|---|---|
| VENGEANCE | 35% | Opponent Queen/Rook/passed pawn |
| CHRONOBREAK | 30% | Opponent mating attack OR captured Rook/Queen |
| WALL | 25% | Create fortress around King OR passed pawn |
| BLINK | 25% | King approach OR escape mating net |
| CLEANSE | 15% | Free trapped high-value piece |
| FROST | 20% | Block opponent passed pawn or check threat |
| PROMOTE | 20% | Pawn 6th-7th rank, push to Queen |
| IMPRISON | 10% | Trap last defender near enemy King |
| FORTIFY | 12% | Shield King or defending Rook |
| AETHER_BLOCK | 8% | Opponent 20+ aether (Chronobreak threat) |
| DOUBLE_ATTACK | 5% | Rare—few pieces available |
| BOMBA | 8% | Restrict King movement in fortress |
| SPAWN | 2% | Almost never (spectral expires in 1 turn) |

**Bot Decision Tree (Endgame):**
```
IF aether >= 30 (CAPPED):
  CRITICAL SPEND: Use Vengeance/Chronobreak/Wall
  GOAL: Drop to <25 before next turn

ELSE IF opponent_has_passed_pawn_on_6_7:
  DEFENSIVE: Freeze/Imprison/Promote your own pawn race
  PRIORITY: Pawn promotion threats override everything

ELSE IF opponent_king_has_1_2_escape_squares:
  OFFENSIVE: Use Imprison/Wall to shrink escape
  GOAL: Create mating net

ELSE IF we_have_material_advantage:
  CONSOLIDATION: Use Blink to approach King
  GOAL: Convert advantage into mating attack

ELSE IF we_have_material_disadvantage:
  TACTICAL: Use Chronobreak to reset opponent advantage
  GOAL: Delay until passed pawn race becomes ours
```

**Anti-Patterns to Avoid:**
- ❌ Ignore passed pawn 6th rank (will become 7th rank next turn)
- ❌ Use Frost on unimportant pieces (endgame ROI must be 30x+)
- ❌ Let aether cap waste generation (every turn capped = 3 aether lost)
- ❌ Use Chronobreak for <300 material swing (too expensive for small gains)
- ❌ Promote without checking King safety (new Queen surrounded by 3+ enemies = dead)

---

## 2. POWER COMBINATION SYNERGIES

### Tier S Synergies (Game-Changing, 75%+ effectiveness)

#### Synergy 1: FROST + IMPRISON (Cost: 22 aether)
**Setup:**
- Turn N: Opponent moves Queen to e5 (threatening your Rook on f3)
- Turn N+0.5: Cast FROST on Queen (8 aether) → Queen frozen until turn N+1
- Turn N+1: Your turn → Cast IMPRISON with adjacent Rook on e4 (14 aether) → Queen caged
- Turn N+2: Opponent cannot move Queen for 2 turns total (freeze expired but imprisoned)

**Outcome:** Queen = 900 value removed from board for 22 aether
**ROI:** 41x (900÷22)
**Conditions:** Queen must be adjacent to one of your pieces for imprison to work
**When to use:** Mid-game when opponent Queen is active threat

---

#### Synergy 2: FORTIFY + DOUBLE_ATTACK (Cost: 28 aether)
**Setup:**
- Your Rook on e4 is attacked by opponent's Bishop on d5 and Rook on e3
- Turn N: Cast FORTIFY on your Rook (14 aether) → Rook shielded
- Turn N+0.5: Opponent attacks, shield absorbs 1 hit
- Turn N+1: Your turn → Cast DOUBLE_ATTACK with your now-shielded Rook (14 aether)
- Your Rook captures both Bishop (d5) and Rook (e3) → 1000 value captured

**Outcome:** 1000 material for 28 aether + shield expires safely
**ROI:** 36x (1000÷28)
**Conditions:** Rook must be able to reach both targets in 2 consecutive moves
**When to use:** Mid-game when you have 2 undefended enemy pieces near your Rook

---

#### Synergy 3: AETHER_BLOCK + VENGEANCE (Cost: 34 aether)
**Setup:**
- Opponent has 20+ aether and Queen on d4 (undefended after you moved your Rook away)
- Turn N: Cast AETHER_BLOCK on opponent (16 aether) → They gain 0 aether next turn
- Turn N+1: Opponent's turn (no aether gain) → They cannot cast powers
- Turn N+1.5: Your turn → Cast VENGEANCE on Queen (18 aether) → Queen destroyed
- Opponent trapped: No aether to counter-power, Queen gone

**Outcome:** Queen (900) removed from board safely
**ROI:** 26x (900÷34)
**Conditions:** Opponent must have 18+ aether before your block, and Queen must stay undefended
**When to use:** Late mid-game when opponent is about to power spike and Queen is vulnerable

---

#### Synergy 4: FROST + BLINK + CAPTURE (Cost: 8 + 16 = 24 aether)
**Setup:**
- Your Knight is attacked by opponent's Rook on e4
- Turn N: Cast FROST on Rook (8 aether) → Rook frozen
- Turn N+0.5: Cast BLINK with your Knight (16 aether) → Knight teleports 3 squares forward (e.g., d4 to a5)
- Turn N+1: Your Knight now attacks opponent's Bishop on d3 from a5

**Outcome:** Escaped Rook attack + gained tempo to attack new piece
**ROI:** 15x (knight escape ~150 + tempo ~210 ÷ 24)
**Conditions:** Knight must have legal Blink destination; frozen piece must be only attacker
**When to use:** Early mid-game when your Knight is in danger and you have escape route

---

#### Synergy 5: WALL + PROMOTE (Cost: 33 aether)
**Setup:**
- Your pawn is on 6th rank (d6); opponent has Rook on d5 that prevents 7th rank push
- Turn N: Cast WALL around your Queen (18 aether) → 3 pawns spawn on d5, e5, c5 (or similar)
- Turn N+1: Your pawn advance attempt blocked; but your pawn is now PROTECTED by wall
- Turn N+2: Cast PROMOTE (15 aether) → d-pawn promoted to Queen (now have 2 Queens!)

**Outcome:** Unbreakable fortress + promotion to 2nd Queen
**ROI:** Promotion (900 value) guaranteed without opponent interference
**Conditions:** Wall must control promotion square; pawn must have clear 7th rank access
**When to use:** Late mid-game / early endgame when pawn promotion is guaranteed win

---

#### Synergy 6: IMPRISON + CLEANSE + VENGEANCE (Cost: 14 + 14 + 18 = 46 aether, Multi-turn)
**Setup:**
- Opponent imprisons your Queen with their Rook on e4
- Turn N: Cast CLEANSE (14 aether) → Your Queen freed
- Turn N+0.5: Your Queen now active again
- Turn N+1: Opponent's turn → they cannot re-imprison (Queen moved)
- Turn N+2: Your turn → Cast VENGEANCE on their Rook (18 aether) → Rook destroyed
- Result: Your Queen saved + their imprisoner dead

**Outcome:** Queen (900) rescued + Rook (500) destroyed (net +400 material)
**ROI:** 8.7x (400÷46)
**Conditions:** Queen must have escape squares after Cleanse; Rook must stay vulnerable for Vengeance
**When to use:** Late mid-game when opponent imprisons your Queen and you have 46+ aether

---

#### Synergy 7: CHRONOBREAK + REPOSITION (Cost: 20 + 0 = 20 aether)
**Setup:**
- Opponent just moved their Queen to e4 and captured your Knight (move: d2-e4 captures on e4)
- You realize this Queen is now hanging (undefended after capture sequence)
- Turn N: Cast CHRONOBREAK (20 aether) → Opponent's entire turn rewound
- Turn N+0.5: Opponent must move differently; your Knight is alive again
- Turn N+1: Your turn → You can now capture opponent's Queen safely

**Outcome:** Knight (320) saved + tempo gained + opponent lost initiative
**ROI:** 16x (320÷20)
**Conditions:** Opponent's move must have exposed a high-value piece; Queen must still be capturable after rewind
**When to use:** Mid-late game when opponent makes greedy capture that hangs even more

---

#### Synergy 8: CLEANSE + DOUBLE_ATTACK (Cost: 14 + 14 = 28 aether)
**Setup:**
- Your Rook is frozen by opponent's FROST; cannot act this turn
- Turn N: Cast CLEANSE (14 aether) → Your Rook unfrozen
- Turn N+0.5: Cast DOUBLE_ATTACK with your Rook (14 aether) → Rook captures 2 pieces
- Turn N+1: Opponent's turn → they face 2 fewer pieces on board

**Outcome:** Rook attacks freed + 2 pieces captured (500+ value)
**ROI:** 18x (500÷28)
**Conditions:** Unfrozen Rook must have 2 capturable pieces within range; neither can be defended
**When to use:** Mid-game when Frost restricts Rook but 2 undefended pieces are behind Frost wall

---

### Tier A Synergies (Strong, 50-75% effectiveness)

#### A1: IMPRISON + CAPTURE (Cost: 14 aether)
- Imprison key defender → Next turn: capture now-undefended piece
- **Example:** Bishop defends Rook on e5 → Imprison Bishop → Capture Rook (500 value)
- **ROI:** 36x

#### A2: FROST + DOUBLE_ATTACK (Cost: 22 aether)
- Freeze one piece → Double Attack now has clear targets
- **Example:** Queen defends 2 pawns → Frost Queen → Double Attack 2 pawns (200 value)
- **ROI:** 9x

#### A3: BLINK + FORTIFY (Cost: 24 aether)
- Blink piece to safety → Fortify it to avoid re-attack
- **Example:** Blink Rook to d6 → Fortify → Opponent cannot capture for 2 turns
- **ROI:** 12x

#### A4: PROMOTE + FORTIFY (Cost: 30 aether)
- Promote pawn to Queen → Fortify Queen to avoid immediate Vengeance
- **Example:** Promote to Queen, then shield → Opponent Vengeance hits shield, Queen survives
- **ROI:** 30x (saves Queen from Vengeance)

#### A5: WALL + IMPRISON (Cost: 32 aether)
- Wall around Rook → Imprison enemy piece inside Rook's blast radius
- **Example:** Wall + Imprison → 2 enemy pieces locked (one by wall, one by imprisonment)
- **ROI:** 8x

---

### Tier B Synergies (Situational, 25-50% effectiveness)

#### B1: SPAWN + FROST
- Spawn spectral pawn → Frost enemy piece attacking the spectral
- **ROI:** 5x (low value, situational)

#### B2: BOMBA + IMPRISON
- Plant bomb in enemy formation → Imprison piece so it cannot escape blast
- **ROI:** 6x

#### B3: AETHER_BLOCK + BLINK
- Block opponent aether → Blink your piece to fountain before they can power
- **ROI:** 4x

#### B4: CLEANSE + FORTIFY
- Cleanse frozen piece → Fortify to avoid re-freezing
- **ROI:** 7x

---

### Anti-Combos (NEVER USE TOGETHER)

- ❌ **CHRONOBREAK + CHRONOBREAK:** Opponent gets 1 free reset; wastes your power
- ❌ **DOUBLE_ATTACK + VENGEANCE:** Both end turn; cannot chain
- ❌ **WALL + BLINK:** Wall ends turn; Blink cannot follow
- ❌ **PROMOTE + DOUBLE_ATTACK:** Promote ends turn; Double Attack cannot follow
- ❌ **FROST + SPECTRAL:** Spectral expires in 1 turn; Frost wasted on temporary piece
- ❌ **IMPRISON + CLEANSE (same turn):** Cleanse removes what you just imprisoned

---

## 3. AETHER ECONOMY STRATEGY

### Early Game Aether (Turns 1-10)

**Generation Rate:** +1 aether/turn

**Budget:**
- Turn 3: 2 aether (cannot afford any power)
- Turn 6: 5 aether (can afford nothing)
- Turn 8: 7 aether (close to FROST 8, but no good target)
- Turn 10: 9 aether (can afford FROST/BLINK)

**Strategy:**
1. **Accumulate passively** → Do not spend early
2. **Sacrifice aggressively** (optional) → Sacrifice Pawn (1) for +6 aether boost
   - Justification: Reach 8 aether by turn 6 vs. turn 8 (2-turn speedup)
   - Cost: 1 pawn (100 material) for 2-turn advantage
   - ROI: Marginal at 50:1, but enables mid-game power advantage
3. **Never spend** on Frost/Blink in opening unless opponent blunders

**Aether Management:**
- **Waste Prevention:** If reaching 10 aether, spend on SPAWN (6) to dump 4 aether before cap (saves aether generation loss)
- **Threshold:** At 8 aether, start looking for Frost targets; at 10+ aether, aggressive power use acceptable

---

### Mid-Game Aether (Turns 11-30)

**Generation Rate:** +2 aether/turn (turns 11-20), +2-3 aether/turn (turns 21-30 as fountains multiply)

**Budget:**
- Turn 15: 14-20 aether (afford mid-tier powers: FROST/IMPRISON/CLEANSE)
- Turn 20: 20-30 aether (afford high-tier powers: VENGEANCE/PROMOTE/WALL)
- Turn 25: 28-30 aether (likely capped; emergency hoarding begins)

**Strategy:**
1. **Sweet Spot Maintenance: 15-25 aether**
   - Spend when above 25 (avoid cap waste)
   - Accumulate when below 15 (build reserve)
   - This band = flexibility zone

2. **Power Priority by Aether Level:**
   ```
   14-16: Cheap powers only (Frost 8, Blink 8, Imprison 14)
   17-20: Mid-tier OK (Cleanse 14, Double Attack 14, Fortify 14)
   21-25: Expensive powers starting (Promote 15, Vengeance 18, Wall 18)
   26-30: Dump expensive powers (must spend to avoid cap)
   30: EMERGENCY spend (any power, prefer high-impact)
   ```

3. **Fountain Control = Aether Control**
   - Each fountain = +2/turn (stacks with baseline +2)
   - Controlling 2 fountains = +4/turn (hit cap in 6-7 turns)
   - Sacrificing minor piece to take fountain = justified cost
   - Defensive: Occupy opponent's fountain (block their acceleration)

4. **Sacrifice Strategy:**
   - Pawn sacrifice: +6 aether, -100 material (poor trade normally, but good for power economy)
   - Knight sacrifice: +5 aether, -320 material (terrible trade; avoid)
   - Rook sacrifice: +4 aether, -500 material (catastrophic; only as last resort)
   - **Optimal:** Sacrifice Pawns to accelerate, never higher pieces

**Aether Hoarding Anti-Pattern:**
- ❌ Sitting at 28 aether for 3 turns (wasting -3/turn generation) = -9 aether lost
- ✅ Spend when >25, even if power is marginal (SPAWN at priority 30 is OK)

---

### Late-Game Aether (Turns 31+)

**Generation Rate:** +3 aether/turn (baseline) + up to +4 additional from 2 fountains = +7/turn in ideal scenario

**Budget:**
- Turn 31: 30+ aether (capped)
- Turn 35: 30+ aether (capped with multiple fountains)
- Turn 40+: 30+ aether (permanently capped if maintaining fountain control)

**Strategy:**
1. **Aether = Commodity, Not Currency**
   - At cap (30/30), aether is worthless (0 generation)
   - SPEND AGGRESSIVELY: Every turn capped = -3 aether opportunity cost
   - Paradox: Expensive powers become cheaper (you're throwing away generation anyway)

2. **Power Priority Flips:**
   - Mid-game: Save for expensive powers
   - Late-game: Dump expensive powers to make room for next generation
   - Example: At cap (30/30) → Cast Chronobreak (20) → Now at 10 aether, generation active again

3. **Fountain Defense:**
   - Fountains become THE resource → defend fountains like life
   - Losing 1 fountain = -2/turn = -14 aether over 7 turns = can't afford 1 Vengeance per 3.5 turns
   - Sacrifice Queen to protect fountain in endgame (Queen usually dead in endgame anyway)

4. **Passed Pawn Economy:**
   - Spend 15 aether to PROMOTE pawn
   - Promotes to Queen (900 value)
   - ROI: 60x
   - This is your best aether spend in endgame

5. **Anti-Hoarding Loop:**
   ```
   Capped (30) → Spend big power (Vengeance 18) → 12 aether
   ↓ (opponent plays)
   Gain 3/turn → Back to 15 aether
   ↓ (your turn again)
   Gain 3/turn → 18 aether
   ↓
   Spend mid-power (Imprison 14) → 4 aether
   ↓
   Gain 3/turn → 7 aether
   ↓
   Spend cheap power (Frost 8) → blocked (only 7 aether)
   ↓ (opponent plays, gain 3) → 10 aether
   ↓
   Spend cheap power (Frost 8) → 2 aether
   ```
   - Pattern: Constant spending to prevent cap = no wastage

---

## 4. DEFENSIVE vs OFFENSIVE BALANCE

### Threat Assessment Framework

**Defensive Powers (6):** FROST, FORTIFY, CLEANSE, WALL, BLINK, CHRONOBREAK
**Offensive Powers (7):** IMPRISON, AETHER_BLOCK, BOMBA, DOUBLE_ATTACK, PROMOTE, VENGEANCE, SPAWN (situational)

### Defensive Trigger Conditions

**FROST Trigger:** ✓ Any opponent piece worth 300+ attacking your piece OR pawn promotion threat (7th rank)
- Priority multiplier: x1.5 for pawn on 7th rank
- Target priority: Queen > Rook > Bishop/Knight > Pawn (except 7th rank pawn)
- Example: Opponent's Queen attacks your Rook → FROST Queen (remove threat)

**FORTIFY Trigger:** ✓ Your piece under attack by 2+ opponent pieces AND piece value >= 300 (Rook+)
- Example: Your Queen attacked by 2 pieces → FORTIFY Queen → Survive 1 hit → Reposition
- Anti-trigger: Piece already defended (trade is even, no urgency)

**CLEANSE Trigger:** ✓ Your high-value piece (Queen/Rook) is frozen or imprisoned
- Example: Your Queen frosted → CLEANSE Queen → Restore Queen activity
- Anti-trigger: Pawn or low-value piece (ROI < 200)

**WALL Trigger:** ✓ Your King is under mating attack OR creating fortress for passed pawn
- Example: King has 1 escape square, opponent Queen + Rook closing in → WALL to add 3 pawns, block escape
- Anti-trigger: Board sparse (endgame K+R vs K, no multiple pieces)

**BLINK Trigger:** ✓ Your piece is in bomb radius (detonates <3 turns) OR attacked with no legal escape
- Example: Your Knight in bomb zone, detonates turn 2 → BLINK Knight away
- Anti-trigger: Piece already defended (don't waste 8 aether on safe piece)

**CHRONOBREAK Trigger:** ✓ Opponent just captured your Queen or Rook (material swing >400)
- Example: Opponent's move: Queen captures your Queen → CHRONOBREAK entire turn → Your Queen alive
- Anti-trigger: Opponent captured Pawn (100 material, ROI only 5x, too expensive)

### Offensive Trigger Conditions

**IMPRISON Trigger:** ✓ Opponent piece is adjacent to one of your pieces AND opponent piece value >= 300 (Queen/Rook priority)
- Example: Opponent Queen on d4, your Rook on e4 (adjacent) → IMPRISON Queen → Queen caged
- Secondary trigger: Remove defender of opponent Queen
- Anti-trigger: Opponent piece defended 2x (imprisonment fails if captor dies)

**AETHER_BLOCK Trigger:** ✓ Opponent has 18+ aether AND you have lethal move lined up
- Example: Opponent at 20 aether (can afford Chronobreak), you have capture sequence → AETHER_BLOCK → Prevent power counter
- Anti-trigger: Opponent < 14 aether (wasteful; they can't power anyway)

**BOMBA Trigger:** ✓ Opponent King is within 3×3 blast zone AND 2+ pieces in radius
- Example: Opponent King on e5, pieces on d4/e4/d6 → Plant bomb on e5 → 3×3 blast destroys King's supporters
- Anti-trigger: Opponent has 3+ shields active in radius (shields absorb blast)

**DOUBLE_ATTACK Trigger:** ✓ 2+ undefended opponent pieces within reach of your piece
- Example: Your Rook can capture Knight on d5 and Bishop on d4 → DOUBLE_ATTACK → Both captured (620 material)
- Anti-trigger: 1st capture defended by opponent (recapture loses material)

**PROMOTE Trigger:** ✓ Pawn on 6th rank, safe from capture, opponent < 18 aether (cannot Vengeance)
- Example: Pawn on e6, opponent at 14 aether → PROMOTE → e-pawn becomes Queen
- Anti-trigger: Opponent 18+ aether with Queen undefended (Vengeance destroys new Queen)

**VENGEANCE Trigger:** ✓ Opponent pawn on 7th rank (promotion threat) OR opponent Queen undefended
- Example: Opponent pawn on 7th rank (threatens 900 value Queen next turn) → VENGEANCE pawn (destroy threat)
- Anti-trigger: Opponent 20+ aether with King well-defended (not worth counterattack)

**SPAWN Trigger:** ✓ ALMOST NEVER - Only block imminent passed pawn 6th rank push
- Example: Opponent pawn on 5th rank, will promote next turn → SPAWN pawn to block 6th rank → 1-turn delay
- Anti-trigger: Non-promotion pawn, no tactical urgency

---

### Decision Tree: Defensive vs Offensive

```
IF own_king_in_check:
  → MUST DEFEND immediately (move or power)
  → Offensive powers blocked until check resolved

ELSE IF opponent_pawn_on_7th_rank:
  → DEFENSIVE PRIORITY: Freeze/Vengeance pawn
  → ROI 100x+ (prevents Queen promotion)

ELSE IF own_piece_attacked_by_2+:
  → DEFENSIVE: Fortify OR Blink to escape
  → Valuation: Piece value > 300

ELSE IF opponent_has_18+_aether:
  → DEFENSIVE: Aether Block to prevent Vengeance
  → Valuation: Protects high-value piece

ELSE IF own_bomb_in_radius:
  → DEFENSIVE: Blink to escape blast
  → Valuation: Saves piece from destruction

ELSE IF can_capture_2+_undefended_pieces:
  → OFFENSIVE: Double Attack
  → Valuation: Material gain 300+

ELSE IF opponent_piece_adjacent_to_mine:
  → OFFENSIVE: Imprison (if Queen/Rook)
  → Valuation: Removes threat + gains material

ELSE IF pawn_on_6th_safe:
  → OFFENSIVE: Promote (if opponent < 18 aether)
  → Valuation: 900 material (Queen)

ELSE IF own_aether_capped:
  → DUMP: Any remaining power to free generation
  → Valuation: Save 3 aether/turn by breaking cap

ELSE:
  → NEUTRAL: Move pieces, control center
  → Accumulate aether
```

### Balance Formula

**Defensive Budget:** Reserve 14+ aether for emergency defense (Cleanse/Frost/Fortify)

**Offensive Budget:** Spend 8-20 aether on offense only if:
- Defensive buffer >= 14 aether after spend
- Material gain >= 200 material points
- No imminent checkmate threats to opponent

**Example (Mid-Game):**
```
Current aether: 30 (capped)
Opponent threat level: Medium (no immediate mate)
Offensive opportunity: Double Attack = 500 material value (14 aether)

Decision:
  - Spend 14 aether on Double Attack
  - New aether: 16
  - Reserve maintained: 16 > 14 ✓
  - Proceed with attack
```

---

## 5. PIECE POSITIONING FOR POWER SYNERGY

### Positioning Principle 1: Adjacency for IMPRISON

**Goal:** Keep own high-value pieces (Rook, Queen) adjacent to opponent pieces you want to trap

**Technique:**
- Position Rook on 5th rank where opponent Queen is nearby (adjacent squares)
- Example: Your Rook on e5, opponent Queen on d5 → 1 square apart → IMPRISON costs 14, removes Queen from play

**Anti-Position:**
- ❌ Keep high-value pieces isolated (no adjacent enemy pieces to imprison)
- ❌ Retreat too far from opponent threats (reduces IMPRISON/CAPTURE opportunities)

**Benefit:** IMPRISON becomes 1-turn power, not 3-turn setup
**Cost:** Slight risk (pieces closer to attack)

---

### Positioning Principle 2: Clustered Opponents for DOUBLE_ATTACK

**Goal:** Arrange your pieces so they can reach 2+ opponent pieces in sequence

**Technique:**
- Position Rook on d-file where opponent has Knight on d5 and Bishop on d4
- Example: Your Rook on d3 → DOUBLE_ATTACK captures Knight (d5) then Bishop (d4) = 620 material

**Setup:**
1. Observe opponent's piece placement
2. Move YOUR Rook to file with 2+ undefended opponent pieces
3. Wait for opponent to move (or leave pieces hanging)
4. DOUBLE_ATTACK on your turn

**Anti-Position:**
- ❌ Rook isolated on edge (cannot reach central opponent pieces)
- ❌ All opponent pieces defended (first capture recaptured)

**Benefit:** 2 captures in 1 turn = tempo swing + material gain
**Cost:** Rook may be attacked while setting up

---

### Positioning Principle 3: Fortress Formation for WALL

**Goal:** Position your King and existing pawns to enable WALL to create unbreakable fortress

**Technique:**
- King on e2, Pawns on d3, e3, f3 (3 pawns around King)
- WALL around King on next turn → Spawns 3 more pawns (total 6 pawns forming fortress)
- Opponent cannot penetrate without sacrificing 2-3 pieces

**Anti-Position:**
- ❌ King in open (no existing pawns nearby; WALL has no foundation)
- ❌ Pawns scattered across board (WALL cannot find 2-3 adjacent empty squares)

**Benefit:** Fortress holds indefinitely (opponent needs +5 pieces to break through)
**Cost:** Passive position, no counterattack capability

---

### Positioning Principle 4: Escape Routes for BLINK

**Goal:** Know all safe 3-square destinations for your pieces BEFORE they're attacked

**Technique:**
- Your Queen on e4 is attacked
- Before casting BLINK, mentally check: d4, d5, e5, f5, f4, f3, e3, d3 (8 adjacent squares)
- Identify which are safe (not attacked, not occupied)
- BLINK to safest square

**Anti-Position:**
- ❌ Queen trapped in corner (d1-d3-e1 = only 3 escape squares, 2 attacked)
- ❌ Queen in center without escape (surrounded by opponent pieces)

**Benefit:** BLINK guarantee success before cast
**Cost:** Requires calculation, not obvious

---

### Positioning Principle 5: Foundation Anchor for IMPRISON+CAPTURE

**Goal:** Position your pieces to enable IMPRISON of defender, then CAPTURE of defended piece

**Technique:**
1. Opponent Queen on d4 defends Rook on e5
2. Your Bishop on c4 (adjacent to Queen, 1 square away)
3. Turn N: IMPRISON Queen with Bishop → Queen caged
4. Turn N+1: CAPTURE now-undefended Rook (e5)

**Anti-Position:**
- ❌ Bishop on f1 (too far from Queen to imprison)
- ❌ No adjacency, requires 2+ moves to set up

**Benefit:** 1-turn imprison + 1-turn capture = 3 material value in 2 turns
**Cost:** Requires advanced planning (2-3 turn setup)

---

### Positioning Principle 6: Fountain Occupation

**Goal:** Control fountains for +2 aether/turn acceleration

**Technique:**
- Identify fountain squares (usually d4, e4, d5, e5 — center 2×2)
- Move Rook to d4, Rook to e4 (occupy 2 fountains)
- Every turn: +2 (base) +2 (d4 fountain) +2 (e4 fountain) = +6 aether/turn

**Anti-Position:**
- ❌ Ignore fountains, retreat to edges
- ❌ Only occupy 1 fountain (only +2 bonus)

**Benefit:** 2 fountains = 60 aether over 10 turns = 3 big powers
**Cost:** Pieces tied up on fountain duty, less flexible for attacks

---

## 6. MANA GENERATION STRATEGY

### Fountain Control Valuation

**Each Fountain = +2 aether/turn**

**Value Over Time:**
- 1 turn: +2 aether (trivial)
- 5 turns: +10 aether (½ Frost cost)
- 10 turns: +20 aether (Imprison cost)
- 20 turns: +40 aether (2 Imprison costs)

**Strategic Decision:** Is sacrificing a piece (100-500 material) to take 1 fountain worth it?

**Calculation:**
- Sacrifice Pawn (-100): Gain +2/turn for 10 turns = +20 aether value
- ROI: 20 aether ÷ 100 material loss = 0.2 (negative, but aether valuable)
- Verdict: Worth it if +2/turn translates to 1+ extra power in mid-game

**Example Scenario:**
- Turn 12: You need 4 more aether to reach 14 (Imprison cost)
- Opponent controls fountain (d4)
- Sacrifice Pawn on d4 → Take fountain → +2/turn for rest of game
- In 2 more turns: +4 aether → Reach 14 → Cast Imprison
- Result: Pawn sacrifice (-100) enables Imprison (+400 Queen removal) = +300 net

---

### Center Control Valuation

**Center = d4, e4, d5, e5 (includes fountains)**

**Value:**
- Fountain bonus: +2/turn (if occupied)
- Piece activity bonus: +50 per turn (Rook/Queen/Bishop more active in center)
- King safety bonus: -30 per turn (opponent attacks more easily from center)

**Net Value:** +50 per turn if controlled safely

**Scenario:** "Should I sacrifice Knight to keep center control?"
- Knight value: 320
- Center control value: +50/turn
- Break-even: 320 ÷ 50 = 6.4 turns (after 6 turns, you break even on knight)
- Verdict: Sacrifice if you expect game to last 10+ more turns

---

### Strategic Priorities: Contest vs Yield

**CONTEST Fountains When:**
- Early game (turns 1-8): Build aether lead
- Mid-game (turns 11-25): 2 fountains = +4/turn = competitive advantage
- Endgame (turns 26+): Already capped, but opponent might not be
- You're behind in material: Extra aether = more power options

**YIELD Fountains When:**
- Opponent has 2+ queens/rooks attacking fountain
- Sacrifice piece for fountain = lose more material than fountain gain
- You're ahead in material: Consolidate, don't risk

**Example Decisions:**
```
Scenario 1: You ahead by 200 material
  - Opponent controls 1 fountain (d4)
  - Cost to take: Sacrifice Pawn (100)
  - Verdict: YIELD (preserve advantage, don't risk)

Scenario 2: You behind by 200 material
  - Opponent controls 2 fountains (d4, e4)
  - Cost to take: Sacrifice Knight to attack d4
  - Verdict: CONTEST (extra +2/turn = 1 power per 5 turns, helps comeback)

Scenario 3: Fountain being held by weak piece (Pawn)
  - You can capture Pawn → Take fountain
  - Cost: 0 material (free capture)
  - Verdict: ALWAYS CONTEST (free resource)
```

---

## 7. ANTI-PATTERNS TO AVOID (Critical Mistakes)

### Anti-Pattern 1: Wasting FROST on Low-Value Targets

**❌ WRONG:**
- Cast FROST on opponent Pawn on 3rd rank (100 material value)
- Cost: 8 aether
- ROI: 100 ÷ 8 = 12.5x (NEGATIVE VALUE)
- Result: Aether wasted, Pawn moves next turn anyway

**✅ RIGHT:**
- Cast FROST on opponent Queen attacking your Rook (900 material)
- Cost: 8 aether
- ROI: 900 ÷ 8 = 112.5x (EXCELLENT VALUE)
- Result: Queen frozen 1 turn, Rook survives, tempo swing

**Rule:** Only FROST pieces worth 300+

---

### Anti-Pattern 2: Promoting Without Checking Vengeance

**❌ WRONG:**
- Your Pawn on 6th rank (e6)
- Opponent has 18 aether available
- Cast PROMOTE (15 aether) → e-pawn becomes Queen (900 material)
- Opponent's turn: Cast VENGEANCE on new Queen (18 aether) → Queen destroyed
- Result: You spent 15 aether for temporary Queen, opponent spent 18 to destroy it (net -15 aether for you)

**✅ RIGHT:**
- Your Pawn on 6th rank (e6)
- Opponent has 12 aether (cannot afford Vengeance)
- Cast PROMOTE (15 aether) → e-pawn becomes Queen
- Opponent cannot respond with Vengeance
- Result: You have new Queen, opponent trapped at 12 aether

**Rule:** Only PROMOTE if opponent aether < 16 OR you FORTIFY Queen after promoting (shield absorbs Vengeance)

---

### Anti-Pattern 3: Ignoring Passed Pawn on 7th Rank

**❌ WRONG:**
- Opponent Pawn reaches 7th rank (d7 for black)
- Next turn: Opponent promotes to Queen (900 material gain)
- You're focused on your own attack, ignore threat
- Result: -900 material swing, likely lose game

**✅ RIGHT:**
- Opponent Pawn reaches 6th rank (d6 for black)
- You anticipate promotion threat
- Next turn: Cast FROST on Pawn (8 aether) OR VENGEANCE on Pawn (18 aether)
- Result: Pawn delayed/destroyed, promotion threat eliminated

**Rule:** ALWAYS address passed pawn threats 7th rank (promotion = -900, more valuable than any power)

---

### Anti-Pattern 4: Using CHRONOBREAK on Minor Material Losses

**❌ WRONG:**
- Opponent captures your Pawn (100 material)
- Cast CHRONOBREAK (20 aether) → Rewind opponent's entire turn
- Result: You spent 20 aether to save 100 material (ROI: 5x = TERRIBLE)

**✅ RIGHT:**
- Opponent captures your Queen (900 material)
- Cast CHRONOBREAK (20 aether) → Rewind opponent's entire turn
- Result: You spent 20 aether to save 900 material (ROI: 45x = EXCELLENT)

**Rule:** Only CHRONOBREAK if material loss > 400 (Rook+ or multiple pieces)

---

### Anti-Pattern 5: Leaving King Defenseless Before Big Offensive Power

**❌ WRONG:**
- Your King has 1 defender (Rook)
- Opponent threatens checkmate next turn with Queen + Knight
- You cast VENGEANCE on opponent's Queen (18 aether) → Removes Queen
- But: You left King defenseless (Rook now only defender)
- Opponent's Knight delivers checkmate (King has no escape)

**✅ RIGHT:**
- Your King has 1 defender (Rook)
- Opponent threatens checkmate next turn
- Cast FORTIFY on Rook (14 aether) → Shield protects Rook
- Then: Move King to escape square
- Result: King escapes, Rook protected, no checkmate

**Rule:** FORTIFY before VENGEANCE if King safety endangered

---

### Anti-Pattern 6: Aether Hoarding Until Capped (Wastage)

**❌ WRONG:**
- Your aether: 28
- You hold aether without spending (save for "emergency")
- Next turn: Opponent plays, you generate +3 → Hit cap (30)
- Next turn: You generate +3 but reach cap → Generation lost (-3 aether)
- Over 3 turns capped: -9 aether wasted

**✅ RIGHT:**
- Your aether: 28
- You spend 14 aether on IMPRISON → Down to 14 aether
- Next turn: Opponent plays, you generate +3 → 17 aether
- Next turn: You generate +3 → 20 aether
- Result: No wastage, continuous generation

**Rule:** Always spend when aether >= 26 (even marginal powers)

---

### Anti-Pattern 7: Double Attack on Defended Pieces

**❌ WRONG:**
- Your Rook can capture Knight on d5 and Bishop on d4
- But: Knight defended by Queen on e5, Bishop defended by Rook on d3
- Cast DOUBLE_ATTACK (14 aether)
- Capture Knight → Opponent's Queen recaptures (-500 net)
- Capture Bishop → Opponent's Rook recaptures (-320 net)
- Result: You lost 820 material for 14 aether spend (ROI: 0.02, catastrophic)

**✅ RIGHT:**
- Your Rook can capture Knight on d5 and Bishop on d4
- Both pieces UNDEFENDED (no opponent piece can recapture)
- Cast DOUBLE_ATTACK (14 aether)
- Capture Knight (320) → Capture Bishop (320) = 640 material gain
- Result: ROI: 46x (640 ÷ 14 = excellent)

**Rule:** Only DOUBLE_ATTACK if both captures are undefended

---

### Anti-Pattern 8: WALL When Pieces Sparse (Endgame)

**❌ WRONG:**
- Endgame: Only pieces left are King, Rook, 1 Pawn each
- Cast WALL (18 aether) → Spawn 3 pawns
- Your King now has 3 pawn shields (4 total)
- But: Opponent Rook can capture all 3 pawns in 3 moves anyway
- Result: 18 aether spent on temporary 3-turn delay (ROI: 5x = poor)

**✅ RIGHT:**
- Endgame with multiple pieces: King, 2 Rooks, 5 Pawns
- Cast WALL (18 aether) → Spawn 3 pawns
- Total pawns now 8 → Fortress is impenetrable (opponent cannot break through)
- Result: 18 aether spent on permanent fortress (ROI: 40x = excellent)

**Rule:** Only WALL when pieces present (mid-game or populated endgame)

---

### Anti-Pattern 9: Neglecting Fountain Control

**❌ WRONG:**
- Opponent controls 2 fountains (d4, e4)
- You ignore fountains, focus on attacks
- Opponent: +2 (baseline) +2 (d4) +2 (e4) = +6 aether/turn
- After 10 turns: Opponent has +60 extra aether = 3 big powers vs your 0
- Result: Opponent powers run away, you're outpaced

**✅ RIGHT:**
- Opponent controls 1 fountain, you control 1 fountain
- Balanced fountain economy: Both +4/turn (+2 baseline +2 fountain)
- After 10 turns: Both accumulated 40 extra aether = even footing
- Result: Tactical game, not one-sided

**Rule:** Always contest 50% of fountains to prevent opponent acceleration

---

### Anti-Pattern 10: Using CHRONOBREAK as Panic Button

**❌ WRONG:**
- Opponent just made a move (not even devastating, just tactical)
- You panic: "What if this leads to checkmate?"
- Cast CHRONOBREAK (20 aether) → Undo move preemptively
- Result: Wasted 20 aether on speculation, weakened your aether reserve

**✅ RIGHT:**
- Opponent just captured your Queen (900 material)
- You calculate: Losing Queen = -900, likely lose game
- Cast CHRONOBREAK (20 aether) → Undo move, Queen saved
- Result: Saved 900 material with 20 aether spend (ROI: 45x)

**Rule:** Only CHRONOBREAK if material loss > 400 OR checkmate is imminent

---

### Anti-Pattern 11: Blocking Opponent Aether When Behind Material

**❌ WRONG:**
- You're down 300 material (losing)
- Opponent has 16 aether
- Cast AETHER_BLOCK (16 aether) → Opponent gains 0 aether next turn
- But: You're still down 300 material, opponent just delayed 1 turn
- Result: Wasted 16 aether on delay, still losing

**✅ RIGHT:**
- You're down 300 material (losing)
- Opponent has 18 aether and undefended Queen
- Cast AETHER_BLOCK (16 aether) → Opponent cannot spend aether
- Cast VENGEANCE on Queen (18 aether next turn) → Queen destroyed
- Result: Recovered 900 material swing, now winning

**Rule:** Only AETHER_BLOCK if you have lethal follow-up lined up (capture/mate)

---

### Anti-Pattern 12: Promoting Multiple Pawns Without Checking Vulnerability

**❌ WRONG:**
- You promote Pawn #1 to Queen (15 aether) → Now have Queen #1
- Opponent Vengeance Queen #1 (18 aether) → Queen #1 destroyed
- You promote Pawn #2 to Queen (15 aether) → Now have Queen #2
- Opponent Vengeance Queen #2 (18 aether) → Queen #2 destroyed
- Result: You spent 30 aether on 2 Queens, opponent spent 36 aether destroying them
- Net: You're down 6 aether (and out of pawns)

**✅ RIGHT:**
- You promote Pawn #1 to Queen (15 aether), FORTIFY Queen (14 aether) → Fortress
- Opponent Vengeance Queen (18 aether) → Shield absorbs Vengeance
- Queen survives, game changed
- Result: Queen + Fortress = overwhelming advantage

**Rule:** FORTIFY every promoted Queen to guarantee survival

---

## FINAL DECISION MATRIX

Use this lookup table for quick bot decisions:

| Game State | Aether | Opponent Threat | Recommended Action |
|------------|--------|-----------------|-------------------|
| Opening, development | <8 | Minimal | Move pieces, develop |
| Opening, pieces blocked | 6-10 | Opponent attacking | FROST attacker (if 300+) |
| Mid-game, balanced | 15-20 | Medium threat | Use power (Imprison/Double Attack) |
| Mid-game, behind | 20-25 | High threat | DEFENSIVE (Cleanse/Fortify/Blink) |
| Mid-game, ahead | 20-25 | Low threat | OFFENSIVE (Vengeance/Imprison) |
| Mid-game, capped | 30 | Any | DUMP power (Promote/Wall/Vengeance) |
| Late-game, balanced | 25-30 | Medium threat | PAWN RACE (Promote vs Frost) |
| Late-game, ahead | 25-30 | Low threat | MATING ATTACK (Imprison/Wall/Blink) |
| Late-game, behind | 25-30 | High threat | DEFENSIVE (Chronobreak/Wall/Cleanse) |
| Opponent pawn 7th | Any | CRITICAL | VENGEANCE/FROST pawn (emergency) |
| Your King checkmated | 0 | LOSS | Game over |

---

## CONCLUSION

Master the Nova Gambit by:

1. **Phase awareness:** Different priorities for each phase (opening/middlegame/endgame)
2. **Power synergy:** Use combo patterns (Frost+Imprison, Fortify+Double Attack)
3. **Aether economy:** Maintain 15-25 aether band, never waste at cap
4. **Positioning:** Arrange pieces for IMPRISON/DOUBLE_ATTACK opportunities
5. **Fountain control:** Each fountain = +2/turn = 1 power every 9 turns
6. **Threat assessment:** Balance defensive vs offensive based on threat level
7. **Anti-patterns:** Avoid 12 critical mistakes that lose games

Execute this framework and you will dominate the Nova Gambit chess variant.
