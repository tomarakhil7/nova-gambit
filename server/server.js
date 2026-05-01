// ============================================================
// NOVA GAMBIT - Multiplayer Server
// Serves static client + WebSocket game server on one port.
// ============================================================

console.log('[boot] starting NOVA Gambit server');
console.log('[boot] node', process.version, 'cwd', process.cwd());

const http = require('http');
const fs = require('fs');
const path = require('path');
console.log('[boot] loading ws...');
const { WebSocketServer } = require('ws');
console.log('[boot] ws loaded');
const crypto = require('crypto');

console.log('[boot] loading game engine...');
const ENGINE_PATH = path.resolve(__dirname, '..', 'game', 'js', 'chess-engine.js');
const MANA_PATH = path.resolve(__dirname, '..', 'game', 'js', 'mana-system.js');
console.log('[boot] engine path:', ENGINE_PATH, 'exists?', fs.existsSync(ENGINE_PATH));
console.log('[boot] mana path:', MANA_PATH, 'exists?', fs.existsSync(MANA_PATH));
const engine = require(ENGINE_PATH);
const mana = require(MANA_PATH);
console.log('[boot] engine loaded, mana exports:', Object.keys(mana).slice(0, 5).join(','), '…');

console.log('[boot] loading db...');
const db = require('./db');

const PORT = process.env.PORT || 8765;
const CLIENT_DIR = path.join(__dirname, '..', 'game');
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
const ROOM_CODE_LEN = 5;
const DISCONNECT_GRACE_MS = 120_000;  // 2 minutes — absorb backgrounded-tab gaps
const IDLE_ROOM_TTL_MS = 10 * 60_000;
const RATE_LIMIT = { WINDOW_MS: 10_000, MAX: 30 };

const TIME_CONTROLS = {
  blitz:     { base: 180, increment: 2 },
  rapid:     { base: 600, increment: 5 },
  classical: { base: 900, increment: 10 },
  untimed:   { base: 0,   increment: 0 }
};

// ---------- Static file serving ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon'
};

function serveStatic(req, res) {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, uptime: process.uptime() }));
    return;
  }
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  // Prevent path traversal
  const safe = path.normalize(path.join(CLIENT_DIR, urlPath));
  if (!safe.startsWith(CLIENT_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(safe, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(safe).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(safe).pipe(res);
  });
}

// ---------- Room model ----------
/**
 * Room: {
 *   code, timeMode, status: 'WAITING'|'PLAYING'|'FINISHED',
 *   players: { w: Player|null, b: Player|null },
 *   spectators: Set<Player>,
 *   state: <engine state>,
 *   clock: { white, black, activeColor, lastTickTime, intervalId, paused },
 *   createdAt, lastActivity,
 *   disconnectTimers: { w?, b? }
 * }
 */
/** Player: { ws, id, name, color, sessionToken, connected } */

const rooms = new Map();      // code -> room
const socketToPlayer = new WeakMap(); // ws -> {roomCode, color, sessionToken}

function generateRoomCode() {
  while (true) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LEN; i++) {
      code += ROOM_CODE_CHARS[crypto.randomInt(0, ROOM_CODE_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
}

function publicPlayer(p) {
  if (!p) return null;
  return { name: p.name, connected: p.connected };
}

function stripStateForWire(state) {
  // Strip bulky fields
  const { history, log, ...rest } = state;
  return {
    ...rest,
    log: (log || []).slice(-30)
  };
}

function broadcastRoomState(room, extra = {}) {
  const msg = {
    type: 'ROOM_STATE',
    code: room.code,
    status: room.status,
    timeMode: room.timeMode,
    white: publicPlayer(room.players.w),
    black: publicPlayer(room.players.b),
    game: room.state ? stripStateForWire(room.state) : null,
    clock: room.clock ? { white: room.clock.white, black: room.clock.black, activeColor: room.clock.activeColor } : null,
    ...extra
  };
  for (const p of [room.players.w, room.players.b, ...room.spectators]) {
    if (!p || !p.ws || p.ws.readyState !== 1) continue;
    const personal = { ...msg, you: p.color };
    p.ws.send(JSON.stringify(personal));
  }
}

function sendGameState(room, lastAction = null) {
  for (const p of [room.players.w, room.players.b, ...room.spectators]) {
    if (!p || !p.ws || p.ws.readyState !== 1) continue;
    p.ws.send(JSON.stringify({
      type: 'GAME_STATE',
      state: stripStateForWire(room.state),
      clock: room.clock ? { white: room.clock.white, black: room.clock.black, activeColor: room.clock.activeColor } : null,
      lastAction
    }));
  }
}

function sendError(ws, message, code = null) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ERROR', message, code }));
}

// ---------- Clock (server-authoritative) ----------
function startClock(room) {
  if (room.clock.intervalId || !room.clock.running) return;
  room.clock.lastTickTime = Date.now();
  room.clock.intervalId = setInterval(() => tickClock(room), 500);
}
function stopClock(room) {
  if (room.clock.intervalId) { clearInterval(room.clock.intervalId); room.clock.intervalId = null; }
}
function tickClock(room) {
  if (!room.clock.running || room.clock.paused || room.state.winner) return;
  const now = Date.now();
  const elapsed = (now - room.clock.lastTickTime) / 1000;
  room.clock.lastTickTime = now;
  const key = room.clock.activeColor === 'w' ? 'white' : 'black';
  room.clock[key] -= elapsed;
  if (room.clock[key] <= 0) {
    room.clock[key] = 0;
    room.state.winner = room.clock.activeColor === 'w' ? 'b' : 'w';
    room.state.winReason = 'TIMEOUT';
    room.state.log.push(`${room.clock.activeColor === 'w' ? 'White' : 'Black'} ran out of time`);
    room.status = 'FINISHED';
    stopClock(room);
    sendGameState(room, { type: 'TIMEOUT' });
  }
}
function switchClockTo(room, color) {
  const tc = TIME_CONTROLS[room.timeMode];
  if (!tc || tc.base === 0) return;
  const finished = room.clock.activeColor === 'w' ? 'white' : 'black';
  room.clock[finished] += tc.increment;
  room.clock.activeColor = color;
  room.clock.lastTickTime = Date.now();
}
function initClock(room) {
  const tc = TIME_CONTROLS[room.timeMode] || TIME_CONTROLS.classical;
  room.clock = {
    white: tc.base, black: tc.base,
    activeColor: 'w',
    running: tc.base > 0,
    paused: false,
    intervalId: null,
    lastTickTime: Date.now()
  };
}

// ---------- Action handlers (server validates via engine) ----------
function actionRequiresOwnerTurn(room, color) {
  if (!room.state || room.status !== 'PLAYING') return 'Game not in progress';
  if (room.state.winner) return 'Game is over';
  if (color !== room.state.turn) return 'Not your turn';
  return null;
}

function applyAction(room, color, action) {
  const err = actionRequiresOwnerTurn(room, color);
  if (err) return { error: err };

  const { type, payload } = action;
  const s = room.state;
  let result;

  switch (type) {
    case 'MOVE':
      result = mana.makeMove(s, payload.from.r, payload.from.c, payload.to.r, payload.to.c, payload.promotion);
      break;
    case 'SACRIFICE':
      result = mana.sacrificePiece(s, payload.r, payload.c);
      break;
    case 'POWER_CAST': {
      const p = payload.power;
      switch (p) {
        case 'FROST':           result = mana.castFrost(s, payload.r, payload.c); break;
        case 'FORTIFY':         result = mana.castFortify(s, payload.r, payload.c); break;
        case 'BLINK':           result = mana.castBlink(s, payload.from.r, payload.from.c, payload.to.r, payload.to.c); break;
        case 'SPAWN':           result = mana.castSpawn(s, payload.r, payload.c); break;
        case 'GHOST':           result = mana.castGhostMove(s, payload.from.r, payload.from.c, payload.to.r, payload.to.c); break;
        case 'BOMBA':           result = mana.castBomba(s, payload.r, payload.c); break;
        case 'CHAIN_LIGHTNING': result = mana.castChainLightning(s, payload.from.r, payload.from.c, payload.to.r, payload.to.c, payload.jump.r, payload.jump.c); break;
        case 'IMPRISON':        result = mana.castImprison(s, payload.captor.r, payload.captor.c, payload.captive.r, payload.captive.c); break;
        case 'AETHER_BLOCK':    result = mana.castAetherBlock(s); break;
        case 'PROMOTE':         result = mana.castPromote(s, payload.r, payload.c, payload.newType); break;
        case 'CHRONOBREAK':     result = mana.castChronobreak(s); break;
        case 'VENGEANCE':       result = mana.castVengeance(s, payload.r, payload.c); break;
        case 'WALL':            result = mana.castWall(s, payload.r, payload.c); break;
        default: return { error: 'Unknown power: ' + p };
      }
      break;
    }
    case 'RESIGN':
      s.winner = color === 'w' ? 'b' : 'w';
      s.winReason = 'RESIGNATION';
      s.log.push(`${color === 'w' ? 'White' : 'Black'} resigned`);
      result = { success: true };
      break;
    default:
      return { error: 'Unknown action type' };
  }

  // If action ended the turn (state.turn changed from action color), switch clock.
  if (result && result.success && s.turn !== color && !s.winner) {
    switchClockTo(room, s.turn);
  }

  if (s.winner) {
    room.status = 'FINISHED';
    stopClock(room);
  }

  return result;
}

// ---------- Connection handlers ----------
function handleCreateRoom(ws, msg) {
  const code = generateRoomCode();
  const timeMode = TIME_CONTROLS[msg.timeMode] ? msg.timeMode : 'classical';
  const sessionToken = crypto.randomBytes(16).toString('hex');
  const player = { ws, name: (msg.name || 'Player').slice(0, 20), color: 'w', sessionToken, connected: true };
  const room = {
    code, timeMode, status: 'WAITING',
    players: { w: player, b: null },
    spectators: new Set(),
    state: null, clock: null,
    createdAt: Date.now(), lastActivity: Date.now(),
    disconnectTimers: {}
  };
  rooms.set(code, room);
  socketToPlayer.set(ws, { roomCode: code, color: 'w', sessionToken });
  ws.send(JSON.stringify({ type: 'ROOM_STATE', you: 'w', code, status: 'WAITING',
    timeMode, white: publicPlayer(player), black: null, sessionToken }));
}

function handleJoinRoom(ws, msg) {
  const code = (msg.code || '').toUpperCase();
  const room = rooms.get(code);
  if (!room) return sendError(ws, 'Room not found', 'ROOM_NOT_FOUND');

  // Reconnection via session token?
  if (msg.sessionToken) {
    for (const color of ['w', 'b']) {
      const p = room.players[color];
      if (p && p.sessionToken === msg.sessionToken) {
        // Resume
        if (room.disconnectTimers[color]) { clearTimeout(room.disconnectTimers[color]); delete room.disconnectTimers[color]; }
        p.ws = ws;
        p.connected = true;
        p.name = (msg.name || p.name).slice(0, 20);
        socketToPlayer.set(ws, { roomCode: code, color, sessionToken: p.sessionToken });
        broadcastRoomState(room, { event: 'RECONNECTED', color });
        return;
      }
    }
  }

  // New join as Black (if empty) or spectator
  if (!room.players.b) {
    const sessionToken = crypto.randomBytes(16).toString('hex');
    const player = { ws, name: (msg.name || 'Player').slice(0, 20), color: 'b', sessionToken, connected: true };
    room.players.b = player;
    socketToPlayer.set(ws, { roomCode: code, color: 'b', sessionToken });

    // Start the game
    room.state = mana.initGame();
    initClock(room);
    room.status = 'PLAYING';
    if (room.clock.running) startClock(room);

    ws.send(JSON.stringify({ type: 'ROOM_STATE', you: 'b', code, status: 'PLAYING',
      timeMode: room.timeMode, white: publicPlayer(room.players.w), black: publicPlayer(player),
      sessionToken, game: stripStateForWire(room.state),
      clock: { white: room.clock.white, black: room.clock.black, activeColor: room.clock.activeColor }
    }));
    broadcastRoomState(room, { event: 'STARTED' });
  } else {
    // Spectator
    const spectator = { ws, name: (msg.name || 'Spectator').slice(0, 20), color: 's', connected: true };
    room.spectators.add(spectator);
    socketToPlayer.set(ws, { roomCode: code, color: 's', spectator });
    broadcastRoomState(room);
  }
  room.lastActivity = Date.now();
}

function handleLeaveRoom(ws) {
  const info = socketToPlayer.get(ws);
  if (!info) return;
  const room = rooms.get(info.roomCode);
  if (!room) return;
  if (info.color === 's') {
    // Find and remove spectator
    for (const s of room.spectators) if (s.ws === ws) room.spectators.delete(s);
  } else {
    const p = room.players[info.color];
    if (p) p.connected = false;
    // Grace period for reconnect
    room.disconnectTimers[info.color] = setTimeout(() => {
      // Abandon if still gone
      if (p && !p.connected) {
        if (room.status === 'PLAYING' && !room.state.winner) {
          room.state.winner = info.color === 'w' ? 'b' : 'w';
          room.state.winReason = 'DISCONNECT';
          room.state.log.push(`${info.color === 'w' ? 'White' : 'Black'} abandoned the game`);
          room.status = 'FINISHED';
          stopClock(room);
          sendGameState(room, { type: 'ABANDON' });
        }
        delete room.disconnectTimers[info.color];
      }
    }, DISCONNECT_GRACE_MS);
    broadcastRoomState(room, { event: 'DISCONNECTED', color: info.color });
  }
  socketToPlayer.delete(ws);
}

function handleAction(ws, msg) {
  const info = socketToPlayer.get(ws);
  if (!info) return sendError(ws, 'Not in a room', 'NO_ROOM');
  const room = rooms.get(info.roomCode);
  if (!room) return sendError(ws, 'Room gone', 'ROOM_GONE');
  if (info.color === 's') return sendError(ws, 'Spectators cannot act', 'SPECTATOR');

  const result = applyAction(room, info.color, msg);
  if (result.error) return sendError(ws, result.error, 'ACTION_REJECTED');

  room.lastActivity = Date.now();
  sendGameState(room, { type: msg.type, payload: msg.payload, by: info.color });
}

// ---------- WebSocket server ----------
const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws._rateBucket = { count: 0, reset: Date.now() + RATE_LIMIT.WINDOW_MS };
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    // Rate limit
    const now = Date.now();
    if (now > ws._rateBucket.reset) { ws._rateBucket.count = 0; ws._rateBucket.reset = now + RATE_LIMIT.WINDOW_MS; }
    if (++ws._rateBucket.count > RATE_LIMIT.MAX) {
      sendError(ws, 'Rate limit exceeded');
      ws.close(1008, 'rate limit');
      return;
    }

    let msg;
    try { msg = JSON.parse(raw); } catch { return sendError(ws, 'Invalid JSON'); }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      return sendError(ws, 'Malformed message');
    }

    try {
      switch (msg.type) {
        case 'PING':         ws.send(JSON.stringify({ type: 'PONG', t: msg.t })); break;
        case 'CREATE_ROOM':  handleCreateRoom(ws, msg); break;
        case 'JOIN_ROOM':    handleJoinRoom(ws, msg); break;
        case 'LEAVE_ROOM':   handleLeaveRoom(ws); break;
        case 'MOVE':
        case 'SACRIFICE':
        case 'POWER_CAST':
        case 'RESIGN':       handleAction(ws, msg); break;
        default: sendError(ws, 'Unknown type: ' + msg.type);
      }
    } catch (e) {
      console.error('Handler error:', e);
      sendError(ws, 'Server error');
    }
  });

  ws.on('close', () => handleLeaveRoom(ws));
  ws.on('error', (e) => console.error('WS error:', e.message));
});

// WebSocket heartbeat: ping every 30s, terminate sockets that didn't pong back.
// This lets us detect half-open connections (idle browser, flaky network) and
// fire the close handler so the disconnect-grace timer can start.
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} return; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  });
}, 30_000).unref?.();

// Reap idle rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > IDLE_ROOM_TTL_MS && room.status !== 'PLAYING') {
      stopClock(room);
      rooms.delete(code);
    }
  }
}, 60_000).unref?.();

// Bind to 0.0.0.0 explicitly so cloud hosts (Railway, Fly, Render) can reach the process.
const HOST = process.env.HOST || '0.0.0.0';

// Initialize DB before starting the HTTP server so migrations run first.
// DB init failures do NOT block startup — the server runs in no-auth mode instead.
db.init().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`✦ NOVA Gambit server listening on ${HOST}:${PORT}`);
    console.log(`  Game:   http://${HOST}:${PORT}/`);
    console.log(`  WS:     ws://${HOST}:${PORT}/ws`);
    console.log(`  Health: http://${HOST}:${PORT}/health`);
    console.log(`  DB:     ${db.isEnabled() ? 'connected' : 'disabled (DATABASE_URL not set)'}`);
  });
});

// Surface unhandled errors so cloud logs show the real reason for a crash
process.on('uncaughtException', (e) => console.error('uncaughtException:', e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));
