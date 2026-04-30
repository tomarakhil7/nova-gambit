# Mana Chess - Playable Prototype

Single-machine hotseat implementation of the Mana Chess variant built from GDD v2.1.

## Running

```bash
# From the game/ directory:
python3 -m http.server 8765
# Then open http://localhost:8765/
```

No build step, no dependencies. Pure HTML/CSS/JS.

## Testing

```bash
# Full test suite (Node):
node tests/test-runner.js
# → 81 tests, all passing

# Browser smoke tests:
open http://localhost:8765/tests/test.html
```

## Architecture

```
game/
├── index.html                # Main UI
├── css/style.css             # All styles + VFX animations
├── js/
│   ├── chess-engine.js       # Layer 1: FIDE chess rules (pure)
│   ├── mana-system.js        # Layer 2: mana, sacrifice, 9 powers
│   └── ui.js                 # Layer 3: rendering + input
└── tests/
    ├── test-runner.js        # Node test harness (81 cases)
    └── test.html             # Browser smoke tests
```

Three-layer design: the chess engine knows nothing about powers. Adding or
disabling powers does not affect normal chess moves.

## How to Play (hotseat)

1. **White moves first** — click your piece, then click a highlighted square.
2. **Mana** accumulates at +3/turn (+1 for controlling the center).
3. **Fountains** (`a4`, `a5`, `h4`, `h5`) give +2 mana when you capture on them.
4. **Powers** (right panel) — click a power to activate targeting, then click targets.
5. **Sacrifice** — click the sacrifice button to burn your own piece for mana.
6. **Win conditions**: Checkmate, King destroyed by power, Stalemate = draw.
7. **Press ESC** to cancel any pending power/selection.

## Powers (all balanced per GDD v2.1)

| Power | Cost | Effect |
|---|---|---|
| Fortify | 4 | Shield a piece (blocks next capture) |
| Blink | 5 | Teleport own piece to empty square (voids castling) |
| Phase Shift | 5 | Piece passes through pieces for 2 turns |
| Time Bomb | 6 | 3-turn fuse, 3x3 blast (Dead-Man's Hand rule applies) |
| Mana Burn | 6 | Drain 5 mana from opponent |
| Mitosis | 7 | Clone non-King piece (Fragile - vanishes when attacked) |
| Chain Lightning | 8 | Capture + chain to adjacent enemy |
| Rewind | 10 | Undo opponent's last move (no mana refund) |
| Nova | 12 | 8-square blast (self-destruction loses the game) |

## Key GDD v2.1 Edge Cases Implemented

- **Dead-Man's Hand Rule** — if Nova/Time Bomb destroys both Kings, caster loses
- **Fragile promotion persistence** — cloned Fragile pawn promotes to Fragile Queen
- **Rewind no mana refund** — opponent's spent mana stays gone
- **Fortified King still in check** — shield doesn't bypass FIDE check rules
- **Blink voids castling** — using Blink on King/Rook disables castling
- **Phase Shift King transit** — phased pieces can pass through Kings but not land on them
- **Center squares** — controlling 3+ of d4/d5/e4/e5 gives +1 mana/turn
- **Fountain squares** — a4/a5/h4/h5 give +2 mana on capture
- **Time Bomb reveal** — opponent sees bomb 1 turn before detonation
- **Shielded capture** — attacker does NOT move (capture fizzles); Fragile vanish = attacker lands

## Test Coverage

- Core chess rules (pawn movement, EP, promotion, castling, check/checkmate/stalemate)
- All 9 powers (happy path + error cases)
- Every GDD v2.1 edge case
- Full game simulation (10-move opening)
- Mana cap & Mana Burn boundary cases
- Sacrifice + king safety interaction

Run `node tests/test-runner.js` for the full list.
