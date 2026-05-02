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
  [POWER.BOMBA]: '💣', [POWER.DOUBLE_ATTACK]: '⚔',
  [POWER.IMPRISON]: '⛓', [POWER.AETHER_BLOCK]: '⊘', [POWER.CLEANSE]: '✨',
  [POWER.PROMOTE]: '♛', [POWER.CHRONOBREAK]: '↺', [POWER.VENGEANCE]: '☠', [POWER.WALL]: '▧'
};

// Full power details for the Compendium (v3.3)
const POWER_DETAILS = {
  [POWER.FROST]: {
    targeting: 'Any enemy non-King piece',
    duration: '1 turn (target skips their next turn)',
    turnEnds: 'No — turn continues',
    canMate: 'N/A',
    restrictions: 'Cannot target King, Spectral, captors, or an already-frozen piece. A frozen Rook blocks castling.',
    useCase: 'Disable a defender before you invade. Freeze the castling Rook to kill king safety.',
    counter: 'Move the piece away before Frost lands; or cast Cleanse (12 Aether) to thaw it instantly.'
  },
  [POWER.FORTIFY]: {
    targeting: 'One of your own pieces (not King)',
    duration: '1-hit shield · expires at end of your next turn if unused',
    turnEnds: 'No — turn continues',
    canMate: 'N/A',
    restrictions: 'Not usable on Spectral, captors, or already-shielded pieces. Cannot be stacked.',
    useCase: 'Protect a Queen deep in enemy territory. Bait an attacker into wasting a move.',
    counter: 'Hit the shield with a low-value piece to break it; or wait — it expires.'
  },
  [POWER.BLINK]: {
    targeting: 'Your piece (not King) → empty square within the 8 adjacent',
    duration: 'Instant',
    turnEnds: 'Yes',
    canMate: 'No',
    restrictions: 'Range = the 8 adjacent squares. Cannot leave King in check. Voids castling rights for a Blinked Rook.',
    useCase: 'Escape a pin, re-deploy, defuse a Bomba by stepping onto it.',
    counter: 'Frost the target before it Blinks. Surround the piece so no empty 3×3 squares remain.'
  },
  [POWER.SPAWN]: {
    targeting: 'Empty square in your half (ranks 1–4 from your side)',
    duration: 'Lasts 1 full turn cycle, vanishes at your next turn start',
    turnEnds: 'No — turn continues',
    canMate: 'Yes (if the Spectral Pawn delivers mate on spawn)',
    restrictions: 'Spectral Pawn cannot move, be sacrificed, en passant, or targeted. Blocks castling paths.',
    useCase: 'Block an attack lane or give check for a turn.',
    counter: 'Capture the Spectral Pawn or wait it out.'
  },
  [POWER.BOMBA]: {
    targeting: 'Empty square on the row one ahead of your furthest pawn, or diagonal from one of your pawns',
    duration: 'Detonates 1 turn later',
    turnEnds: 'No — turn continues',
    canMate: 'N/A — Kings are immune to the blast',
    restrictions: 'Blast destroys unshielded ENEMY non-Kings only. Shielded pieces absorb one blast. Kings and your own pieces are safe.',
    useCase: 'Clear pawn clusters; area-denial the square the enemy wants to occupy.',
    counter: 'Step any piece onto the bomb to defuse it. Fortify a threatened piece.'
  },
  [POWER.DOUBLE_ATTACK]: {
    targeting: 'Your piece → 2 legal moves in sequence',
    duration: 'Instant — both moves happen, attacker ends on the 2nd destination',
    turnEnds: 'Yes',
    canMate: 'No',
    restrictions: 'Both moves must be independently legal. Cannot target King. Cannot deliver mate. Shields fizzle captures normally.',
    useCase: 'Two-for-one trades. Reposition a Knight deep for tempo.',
    counter: 'Keep high-value pieces defended twice. Fortify the likely first target.'
  },
  [POWER.IMPRISON]: {
    targeting: 'Adjacent enemy non-King piece (captor = your piece)',
    duration: 'Until the captor dies, is Cleansed, or the prisoner is otherwise freed',
    turnEnds: 'No — turn continues',
    canMate: 'Indirectly — captor still attacks as normal',
    restrictions: 'Cannot imprison Frozen, Spectral, or already-captor pieces. Cannot imprison the King.',
    useCase: 'Permanently sideline a Queen using a pawn. The captor can still move and attack.',
    counter: 'Kill the captor — prisoner returns to its original starting square (destroyed if occupied). Or Cleanse to free it.'
  },
  [POWER.AETHER_BLOCK]: {
    targeting: 'Opponent (no board target)',
    duration: "Opponent's next turn",
    turnEnds: 'No — turn continues',
    canMate: 'N/A',
    restrictions: 'Opponent gains Aether normally but cannot SPEND it. Active effects keep ticking.',
    useCase: 'Break a combo right before it lands.',
    counter: 'Save Aether; spending resumes next turn.'
  },
  [POWER.CLEANSE]: {
    targeting: 'Any piece (yours or enemy) carrying Imprison or Frost',
    duration: 'Instant',
    turnEnds: 'No — turn continues',
    canMate: 'N/A',
    restrictions: 'Cannot target King. Must be cleansing something (piece must be frozen or a captor).',
    useCase: 'Free a strong piece caught in an Imprison cage. Thaw a frozen Rook to castle again.',
    counter: 'Re-apply the effect next turn. Aether Block the caster to deny Cleanse.'
  },
  [POWER.PROMOTE]: {
    targeting: 'Any of your pawns (not Spectral)',
    duration: 'Instant',
    turnEnds: 'Yes',
    canMate: 'Yes — promotion-to-mate is allowed (delivers mate like any normal move)',
    restrictions: 'Select a concrete type: Q / R / B / N.',
    useCase: 'Skip the promotion race — Queen a pawn on the 5th rank for surprise.',
    counter: 'Aether Block; Frost the pawn pre-emptively so promotion is wasted.'
  },
  [POWER.CHRONOBREAK]: {
    targeting: 'No target (rewinds opponent\'s last move)',
    duration: 'Instant',
    turnEnds: 'No — turn continues',
    canMate: 'N/A',
    restrictions: 'Cannot be cast on turn 1. Cannot Chronobreak a Chronobreak. Opponent keeps the Aether they spent.',
    useCase: 'Undo a catastrophic blunder. Restore an imprisoned piece.',
    counter: 'Force opponent to use it defensively before your ultimate lands.'
  },
  [POWER.VENGEANCE]: {
    targeting: 'Any enemy non-King piece on the board',
    duration: 'Instant',
    turnEnds: 'Yes',
    canMate: 'No',
    restrictions: 'Bypasses the 1st shield (shield absorbs, piece still dies). Cannot target King. Cannot leave King in check.',
    useCase: 'Remove a defender without moving.',
    counter: 'Economy-starve with Aether Block; keep shielded defenders to burn the one shield.'
  },
  [POWER.WALL]: {
    targeting: 'Your piece (the anchor)',
    duration: 'Permanent pawns',
    turnEnds: 'Yes',
    canMate: 'No — v3.3 blocks any Wall that would check or mate the enemy King',
    restrictions: 'New pawns skip last-rank squares. At least 1 empty adjacent square required. Cannot put the enemy King in check.',
    useCase: 'Build an instant fortress around your King. Cramp an enemy bishop.',
    counter: 'Capture the anchor; Wall pawns themselves stay and remain targetable.'
  }
};

function buildPowerPanel() {
  const deck = document.getElementById('power-cards');
  deck.innerHTML = '';
  // All 13 powers in a single horizontal deck (no tier labels per UX request)
  const allPowers = [
    POWER.FROST, POWER.FORTIFY, POWER.BLINK, POWER.SPAWN,
    POWER.IMPRISON, POWER.AETHER_BLOCK, POWER.CLEANSE, POWER.BOMBA, POWER.DOUBLE_ATTACK,
    POWER.PROMOTE, POWER.VENGEANCE, POWER.WALL, POWER.CHRONOBREAK
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
    // New local game → leave online mode if we were in it, reset perspective.
    if (NET.mode === 'online') { try { netLeave(); } catch {} }
    UI.state = initGame();
    UI.selected = null; UI.activePower = null; UI.powerState = {};
    UI.prevAether = { w: UI.state.mana[COLOR.WHITE], b: UI.state.mana[COLOR.BLACK] };
    buildBoard();
    initClock(mode);
    startClock();
    setStatus('New game — White to move.', 'ok');
    applyPerspective();
    render();
  });

  document.getElementById('time-mode').addEventListener('change', (e) => {
    UI.clock.mode = e.target.value;
  });

  document.getElementById('open-codex').addEventListener('click', () => openCodex());
  document.getElementById('open-compendium').addEventListener('click', () => openCompendium());
  document.getElementById('open-lobby').addEventListener('click', () => openLobby());
  document.getElementById('open-auth').addEventListener('click', () => {
    if (authIsLoggedIn()) openAccountMenu();
    else openAuthModal();
  });
  AUTH.onChange = renderAuthButton;
  renderAuthButton();
}

function renderAuthButton() {
  const btn = document.getElementById('open-auth');
  if (!btn) return;
  if (authIsLoggedIn()) {
    btn.textContent = `👤 ${AUTH.user.displayName}`;
    btn.title = 'Account menu';
  } else {
    btn.textContent = '👤 Sign in';
    btn.title = 'Sign in / sign up';
  }
}

function openAuthModal(defaultMode = 'login') {
  if (document.getElementById('auth-backdrop')) return;
  const bd = document.createElement('div');
  bd.id = 'auth-backdrop';
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal auth-modal">
      <h2 id="auth-title">Sign in</h2>
      <div class="auth-tabs">
        <button class="auth-tab" data-mode="login">Sign in</button>
        <button class="auth-tab" data-mode="signup">Create account</button>
      </div>
      <div class="lobby-row">
        <label>Email</label>
        <input id="auth-email" type="email" autocomplete="email" maxlength="100">
      </div>
      <div class="lobby-row" id="auth-name-row" style="display:none;">
        <label>Display name</label>
        <input id="auth-name" type="text" maxlength="30" autocomplete="nickname">
      </div>
      <div class="lobby-row">
        <label>Password</label>
        <input id="auth-password" type="password" autocomplete="current-password" minlength="8" maxlength="100">
      </div>
      <div class="lobby-actions">
        <button class="primary" id="auth-submit">Sign in</button>
      </div>
      <div class="lobby-status" id="auth-status"></div>
      <div class="actions">
        <button id="auth-cancel">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(bd);

  let mode = defaultMode;
  const title = bd.querySelector('#auth-title');
  const submit = bd.querySelector('#auth-submit');
  const nameRow = bd.querySelector('#auth-name-row');
  const statusEl = bd.querySelector('#auth-status');
  const setAuthStatus = (msg, kind = 'ok') => { statusEl.textContent = msg; statusEl.className = 'lobby-status ' + kind; };

  function setMode(m) {
    mode = m;
    bd.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === m));
    if (m === 'signup') { title.textContent = 'Create account'; submit.textContent = 'Create account'; nameRow.style.display = ''; }
    else { title.textContent = 'Sign in'; submit.textContent = 'Sign in'; nameRow.style.display = 'none'; }
    setAuthStatus('');
  }
  bd.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
  setMode(defaultMode);

  submit.addEventListener('click', async () => {
    const email = bd.querySelector('#auth-email').value.trim();
    const password = bd.querySelector('#auth-password').value;
    setAuthStatus('Please wait…');
    let r;
    if (mode === 'signup') {
      const displayName = bd.querySelector('#auth-name').value.trim();
      r = await authSignup(email, password, displayName);
    } else {
      r = await authLogin(email, password);
    }
    if (r.error) { setAuthStatus(r.error, 'err'); return; }
    setAuthStatus(`Welcome, ${r.user.displayName}!`, 'ok');
    setTimeout(() => bd.remove(), 400);
  });
  bd.querySelector('#auth-cancel').addEventListener('click', () => bd.remove());
}

function openAccountMenu() {
  if (document.getElementById('account-backdrop')) return;
  const bd = document.createElement('div');
  bd.id = 'account-backdrop';
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal">
      <h2>Account</h2>
      <p>Signed in as <b>${AUTH.user.displayName}</b> · ${AUTH.user.email}</p>
      <div class="actions">
        <button class="primary" id="acct-games">My Games</button>
        <button id="acct-close">Close</button>
        <button id="acct-logout">Sign out</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  bd.querySelector('#acct-games').addEventListener('click', () => { bd.remove(); openMyGames(); });
  bd.querySelector('#acct-close').addEventListener('click', () => bd.remove());
  bd.querySelector('#acct-logout').addEventListener('click', () => {
    authLogout();
    bd.remove();
    setStatus('Signed out', 'ok');
  });
}

// ---------- My Games list ----------
async function openMyGames() {
  if (document.getElementById('mygames-backdrop')) return;
  if (!authIsLoggedIn()) { openAuthModal('login'); return; }
  const bd = document.createElement('div');
  bd.id = 'mygames-backdrop';
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal mygames-modal">
      <h2>My Games</h2>
      <div id="mygames-body" class="mygames-body">Loading…</div>
      <div class="actions"><button id="mg-close">Close</button></div>
    </div>`;
  document.body.appendChild(bd);
  bd.querySelector('#mg-close').addEventListener('click', () => bd.remove());

  const body = bd.querySelector('#mygames-body');
  const r = await apiFetch('/api/games');
  if (!r.ok) { body.textContent = r.body.error || 'Failed to load games'; return; }
  const list = r.body.games || [];
  if (!list.length) { body.innerHTML = '<p class="mg-empty">No completed games yet. Finish a game to see it here.</p>'; return; }

  body.innerHTML = list.map(g => {
    const myId = AUTH.user.id;
    const myColor = g.whiteUserId === myId ? 'White' : g.blackUserId === myId ? 'Black' : '—';
    const resultLabel = g.result === 'DRAW' ? 'Draw' : g.result === 'WHITE' ? 'White wins' : 'Black wins';
    const outcome = g.result === 'DRAW'
      ? 'Draw'
      : (g.result === 'WHITE' && myColor === 'White') || (g.result === 'BLACK' && myColor === 'Black')
        ? 'Win' : 'Loss';
    const when = new Date(g.endedAt).toLocaleString();
    return `
      <div class="mg-row" data-game-id="${g.id}">
        <div class="mg-col mg-outcome mg-${outcome.toLowerCase()}">${outcome}</div>
        <div class="mg-col mg-matchup">
          <div class="mg-players">${escapeHtml(g.whiteName)} <span class="mg-vs">vs</span> ${escapeHtml(g.blackName)}</div>
          <div class="mg-meta">${resultLabel} · ${g.winReason || ''} · ${g.timeMode}</div>
        </div>
        <div class="mg-col mg-when">${when}<br><span class="mg-color">You played ${myColor}</span></div>
        <div class="mg-col mg-actions"><button class="primary mg-replay">Replay ▶</button></div>
      </div>`;
  }).join('');

  body.querySelectorAll('.mg-row').forEach(row => {
    row.querySelector('.mg-replay').addEventListener('click', async () => {
      const id = row.dataset.gameId;
      const rr = await apiFetch('/api/games/' + id);
      if (!rr.ok) { alert(rr.body.error || 'Failed to load game'); return; }
      bd.remove();
      openReplay(rr.body.game);
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Replay viewer ----------
// Reconstructs the game by re-applying actions on a fresh engine state and
// snapshotting the state after each step. Users can scrub forward/back.
function openReplay(game) {
  if (document.getElementById('replay-backdrop')) return;
  const actions = Array.isArray(game.actions) ? game.actions : [];
  const snapshots = buildReplaySnapshots(actions);
  // snapshots[0] is the initial position; snapshots[i] is state AFTER actions[i-1].

  const bd = document.createElement('div');
  bd.id = 'replay-backdrop';
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal replay-modal">
      <h2>Replay · ${escapeHtml(game.whiteName)} vs ${escapeHtml(game.blackName)}</h2>
      <div class="replay-meta">${game.result === 'DRAW' ? 'Draw' : (game.result === 'WHITE' ? 'White wins' : 'Black wins')} · ${game.winReason || ''} · ${game.timeMode}</div>
      <div class="replay-stage">
        <div id="replay-board" class="replay-board"></div>
        <div class="replay-side">
          <div id="replay-move-log" class="replay-move-log"></div>
        </div>
      </div>
      <div class="replay-controls">
        <button id="rp-start" title="Start">⏮</button>
        <button id="rp-prev" title="Back">◀</button>
        <span id="rp-pos" class="rp-pos">0 / ${actions.length}</span>
        <button id="rp-next" title="Forward">▶</button>
        <button id="rp-end" title="End">⏭</button>
        <button id="rp-close" style="margin-left:auto;">Close</button>
      </div>
    </div>`;
  document.body.appendChild(bd);

  // Build 8×8 DOM grid for the replay board
  const boardEl = bd.querySelector('#replay-board');
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'rp-square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.r = r; sq.dataset.c = c;
      boardEl.appendChild(sq);
    }
  }

  let idx = 0;
  const posEl = bd.querySelector('#rp-pos');
  const moveLogEl = bd.querySelector('#replay-move-log');
  function renderReplayAt(i) {
    idx = Math.max(0, Math.min(snapshots.length - 1, i));
    posEl.textContent = `${idx} / ${actions.length}`;
    const snap = snapshots[idx];
    // Paint board
    boardEl.querySelectorAll('.rp-square').forEach(sq => {
      sq.innerHTML = '';
      sq.classList.remove('last-move');
    });
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = snap.board[r][c];
      if (!p) continue;
      const sq = boardEl.querySelector(`.rp-square[data-r="${r}"][data-c="${c}"]`);
      const el = document.createElement('div');
      let classes = 'rp-piece ' + (p.color === 'w' ? 'white' : 'black');
      if (p.isSpectral) classes += ' rp-spectral';
      el.className = classes;
      el.textContent = PIECE_UNICODE[p.color + p.type];
      sq.appendChild(el);
      if (p.shieldHP > 0) {
        const s1 = document.createElement('div'); s1.className = 'rp-badge rp-shield'; s1.textContent = '🛡'; sq.appendChild(s1);
      }
      if (p.frozen) {
        const f = document.createElement('div'); f.className = 'rp-badge rp-frost'; f.textContent = '❄'; sq.appendChild(f);
      }
      if (p.imprisoned) {
        const i = document.createElement('div'); i.className = 'rp-badge rp-captor'; i.textContent = '⛓'; sq.appendChild(i);
      }
    }
    // Bomb markers
    for (const b of (snap.bombs || [])) {
      const sq = boardEl.querySelector(`.rp-square[data-r="${b.r}"][data-c="${b.c}"]`);
      if (!sq) continue;
      const m = document.createElement('div'); m.className = 'rp-bomb';
      m.textContent = '💣' + b.turnsLeft;
      sq.appendChild(m);
    }
    // Highlight last action
    if (idx > 0) {
      const lastAct = actions[idx - 1];
      const from = lastAct.payload && (lastAct.payload.from || lastAct.payload.captor);
      const to = lastAct.payload && (lastAct.payload.to || lastAct.payload.captive || lastAct.payload);
      if (from && typeof from.r === 'number') boardEl.querySelector(`.rp-square[data-r="${from.r}"][data-c="${from.c}"]`)?.classList.add('last-move');
      if (to && typeof to.r === 'number' && typeof to.c === 'number') boardEl.querySelector(`.rp-square[data-r="${to.r}"][data-c="${to.c}"]`)?.classList.add('last-move');
    }
    // Move log
    moveLogEl.innerHTML = actions.map((a, i2) => {
      const label = formatAction(a);
      const cls = i2 === idx - 1 ? 'rp-move active' : 'rp-move';
      return `<div class="${cls}" data-i="${i2}">${i2 + 1}. <b>${a.by === 'w' ? 'W' : 'B'}</b> ${escapeHtml(label)}</div>`;
    }).join('');
    moveLogEl.querySelectorAll('.rp-move').forEach(el => {
      el.addEventListener('click', () => renderReplayAt(parseInt(el.dataset.i, 10) + 1));
    });
    const active = moveLogEl.querySelector('.rp-move.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  bd.querySelector('#rp-start').addEventListener('click', () => renderReplayAt(0));
  bd.querySelector('#rp-prev').addEventListener('click', () => renderReplayAt(idx - 1));
  bd.querySelector('#rp-next').addEventListener('click', () => renderReplayAt(idx + 1));
  bd.querySelector('#rp-end').addEventListener('click', () => renderReplayAt(snapshots.length - 1));
  bd.querySelector('#rp-close').addEventListener('click', () => bd.remove());

  renderReplayAt(0);
}

// Re-apply each action against a fresh engine state, snapshotting after each step.
// Silently skip any action that errors (e.g. if the stored log has a shape mismatch
// after a future engine migration) — the viewer can still show partial progress.
function buildReplaySnapshots(actions) {
  const snaps = [];
  const s = initGame();
  snaps.push(snapshotReplayState(s));
  for (const a of actions) {
    try { applyReplayAction(s, a); }
    catch (e) { console.warn('[replay] skipped', a, e.message); }
    snaps.push(snapshotReplayState(s));
  }
  return snaps;
}

function snapshotReplayState(s) {
  return {
    board: s.board.map(row => row.map(p => p ? {
      type: p.type,
      color: p.color,
      shieldHP: p.shieldHP || 0,
      frozen: !!(p.frozenUntil && p.frozenUntil > s.turnNumber),
      imprisoned: p.imprisoned ? { type: p.imprisoned.type, color: p.imprisoned.color } : null,
      isSpectral: !!p.isSpectral
    } : null)),
    turn: s.turn,
    turnNumber: s.turnNumber,
    winner: s.winner || null,
    bombs: (s.bombs || []).map(b => ({ r: b.r, c: b.c, owner: b.owner, turnsLeft: b.turnsLeft }))
  };
}

function applyReplayAction(s, a) {
  const { type, payload } = a;
  if (type === 'MOVE') return makeMove(s, payload.from.r, payload.from.c, payload.to.r, payload.to.c, payload.promotion);
  if (type === 'SACRIFICE') return sacrificePiece(s, payload.r, payload.c);
  if (type === 'RESIGN') { s.winner = a.by === 'w' ? 'b' : 'w'; s.winReason = 'RESIGNATION'; return; }
  if (type === 'POWER_CAST') {
    const p = payload.power;
    if (p === 'FROST') return castFrost(s, payload.r, payload.c);
    if (p === 'FORTIFY') return castFortify(s, payload.r, payload.c);
    if (p === 'BLINK') return castBlink(s, payload.from.r, payload.from.c, payload.to.r, payload.to.c);
    if (p === 'SPAWN') return castSpawn(s, payload.r, payload.c);
    if (p === 'BOMBA') return castBomba(s, payload.r, payload.c);
    if (p === 'DOUBLE_ATTACK') return castDoubleAttack(s, payload.from.r, payload.from.c, payload.to.r, payload.to.c, payload.jump.r, payload.jump.c);
    if (p === 'IMPRISON') return castImprison(s, payload.captor.r, payload.captor.c, payload.captive.r, payload.captive.c);
    if (p === 'AETHER_BLOCK') return castAetherBlock(s);
    if (p === 'CLEANSE') return castCleanse(s, payload.r, payload.c);
    // Back-compat replay of older games
    if (p === 'GHOST') return { error: 'Ghost action (legacy)' };
    if (p === 'CHAIN_LIGHTNING') return castDoubleAttack(s, payload.from.r, payload.from.c, payload.to.r, payload.to.c, payload.jump.r, payload.jump.c);
    if (p === 'PROMOTE') return castPromote(s, payload.r, payload.c, payload.newType);
    if (p === 'CHRONOBREAK') return castChronobreak(s);
    if (p === 'VENGEANCE') return castVengeance(s, payload.r, payload.c);
    if (p === 'WALL') return castWall(s, payload.r, payload.c);
  }
}

function formatAction(a) {
  const p = a.payload || {};
  if (a.type === 'MOVE') {
    return `move ${algebraic(p.from.r, p.from.c)} → ${algebraic(p.to.r, p.to.c)}${p.promotion ? ' = ' + p.promotion : ''}`;
  }
  if (a.type === 'SACRIFICE') return `⚔ sacrifice ${algebraic(p.r, p.c)}`;
  if (a.type === 'RESIGN') return 'resigned';
  if (a.type === 'POWER_CAST') {
    const name = POWER_DISPLAY_NAMES[p.power] || (p.power || '').toLowerCase();
    if (p.power === 'DOUBLE_ATTACK' && p.from && p.to && p.jump) {
      return `⚔ ${name}: ${algebraic(p.from.r, p.from.c)} → ${algebraic(p.to.r, p.to.c)} → ${algebraic(p.jump.r, p.jump.c)}`;
    }
    if (p.power === 'IMPRISON' && p.captor && p.captive) {
      return `⛓ ${name}: ${algebraic(p.captor.r, p.captor.c)} cages ${algebraic(p.captive.r, p.captive.c)}`;
    }
    if (p.power === 'BLINK' && p.from && p.to) {
      return `✦ ${name}: ${algebraic(p.from.r, p.from.c)} → ${algebraic(p.to.r, p.to.c)}`;
    }
    if (p.power === 'PROMOTE' && typeof p.r === 'number') {
      return `♛ ${name}: ${algebraic(p.r, p.c)} → ${p.newType || 'Q'}`;
    }
    if (p.power === 'AETHER_BLOCK') return `⊘ ${name}`;
    if (p.power === 'CHRONOBREAK') return `↺ ${name}`;
    if (typeof p.r === 'number') return `${POWER_ICONS[p.power] || ''} ${name} @ ${algebraic(p.r, p.c)}`.trim();
    return name;
  }
  return a.type;
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
        <input id="lobby-name" type="text" maxlength="20" value="${((authIsLoggedIn() && AUTH.user.displayName) || localStorage.getItem('ng_name') || 'Player').replace(/"/g,'')}"${authIsLoggedIn() ? ' readonly title="Name comes from your account"' : ''}>
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
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'lobby-status ' + kind;
  };
  UI._setLobbyStatus = setLobbyStatus;

  // NET.onError / onRoomUpdate / onState are set ONCE globally below (not per lobby open).
  // Retained here only: UI._setLobbyStatus is already exposed so the global handler can use it.

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
  applyPerspective();
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

// Global, permanent handlers (set once at boot). Do NOT override inside lobby code.
NET.onError = (e) => {
  const msg = (e && e.message) || 'Connection error';
  // If lobby is open, show there; otherwise surface on the game status bar.
  if (document.getElementById('lobby-status') && UI._setLobbyStatus) UI._setLobbyStatus(msg, 'err');
  else setStatus(msg, 'err');
};
NET.onRoomUpdate = (m) => {
  console.log('[ui] ROOM_STATE', m.status, 'you=' + m.you);
  try { localStorage.setItem('ng_name', (document.getElementById('lobby-name')?.value || 'Player')); } catch {}
  if (m.status === 'WAITING') {
    if (UI._setLobbyStatus) UI._setLobbyStatus(`Room created: ${m.code} — share this code!`, 'ok');
    showWaitingForOpponent(m.code);
  } else if (m.status === 'PLAYING') {
    document.getElementById('lobby-backdrop')?.remove();
    document.getElementById('waiting-backdrop')?.remove();
    activateOnlineMode(m);
  } else if (m.status === 'FINISHED') {
    activateOnlineMode(m);
  }
};
NET.onState = (m) => { applyServerState(m); };
NET.onRoomExpired = () => {
  // Server no longer knows our room — most commonly after a redeploy.
  // Drop back to hotseat, clear board, and show a modal the user can dismiss into lobby.
  applyPerspective();
  if (document.getElementById('room-expired-backdrop')) return;
  const bd = document.createElement('div');
  bd.id = 'room-expired-backdrop';
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal">
      <h2>Room expired</h2>
      <p>The server lost this room — usually because it was redeployed or the room timed out. Your current session can't continue.</p>
      <div class="actions">
        <button class="primary" id="re-lobby">Back to Lobby</button>
        <button id="re-dismiss">Play Local</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  bd.querySelector('#re-lobby').addEventListener('click', () => {
    bd.remove();
    openLobby();
  });
  bd.querySelector('#re-dismiss').addEventListener('click', () => bd.remove());
  setStatus('Room expired — returned to local game', 'err');
};
NET.onStatusChange = (state) => {
  if (NET.mode !== 'online') return;
  if (state === 'connecting') setStatus('Reconnecting…', 'warn');
  else if (state === 'connected') setStatus(`Connected as ${NET.myColor === 'w' ? 'White' : NET.myColor === 'b' ? 'Black' : 'Spectator'}. Room: ${NET.roomCode || ''}`, 'ok');
  else if (state === 'disconnected') setStatus('Disconnected — attempting reconnect…', 'warn');
};

// ---------- Power Compendium modal ----------
function openCompendium() {
  if (document.getElementById('compendium-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'compendium-backdrop';
  backdrop.className = 'modal-backdrop compendium-backdrop';
  const allPowers = [
    POWER.FROST, POWER.FORTIFY, POWER.BLINK, POWER.SPAWN,
    POWER.IMPRISON, POWER.AETHER_BLOCK, POWER.CLEANSE, POWER.BOMBA, POWER.DOUBLE_ATTACK,
    POWER.PROMOTE, POWER.VENGEANCE, POWER.WALL, POWER.CHRONOBREAK
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
    POWER.IMPRISON, POWER.AETHER_BLOCK, POWER.CLEANSE, POWER.BOMBA, POWER.DOUBLE_ATTACK,
    POWER.PROMOTE, POWER.VENGEANCE, POWER.WALL, POWER.CHRONOBREAK
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
      const myColor = (NET.mode === 'online' && (NET.myColor === 'w' || NET.myColor === 'b'))
        ? NET.myColor : UI.state.turn;
      if (!canAfford(UI.state, myColor, p)) {
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

// Apply Black-perspective flip + "YOU" badge based on NET state.
function applyPerspective() {
  const wrap = document.querySelector('.board-wrap');
  const flip = NET.mode === 'online' && NET.myColor === 'b';
  if (wrap) wrap.classList.toggle('flipped', flip);
  const white = document.getElementById('player-white');
  const black = document.getElementById('player-black');
  const isOnline = NET.mode === 'online';
  if (white) white.classList.toggle('is-you', isOnline && NET.myColor === 'w');
  if (black) black.classList.toggle('is-you', isOnline && NET.myColor === 'b');
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
  // v3.3: each player sees affordability based on THEIR OWN aether, regardless of whose turn it is.
  // Online: myColor from NET. Local hotseat: use current state.turn (same as before).
  const myColor = (NET.mode === 'online' && (NET.myColor === 'w' || NET.myColor === 'b'))
    ? NET.myColor
    : UI.state.turn;
  const myBlocked = UI.state.aetherBlocked[myColor];
  const isMyTurnNow = (NET.mode !== 'online') || (NET.myColor === UI.state.turn);

  document.querySelectorAll('#power-cards .power-card').forEach(btn => {
    const p = btn.dataset.power;
    const afford = canAfford(UI.state, myColor, p);
    const locked = !afford || !!UI.state.winner || !isMyTurnNow;
    btn.classList.toggle('disabled', locked);
    btn.disabled = false;
    btn.classList.toggle('active', UI.activePower === p);
  });

  const sacBtn = document.getElementById('sacrifice-btn');
  const alreadySac = UI.state.sacrificedThisTurn && UI.state.sacrificedThisTurn[myColor];
  sacBtn.classList.toggle('active', UI.activePower === 'SACRIFICE');
  const sacLocked = !!UI.state.winner || alreadySac || myBlocked || !isMyTurnNow;
  sacBtn.disabled = sacLocked;
  sacBtn.classList.toggle('disabled', sacLocked);
  if (!isMyTurnNow) sacBtn.title = "Waiting for opponent's move";
  else if (myBlocked) sacBtn.title = 'Aether Block active';
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
    // v3.3: check affordability against MY aether, not current turn's.
    const myColor = (NET.mode === 'online' && (NET.myColor === 'w' || NET.myColor === 'b'))
      ? NET.myColor : UI.state.turn;
    if (!canAfford(UI.state, myColor, p)) {
      const cost = POWER_COSTS[p];
      const have = UI.state.mana[myColor];
      setStatus(`${POWER_DISPLAY_NAMES[p]} needs ${cost} Aether · you have ${have}`, 'err');
      return;
    }
    // Also: in online mode, you can stage a cast only when it's your turn.
    if (NET.mode === 'online' && NET.myColor !== UI.state.turn) {
      setStatus("Wait for your turn to cast.", 'warn');
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

  if (p === POWER.CLEANSE) {
    if (netInterceptPower('CLEANSE', { r, c })) return;
    const res = castCleanse(UI.state, r, c);
    if (res.error) { setStatus(res.error, 'err'); UI.activePower = null; render(); return; }
    setStatus('Cleanse!', 'ok');
    playVfx('fortify', r, c);  // reuse shield VFX for now
    if (res.released) {
      if (res.released.placed) setStatus(`Cleanse: prisoner returned to ${algebraic(res.released.r, res.released.c)}.`, 'ok');
      else setStatus('Cleanse: prisoner destroyed — home tile was occupied.', 'warn');
    }
    UI.activePower = null; render(); return;
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

  if (p === POWER.DOUBLE_ATTACK) {
    if (!UI.powerState.attacker) {
      const piece = UI.state.board[r][c];
      if (!piece || piece.color !== UI.state.turn) { setStatus('Select attacker (your piece, not King).', 'warn'); return; }
      if (piece.type === PIECE.KING) { setStatus('Double Attack cannot target the King.', 'err'); return; }
      UI.powerState.attacker = { r, c };
      setStatus('Select the FIRST destination (any legal move for this piece).', 'ok'); render(); return;
    }
    if (!UI.powerState.first) {
      UI.powerState.first = { r, c };
      setStatus('Select the SECOND destination (legal from the first landing).', 'ok'); render(); return;
    }
    const a = UI.powerState.attacker, f = UI.powerState.first;
    if (netInterceptPower('DOUBLE_ATTACK', { from: a, to: f, jump: { r, c } })) return;
    pauseClockForAnimation(1400);
    const res = castDoubleAttack(UI.state, a.r, a.c, f.r, f.c, r, c);
    if (res.error) { setStatus(res.error, 'err'); UI.powerState = {}; render(); return; }
    setStatus('Double Attack!', 'ok');
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
  } else if (p === POWER.CLEANSE) {
    // Any piece that has Imprison or Frost (own or enemy), never King.
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const piece = UI.state.board[r][c];
      if (!piece || piece.type === PIECE.KING) continue;
      const hasFrost = piece.frozenUntil && piece.frozenUntil > UI.state.turnNumber;
      if (hasFrost || piece.imprisoned) targets.push({r, c});
    }
  } else if (p === POWER.BOMBA) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      if (UI.state.board[r][c]) continue;
      if (validBombaTarget(UI.state, color, r, c)) targets.push({r, c});
    }
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
  } else if (p === POWER.DOUBLE_ATTACK) {
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
  const sacVal = (piece.type !== PIECE.KING && !piece.isSpectral) ? SACRIFICE_VALUES[piece.type] : null;
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
    ${sacVal != null ? `<div class="pt-sac">⚔ Sacrifice value: <b>+${sacVal}</b> Aether</div>` : ''}
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
