// ============================================================
// NOVA GAMBIT - Client-side auth (signup, login, session state)
// ============================================================
// Exposes: AUTH (global), auth() helpers on window. Keeps the JWT in
// localStorage under 'ng_auth'. Falls back gracefully when the server
// returns 503 (DB/JWT not configured) — the UI still works anonymously.

const AUTH = {
  token: null,
  user: null,   // { id, email, displayName, createdAt }
  onChange: null
};

const AUTH_STORAGE_KEY = 'ng_auth';

function loadAuthFromStorage() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    AUTH.token = parsed.token || null;
    AUTH.user = parsed.user || null;
  } catch {}
}

function saveAuth() {
  if (AUTH.token && AUTH.user) {
    try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: AUTH.token, user: AUTH.user })); } catch {}
  } else {
    try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
  }
}

function authHeaders() {
  return AUTH.token ? { 'Authorization': `Bearer ${AUTH.token}` } : {};
}

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) };
  const res = await fetch(path, { ...opts, headers });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, ok: res.ok, body: body || {} };
}

async function authSignup(email, password, displayName) {
  const r = await apiFetch('/api/signup', { method: 'POST', body: JSON.stringify({ email, password, displayName }) });
  if (!r.ok) return { error: r.body.error || `Signup failed (${r.status})` };
  AUTH.token = r.body.token;
  AUTH.user = r.body.user;
  saveAuth();
  if (AUTH.onChange) AUTH.onChange();
  return { user: AUTH.user };
}

async function authLogin(email, password) {
  const r = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!r.ok) return { error: r.body.error || `Login failed (${r.status})` };
  AUTH.token = r.body.token;
  AUTH.user = r.body.user;
  saveAuth();
  if (AUTH.onChange) AUTH.onChange();
  return { user: AUTH.user };
}

async function authRefresh() {
  if (!AUTH.token) return false;
  const r = await apiFetch('/api/me');
  if (!r.ok) { authLogout(); return false; }
  AUTH.user = r.body.user;
  saveAuth();
  if (AUTH.onChange) AUTH.onChange();
  return true;
}

function authLogout() {
  AUTH.token = null;
  AUTH.user = null;
  saveAuth();
  if (AUTH.onChange) AUTH.onChange();
}

function authIsLoggedIn() { return !!AUTH.token && !!AUTH.user; }

loadAuthFromStorage();
// Validate stored token against server (non-blocking). If invalid, drop it.
if (AUTH.token) { authRefresh().catch(() => {}); }

(function () {
  const g = (typeof window !== 'undefined') ? window : globalThis;
  Object.assign(g, { AUTH, authSignup, authLogin, authLogout, authRefresh, authIsLoggedIn, apiFetch });
})();
