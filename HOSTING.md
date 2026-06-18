# Hosting NOVA Gambit — step-by-step

Multiplayer works by running `server/server.js`, which serves **both** the game client AND the WebSocket endpoint on one port. Deploy it anywhere Node.js runs.

## Pick a host

| Host | Free tier? | Difficulty | Setup time | Recommendation |
|---|---|---|---|---|
| **Railway** | Yes ($5 credit) | Easiest | 3 min | **Best for first deploy** |
| **Render** | Yes (free web service) | Easy | 5 min | Good alternative |
| **Fly.io** | Yes (limited) | Medium | 10 min | Most robust, auto-scale |
| **Your own VPS** | DIY | Hard | 30+ min | When you need full control |

---

## A — Railway (recommended first deploy)

1. Create an account at **https://railway.app** (sign in with GitHub).
2. Push this repo to GitHub. From the project root:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create nova-gambit --public --push --source=.
   ```
   (Or do it manually via the GitHub website — upload the folder as a new repo.)

3. In Railway: **New Project → Deploy from GitHub repo → select `nova-gambit`**.
4. Railway auto-detects the root `package.json`, installs deps via `postinstall`, and runs `npm start`. Done.
5. Click **Settings → Networking → Generate Domain**. You'll get something like `nova-gambit-production.up.railway.app`.
6. Open that URL in two browsers — multiplayer works globally.

### Environment variables
- `PORT` — Railway sets this automatically; the server reads it. No config needed.

### Health check
Railway polls `/health` by default. Already implemented.

---

## B — Render

1. **https://render.com** → New → Web Service → connect your GitHub.
2. Select the repo. Render will ask for build/start commands. Defaults work:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
3. Deploy. Render gives you a `*.onrender.com` URL.

### Note on free tier
Render's free tier sleeps after 15 minutes of inactivity. First request after sleep takes ~30 seconds. Use paid starter ($7/mo) for always-on.

---

## C — Fly.io

Most robust: auto-stop machines when idle (free), instant wake on request, global regions.

```bash
# Install flyctl once
curl -L https://fly.io/install.sh | sh

# From the repo root:
fly auth signup           # or: fly auth login
fly launch --no-deploy    # reads fly.toml, prompts for app name
fly deploy
fly open                  # opens the deployed URL
```

The existing `fly.toml` at the repo root is pre-configured with:
- Auto-stop/start on idle (free tier friendly)
- `/health` check every 30s
- 256 MB shared-CPU VM (handles a few hundred concurrent games)

If you want zero cold starts, change `min_machines_running = 0` to `1` in `fly.toml`.

---

## D — Self-hosted on a VPS (e.g. DigitalOcean $4/mo droplet)

```bash
# On your VPS, as root:
apt update && apt install -y nodejs npm nginx certbot python3-certbot-nginx
git clone https://github.com/YOU/nova-gambit.git /var/www/nova-gambit
cd /var/www/nova-gambit
npm install

# Run under a process manager so it restarts on crash:
npm install -g pm2
pm2 start server/server.js --name nova-gambit
pm2 startup && pm2 save

# Reverse-proxy with Nginx so you can terminate HTTPS:
cat > /etc/nginx/sites-available/nova-gambit <<'NGINX'
server {
  listen 80;
  server_name yourdomain.com;

  location / {
    proxy_pass http://localhost:8765;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
NGINX
ln -s /etc/nginx/sites-available/nova-gambit /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Then get SSL:
certbot --nginx -d yourdomain.com
```

The two critical Nginx lines (`Upgrade` + `Connection "upgrade"`) let WebSockets pass through.

---

## E — Quick "invite a friend" without deploying

If you don't want to host yet but want to test with someone:

### Cloudflared tunnel (free, 5 seconds)
```bash
brew install cloudflare/cloudflare/cloudflared
cloudflared tunnel --url http://localhost:8766
```

Gives you a `https://something-random.trycloudflare.com` URL that tunnels to your local server. Share it with anyone — they can play. Works while your Mac is awake. Close the tunnel when done.

### ngrok (similar)
```bash
brew install ngrok
ngrok http 8766
```

---

## What to check after deploy

```bash
# Replace YOUR_URL with your deployed URL
curl -s https://YOUR_URL/health
# Expected: {"ok":true,"rooms":0,"uptime":<seconds>}

# Then open the URL in two browsers and create/join a room.
```

## Troubleshooting

**"Sign-in disabled: server is missing DATABASE_URL and/or JWT_SECRET"**
- Your server can run without accounts (anonymous play still works), but sign-in requires two environment variables:
  1. **DATABASE_URL** — provided by Railway's Postgres plugin. If you downgraded to the free tier and removed the plugin, re-add it: Railway dashboard → your project → New → Database → Add PostgreSQL.
  2. **JWT_SECRET** — a random secret for signing tokens. Set it manually: Railway → Variables → New Variable → `JWT_SECRET` = any long random string (e.g., `openssl rand -hex 32`).
- After adding them, redeploy or restart the service. Check the logs for `[db] connected and migrated`.

**"Cannot reach server" in the lobby**
- The client connects to `wss://<your-host>/ws`. Your host must pass WebSocket upgrade headers through. Railway, Render, Fly, Cloudflare all handle this automatically. On a custom Nginx, confirm you have the `Upgrade` + `Connection "upgrade"` directives.

**Game works but the two browsers don't sync**
- Refresh both tabs. If still broken, check the browser devtools → Network → WS tab. You should see a single `ws` connection in `101 Switching Protocols` state.

**Bot/abuse protection**
- Server already rate-limits 30 msg/10s per socket. Add more if needed in `server/server.js` → `RATE_LIMIT`.

## Scaling notes

- **Rooms are in-memory**. One process holds all rooms. On a 256 MB VM this is good for ~500 concurrent games.
- **To scale to multiple processes**, move rooms to Redis. The protocol doesn't change; you just need the rooms Map to live outside the process. I can add that when you hit the limit.
- **To persist finished games**, drop `room.state` to a database at game end. Again, easy to add later.

---

## Game Already in Production? Sanity check

Every 24h, run:
```bash
curl -s https://YOUR_URL/health
```

The response should have a steadily growing `uptime` and a reasonable `rooms` count. If rooms is in the thousands, you're leaking finished rooms — restart the process or audit `IDLE_ROOM_TTL_MS` in `server/server.js`.
