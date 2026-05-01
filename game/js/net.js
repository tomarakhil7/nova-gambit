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
  reconnectTimer: null,
  reconnectAttempt: 0,
  onOpen: null,
  onState: null,
  onError: null,
  onRoomUpdate: null,
  onStatusChange: null,      // optional: notify UI of 'connecting'|'connected'|'disconnected'
  onRoomExpired: null        // optional: notify UI when server lost our room (e.g. redeploy)
};

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function netStatus(state) {
  if (NET.onStatusChange) NET.onStatusChange(state);
}

function netConnect() {
  return new Promise((resolve, reject) => {
    if (NET.ws && NET.ws.readyState === 1) return resolve();
    if (NET.ws && NET.ws.readyState === 0) {
      // Connection already in progress — piggy-back.
      NET.ws.addEventListener('open', () => resolve(), { once: true });
      NET.ws.addEventListener('error', (e) => reject(e), { once: true });
      return;
    }
    netStatus('connecting');
    const ws = new WebSocket(wsUrl());
    NET.ws = ws;
    ws.addEventListener('open', () => {
      NET.connected = true;
      NET.reconnectAttempt = 0;
      netStatus('connected');
      // Heartbeat. Use 15s so we stay well within common 60-100s proxy idle windows.
      NET.pingInterval = setInterval(() => netSend({ type: 'PING', t: Date.now() }), 15000);
      if (NET.onOpen) NET.onOpen();
      resolve();
    });
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      handleNetMessage(m);
    });
    ws.addEventListener('close', () => {
      NET.connected = false;
      netStatus('disconnected');
      if (NET.pingInterval) { clearInterval(NET.pingInterval); NET.pingInterval = null; }
      if (NET.mode === 'online' && NET.roomCode && NET.sessionToken) {
        scheduleReconnect();
      }
    });
    ws.addEventListener('error', (e) => {
      // Browsers surface errors as an 'error' event with no useful message.
      console.warn('[net] ws error (will retry on close)', e);
      // Do NOT reject here — 'close' will fire immediately after and drive reconnect.
      // Only reject if the socket never opened in the first place.
      if (ws.readyState !== 1) {
        try { reject(new Error('Connection failed')); } catch {}
      }
    });
  });
}

function scheduleReconnect() {
  if (NET.reconnectTimer) return; // already scheduled
  // Exponential backoff: 0, 500ms, 1s, 2s, 4s, 8s (cap).
  const delays = [0, 500, 1000, 2000, 4000, 8000];
  const delay = delays[Math.min(NET.reconnectAttempt, delays.length - 1)];
  NET.reconnectAttempt += 1;
  NET.reconnectTimer = setTimeout(() => {
    NET.reconnectTimer = null;
    netReconnect();
  }, delay);
}

async function netReconnect() {
  if (NET.mode !== 'online' || !NET.roomCode || !NET.sessionToken) return;
  try {
    await netConnect();
    netSend({ type: 'JOIN_ROOM', code: NET.roomCode, sessionToken: NET.sessionToken });
  } catch (e) {
    // Will retry via the close handler that fires after failed connect.
    scheduleReconnect();
  }
}

// Wake-up handling: when the tab becomes visible, force an immediate reconnect if the
// socket is dead. Browsers heavily throttle setInterval/setTimeout in background tabs,
// so a scheduled reconnect may not fire promptly; visibilitychange is not throttled.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (NET.mode !== 'online' || !NET.roomCode || !NET.sessionToken) return;
    if (!NET.ws || NET.ws.readyState !== 1) {
      // Cancel any pending backoff — we want to reconnect right now.
      if (NET.reconnectTimer) { clearTimeout(NET.reconnectTimer); NET.reconnectTimer = null; }
      NET.reconnectAttempt = 0;
      netReconnect();
    }
  });
  window.addEventListener('online', () => {
    if (NET.mode === 'online' && (!NET.ws || NET.ws.readyState !== 1)) {
      if (NET.reconnectTimer) { clearTimeout(NET.reconnectTimer); NET.reconnectTimer = null; }
      NET.reconnectAttempt = 0;
      netReconnect();
    }
  });
}

function netSend(msg) {
  if (!NET.ws || NET.ws.readyState !== 1) {
    // Socket is dead. If we're supposed to be online, kick a reconnect and inform UI.
    if (NET.mode === 'online' && NET.roomCode && NET.sessionToken) {
      if (NET.onError) NET.onError(new Error('Reconnecting — please retry in a moment.'));
      if (!NET.reconnectTimer) {
        NET.reconnectAttempt = 0;
        netReconnect();
      }
    }
    return false;
  }
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
    case 'ERROR': {
      console.error('[net] server error:', m.code, m.message);
      // Terminal room errors: the server doesn't know this session / room anymore.
      // Most commonly: server restarted (redeploy) or the room timed out.
      // Stop reconnect loop and surface a clear "room expired" state.
      const TERMINAL = new Set(['NO_ROOM', 'ROOM_NOT_FOUND', 'ROOM_GONE']);
      if (TERMINAL.has(m.code)) {
        if (NET.reconnectTimer) { clearTimeout(NET.reconnectTimer); NET.reconnectTimer = null; }
        NET.reconnectAttempt = 0;
        const hadSession = !!NET.sessionToken;
        NET.mode = 'hotseat';
        NET.myColor = null;
        NET.roomCode = null;
        NET.sessionToken = null;
        try { if (NET.ws && NET.ws.readyState === 1) NET.ws.close(); } catch {}
        if (NET.onRoomExpired) NET.onRoomExpired({ hadSession });
        break;
      }
      if (NET.onError) NET.onError(new Error(m.message || 'Server error'));
      break;
    }
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
  if (NET.reconnectTimer) { clearTimeout(NET.reconnectTimer); NET.reconnectTimer = null; }
  NET.reconnectAttempt = 0;
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
