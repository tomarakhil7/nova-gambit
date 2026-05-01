// ============================================================
// NOVA GAMBIT - Game persistence (writing + reading completed games)
// ============================================================

const db = require('./db');

// Called once when a room transitions to FINISHED. Idempotent via room.persisted flag.
async function persistFinishedGame(room) {
  if (!db.isEnabled()) return;
  if (!room || room.persisted) return;
  if (!room.state || !room.state.winner) return;
  room.persisted = true;   // set synchronously so concurrent callers don't double-insert
  try {
    const white = room.players.w || {};
    const black = room.players.b || {};
    const winner = room.state.winner;                  // 'w' | 'b' | 'DRAW'
    const result = winner === 'w' ? 'WHITE' : winner === 'b' ? 'BLACK' : 'DRAW';
    const winReason = room.state.winReason || null;
    const actions = room.actionLog || [];
    const startedAt = room.startedAt ? new Date(room.startedAt) : new Date();

    await db.q(
      `INSERT INTO games
         (white_user_id, black_user_id, white_name, black_name,
          result, win_reason, time_mode, room_code, actions, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        white.userId || null,
        black.userId || null,
        (white.name || 'White').slice(0, 50),
        (black.name || 'Black').slice(0, 50),
        result, winReason, room.timeMode, room.code,
        JSON.stringify(actions), startedAt
      ]
    );
    console.log(`[games] persisted room ${room.code} (result=${result}, reason=${winReason})`);
  } catch (e) {
    console.error('[games] persist failed for', room.code, e.message);
    // Clear the flag so a retry is possible if a caller wants to
    room.persisted = false;
  }
}

// Fetch games for the current user (either color), newest first. Caps at `limit`.
async function listGamesForUser(userId, limit = 50) {
  if (!db.isEnabled()) return [];
  const { rows } = await db.q(
    `SELECT id, white_user_id, black_user_id, white_name, black_name,
            result, win_reason, time_mode, room_code, started_at, ended_at
       FROM games
      WHERE white_user_id = $1 OR black_user_id = $1
      ORDER BY ended_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return rows.map(toPublic);
}

// Fetch one game (with actions) if the requesting user participated. Returns null otherwise.
async function getGameForUser(gameId, userId) {
  if (!db.isEnabled()) return null;
  const { rows } = await db.q(
    `SELECT id, white_user_id, black_user_id, white_name, black_name,
            result, win_reason, time_mode, room_code, actions, started_at, ended_at
       FROM games
      WHERE id = $1 AND (white_user_id = $2 OR black_user_id = $2)`,
    [gameId, userId]
  );
  if (!rows.length) return null;
  return toPublicWithActions(rows[0]);
}

function toPublic(row) {
  return {
    id: row.id,
    whiteUserId: row.white_user_id,
    blackUserId: row.black_user_id,
    whiteName: row.white_name,
    blackName: row.black_name,
    result: row.result,
    winReason: row.win_reason,
    timeMode: row.time_mode,
    roomCode: row.room_code,
    startedAt: row.started_at,
    endedAt: row.ended_at
  };
}

function toPublicWithActions(row) {
  return { ...toPublic(row), actions: row.actions };
}

module.exports = { persistFinishedGame, listGamesForUser, getGameForUser };
