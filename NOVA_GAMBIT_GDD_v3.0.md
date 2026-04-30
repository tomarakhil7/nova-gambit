# NOVA GAMBIT — Game Design Document v3.0

**Author:** Senior Game Systems Architect / Balance Lead
**Status:** Production spec (supersedes v2.1)
**Codename:** AETHER BATTLE
**Platform:** Mobile-first web (portrait + landscape), online PvP

---

## 1. Design Pillars

| Pillar | Statement |
|---|---|
| Chess-pure floor | Every legal chess position remains legal. Powers layer on top of FIDE. |
| Volatile Aether economy | Players manage a scarce resource that fuels 12 asymmetric powers. |
| Zero-Draw hard rule | Stalemate still exists (can't eliminate in pure chess), but **all power-caused draws resolve to a loser**. |
| Twitch-readable | Every power has a 1-glance VFX + SFX. No hidden information after the first turn. |

---

## 2. Aether Economy

| Parameter | Value | Rationale |
|---|---|---|
| Starting Aether (White) | **0** | White has move-1 tempo advantage, so starts broke. |
| Starting Aether (Black) | **1** | Black offset — compensates for second-move disadvantage. |
| Base generation / turn | **+3** | Gives every player a cheap Tier-1 power every turn after turn 2. |
| Aether cap | **30** | Enables the 30-cost "The Wall" without infinite hoarding. |
| Center control bonus | **+2 / turn** | If you hold 3+ of d4/d5/e4/e5. |
| Fountain bonus | **+2 / turn per fountain occupied** | 4 fountains, placed **randomly** each game (see §2.1). |

### 2.1 Random Fountains
- At game setup, 4 squares are chosen uniformly at random from the 32 squares in the middle 4 ranks (ranks 3–6). Constraints:
  - No fountain on a square that starts occupied.
  - No two fountains on the same file or rank (promotes spread).
  - No fountain in the 4 center squares (those have the Center bonus already).
- Fountain tiles are visible to both players and **never move**.
- At the **start of each turn**, every fountain tile you occupy grants **+2 Aether** (stacks: occupy all 4 → +8/turn).
- **Design note:** Fountains replace the old "on-capture" bonus model. Now it is a standing territorial objective.

### 2.2 Sacrifice
- Click the Sacrifice button, click any non-King piece of yours → piece is removed, you gain Aether.
- **1 sacrifice per turn.** The turn **continues** after sacrifice (you still must move, or cast more powers).
- Can't sacrifice if it would leave your own King in check.

| Piece | Aether gained |
|---|---|
| Pawn | 1 |
| Knight / Bishop | 2 |
| Rook | 4 |
| Queen | 6 |

*Queen sacrifice (6 Aether) is deliberately below piece value (9) — material loss must hurt.*

---

## 3. Power Tiers

Powers are grouped by cost band. This teaches tempo: cheap powers early, ultimates late.

### 3.1 START GAME (Tier 1) — 4–7 Aether

| Power | Cost | Targeting | Duration | Turn ends? | Can checkmate? |
|---|---|---|---|---|---|
| **Frost** | 4 | Enemy non-King piece | 1 of owner's turns | **No** | n/a |
| **Fortify** | 5 | Your piece | Until 2 hits | **No** | n/a |
| **Blink** | 6 | Your piece → empty square | Instant | **Yes** | **No** |
| **Spawn** | 7 | Empty square on your half | 1 turn cycle | **No** | **No** |

### 3.2 MID GAME (Tier 2) — 8–13 Aether

| Power | Cost | Targeting | Duration | Turn ends? | Can checkmate? |
|---|---|---|---|---|---|
| **Ghost** | 9 | Your piece | 1 turn (yours only) | **Yes** | **No** |
| **Bomba** | 10 | Empty square | 3 turns, defusable | **No** | n/a (can still deliver via explosion kill of King) |
| **Chain Lightning** | 11 | Your piece + adj pair | Instant | **Yes** | **No** (cannot mate, but breaks shields) |
| **Imprison** | 12 | Adjacent enemy piece | Until captor dies | **No** | n/a |
| **Aether Block** | 13 | n/a (targets opponent) | Opponent's next turn | **No** | n/a |

### 3.3 END GAME (Tier 3) — 14–30 Aether

| Power | Cost | Targeting | Duration | Turn ends? | Can checkmate? |
|---|---|---|---|---|---|
| **Promote** | 15 | Your pawn | Instant | **Yes** | Yes (via promotion) |
| **Chronobreak** | 20 | n/a | Instant | **No** | n/a (reverts board) |
| **Vengeance** | 25 | Any enemy non-King piece | Instant | **Yes** | **No** |
| **The Wall** | 30 | Your piece | Instant | **Yes** | Yes (if mate is forced by wall setup) |

### 3.4 Removed From v2.1
- **Nova** — too swingy; removed in favor of targeted Vengeance + area Bomba.
- **Aether Burn** — superseded by **Aether Block** (smoother telegraph).
- **Mitosis** — clone logic too fragile to balance; removed.

---

## 4. Detailed Power Specifications

### 4.1 Fortify (5) — Tier 1
- Shield absorbs **one** attack — 1st attack breaks the shield (attacker does NOT move). The 2nd attack captures the piece normally.
- Not stackable on the same piece.
- **Cannot** be applied to Spectral Pawns, Imprisoned captors, or Frozen pieces.
- **Turn continues** (you still must move).

### 4.2 Blink (6) — Tier 1
- Your piece teleports to any empty square (cannot land into self-check).
- Voids castling rights on the Blinked piece if King or Rook.
- If the Blinked piece lands adjacent to the enemy King and gives check, it's **not checkmate** — the move that delivers mate must be the one that ends the turn. **Blink-to-mate is disallowed** (engine rejects the move if it would mate).
- Defuses a Bomba if it lands on one.
- **Turn ends**.

### 4.3 Frost (4) — Tier 1
- Freezes an enemy non-King piece for **1 full turn cycle of its owner** (enemy's next turn: piece can't move).
- A frozen Rook or King *blocks castling* (even though it's the King who's never frozen, Frost on the castling Rook makes castling illegal).
- Frozen pieces still give check (they still attack their squares).
- Frozen pieces can still be captured normally.
- **Turn continues**.

### 4.4 Spawn (7) — Tier 1
- Creates a **Spectral Pawn** of your color on an empty square in your half of the board (ranks 1–4 for White, 5–8 for Black).
- The Spectral Pawn:
  - **Cannot be moved** on any turn.
  - **Cannot be sacrificed** for Aether.
  - **Cannot be Fortified or Imprisoned**.
  - **Can block** pieces, **can be captured** like a normal pawn, **can give check** if placed adjacent diagonally to enemy King.
  - **Vanishes** at the start of your next turn (removed automatically).
- **Turn continues**.

### 4.5 Ghost (9) — Tier 2
- Your piece gains Phase for this turn only: can move through occupied squares, cannot land on a King.
- **Cannot** deliver checkmate (engine-rejects mate-delivering Ghost moves).
- **Turn ends** (you must move the Ghosted piece this turn).

### 4.6 Bomba (10) — Tier 2
- Plant on an **empty** square (cannot stack). 3-turn fuse.
- Both players see the bomb + turn counter from plant. 3×3 explosion at turn 0.
- **Defused** when any piece moves/Blinks/Chronobreaks onto the square.
- **Dead-Man's Hand:** if explosion destroys both Kings, **the player who planted the bomb LOSES**.
- If explosion destroys only the planter's King: planter loses.
- If only the opponent's King: planter wins.
- Shielded pieces survive (Fortify consumed by 1 HP).
- **Turn continues** (you still must move after planting).

### 4.7 Chain Lightning (11) — Tier 2
- Move-to-capture with any of your pieces, then attack jumps to an enemy piece adjacent to the first capture target.
- Respects Fortify: if first or second target is shielded, that hit breaks the shield (1 HP) and chain ends there.
- Can break through a shielded King (reduces Fortify to 1 HP) but **cannot deliver checkmate** (engine-rejects if the chain's end state is mate).
- **Turn ends.**

### 4.8 Imprison (12) — Tier 2
- Your piece captures an **adjacent** (8-direction) enemy non-King piece — but instead of removing it, the captured piece is held *inside* the captor.
- The captor:
  - Shows a visible "cage" indicator with the imprisoned piece type.
  - **Cannot move, be sacrificed, Fortified, Blinked, Ghosted, or targeted by Wall** while holding.
  - Can still give check/checkmate from its current square.
- When the captor is captured (by any means — normal capture, Bomba, Vengeance), the imprisoned piece is **released** onto the captor's square (replacing the now-destroyed captor).
- If the captor is destroyed by Chronobreak rewind, the imprisoned piece is released on the rewound square.
- **Cannot imprison** a Frozen piece (Frost counter resolves first). **Cannot imprison** if the captured piece is itself a captor (no nested cages).
- **Turn continues** (you still must make a normal move).

### 4.9 Aether Block (13) — Tier 2
- Opponent **cannot spend Aether** on their next turn (no powers, no sacrifice). They still gain Aether normally (generation + fountains).
- Applied as a status on the opponent, cleared at the end of their next turn.
- Does NOT prevent already-active effects from resolving (Bomba still ticks, Frost still lifts, etc.).
- **Turn continues**.

### 4.10 Promote (15) — Tier 3
- Instantly promote any of your pawns to Queen/Rook/Bishop/Knight (player's choice).
- Requires you to own at least one pawn not on the last rank.
- **Turn ends**.

### 4.11 Chronobreak (20) — Tier 3
- Revert the board to the state **before the opponent's last move**.
- Their spent Aether from that move is **not refunded** (they lose the spend).
- Your Aether reduces by 20 (the cost).
- Your turn **continues** — you still must move or cast more.
- If their last move defused a Bomba, the Bomba returns to the board.
- Cannot be cast on the first move of the game (no prior opponent move).
- Cannot be chained: you cannot Chronobreak your own previous Chronobreak.

### 4.12 Vengeance (25) — Tier 3
- Instantly destroy any one enemy non-King piece, anywhere on the board.
- Bypasses Fortify (Fortify fully consumed, piece dies regardless of HP).
- **Cannot target King.**
- **Cannot deliver checkmate** (engine-rejects if post-Vengeance position is mate).
- **Turn ends.**

### 4.13 The Wall (30) — Tier 3
- Creates a White/Black pawn (matching caster) on every **empty** square adjacent to your target piece (up to 8 new pawns).
- Existing pieces on adjacent squares are unaffected.
- New pawns follow normal pawn rules from creation onward.
- Cannot be cast if all 8 adjacent squares are occupied (pointless — rejected with error).
- **Turn ends.**

---

## 5. Conflict Resolution & Edge Cases

### 5.1 Power Interaction Matrix

| Source → Target | Frost | Fortify | Spawn | Ghost | Imprison | Bomba | AetherBlock | Chrono | Vengeance | Wall |
|---|---|---|---|---|---|---|---|---|---|---|
| **Frost** | ok | shielded and frozen simultaneously OK | spectral pawn can't be frozen | frozen piece loses Ghost if still frozen | cannot imprison frozen piece | n/a | n/a | frost status rolled back by rewind | can kill frozen piece | wall's new pawns unaffected |
| **Fortify** | can stack with frost | n/a (not stackable) | spectral pawn can't be fortified | fortify stays through ghost | imprisoned piece loses fortify (absorbed into cage) | shield absorbs 1 HP of bomba | n/a | rolled back | fortify bypassed | n/a |
| **Imprison** | cannot target frozen piece | fortify on captor is retained; shield on captive is consumed | cannot imprison spectral pawn | cannot imprison a ghost piece (phase blocks grab) | no nested imprisons | captor dying to bomba releases captive | n/a | rolled back (captive returned) | captor dying to vengeance releases captive | n/a |

### 5.2 Explicit Rulings

1. **Can a Frozen piece be Imprisoned?**
   **NO.** Frost resolves first — a frozen piece is "locked" and cannot be acted on by Imprison. Engine returns `FROST_BLOCKS_IMPRISON`.

2. **Can a Fortified King be checkmated?**
   **YES, eventually.** Shield absorbs attacks, but the player must resolve check normally (Fortify doesn't bypass FIDE check rules). If the only way to resolve is a capture that can't happen because shield fizzles twice, it's still mate because no legal move gets out of check.

3. **Does Chronobreak refund the opponent's power cost?**
   **NO.** Opponent keeps the current Aether they had (minus what they already spent). They lose the board state, the spend, and the tempo.

4. **Can Vengeance + Blink combo mate?**
   Vengeance alone cannot mate (engine check). Blink alone cannot mate (engine check). If the turn sequence is: cast Vengeance (turn ends), they respond, cast Blink (turn ends)... mate is delivered by Blink, which is rejected. **Mate must come from a normal move.**

5. **If Spawn's Spectral Pawn gives check, does it count?**
   **YES.** Check is determined by squares attacked. A Spectral Pawn gives check like any pawn — opponent must resolve. If it's checkmate, game ends. The pawn vanishes the following turn but that's irrelevant — mate is mate.

6. **Can The Wall spawn pawns that immediately promote?**
   **NO.** Wall pawns cannot spawn on rank 1 or 8 (they'd need to promote immediately). Engine filters those squares out. All other empty adjacent squares get a pawn.

7. **Does The Wall break stalemate?**
   If opponent's turn starts and they have no legal moves (stalemate), game ends in **DRAW**. The Wall cannot create stalemate as a win condition (stalemate stays a draw — it's the only pure-chess draw we keep).

8. **Imprison-captor chain: A imprisons B. Opponent's C captures A. Does B release?**
   **YES.** B is released on A's square. C stays on its own square (normal capture doesn't move C onto A's square — wait, yes it does). Correction: C moves to A's square, A is removed. **Ruling:** B materializes on the **adjacent empty square closest to the original** (algorithmic: 8 surrounding squares in order N, NE, E, SE, S, SW, W, NW, first empty). If all 8 are occupied, B is destroyed (lost).

### 5.3 Zero-Draw Enforcement

Drawing conditions surviving from chess:
- **Stalemate** — still a draw (unavoidable).
- **50-move rule / 3-fold repetition** — NOT enforced in this variant (powers make position-repetition near-impossible; removing rule removes one draw vector).
- **Insufficient material** — auto-converted to **Aether-out loss** for the player whose resource depletes first, or **random-tiebreak loss** after 100 half-moves of no captures.

Power-caused symmetric destruction:
- **Dead-Man's Hand**: planter loses.
- **Self-destruction**: caster loses.

---

## 6. "Broken Combo" Audit

| Combo | Risk | Verdict | Fix |
|---|---|---|---|
| Blink + Chain Lightning same turn | Impossible — both end turn. | Safe | — |
| Spawn + Frost (Spawn pawn freezes enemy) | Spawn pawn can't be acted upon, Frost targets enemy — no self-combo. | Safe | — |
| Chronobreak + Chronobreak (loop) | Could create infinite rewind war. | **Mitigated** | Rule 4.11: cannot Chronobreak a Chronobreak. |
| Aether Block + Chronobreak | Block opponent, then rewind — opponent enters their turn with a Block active AND their last move gone. Double-taxed. | **Strong but fair** (costs 33 Aether total, ~turn 9) | No change. |
| Imprison Queen → Chronobreak captor captured | Captor dies to rewind restoration? Captive released. | Edge case documented | See rule 5.2.8. |
| Wall on enemy King area → force mate | Wall places pawns → they give check from pawn-diagonal squares. | **Wall-mate ruled legal** (Wall turn ends; next move by enemy must resolve). | Note: Wall is **Tier 3 at 30 Aether**, earliest turn is 10. By then King safety is established. |
| Bomba + Bomba stacking | Prevented by "empty square, no stacking" rule. | Safe | — |
| Fortify 2-HP + King → unkillable | Bypassed by Vengeance (25 Aether) or 2 captures. | **Balanced** | No change. |
| Spawn + Ghost on Spawn pawn | Spawn pawn cannot be Ghosted (spectral pieces excluded from powers). | Safe | — |

### Infinite-loop check
The only true loop vector is **Chronobreak ↔ Chronobreak**. Rule 4.11 blocks it.

### Instant-win check
No single-turn instant win exists: every "win-enabling" power has `Cannot checkmate` flag (Blink, Ghost, Chain Lightning, Vengeance). The only powers that *can* mate are **Promote** (normal promotion → queen mates) and **The Wall** (pawn placements delivering mate). Both are **Tier 3** (15 / 30 Aether), earliest affordable on turn 6 / turn 10 respectively — well past the opening.

---

## 7. Animation & VFX Brief

| Power | Visual | Sound | Color | Twitch-read |
|---|---|---|---|---|
| **Fortify** | Hexagonal shield materializes, 2 overlapping rings (HP indicator) | Metallic *chime-clang* | Cyan | Clear: 2 HP = 2 rings |
| **Blink** | Piece dissolves → light streak → reforms | Sci-fi *whoosh* (high to low) | Cyan | Streak connects source and dest |
| **Frost** | Ice crystals crawl up piece, glaze over | Sharp *crack* → ambient wind | Light blue | Frozen piece has ice texture |
| **Spawn** | Ghostly pawn materializes from fog | Choir *whoosh* + pawn-step | Pale violet | Spectral pawn has see-through body |
| **Ghost** | Piece fades to 40% opacity, trails rainbow chroma | Deep *woo* (ethereal) | Purple-haze | Visible transparency |
| **Bomba** | Red pulsing orb drops → ring pulse | *Tick-tick-tick* + rising pitch | Red-orange | Number (countdown) on orb |
| **Chain Lightning** | Arc from attacker → target → next target, bright blue | *ZAP-ZAP* (2 beats) | Electric blue | 2 arcs, 300ms apart |
| **Imprison** | Caging bars slam down, captive shrinks into captor | Cell-door *slam* | Dark purple | Small icon on captor |
| **Aether Block** | Opponent's Aether bar crackles with purple static, locked icon overlays | Static *buzz* + gate close | Deep purple | Lock icon on enemy bar |
| **Promote** | Pawn bursts into golden light, new piece emerges | Triumphal *fanfare* | Gold | Upward light beam |
| **Chronobreak** | Clock face spins counterclockwise, screen warps backward | Reversed *whoosh* + tick | Violet | Whole board briefly desaturates |
| **Vengeance** | Red lance stabs from sky, target disintegrates | Thunder *crack* + scream | Blood red | Top-down beam |
| **The Wall** | Stone wall erupts from ground around target, dust cloud | Earth *rumble* + 8 thuds | Stone gray | Pawns pop in sequentially |

---

## 8. Clock & Time Controls

| Format | Base | Increment | Use case |
|---|---|---|---|
| Bullet | 1 min | 0 s | Hyper-fast casual |
| Blitz | **3 min** | **2 s / move** | Default ranked |
| Rapid | 10 min | 5 s / move | Competitive |
| Classical | 15 min | 10 s / move | Studied play |

**Clock rules:**
- Clock starts ticking for White at game start.
- Each player's clock runs **only on their own turn**.
- **Animations pause the clock** (from power-confirm to board-interactive).
- Increment added **after** your turn ends.
- **Timeout = loss**. Unless opponent has insufficient material to mate (then it's a draw under FIDE), but per our Zero-Draw rule we override: **timeout always loses**.

---

## 9. Regression Test Suite — Imprison & Chronobreak

### IMPRISON-01: Basic cage and release
1. Setup: White Rook c1, Black Knight c2, both Kings far away.
2. White casts Imprison on c2 (12 Aether).
3. **Expected:** Rook on c1 is a captor; Knight is caged (invisible on board, stored on Rook).
4. Black moves its Bishop and captures Rook on c1.
5. **Expected:** Rook removed. Knight materializes on c1 (or nearest empty square if c1 occupied by capturing Bishop; here Bishop lands on c1, so Knight goes to first available neighbor in N,NE,E,SE,S,SW,W,NW order).
6. **Verify:** Knight's color is still Black.

### IMPRISON-02: Frozen piece cannot be imprisoned
1. Setup: White Rook a4 + 4 Aether → Frost on Black Pawn a5.
2. Black's turn cycle passes (frost lifts on Black's next turn end).
3. On White's next turn, with 12 Aether, White tries Imprison on a5 while still frozen.
4. **Expected:** Reject with error `FROST_BLOCKS_IMPRISON`. Rook stays on a4, Aether unchanged.

### CHRONO-01: Rewind restores captured piece
1. Setup: White pawn d4, Black pawn e5.
2. White plays dxe5 (captures black pawn).
3. Black casts Chronobreak (20 Aether).
4. **Expected:**
   - White pawn back on d4.
   - Black pawn restored on e5.
   - Black's Aether: `pre - 20`.
   - White's Aether: unchanged (no refund for White's spent on capture? — capture is a normal move with no Aether cost, so N/A here).
   - Turn remains with Black (Chronobreak turn continues).
5. Black can now play a different move (or another power).

### CHRONO-02: Cannot Chronobreak a Chronobreak
1. Setup: White plays a move. Black Chronobreaks. White tries to Chronobreak back.
2. **Expected:** Reject with error `CANNOT_REWIND_REWIND`.
3. Verify Aether not deducted.

### CHRONO-03: Rewind releases imprisoned piece
1. Setup: White Rook imprisons Black Knight (as in IMPRISON-01).
2. Black captures White Rook → Knight released (as expected).
3. White casts Chronobreak.
4. **Expected:**
   - Board reverts to before Black's capture.
   - Rook back on c1 with Knight re-imprisoned inside.
   - Knight NOT on the board (back in cage).

### CHRONO-04: Rewind restores defused Bomba
1. Setup: White plants Bomba on e4 (10 Aether). Turn ends.
2. Black moves a pawn to e4 — Bomba defused.
3. White Chronobreaks (20 Aether).
4. **Expected:**
   - Board reverts: Bomba back on e4, Black pawn back on its origin.
   - Bomba's turn counter is at the pre-defuse value.

---

## 10. Acceptance Criteria (ship gate)

- [ ] All 12 powers functional per §4.
- [ ] All regression tests in §9 pass.
- [ ] Balance sim: earliest Tier-3 power cast ≥ turn 6.
- [ ] No infinite loop possible (Chronobreak fix verified).
- [ ] Clock freezes during all animations (measurable: clock value unchanged across a full VFX).
- [ ] Fountain placement deterministic with a seed (for replay / spectator mode later).
- [ ] Online multiplayer: two browsers can play via room code with sub-500ms move latency on LAN.
- [ ] Zero-Draw audit: only stalemate produces a draw. All power symmetries resolve to a loser.

---

## 11. Glossary

- **Aether** — The in-game resource, stored per-player, spent on powers and sacrifices.
- **Tier** — Power cost band: Start (4–7), Mid (8–13), End (14–30).
- **Fountain** — Randomly-placed square granting +2 Aether per turn to its occupant.
- **Spectral Pawn** — Temporary pawn from Spawn; exists for 1 turn cycle; immune to powers.
- **Captor / Captive** — Imprison roles. Captor holds captive until killed.
- **Dead-Man's Hand** — Rule that makes a power caster LOSE if their power destroys both Kings.

---

**End of GDD v3.0.**
