# VPS migration & hosting provider changes

Guide for moving production between VPS providers, replacing a droplet, or migrating from VPS to Render. Based on the current `docker-vps` + `micro` topology (backend + wallet + Caddy, external Neon + Upstash).

**Related:** [Domain migration](./domain-migration.md) (hostname change), [deploy/README.md](../../deploy/README.md), [one-step-deploy.md](./one-step-deploy.md), [render-budget-production.md](./render-budget-production.md).

---

## Configuration architecture

Two separate config layers — do not merge them.

| Layer | File(s) | Loaded by | Purpose |
| ----- | ------- | --------- | ------- |
| **Runtime (product)** | `config/platform.env`, `env/profiles/production/*.env`, `deploy/runtime-config/production.json` | Apps at startup (`config/load-env.mjs`) and deploy compiler | `WEBSITE_DOMAIN`, wallets, Meta Pixel, `DATABASE_URL`, `REDIS_URL`, compiled public URLs |
| **Deploy (operator)** | `deploy/provider.credentials.env` | `./deploy.sh` / `docker-vps` adapter only | SSH access to the VPS |

### Variable roles

| Variable | File | Changes when… |
| -------- | ---- | ------------- |
| `VPS_HOST` | `deploy/provider.credentials.env` | **Every VPS swap** — new server IP or hostname |
| `VPS_USER` | same | New server uses a different SSH user (default in example: `deploy`; many boxes use `root`) |
| `VPS_SSH_KEY` | same | New key pair or different operator machine |
| `VPS_DEPLOY_PATH` | same | Install path differs from `/opt/tmc` |
| `WEBSITE_DOMAIN` | `config/platform.env` (fallback: `deploy/runtime-config/production.json`) | **Domain stays the same** for a pure VPS swap — only DNS A records change |

**Do not** put `VPS_*` or SSH keys into `config/platform.env`. They are never read by running containers and must not be synced to the VPS as application config.

### Supported VPS providers

Any Debian/Ubuntu VPS with SSH, ports **80/443** open, and **512 MB+** RAM works with `docker-vps`. Documented examples: DigitalOcean, Hetzner, Hostinger VPS (not shared web hosting), FlokiNet. Only `deploy/provider.credentials.env` changes between providers.

`deploy/manifest.production.json` stays unchanged for VPS-to-VPS moves: `provider: docker-vps`, `topology: micro`, `data.mode: external`.

---

## VPS provider → VPS provider

Examples: DigitalOcean → Hetzner, DigitalOcean → Hostinger VPS, DigitalOcean → FlokiNet, Hetzner → another Hetzner box.

**Unchanged:** Docker images, Caddy edge, `micro` topology, application code, Neon Postgres, Upstash Redis, `WEBSITE_DOMAIN`, `env/profiles/production/*` (except when infra URLs change).

### What you change

1. **`deploy/provider.credentials.env`**
   - Always: `VPS_HOST` → new server IP/hostname
   - If needed: `VPS_USER`, `VPS_SSH_KEY`, `VPS_DEPLOY_PATH`

2. **DNS** (Cloudflare recommended — see [cloudflare-setup.md](./cloudflare-setup.md))
   - Apex (`@`) A record → new VPS IP
   - `api` A record → same new VPS IP
   - Optional `www` → new VPS IP or CNAME per your layout
   - Lower TTL before cutover (e.g. 300s) if supported

3. **Nothing else** when domain and external DB/Redis stay the same.

### New server prerequisites

On first deploy with `--fresh`, the adapter runs `deploy/scripts/provision-vps-docker.sh` over SSH (Debian/Ubuntu: Docker Engine + compose plugin). Requirements:

- SSH access from your operator machine (key in `VPS_SSH_KEY`)
- Ports **80** and **443** open (Caddy / Let's Encrypt)
- Outbound internet (image load, ACME, Neon, Upstash)
- **512 MB+ RAM** recommended; 1 GB swap advised on small boxes

The VPS never runs `npm` or `docker build` — images are built locally and streamed via `docker save | ssh docker load`.

### Deploy steps

```bash
# 1. Update deploy credentials
#    deploy/provider.credentials.env → VPS_HOST (and user/key if changed)

# 2. First deploy to the new box (installs Docker, syncs bundle, starts stack)
./deploy.sh production --fresh --provider docker-vps --confirm-external-data

# 3. Later code/config deploys (no Docker reinstall)
./deploy.sh production --provider docker-vps

# 4. Config-only redeploy (domain/pixel change — reuses images on VPS)
./deploy.sh production --provider docker-vps --skip-images
```

`--confirm-external-data` is required for `--fresh` when `data.mode: external` and `DATABASE_URL` points at a protected host (e.g. `neon.tech`). It allows migrations against the existing database — it does **not** wipe Neon/Upstash data.

### Docker / Caddy on the new server

- Caddyfile is **compiled** from `WEBSITE_DOMAIN` into `deploy/compiled/production/Caddyfile` and rsynced to the VPS.
- Caddy obtains new Let's Encrypt certificates after DNS points to the new IP (may take minutes).
- Containers: `backend`, `wallet`, `caddy` (`deploy/compose/docker-compose.micro-edge.yml`).

### Data / database / Redis

With `data.mode: external` (current production manifest):

- **PostgreSQL (Neon)** and **Redis (Upstash)** are unchanged — no migration of app data required for a VPS-only move.
- The new VPS connects to the same `DATABASE_URL` / `REDIS_URL` from `env/profiles/production/backend.env`.

### Verification

Automated checks run at end of deploy (`deploy/core/verify.mjs`):

- `https://api.<WEBSITE_DOMAIN>/v1/api/settings/public` → 200
- `https://<WEBSITE_DOMAIN>/api/settings/public` → 200

Manual:

- HTTPS on apex and `api.` subdomain
- WalletConnect connect flow
- Admin locally: `npm run dev:admin` with production profile against `api.<domain>`

### Rollback

If the new VPS fails before decommissioning the old one:

1. Revert DNS A records to the **old** VPS IP.
2. Old stack keeps serving until TTL expires.
3. Fix the new box and redeploy, or restore `VPS_HOST` to the old server in `provider.credentials.env`.

---

## VPS / server replacement (same provider, new droplet)

Same process as provider → provider. Typical checklist:

1. Provision new droplet; note IP.
2. Update `VPS_HOST` in `deploy/provider.credentials.env`.
3. Run `./deploy.sh production --fresh --provider docker-vps --confirm-external-data`.
4. Update DNS A records when ready; wait for propagation.
5. Verify endpoints (above).
6. After 24–48h stable, destroy old droplet.

**Runtime config on VPS:** If you use `deploy/runtime-config/production.json` on the server (`/opt/tmc/deploy/runtime-config/`), it is rsynced during deploy. Back up before migration:

```bash
npm run config:sync-vps   # push local runtime config to VPS (uses provider.credentials.env)
```

---

## VPS → Render migration

**This is not a VPS credential swap.** Render uses a **different deployment path**:

| Aspect | Micro VPS (`docker-vps`) | Render |
| ------ | ------------------------ | ------ |
| Deploy tool | `./deploy.sh --provider docker-vps` | Render Dashboard + `render-budget.yaml` or `render.yaml` blueprint |
| `./deploy.sh --provider render` | — | **Stub — not implemented** |
| TLS | Caddy on VPS (Let's Encrypt) | Render-managed TLS on custom domains |
| Build | Local Docker images → SSH stream | Render build commands (`scripts/render-build-*.sh`) |
| Topology | `micro`: backend + wallet on one VPS | Budget: 2 web services; Full: API + worker + wallet + admin |
| Public URLs | Compiled from `WEBSITE_DOMAIN` | Set manually: `APP_ORIGIN`, `BACKEND_API_URL`, `NEXT_PUBLIC_*` in Render dashboard |
| Admin | Local `localhost:3002` | Budget: local; Full blueprint: Render web service |

### What you must reconfigure for Render

1. Create Neon + Upstash (or reuse existing) — same `DATABASE_URL` / `REDIS_URL` can be attached to Render services.
2. Deploy blueprint: `render-budget.yaml` (~$14/mo) or `render.yaml` (~$60/mo full split).
3. Set Render env vars per service (see [render-budget-production.md](./render-budget-production.md)):
   - Backend: `APP_ORIGIN`, `ADMIN_ORIGIN`, signing keys, `DATABASE_URL`, `REDIS_URL`, …
   - Wallet: `BACKEND_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PROJECT_ID`, …
4. Add **custom domains** on each Render service; DNS becomes **CNAME** targets from Render (not A records to a VPS IP).
5. Rebuild/redeploy wallet after `NEXT_PUBLIC_*` changes.
6. Update WalletConnect allowed origin.
7. Decommission VPS stack when cutover is verified.

Do not copy `VPS_*` values into Render. Render never uses `deploy/provider.credentials.env`.

---

## Quick reference

| Scenario | Change `VPS_HOST` | Change `WEBSITE_DOMAIN` | Change DNS | Deploy command |
| -------- | ----------------- | ----------------------- | ---------- | -------------- |
| Same domain, new VPS | Yes | No | A → new IP | `--fresh --confirm-external-data` then normal deploys |
| New domain, same VPS | No | Yes | See [domain-migration.md](./domain-migration.md) | `config-update.sh domain` + config-only deploy |
| VPS → Render | N/A (stop using VPS deploy) | Maybe | CNAME to Render | Render blueprint + dashboard env |
