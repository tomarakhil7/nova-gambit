// ============================================================
// NOVA GAMBIT - Postgres connection + schema migrations
// ============================================================
// Uses a single DATABASE_URL env var (Railway's default for its Postgres plugin).
// If DATABASE_URL is unset, the server runs in "no-auth, no-history" mode:
// features that require the DB are gracefully disabled and anonymous online play
// still works. This keeps local dev and pre-provisioning deploys functional.

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';

let pool = null;
let ready = false;
let disabled = !DATABASE_URL;

if (!disabled) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    // Railway's managed Postgres requires TLS; allow self-signed (their proxy)
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
  pool.on('error', (err) => console.error('[db] idle client error', err));
}

// ---------- Schema ----------
// Single forward-only migration list. Each entry runs in its own transaction.
// To add a new migration: append to this array. Never edit or reorder existing entries.
const MIGRATIONS = [
  {
    name: '001_initial',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        white_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        black_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        white_name TEXT NOT NULL,
        black_name TEXT NOT NULL,
        result TEXT NOT NULL,        -- 'WHITE' | 'BLACK' | 'DRAW'
        win_reason TEXT,             -- CHECKMATE | TIMEOUT | RESIGNATION | DISCONNECT | STALEMATE | AETHER_STALEMATE_WIN
        time_mode TEXT NOT NULL,
        room_code TEXT NOT NULL,
        actions JSONB NOT NULL,      -- full action log (moves + power casts + sacrifices)
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS games_white_user_id_idx ON games(white_user_id);
      CREATE INDEX IF NOT EXISTS games_black_user_id_idx ON games(black_user_id);
      CREATE INDEX IF NOT EXISTS games_ended_at_idx ON games(ended_at DESC);
    `
  }
];

async function runMigrations() {
  if (disabled) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map(r => r.name));
    for (const m of MIGRATIONS) {
      if (applied.has(m.name)) continue;
      console.log('[db] applying migration', m.name);
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [m.name]);
        await client.query('COMMIT');
        console.log('[db] migration', m.name, 'applied');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    client.release();
  }
}

async function init() {
  if (disabled) {
    console.log('[db] DATABASE_URL not set — running without accounts/history');
    return false;
  }
  try {
    await pool.query('SELECT 1');
    await runMigrations();
    ready = true;
    console.log('[db] connected and migrated');
    return true;
  } catch (e) {
    console.error('[db] init failed:', e.message);
    disabled = true; // fall back to no-DB mode so the server still boots
    return false;
  }
}

function q(text, params) {
  if (!ready) throw new Error('Database not ready');
  return pool.query(text, params);
}

function isEnabled() { return ready && !disabled; }

module.exports = { init, q, isEnabled, pool };
