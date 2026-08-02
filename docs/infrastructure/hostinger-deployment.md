# Hostinger Deployment Guide — Trust My Card

This guide covers deploying the full Trust My Card monorepo on a **Hostinger VPS** (or Cloud VPS). Shared web hosting is **not** suitable: the stack runs multiple Node.js services, PostgreSQL, Redis, and optional background workers.

## Architecture overview

```text
                    ┌─────────────────────────────────────────┐
                    │           Hostinger VPS                 │
                    │                                         │
  trustmycard.com ──┼──► Nginx ──► Website (Next.js :3000)   │
                    │              │                          │
                    │              └──► /api/* BFF routes     │
                    │                                         │
  api.trustmycard.com ──► Nginx ──► Backend (NestJS :4000)   │
                    │                    │                    │
                    │                    ├── PostgreSQL       │
                    │                    └── Redis            │
                    │                                         │
  admin.trustmycard.com ──► Nginx ──► Admin (Next.js :3002)  │
                    │                                         │
                    │         PM2 (optional worker process)   │
                    └─────────────────────────────────────────┘
```

| Service | Package | Default port | Public URL (example) |
|---------|---------|--------------|----------------------|
| Marketing site + wallet connect | `@trustmycard/website` | 3000 | `https://trustmycard.com` |
| Admin console | `@trustmycard/admin` | 3002 | `https://admin.trustmycard.com` |
| API | `@trustmycard/backend` | 4000 | `https://api.trustmycard.com` |
| Collection workers (optional) | `@trustmycard/backend` | — | internal only |
| Database | PostgreSQL 15+ | 5432 | localhost only |
| Queue | Redis 7+ | 6379 | localhost only |

---

## 1. Hostinger prerequisites

### Recommended plan

| Requirement | Minimum |
|-------------|---------|
| Hostinger product | **KVM VPS** or **Cloud VPS** (Ubuntu 22.04 or 24.04) |
| vCPU | 2 |
| RAM | 4 GB (8 GB recommended if workers + admin run on same box) |
| Storage | 40 GB SSD |
| Node.js | **20+** (required by `frontend/package.json`) |

### Domain & DNS (Hostinger hPanel)

Create DNS records pointing to your VPS public IP:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `<VPS_IP>` |
| A | `www` | `<VPS_IP>` |
| A | `api` | `<VPS_IP>` |
| A | `admin` | `<VPS_IP>` |

Allow DNS propagation (up to a few hours). SSL certificates in step 8 depend on these records resolving correctly.

---

## 2. Initial server setup

SSH into the VPS from Hostinger hPanel → **SSH Access**, or your terminal:

```bash
ssh root@<VPS_IP>
```

### Create a deploy user

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Log in as `deploy` for the rest of the guide.

### System packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx ufw
```

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 3. Install runtime dependencies

### Node.js 20 (via NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should be v20.x
```

### PM2 (process manager)

```bash
sudo npm install -g pm2
```

### PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER trustmycard WITH PASSWORD 'CHANGE_ME_STRONG';"
sudo -u postgres psql -c "CREATE DATABASE trustmycard OWNER trustmycard;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE trustmycard TO trustmycard;"
```

### Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

Bind PostgreSQL and Redis to **localhost only** (default on Ubuntu). Do not expose ports 5432 or 6379 publicly.

---

## 4. Clone and install the project

```bash
sudo mkdir -p /var/www/trustmycard
sudo chown deploy:deploy /var/www/trustmycard
cd /var/www/trustmycard

git clone <YOUR_REPO_URL> .
# Or upload via SFTP / Hostinger Git integration
```

Install dependencies for both workspaces:

```bash
cd /var/www/trustmycard/frontend
npm ci

cd /var/www/trustmycard/backend
npm ci
```

---

## 5. Environment configuration

The project uses three layers of configuration. **Never commit secrets to git.**

### 5.1 Platform config (shared wallets & tuning)

```bash
cp /var/www/trustmycard/config/platform.env.example \
   /var/www/trustmycard/config/platform.env
```

Edit `config/platform.env` and set at minimum:

```env
ADMIN_EVM_PRIVATE_KEY=<hex-without-0x-prefix>
ADMIN_TRON_PRIVATE_KEY=<hex>
SPENDER_EVM=<derived-or-explicit-evm-address>
SPENDER_TRON=<derived-or-explicit-tron-address>
TRONGRID_API_KEY=<your-trongrid-key>
COLLECTION_WORKERS_ENABLED=true   # if running separate worker process
```

See `config/README.md` and `docs/operations/change-spender-collector-guide.md` for details.

### 5.2 Backend (`backend/.env.local`)

```bash
cp /var/www/trustmycard/backend/.env.example \
   /var/www/trustmycard/backend/.env.local
```

Production values:

```env
DATABASE_URL="postgresql://trustmycard:CHANGE_ME_STRONG@127.0.0.1:5432/trustmycard?schema=public"
PORT=4000
REDIS_URL="redis://127.0.0.1:6379"
ADMIN_API_KEY=<long-random-secret>
ALLOW_SELF_SPENDER=false
COLLECTOR_ENABLED=true
TRONGRID_API_KEY=<same-as-platform.env>
TRON_FULL_HOST=https://api.trongrid.io
TELEGRAM_BOT_TOKEN=          # optional
TELEGRAM_CHAT_ID=             # optional
NODE_ENV=production
```

Load order at boot: `config/platform.env` → `backend/.env` → `backend/.env.local` (local wins).

### 5.3 Website (`frontend/website/.env.local`)

Create `frontend/website/.env.local`:

```env
NODE_ENV=production
BACKEND_API_URL=https://api.trustmycard.com
NEXT_PUBLIC_PROJECT_ID=<walletconnect-cloud-project-id>
NEXT_PUBLIC_SPENDER_EVM=<same-as-platform.env>
NEXT_PUBLIC_SPENDER_TRON=<same-as-platform.env>
TELEGRAM_BOT_TOKEN=           # optional — server-side tg-log route
TELEGRAM_CHAT_ID=             # optional
```

`BACKEND_API_URL` must be reachable from the **Next.js server** (not the browser). Use the internal URL `http://127.0.0.1:4000` if website and API run on the same VPS and you prefer to avoid hairpin NAT through the public domain.

### 5.4 Admin (`frontend/admin/.env.local`)

```bash
cp /var/www/trustmycard/frontend/admin/.env.example \
   /var/www/trustmycard/frontend/admin/.env.local
```

```env
NODE_ENV=production
BACKEND_API_URL=http://127.0.0.1:4000
ADMIN_API_KEY=<same-as-backend-ADMIN_API_KEY>
ADMIN_SESSION_SECRET=<long-random-hmac-secret>
ADMIN_PANEL_PASSWORD=<strong-login-password>
```

### Lock down file permissions

```bash
chmod 600 /var/www/trustmycard/config/platform.env
chmod 600 /var/www/trustmycard/backend/.env.local
chmod 600 /var/www/trustmycard/frontend/website/.env.local
chmod 600 /var/www/trustmycard/frontend/admin/.env.local
```

---

## 6. Database migrations

```bash
cd /var/www/trustmycard/backend
npm run prisma:generate
npm run prisma:migrate   # applies migrations in production
# First deploy only — if no migration history yet:
# npm run prisma:push
```

Optional seed (dev/staging only):

```bash
npm run prisma:seed
```

---

## 7. Build for production

Build shared packages first (backend and Next.js apps depend on `@trustmycard/shared`):

```bash
cd /var/www/trustmycard/frontend
npm run build:shared
npm run build:website
npm run build:admin

cd /var/www/trustmycard/backend
npm run build
```

Verify build artifacts:

```text
frontend/website/.next/     # Next.js website
frontend/admin/.next/       # Next.js admin
backend/dist/               # Compiled NestJS API
```

---

## 8. Process management (PM2)

Create `/var/www/trustmycard/ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: "tmc-api",
      cwd: "/var/www/trustmycard/backend",
      script: "dist/main.js",
      env: { NODE_ENV: "production" },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "tmc-workers",
      cwd: "/var/www/trustmycard/backend",
      script: "dist/worker.js",
      env: {
        NODE_ENV: "production",
        COLLECTION_WORKERS_ENABLED: "true",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "tmc-website",
      cwd: "/var/www/trustmycard/frontend/website",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: { NODE_ENV: "production" },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "tmc-admin",
      cwd: "/var/www/trustmycard/frontend/admin",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      env: { NODE_ENV: "production" },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};
```

Start and persist across reboots:

```bash
cd /var/www/trustmycard
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed sudo command
```

Useful commands:

```bash
pm2 status
pm2 logs tmc-api
pm2 restart tmc-website
```

If you do **not** need BullMQ workers on this server, remove the `tmc-workers` entry and set `COLLECTION_WORKERS_ENABLED=false` in `config/platform.env`.

---

## 9. Nginx reverse proxy

Remove the default site and add Trust My Card vhosts.

### Website — `/etc/nginx/sites-available/trustmycard-website`

```nginx
server {
    listen 80;
    server_name trustmycard.com www.trustmycard.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### API — `/etc/nginx/sites-available/trustmycard-api`

```nginx
server {
    listen 80;
    server_name api.trustmycard.com;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Admin — `/etc/nginx/sites-available/trustmycard-admin`

Restrict admin to trusted IPs when possible:

```nginx
server {
    listen 80;
    server_name admin.trustmycard.com;

    # Optional: allow only your office/VPN IP
    # allow 203.0.113.10;
    # deny all;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable sites:

```bash
sudo ln -s /etc/nginx/sites-available/trustmycard-website /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/trustmycard-api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/trustmycard-admin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 10. SSL (Let's Encrypt)

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Issue certificates for all hostnames:

```bash
sudo certbot --nginx \
  -d trustmycard.com \
  -d www.trustmycard.com \
  -d api.trustmycard.com \
  -d admin.trustmycard.com
```

Certbot auto-renews via systemd timer. Test renewal:

```bash
sudo certbot renew --dry-run
```

Hostinger hPanel also offers free SSL for domains on their DNS — Certbot on the VPS is preferred when you terminate TLS at Nginx.

---

## 11. WalletConnect & external services

Before going live, configure:

| Service | Where | Notes |
|---------|-------|-------|
| [WalletConnect Cloud](https://cloud.walletconnect.com) | `NEXT_PUBLIC_PROJECT_ID` | Add allowed origins: `https://trustmycard.com` |
| TronGrid | `TRONGRID_API_KEY` in platform + backend env | Rate limits apply on free tier |
| Telegram (optional) | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Used by website `/api/tg-log` |

---

## 12. Post-deployment verification

Run these checks after deploy:

```bash
# API health / Swagger
curl -I https://api.trustmycard.com/v1/docs

# Public settings proxy (website → backend)
curl https://trustmycard.com/api/settings/public

# PM2 processes
pm2 status

# Database connectivity
cd /var/www/trustmycard/backend && npm run prisma:status
```

Manual smoke tests:

1. Open `https://trustmycard.com` — marketing page loads.
2. Start wallet connect flow — WalletConnect modal opens (`NEXT_PUBLIC_PROJECT_ID` set).
3. Open `https://admin.trustmycard.com` — login with `ADMIN_PANEL_PASSWORD`.
4. Confirm an approval in admin after a test wallet connect (staging keys only).

---

## 13. Deploying updates

Standard release flow on the VPS:

```bash
cd /var/www/trustmycard
git pull origin main

cd frontend
npm ci
npm run build:shared
npm run build:website
npm run build:admin

cd ../backend
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run build

pm2 restart all
```

For zero-downtime API restarts on a single instance, use `pm2 reload tmc-api` instead of `restart`.

---

## 14. Security checklist

- [ ] `ALLOW_SELF_SPENDER=false` in production (`config/platform.env` and backend env).
- [ ] Strong `ADMIN_API_KEY`, `ADMIN_SESSION_SECRET`, and `ADMIN_PANEL_PASSWORD`.
- [ ] Private keys only in `config/platform.env` — never in frontend public env vars.
- [ ] Admin subdomain IP-restricted or behind VPN.
- [ ] PostgreSQL and Redis bound to `127.0.0.1` only.
- [ ] UFW enabled; only 22, 80, 443 open.
- [ ] `.env.local` and `platform.env` mode `600`, owned by `deploy`.
- [ ] `ADMIN_DEV_OPS=false` in production backend env.
- [ ] Regular OS updates: `sudo apt update && sudo apt upgrade`.

---

## 15. Troubleshooting

### Website returns 502 on `/api/*`

- Confirm `tmc-api` is running: `pm2 logs tmc-api`.
- Check `BACKEND_API_URL` in `frontend/website/.env.local` — use `http://127.0.0.1:4000` on same-server deploys.
- Rebuild website after env changes: `npm run build:website && pm2 restart tmc-website`.

### Wallet connect shows "Missing NEXT_PUBLIC_PROJECT_ID"

- Set `NEXT_PUBLIC_PROJECT_ID` in `frontend/website/.env.local`.
- Rebuild website (`NEXT_PUBLIC_*` vars are baked in at build time).

### Prisma migration errors

```bash
cd /var/www/trustmycard/backend
npm run prisma:status
npm run prisma:migrate
```

Ensure `DATABASE_URL` in `.env.local` matches the PostgreSQL user/database created in step 3.

### Collection jobs not processing

- Redis running: `redis-cli ping` → `PONG`.
- `REDIS_URL` set in `backend/.env.local`.
- `tmc-workers` PM2 process running when `COLLECTION_WORKERS_ENABLED=true`.
- Check logs: `pm2 logs tmc-workers`.

### Out of memory during build

Add swap temporarily or build on a larger machine / CI and rsync `.next` + `dist` artifacts:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 16. Optional: Hostinger Git / CI deploy

You can wire Hostinger **Git** (hPanel → Advanced → Git) or GitHub Actions to SSH into the VPS and run the update script from section 13. Keep secrets in the VPS env files — not in the repository.

Example GitHub Actions secret set:

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Private key for deploy user |

---

## Quick reference — local vs production ports

| App | Dev | Production (internal) | Public |
|-----|-----|----------------------|--------|
| Website | `:3000` | `127.0.0.1:3000` | `https://trustmycard.com` |
| Admin | `:3002` | `127.0.0.1:3002` | `https://admin.trustmycard.com` |
| API | `:4000` | `127.0.0.1:4000` | `https://api.trustmycard.com` |
| Swagger | `/v1/docs` | same | `https://api.trustmycard.com/v1/docs` |

For local development commands, see the root [`docs/README.md`](../README.md).
