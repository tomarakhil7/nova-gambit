# NOVA Gambit v3.5

NOVA Gambit is FIDE chess augmented with an **Aether economy** and **13 tactical powers**. Players generate Aether each turn (base generation scales by turn count, with bonuses for center control and Fountain occupation) and spend it on powers that range from freezing enemy pieces to rewinding an opponent's entire turn.

---

## Running the Game

### Local (hotseat)
```bash
cd game/
python3 -m http.server 8765
# Open http://localhost:8765/
```

No build step, no dependencies. Pure HTML/CSS/JS.

### Multiplayer (via server)
```bash
cd server/
npm install
npm start
# Server runs on port 3000 by default. Players create/join rooms via the in-game "Play Online" button.
```

The client auto-detects `localhost:3000` for local testing. Deploy the server anywhere to enable remote play.

---

## UI Overview

### Header
- **NOVA GAMBIT** title + turn indicator (Turn N — White/Black to move)
- **🌐 Play Online** — open multiplayer lobby
- **📖 Powers** — quick-reference codex (card browser + inline cast)
- **📜 Compendium** — full power reference with targeting rules, restrictions, use cases, and counterplay
- **Time mode** — Blitz 3+2 / Rapid 10+5 / Classical 15+10 / Untimed
- **↻ New Game** — reset board for local hotseat
- **👤 Sign in** — auth modal (or account menu if logged in)

### Left Sidebar
- **Player cards** (White + Black):
  - Name + color dot + "YOU" badge (online mode)
  - Clock (MM:SS or MM:SS.d below 10s)
  - Aether bar (current / 30) with +gain flash (green) and -burn flash (red)
- **Board legend**:
  - Center squares (yellow overlay) — strict majority = +1 Aether
  - Fountain (dashed blue ring) — +2 Aether per piece (stacks)
  - Bomba (red circle with countdown)
  - Base generation scaling: Turns 1–10: +1 · 11–20: +2 · 21+: +3
- **Piece Status legend**:
  - Shielded (cyan border) — absorbs 1 hit, lasts 1 turn
  - Frozen (blue dotted border) — skips next turn, blocks castling
  - Captor (⛓) — holds a prisoner
  - Spectral (50% opacity) — can't move, vanishes next turn
- **Active Effects panel**:
  - Live list: bombs, shields, freezes, imprisonments, spectrals, Aether Blocks
- **Sacrifice values**:
  - Pawn +1 · Minor +2 · Rook +4 · Queen +6
  - 1 / turn · Turn continues

### Board (center)
- 8×8 grid with algebraic coordinates (a1–h8)
- **Center squares** (d4, e4, d5, e5) — yellow overlay
- **Fountains** — 4 per game, seeded randomly at game start (ranks 3–6, excluding center and starting-occupied squares, no two on same rank/file)
- **Bombs** — red circles with countdown (2 → 1); 3×3 danger zones (yellow = 2 turns, red = 1 turn, pink = 0 turns)
- **Last-move highlight** — green border on source + destination squares
- **Legal-move hints** — dots (move) / rings (capture)

### Right Sidebar
- **Event Log** — scrolling feed of moves, captures, power casts, Aether generation, effects expiring

### Power Deck (below board)
- **Sacrifice button** — 1/turn, destroy non-King piece for Aether
- **Hint text** — "Hover a card for details · Click to cast"
- **13 power cards** — tier color-coded (START green, MID blue, END purple)
  - Each card shows icon, name, cost, and art
  - Grayed-out when unaffordable or game-over
  - Active card glows when targeting in progress
  - Hover for full tooltip (targeting, turn-ends, can-mate)

### Status Bar (bottom)
- Left: status message (move made, error, power cast, etc.)
- Right: "Hotseat — pass the device each turn · ESC to cancel"

---

## Game Mechanics

### Aether Economy
- **Starting values**: White 0, Black 1 (to balance first-move advantage)
- **Base generation** (at start of each player's turn):
  - Turns 1–10: +1 Aether
  - Turns 11–20: +2 Aether
  - Turns 21+: +3 Aether
- **Center bonus**: +1 Aether if you occupy MORE center squares than opponent (strict majority, spectral pieces don't count)
- **Fountain bonus**: +2 Aether per piece occupying a fountain (stacks)
- **Cap**: 30 Aether max
- **Sacrifice**: Destroy your own non-King piece for Aether (1 / turn, turn continues)
  - Pawn +1 · Knight/Bishop +2 · Rook +4 · Queen +6

### Win Conditions
- **Checkmate** — king cannot escape check (standard FIDE)
- **Timeout** — clock runs out (in timed modes)
- **Resignation** — player forfeits
- **Disconnect** — opponent disconnects in online mode (30s grace period)
- **Stalemate** — no legal moves + not in check = **draw**

### Powers and Check
- **In check**: You MUST move out of check or cast a power that resolves check (Blink your King, Imprison the checker, Vengeance the checker, Chronobreak to undo the move that gave check, Double Attack to capture the checker, Cleanse to free a piece that blocks, etc.)
- **Discovered check**: If a power (e.g. Imprison, Cleanse) gives check to the OPPONENT, control passes to them IMMEDIATELY — the caster cannot stack another action that could amount to checkmate from a discovered check (mate from discovered check is fine — the engine detects it at end-of-turn).

---

## The 13 Powers

| Tier | Cost | Name | Effect |
|------|------|------|--------|
| 1 | 6 | **Spawn** | Summon a Spectral Pawn in your half (ranks 1–4). Lasts 1 turn. Cannot move/sacrifice. Turn continues. |
| 1 | 7 | **Fortify** | Grant 1-hit shield to your piece. Absorbs next capture (attacker does NOT land). Expires end of your next turn. Turn continues. |
| 1 | 8 | **Frost** | Freeze enemy non-King for 1 turn. Blocks castling. Turn continues. |
| 1 | 8 | **Blink** | Teleport your non-King piece to empty square in 3×3 grid. Turn ends. Cannot mate. |
| 2 | 10 | **Aether Block** | Silence opponent — they can't spend Aether next turn. Active effects still tick. Turn continues. |
| 2 | 14 | **Bomba** | Pawn-only. Plant bomb directly ahead or diagonally forward from one of your pawns. Detonates next turn — 3×3 blast destroys unshielded ENEMY non-Kings. Turn continues. |
| 2 | 14 | **Cleanse** | Remove Imprison/Frost from any piece. Prisoner returns to its OWN start tile (or waits OFF-BOARD if occupied). Turn continues — UNLESS you deliver check. |
| 2 | 14 | **Imprison** | Capture adjacent enemy non-King INSIDE your piece. Captor can move. Prisoner returns to its OWN start tile if captor dies. Turn continues — UNLESS you deliver check. |
| 2 | 14 | **Double Attack** | One piece takes TWO actions (move OR capture). Each step must be legal. Cannot target King. Cannot mate. Turn ends. |
| 3 | 15 | **Promote** | Instantly promote any pawn to Q/R/B/N. Turn ends. CAN mate. |
| 3 | 18 | **Vengeance** | Destroy any enemy non-King. Bypasses shield. Cannot leave King in check. Cannot mate. Turn ends. |
| 3 | 18 | **The Wall** | Spawn friendly pawns on all empty adjacent squares around an anchor. Skips last-rank squares. Cannot check/mate enemy King. Turn ends. |
| 3 | 20 | **Chronobreak** | Undo opponent's ENTIRE previous turn (moves + powers). Opponent keeps spent Aether. Cannot undo Chronobreak. CANNOT undo checkmate. Turn continues. |

---

## v3.5-Specific Notes

### Imprison / Cleanse Alignment
- **Costs**: Both are 14 Aether (previously Imprison was 12, Cleanse was 16). Now symmetrical for fairness.

### Bomba Placement
- **Pawn-only power**: Only a pawn may cast Bomba.
- **Target squares**: The bomb must land on an empty square that is **directly ahead** OR **diagonally forward** from one of your (non-spectral) pawns — the 3 squares in front of any pawn.
- **Clarification**: This is NOT "adjacent to a pawn" — it's specifically the 3 forward-facing squares a pawn could advance/attack to.

### Imprison Prisoner Return
- **Home tile logic**: Prisoners return to their OWN starting tile (e.g. a black knight imprisoned from b8 returns to b8, NOT the imprisoner's home tile).
- **Occupied home tile**: If the home tile is occupied, the prisoner waits **OFF-BOARD** and automatically re-enters at the start of its owner's turn the moment the tile is free.
- **Applies to**: Both captor-death release AND Cleanse.

### Chronobreak Scope
- **Rewinds**: EVERY action the opponent took last turn — every move, capture, AND every power cast (Frost, Fortify, Blink, Spawn, Bomba, Double Attack, Imprison, Aether Block, Cleanse, Promote, Vengeance, The Wall).
- **Restores**: Board, prisoners, shields, freezes, bombs, blocks, per-turn flags.
- **Opponent keeps spent Aether**: Chronobreak does NOT refund the opponent's mana.
- **Cannot rewind checkmate**: If the opponent delivered checkmate, the game is already over — Chronobreak is too late.

### Powers and Check Interaction
- **In check**: You MUST address check first. Powers that don't move pieces (Frost, Fortify, Aether Block, Bomba when no defuse) are rejected if you're in check.
- **Discovered check**: If a power (Imprison, Cleanse) removes a piece and this EXPOSES a discovered check on the enemy King, control passes to the opponent IMMEDIATELY. The caster cannot continue playing to stack another action that could deliver mate from a discovered check.

---

## Test Coverage

All tests pass. Run:
```bash
node tests/test-runner.js
```

**Regressions checked**:
- Imprison/Cleanse home-tile logic (prisoners return to OWN start tile, not captive's current column)
- Bomba pawn-only + placement (3 forward-facing squares from any of your pawns)
- Chronobreak scope (undoes moves + powers, does NOT refund opponent's Aether)
- Double Attack semantics (move-OR-capture twice, not "capture then optional move")
- Discovered check pass-turn (Imprison/Cleanse that gives check end the turn immediately)

---

## Architecture

```
game/
├── index.html                # UI shell + sidebars + power deck
├── css/style.css             # All styles + VFX (Fortify shield, Blink flash, etc.)
├── js/
│   ├── chess-engine.js       # Layer 1: FIDE chess (pure, no powers)
│   ├── mana-system.js        # Layer 2: Aether economy + 13 powers
│   ├── ui.js                 # Layer 3: rendering + input + replay viewer
│   ├── auth.js               # Firebase auth (login/signup/logout)
│   └── net.js                # WebSocket client (multiplayer)
└── tests/
    ├── test-runner.js        # Node test harness (all regressions)
    └── test.html             # Browser smoke tests

server/
├── server.js                 # WebSocket server (room management + action relay)
└── package.json
```

Three-layer design: the chess engine knows nothing about powers. Powers are injected as a second layer. UI is the third layer.

---

## Changelog

**v3.5** (current)
- Imprison/Cleanse cost aligned at 14.
- Bomba is pawn-only; placement is the 3 forward-facing squares from any pawn.
- Prisoners return to their OWN start tile (originFile logic). If occupied, they wait OFF-BOARD and re-enter when free.
- Chronobreak undoes moves + powers (every action the opponent took last turn). Cannot undo checkmate.
- Powers respect check: in check, you must move/cast to resolve check first. Powers that give discovered check on opponent pass turn immediately.
- Aether generation moved to START-of-turn (was end-of-turn in v3.3).
- Base generation scales by turn count (1-10:+1, 11-20:+2, 21+:+3).
- Fountains are per-game random (4 fountains, ranks 3–6, no two on same rank/file).

**v3.3**
- Ghost removed; Chain Lightning renamed to Double Attack.
- Cleanse added (cost 16 → 14 in v3.5).
- Imprison rework: captor can move; prisoner returns home on captor death.
- Power-aware mate detection (engine checks if player can escape mate with affordable powers).

**v3.0**
- Nova removed; Mana Burn replaced by Aether Block.
- Mitosis removed; Time Bomb renamed to Bomba.
- Phase Shift removed; Rewind renamed to Chronobreak.

**v2.1** (legacy)
- 9 powers: Nova, Fortify, Blink, Phase Shift, Time Bomb, Mana Burn, Mitosis, Chain Lightning, Rewind.
- Mana economy: fixed +3/turn, +1 center, +2 fountain capture.

---

## Credits

Design: [GDD v3.5]  
Engine: Pure JS (FIDE chess + Aether layer + powers layer)  
UI: Vanilla HTML/CSS/JS (no frameworks)  
Server: Node.js + `ws` WebSocket library  
Auth: Firebase (optional, for online mode)

---

## License

MIT
