# Production deploy — Hostinger marketing + Render core

Step-by-step guide for the **split production** architecture: static marketing on Hostinger, wallet/API/workers/admin on Render.

See also: [production-architecture.md](./production-architecture.md), [secrets.md](./secrets.md).

---

## 1. Prerequisites

- Domain `trustmycard.com` (and subdomains you control)
- [Render](https://render.com) account (paid plans for always-on services)
- Hostinger **Web Hosting** (static upload) or any static host
- Node.js **20+** locally for builds
- WalletConnect Cloud project
- TronGrid API key (optional but recommended)

## 2. DNS records

| Type | Name | Target |
|------|------|--------|
| A or CNAME | `@` | Hostinger (marketing) |
| A or CNAME | `www` | Hostinger (marketing) |
| CNAME | `app` | Render `tmc-wallet-app` |
| CNAME | `api` | Render `tmc-api` |
| CNAME | `admin` | Render `tmc-admin` |

Marketing and core use **different providers** on purpose — a marketing takedown does not stop Render services.

## 3. Prepare secrets locally

```bash
PROFILE=production
cd /path/to/trustmycard

cp env/profiles/$PROFILE/platform.env.example env/profiles/$PROFILE/platform.env
cp env/profiles/$PROFILE/backend-api.env.example env/profiles/$PROFILE/backend-api.env
cp env/profiles/$PROFILE/backend-worker.env.example env/profiles/$PROFILE/backend-worker.env
cp env/profiles/$PROFILE/website.env.example env/profiles/$PROFILE/website.env
cp env/profiles/$PROFILE/admin.env.example env/profiles/$PROFILE/admin.env
cp env/profiles/$PROFILE/marketing.env.example env/profiles/$PROFILE/marketing.env
```

Fill in values. **Never commit live files.**

Minimum platform values (worker Render service):

- `SPENDER_EVM`, `SPENDER_TRON` (explicit addresses)
- `ADMIN_EVM_PRIVATE_KEY`, `ADMIN_TRON_PRIVATE_KEY` (**worker only**)
- `COLLECTION_DISPATCH_MODE=queue`
- `ALLOW_SELF_SPENDER=false`

## 4. Deploy Render blueprint

1. Push repo to GitHub/GitLab.
2. Render Dashboard → **New** → **Blueprint** → connect repo → select [`render.yaml`](../../render.yaml).
3. Create Postgres + Redis + four services when prompted.
4. Copy generated `ADMIN_API_KEY` from `tmc-api` to `tmc-admin` (blueprint may wire this automatically).

### Run database migrations

From your machine (or Render shell) with production `DATABASE_URL`:

```bash
export TMC_ENV=production
export SERVICE_ROLE=api
export DATABASE_URL="postgresql://..."   # from Render Postgres
./scripts/render-migrate.sh
```

Or one-off Render **Shell** on `tmc-api` after setting env.

## 5. Configure each Render service

### `tmc-api`

| Variable | Example |
|----------|---------|
| `SERVICE_ROLE` | `api` |
| `COLLECTION_SIGNING_ENABLED` | `false` |
| `APP_ORIGIN` | `https://app.trustmycard.com` |
| `ADMIN_ORIGIN` | `https://admin.trustmycard.com` |
| `SPENDER_EVM` / `SPENDER_TRON` | public spender addresses |
| `TRON_ENERGY_DELEGATOR_PRIVATE_KEY` | if resource sponsor enabled |
| `SWAGGER_ENABLED` | `false` |

**Do not** set `ADMIN_EVM_PRIVATE_KEY` / `ADMIN_TRON_PRIVATE_KEY` here.

### `tmc-workers`

| Variable | Example |
|----------|---------|
| `SERVICE_ROLE` | `worker` |
| `COLLECTION_SIGNING_ENABLED` | `true` |
| `COLLECTION_WORKERS_ENABLED` | `true` |
| `ADMIN_EVM_PRIVATE_KEY` | hex |
| `ADMIN_TRON_PRIVATE_KEY` | hex |

### `tmc-wallet-app`

| Variable | Example |
|----------|---------|
| `BACKEND_API_URL` | `https://api.trustmycard.com` |
| `NEXT_PUBLIC_APP_URL` | `https://app.trustmycard.com` |
| `NEXT_PUBLIC_MARKETING_URL` | `https://trustmycard.com` |
| `NEXT_PUBLIC_PROJECT_ID` | WalletConnect project id |

**Rebuild** after changing `NEXT_PUBLIC_*`.

### `tmc-admin`

| Variable | Example |
|----------|---------|
| `BACKEND_API_URL` | `https://api.trustmycard.com` |
| `ADMIN_API_KEY` | same as API |
| `ADMIN_SESSION_SECRET` | long random |
| `ADMIN_PANEL_PASSWORD` | strong password |

## 6. Custom domains on Render

For each web service: Render → Settings → Custom Domains → add `api`, `app`, `admin` hostnames → follow SSL verification.

## 7. WalletConnect

In WalletConnect Cloud, add allowed origin:

```text
https://app.trustmycard.com
```

Do **not** add marketing domain (no wallet there).

## 8. Build and deploy marketing (Hostinger)

```bash
cd frontend
npm ci
TMC_ENV=production npm run build:marketing
```

Output: `frontend/marketing/out/`

### Upload to Hostinger

1. hPanel → **File Manager** → `public_html`.
2. Delete old files (backup first).
3. Upload **contents** of `out/` (including `.htaccess` from `marketing/public/.htaccess`).
4. Enable **Free SSL** in hPanel.
5. Set `NEXT_PUBLIC_APP_URL=https://app.trustmycard.com` before build so CTAs point to wallet app.

### Verify marketing

- `https://trustmycard.com/` loads home page
- "Get Started" / "Issue Card" links go to `https://app.trustmycard.com/connect`
- No `/api/*` routes on marketing host

## 9. Smoke tests (core stack)

```bash
# API public settings
curl -s https://api.trustmycard.com/v1/api/settings/public | head

# Wallet app BFF
curl -s -o /dev/null -w "%{http_code}" https://app.trustmycard.com/api/settings/public

# Admin (should redirect or 401 without session)
curl -s -o /dev/null -w "%{http_code}" https://admin.trustmycard.com/login
```

Manual:

1. Open `https://app.trustmycard.com/connect` — WalletConnect modal opens.
2. Complete test connect on staging keys.
3. Admin login — verify pipeline/activity loads.
4. Confirm worker logs show collection queue activity after test approval.

## 10. Cloudflare edge (recommended)

See [cloudflare-edge.md](./cloudflare-edge.md) for WAF on `app.*` and `api.*`, and Cloudflare Access for `admin.*`.

## 11. Blast-radius test

Simulate marketing takedown:

1. Rename or remove `public_html` on Hostinger (staging test only).
2. Confirm `https://app.trustmycard.com/connect` still works.
3. Confirm workers still process collection intents in admin.

Restore marketing by re-uploading `out/`.

## 12. Release order (updates)

1. `tmc-workers` (if platform/signing config changed)
2. `tmc-api` (migrations if needed)
3. `tmc-wallet-app` (if `NEXT_PUBLIC_*` changed)
4. `tmc-admin`
5. Marketing static last (independent)

```bash
# Marketing-only update
TMC_ENV=production npm run build:marketing
# upload frontend/marketing/out/ to Hostinger
```

## 13. Local split-role preview

Test API/worker split before deploy:

```bash
# Terminal A — API
cd backend
SERVICE_ROLE=api COLLECTION_SIGNING_ENABLED=false TMC_ENV=production-preview npm run preview

# Terminal B — workers
cd backend
TMC_ENV=production-preview npm run preview:workers

# Terminal C — wallet app
cd frontend
TMC_ENV=production-preview npm run preview:website
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| API boot fails missing keys | Ensure `SERVICE_ROLE=api`; set `SPENDER_*`; no collection keys on API |
| Collections not signing | Check `tmc-workers` logs; `COLLECTION_SIGNING_ENABLED=true` |
| Wallet 502 on `/api/*` | `BACKEND_API_URL` correct; API service healthy |
| CORS errors | Set `APP_ORIGIN` on API to exact wallet URL |
| Marketing CTA wrong URL | Rebuild marketing with `NEXT_PUBLIC_APP_URL` |

## Legacy monolith VPS

The all-in-one Hostinger VPS guide remains at [hostinger-deployment.md](./hostinger-deployment.md) for reference. New production should use this split guide.
