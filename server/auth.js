// ============================================================
// NOVA GAMBIT - Auth (signup, login, JWT issue/verify)
// ============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = '30d';
const BCRYPT_ROUNDS = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authEnabled() {
  return db.isEnabled() && !!JWT_SECRET;
}

function validateSignup(body) {
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const displayName = (body.displayName || '').trim();
  if (!EMAIL_RE.test(email)) return { error: 'Invalid email' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters' };
  if (displayName.length < 1 || displayName.length > 30) return { error: 'Display name must be 1–30 characters' };
  return { email, password, displayName };
}

async function signup(body) {
  if (!authEnabled()) return { status: 503, error: 'Accounts disabled on this server' };
  const v = validateSignup(body);
  if (v.error) return { status: 400, error: v.error };
  const hash = await bcrypt.hash(v.password, BCRYPT_ROUNDS);
  try {
    const { rows } = await db.q(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name, created_at',
      [v.email, hash, v.displayName]
    );
    const user = rows[0];
    const token = jwt.sign({ sub: user.id, name: user.display_name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return { status: 200, body: { token, user: publicUser(user) } };
  } catch (e) {
    if (e.code === '23505') return { status: 409, error: 'Email already registered' };
    console.error('[auth] signup error', e);
    return { status: 500, error: 'Signup failed' };
  }
}

async function login(body) {
  if (!authEnabled()) return { status: 503, error: 'Accounts disabled on this server' };
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return { status: 400, error: 'Email and password required' };
  try {
    const { rows } = await db.q('SELECT id, email, password_hash, display_name, created_at FROM users WHERE email = $1', [email]);
    if (rows.length === 0) return { status: 401, error: 'Invalid credentials' };
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return { status: 401, error: 'Invalid credentials' };
    const token = jwt.sign({ sub: user.id, name: user.display_name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return { status: 200, body: { token, user: publicUser(user) } };
  } catch (e) {
    console.error('[auth] login error', e);
    return { status: 500, error: 'Login failed' };
  }
}

async function me(token) {
  if (!authEnabled()) return { status: 503, error: 'Accounts disabled on this server' };
  const claims = verifyToken(token);
  if (!claims) return { status: 401, error: 'Invalid token' };
  try {
    const { rows } = await db.q('SELECT id, email, display_name, created_at FROM users WHERE id = $1', [claims.sub]);
    if (rows.length === 0) return { status: 401, error: 'User gone' };
    return { status: 200, body: { user: publicUser(rows[0]) } };
  } catch (e) {
    console.error('[auth] me error', e);
    return { status: 500, error: 'Lookup failed' };
  }
}

function verifyToken(token) {
  if (!token || !JWT_SECRET) return null;
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

function publicUser(row) {
  return { id: row.id, email: row.email, displayName: row.display_name, createdAt: row.created_at };
}

function extractBearer(req) {
  const h = req.headers['authorization'] || '';
  const [scheme, token] = h.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

module.exports = { signup, login, me, verifyToken, extractBearer, authEnabled };
