# mytrustvisa.cards — domain, security & access guide

**Production domain (current):** `mytrustvisa.cards`  
**Legacy domain:** `trustvisa.cards` (migrated)

This is the **single source of truth** for how the live site works: what each URL serves, who can reach the real product, how Meta ads unlock `/connect`, how developers test production, and which env vars must match across Render and `platform.env`.

Related guides:

- [domain-migration.md](./domain-migration.md) — generic migration checklist
- [marketing-access.md](./marketing-access.md) — technical `/connect` gating implementation
- [../marketing/meta-ads-setup-guide.md](../marketing/meta-ads-setup-guide.md) — media buyer quick reference

---

## Production URL map

| URL | Who sees it | Gated? |
|-----|-------------|--------|
| `https://mytrustvisa.cards/` | Everyone (Travixa decoy cover site) | No |
| `https://mytrustvisa.cards/connect` | Visitors with valid `tv_ms` marketing session only | **Yes** |
| `https://mytrustvisa.cards/connect/privacypolicy` | Same session as `/connect` | **Yes** |
| `https://mytrustvisa.cards/connect/frequentlyaskedquestions` | Same session as `/connect` | **Yes** |
| `https://api.mytrustvisa.cards` | Nest API (`tmc-backend`) | API auth |
| `https://www.mytrustvisa.cards` | Optional — apex or static host | — |

**Render services:**

| Host | Render service | Serves |
|------|----------------|--------|
| `mytrustvisa.cards` (apex) | `tmc-wallet-app` | Decoy `/` + product `/connect` + `/api/*` BFF proxy |
| `api.mytrustvisa.cards` | `tmc-backend` | Nest API |

> **Critical:** Both apex **and** `api` subdomain must be added as custom domains on Render **and** have DNS CNAME records. If `api.mytrustvisa.cards` does not resolve, the wallet app returns **502** on all backend calls.

---

## DNS checklist (Hostinger / registrar)

| Type | Name | Value | Notes |
|------|------|-------|--------|
| CNAME or ALIAS | `@` | Render hostname for `tmc-wallet-app` | Apex → wallet app |
| CNAME | `www` | `mytrustvisa.cards` or Render `www` target | Optional |
| **CNAME** | **`api`** | **Render hostname for `tmc-backend`** | **Required for wallet to work** |

After DNS propagates, verify:

```bash
curl -s https://api.mytrustvisa.cards/v1/api/settings/public | head
curl -s https://mytrustvisa.cards/api/settings/public | head
```

Both must return JSON — not `Could not resolve host` or `502 fetch failed`.

---

## Who can access what (all cases)

| Visitor action | Result |
|----------------|--------|
| Opens `https://mytrustvisa.cards/` directly | Travixa decoy |
| Types `https://mytrustvisa.cards/connect` manually (no session) | Redirected to `/` (decoy) |
| `/connect?utm_source=instagram` without session | Redirected to `/` |
| `/?utm_source=instagram` without click ID | Decoy — **UTMs never grant access** |
| **Meta/Instagram ad click** → `/?fbclid=...` | Verify → exchange → `/connect` (marketing session) |
| **Google ad click** → `/?gclid=...` (Ads API configured) | Server verify → `/connect` |
| Google ad click but Ads API not configured / gclid not found | Decoy — fail closed |
| `fbclid` on `/connect` directly (no session) | Redirected to `/` — fbclid on `/connect` never grants access |
| Direct `/api/marketing/verify?fbclid=...` without homepage attestation | Blocked → decoy |
| TikTok `ttclid` only | Decoy — no verification API |
| LinkedIn `li_fat_id` only | Decoy — no verification API |
| Valid session + visits `/` | Auto-redirect to `/connect` |
| Valid session + `/connect/*` legal pages | Allowed until session expires |
| **Developer** opens `/api/marketing-test?token=SECRET` | Same session as ad visitors → `/connect` |
| Invalid/missing test secret | 404, no session |
| Session expired | `/connect` blocked → decoy until new ad click or test URL |
| New incognito window → `/connect` | Decoy (no cookie) |

---

## How real Meta ad users reach the product

**Ad destination URL (Meta Ads Manager):**

```text
https://mytrustvisa.cards/
```

Optional UTMs (reporting only):

```text
https://mytrustvisa.cards/?utm_source=instagram&utm_medium=paid&utm_campaign=YOUR_CAMPAIGN
```

**Never use:** `https://mytrustvisa.cards/connect`

### Flow

```text
User clicks Meta/Instagram ad
        ↓
https://mytrustvisa.cards/?fbclid=...&utm_...
        ↓
Middleware → homepage attestation → /api/marketing/verify
        ↓
One-time token (90s) → /api/marketing/exchange
        ↓
Set tv_ms cookie → redirect https://mytrustvisa.cards/connect
        ↓
Trust Card product + Meta Pixel PageView
```

Notes:

- User may see Travixa decoy on `/` for a split second — intentional.
- Meta auto-appends `fbclid` on paid ad clicks.
- UTMs are for analytics only — they do **not** unlock `/connect`.

### Meta Pixel

- **Already installed in code** — loads on `/connect` and `/connect/*` only.
- **Pixel ID:** `2158981564683913`
- **Do not** paste the Meta script on the homepage, Hostinger, or `/connect` manually.
- Verify in Meta Events Manager → Test Events after a real ad click.

---

## Marketing session duration

Controlled by **`MARKETING_SESSION_TTL_MINUTES`** (not hardcoded).

| Profile | Where to set | Recommended value |
|---------|--------------|-------------------|
| Production (Render) | `tmc-wallet-app` env | **`1440`** (24 hours) — real ad users |
| Production (local profile) | `env/profiles/production/platform.env` | **`1440`** (match Render) |
| Development | `env/profiles/development/platform.env` | `15` (optional — faster local testing) |

> **Do not confuse with `WALLET_SESSION_TTL_MS`** in `platform.env` — that controls the **backend wallet API session** after wallet connect (default 30 min). It is unrelated to `/connect` marketing gating.

Same TTL applies to **all** entry paths: Meta ads, Google ads, and developer test URL.

After expiry, `/connect` redirects to the decoy until the user clicks a new ad or a developer uses the test URL again.

---

## Environment variables (must match)

### `tmc-wallet-app` (Render)

```env
NEXT_PUBLIC_APP_URL=https://mytrustvisa.cards
BACKEND_API_URL=https://api.mytrustvisa.cards
NEXT_PUBLIC_MARKETING_URL=https://www.mytrustvisa.cards
NEXT_PUBLIC_PROJECT_ID=<walletconnect project id>
MARKETING_SESSION_SECRET=<long random HMAC secret>
MARKETING_SESSION_TTL_MINUTES=1440
MARKETING_TEST_SECRET=tvmt_<openssl rand -hex 32>   # Render only — never commit
```

`NEXT_PUBLIC_*` are baked at **build time** — redeploy after changes.

### `tmc-backend` (Render)

```env
APP_ORIGIN=https://mytrustvisa.cards
ADMIN_ORIGIN=https://admin.mytrustvisa.cards   # or localhost for local admin
```

### `platform.env` (local / profile templates)

```env
MARKETING_SESSION_TTL_MINUTES=1440
WALLET_SESSION_TTL_MS=1800000   # separate — backend wallet session only
```

Render does **not** read `platform.env` files — mirror `MARKETING_SESSION_TTL_MINUTES` in the Render dashboard.

### WalletConnect Cloud

Allowed origin must include:

```text
https://mytrustvisa.cards
```

---

## Developer production test

Set `MARKETING_TEST_SECRET` on Render (`tmc-wallet-app`) only. **Never commit** the value.

Open in browser (incognito), never link from UI:

```text
https://mytrustvisa.cards/api/marketing-test?token=<MARKETING_TEST_SECRET>
```

| Outcome | Result |
|---------|--------|
| Valid secret | Sets `tv_ms` cookie → redirects to `https://mytrustvisa.cards/connect` |
| Invalid/missing secret | 404 |
| Rate limit | 10 attempts / 15 min / IP |

**Redirect requirement:** `NEXT_PUBLIC_APP_URL` must be `https://mytrustvisa.cards`. Without it, Render may redirect to `localhost:10000/connect` (internal proxy host). Redeploy after fixing.

Local dev:

```text
http://localhost:3000/api/marketing-test?token=<LOCAL_SECRET>
```

---

## Search engine exclusion

Gated routes are excluded from indexing; the decoy homepage `/` remains indexable.

| Layer | Paths |
|-------|-------|
| `robots.txt` | `/connect`, `/api/marketing-test`, `/api/marketing/` |
| HTML `robots` metadata | `/connect/*` |
| `X-Robots-Tag: noindex` | `/connect`, `/connect/*`, marketing API routes |

---

## Post-deploy smoke tests

```bash
# DNS + API
curl -s https://api.mytrustvisa.cards/v1/api/settings/public | head
curl -s https://mytrustvisa.cards/api/settings/public | head

# Decoy vs gated
curl -sI https://mytrustvisa.cards/ | head -3
curl -sI https://mytrustvisa.cards/connect | head -3

# SEO exclusion
curl -s https://mytrustvisa.cards/robots.txt | grep -E 'connect|marketing'
curl -sI https://mytrustvisa.cards/connect | grep -i x-robots-tag
```

**Browser (incognito):**

1. `/connect` → redirects to `/` (decoy)
2. `/api/marketing-test?token=SECRET` → `/connect` (product loads)
3. Real ad preview with `fbclid` in URL → `/connect`
4. WalletConnect modal on `/connect` — no origin error

---

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `502 fetch failed` on wallet app | `api.mytrustvisa.cards` DNS missing | Add CNAME `api` → Render backend; add custom domain on `tmc-backend` |
| Redirect to `localhost:10000/connect` | `NEXT_PUBLIC_APP_URL` wrong or missing | Set `https://mytrustvisa.cards`, redeploy wallet app |
| Ad click stays on decoy | Ad URL is `/connect`, or no `fbclid`, or `MARKETING_SESSION_SECRET` missing | Use `https://mytrustvisa.cards/`; check Render env |
| CORS errors | `APP_ORIGIN` mismatch | Set `APP_ORIGIN=https://mytrustvisa.cards` on backend, redeploy |
| Duplicate `MARKETING_SESSION_TTL_MINUTES` on Render | Two env rows | Keep one row only (`1440` for production) |
| Meta Pixel no events | Pixel only on `/connect` | Complete ad click flow or use test URL first |
| Session expires quickly | `MARKETING_SESSION_TTL_MINUTES` too low | Use `1440` for production ads |

---

## Key implementation files

| File | Role |
|------|------|
| `frontend/website/middleware.ts` | Route gating, click-ID detection |
| `frontend/website/src/lib/marketing/session-config.ts` | `MARKETING_SESSION_TTL_MINUTES` reader |
| `frontend/website/src/lib/marketing/session.ts` | Signed `tv_ms` cookie |
| `frontend/website/src/lib/marketing/public-url.ts` | Public redirect URLs (Render proxy fix) |
| `frontend/website/src/lib/marketing/http.ts` | Redirect helpers using `NEXT_PUBLIC_APP_URL` |
| `frontend/website/src/app/api/marketing-test/route.ts` | Developer test bypass |
| `frontend/website/src/components/ConnectMetaPixel.tsx` | Meta Pixel on `/connect` only |
