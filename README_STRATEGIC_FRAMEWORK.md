# Nova Gambit Chess Variant - Strategic Framework & Bot Guidelines

## Overview

This directory contains a comprehensive strategic analysis of the Nova Gambit chess variant (13 aether powers) and a complete implementation roadmap for building an expert-level AI bot.

## Quick Links

### Main Strategic Documents
1. **STRATEGIC_FRAMEWORK.md** (42 KB, 17 sections)
   - Complete game-winning strategy covering all 3 game phases
   - Power combination synergies (Tier S/A/B analysis)
   - Aether economy principles and optimal bands
   - Positioning strategy for power enablement
   - 12 critical anti-patterns to avoid
   - **Start here for strategic understanding**

2. **POWER_PRIORITY_MATRIX.json** (17 KB, 2000+ lines)
   - Machine-readable priority lookup tables
   - Power rankings by game phase
   - Multiplier matrices (phase/material/threat/aether)
   - Decision rules and pseudocode templates
   - **Reference for bot implementation**

3. **BOT_IMPLEMENTATION_CHECKLIST.md** (20 KB, 400+ items)
   - Step-by-step implementation guide
   - All 13 powers with priority calculations
   - Synergy detection system
   - Aether economy tracker
   - Validation layer specifications
   - Edge case handling
   - **Step-by-step development guide**

4. **DELIVERY_SUMMARY.txt** (12 KB)
   - Executive summary
   - Key strategic insights
   - Quick reference tables
   - Implementation roadmap (9-10 days)
   - Success metrics
   - **Quick reference overview**

## Document Organization

### Strategic Levels

**Level 1: Foundational Understanding** (Read First)
- DELIVERY_SUMMARY.txt (5-10 min read)
- Overview of all 13 powers
- Game phases explained
- Key strategic principles

**Level 2: Strategy Deep Dive** (Read Second)
- STRATEGIC_FRAMEWORK.md
- Comprehensive game phase strategy
- Power synergies and combos
- Aether economy deep dive
- Threat assessment framework

**Level 3: Implementation Reference** (Read During Development)
- POWER_PRIORITY_MATRIX.json
- Priority calculations and formulas
- Multiplier lookup tables
- Decision trees and pseudocode

**Level 4: Development Checklist** (Use as Guide)
- BOT_IMPLEMENTATION_CHECKLIST.md
- Implementation verification items
- Edge case handling
- Testing procedures

## Core Concepts Summary

### Game Phases
- **Opening (Turns 1-10):** Develop pieces, accumulate aether
- **Early Middlegame (Turns 11-15):** Power activation peak
- **Late Middlegame (Turns 16-25):** Expensive powers viable, cap pressure
- **Endgame (Turns 26+):** Permanently capped aether, pawn races dominate

### Power Cost Tiers
- **Cheap (6-8):** SPAWN, FROST, BLINK
- **Mid (14-16):** IMPRISON, CLEANSE, DOUBLE_ATTACK, FORTIFY, AETHER_BLOCK, BOMBA
- **Expensive (15-20):** PROMOTE, VENGEANCE, WALL, CHRONOBREAK

### Critical Rules
1. **Pawn on 7th rank = EMERGENCY** (+750 priority override)
2. **Aether cap at 30 = MUST spend** (penalty: -3 aether/turn)
3. **Checkmate threat = OVERRIDE everything** (×2.0 priority on defense)
4. **Fountain control = +2 aether/turn** (stacking advantage)

### Tier S Power Synergies (Game-Changing)
1. **FROST + IMPRISON** (22 aether) → Queen removal, 41x ROI
2. **FORTIFY + DOUBLE_ATTACK** (28 aether) → 1000+ material
3. **AETHER_BLOCK + VENGEANCE** (34 aether) → Opponent trapped
4. **WALL + PROMOTE** (33 aether) → Unbreakable fortress
5. **CLEANSE + DOUBLE_ATTACK** (28 aether) → Freed piece attacks 2x
6. **IMPRISON + CAPTURE** (14 aether) → Undefended piece removal
7. **FROST + BLINK** (24 aether) → Safe escape
8. **CHRONOBREAK + UNDO** (20 aether) → Game changer

## Implementation Roadmap

### Phase 1: Foundation (2 days)
- [ ] Implement 13 base priority calculations
- [ ] Apply multipliers (phase/material/threat/aether)
- [ ] Verify priority range (0-500+)

### Phase 2: Powers (3 days)
- [ ] Each power implemented with target scanning
- [ ] Bonuses and penalties applied
- [ ] Validation layer in place

### Phase 3: Synergies (1 day)
- [ ] Tier S synergies recognized
- [ ] Multi-turn setups anticipated
- [ ] Anti-synergies blocked

### Phase 4: Economy (1 day)
- [ ] Aether generation tracked
- [ ] Cap enforcement (30 limit)
- [ ] Hoarding prevention

### Phase 5: Integration (1 day)
- [ ] Game phase transitions working
- [ ] Power preferences shift appropriately

### Phase 6: Testing (2 days)
- [ ] Unit tests for each power
- [ ] Self-play 10+ games
- [ ] Verify no illegal moves

**Total: ~9-10 days (1.5-2 weeks)**

## Critical Success Factors

✓ Win 70%+ vs Easy bot
✓ Win 55%+ vs Medium bot
✓ Competitive vs Hard bot (50%+)
✓ Zero illegal moves
✓ Aether never wastes (never exceeds 30)
✓ Checkmate threats detected 1-2 turns ahead
✓ Passed pawn threats addressed immediately
✓ Power combos executed correctly

## Key Anti-Patterns to Avoid

❌ Frost on low-value pieces (<300 material)
❌ Promote without checking opponent Vengeance (18+ aether)
❌ Ignore passed pawn 7th rank (= -900 material loss)
❌ Chronobreak on minor losses (<400 material)
❌ Double Attack on defended pieces (recapture loss)
❌ Wall in sparse endgame (few pieces, 18 cost wasteful)
❌ Aether Block when behind material (doesn't help)
❌ Let aether cap wastefully (= -3 aether/turn)

## Quick Reference

### Power Priority by Phase
| Phase | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| Opening | None | - | All (too expensive) |
| Early Mid | FROST, IMPRISON, DOUBLE | CLEANSE, FORTIFY, BLINK | VENGEANCE, WALL |
| Late Mid | PROMOTE, VENGEANCE, IMPRISON | WALL, AETHER_BLOCK, FROST | SPAWN, CLEANSE |
| Endgame | VENGEANCE, CHRONOBREAK, PROMOTE | BLINK, FROST, CLEANSE | DOUBLE, AETHER_BLOCK |

### Aether Spending Policy
| Level | Action |
|-------|--------|
| 0-13 | Accumulate only (no powers) |
| 14-19 | Cheap/mid powers (Frost, Imprison) |
| 20-25 | All powers viable (balanced) |
| 26-30 | Aggressive dumping (15+ cost powers) |

### Fountain Value
- Each fountain: +2 aether/turn
- 2 fountains: +4 aether/turn (cap hit in 6-7 turns)
- Break-even: 10 turns = 1 mid-tier power (worth ~100 material sacrifice)

## File Structure

```
/Users/a.tomar/Documents/Work/chess/
├── STRATEGIC_FRAMEWORK.md              (Main strategy guide)
├── POWER_PRIORITY_MATRIX.json          (Implementation reference)
├── BOT_IMPLEMENTATION_CHECKLIST.md     (Step-by-step guide)
├── DELIVERY_SUMMARY.txt                (Executive summary)
├── README_STRATEGIC_FRAMEWORK.md       (This file)
├── game/js/
│   ├── bot.js                          (Bot implementation)
│   └── mana-system.js                  (Power definitions)
└── (Other game files)
```

## How to Use This Framework

### For Strategy Understanding
1. Read DELIVERY_SUMMARY.txt (5 min)
2. Review "Quick Reference" section above
3. Study STRATEGIC_FRAMEWORK.md (1-2 hours)
4. Practice concepts through bot testing

### For Bot Implementation
1. Reference POWER_PRIORITY_MATRIX.json for formulas
2. Follow BOT_IMPLEMENTATION_CHECKLIST.md step-by-step
3. Implement one power at a time
4. Test each power independently
5. Integrate synergy detection
6. Run 10+ self-play games
7. Verify success metrics

### For Specific Queries
- **"How should the bot play in opening phase?"** → STRATEGIC_FRAMEWORK.md, Section 1
- **"What's the best combo for Queen?"** → DELIVERY_SUMMARY.txt or STRATEGIC_FRAMEWORK.md, Section 2
- **"How should the bot spend aether?"** → STRATEGIC_FRAMEWORK.md, Section 3
- **"How do I implement Imprison priority?"** → POWER_PRIORITY_MATRIX.json
- **"What are the implementation steps?"** → BOT_IMPLEMENTATION_CHECKLIST.md

## Additional References

### Individual Power Analyses
Detailed analysis of each power available in separate documents:
- FROST: 8 aether, defensive control
- IMPRISON: 14 aether, tactical removal
- DOUBLE_ATTACK: 14 aether, material gain
- PROMOTE: 15 aether, pawn promotion
- VENGEANCE: 18 aether, destruction
- WALL: 18 aether, fortress building
- CHRONOBREAK: 20 aether, time rewind
- (And 6 others)

### Related Files
- game/js/bot.js: Current bot implementation
- game/js/mana-system.js: Power system definitions
- NOVA_GAMBIT_GDD_v3.0.md: Full game design document

## Contact & Support

For clarifications on:
- Strategic principles: See STRATEGIC_FRAMEWORK.md
- Implementation details: See BOT_IMPLEMENTATION_CHECKLIST.md
- Specific formulas: See POWER_PRIORITY_MATRIX.json
- Quick answers: See DELIVERY_SUMMARY.txt

---

**Last Updated:** July 1, 2026
**Framework Version:** 2.0 (Complete)
**Status:** Ready for Implementation
