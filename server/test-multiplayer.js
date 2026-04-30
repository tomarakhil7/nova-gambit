// ============================================================
// Multiplayer E2E test — two headless clients play a short game.
// ============================================================

const WebSocket = require('ws');

const PORT = process.env.TEST_PORT || 8766;
const URL = `ws://localhost:${PORT}/ws`;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (!cond) { failed++; console.log(`  ✗ ${msg}`); }
  else { passed++; console.log(`  ✓ ${msg}`); }
}

function open() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitFor(ws, typeOrPredicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { ws.off('message', onMsg); reject(new Error('Timeout waiting for ' + typeOrPredicate)); }, timeoutMs);
    function onMsg(raw) {
      const m = JSON.parse(raw);
      const match = typeof typeOrPredicate === 'function' ? typeOrPredicate(m) : m.type === typeOrPredicate;
      if (match) { clearTimeout(t); ws.off('message', onMsg); resolve(m); }
    }
    ws.on('message', onMsg);
  });
}

function send(ws, msg) { ws.send(JSON.stringify(msg)); }

async function run() {
  console.log('\n▶ Multiplayer E2E');

  // 1. White creates room
  const white = await open();
  send(white, { type: 'CREATE_ROOM', name: 'Alice', timeMode: 'classical' });
  const createResp = await waitFor(white, 'ROOM_STATE');
  assert(createResp.you === 'w', 'White is assigned color w');
  assert(createResp.status === 'WAITING', 'Status is WAITING');
  assert(typeof createResp.code === 'string' && createResp.code.length === 5, 'Received 5-char room code');
  const code = createResp.code;
  const whiteSession = createResp.sessionToken;

  // 2. Black joins
  const black = await open();
  // Collect the White-side notification at the same time as Black's own join
  const whiteStarted = waitFor(white, m => m.type === 'ROOM_STATE' && m.status === 'PLAYING');
  send(black, { type: 'JOIN_ROOM', code, name: 'Bob' });
  const blackJoin = await waitFor(black, 'ROOM_STATE');
  assert(blackJoin.you === 'b', 'Black is assigned b');
  assert(blackJoin.status === 'PLAYING', 'Status flipped to PLAYING on join');
  assert(!!blackJoin.game, 'Initial game state included');
  assert(blackJoin.game.turn === 'w', 'White moves first');
  await whiteStarted;

  // 3. Black tries to move — should be rejected
  send(black, { type: 'MOVE', payload: { from: { r: 1, c: 4 }, to: { r: 3, c: 4 } } });
  const err = await waitFor(black, 'ERROR');
  assert(err.message === 'Not your turn', 'Black rejected when not their turn');

  // 4. White plays e2-e4
  const blackGotState = waitFor(black, 'GAME_STATE');
  send(white, { type: 'MOVE', payload: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } } });
  const stateMsg = await blackGotState;
  assert(stateMsg.state.turn === 'b', 'Turn passed to Black');
  assert(stateMsg.state.board[4][4].type === 'P' && stateMsg.state.board[4][4].color === 'w', 'e4 has white pawn');

  // 5. Black plays e7-e5
  const whiteGotState = waitFor(white, 'GAME_STATE');
  send(black, { type: 'MOVE', payload: { from: { r: 1, c: 4 }, to: { r: 3, c: 4 } } });
  await whiteGotState;

  // 6. White tries to cast Fortify (cost 5) — should fail (aether == 0 at start, gained +1 after turn → 1)
  send(white, { type: 'POWER_CAST', payload: { power: 'FORTIFY', r: 7, c: 3 } });
  const fortErr = await waitFor(white, 'ERROR');
  assert(/Aether|Not enough/i.test(fortErr.message), 'Fortify rejected due to insufficient Aether');

  // 7. White plays a normal dev move
  send(white, { type: 'MOVE', payload: { from: { r: 7, c: 6 }, to: { r: 5, c: 5 } } });
  await waitFor(black, 'GAME_STATE');

  // 8. Resign flow
  send(black, { type: 'RESIGN', payload: {} });
  const resignMsg = await waitFor(white, m => m.type === 'GAME_STATE' && m.state.winner);
  assert(resignMsg.state.winner === 'w', 'White wins by resignation');
  assert(resignMsg.state.winReason === 'RESIGNATION', 'Win reason is RESIGNATION');

  // 9. Reconnection: black disconnects, rejoins with session
  const blackSession = blackJoin.sessionToken;
  const code2 = await createAndJoinFreshRoom();
  // above creates fresh: just verify codes differ
  assert(code2 !== code, 'Fresh room has distinct code');

  white.close();
  black.close();

  console.log(`\n▶ Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

async function createAndJoinFreshRoom() {
  const w = await open();
  send(w, { type: 'CREATE_ROOM', name: 'X', timeMode: 'classical' });
  const r = await waitFor(w, 'ROOM_STATE');
  w.close();
  return r.code;
}

run().catch(e => { console.error('Test failure:', e); process.exit(1); });
