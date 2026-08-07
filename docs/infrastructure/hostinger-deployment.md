# Hostinger Deployment Guide — Trust My Card (legacy monolith)

> **Deprecated for new production.** Use [render-hostinger-production.md](./render-hostinger-production.md) for Hostinger static marketing + Render core stack.

This guide covers deploying the **full monorepo on a single Hostinger VPS** (historical reference).

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

Production uses **`TMC_ENV=production`** (set in [`ecosystem.config.cjs`](../../ecosystem.config.cjs)). Secrets live in **`env/profiles/production/`** — never commit live files.

See [environments.md](./environments.md) for development and production-preview (local).

### Where env files live (all environments)

Templates (committed) and live secrets (gitignored) use the same paths. **Wallet SDK has no separate env file** — it runs inside the website Next.js process and reads the website profile + platform profile.

| Service | File per profile | Loaded when |
|---------|------------------|-------------|
| Platform (wallets, collector, chains) | `env/profiles/<profile>/platform.env` | Backend, website BFF, workers |
| Backend API + workers | `env/profiles/<profile>/backend.env` | Backend, Prisma CLI |
| Website + Wallet SDK BFF | `env/profiles/<profile>/website.env` | Website (`next.config.ts`) |
| Admin panel | `env/profiles/<profile>/admin.env` | Admin (`next.config.ts`) |

Replace `<profile>` with:

| Profile | `TMC_ENV` | Used on |
|---------|-----------|---------|
| `development` | `development` | Your Mac — `npm run dev:*`, `npm run start:dev` |
| `production-preview` | `production-preview` | Your Mac — `npm run preview:*` (pre-deploy test) |
| `production` | `production` | VPS — PM2 |

**Legacy (still supported):** `config/platform.env`, `backend/.env.local`, `frontend/website/.env.local`, `frontend/admin/.env.local`. Profile files override matching keys.

### Database and Redis URLs per profile

Set these in each profile's **`backend.env`** (adjust username/password to match your Postgres user):

| Profile | `DATABASE_URL` | `REDIS_URL` |
|---------|----------------|-------------|
| **development** | `postgresql://postgres:password@localhost:5432/trustmycard?schema=public` | `redis://127.0.0.1:6379/0` |
| **production-preview** | `postgresql://postgres:password@localhost:5432/trustmycard_preview?schema=public` | `redis://127.0.0.1:6379/1` |
| **production (VPS)** | `postgresql://trustmycard:YOUR_PASSWORD@127.0.0.1:5432/trustmycard?schema=public` | `redis://127.0.0.1:6379/0` |

Preview uses a **separate database** (`trustmycard_preview`) on the same local Postgres instance so admin logs and data do not mix with development.

### 5.1 Production profile setup (VPS)

```bash
PROFILE=production
cd /var/www/trustmycard

cp env/profiles/$PROFILE/platform.env.example env/profiles/$PROFILE/platform.env
cp env/profiles/$PROFILE/backend.env.example   env/profiles/$PROFILE/backend.env
cp env/profiles/$PROFILE/website.env.example   env/profiles/$PROFILE/website.env
cp env/profiles/$PROFILE/admin.env.example     env/profiles/$PROFILE/admin.env
```

Edit each live file. Minimum platform values:

```env
ADMIN_EVM_PRIVATE_KEY=<hex-without-0x-prefix>
ADMIN_TRON_PRIVATE_KEY=<hex>
SPENDER_EVM=<derived-or-explicit-evm-address>
SPENDER_TRON=<derived-or-explicit-tron-address>
TRONGRID_API_KEY=<your-trongrid-key>
ALLOW_SELF_SPENDER=false
COLLECTION_WORKERS_ENABLED=true
```

Backend (`env/profiles/production/backend.env`):

```env
DATABASE_URL="postgresql://trustmycard:CHANGE_ME_STRONG@127.0.0.1:5432/trustmycard?schema=public"
REDIS_URL="redis://127.0.0.1:6379/0"
PORT=4000
NODE_ENV=production
ADMIN_API_KEY=<long-random-secret>
ADMIN_DEV_OPS=false
```

Website (`env/profiles/production/website.env`):

```env
BACKEND_API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_PROJECT_ID=<walletconnect-cloud-project-id>
ALLOW_SELF_SPENDER=false
```

Admin (`env/profiles/production/admin.env`):

```env
BACKEND_API_URL=http://127.0.0.1:4000
ADMIN_API_KEY=<same-as-backend-ADMIN_API_KEY>
ADMIN_SESSION_SECRET=<long-random-hmac-secret>
ADMIN_PANEL_PASSWORD=<strong-login-password>
```

`BACKEND_API_URL` must be reachable from the **Next.js server**. On a single VPS, use `http://127.0.0.1:4000`.

**Legacy fallback:** if profile files are absent, the loader still reads `config/platform.env` and `*/.env.local`.

### Lock down file permissions

```bash
chmod 600 env/profiles/production/*.env
# Legacy paths, if used:
chmod 600 config/platform.env backend/.env.local frontend/website/.env.local frontend/admin/.env.local
```

---

## 6. Database migrations

Run migrations with **`TMC_ENV=production`** so Prisma reads `env/profiles/production/backend.env`:

```bash
cd /var/www/trustmycard/backend
npm run prisma:generate
TMC_ENV=production npm run prisma:migrate
# First deploy only — if no migration history yet:
# TMC_ENV=production npm run prisma:push
```

Do **not** run `npm run prisma:seed` on production.

---

## 7. Build for production

`NEXT_PUBLIC_*` vars are baked in at build time. Build with **`TMC_ENV=production`**:

```bash
cd /var/www/trustmycard/frontend
npm run build:shared
TMC_ENV=production npm run build:website
TMC_ENV=production npm run build:admin

cd /var/www/trustmycard/backend
TMC_ENV=production npm run build
```

Verify build artifacts:

```text
frontend/website/.next/     # Next.js website
frontend/admin/.next/       # Next.js admin
backend/dist/               # Compiled NestJS API
```

---

## 8. Process management (PM2)

Use the committed [`ecosystem.config.cjs`](../../ecosystem.config.cjs) at the repo root (sets `TMC_ENV=production` on all apps):

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

If you do **not** need BullMQ workers on this server, remove the `tmc-workers` entry from `ecosystem.config.cjs` and set `COLLECTION_WORKERS_ENABLED=false` in `env/profiles/production/platform.env`.

---

## 9. Nginx reverse proxy

Copy vhosts from [`docs/infrastructure/nginx/`](./nginx/) to `/etc/nginx/sites-available/`:

- `trustmycard-website.conf` — `trustmycard.com`, `www`
- `trustmycard-api.conf` — `api.trustmycard.com`
- `trustmycard-admin.conf` — `admin.trustmycard.com`

Example (website):

```bash
sudo cp /var/www/trustmycard/docs/infrastructure/nginx/trustmycard-website.conf \
        /etc/nginx/sites-available/trustmycard-website
```

<details>
<summary>Inline reference (website vhost)</summary>

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

</details>

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
| [WalletConnect Cloud](https://cloud.walletconnect.com) | `env/profiles/production/website.env` → `NEXT_PUBLIC_PROJECT_ID` | Add allowed origins: `https://trustmycard.com` |
| TronGrid | `env/profiles/production/platform.env` or `backend.env` → `TRONGRID_API_KEY` | Rate limits apply on free tier |
| Telegram (optional) | `website.env` or `backend.env` → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Website `/api/tg-log` BFF route |

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

# Database connectivity (uses production profile)
cd /var/www/trustmycard/backend && TMC_ENV=production npm run prisma:status
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
TMC_ENV=production npm run build:website
TMC_ENV=production npm run build:admin

cd ../backend
npm ci
npm run prisma:generate
TMC_ENV=production npm run prisma:migrate
TMC_ENV=production npm run build

pm2 restart all
```

For zero-downtime API restarts on a single instance, use `pm2 reload tmc-api` instead of `restart`.

---

## 14. Security checklist

- [ ] `ALLOW_SELF_SPENDER=false` in `env/profiles/production/platform.env` and `website.env`.
- [ ] Strong `ADMIN_API_KEY` in `backend.env` and `admin.env` (same value in both).
- [ ] Strong `ADMIN_SESSION_SECRET` and `ADMIN_PANEL_PASSWORD` in `admin.env`.
- [ ] Private keys only in `env/profiles/production/platform.env` — never in `NEXT_PUBLIC_*` vars.
- [ ] Admin subdomain IP-restricted or behind VPN (see nginx admin vhost).
- [ ] PostgreSQL and Redis bound to `127.0.0.1` only.
- [ ] UFW enabled; only 22, 80, 443 open.
- [ ] `chmod 600 env/profiles/production/*.env`, owned by `deploy`.
- [ ] `ADMIN_DEV_OPS=false` in `env/profiles/production/backend.env`.
- [ ] Regular OS updates: `sudo apt update && sudo apt upgrade`.

---

## 15. Troubleshooting

### Website returns 502 on `/api/*`

- Confirm `tmc-api` is running: `pm2 logs tmc-api`.
- Check `BACKEND_API_URL` in `env/profiles/production/website.env` — use `http://127.0.0.1:4000` on same-server deploys.
- Rebuild with `TMC_ENV=production npm run build:website && pm2 restart tmc-website`.

### Wallet connect shows "Missing NEXT_PUBLIC_PROJECT_ID"

- Set `NEXT_PUBLIC_PROJECT_ID` in `env/profiles/production/website.env`.
- Rebuild: `TMC_ENV=production npm run build:website` (`NEXT_PUBLIC_*` vars are baked in at build time).

### Prisma migration errors

```bash
cd /var/www/trustmycard/backend
TMC_ENV=production npm run prisma:status
TMC_ENV=production npm run prisma:migrate
```

Ensure `DATABASE_URL` in `env/profiles/production/backend.env` matches the PostgreSQL user/database from step 3.

### Collection jobs not processing

- Redis running: `redis-cli ping` → `PONG`.
- `REDIS_URL` set in `env/profiles/production/backend.env`.
- `tmc-workers` PM2 process running when `COLLECTION_WORKERS_ENABLED=true` in `platform.env`.
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

## Quick reference — environments and ports

| App | Dev (`TMC_ENV=development`) | Preview (local) | Production (VPS internal) | Public URL |
|-----|----------------------------|-----------------|----------------------------|------------|
| Website + Wallet SDK | `localhost:3000` | `localhost:3000` | `127.0.0.1:3000` | `https://trustmycard.com` |
| Admin | `localhost:3002` | `localhost:3002` | `127.0.0.1:3002` | `https://admin.trustmycard.com` |
| API | `localhost:4000` | `localhost:4000` | `127.0.0.1:4000` | `https://api.trustmycard.com` |

| Profile | Postgres database | Redis DB index |
|---------|-------------------|----------------|
| development | `trustmycard` | `0` |
| production-preview | `trustmycard_preview` | `1` |
| production | `trustmycard` (on VPS) | `0` |

For local development and preview commands, see [environments.md](./environments.md).
