# mytrustvisa.cards — domain, security & access guide

**Production domain (current):** `mytrustvisa.cards`  
**Legacy domain:** `trustvisa.cards` (migrated)

This is the **single source of truth** for how the live site works: what each URL serves, how ads should point to the product, env vars, DNS, TLS, and troubleshooting.

> **Historical:** The decoy homepage and `/connect` marketing-session gate were removed in 2026. Archive: [trustmycard-marketing-gate-archive](https://github.com/palash456/trustmycard-marketing-gate-archive).

Related guides:

- [domain-migration.md](./domain-migration.md) — generic migration checklist
- [../marketing/meta-ads-setup-guide.md](../marketing/meta-ads-setup-guide.md) — media buyer quick reference
- [../../deploy/README.md](../../deploy/README.md) — micro VPS deploy (Caddy TLS)
- [marketing-access.md](./marketing-access.md) — deprecated technical reference for the old gate

---

## Production URL map

| URL                                                  | What                                | Notes                                                           |
| ---------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| `https://mytrustvisa.cards/`                         | Trust Card homepage + WalletConnect | Public product                                                  |
| `https://mytrustvisa.cards/frequentlyaskedquestions` | FAQ                                 | Public                                                          |
| `https://mytrustvisa.cards/privacypolicy`            | Privacy policy                      | Public                                                          |
| `https://mytrustvisa.cards/termsandconditions`       | Terms                               | Public                                                          |
| `https://mytrustvisa.cards/connect`                  | Removed                             | **404** — use `/` in ads                                        |
| `https://api.mytrustvisa.cards`                      | Nest API                            | `tmc-backend`                                                   |
| `https://www.mytrustvisa.cards`                      | Redirect to apex                    | Caddy **308** → `https://mytrustvisa.cards` (not served on www) |

**Current production host (micro VPS):**

| Host                       | Container           | Serves                            |
| -------------------------- | ------------------- | --------------------------------- |
| `mytrustvisa.cards` (apex) | wallet (via Caddy)  | Next.js wallet app + `/api/*` BFF |
| `api.mytrustvisa.cards`    | backend (via Caddy) | Nest API                          |

Caddy terminates TLS (Let's Encrypt) on ports 80/443 and reverse-proxies to the Docker containers.

### Canonical apex URL (www → apex at the edge)

The wallet app canonical origin is `https://mytrustvisa.cards`. **www must redirect to apex before the application** (308 permanent at Caddy on the VPS, or an equivalent rule at Cloudflare if the zone is proxied):

```
www.mytrustvisa.cards  →  308  →  https://mytrustvisa.cards{path}
                              →  wallet app
                              →  Meta Pixel origin check (META_PIXEL_APP_URL)
```

Do **not** rely on the app to reject `www` — configure the redirect at the reverse proxy / CDN. `deploy/caddy/Caddyfile` includes the `www.mytrustvisa.cards` → apex redirect when `www` DNS points to the VPS.

If Cloudflare proxies the zone, add a matching **Redirect Rule** (308) there as well so the redirect happens before origin.

---

## DNS checklist

> **Important:** Use **Cloudflare** (or another DNS provider) for production. Do not attach Hostinger shared hosting to this domain — it triggers automated phishing scans on crypto wallet sites. See [hosting-abuse-resilience.md](./hosting-abuse-resilience.md).

| Type | Name  | Value                    | Notes                                                           |
| ---- | ----- | ------------------------ | --------------------------------------------------------------- |
| A    | `@`   | VPS IP (`159.89.170.92`) | Apex → wallet (via Caddy)                                       |
| A    | `api` | VPS IP                   | API subdomain → backend (via Caddy)                             |
| A    | `www` | VPS IP (same as apex)    | Caddy 308 → `https://mytrustvisa.cards` — not wallet app on www |

Disconnect any Hostinger **connected website** / `public_html` for this domain.

After DNS propagates:

```bash
curl -s https://api.mytrustvisa.cards/v1/api/settings/public | head
curl -s https://mytrustvisa.cards/api/settings/public | head
curl -sI http://mytrustvisa.cards/ | grep -i location   # HTTP → HTTPS redirect
curl -sI https://www.mytrustvisa.cards/ | head -5        # 308 → https://mytrustvisa.cards/
```

Both HTTPS endpoints must return JSON — not `Could not resolve host` or `502 fetch failed`.

---

## Who can access what

| Visitor action                                             | Result                      |
| ---------------------------------------------------------- | --------------------------- |
| Opens `https://mytrustvisa.cards/`                         | Trust Card product (public) |
| Opens `https://mytrustvisa.cards/connect`                  | **404** — route removed     |
| Opens `https://mytrustvisa.cards/frequentlyaskedquestions` | FAQ (public)                |
| **Meta/Instagram ad click** → `/?fbclid=...`               | Lands on product at `/`     |
| Opens site in incognito                                    | Same — no gating            |

There is **no** marketing-session gate. All visitors see the product at `/`.

---

## Meta ads

**Ad destination URL:**

```text
https://mytrustvisa.cards/
```

Optional UTMs (reporting only):

```text
https://mytrustvisa.cards/?utm_source=instagram&utm_medium=paid&utm_campaign=YOUR_CAMPAIGN
```

`/connect` was removed — use `/` in all ads.

### Meta Pixel

- Installed in code via `MetaPixel` in the root layout — loads on all public pages.
- **Pixel ID:** `See META_PIXEL_ID in the file platform.env in config`
- Do not paste a second copy on Hostinger static marketing or in ad dashboards.
- Verify in Meta Events Manager → Test Events after a real ad click.

---

## Environment variables

### Wallet app (`website.env` / Docker / Render)

```env
NEXT_PUBLIC_APP_URL=https://mytrustvisa.cards
BACKEND_API_URL=https://api.mytrustvisa.cards
NEXT_PUBLIC_PROJECT_ID=<walletconnect project id>
```

`NEXT_PUBLIC_*` are baked at **build time** — redeploy after changes.

**Removed (legacy gate):** `MARKETING_SESSION_*`, `MARKETING_TEST_SECRET`, `GOOGLE_ADS_*`

### Backend (`backend.env` + `config/platform.env`)

```env
APP_ORIGIN=https://mytrustvisa.cards
ADMIN_ORIGIN=http://localhost:3002   # admin runs locally on micro/budget
DATABASE_URL=<Neon pooled URL>
REDIS_URL=<Upstash rediss URL>
```

### WalletConnect Cloud

Allowed origin must include:

```text
https://mytrustvisa.cards
```

---

## Post-deploy smoke tests

```bash
# DNS + API + BFF
curl -s https://api.mytrustvisa.cards/v1/api/settings/public | head
curl -s https://mytrustvisa.cards/api/settings/public | head

# TLS + redirects
curl -sI http://mytrustvisa.cards/ | head -5          # 308 → HTTPS
curl -sI https://mytrustvisa.cards/connect | head -5  # 404

# Containers (on VPS)
ssh root@<VPS_IP> 'docker ps'
```

**Browser (incognito):**

1. `https://mytrustvisa.cards/` — product loads, WalletConnect works
2. `https://mytrustvisa.cards/connect` — **404**
3. Legal pages load at `/frequentlyaskedquestions`, `/privacypolicy`

---

## Common failures

| Symptom                          | Cause                                       | Fix                                                             |
| -------------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| `502 fetch failed` on wallet app | `api.mytrustvisa.cards` DNS or backend down | Check DNS A record; `docker ps` on VPS; Caddy logs              |
| WalletConnect origin error       | `NEXT_PUBLIC_APP_URL` wrong                 | Set `https://mytrustvisa.cards`, rebuild wallet image, redeploy |
| CORS errors                      | `APP_ORIGIN` mismatch                       | Set `APP_ORIGIN=https://mytrustvisa.cards` on backend, redeploy |
| HTTP not redirecting             | Caddy not running                           | `./deploy.sh production --provider=docker-vps`                  |
| Cert renewal issues              | Port 80 blocked                             | Ensure Caddy binds 80/443; DNS points to VPS                    |

---

## Key implementation files

| File                                            | Role                         |
| ----------------------------------------------- | ---------------------------- |
| `frontend/website/src/app/page.tsx`             | Product homepage             |
| `frontend/website/src/components/MetaPixel.tsx` | Meta Pixel (production only) |
| `deploy/caddy/Caddyfile`                        | Caddy TLS + reverse proxy    |
| `deploy/compose/docker-compose.micro-edge.yml`  | Caddy service on VPS         |
