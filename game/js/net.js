// ============================================================
// NOVA GAMBIT - Client networking (multiplayer)
// ============================================================

const NET = {
  ws: null,
  connected: false,
  mode: 'hotseat',          // 'hotseat' | 'online'
  myColor: null,            // 'w' | 'b' | 's' | null
  roomCode: null,
  sessionToken: null,
  pingInterval: null,
  onOpen: null,
  onState: null,
  onError: null,
  onRoomUpdate: null
};

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function netConnect() {
  return new Promise((resolve, reject) => {
    if (NET.ws && NET.ws.readyState === 1) return resolve();
    const ws = new WebSocket(wsUrl());
    NET.ws = ws;
    ws.addEventListener('open', () => {
      NET.connected = true;
      NET.pingInterval = setInterval(() => netSend({ type: 'PING', t: Date.now() }), 20000);
      if (NET.onOpen) NET.onOpen();
      resolve();
    });
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      handleNetMessage(m);
    });
    ws.addEventListener('close', () => {
      NET.connected = false;
      if (NET.pingInterval) { clearInterval(NET.pingInterval); NET.pingInterval = null; }
      if (NET.mode === 'online' && NET.roomCode && NET.sessionToken) {
        // Try to reconnect in 2s
        setTimeout(() => netReconnect(), 2000);
      }
    });
    ws.addEventListener('error', (e) => {
      if (NET.onError) NET.onError(e);
      reject(e);
    });
  });
}

async function netReconnect() {
  try {
    await netConnect();
    netSend({ type: 'JOIN_ROOM', code: NET.roomCode, sessionToken: NET.sessionToken });
  } catch (e) { /* will retry on next close */ }
}

function netSend(msg) {
  if (!NET.ws || NET.ws.readyState !== 1) return false;
  NET.ws.send(JSON.stringify(msg));
  return true;
}

function handleNetMessage(m) {
  console.log('[net] <-', m.type, m);
  switch (m.type) {
    case 'ROOM_STATE':
      NET.myColor = m.you;
      NET.roomCode = m.code;
      if (m.sessionToken) NET.sessionToken = m.sessionToken;
      // If the room is PLAYING, activate online mode exactly once (no double fire).
      if (NET.onRoomUpdate) NET.onRoomUpdate(m);
      // Only apply game state here when the room transitioned to PLAYING;
      // otherwise onRoomUpdate handles the lobby/waiting UI.
      if (m.status === 'PLAYING' && m.game && NET.onState) NET.onState(m);
      break;
    case 'GAME_STATE':
      if (NET.onState) NET.onState(m);
      break;
    case 'ERROR':
      console.error('[net] server error:', m.message);
      if (NET.onError) NET.onError(new Error(m.message || 'Server error'));
      break;
    case 'PONG':
      break;
    default:
      console.warn('[net] unknown type:', m.type);
  }
}

function netCreateRoom(name, timeMode) {
  NET.mode = 'online';
  netSend({ type: 'CREATE_ROOM', name, timeMode });
}

function netJoinRoom(code, name) {
  NET.mode = 'online';
  netSend({ type: 'JOIN_ROOM', code: code.toUpperCase(), name });
}

function netLeave() {
  netSend({ type: 'LEAVE_ROOM' });
  NET.mode = 'hotseat';
  NET.myColor = null;
  NET.roomCode = null;
  NET.sessionToken = null;
}

// Helpers for action sending
function netSendMove(from, to, promotion) {
  netSend({ type: 'MOVE', payload: { from, to, promotion } });
}
function netSendSacrifice(r, c) {
  netSend({ type: 'SACRIFICE', payload: { r, c } });
}
function netSendPower(power, args) {
  netSend({ type: 'POWER_CAST', payload: { power, ...args } });
}
function netSendResign() {
  netSend({ type: 'RESIGN', payload: {} });
}

// Export for browser
(function () {
  const g = (typeof window !== 'undefined') ? window : globalThis;
  Object.assign(g, {
    NET, netConnect, netSend, netCreateRoom, netJoinRoom, netLeave,
    netSendMove, netSendSacrifice, netSendPower, netSendResign
  });
})();
