# MANA CHESS - Game Design Document

**Version:** 1.0  
**Date:** April 30, 2026  
**Status:** Production Ready

---

## 1. EXECUTIVE SUMMARY

### High Concept
Chess meets MOBA: strategic chess with a mana economy that powers 8 active abilities, creating comeback potential in fast 15-minute matches.

### Target Audience
- **Primary**: Casual strategy gamers (18-35) who play mobile tactics games but find traditional chess intimidating
- **Secondary**: Chess players seeking fresh competitive experiences
- **Tertiary**: MOBA players looking for turn-based strategy

### Platform & Business Model
- **Platforms**: iOS, Android (primary), Steam (secondary)
- **Business Model**: Free-to-play with premium upgrade ($9.99) and seasonal battle pass ($4.99)
- **Engine**: Unity (cross-platform, mature mobile support)

### Unique Selling Proposition
First chess variant where tactical positioning generates mana for 8 powerful abilities—creating accessible MOBA-style gameplay with chess depth, designed for 15-minute competitive matches and mobile-first monetization.

### Success Metrics (Year 1)
- **Downloads**: 150,000
- **Premium Conversion**: 20,000 (13.3%)
- **Revenue**: $300,000 ($180K premium + $120K battle pass)
- **Retention**: 30-day retention >25%
- **Rating**: 4.2+ stars (iOS/Android), 85%+ positive (Steam)
- **Session Length**: 3+ games per session
- **Average Match**: 15 minutes

---

## 2. CORE MECHANICS

### 2.1 Chess Foundation
MANA CHESS uses standard FIDE chess rules with the following modifications:
- 8×8 board, standard piece setup
- Standard movement rules (castling, en passant included)
- **Time Controls**: 
  - Blitz: 5+3 (5 minutes + 3 second increment)
  - Rapid: 10+5 (default competitive)
  - Classical: 15+10 (tournament mode)

### 2.2 Mana Economy

#### Mana Generation
- **Base Generation**: 3 mana per turn (automatic)
- **Center Control Bonus**: +1 mana/turn if you control 3+ of the center 4 squares (d4, d5, e4, e5)
- **Maximum Capacity**: 20 mana (prevents infinite hoarding)
- **Starting Mana**: 0 (both players)

#### Mana Expenditure
- Powers cost 4-12 mana (see Power System section)
- Mana persists between turns (does not reset)

#### Sacrifice Mechanic
Players may sacrifice their own pieces for immediate mana:
- **Pawn**: +3 mana
- **Knight/Bishop**: +5 mana
- **Rook**: +8 mana
- **Queen**: +12 mana
- **King**: Cannot be sacrificed

**Sacrifice Rules**:
- Sacrifice is an optional action during your turn (before moving)
- Sacrificed piece is permanently removed
- Mana gained immediately (can be spent same turn)
- Cannot sacrifice if it leaves your king in check
- Sacrifice counts as part of your turn timer

### 2.3 Win Conditions
- **Checkmate**: Traditional chess victory
- **Resignation**: Player surrenders
- **Time Forfeit**: Clock runs out
- **Disconnection**: 60-second grace period, then forfeit

---

## 3. POWER SYSTEM - DETAILED SPECIFICATIONS

All powers are activated by spending mana. Players can use multiple powers per turn if they have sufficient mana. Powers cannot be used if they would leave your king in check.

### 3.1 BLINK (5 mana)
**Description**: Teleport any of your pieces to any empty square on the board.

**Targeting Rules**:
- Select one of your pieces
- Select any empty square
- Piece instantly moves (not captured en route)
- Does not count as a "move" for castling eligibility

**Use Cases**:
- Escape threats instantly
- Position pieces for checkmate
- Bypass pawn walls
- Reposition defensively

**Counterplay**:
- Zone control limits safe destinations
- Predictable on low-mana turns
- Can be baited into time pressure

**Combos**:
- Blink + Chain Lightning (reposition then chain attack)
- Blink + Time Bomb (escape while leaving trap)

**VFX**: Blue shimmer particle burst → piece fades → reappears with flash

**Audio**: Sci-fi teleport "whoosh" sound

**Balancing Rationale**: 5 mana = mid-tier cost allows 2 uses by turn 4 without sacrifice. Powerful but predictable, encourages board control.

---

### 3.2 FORTIFY (4 mana)
**Description**: Grant any piece a shield that blocks the next capture attempt.

**Targeting Rules**:
- Select one of your pieces (including king)
- Shield persists until:
  - Piece is attacked (shield breaks, piece survives)
  - Piece moves (shield remains)
  - Game ends
- Visual indicator: glowing blue aura around piece
- Only one shield per piece (cannot stack)

**Use Cases**:
- Protect advanced pieces deep in enemy territory
- Shield king during risky attacks
- Bait opponent into wasting capture moves
- Defend against discovered attacks

**Counterplay**:
- Opponent can "pop" shield with low-value piece
- Doesn't prevent checks (just capture)
- Mana investment can be wasted if piece not threatened

**Combos**:
- Fortify + aggressive pawn push
- Fortify Queen + deep infiltration
- Shield multiple pieces to create uncertainty

**VFX**: Hexagonal shield matrix materializes around piece

**Audio**: Energy shield "hum" activation

**Balancing Rationale**: Cheapest power (4 mana) for accessibility. Turn 2 activation possible with center control. Shields create psychological pressure without guaranteeing survival.

---

### 3.3 MITOSIS (7 mana)
**Description**: Clone any piece (except King) to an adjacent empty square.

**Targeting Rules**:
- Select one of your pieces (not King)
- Select an adjacent empty square (8 directions)
- Clone appears with full movement capability
- Original and clone are independent pieces
- Clone is permanent (not temporary)

**Use Cases**:
- Double your rooks for endgame dominance
- Clone queen for overwhelming attack
- Duplicate pawns near promotion
- Create material advantage

**Counterplay**:
- High mana cost (7) delays usage
- Requires empty adjacent square (board control matters)
- Creates targets for opponent powers

**Combos**:
- Mitosis Queen + immediate checkmate threat
- Clone Rook + control open files
- Clone pawn near promotion square

**VFX**: Original piece glows → splits into two with DNA helix animation

**Audio**: Organic "cell division" sound

**Balancing Rationale**: Most powerful material advantage tool. 7 mana = ~turn 3-4 access prevents early game abuse. Can only clone adjacent = requires positional setup.

---

### 3.4 TIME BOMB (6 mana)
**Description**: Plant a bomb on any square that explodes after 3 full turns, destroying all pieces in a 3×3 area.

**Targeting Rules**:
- Select any square (empty or occupied)
- Bomb is invisible to opponent until 1 turn before detonation
- **Countdown**: Planted → 3 turns pass → Detonates at start of your 4th turn
- **Blast Radius**: 3×3 grid centered on bomb square
- Destroys ALL pieces (yours and opponent's) in radius
- King destruction = instant victory for opponent

**Use Cases**:
- Zone denial (opponent avoids area)
- Clear clustered enemy pieces
- Force opponent into bad positions
- Psychological pressure

**Counterplay**:
- 3-turn warning allows escape
- Destroys your pieces too (requires careful positioning)
- Bomb location revealed 1 turn early
- High mana cost limits frequency

**Combos**:
- Blink away from your own bomb before detonation
- Plant multiple bombs for zoning
- Bomb + sacrifice (weaken then zone)

**VFX**: Pulsing red warning symbol appears turn before detonation → explosion animation

**Audio**: Ticking sound (turn before) → explosion

**Balancing Rationale**: 6 mana + 3-turn delay prevents instant board wipes. Self-damage creates risk-reward. Strongest zoning tool but requires planning.

---

### 3.5 CHAIN LIGHTNING (8 mana)
**Description**: Capture an enemy piece, then the attack "jumps" to an adjacent enemy piece (if any).

**Targeting Rules**:
- Must be a legal capture move with one of your pieces
- After first capture, attack jumps to ONE adjacent enemy piece (8 directions)
- Second capture is automatic (doesn't require legal move)
- Cannot chain to pieces protected by Fortify (shield blocks, chain ends)
- Maximum 1 jump (captures 2 pieces total)

**Use Cases**:
- Punish clustered pieces
- Two-for-one value trades
- Break defensive formations
- High tempo attacks

**Counterplay**:
- Keep pieces spread out
- Use Fortify to block chain
- High mana cost (8) limits usage
- Requires pieces to be adjacent

**Combos**:
- Blink into position + Chain Lightning
- Chain + Time Bomb (clear then zone)
- Sacrifice for mana → immediate Chain Lightning

**VFX**: Lightning arc from first piece → second piece with electric particles

**Audio**: Thunder crack sound

**Balancing Rationale**: Highest single-target mana cost (8) = ~turn 3 without sacrifice. Two captures justifies cost. Adjacent requirement demands positional awareness.

---

### 3.6 PHASE SHIFT (5 mana)
**Description**: One of your pieces becomes "ghostly" for 2 turns—it can pass through other pieces when moving.

**Targeting Rules**:
- Select one of your pieces
- For next 2 turns, that piece can move through occupied squares
- Captures still require landing on enemy piece (can't capture while passing through)
- Phase ends after 2 full turns or piece captures
- Visual: piece becomes translucent/ghostly
- Cannot phase through edge of board

**Use Cases**:
- Bypass pawn walls
- Knights access blocked diagonals
- Surprise attacks from unexpected angles
- Escape surrounded pieces

**Counterplay**:
- Phase duration is short (2 turns)
- Opponent can predict movement after first phased move
- Doesn't grant invulnerability (just movement freedom)

**Combos**:
- Phase Rook through pawns → back rank mate
- Phase Bishop → diagonal attack from behind
- Phase + Fortify for invincible infiltrator

**VFX**: Piece becomes semi-transparent with ghostly trail

**Audio**: Ethereal "phase" sound

**Balancing Rationale**: 5 mana = accessible mid-game. 2-turn duration creates tactical window without permanent advantage. Movement-only (no auto-capture) prevents overpowered trades.

---

### 3.7 REWIND (10 mana)
**Description**: Undo your opponent's last move (board state reverts, their piece returns to previous position).

**Targeting Rules**:
- Can only be used immediately after opponent's move
- Reverts board to state before their last move
- Opponent's piece returns to origin square
- If opponent captured your piece, it is restored
- Opponent does NOT get their turn back (you still get next move)
- Cannot rewind a Rewind
- Cannot be used on first move of game

**Use Cases**:
- Counter devastating captures
- Restore captured pieces
- Negate opponent's power plays
- Ultimate defensive tool

**Counterplay**:
- Extremely high cost (10 mana) = rare usage
- Opponent can simply repeat the move next turn
- Mana investment can be wasted if opponent has alternate plan
- Only affects last move (can't rewind multiple turns)

**Combos**:
- Rewind + immediate counterattack
- Rewind opponent's Rewind (denied!)
- Save for critical moments (checkmate escape)

**VFX**: Time reversal animation (piece rewinds motion in reverse)

**Audio**: Reversed time "rewind" sound effect

**Balancing Rationale**: 10 mana = highest single-power cost. Only accessible turn 4+ or with sacrifice. Game-changing but limited uses per match. Creates epic "oh no you don't" moments for content.

---

### 3.8 NOVA (12 mana)
**Description**: Destroy all pieces (yours and opponent's) adjacent to any target square in an 8-direction radius.

**Targeting Rules**:
- Select any square on the board
- All pieces in 8 adjacent squares are destroyed (like a 3×3 blast without center)
- Destroys both friendly and enemy pieces
- King destruction = instant loss for that king's owner
- Cannot target square if it would destroy your own king

**Use Cases**:
- Board reset when losing material advantage
- Clear defensive walls
- Endgame king hunt (blast around enemy king)
- Ultimate comeback tool

**Counterplay**:
- Highest mana cost (12) = very rare
- Self-damage can backfire
- Requires significant mana hoarding or multiple sacrifices
- Predictable in late game when mana is high

**Combos**:
- Sacrifice Queen (12 mana) → immediate Nova
- Nova to clear board → promote pawns
- Blink king to safety → Nova their position

**VFX**: Expanding shockwave with explosive particles

**Audio**: Massive explosion sound

**Balancing Rationale**: Ultimate ability (12 mana = turn 4 at earliest with center control, typically turn 5-6). High risk (self-damage) justifies board-wipe power. Creates dramatic late-game moments and comeback potential.

---

## 4. MANA ECONOMY MATHEMATICS

### 4.1 Mana Generation Analysis

**Base Case (No Center Control, No Sacrifice)**
- Turn 1: 3 mana
- Turn 2: 6 mana
- Turn 3: 9 mana
- Turn 4: 12 mana
- Turn 5: 15 mana
- Turn 6: 18 mana
- Turn 7: 20 mana (cap reached)

**With Center Control (+1/turn)**
- Turn 1: 3 mana
- Turn 2: 7 mana
- Turn 3: 11 mana
- Turn 4: 15 mana
- Turn 5: 19 mana
- Turn 6: 20 mana (cap reached)

**Center Control Value**: Reaches mana cap 1 turn earlier = ~3 extra mana over game = one extra Fortify cast.

### 4.2 Average Match Projection (15-minute game ≈ 40 moves)

**Assumptions**:
- 20 turns per player
- Center control for 8 turns average
- 1 sacrifice mid-game (Knight = +5 mana)

**Total Mana Available**:
- Base: 20 turns × 3 mana = 60 mana
- Center bonus: 8 turns × 1 mana = 8 mana
- Sacrifice: 5 mana
- **TOTAL: 73 mana across entire game**

**Mana Cap Impact**:
- Cap at 20 mana from turn 7 onward (13 turns)
- Without cap: 60 + 8 + 5 = 73 mana potential
- With cap: ~15 mana "lost" to overflow if not spent
- **Effective Available: ~58-63 mana** (encourages active spending)

### 4.3 Power Usage Frequency Targets

**Total Budget: 60 mana per game (accounting for cap waste)**

| Power | Cost | Target Usage | Mana Spent |
|-------|------|--------------|------------|
| Fortify | 4 | 3x | 12 |
| Blink | 5 | 2x | 10 |
| Phase Shift | 5 | 1x | 5 |
| Time Bomb | 6 | 1x | 6 |
| Mitosis | 7 | 1x | 7 |
| Chain Lightning | 8 | 1x | 8 |
| Rewind | 10 | 1x | 10 |
| Nova | 12 | 0-1x | 0-12 |
| **TOTAL** | | **10-11** | **58-70** |

**Design Goal**: Players use 8-12 powers per game, creating dynamic matches without overwhelming decision fatigue.

### 4.4 Game Phase Mana Curves

**Early Game (Turns 1-10)**
- Available: 30 mana (3/turn)
- Typical Spending: 10-15 mana (2-3 powers)
- Powers: Fortify (protect opening), Blink (repositioning)
- **Strategy**: Establish center control for mana economy

**Mid Game (Turns 11-25)**
- Available: 45 mana (3.5/turn average with center control)
- Typical Spending: 25-35 mana (4-6 powers)
- Powers: Mitosis, Chain Lightning, Time Bomb (tempo swings)
- **Strategy**: Power spikes, material trades, sacrifices

**Late Game (Turns 26+)**
- Available: ~20 mana (capped, but flowing)
- Typical Spending: 15-20 mana (2-3 powers)
- Powers: Rewind (save king), Nova (desperation), Blink (positioning)
- **Strategy**: Decisive plays, checkmate setups

### 4.5 Sacrifice Risk-Reward Analysis

**Scenario: Sacrifice Knight (5 mana) on Turn 5**

**Immediate Cost**:
- Lose 3 points of material (knight value)
- Weaker board presence

**Immediate Benefit**:
- +5 mana instantly
- Enables Mitosis (7 mana) immediately if you have 2+ banked
- Or enables Blink (5 mana) + Fortify (4 mana) combo

**Breakeven Calculation**:
- Knight worth ~3 pawns
- Mitosis creates +3 to +9 points of material (depending on cloned piece)
- **Sacrifice Knight → Mitosis Rook = net +2 material advantage**

**Psychological Impact**:
- Opponent must respect sudden mana spike
- Creates tempo pressure
- High risk if gambit fails

**Win Rate Impact (Playtested Target)**:
- Sacrifices in winning positions: 5% win rate increase
- Sacrifices in losing positions: 15% comeback chance
- Sacrifices in equal positions: 50/50 (high variance)

---

## 5. GAME FLOW

### 5.1 Match Phases

**Opening (Moves 1-8)**
- **Focus**: Center control, mana economy setup
- **Mana Range**: 0-24 mana
- **Typical Powers**: Fortify (protect key pieces), occasional Blink
- **Win Condition**: None (too early)

**Middlegame (Moves 9-25)**
- **Focus**: Material trades, power spikes, sacrifices
- **Mana Range**: 24-cap (20+)
- **Typical Powers**: Mitosis, Chain Lightning, Time Bomb, Phase Shift
- **Win Condition**: Material advantage via powers

**Endgame (Moves 26+)**
- **Focus**: Checkmate patterns, king safety
- **Mana Range**: Fluctuating (10-20)
- **Typical Powers**: Rewind (defense), Nova (desperation), Blink (positioning)
- **Win Condition**: Checkmate or resignation

### 5.2 Average Match Length

**Target by Time Control**:
- **Blitz (5+3)**: 8-12 minutes
- **Rapid (10+5)**: 12-18 minutes (default competitive)
- **Classical (15+10)**: 20-30 minutes

**Design Philosophy**: 15-minute average keeps mobile engagement high while allowing strategic depth.

### 5.3 Tutorial Flow (5 Missions)

**Mission 1: Mana Basics**
- Learn mana generation (3/turn)
- Use Fortify to protect your queen
- Win the game
- **Reward**: 50 XP, "First Power" badge

**Mission 2: Center Control**
- Establish center control (occupy d4, e4)
- Observe +1 mana/turn bonus
- Use Blink to escape a threat
- **Reward**: 100 XP, "Board Control" badge

**Mission 3: Sacrifice**
- Sacrifice a pawn for +3 mana
- Use Mitosis to clone your rook
- Checkmate with superior material
- **Reward**: 150 XP, "Risk Taker" badge

**Mission 4: Power Combos**
- Plant Time Bomb near enemy king
- Blink your king to safety before detonation
- Win using the explosion
- **Reward**: 200 XP, "Tactician" badge

**Mission 5: Advanced Powers**
- Face opponent with material advantage
- Use Chain Lightning for two-for-one trade
- Use Rewind to undo opponent's best move
- Win from behind
- **Reward**: 300 XP, "Master" badge, unlock Ranked mode

**Total Tutorial Time**: 20-25 minutes

---

## 6. UI/UX SPECIFICATIONS

### 6.1 HUD Layout

**Mobile Portrait Mode (Primary)**
```
┌─────────────────────────┐
│  Opponent Mana: 12/20   │ (Top bar)
│  Timer: 05:23           │
├─────────────────────────┤
│                         │
│    CHESS BOARD (8×8)    │
│                         │
├─────────────────────────┤
│ [Fortify] [Blink] [Mit] │ (Power bar - 8 buttons)
│ [Bomb] [Chain] [Phase]  │
│ [Rewind] [Nova]         │
├─────────────────────────┤
│  Your Mana: 8/20        │ (Bottom bar)
│  Timer: 06:45           │
│  [Sacrifice]            │
└─────────────────────────┘
```

**PC Landscape Mode**
```
┌──────────────────────────────────────┐
│ Opponent: 12/20 mana | Timer: 05:23  │
├──────────┬───────────────────┬────────┤
│          │                   │ Power  │
│ Captured │   CHESS BOARD     │ Icons  │
│ Pieces   │      (8×8)        │ (8)    │
│          │                   │        │
├──────────┴───────────────────┴────────┤
│ Your Mana: 8/20 | Timer: 06:45       │
│ [Sacrifice Menu]                      │
└──────────────────────────────────────┘
```

### 6.2 Information Hierarchy

**Always Visible**:
1. Mana count (yours and opponent's)
2. Timer
3. Board state
4. Power buttons (with costs displayed)

**On Hover/Tap**:
- Power tooltips (description, cost, targeting rules)
- Piece movement range
- Power targeting reticle

**Hidden Until Relevant**:
- Sacrifice menu (tap "Sacrifice" button)
- Settings (pause menu)
- Chat/emotes

### 6.3 Mobile vs PC Differences

| Feature | Mobile | PC |
|---------|--------|-----|
| Power Selection | Tap button → tap target | Click button → click target |
| Piece Movement | Drag-and-drop | Click piece → click destination |
| Mana Display | Large numbers (readable on small screen) | Smaller UI element |
| Power Buttons | 2 rows of 4 buttons | Single column sidebar |
| Animations | Simplified (performance) | Full particle effects |

### 6.4 Accessibility Features

- **Colorblind Mode**: Shield aura changes to patterns (not just color)
- **Screen Reader**: All UI elements have labels
- **Haptic Feedback**: Power activation, captures, mana gain (mobile)
- **Adjustable UI Scale**: 80%-120%
- **Simplified Graphics**: Toggle for low-end devices
- **Auto-Promote**: Pawn promotion defaults to Queen (can be disabled)

### 6.5 Animation Timing

**Power Activations**:
- Fortify: 0.8s (shield materializes)
- Blink: 1.2s (fade out → fade in)
- Mitosis: 1.5s (split animation)
- Time Bomb: 0.5s (plant), 2.0s (explosion)
- Chain Lightning: 1.8s (first capture + chain)
- Phase Shift: 0.6s (ghost effect applied)
- Rewind: 1.5s (time reversal)
- Nova: 2.5s (explosion + destruction)

**Design Rule**: Animations max 2.5s to maintain turn-based pace. Skippable with tap/click.

### 6.6 Visual Feedback

**Mana Gain**:
- "+3" floats above board when earned
- Mana bar fills with smooth animation

**Power Readiness**:
- Affordable powers: full color, glowing
- Unaffordable powers: greyed out, cost in red

**Opponent Actions**:
- Powers used by opponent show brief animation (reveal what they cast)
- Opponent mana decreases visibly

---

## 7. PROGRESSION & RETENTION

### 7.1 Player Leveling System

**XP Sources**:
- Win: 100 XP
- Loss: 50 XP (no penalty for trying)
- Draw: 75 XP
- First power used per game: +10 XP
- Comeback win (down 2+ pieces): +50 XP bonus
- Daily login: +25 XP

**Level Curve**:
- Level 1→2: 100 XP
- Level 2→3: 200 XP
- Level n→n+1: n × 100 XP
- Max Level: 50 (prestige system beyond)

**Level Rewards**:
- Every 5 levels: Unlock cosmetic tier
- Level 10: Ranked mode unlocked
- Level 20: Tournament mode unlocked
- Level 30: Custom game modes unlocked

### 7.2 Daily Quests (3 per day)

Examples:
- "Win 2 games" (150 XP)
- "Use Mitosis 3 times" (100 XP)
- "Control center for 10 turns total" (100 XP)
- "Sacrifice 5 pieces across any games" (100 XP)
- "Win without using Nova or Rewind" (200 XP)

**Quest Reward**: Completing all 3 = bonus 100 XP + 1 Battle Pass tier skip

### 7.3 Ranked Ladder (ELO System)

**Ranking Tiers**:
- Bronze: 0-999
- Silver: 1000-1399
- Gold: 1400-1799
- Platinum: 1800-2199
- Diamond: 2200-2599
- Master: 2600-2999
- Grandmaster: 3000+ (top 500 players)

**ELO Calculation**:
- Standard ELO (K-factor = 32 for new players, 16 for established)
- Placement matches: 10 games to calibrate
- Season length: 3 months
- Season reset: Drop 200 ELO, soft reset

**Ranked Rewards (End of Season)**:
- Bronze: Profile border
- Silver: + Animated border
- Gold: + Exclusive skin
- Platinum: + Title ("Platinum Tactician")
- Diamond: + Rare skin + Title
- Master: + Epic skin + Title + 1000 premium currency
- Grandmaster: + Legendary skin + Title + 5000 premium currency + Featured on leaderboard

### 7.4 Battle Pass Structure (50 Tiers, $4.99)

**Free Track Rewards (every 5 tiers)**:
- Common skins (piece recolors)
- XP boosts (2-hour duration)
- Profile icons

**Premium Track Rewards**:
- Tier 1: Exclusive board theme
- Tier 10: Rare piece skin set
- Tier 20: Power VFX upgrade (Chain Lightning becomes purple)
- Tier 30: Epic board theme (animated)
- Tier 40: Legendary piece set (full custom pieces)
- Tier 50: Mythic board theme + Title + Emote pack

**Battle Pass XP**:
- Games played: 50 XP per game (win or lose)
- Daily quests: 300 XP total
- Weekly challenge: 1000 XP (e.g., "Win 15 games this week")
- Average completion: 35-40 hours of play per season

### 7.5 Achievements (50 total)

Examples:
- "First Blood": Win your first game
- "Mana Master": Reach 20 mana cap in a game
- "Sacrifice Play": Sacrifice your Queen and win
- "Nova Strike": Destroy 5+ pieces with one Nova
- "Perfect Game": Win without losing any pieces
- "Comeback King": Win after being down 10+ points of material
- "Speed Demon": Win a Blitz game in under 5 minutes
- "Power Spammer": Use 15+ powers in one game

**Achievement Rewards**: XP, titles, profile badges

### 7.6 Social Features

**Friends List**:
- Add friends via username
- Challenge friends to private matches
- See friends' ranks and recent games

**Clans/Teams** (post-launch feature):
- Create/join clans (max 50 members)
- Clan leaderboard
- Clan wars (team tournaments)

**Replay Sharing**:
- Save replays locally
- Share replay link (web viewer)
- Highlight reel (auto-generate best moments)

**Emotes** (8 total, premium unlock):
- "Good game!"
- "Brilliant move!"
- "Oops..."
- "Thinking..."
- "Nice combo!"
- "Wow!"
- "Let's play again!"
- "Well played!"

---

## 8. MONETIZATION STRATEGY

### 8.1 Free vs Premium Comparison

| Feature | Free | Premium ($9.99) |
|---------|------|-----------------|
| Core Gameplay | ✓ | ✓ |
| All 8 Powers | ✓ | ✓ |
| Casual Mode | ✓ | ✓ |
| Ranked Mode | ✓ | ✓ |
| Ads | Yes (after each game) | No ads |
| Battle Pass | Can earn free track | Can purchase premium |
| Custom Games | Limited (2/day) | Unlimited |
| Replays | Last 5 games | Unlimited history |
| Statistics | Basic | Advanced analytics |
| Cosmetics | Starter set only | + 3 exclusive skin sets |
| Priority Matchmaking | No | Yes (faster queues) |

**Premium Value Proposition**: "Remove ads forever + exclusive skins + unlimited custom games for the price of lunch."

### 8.2 Battle Pass Content (Season 1 Example)

**Theme**: "Quantum Realm"

**Premium Skins**:
- Quantum Pawn set (glowing particles)
- Cyber Knight set (holographic)
- Quantum Queen (epic animated)

**Boards**:
- Neon Grid (rare)
- Quantum Void (epic, animated stars)

**VFX Upgrades**:
- Chain Lightning → Quantum Beam (purple)
- Nova → Quantum Collapse (black hole effect)

**Emotes**:
- "Quantum Shift!" animated emote
- "Entangled!" emote

**Total Value**: $40 worth of items for $4.99 (90% discount to encourage purchase)

### 8.3 Cosmetic Shop Categories

**Piece Skins** ($0.99 - $4.99):
- Common: Recolors (red, blue, green pieces)
- Rare: Material changes (gold, crystal, wood)
- Epic: Animated (flaming pieces, ice pieces)
- Legendary: Fully custom (dragon pieces, robot pieces)

**Board Themes** ($1.99 - $4.99):
- Common: Color schemes
- Rare: Textures (marble, wood, glass)
- Epic: Animated backgrounds (space, ocean, forest)
- Legendary: Interactive (particles react to moves)

**Power VFX** ($0.99 each):
- Change color/style of power effects
- Bundle: All 8 VFX for $4.99 (save $3)

**Emote Packs** ($1.99):
- 4 emotes per pack
- Themed (silly, competitive, respectful)

### 8.4 Pricing Psychology

**Why $9.99 Premium?**
- Psychological barrier under $10
- Comparable to Netflix monthly ($11.99)
- Lower than Chess.com Premium ($14.99/month)
- One-time purchase (not subscription) = better perceived value

**Why $4.99 Battle Pass?**
- Fortnite model proven ($7.99)
- Lower price = higher conversion (mobile casual audience)
- 3-month season = $1.66/month perceived cost

**Cosmetic Pricing Tiers**:
- Impulse buys: $0.99-$1.99 (high volume)
- Mid-tier: $2.99-$4.99 (best margins)
- Premium: $7.99-$9.99 (whales, rare purchases)

### 8.5 No Pay-to-Win Guarantees

**IRONCLAD RULES**:
- ✓ All players have access to all 8 powers
- ✓ No mana boosters for real money
- ✓ No "premium powers"
- ✓ Cosmetics only affect appearance
- ✓ Free players can reach Grandmaster rank

**Transparency**: Display "No Pay-to-Win" badge prominently in store and marketing.

### 8.6 Revenue Projections (Year 1, Refined)

**Assumptions**:
- 150,000 downloads
- 13% premium conversion (industry average: 2-5%, we're higher due to value)
- 30% battle pass attachment (of premium users)
- 10% cosmetic shop purchasers (of all users)
- 3 seasons per year

**Revenue Breakdown**:

| Source | Calculation | Revenue |
|--------|-------------|---------|
| Premium | 20,000 × $9.99 | $199,800 |
| Battle Pass | 6,000 × $4.99 × 3 seasons | $89,820 |
| Cosmetics | 15,000 × $2.50 avg | $37,500 |
| **TOTAL** | | **$327,120** |

**Platform Split (70/30)**:
- Net Revenue: $229,000

**Costs**:
- Development: $70,000
- Marketing: $25,000
- Servers (Year 1): $15,000
- Support/Ops: $10,000
- **Total Costs**: $120,000

**Year 1 Profit**: $109,000

**ROI**: 91% (excellent for indie game)

---

## 9. TECHNICAL REQUIREMENTS

### 9.1 Engine: Unity 2022 LTS

**Rationale**:
- Cross-platform (iOS, Android, Steam, WebGL)
- Mature networking (Netcode for GameObjects)
- Asset store ecosystem
- Team familiarity

**Alternative Considered**: Godot (free, lightweight) — rejected due to less mature mobile tooling

### 9.2 Network Architecture

**Model**: Turn-based authoritative server

**Flow**:
1. Client sends move + power usage to server
2. Server validates (legal move? sufficient mana?)
3. Server updates game state
4. Server broadcasts state to both clients
5. Clients render animations locally

**Latency Tolerance**:
- Turn-based = high tolerance (500ms acceptable)
- Rollback not needed (unlike fighting games)

**Server Stack**:
- **Backend**: Node.js (fast, scalable)
- **Database**: PostgreSQL (user accounts, match history)
- **Cache**: Redis (matchmaking queues, active games)
- **Hosting**: AWS (EC2 + RDS) or Google Cloud

### 9.3 Database Schema (Simplified)

**Users Table**:
- user_id (UUID, primary key)
- username (string, unique)
- password_hash (bcrypt)
- elo_rating (integer)
- level (integer)
- premium (boolean)
- created_at (timestamp)

**Matches Table**:
- match_id (UUID, primary key)
- white_user_id (UUID, foreign key)
- black_user_id (UUID, foreign key)
- winner_user_id (UUID, nullable)
- moves (JSON array)
- powers_used (JSON array)
- duration_seconds (integer)
- time_control (string)
- created_at (timestamp)

**Cosmetics Table**:
- user_id (UUID, foreign key)
- cosmetic_id (string)
- purchased_at (timestamp)

### 9.4 Platform SDKs Required

**iOS**:
- StoreKit (IAP)
- Game Center (leaderboards, achievements)
- Sign in with Apple

**Android**:
- Google Play Billing (IAP)
- Play Games Services (leaderboards)
- Firebase (analytics, crashlytics)

**Steam**:
- Steamworks SDK (achievements, leaderboards, DLC)

**Cross-Platform**:
- Unity IAP (wrapper for all stores)
- Unity Analytics

### 9.5 Anti-Cheat Considerations

**Threats**:
- Move validation bypass (client claims illegal moves)
- Mana hacking (client claims more mana)
- Timer manipulation

**Mitigations**:
- **Server-authoritative**: All game logic on server, client is "dumb renderer"
- **Move validation**: Server checks all moves against chess rules + mana costs
- **Timer enforcement**: Server tracks clocks, auto-forfeits on timeout
- **Replay auditing**: Flag suspicious games for manual review
- **Rate limiting**: Prevent spam/bots

**No AI Assistance Detection**: Too complex for v1.0 (revisit in v2.0 if problem emerges)

### 9.6 Performance Targets

**Mobile**:
- 60 FPS (UI and animations)
- <100 MB download size
- <200 MB RAM usage
- Works on iPhone 8+ / Android 8+

**PC**:
- 144 FPS capable
- <500 MB download size
- <1 GB RAM usage
- Works on integrated graphics

**Load Times**:
- App launch to main menu: <3 seconds
- Find match to game start: <10 seconds
- Power animation completion: <2.5 seconds

---

## 10. ART DIRECTION

### 10.1 Visual Style: **Stylized Minimalism**

**References**:
- Chess.com (clean, readable)
- Into the Breach (clear visual language)
- Hearthstone (power fantasy, readable VFX)

**Philosophy**: Clarity over realism. Players should instantly understand board state even during power effects.

### 10.2 Piece Designs

**Default Set**:
- Stylized 3D models (low-poly, high-contrast)
- White pieces: Bright white with blue accents
- Black pieces: Dark gray with red accents
- Readable silhouettes (knight looks like knight even at distance)

**Empowered States**:
- Fortify: Blue hexagonal shield overlay
- Phase Shift: 50% opacity, ghostly particles
- Mitosis: Subtle glow before split

### 10.3 Board Themes

**Default Board**: "Classic Contrast"
- Light squares: Off-white (#F0D9B5)
- Dark squares: Muted brown (#B58863)
- Border: Dark wood texture

**Premium Boards** (examples):
- Neon Grid: Black background, cyan/magenta squares, Tron-style
- Marble Hall: White/gray marble, gold borders, classical
- Quantum Void: Space background, glowing squares, nebula effects

### 10.4 Power VFX Descriptions

**Fortify**:
- Shield materializes as hexagonal panels assembling
- Color: Blue (#2196F3)
- Particle count: 50-100 (light)

**Blink**:
- Piece dissolves into blue particles → reforms at destination
- Trail: Light streak connecting origin/destination
- Duration: 1.2s

**Mitosis**:
- Original piece glows → double helix DNA strand appears → piece splits
- Color: Green (#4CAF50) organic glow
- Duration: 1.5s

**Time Bomb**:
- Plant: Red pulsing marker on square
- Countdown: Beeps and pulses increase frequency
- Explosion: Orange/red fireball, shockwave pushes nearby pieces
- Duration: 0.5s plant, 2.0s explosion

**Chain Lightning**:
- Electric arc from capturing piece to target
- Color: Blue-white (#00E5FF) lightning
- Secondary arc: Same color, branches to second target
- Duration: 1.8s total

**Phase Shift**:
- Piece becomes translucent (50% opacity)
- Ghostly particle trail follows movement
- Color: Cyan (#00BCD4) wisps
- Persistent effect for 2 turns

**Rewind**:
- Time reversal: Piece moves backward (reversed animation)
- Clock overlay: Analog clock spinning counterclockwise
- Color: Purple (#9C27B0) time distortion
- Duration: 1.5s

**Nova**:
- Expanding shockwave from center square
- All affected pieces disintegrate into particles
- Color: Orange/yellow (#FF9800) explosion
- Screen shake: Subtle
- Duration: 2.5s

### 10.5 UI Mood: **Competitive Elegance**

**Inspiration**:
- Lichess (functional, no clutter)
- League of Legends client (sleek, modern)
- Chess.com (professional, trustworthy)

**Color Palette**:
- Primary: Deep blue (#1E3A8A)
- Secondary: Gold accent (#F59E0B)
- Background: Dark gray (#1F2937)
- Text: White (#FFFFFF) / Light gray (#D1D5DB)
- Mana: Cyan (#06B6D4)

**Typography**:
- Headers: Roboto Bold (modern, readable)
- Body: Roboto Regular
- Numbers: Roboto Mono (mana/timer clarity)

---

## 11. AUDIO DESIGN

### 11.1 SFX for Powers

| Power | Sound Description |
|-------|-------------------|
| Fortify | Energy hum + shield "clang" |
| Blink | Sci-fi teleport "whoosh" (fade out/in) |
| Mitosis | Organic "split" + biological bubbling |
| Time Bomb | Beeping (slow → fast) + explosion "boom" |
| Chain Lightning | Thunder crack + electric crackle |
| Phase Shift | Ethereal "phase" tone + wind chimes |
| Rewind | Reversed clock ticking + wind tunnel |
| Nova | Deep explosion + bass rumble + debris |

**Volume Balance**: Powers should be satisfying but not overwhelming (UI sounds should remain audible)

### 11.2 Ambient Music

**Main Menu**: Calm orchestral strings (think Netflix chess series "The Queen's Gambit")

**In-Game**:
- Early game (0-5 min): Minimal ambient tones (focus, concentration)
- Mid game (5-12 min): Tension builds (subtle drums, rising strings)
- Late game (12+ min): Intense orchestral (epic conclusion, fast tempo)

**Dynamic Music**: Intensity scales with game timer (adaptive soundtrack)

**Volume**: Music at 60% of SFX volume by default (user adjustable)

### 11.3 Audio Cues for Opponent Actions

- Opponent uses power: Same VFX sound but 70% volume (indicates enemy action)
- Opponent gains mana: Subtle "clink" (like coins)
- Opponent's timer low (<30s): Heartbeat sound (creates pressure)

**Accessibility**: Visual indicators accompany all audio cues (for deaf/hard of hearing players)

---

## 12. BALANCING FRAMEWORK

### 12.1 Playtest Protocol

**Alpha Testing (Internal, 50 testers, 4 weeks)**:
- Track data via Unity Analytics + custom telemetry

**Metrics to Track**:
| Metric | Target | Action if Missed |
|--------|--------|------------------|
| Power usage rate | Each power used in 30%+ of games | Buff underused powers (reduce cost or increase effect) |
| Win rate with sacrifice | 55-60% | Adjust mana gained from sacrifices |
| Average game length | 15 minutes | Adjust mana generation or power costs |
| Nova usage rate | <15% of games | OK (designed as rare ultimate) |
| Fortify usage rate | 60%+ of games | OK (should be most common) |

**Balance Changes**:
- Weekly patches during alpha
- Biweekly during beta
- Monthly post-launch

### 12.2 Target Win Rates for Strategies

| Strategy | Win Rate Target |
|----------|------------------|
| Aggressive (early powers) | 48-52% |
| Control (save mana) | 48-52% |
| Sacrifice gambit | 50-55% (high risk/reward) |
| No powers used (pure chess) | 40-45% (powers should matter) |

**Design Goal**: All strategies viable, no dominant meta

### 12.3 Power Usage Distribution Goals

**Healthy Meta Indicators**:
- No single power used in >60% of games (except Fortify/Blink, which are flexible)
- All powers used in >20% of games (everything has niche)
- Power usage diversity increases with player ELO (skilled players use full toolkit)

**Red Flags**:
- One power pick rate >70% = overpowered, nerf
- One power pick rate <10% = underpowered or unclear, buff/rework

### 12.4 Meta Health Indicators

**Signs of Healthy Meta**:
- Win rate spread across ELO: Bronze 45%, Silver 48%, Gold 50%, Platinum 51%, Diamond+ 52%
- Strategy diversity: No single opening used in >40% of games
- Comeback potential: 20%+ of games won from material disadvantage

**Signs of Unhealthy Meta**:
- Single power defines meta (e.g., everyone rushing Mitosis)
- Sacrifice rate >50% of games (too incentivized)
- Games end before turn 20 (too fast, mana economy broken)

### 12.5 Patch Cadence

**Post-Launch Schedule**:
- **Hotfixes**: As needed (game-breaking bugs)
- **Balance patches**: Monthly (power cost/effect tweaks)
- **Content updates**: Every 3 months (new cosmetics, battle pass season)
- **Major updates**: Every 6 months (new game modes, features)

**Transparency**: Publish patch notes with reasoning (e.g., "Nova reduced to 10 mana because usage rate was <5%")

---

## 13. GO-TO-MARKET STRATEGY (REFINED)

### 13.1 Pre-Launch (Months 1-6)

**Phase 1: Closed Alpha (Month 4-5)**
- 50 testers (invite-only)
- Recruit from chess communities (Lichess, Chess.com forums)
- NDA required
- Goal: Core gameplay validation, bug hunting
- Feedback: Weekly surveys, Discord channel

**Phase 2: Open Beta (Month 6)**
- Steam Early Access + TestFlight (iOS) + Google Play Beta
- No NDA, encourage streaming
- Limit: 5,000 players (server stress test)
- Incentive: Beta testers get exclusive "Founder" badge + 500 premium currency
- Marketing: Reddit (r/chess, r/gamedev), Twitter, Discord servers

### 13.2 Launch Strategy (Month 7)

**Soft Launch** (Week 1):
- Release in 3 test regions: Canada, Australia, Philippines
- Monitor: Server stability, crash rates, conversion rates
- Iterate: Fix critical bugs before global launch

**Global Launch** (Week 2):
- Simultaneous: iOS App Store, Google Play, Steam
- Launch discount: Premium $7.99 (save $2) for first week only
- Press kit: Send to 50 gaming journalists (TouchArcade, Pocket Gamer, PC Gamer)

### 13.3 Marketing Channels (Budget: $25K)

**Influencer Seeding ($10K)**:
- Target: Chess streamers + strategy game YouTubers
- Tier 1 (100K+ subs): GothamChess, Agadmator, GMHikaru
  - Offer: $2K + exclusive skin for sponsored video
- Tier 2 (20K-100K): 10 streamers
  - Offer: $500 + premium account + exclusive skin
- Expected reach: 500K-1M views combined

**App Store Optimization ($5K)**:
- Hire ASO specialist
- Keyword research (chess, strategy, MOBA, tactics)
- A/B test icons, screenshots
- Localization (10 languages)

**Paid Ads ($5K)**:
- Facebook/Instagram: Target chess players, strategy gamers (18-35)
- Reddit ads: r/chess, r/gaming (sponsored posts)
- Google UAC (Universal App Campaigns)
- Goal: CPI (cost per install) <$2

**Community Building ($2K)**:
- Discord server setup + moderation (hire 2 mods)
- Reddit community (r/manachess)
- Twitter account (daily posts)

**Tournament Prize Pool ($3K)**:
- Launch tournament: $2K prize pool (1st: $1K, 2nd: $500, 3rd: $300, 4-10th: $100)
- Streamed on Twitch (official channel)
- Generates content + competitive legitimacy

### 13.4 Post-Launch Content Roadmap (First 6 Months)

**Month 1**:
- Daily monitoring, hotfix critical bugs
- Community feedback analysis
- First balance patch (power cost adjustments)

**Month 2**:
- Battle Pass Season 1 begins
- New cosmetic shop items (5 skins, 2 boards)
- Tournament Mode released

**Month 3**:
- Mid-season event (2x XP weekend)
- New game mode: "Power Draft" (random 5 powers per match)

**Month 4**:
- Battle Pass Season 2 begins
- Clan system launch
- Referral program (invite friends, earn currency)

**Month 5**:
- Major update: Quantum Mode DLC announced ($4.99)
- Draft system teaser
- Community tournament ($5K prize pool, sponsored)

**Month 6**:
- Quantum Mode release (draft 5 from 15 powers)
- New ranked season
- Physical board game Kickstarter announced

---

## 14. RISK ANALYSIS

### 14.1 Technical Risks

**Risk**: Server overload at launch (matchmaking failures)
- **Likelihood**: Medium
- **Impact**: High (bad reviews, refunds)
- **Mitigation**: Stress test with 10K+ beta users, AWS auto-scaling, queue system

**Risk**: Cross-platform sync bugs (iOS ↔ Android ↔ Steam)
- **Likelihood**: Medium
- **Impact**: Medium (player frustration)
- **Mitigation**: Unified account system (email login), extensive QA

**Risk**: Cheating/exploits (mana hacks, move validation bypass)
- **Likelihood**: Low (server-authoritative)
- **Impact**: High (game integrity)
- **Mitigation**: Server-side validation, replay audits, community reporting

### 14.2 Market Risks

**Risk**: Competitor launches similar game first
- **Likelihood**: Low (niche market, 7-month dev cycle is fast)
- **Impact**: High (loses first-mover advantage)
- **Mitigation**: Rapid development, soft launch to claim market position

**Risk**: Chess community rejects "powers" as gimmick
- **Likelihood**: Medium (chess purists are vocal)
- **Impact**: Medium (limits growth in chess niche)
- **Mitigation**: Target casual strategy gamers (larger audience), emphasize skill ceiling

**Risk**: F2P monetization fails (low conversion)
- **Likelihood**: Low (proven model, no P2W)
- **Impact**: High (can't sustain servers)
- **Mitigation**: Premium value prop clear, cosmetics high quality, Battle Pass compelling

### 14.3 Design Risks

**Risk**: Powers too confusing for casual players (8 powers overwhelm)
- **Likelihood**: Medium
- **Impact**: High (poor retention)
- **Mitigation**: Excellent tutorial (5 missions), tooltips everywhere, simplified mode (4 powers for beginners)

**Risk**: Mana economy too complex (players don't understand costs)
- **Likelihood**: Low (mana is universal in gaming)
- **Impact**: Medium (slows adoption)
- **Mitigation**: Visual mana bar (like Hearthstone), clear affordability indicators

**Risk**: Powers unbalanced (one dominates meta)
- **Likelihood**: High (balance is iterative)
- **Impact**: Medium (solvable post-launch)
- **Mitigation**: Monthly patches, track usage data, community feedback

### 14.4 Business Risks

**Risk**: Development over-budget or delayed
- **Likelihood**: Medium (indie game standard)
- **Impact**: High (cash flow issues)
- **Mitigation**: Fixed-scope MVP, cut features if needed (Quantum Mode can be post-launch), experienced Unity devs

**Risk**: App Store rejection (IAP violations, content policy)
- **Likelihood**: Low (follows guidelines)
- **Impact**: High (launch delay)
- **Mitigation**: Pre-submission review (Apple's free service), standard IAP implementation

**Risk**: Negative reviews tank rating (<3.5 stars)
- **Likelihood**: Low (solid core gameplay)
- **Impact**: High (kills organic growth)
- **Mitigation**: Soft launch testing, rapid bug fixes, community engagement

---

## 15. APPENDIX

### 15.1 Glossary of Terms

- **Mana**: Resource used to activate powers (3 per turn)
- **Center Control**: Occupying 3+ of d4, d5, e4, e5 squares (+1 mana/turn)
- **Sacrifice**: Voluntarily remove your piece for mana
- **Power**: One of 8 special abilities (Fortify, Blink, Mitosis, etc.)
- **Shield**: Protective effect from Fortify (blocks 1 capture)
- **Phase**: Ghostly state from Phase Shift (pass through pieces)
- **Clone**: Duplicate piece created by Mitosis
- **Blast Radius**: Area affected by Time Bomb or Nova

### 15.2 FAQ for Players

**Q: Is this pay-to-win?**
A: No. All players have access to all 8 powers. Purchases are cosmetic only (skins, boards) or remove ads (Premium). Free players can reach Grandmaster rank.

**Q: How long does a game take?**
A: Average 15 minutes (Rapid mode). Blitz mode is 8-12 minutes, Classical is 20-30 minutes.

**Q: Can I play against friends?**
A: Yes! Add friends and challenge them. Custom games are unlimited for Premium users (2/day for free).

**Q: Do I need to know chess?**
A: Basic knowledge helps (how pieces move), but the tutorial teaches everything. Powers add new strategies even for chess experts.

**Q: Can I turn off powers and play normal chess?**
A: Not in matchmaking (powers define the game). Custom games can restrict powers, but standard chess is better played on Lichess/Chess.com.

**Q: What happens if I disconnect?**
A: 60-second grace period to reconnect. If timer expires, you forfeit. No ELO loss if server issues (detected automatically).

**Q: Can I get refunds on purchases?**
A: Follow platform policies (Apple/Google/Steam). Premium is non-refundable after 14 days. Cosmetics are non-refundable.

### 15.3 FAQ for Developers

**Q: Why Unity over Unreal/Godot?**
A: Unity's mobile tooling is mature, cross-platform export is reliable, and team has experience. 2D-ish game doesn't need Unreal's graphics power.

**Q: Why server-authoritative networking?**
A: Turn-based game doesn't need client prediction (unlike FPS). Server authority prevents cheating (move hacks, mana exploits).

**Q: How do we prevent AI assistance (chess engines)?**
A: V1.0 doesn't detect engines (too complex). Ranked mode reviews suspicious win rates manually. Future: statistical analysis (move time, accuracy patterns).

**Q: Why PostgreSQL over NoSQL?**
A: Relational data (users, matches, purchases) fits SQL well. PostgreSQL is rock-solid, has great JSON support (for match data), and scales vertically easily.

**Q: Why not blockchain/NFTs for cosmetics?**
A: No. NFTs add zero value, increase complexity, and alienate players. Cosmetics are centrally owned (like Fortnite).

**Q: How do we handle matchmaking fairness?**
A: ELO-based (±100 ELO range). Expands range after 30s queue. New players play placement matches (10 games) to calibrate. Separate pools for Blitz/Rapid/Classical.

### 15.4 Competitive Ruleset (Tournament Mode)

**Time Control**: 10+5 Rapid (standard)

**Bans**: None (all 8 powers legal)

**Pauses**: 1 per player per game (max 60 seconds)

**Disconnections**: 60-second grace period, then forfeit

**Draws**: Offered after 20 moves (both must agree)

**Prize Distribution**:
- Single elimination bracket (best of 3)
- Swiss format for large tournaments (7 rounds)
- Tiebreakers: Buchholz score, then head-to-head

**Anti-Cheat**:
- All games recorded
- Suspicious patterns flagged (admin review)
- Banned players forfeit prizes

**Platform**: In-game tournament mode (auto-bracket, scheduling)

---

## DOCUMENT END

**Next Steps**:
1. Assemble development team (2 Unity devs, 1 artist, 1 sound designer, 1 QA)
2. Create project timeline (Gantt chart, sprint planning)
3. Build vertical slice (1 power functional, basic board, mana system)
4. Iterate based on this GDD

**Contact**:
- Project Lead: [Your Name]
- Email: [Your Email]
- Discord: [Server Link]

**Version History**:
- v1.0 (April 30, 2026): Initial production-ready GDD

---

**Total Word Count**: ~6,800 words

This document is ready for handoff to development team. All systems specified with exact numbers, clear rationale, and implementation guidance.