# NOVA Gambit — WebSocket Protocol v1

All messages are JSON-encoded strings. Each has a `type` field.

## Client → Server

| type | payload | notes |
|---|---|---|
| `CREATE_ROOM` | `{ name, timeMode }` | Creates a room, server returns ROOM_STATE with assigned color=white |
| `JOIN_ROOM`   | `{ code, name }` | Joins an existing room as black (if empty) or spectator |
| `LEAVE_ROOM`  | `{}` | Leaves current room |
| `MOVE`        | `{ from:{r,c}, to:{r,c}, promotion?: 'Q'|'R'|'B'|'N' }` | Standard chess move |
| `POWER_CAST`  | `{ power, ...args }` | See power-specific args below |
| `SACRIFICE`   | `{ r, c }` | Sacrifice own piece for aether |
| `RESIGN`      | `{}` | Forfeit |
| `PING`        | `{ t }` | Heartbeat, server echoes PONG |

### Power cast args

```
FROST:           { r, c }
FORTIFY:         { r, c }
BLINK:           { from:{r,c}, to:{r,c} }
SPAWN:           { r, c }
GHOST:           { from:{r,c}, to:{r,c} }          // Ghost-move in one action
BOMBA:           { r, c }
CHAIN_LIGHTNING: { from:{r,c}, to:{r,c}, jump:{r,c} }
IMPRISON:        { captor:{r,c}, captive:{r,c} }
AETHER_BLOCK:    {}
PROMOTE:         { r, c, newType: 'Q'|'R'|'B'|'N' }
CHRONOBREAK:     {}
VENGEANCE:       { r, c }
WALL:            { r, c }
```

## Server → Client

| type | payload |
|---|---|
| `ROOM_STATE`   | `{ code, you:'w'|'b'|'s', white:{name,connected}, black:{name,connected}, status:'WAITING'|'PLAYING'|'FINISHED', game?: <full state JSON> }` |
| `GAME_STATE`   | `{ state: <full state JSON>, lastAction: {type, ...} }` |
| `ERROR`        | `{ message, code? }` |
| `OPPONENT_LEFT`| `{}` |
| `OPPONENT_BACK`| `{}` |
| `PONG`         | `{ t }` |

`<full state JSON>` is the engine state with `history` stripped (too large to sync every time).

## Flow

1. Client connects via WS to `/ws`.
2. Sends `CREATE_ROOM` or `JOIN_ROOM`.
3. Receives `ROOM_STATE` with assigned color. If room now has 2 players, status becomes `PLAYING`.
4. On each turn, active player sends `MOVE` / `POWER_CAST` / `SACRIFICE`.
5. Server validates via engine, broadcasts `GAME_STATE` to both clients (and spectators).
6. On disconnect, server keeps room alive for 60s and marks that color as disconnected. If opponent reconnects with `JOIN_ROOM` (same code + stored session), they resume.

## Security

- Server is authoritative. It re-runs every move/power through the engine.
- Rate limit: 30 messages / 10 seconds per connection. Violators are dropped.
- Timeout loss: if active player's clock hits 0, server auto-ends the game.
