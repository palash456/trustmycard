# Budget production deploy — Render ~$14/mo

Deploy Trust My Card for **~$14/month** on Render (2× Starter web services) using **free external** Postgres and Redis.

| Service | Render cost | Notes |
|---------|-------------|--------|
| `tmc-backend` | $7/mo | All-in-one API + collection signing (`SERVICE_ROLE=all`) |
| `tmc-wallet-app` | $7/mo | Decoy `/` + product `/connect` |
| Postgres (Neon free) | $0 | External `DATABASE_URL` |
| Redis (Upstash free) | $0 | External `REDIS_URL` |
| Admin | $0 | Run locally when needed |

**Tradeoff:** API and collection signing run on the **same process** (`node dist/main.js`, poll-mode collector). Keys live in the same container env. Acceptable for launch; upgrade to [render.yaml](../../render.yaml) split deploy later.

For **trustvisa.cards** DNS (apex → wallet app), see [trustvisa-single-domain.md](./trustvisa-single-domain.md).

---

## 1. Create external database (Neon)

1. Sign up at [neon.tech](https://neon.tech) → create project.
2. Copy **connection string** (pooled or direct; use `?sslmode=require`).
3. Save as `DATABASE_URL`.

Run migrations once from your machine:

```bash
export TMC_ENV=production
export DATABASE_URL="postgresql://..."
export SERVICE_ROLE=api
./scripts/render-migrate.sh
```

---

## 2. Create external Redis (Upstash)

1. Sign up at [upstash.com](https://upstash.com) → create Redis database.
2. Copy **Redis URL** (`rediss://...`).
3. Save as `REDIS_URL`.

---

## 3. Deploy Render blueprint

1. Push repo to GitHub/GitLab.
2. Render → **New** → **Blueprint**.
3. When asked for blueprint file, use **`render-budget.yaml`** from the repo root  
   (or temporarily rename it to `render.yaml` if Render only auto-detects that name).
4. Create both services when prompted.

### `tmc-backend` env (set in Render dashboard)

**Required** — deploy will fail without these:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Neon connection string (`postgresql://...?sslmode=require`) |
| `REDIS_URL` | Upstash `rediss://default:PASSWORD@HOST:6379` |
| `APP_ORIGIN` | `https://trustvisa.cards` |
| `ADMIN_ORIGIN` | `https://admin.trustvisa.cards` (or localhost for local admin) |
| `SPENDER_EVM` / `SPENDER_TRON` | Public spender addresses |
| `ADMIN_EVM_PRIVATE_KEY` | Hex (worker uses; same container as API) |
| `ADMIN_TRON_PRIVATE_KEY` | Hex |
| `TRONGRID_API_KEY` | Optional |
| `TRON_ENERGY_DELEGATOR_PRIVATE_KEY` | If resource sponsor enabled |

`ADMIN_API_KEY` is auto-generated — copy it for local admin.

### `tmc-wallet-app` env

| Variable | Example |
|----------|---------|
| `BACKEND_API_URL` | `https://api.trustvisa.cards` (custom domain on `tmc-backend`) |
| `NEXT_PUBLIC_APP_URL` | `https://trustvisa.cards` |
| `NEXT_PUBLIC_MARKETING_URL` | `https://www.trustvisa.cards` |
| `NEXT_PUBLIC_PROJECT_ID` | WalletConnect project id |

**Redeploy** wallet app after changing `NEXT_PUBLIC_*`.

---

## 4. Custom domains

| Render service | Suggested hostname |
|----------------|-------------------|
| `tmc-backend` | `api.trustvisa.cards` |
| `tmc-wallet-app` | `trustvisa.cards` |

Render → each service → **Custom Domains** → add hostname → update DNS CNAME.

---

## 5. WalletConnect

Allowed origin:

```text
https://trustvisa.cards
```

---

## 6. Admin (local only)

No `tmc-admin` on Render in budget mode. Run locally:

```bash
cp env/profiles/production/admin.env.example env/profiles/production/admin.env
# BACKEND_API_URL=https://api.trustvisa.cards
# ADMIN_API_KEY=<from Render tmc-backend>
cd frontend && npm run dev:admin
```

---

## 7. Smoke tests

```bash
curl -s https://api.trustvisa.cards/v1/api/settings/public | head
curl -sI https://trustvisa.cards/ | head -3
curl -sI https://trustvisa.cards/connect | head -3
```

Manual: open `/connect` → WalletConnect modal; complete test flow.

---

## 8. Upgrade path

When revenue allows, migrate to full split deploy:

- [render.yaml](../../render.yaml) — separate API, worker, Render Postgres/Redis, hosted admin
- [render-hostinger-production.md](./render-hostinger-production.md)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on `prisma generate` | Ensure `DATABASE_URL` set before migrate; build does not need live DB |
| Collection signing disabled | Confirm `SERVICE_ROLE=all`, `COLLECTION_SIGNING_ENABLED=true`, `COLLECTION_DISPATCH_MODE=poll` on `tmc-backend`; redeploy after changing Start Command |
| `ADMIN_EVM_PRIVATE_KEY does not derive...` | `SPENDER_EVM`/`SPENDER_TRON` must match addresses derived from admin private keys |
| 502 on wallet `/api/*` | `BACKEND_API_URL` must match `tmc-backend` public URL |
| CORS errors | `APP_ORIGIN=https://trustvisa.cards` on backend |
| Neon connection limit | Use Neon pooled connection string |
