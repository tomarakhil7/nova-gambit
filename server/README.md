# NOVA Gambit — Multiplayer Server

A single Node process that serves the web client **and** the WebSocket game server on one port.

## Local run

```bash
cd server
npm install
npm start
# → http://localhost:8765
```

Open two browser tabs:
- Tab 1: click **🌐 Play Online → Create Room** → copy the 5-char code
- Tab 2: click **🌐 Play Online → Join Room** → paste the code

## Test

```bash
# Full test suite (engine + multiplayer E2E)
npm test
```

## Deploy

The server serves the static client from `../game`, so you deploy the whole repo as one unit.

### Fly.io

```bash
fly launch --dockerfile server/Dockerfile --copy-config
fly deploy
```

`fly.toml` is pre-configured with:
- Auto-stop/start on idle
- Health check at `/health`
- 256 MB shared CPU (sufficient for a few hundred concurrent games)

### Railway / Render / any Docker host

1. Build image: `docker build -f server/Dockerfile -t nova-gambit .`
2. Run: `docker run -p 8765:8765 nova-gambit`

### Heroku-style (Procfile)

```bash
# From the server/ directory:
git init && git add .
heroku create nova-gambit
git commit -m "deploy" && git push heroku main
```

Set the static dir env if needed; the server reads `CLIENT_DIR` relative to its own location.

## Environment

| Var   | Default | Meaning |
|---|---|---|
| `PORT`  | 8765  | HTTP + WS port |

## Architecture

- **Server-authoritative**: all game logic runs server-side using the same `mana-system.js` the client uses for hotseat. Clients only send intents (MOVE, POWER_CAST, SACRIFICE); server validates, broadcasts state.
- **In-memory rooms**: rooms live in a `Map` keyed by 5-char code. Scale to Redis if you ever need multi-process.
- **Reconnect**: server keeps a player seat alive for 60s after disconnect. Client stores a session token and retries on close.
- **Rate limit**: 30 msgs / 10s per socket.
- **Idle rooms**: evicted after 10 minutes of no activity (only `WAITING` / `FINISHED` rooms, never mid-game).

## Protocol

See `PROTOCOL.md` — every client-side message type and expected server response is documented there.
