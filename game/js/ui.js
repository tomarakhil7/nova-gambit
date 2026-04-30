// ============================================================
// NOVA GAMBIT - UI Layer (v3.0)
// Hotseat mode with optional clock.
// ============================================================

const PIECE_UNICODE = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};

const TIME_CONTROLS = {
  blitz: { base: 180, increment: 2, label: 'Blitz 3+2' },
  rapid: { base: 600, increment: 5, label: 'Rapid 10+5' },
  classical: { base: 900, increment: 10, label: 'Classical 15+10' },
  untimed: { base: 0, increment: 0, label: 'Untimed' }
};

const UI = {
  state: null,
  selected: null,
  legalDots: [],
  activePower: null,
  powerState: {},
  promotionPending: null,
  messageTimer: null,
  prevAether: { w: 0, b: 0 },
  clock: {
    mode: 'classical',
    white: 900,
    black: 900,
    activeColor: 'w',
    running: false,
    paused: false,
    intervalId: null,
    lastTickTime: 0
  }
};

// ---------- Init ----------
function initUI() {
  UI.state = initGame();
  UI.prevAether = { w: UI.state.mana[COLOR.WHITE], b: UI.state.mana[COLOR.BLACK] };
  initClock(UI.clock.mode);
  buildBoard();
  buildPowerPanel();
  render();
}

function buildBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.r = r;
      sq.dataset.c = c;
      if (CENTER_SQUARES.some(s => s.r === r && s.c === c)) sq.classList.add('center');
      const coords = document.createElement('span');
      coords.className = 'coords';
      coords.textContent = algebraic(r, c);
      sq.appendChild(coords);
      sq.addEventListener('click', () => onSquareClick(r, c));
      board.appendChild(sq);
    }
  }
  // Paint fountains (from state — per-game random)
  for (const f of UI.state.fountains) {
    const sq = squareEl(f.r, f.c);
    sq.classList.add('fountain');
    const label = document.createElement('div');
    label.className = 'fountain-label';
    label.textContent = '+2';
    sq.appendChild(label);
    const glow = document.createElement('div');
    glow.className = 'fountain-glow';
    sq.appendChild(glow);
  }
}

const POWER_ICONS = {
  [POWER.FROST]: '❄', [POWER.FORTIFY]: '🛡', [POWER.BLINK]: '✦', [POWER.SPAWN]: '♙',
  [POWER.GHOST]: '👁', [POWER.BOMBA]: '💣', [POWER.CHAIN_LIGHTNING]: '⚡',
  [POWER.IMPRISON]: '⛓', [POWER.AETHER_BLOCK]: '⊘',
  [POWER.PROMOTE]: '♛', [POWER.CHRONOBREAK]: '↺', [POWER.VENGEANCE]: '☠', [POWER.WALL]: '▧'
};

// Full power details for the Compendium (v3.2)
const POWER_DETAILS = {
  [POWER.FROST]: {
    targeting: 'Any enemy non-King piece',
    duration: '1 turn (target skips their next turn)',
    turnEnds: 'No — turn continues',
    canMate: 'N/A',
    restrictions: 'Cannot target King, Spectral, captors, or an already-frozen piece. A frozen Rook/King blocks castling.',
    useCase: 'Disable a defender before you invade. Freeze the castling Rook to kill opponent’s king safety.',
    counter: 'Wait one turn, or move the piece away before Frost lands. Spend Aether quickly to not be caught idle.'
  },
  [POWER.FORTIFY]: {
    targeting: 'One of your own pieces',
    duration: '1-hit shield · expires at end of your next turn if unused',
    turnEnds: 'No — turn continues',
    canMate: 'N/A',
    restrictions: 'Not usable on Spectral, captors, or already-shielded pieces. Cannot be stacked.',
    useCase: 'Protect a Queen deep in enemy territory for one turn. Bait an attacker into wasting a move.',
    counter: 'Hit the shield with a low-value piece (pawn) to break it; land the real threat next. Or wait one turn — it expires.'
  },
  [POWER.BLINK]: {
    targeting: 'Your piece (not King) → empty square within a 3×3 grid',
    duration: 'Instant',
    turnEnds: 'Yes',
    canMate: 'No — engine rejects mate-delivering Blink',
    restrictions: 'Range limited to the 8 adjacent squares. Cannot land into self-check. Voids castling rights for a moved Rook.',
    useCase: 'Escape a one-square pin, reposition to an attack diagonal, defuse an adjacent Bomba.',
    counter: 'Block all 8 adjacent squares of the target piece, or Frost it before it can Blink.'
  },
  [POWER.SPAWN]: {
    targeting: 'Empty square in your half (ranks 1–4 from your side)',
    duration: '1 turn cycle',
    turnEnds: 'No — turn continues',
    canMate: 'Yes (if the Spectral Pawn delivers mate on spawn)',
    restrictions: 'Spectral Pawn cannot move, be sacrificed for Aether (0 yield), perform en passant, or be targeted by other powers. Occupies a square (blocks castling path).',
    useCase: 'Block an attack lane, give check, or plug a defensive hole for a turn.',
    counter: 'Capture the Spectral Pawn, or simply wait — it vanishes on the caster’s next turn start.'
  },
  [POWER.GHOST]: {
    targeting: 'Your piece → destination (phased for this move)',
    duration: '1 move only',
    turnEnds: 'Yes',
    canMate: 'No — post-move mate check rejects the move',
    restrictions: 'Cannot land on any King. Absolute pins are still respected (cannot expose own King).',
    useCase: 'Bypass a wall of pawns or your own blockers to attack from an unexpected angle.',
    counter: 'Guard the destination square with a defender. Ghost cannot mate, so no lethal surprises.'
  },
  [POWER.BOMBA]: {
    targeting: 'Empty square',
    duration: '1 turn · detonates at start of your next turn',
    turnEnds: 'No — turn continues (you still must move)',
    canMate: 'N/A — Kings are immune to the blast',
    restrictions: 'Only on empty squares. No stacking. Blast only destroys unshielded ENEMY non-Kings. Your own pieces, Kings, and shielded pieces are safe (shield absorbs 1 then breaks).',
    useCase: 'Area-denial trap on a square an enemy piece wants to reach. Safely clear clustered unshielded enemies.',
    counter: 'Move any piece onto the bomb to defuse it. Fortify a threatened enemy piece to absorb the blast.'
  },
  [POWER.CHAIN_LIGHTNING]: {
    targeting: 'Your piece → enemy (1st target) → adjacent enemy (2nd target)',
    duration: 'Instant double capture; attacker lands on the 2nd target square',
    turnEnds: 'Yes',
    canMate: 'No — engine rejects',
    restrictions: 'First must be a legal capture move. Second must be an enemy non-King adjacent to the first target. Shields absorb 1 hit and end the chain. Cannot leave your King in check (leapfrog-out-of-pin rejected).',
    useCase: 'Two-for-one trade. Relocate a piece two squares via the 2nd target.',
    counter: 'Spread pieces out so no two enemies are adjacent. Shield the stronger of the two to end the chain early.'
  },
  [POWER.IMPRISON]: {
    targeting: 'Adjacent enemy non-King piece (captor = your piece)',
    duration: 'Until captor dies (captive is released on nearest empty neighbor square)',
    turnEnds: 'No — turn continues',
    canMate: 'Captor can still give/deliver check from its square (via normal-move mate)',
    restrictions: 'Captor cannot move, be Sacrificed, Fortified, Blinked, Ghosted, or targeted by Wall while holding. Cannot imprison Frozen, Spectral, or already-captor pieces (no nested cages).',
    useCase: 'Permanently sideline an enemy Queen using a pawn. High-value trade if your captor is cheap.',
    counter: 'Kill the captor — the captive is released on an adjacent empty square. Promoted form is preserved.'
  },
  [POWER.AETHER_BLOCK]: {
    targeting: 'Opponent (no board target)',
    duration: 'Opponent’s next turn',
    turnEnds: 'No — turn continues',
    canMate: 'N/A',
    restrictions: 'Opponent still GAINS Aether (at turn end) but cannot SPEND it. Does NOT cancel already-active effects like ticking bombs or frozen pieces.',
    useCase: 'Block a power combo right before it lands. Deny Vengeance at 20+ Aether.',
    counter: 'Save Aether for the turn after — spending resumes. Stack extra Aether so one blocked turn doesn’t hurt.'
  },
  [POWER.PROMOTE]: {
    targeting: 'Any of your pawns (not Spectral), any rank',
    duration: 'Instant',
    turnEnds: 'Yes',
    canMate: 'Yes (promotion-check to mate allowed)',
    restrictions: 'Not usable on Spectral pawns. Must select a concrete type: Q / R / B / N.',
    useCase: 'Skip the promotion race — make a Queen from a pawn on the 5th rank.',
    counter: 'Aether Block the turn before. Frost the pawn to freeze it (does not prevent Promote since Promote doesn’t move; but watch Imprison).'
  },
  [POWER.CHRONOBREAK]: {
    targeting: 'No target (reverts board to pre-opponent-move state)',
    duration: 'Instant',
    turnEnds: 'No — turn continues',
    canMate: 'N/A',
    restrictions: 'Cannot be cast on turn 1 (no prior opponent move). Cannot Chronobreak a Chronobreak. Opponent’s spent Aether is NOT refunded.',
    useCase: 'Undo a catastrophic blunder. Restore an imprisoned captive. Bring back a defused Bomba.',
    counter: 'Force the opponent to use it defensively before your real ultimate lands.'
  },
  [POWER.VENGEANCE]: {
    targeting: 'Any enemy non-King piece on the board',
    duration: 'Instant kill',
    turnEnds: 'Yes',
    canMate: 'No — engine rejects',
    restrictions: 'Bypasses the 1st shield (shield absorbs, piece still dies). Cannot target King. Cannot leave your King in check.',
    useCase: 'Remove a defender far from your pieces, without moving. Skip material trades entirely.',
    counter: 'Hard to counter directly — economy-starve them with Aether Block. Keep shielded defenders to burn the 1 shield.'
  },
  [POWER.WALL]: {
    targeting: 'Your piece (the anchor)',
    duration: 'Permanent pawns',
    turnEnds: 'Yes',
    canMate: 'Yes — can force mate patterns. If Wall creates a STALEMATE, the player with more Aether wins (no draws).',
    restrictions: 'New pawns skip last-rank squares (no auto-promotion). At least 1 empty adjacent square required. Cannot be used on imprisoned captor.',
    useCase: 'Build an instant fortress around your King. Box in the enemy King for mate with Wall-pawn diagonals.',
    counter: 'Capture the anchor piece; surrounding pawns stay. Break through the chain with a Knight or Ghost move.'
  }
};

function buildPowerPanel() {
  const deck = document.getElementById('power-cards');
  deck.innerHTML = '';
  // All 13 powers in a single horizontal deck (no tier labels per UX request)
  const allPowers = [
    POWER.FROST, POWER.FORTIFY, POWER.BLINK, POWER.SPAWN,
    POWER.GHOST, POWER.BOMBA, POWER.CHAIN_LIGHTNING, POWER.IMPRISON, POWER.AETHER_BLOCK,
    POWER.PROMOTE, POWER.CHRONOBREAK, POWER.VENGEANCE, POWER.WALL
  ];
  for (const p of allPowers) {
    const tier = POWER_TIER[p];
    const card = document.createElement('button');
    card.className = `power-card tier-${tier}`;
    card.dataset.power = p;
    card.innerHTML = `
      <div class="card-frame">
        <div class="card-art card-art-${p.toLowerCase()}"></div>
        <div class="card-cost">${POWER_COSTS[p]}</div>
        <div class="card-icon">${POWER_ICONS[p]}</div>
        <div class="card-name">${POWER_DISPLAY_NAMES[p]}</div>
      </div>
    `;
    card.title = `${POWER_DISPLAY_NAMES[p]} (${POWER_COSTS[p]})\n${POWER_DESCRIPTIONS[p]}`;
    card.addEventListener('mouseenter', (e) => showPowerTooltip(e, p));
    card.addEventListener('mouseleave', hidePowerTooltip);
    card.addEventListener('mousemove', (e) => {
      // Keep tooltip visible and aligned; re-show if it was removed (e.g. on re-render)
      if (!document.getElementById('power-tooltip')) showPowerTooltip(e, p);
    });
    card.addEventListener('click', (e) => {
      togglePower(p);
      // Re-show tooltip after state change (render() wipes it indirectly)
      requestAnimationFrame(() => showPowerTooltip(e, p));
    });
    deck.appendChild(card);
  }

  document.getElementById('sacrifice-btn').addEventListener('click', () => toggleSacrificeMode());
  document.getElementById('new-game').addEventListener('click', () => {
    const mode = document.getElementById('time-mode').value;
    UI.state = initGame();
    UI.selected = null; UI.activePower = null; UI.powerState = {};
    UI.prevAether = { w: UI.state.mana[COLOR.WHITE], b: UI.state.mana[COLOR.BLACK] };
    buildBoard();
    initClock(mode);
    startClock();
    setStatus('New game — White to move.', 'ok');
    render();
  });

  document.getElementById('time-mode').addEventListener('change', (e) => {
    UI.clock.mode = e.target.value;
  });

  document.getElementById('open-codex').addEventListener('click', () => openCodex());
  document.getElementById('open-compendium').addEventListener('click', () => openCompendium());
  document.getElementById('open-lobby').addEventListener('click', () => openLobby());
}

// ---------- Multiplayer Lobby ----------
function openLobby() {
  if (document.getElementById('lobby-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'lobby-backdrop';
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal lobby-modal">
      <h2>Play Online</h2>
      <p>Create a new room and share the code, or join an existing one.</p>
      <div class="lobby-row">
        <label>Your name</label>
        <input id="lobby-name" type="text" maxlength="20" value="${(localStorage.getItem('ng_name') || 'Player').replace(/"/g,'')}">
      </div>
      <div class="lobby-row">
        <label>Time control</label>
        <select id="lobby-time">
          <option value="blitz">Blitz 3+2</option>
          <option value="rapid">Rapid 10+5</option>
          <option value="classical" selected>Classical 15+10</option>
          <option value="untimed">Untimed</option>
        </select>
      </div>
      <div class="lobby-actions">
        <button class="primary" id="lobby-create">Create Room</button>
      </div>
      <div class="lobby-divider"><span>or</span></div>
      <div class="lobby-row">
        <label>Room code</label>
        <input id="lobby-code" type="text" maxlength="5" placeholder="ABCDE" style="text-transform:uppercase; letter-spacing:4px; font-family:'JetBrains Mono',monospace;">
      </div>
      <div class="lobby-actions">
        <button class="primary" id="lobby-join">Join Room</button>
      </div>
      <div class="lobby-status" id="lobby-status"></div>
      <div class="actions">
        <button onclick="document.getElementById('lobby-backdrop').remove()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const statusEl = document.getElementById('lobby-status');
  const setLobbyStatus = (msg, kind = 'ok') => {
    statusEl.textContent = msg;
    statusEl.className = 'lobby-status ' + kind;
  };

  NET.onError = (e) => setLobbyStatus(e.message || 'Connection error', 'err');
  NET.onRoomUpdate = (m) => {
    localStorage.setItem('ng_name', document.getElementById('lobby-name').value || 'Player');
    if (m.status === 'WAITING') {
      setLobbyStatus(`Room created: ${m.code} — share this code!`, 'ok');
      showWaitingForOpponent(m.code);
    } else if (m.status === 'PLAYING') {
      document.getElementById('lobby-backdrop')?.remove();
      document.getElementById('waiting-backdrop')?.remove();
      activateOnlineMode(m);
    }
  };

  document.getElementById('lobby-create').addEventListener('click', async () => {
    setLobbyStatus('Connecting…');
    try {
      await netConnect();
      const name = document.getElementById('lobby-name').value.trim() || 'Player';
      const timeMode = document.getElementById('lobby-time').value;
      netCreateRoom(name, timeMode);
    } catch (e) { setLobbyStatus('Cannot reach server', 'err'); }
  });

  document.getElementById('lobby-join').addEventListener('click', async () => {
    const code = document.getElementById('lobby-code').value.trim();
    if (code.length !== 5) { setLobbyStatus('Room code must be 5 characters', 'err'); return; }
    setLobbyStatus('Connecting…');
    try {
      await netConnect();
      const name = document.getElementById('lobby-name').value.trim() || 'Player';
      netJoinRoom(code, name);
    } catch (e) { setLobbyStatus('Cannot reach server', 'err'); }
  });
}

function showWaitingForOpponent(code) {
  document.getElementById('lobby-backdrop')?.remove();
  const wb = document.createElement('div');
  wb.id = 'waiting-backdrop';
  wb.className = 'modal-backdrop';
  wb.innerHTML = `
    <div class="modal">
      <h2>Waiting for opponent…</h2>
      <p>Share this code with someone:</p>
      <div class="room-code-display">${code}</div>
      <p style="margin-top:12px; font-size:11px; color:var(--text-dim);">Anyone with this code and your server URL can join as Black.</p>
      <div class="actions">
        <button onclick="(()=>{netLeave();document.getElementById('waiting-backdrop').remove();})()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wb);
}

function activateOnlineMode(roomState) {
  NET.mode = 'online';
  // Replace local state with server state
  applyServerState(roomState);
  // Adjust clock & UI
  const myColorName = NET.myColor === 'w' ? 'White' : NET.myColor === 'b' ? 'Black' : 'Spectator';
  setStatus(`Connected as ${myColorName}. Room: ${NET.roomCode}`, 'ok');
  if (roomState.clock) {
    UI.clock.white = roomState.clock.white;
    UI.clock.black = roomState.clock.black;
    UI.clock.activeColor = roomState.clock.activeColor;
    UI.clock.mode = roomState.timeMode || 'classical';
    UI.clock.running = roomState.timeMode !== 'untimed';
    UI.clock.lastTickTime = Date.now();
    if (UI.clock.intervalId) clearInterval(UI.clock.intervalId);
    if (UI.clock.running) startClock();
  }
  render();
}

function applyServerState(msg) {
  const remote = msg.game || msg.state;
  if (!remote) return;
  // Hydrate into UI.state, preserving/merging fields the server strips
  UI.state = {
    ...UI.state,
    ...remote,
    history: [], // server strips history; Chronobreak happens server-side
    timeBombs: remote.bombs || remote.timeBombs || []
  };
  // Re-derive fountain visual overlay since state.fountains can change (if new game)
  buildBoard();
  // If server sent clock, sync
  if (msg.clock) {
    UI.clock.white = msg.clock.white;
    UI.clock.black = msg.clock.black;
    UI.clock.activeColor = msg.clock.activeColor;
    UI.clock.lastTickTime = Date.now();
  }
  render();
}

NET.onState = (m) => { applyServerState(m); };

// ---------- Power Compendium modal ----------
function openCompendium() {
  if (document.getElementById('compendium-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'compendium-backdrop';
  backdrop.className = 'modal-backdrop compendium-backdrop';
  const allPowers = [
    POWER.FROST, POWER.FORTIFY, POWER.BLINK, POWER.SPAWN,
    POWER.GHOST, POWER.BOMBA, POWER.CHAIN_LIGHTNING, POWER.IMPRISON, POWER.AETHER_BLOCK,
    POWER.PROMOTE, POWER.CHRONOBREAK, POWER.VENGEANCE, POWER.WALL
  ];

  // Build comparison table
  let tableRows = '';
  for (const p of allPowers) {
    const tier = POWER_TIER[p];
    const d = POWER_DETAILS[p];
    tableRows += `
      <tr class="tier-${tier}" data-power="${p}">
        <td><span class="comp-tier-dot tier-${tier}"></span> T${tier}</td>
        <td class="comp-cost">${POWER_COSTS[p]}</td>
        <td><span class="comp-icon">${POWER_ICONS[p]}</span> <b>${POWER_DISPLAY_NAMES[p]}</b></td>
        <td>${d.targeting}</td>
        <td>${d.turnEnds}</td>
        <td>${d.canMate}</td>
      </tr>
    `;
  }

  // Build detailed entries
  let entries = '';
  for (const p of allPowers) {
    const tier = POWER_TIER[p];
    const d = POWER_DETAILS[p];
    entries += `
      <article class="comp-entry tier-${tier}" id="comp-${p}">
        <header class="comp-entry-head">
          <div class="comp-entry-icon">${POWER_ICONS[p]}</div>
          <div class="comp-entry-title">
            <h3>${POWER_DISPLAY_NAMES[p]}</h3>
            <div class="comp-entry-meta">
              <span class="comp-tier-badge tier-${tier}">Tier ${tier}</span>
              <span class="comp-cost-badge">${POWER_COSTS[p]} Aether</span>
            </div>
          </div>
        </header>
        <div class="comp-entry-desc">${POWER_DESCRIPTIONS[p]}</div>
        <div class="comp-entry-grid">
          <div class="comp-field"><span class="comp-label">Targeting</span><span class="comp-value">${d.targeting}</span></div>
          <div class="comp-field"><span class="comp-label">Duration</span><span class="comp-value">${d.duration}</span></div>
          <div class="comp-field"><span class="comp-label">Turn ends?</span><span class="comp-value">${d.turnEnds}</span></div>
          <div class="comp-field"><span class="comp-label">Can checkmate?</span><span class="comp-value">${d.canMate}</span></div>
        </div>
        <div class="comp-notes">
          <div class="comp-note"><span class="comp-note-label">⚠ Restrictions</span><span>${d.restrictions}</span></div>
          <div class="comp-note"><span class="comp-note-label">✓ Use case</span><span>${d.useCase}</span></div>
          <div class="comp-note"><span class="comp-note-label">✗ Counter</span><span>${d.counter}</span></div>
        </div>
      </article>
    `;
  }

  backdrop.innerHTML = `
    <div class="compendium-modal">
      <div class="compendium-header">
        <h2>Power Compendium</h2>
        <div class="codex-sub">Detailed reference · targeting rules · counterplay</div>
        <button class="codex-close" aria-label="Close">×</button>
      </div>
      <div class="compendium-body">
        <section class="comp-table-wrap">
          <div class="comp-section-title">Quick Reference</div>
          <table class="comp-table">
            <thead>
              <tr>
                <th>Tier</th><th>Cost</th><th>Power</th><th>Target</th><th>Ends Turn</th><th>Can Mate</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </section>
        <section class="comp-entries">
          <div class="comp-section-title">Full Details</div>
          <div class="comp-entries-grid">${entries}</div>
        </section>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('.codex-close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);

  // Clicking a table row jumps to the detailed entry
  backdrop.querySelectorAll('.comp-table tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      const p = row.dataset.power;
      const entry = document.getElementById('comp-' + p);
      if (entry) {
        entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
        entry.classList.add('comp-highlight');
        setTimeout(() => entry.classList.remove('comp-highlight'), 1600);
      }
    });
  });
}

// ---------- Power Codex modal ----------
function openCodex() {
  if (document.getElementById('codex-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'codex-backdrop';
  backdrop.className = 'modal-backdrop codex-backdrop';
  const allPowers = [
    POWER.FROST, POWER.FORTIFY, POWER.BLINK, POWER.SPAWN,
    POWER.GHOST, POWER.BOMBA, POWER.CHAIN_LIGHTNING, POWER.IMPRISON, POWER.AETHER_BLOCK,
    POWER.PROMOTE, POWER.CHRONOBREAK, POWER.VENGEANCE, POWER.WALL
  ];

  let gridHtml = '';
  for (const p of allPowers) {
    const tier = POWER_TIER[p];
    const tierLabel = tier === 1 ? 'START' : tier === 2 ? 'MID' : 'END';
    gridHtml += `
      <div class="codex-card tier-${tier}" data-power="${p}">
        <div class="codex-card-inner">
          <div class="card-art card-art-${p.toLowerCase()}"></div>
          <div class="codex-top">
            <span class="codex-tier">${tierLabel}</span>
            <span class="codex-cost">${POWER_COSTS[p]} Aether</span>
          </div>
          <div class="codex-icon">${POWER_ICONS[p]}</div>
          <div class="codex-name">${POWER_DISPLAY_NAMES[p]}</div>
          <div class="codex-desc">${POWER_DESCRIPTIONS[p]}</div>
        </div>
      </div>
    `;
  }

  backdrop.innerHTML = `
    <div class="codex-modal">
      <div class="codex-header">
        <h2>Powers Codex</h2>
        <div class="codex-sub">13 powers · 3 tiers · click a card to cast (if affordable)</div>
        <button class="codex-close" aria-label="Close">×</button>
      </div>
      <div class="codex-grid">${gridHtml}</div>
      <div class="codex-footer">
        <span class="tier-dot tier-1"></span> <b>Start</b> · Aether 4-7 &nbsp;&nbsp;
        <span class="tier-dot tier-2"></span> <b>Mid</b> · Aether 8-13 &nbsp;&nbsp;
        <span class="tier-dot tier-3"></span> <b>End</b> · Aether 15-30
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('.codex-close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);

  // Optional: click a codex card to cast (if affordable)
  backdrop.querySelectorAll('.codex-card').forEach(card => {
    card.addEventListener('click', () => {
      const p = card.dataset.power;
      if (!canAfford(UI.state, UI.state.turn, p)) {
        card.classList.add('codex-shake');
        setTimeout(() => card.classList.remove('codex-shake'), 500);
        return;
      }
      close();
      togglePower(p);
    });
  });
}

// ---------- Clock ----------
function initClock(mode) {
  UI.clock.mode = mode;
  const tc = TIME_CONTROLS[mode];
  UI.clock.white = tc.base;
  UI.clock.black = tc.base;
  UI.clock.activeColor = 'w';
  UI.clock.running = (mode !== 'untimed');
  UI.clock.paused = false;
  UI.clock.lastTickTime = Date.now();
  if (UI.clock.intervalId) { clearInterval(UI.clock.intervalId); UI.clock.intervalId = null; }
  if (UI.clock.running) startClock();
  renderClock();
}

function startClock() {
  if (UI.clock.intervalId) return;
  UI.clock.lastTickTime = Date.now();
  UI.clock.intervalId = setInterval(tickClock, 200);
}

function tickClock() {
  if (!UI.clock.running || UI.clock.paused || UI.state.winner) return;
  const now = Date.now();
  const elapsed = (now - UI.clock.lastTickTime) / 1000;
  UI.clock.lastTickTime = now;
  const activeKey = UI.clock.activeColor === 'w' ? 'white' : 'black';
  UI.clock[activeKey] -= elapsed;
  if (UI.clock[activeKey] <= 0) {
    UI.clock[activeKey] = 0;
    UI.state.winner = UI.clock.activeColor === 'w' ? COLOR.BLACK : COLOR.WHITE;
    UI.state.winReason = 'TIMEOUT';
    UI.state.log.push(`${UI.clock.activeColor === 'w' ? 'White' : 'Black'} ran out of time!`);
    clearInterval(UI.clock.intervalId);
    render();
    return;
  }
  renderClock();
}

function pauseClockForAnimation(ms = 1500) {
  UI.clock.paused = true;
  setTimeout(() => { UI.clock.paused = false; UI.clock.lastTickTime = Date.now(); }, ms);
}

function switchClockTo(color) {
  if (!UI.clock.running) return;
  // Add increment to the player who just ended their turn
  const finishedKey = UI.clock.activeColor === 'w' ? 'white' : 'black';
  const tc = TIME_CONTROLS[UI.clock.mode];
  UI.clock[finishedKey] += tc.increment;
  UI.clock.activeColor = color === COLOR.WHITE ? 'w' : 'b';
  UI.clock.lastTickTime = Date.now();
  renderClock();
}

function formatTime(s) {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 10);
  if (s < 10) return `${m}:${sec.toString().padStart(2,'0')}.${ms}`;
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

function renderClock() {
  const wc = document.getElementById('clock-white');
  const bc = document.getElementById('clock-black');
  if (wc) wc.textContent = UI.clock.mode === 'untimed' ? '∞' : formatTime(UI.clock.white);
  if (bc) bc.textContent = UI.clock.mode === 'untimed' ? '∞' : formatTime(UI.clock.black);
  document.getElementById('player-white')?.classList.toggle('clock-active', UI.clock.activeColor === 'w');
  document.getElementById('player-black')?.classList.toggle('clock-active', UI.clock.activeColor === 'b');
}

// ---------- Rendering ----------
function render() {
  const board = document.getElementById('board');
  board.querySelectorAll('.piece, .piece-status, .bomb-marker, .hint-dot, .hint-ring, .hint-power, .captor-badge, .frost-overlay').forEach(e => e.remove());
  board.querySelectorAll('.square').forEach(sq => {
    sq.classList.remove('selected','last-move','danger-zone','danger-zone-imminent','danger-zone-soft');
  });

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = UI.state.board[r][c];
      if (!piece) continue;
      const sq = squareEl(r, c);
      const el = document.createElement('div');
      el.className = 'piece ' + (piece.color === COLOR.WHITE ? 'white' : 'black');
      if (piece.isSpectral) el.classList.add('spectral');
      if (piece.isPhased) el.classList.add('phased');
      if (piece.frozenUntil && piece.frozenUntil > UI.state.turnNumber) el.classList.add('frozen');
      el.textContent = PIECE_UNICODE[piece.color + piece.type];
      el.addEventListener('mouseenter', (ev) => showPieceTooltip(ev, piece, r, c));
      el.addEventListener('mouseleave', hidePieceTooltip);
      sq.appendChild(el);

      if (piece.shieldHP > 0) {
        const s = document.createElement('div');
        s.className = 'piece-status shield';
        sq.appendChild(s);
      }
      if (piece.imprisoned) {
        const b = document.createElement('div');
        b.className = 'captor-badge';
        b.textContent = '⛓';
        b.title = `Holding: ${piece.imprisoned.type} (${piece.imprisoned.color})`;
        sq.appendChild(b);
      }
      if (piece.frozenUntil && piece.frozenUntil > UI.state.turnNumber) {
        const f = document.createElement('div');
        f.className = 'frost-overlay';
        sq.appendChild(f);
      }
    }
  }

  // Bombs
  for (const bomb of UI.state.bombs || []) {
    const sq = squareEl(bomb.r, bomb.c);
    const m = document.createElement('div');
    m.className = 'bomb-marker';
    if (bomb.owner !== UI.state.turn) m.classList.add('enemy');
    m.textContent = bomb.turnsLeft;
    m.title = `Bomba (${bomb.owner === UI.state.turn ? 'yours' : 'enemy'}) — ${bomb.turnsLeft} turn(s). Move onto to defuse.`;
    sq.appendChild(m);
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,0],[0,1],[1,-1],[1,0],[1,1]]) {
      const nr = bomb.r + dr, nc = bomb.c + dc;
      if (inBounds(nr, nc)) {
        const s = squareEl(nr, nc);
        if (bomb.turnsLeft <= 1) s.classList.add('danger-zone-imminent');
        else if (bomb.turnsLeft === 2) s.classList.add('danger-zone');
        else s.classList.add('danger-zone-soft');
      }
    }
  }

  if (UI.selected) {
    squareEl(UI.selected.r, UI.selected.c).classList.add('selected');
    for (const m of UI.legalDots) {
      const sq = squareEl(m.r, m.c);
      const isCap = !!m.capture;
      const dot = document.createElement('div');
      dot.className = isCap ? 'hint-ring' : 'hint-dot';
      sq.appendChild(dot);
    }
  }

  if (UI.activePower) {
    const targets = computePowerTargets();
    for (const t of targets) {
      const sq = squareEl(t.r, t.c);
      const hint = document.createElement('div');
      hint.className = 'hint-power';
      sq.appendChild(hint);
    }
  }

  if (UI.state.lastMoveInfo && UI.state.lastMoveInfo.from && UI.state.lastMoveInfo.to) {
    squareEl(UI.state.lastMoveInfo.from.r, UI.state.lastMoveInfo.from.c).classList.add('last-move');
    squareEl(UI.state.lastMoveInfo.to.r, UI.state.lastMoveInfo.to.c).classList.add('last-move');
  }

  renderPlayers();
  renderPowerButtons();
  renderLog();
  renderTurnIndicator();
  renderClock();
  renderActiveEffects();

  if (UI.state.winner) showGameOverModal();
}

function squareEl(r, c) {
  return document.querySelector(`.square[data-r="${r}"][data-c="${c}"]`);
}

function renderPlayers() {
  document.getElementById('player-white').classList.toggle('active', UI.state.turn === COLOR.WHITE);
  document.getElementById('player-black').classList.toggle('active', UI.state.turn === COLOR.BLACK);
  setAetherBar('white-aether', UI.state.mana[COLOR.WHITE], UI.prevAether.w);
  setAetherBar('black-aether', UI.state.mana[COLOR.BLACK], UI.prevAether.b);
  UI.prevAether.w = UI.state.mana[COLOR.WHITE];
  UI.prevAether.b = UI.state.mana[COLOR.BLACK];
  document.getElementById('player-white').classList.toggle('blocked', UI.state.aetherBlocked[COLOR.WHITE]);
  document.getElementById('player-black').classList.toggle('blocked', UI.state.aetherBlocked[COLOR.BLACK]);
}

function setAetherBar(id, val, prevVal) {
  const bar = document.getElementById(id);
  const fill = bar.querySelector('.fill');
  const label = bar.querySelector('.label');
  fill.style.width = `${(val / AETHER_CAP) * 100}%`;
  label.textContent = `${val} / ${AETHER_CAP}`;
  if (val > prevVal) {
    bar.classList.add('aether-flash');
    setTimeout(() => bar.classList.remove('aether-flash'), 900);
  } else if (val < prevVal && prevVal - val >= 3) {
    bar.classList.add('aether-burn-flash');
    setTimeout(() => bar.classList.remove('aether-burn-flash'), 1100);
  }
}

function renderPowerButtons() {
  const color = UI.state.turn;
  const blocked = UI.state.aetherBlocked[color];
  document.querySelectorAll('#power-cards .power-card').forEach(btn => {
    const p = btn.dataset.power;
    const afford = canAfford(UI.state, color, p);
    const locked = !afford || !!UI.state.winner;
    btn.classList.toggle('disabled', locked);
    // Do NOT use native `disabled` — it blocks mouseenter/mouseleave (kills tooltips).
    btn.disabled = false;
    btn.classList.toggle('active', UI.activePower === p);
  });
  const sacBtn = document.getElementById('sacrifice-btn');
  const alreadySac = UI.state.sacrificedThisTurn && UI.state.sacrificedThisTurn[color];
  sacBtn.classList.toggle('active', UI.activePower === 'SACRIFICE');
  sacBtn.disabled = !!UI.state.winner || alreadySac || blocked;
  sacBtn.classList.toggle('disabled', !!UI.state.winner || alreadySac || blocked);
  if (blocked) sacBtn.title = 'Aether Block active';
  else if (alreadySac) sacBtn.title = 'Already sacrificed this turn';
  else sacBtn.title = 'Sacrifice a non-King piece for Aether (1/turn)';
}

function renderLog() {
  const log = document.getElementById('log');
  log.innerHTML = '';
  const entries = UI.state.log.slice(-50);
  for (const line of entries) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    if (/checkmate|dead-man|self-destruct|king destroyed|timeout/i.test(line)) div.classList.add('danger');
    else if (/aether|fountain|burn|rewind|chronobreak|sacrific|block/i.test(line)) div.classList.add('aether-event');
    else if (/nova|imprison|chain|blink|fortif|phase|bomba|frost|spawn|ghost|vengeance|wall|promote/i.test(line)) div.classList.add('highlight');
    div.textContent = line;
    log.appendChild(div);
  }
  log.scrollTop = log.scrollHeight;
}

function renderTurnIndicator() {
  const turn = UI.state.turn === COLOR.WHITE ? 'White' : 'Black';
  let extra = '';
  if (UI.state.aetherBlocked[UI.state.turn]) extra = ' · AETHER BLOCKED';
  document.getElementById('turn-indicator').textContent = `Turn ${Math.ceil(UI.state.turnNumber / 2)} — ${turn} to move${extra}`;
}

// ---------- Interaction ----------
function onSquareClick(r, c) {
  if (UI.state.winner) return;
  if (UI.activePower) { handlePowerClick(r, c); return; }

  const piece = UI.state.board[r][c];
  if (UI.selected) {
    const move = UI.legalDots.find(m => m.r === r && m.c === c);
    if (move) { attemptMove(UI.selected.r, UI.selected.c, r, c); return; }
    if (piece && piece.color === UI.state.turn) {
      UI.selected = { r, c };
      UI.legalDots = legalMoves(UI.state.board, r, c, UI.state);
      render();
      return;
    }
    UI.selected = null; UI.legalDots = []; render(); return;
  }
  if (piece && piece.color === UI.state.turn) {
    UI.selected = { r, c };
    UI.legalDots = legalMoves(UI.state.board, r, c, UI.state);
    render();
  }
}

function attemptMove(fr, fc, tr, tc) {
  const piece = UI.state.board[fr][fc];
  if (piece.type === PIECE.PAWN && (tr === 0 || tr === 7)) {
    UI.promotionPending = { fr, fc, tr, tc };
    showPromotionDialog(piece.color);
    return;
  }
  if (NET.mode === 'online') {
    if (!isMyTurn()) { setStatus('Wait for your turn.', 'warn'); return; }
    netSendMove({ r: fr, c: fc }, { r: tr, c: tc });
    UI.selected = null; UI.legalDots = [];
    render();
    return;
  }
  pauseClockForAnimation(800);
  const res = makeMove(UI.state, fr, fc, tr, tc);
  handleMoveResult(res, fr, fc, tr, tc);
}

function isMyTurn() {
  return NET.mode !== 'online' || (NET.myColor === UI.state.turn);
}

// Intercept: if online, dispatch to server and short-circuit local mutation.
// Returns true if the caller should STOP (server will update us), false to continue local.
function netInterceptPower(power, args, sourceSquares = []) {
  if (NET.mode !== 'online') return false;
  if (!isMyTurn()) { setStatus('Wait for your turn.', 'warn'); UI.activePower = null; UI.powerState = {}; render(); return true; }
  netSendPower(power, args);
  UI.activePower = null; UI.powerState = {};
  render();
  return true;
}

function handleMoveResult(res, fr, fc, tr, tc) {
  UI.selected = null; UI.legalDots = [];
  if (res.error) { setStatus(res.error, 'err'); render(); return; }
  if (res.shieldBroke) { playVfx('fortify', tr, tc); setStatus('Shield blocked!', 'warn'); }
  else if (res.defused) { setStatus('Bomba defused!', 'ok'); floatingText('DEFUSED', tr, tc, 'aether'); }
  else { setStatus('Move made.', 'ok'); }
  if (UI.state.winner) { render(); return; }
  switchClockTo(UI.state.turn);
  render();
}

// ---------- Powers ----------
function togglePower(p) {
  if (UI.activePower === p) { UI.activePower = null; UI.powerState = {}; }
  else {
    if (UI.state.winner) return;
    if (!canAfford(UI.state, UI.state.turn, p)) {
      const cost = POWER_COSTS[p];
      const have = UI.state.mana[UI.state.turn];
      setStatus(`${POWER_DISPLAY_NAMES[p]} needs ${cost} Aether · you have ${have}`, 'err');
      return;
    }
    UI.activePower = p; UI.powerState = {};
    UI.selected = null; UI.legalDots = [];
    // Instant-cast powers (no target required)
    if (p === POWER.AETHER_BLOCK) {
      if (NET.mode === 'online') {
        if (!isMyTurn()) { setStatus('Wait for your turn.', 'warn'); UI.activePower = null; render(); return; }
        netSendPower('AETHER_BLOCK', {});
        UI.activePower = null; render(); return;
      }
      pauseClockForAnimation(1200);
      const r = castAetherBlock(UI.state);
      if (r.error) setStatus(r.error, 'err');
      else { setStatus('Aether Block cast!', 'ok'); playVfxCenter('aether-burn'); }
      UI.activePower = null;
      render(); return;
    }
    if (p === POWER.CHRONOBREAK) {
      if (NET.mode === 'online') {
        if (!isMyTurn()) { setStatus('Wait for your turn.', 'warn'); UI.activePower = null; render(); return; }
        netSendPower('CHRONOBREAK', {});
        UI.activePower = null; render(); return;
      }
      pauseClockForAnimation(1500);
      const r = castChronobreak(UI.state);
      if (r.error) setStatus(r.error, 'err');
      else { setStatus('Chronobreak!', 'ok'); playVfxCenter('rewind'); }
      UI.activePower = null;
      render(); return;
    }
  }
  render();
}

function toggleSacrificeMode() {
  if (UI.activePower === 'SACRIFICE') UI.activePower = null;
  else { UI.activePower = 'SACRIFICE'; UI.selected = null; UI.legalDots = []; }
  render();
}

function handlePowerClick(r, c) {
  const p = UI.activePower;

  if (p === 'SACRIFICE') {
    if (NET.mode === 'online') {
      if (!isMyTurn()) { setStatus('Wait for your turn.', 'warn'); return; }
      netSendSacrifice(r, c);
      UI.activePower = null; render(); return;
    }
    const res = sacrificePiece(UI.state, r, c);
    if (res.error) { setStatus(res.error, 'err'); return; }
    setStatus(`Sacrificed for +${res.gain} Aether.`, 'ok');
    floatingText(`+${res.gain}`, r, c, 'aether');
    UI.activePower = null; render(); return;
  }

  if (p === POWER.FROST) {
    if (netInterceptPower('FROST', { r, c })) return;
    const res = castFrost(UI.state, r, c);
    if (res.error) { setStatus(res.error, 'err'); return; }
    setStatus('Frost applied.', 'ok');
    playVfx('frost', r, c);
    UI.activePower = null; render(); return;
  }

  if (p === POWER.FORTIFY) {
    if (netInterceptPower('FORTIFY', { r, c })) return;
    const res = castFortify(UI.state, r, c);
    if (res.error) { setStatus(res.error, 'err'); return; }
    setStatus('Fortified.', 'ok');
    playVfx('fortify', r, c);
    UI.activePower = null; render(); return;
  }

  if (p === POWER.SPAWN) {
    if (netInterceptPower('SPAWN', { r, c })) return;
    const res = castSpawn(UI.state, r, c);
    if (res.error) { setStatus(res.error, 'err'); return; }
    setStatus('Spectral Pawn summoned.', 'ok');
    playVfx('spawn', r, c);
    UI.activePower = null; render(); return;
  }

  if (p === POWER.BOMBA) {
    if (netInterceptPower('BOMBA', { r, c })) return;
    const res = castBomba(UI.state, r, c);
    if (res.error) { setStatus(res.error, 'err'); return; }
    setStatus('Bomba planted.', 'ok');
    playVfx('bomb-plant', r, c);
    UI.activePower = null; render(); return;
  }

  if (p === POWER.VENGEANCE) {
    if (!confirm(`Destroy piece at ${algebraic(r,c)} with Vengeance? (Turn ends)`)) { UI.activePower = null; render(); return; }
    if (netInterceptPower('VENGEANCE', { r, c })) return;
    pauseClockForAnimation(1500);
    const res = castVengeance(UI.state, r, c);
    if (res.error) { setStatus(res.error, 'err'); UI.activePower = null; render(); return; }
    setStatus('Vengeance!', 'ok');
    playVfx('vengeance', r, c);
    if (!UI.state.winner) switchClockTo(UI.state.turn);
    UI.activePower = null; render(); return;
  }

  if (p === POWER.WALL) {
    if (netInterceptPower('WALL', { r, c })) return;
    pauseClockForAnimation(1800);
    const res = castWall(UI.state, r, c);
    if (res.error) { setStatus(res.error, 'err'); UI.activePower = null; render(); return; }
    setStatus(`The Wall: ${res.spawned} pawns.`, 'ok');
    playVfx('wall', r, c);
    if (!UI.state.winner) switchClockTo(UI.state.turn);
    UI.activePower = null; render(); return;
  }

  if (p === POWER.PROMOTE) {
    // Show promotion chooser for this pawn
    const piece = UI.state.board[r][c];
    if (!piece || piece.type !== PIECE.PAWN || piece.color !== UI.state.turn) {
      setStatus('Select your own pawn.', 'warn'); return;
    }
    showPromotePowerDialog(r, c);
    return;
  }

  if (p === POWER.BLINK) {
    if (!UI.powerState.src) {
      const piece = UI.state.board[r][c];
      if (!piece || piece.color !== UI.state.turn) { setStatus('Select your piece.', 'warn'); return; }
      UI.powerState.src = { r, c };
      setStatus('Select destination.', 'ok'); render(); return;
    }
    if (netInterceptPower('BLINK', { from: UI.powerState.src, to: { r, c } })) return;
    pauseClockForAnimation(1200);
    const res = castBlink(UI.state, UI.powerState.src.r, UI.powerState.src.c, r, c);
    if (res.error) { setStatus(res.error, 'err'); UI.powerState = {}; render(); return; }
    setStatus('Blinked.', 'ok');
    playVfx('blink', UI.powerState.src.r, UI.powerState.src.c);
    playVfx('blink', r, c);
    UI.activePower = null; UI.powerState = {};
    if (!UI.state.winner) switchClockTo(UI.state.turn);
    render(); return;
  }

  if (p === POWER.GHOST) {
    if (!UI.powerState.src) {
      const piece = UI.state.board[r][c];
      if (!piece || piece.color !== UI.state.turn) { setStatus('Select your piece.', 'warn'); return; }
      UI.powerState.src = { r, c };
      setStatus('Select ghost-move destination.', 'ok'); render(); return;
    }
    if (netInterceptPower('GHOST', { from: UI.powerState.src, to: { r, c } })) return;
    pauseClockForAnimation(1200);
    const res = castGhostMove(UI.state, UI.powerState.src.r, UI.powerState.src.c, r, c);
    if (res.error) { setStatus(res.error, 'err'); UI.powerState = {}; render(); return; }
    setStatus('Ghost!', 'ok');
    playVfx('ghost', UI.powerState.src.r, UI.powerState.src.c);
    playVfx('ghost', r, c);
    UI.activePower = null; UI.powerState = {};
    if (!UI.state.winner) switchClockTo(UI.state.turn);
    render(); return;
  }

  if (p === POWER.IMPRISON) {
    if (!UI.powerState.captor) {
      const piece = UI.state.board[r][c];
      if (!piece || piece.color !== UI.state.turn) { setStatus('Select your captor piece.', 'warn'); return; }
      UI.powerState.captor = { r, c };
      setStatus('Select adjacent enemy to imprison.', 'ok'); render(); return;
    }
    if (netInterceptPower('IMPRISON', { captor: UI.powerState.captor, captive: { r, c } })) return;
    const res = castImprison(UI.state, UI.powerState.captor.r, UI.powerState.captor.c, r, c);
    if (res.error) { setStatus(res.error, 'err'); UI.powerState = {}; return; }
    setStatus('Imprisoned.', 'ok');
    playVfx('imprison', r, c);
    UI.activePower = null; UI.powerState = {};
    render(); return;
  }

  if (p === POWER.CHAIN_LIGHTNING) {
    if (!UI.powerState.attacker) {
      const piece = UI.state.board[r][c];
      if (!piece || piece.color !== UI.state.turn) { setStatus('Select attacker.', 'warn'); return; }
      UI.powerState.attacker = { r, c };
      setStatus('Select first capture target.', 'ok'); render(); return;
    }
    if (!UI.powerState.first) {
      UI.powerState.first = { r, c };
      setStatus('Select second target (adjacent to first).', 'ok'); render(); return;
    }
    const a = UI.powerState.attacker, f = UI.powerState.first;
    if (netInterceptPower('CHAIN_LIGHTNING', { from: a, to: f, jump: { r, c } })) return;
    pauseClockForAnimation(1400);
    const res = castChainLightning(UI.state, a.r, a.c, f.r, f.c, r, c);
    if (res.error) { setStatus(res.error, 'err'); UI.powerState = {}; render(); return; }
    setStatus('Chain Lightning!', 'ok');
    playVfxChain(a.r, a.c, f.r, f.c);
    setTimeout(() => playVfxChain(f.r, f.c, r, c), 300);
    UI.activePower = null; UI.powerState = {};
    if (!UI.state.winner) switchClockTo(UI.state.turn);
    render(); return;
  }
}

function showPromotePowerDialog(r, c) {
  const color = UI.state.turn;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h2>Promote via Power</h2>
      <p>Pick the piece your pawn becomes.</p>
      <div class="promotion-choice">
        <button data-piece="Q">${PIECE_UNICODE[color+'Q']}</button>
        <button data-piece="R">${PIECE_UNICODE[color+'R']}</button>
        <button data-piece="B">${PIECE_UNICODE[color+'B']}</button>
        <button data-piece="N">${PIECE_UNICODE[color+'N']}</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      document.body.removeChild(backdrop);
      if (netInterceptPower('PROMOTE', { r, c, newType: b.dataset.piece })) return;
      pauseClockForAnimation(1200);
      const res = castPromote(UI.state, r, c, b.dataset.piece);
      if (res.error) { setStatus(res.error, 'err'); UI.activePower = null; render(); return; }
      setStatus('Promoted!', 'ok');
      playVfx('promote', r, c);
      UI.activePower = null;
      if (!UI.state.winner) switchClockTo(UI.state.turn);
      render();
    });
  });
}

function computePowerTargets() {
  const p = UI.activePower;
  const targets = [];
  const color = UI.state.turn;

  if (p === 'SACRIFICE') {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const piece = UI.state.board[r][c];
      if (piece && piece.color === color && piece.type !== PIECE.KING && !piece.isSpectral) targets.push({r,c});
    }
  } else if (p === POWER.FROST) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const piece = UI.state.board[r][c];
      if (piece && piece.color !== color && piece.type !== PIECE.KING && !piece.isSpectral) targets.push({r,c});
    }
  } else if (p === POWER.FORTIFY) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const piece = UI.state.board[r][c];
      if (piece && piece.color === color && piece.shieldHP === 0 && !piece.isSpectral && !piece.imprisoned) targets.push({r,c});
    }
  } else if (p === POWER.BLINK) {
    if (!UI.powerState.src) {
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
        const piece = UI.state.board[r][c];
        if (piece && piece.color === color && !piece.isSpectral && !piece.imprisoned) targets.push({r,c});
      }
    } else {
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (!UI.state.board[r][c]) targets.push({r,c});
    }
  } else if (p === POWER.SPAWN) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      if (UI.state.board[r][c]) continue;
      const rankFromPerspective = color === COLOR.WHITE ? (8 - r) : (r + 1);
      if (rankFromPerspective >= 1 && rankFromPerspective <= 4) targets.push({r,c});
    }
  } else if (p === POWER.GHOST) {
    if (!UI.powerState.src) {
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
        const piece = UI.state.board[r][c];
        if (piece && piece.color === color && !piece.isSpectral && !piece.imprisoned) targets.push({r,c});
      }
    } else {
      // Any square (reachable validated in cast)
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) targets.push({r,c});
    }
  } else if (p === POWER.BOMBA) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (!UI.state.board[r][c]) targets.push({r,c});
  } else if (p === POWER.IMPRISON) {
    if (!UI.powerState.captor) {
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
        const piece = UI.state.board[r][c];
        if (piece && piece.color === color && !piece.isSpectral && !piece.imprisoned) targets.push({r,c});
      }
    } else {
      const c0 = UI.powerState.captor;
      for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
        if (dr===0 && dc===0) continue;
        const nr=c0.r+dr, nc=c0.c+dc;
        if (inBounds(nr,nc)) {
          const t = UI.state.board[nr][nc];
          if (t && t.color !== color && t.type !== PIECE.KING && !t.isSpectral) targets.push({r:nr,c:nc});
        }
      }
    }
  } else if (p === POWER.CHAIN_LIGHTNING) {
    if (!UI.powerState.attacker) {
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
        const piece = UI.state.board[r][c];
        if (piece && piece.color === color && !piece.isSpectral && !piece.imprisoned) targets.push({r,c});
      }
    } else if (!UI.powerState.first) {
      const a = UI.powerState.attacker;
      const moves = legalMoves(UI.state.board, a.r, a.c, UI.state);
      for (const m of moves) if (m.capture) targets.push({r:m.r,c:m.c});
    } else {
      const f = UI.powerState.first;
      for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
        if (dr===0 && dc===0) continue;
        const nr=f.r+dr, nc=f.c+dc;
        if (inBounds(nr,nc)) {
          const t = UI.state.board[nr][nc];
          if (t && t.color !== color && t.type !== PIECE.KING) targets.push({r:nr,c:nc});
        }
      }
    }
  } else if (p === POWER.PROMOTE) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const piece = UI.state.board[r][c];
      if (piece && piece.color === color && piece.type === PIECE.PAWN && !piece.isSpectral) targets.push({r,c});
    }
  } else if (p === POWER.VENGEANCE) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const piece = UI.state.board[r][c];
      if (piece && piece.color !== color && piece.type !== PIECE.KING) targets.push({r,c});
    }
  } else if (p === POWER.WALL) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const piece = UI.state.board[r][c];
      if (piece && piece.color === color && !piece.isSpectral) targets.push({r,c});
    }
  }

  return targets;
}

// ---------- Promotion (normal move) ----------
function showPromotionDialog(color) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h2>Promote Pawn</h2>
      <p>Choose a piece for promotion.</p>
      <div class="promotion-choice">
        <button data-piece="Q">${PIECE_UNICODE[color+'Q']}</button>
        <button data-piece="R">${PIECE_UNICODE[color+'R']}</button>
        <button data-piece="B">${PIECE_UNICODE[color+'B']}</button>
        <button data-piece="N">${PIECE_UNICODE[color+'N']}</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      const type = b.dataset.piece;
      const p = UI.promotionPending;
      document.body.removeChild(backdrop);
      UI.promotionPending = null;
      if (NET.mode === 'online') {
        netSendMove({ r: p.fr, c: p.fc }, { r: p.tr, c: p.tc }, type);
        UI.selected = null; UI.legalDots = [];
        render();
        return;
      }
      pauseClockForAnimation(800);
      const res = makeMove(UI.state, p.fr, p.fc, p.tr, p.tc, type);
      handleMoveResult(res, p.fr, p.fc, p.tr, p.tc);
    });
  });
}

// ---------- Status ----------
function setStatus(msg, kind = 'ok') {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.className = 'status-msg ' + kind;
  if (UI.messageTimer) clearTimeout(UI.messageTimer);
  UI.messageTimer = setTimeout(() => { el.textContent = ''; el.className = 'status-msg'; }, 4500);
}

// ---------- Game Over ----------
function showGameOverModal() {
  if (document.querySelector('.game-over-modal')) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop game-over-modal';
  const w = UI.state.winner;
  const reason = UI.state.winReason;
  let title, msg;
  if (w === 'DRAW') { title = 'Draw by Stalemate'; msg = 'Neither player has legal moves.'; }
  else {
    title = (w === COLOR.WHITE ? 'White' : 'Black') + ' Wins!';
    const reasons = {
      CHECKMATE: 'Checkmate!',
      KING_DESTROYED: 'Enemy King destroyed.',
      DEAD_MANS_HAND: "Dead-Man's Hand — power caster loses.",
      SELF_DESTRUCTION: 'Self-destruction.',
      TIMEOUT: 'Opponent ran out of time.'
    };
    msg = reasons[reason] || 'Victory.';
  }
  backdrop.innerHTML = `
    <div class="modal">
      <h2>${title}</h2>
      <p>${msg}</p>
      <div class="actions">
        <button onclick="document.querySelector('.game-over-modal').remove()">Review</button>
        <button class="primary" onclick="document.getElementById('new-game').click(); document.querySelector('.game-over-modal').remove();">New Game</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
}

// ---------- VFX ----------
function squareCoords(r, c) {
  const sq = squareEl(r, c);
  if (!sq) return null;
  const rect = sq.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function playVfx(kind, r, c) {
  const p = squareCoords(r, c);
  if (!p) return;
  const vfx = document.createElement('div');
  vfx.className = 'vfx vfx-' + kind;
  vfx.style.left = p.x + 'px';
  vfx.style.top = p.y + 'px';
  document.getElementById('vfx-layer').appendChild(vfx);
  setTimeout(() => vfx.remove(), 2000);
}

function playVfxCenter(kind) {
  const board = document.getElementById('board');
  const rect = board.getBoundingClientRect();
  const vfx = document.createElement('div');
  vfx.className = 'vfx vfx-' + kind;
  vfx.style.left = (rect.left + rect.width / 2) + 'px';
  vfx.style.top = (rect.top + rect.height / 2) + 'px';
  document.getElementById('vfx-layer').appendChild(vfx);
  setTimeout(() => vfx.remove(), 2000);
}

function playVfxChain(r1, c1, r2, c2) {
  const s1 = squareCoords(r1, c1), s2 = squareCoords(r2, c2);
  if (!s1 || !s2) return;
  const dx = s2.x - s1.x, dy = s2.y - s1.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const vfx = document.createElement('div');
  vfx.className = 'vfx vfx-chain';
  vfx.style.left = s1.x + 'px';
  vfx.style.top = (s1.y - 2) + 'px';
  vfx.style.width = dist + 'px';
  vfx.style.setProperty('--rot', angle + 'deg');
  vfx.style.transform = `rotate(${angle}deg)`;
  document.getElementById('vfx-layer').appendChild(vfx);
  setTimeout(() => vfx.remove(), 900);
}

function floatingText(text, r, c, kind='aether') {
  const p = squareCoords(r, c);
  if (!p) return;
  const el = document.createElement('div');
  el.className = 'floating-text ' + kind;
  el.textContent = text;
  el.style.left = p.x + 'px';
  el.style.top = (p.y - 10) + 'px';
  document.getElementById('vfx-layer').appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// ---------- Power Tooltip ----------
function showPowerTooltip(ev, p) {
  hidePowerTooltip();
  const tip = document.createElement('div');
  tip.id = 'power-tooltip';
  const tier = POWER_TIER[p];
  const cost = POWER_COSTS[p];
  const have = UI.state ? UI.state.mana[UI.state.turn] : 0;
  const afford = have >= cost;
  tip.className = `power-tooltip tier-${tier}${afford ? '' : ' locked'}`;
  tip.innerHTML = `
    <div class="tt-head">
      <span class="tt-icon">${POWER_ICONS[p]}</span>
      <span class="tt-name">${POWER_DISPLAY_NAMES[p]}</span>
      <span class="tt-cost">${cost} Aether</span>
    </div>
    <div class="tt-desc">${POWER_DESCRIPTIONS[p]}</div>
    ${!afford ? `<div class="tt-lock">Need ${cost - have} more Aether</div>` : ''}
  `;
  document.body.appendChild(tip);
  // Position above the card (or beside if near top) so it doesn't get covered
  const cardEl = ev.target.closest('.power-card') || ev.target.closest('.power-chip');
  if (!cardEl) { tip.remove(); return; }
  const rect = cardEl.getBoundingClientRect();
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  // Prefer above; if no room, show below
  let left = rect.left + rect.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  let top = rect.top - th - 10;
  if (top < 8) top = rect.bottom + 10;
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}
function hidePowerTooltip() {
  const t = document.getElementById('power-tooltip');
  if (t) t.remove();
}

// ---------- Piece hover tooltip ----------
function pieceTypeName(t) {
  return { K:'King', Q:'Queen', R:'Rook', B:'Bishop', N:'Knight', P:'Pawn' }[t] || t;
}
function showPieceTooltip(ev, piece, r, c) {
  hidePieceTooltip();
  const mods = [];
  if (piece.shieldHP > 0) {
    const turns = piece.shieldExpiresOn ? ` (expires T${piece.shieldExpiresOn})` : '';
    mods.push(`<span class="mod shield">🛡 Shielded${turns}</span>`);
  }
  if (piece.frozenUntil && piece.frozenUntil > UI.state.turnNumber) {
    mods.push(`<span class="mod frost">❄ Frozen 1 turn</span>`);
  }
  if (piece.isPhased) {
    mods.push(`<span class="mod ghost">👁 Ghost</span>`);
  }
  if (piece.isSpectral) {
    mods.push(`<span class="mod spectral">♙ Spectral — vanishes T${piece.spectralExpireTurn}</span>`);
  }
  if (piece.imprisoned) {
    mods.push(`<span class="mod captor">⛓ Holding ${piece.imprisoned.type} (${piece.imprisoned.color==='w'?'W':'B'})</span>`);
  }
  const tip = document.createElement('div');
  tip.id = 'piece-tooltip';
  tip.className = 'piece-tooltip';
  tip.innerHTML = `
    <div class="pt-head">
      <span class="pt-icon">${PIECE_UNICODE[piece.color + piece.type]}</span>
      <span class="pt-name">${piece.color === 'w' ? 'White' : 'Black'} ${pieceTypeName(piece.type)}</span>
      <span class="pt-sq">${algebraic(r,c)}</span>
    </div>
    ${mods.length ? `<div class="pt-mods">${mods.join('')}</div>` : '<div class="pt-mods pt-normal">No active effects</div>'}
  `;
  document.body.appendChild(tip);
  const rect = ev.target.closest('.square').getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = rect.right + 10;
  if (left + tw > window.innerWidth - 8) left = rect.left - tw - 10;
  let top = rect.top;
  if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = Math.max(8, top) + 'px';
}
function hidePieceTooltip() {
  const t = document.getElementById('piece-tooltip');
  if (t) t.remove();
}

// ---------- Active Effects sidebar ----------
function renderActiveEffects() {
  const panel = document.getElementById('active-effects');
  if (!panel) return;
  const effects = [];
  // Bombs
  for (const b of (UI.state.bombs || [])) {
    const mine = b.owner === NET.myColor;
    effects.push({
      icon: '💣',
      label: `Bomba at ${algebraic(b.r, b.c)}`,
      sub: `${b.turnsLeft} turn${b.turnsLeft===1?'':'s'} · ${mine ? 'yours' : 'enemy'}`,
      cls: 'bomb'
    });
  }
  // Frozen pieces, shielded pieces, spectral, captors — scan board
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = UI.state.board[r][c];
    if (!p) continue;
    if (p.shieldHP > 0) {
      effects.push({ icon:'🛡', label:`${pieceTypeName(p.type)} at ${algebraic(r,c)}`, sub:'Shielded', cls:'shield' });
    }
    if (p.frozenUntil && p.frozenUntil > UI.state.turnNumber) {
      effects.push({ icon:'❄', label:`${pieceTypeName(p.type)} at ${algebraic(r,c)}`, sub:'Frozen', cls:'frost' });
    }
    if (p.isPhased) {
      effects.push({ icon:'👁', label:`${pieceTypeName(p.type)} at ${algebraic(r,c)}`, sub:'Ghost', cls:'ghost' });
    }
    if (p.imprisoned) {
      effects.push({ icon:'⛓', label:`${pieceTypeName(p.type)} at ${algebraic(r,c)}`, sub:`Holding ${pieceTypeName(p.imprisoned.type)}`, cls:'captor' });
    }
    if (p.isSpectral) {
      effects.push({ icon:'♙', label:`Spectral at ${algebraic(r,c)}`, sub:`Vanishes T${p.spectralExpireTurn}`, cls:'spectral' });
    }
  }
  // Aether block
  if (UI.state.aetherBlocked[COLOR.WHITE]) effects.push({ icon:'⊘', label:'White', sub:'Aether Blocked', cls:'block' });
  if (UI.state.aetherBlocked[COLOR.BLACK]) effects.push({ icon:'⊘', label:'Black', sub:'Aether Blocked', cls:'block' });

  if (effects.length === 0) {
    panel.innerHTML = `<div class="ae-empty">No active effects</div>`;
    return;
  }
  panel.innerHTML = effects.map(e =>
    `<div class="ae-row ${e.cls}"><span class="ae-icon">${e.icon}</span><div class="ae-body"><div class="ae-label">${e.label}</div><div class="ae-sub">${e.sub}</div></div></div>`
  ).join('');
}

// ---------- Keyboard ----------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    UI.activePower = null; UI.selected = null; UI.legalDots = []; UI.powerState = {};
    render();
  }
});

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}
