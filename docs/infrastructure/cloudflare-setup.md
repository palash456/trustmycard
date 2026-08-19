# Cloudflare setup — micro VPS + Caddy + Docker

**Current production stack:** DigitalOcean VPS (`159.89.170.92`) · Docker Compose (micro topology) · Caddy TLS · Neon Postgres · Upstash Redis.

This guide replaces the old [cloudflare-edge.md](./cloudflare-edge.md) with step-by-step instructions that match the actual running system.

> **Why Cloudflare?** DNS-only Cloudflare (grey-cloud) gives you fast propagation and registrar-level resilience. Adding the orange-cloud proxy gives WAF, DDoS protection, and hides your VPS IP — the strongest counter to abuse-driven host bans. Both modes are covered below.

---

## Architecture overview

```
                    ┌─────────────────────────┐
  User              │  Cloudflare edge         │
  ──────────────►   │  DNS / proxy / WAF       │
                    └────────────┬────────────┘
                                 │ orange-cloud proxy (optional)
                                 ▼
                    ┌─────────────────────────┐
                    │  VPS 159.89.170.92       │
                    │  ports 80 + 443          │
                    │                          │
                    │  ┌─────────────────────┐ │
                    │  │ Caddy (TLS, reverse │ │
                    │  │ proxy, www→apex 308)│ │
                    │  └──────────┬──────────┘ │
                    │             │             │
                    │     ┌───────┴────────┐    │
                    │     │                │    │
                    │  wallet:3000    backend:4000
                    │  (Next.js)      (NestJS)  │
                    └─────────────────────────┘
```

Docker compose files involved: `docker-compose.micro.yml` + `docker-compose.micro-edge.yml` (Caddy) + `docker-compose.external-data.yml` (Neon + Upstash).

---

## Step 1 — Add the site to Cloudflare (DNS mode first)

1. Sign in to [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site**.
2. Enter your production domain (e.g. `mytrustvisa.cards`).
3. Choose the **Free** plan (sufficient for WAF basics).
4. Cloudflare will scan your existing DNS records. Review them:

| Type | Name | Value | Proxy |
| ---- | ---- | ----- | ----- |
| A | `@` (apex) | `159.89.170.92` | Grey (DNS-only) first |
| A | `api` | `159.89.170.92` | Grey (DNS-only) first |
| A | `www` | `159.89.170.92` | Grey (DNS-only) first |

5. **Update your domain's nameservers** at your registrar (Namecheap, Google Domains, etc.) to the two Cloudflare nameservers shown. This is the only nameserver change needed — do NOT keep Hostinger as the DNS provider.

6. Wait for nameserver propagation (minutes to a few hours). Verify:

```bash
dig NS yourdomain.com +short
# Should return kira.ns.cloudflare.com / ivan.ns.cloudflare.com (or similar)
```

---

## Step 2 — Verify Caddy TLS still works (grey-cloud / DNS-only)

With Cloudflare in DNS-only mode, Caddy fetches Let's Encrypt certs directly. No changes needed to Docker or the Caddyfile.

```bash
# From your dev machine
curl -sI https://yourdomain.com/ | head -5       # 200 from wallet
curl -sI https://api.yourdomain.com/v1/api/settings/public | head -5  # 200
curl -sI https://www.yourdomain.com/ | head -5   # 308 → apex
```

If this works, DNS is correctly pointing at the VPS. You can stop here (DNS-only) or continue to Step 3 for the proxy/WAF.

---

## Step 3 — Enable Cloudflare proxy (orange-cloud)

> **Important:** Switch SSL mode to Full (strict) BEFORE enabling the proxy. If you enable proxy first, Cloudflare cannot reach origin via HTTPS and shows a 526 error.

### 3a. Set SSL/TLS mode

Cloudflare dashboard → **SSL/TLS** → **Overview** → select **Full (strict)**.

This tells Cloudflare to verify Caddy's Let's Encrypt certificate. Caddy handles TLS natively so this always passes.

### 3b. Enable proxy on DNS records

Cloudflare → **DNS** → toggle proxy for:

| Record | Proxy | Notes |
| ------ | ----- | ----- |
| `@` (apex) | ✅ Orange | Hides VPS IP; WAF applies |
| `api` | ✅ Orange | Rate limiting applies |
| `www` | ✅ Orange | Cloudflare sees 308 from Caddy, follows it |

Do **not** proxy records that shouldn't be public (e.g. admin, which runs locally).

### 3c. Caddy already has Cloudflare trusted-proxy support

The Caddyfile template (`deploy/caddy/Caddyfile`) already includes:

```caddy
trusted_proxies cloudflare
header_up X-Forwarded-Proto https
```

This means when you redeploy, Caddy will accept real visitor IPs from Cloudflare's `CF-Connecting-IP` header and forward them correctly to the backend. No extra Docker changes needed.

Redeploy to apply:

```bash
./deploy.sh production --provider=docker-vps
```

Or a config-only restart if you only changed env (no image change):

```bash
# on VPS
cd /opt/tmc-deploy
docker compose restart caddy
```

### 3d. Add the Cloudflare Origin Certificate (alternative to Let's Encrypt)

When Cloudflare proxies the zone, you can optionally use a **Cloudflare Origin Certificate** (15-year validity, no renewal needed) instead of Let's Encrypt.

> This is optional — Caddy's auto-HTTPS with Let's Encrypt works fine behind Cloudflare in Full (strict) mode.

If you prefer Origin Certs:

1. Cloudflare → **SSL/TLS** → **Origin Server** → **Create Certificate**.
2. Save the certificate (`.pem`) and private key (`.key`) to the VPS, e.g. `/etc/caddy/cf-origin.pem` and `/etc/caddy/cf-origin.key`.
3. Update `deploy/caddy/Caddyfile` to use them (requires Caddyfile customisation outside the compiler template — maintain manually on VPS only).

For simplicity, stick with auto-HTTPS (Let's Encrypt) — it works correctly behind Cloudflare.

---

## Step 4 — WAF rules

Cloudflare → **Security** → **WAF** → **Custom rules**.

### Rate limiting (most important)

| Rule name | Expression | Action | Threshold |
| --------- | ---------- | ------ | --------- |
| Rate limit approvals | `http.request.uri.path contains "/api/approvals"` | Block | 30 req / min per IP |
| Rate limit auth | `http.request.uri.path contains "/api/auth"` | Block | 20 req / min per IP |
| Rate limit tron-approve | `http.request.uri.path contains "/api/tron-approve"` | Block | 10 req / min per IP |
| Rate limit API | `http.host eq "api.yourdomain.com"` | Block | 200 req / min per IP |

### Managed rules

Cloudflare → **Security** → **WAF** → **Managed rules** → enable **Cloudflare Managed Ruleset** (free tier includes basic protections).

### Bot fight mode

Cloudflare → **Security** → **Bots** → enable **Bot Fight Mode** (free). This blocks obvious scraping bots that trigger phishing false positives.

---

## Step 5 — Page rules / Redirect rules

### Force HTTPS (belt-and-suspenders)

Cloudflare → **Rules** → **Redirect Rules** → **Create rule**:

- If: `http.request.uri.scheme eq "http"`
- Then: Redirect to `https://${http.host}${http.request.uri.path}` — 308 permanent.

(Caddy already does this, but Cloudflare's redirect saves an origin round-trip.)

### Protect `/api/` from public crawlers

Cloudflare → **Security** → **WAF** → **Custom rules**:

- Expression: `http.request.uri.path starts_with "/api/" and not cf.client.bot_score gte 30`
- Action: **JS Challenge** (challenges suspicious automated clients without blocking real users).

---

## Step 6 — Cloudflare Access for admin (optional, recommended)

The admin panel runs locally (`localhost:3002`) in micro topology — it is **not** exposed on the VPS. No Cloudflare Access needed for the current setup.

If you ever expose admin on a subdomain (`admin.yourdomain.com`):

1. Cloudflare → **Zero Trust** → **Access** → **Applications** → **Add application**.
2. Type: Self-hosted. Domain: `admin.yourdomain.com`.
3. Policy: Require email from your company domain (e.g. `@yourdomain.com`) + TOTP.
4. Set on backend env: `ADMIN_IDENTITY_HEADER=cf-access-authenticated-user-email`

---

## Step 7 — Verify everything after enabling proxy

```bash
# Real visitor IP should appear in logs (not Cloudflare IP)
ssh root@VPS_IP 'docker logs tmc-production-micro-backend-1 --tail 20 | grep "x-forwarded"'

# TLS via Cloudflare
curl -sI https://yourdomain.com/ | grep -i "cf-ray"    # CF-Ray header confirms proxying

# API still works through proxy
curl -s https://api.yourdomain.com/v1/api/settings/public | head

# www redirect
curl -sI https://www.yourdomain.com/ | head -5   # 308 from Caddy (or Cloudflare)

# security.txt (new endpoint)
curl -s https://yourdomain.com/.well-known/security.txt
```

---

## Deployment flow summary (with Cloudflare)

```
1. Change WEBSITE_DOMAIN in config/platform.env (if needed)
2. npm run domain:migrate   ← dry-run compile check
3. ./deploy.sh production --provider=docker-vps
   └─ compiles Caddyfile with trusted_proxies cloudflare
   └─ builds + deploys Docker images
   └─ Caddy restarts, requests Let's Encrypt cert via DNS
4. Update Cloudflare DNS records (A → VPS IP)
5. Enable Cloudflare proxy (orange-cloud) on @, api, www
6. Confirm SSL/TLS = Full (strict)
7. Run smoke tests above
```

---

## Environment variables — nothing extra needed

The Caddyfile is compiled by `deploy/core/config-compiler.mjs` from `WEBSITE_DOMAIN`. The `trusted_proxies cloudflare` directive is now part of the template. No additional env vars are required for Cloudflare.

The new site identity vars (used for footer + security.txt) live in `config/platform.env`:

```env
NEXT_PUBLIC_LEGAL_NAME="Your Company Ltd."
NEXT_PUBLIC_SUPPORT_EMAIL="support@yourdomain.com"
PLATFORM_SECURITY_EMAIL="security@yourdomain.com"
```

These are compiled into the wallet Docker image at build time.

---

## If Cloudflare proxy causes issues

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| 526 Invalid SSL | SSL mode not Full (strict) | Set SSL/TLS → Full (strict) before enabling proxy |
| 524 Timeout | Caddy or container not running | `docker ps` on VPS; check `docker logs tmc-production-micro-caddy-1` |
| WalletConnect origin error | `NEXT_PUBLIC_APP_URL` mismatch | Must be `https://yourdomain.com`; rebuild wallet image |
| CORS on API | `APP_ORIGIN` mismatch | Set `APP_ORIGIN=https://yourdomain.com` on backend, redeploy |
| Real IP shows Cloudflare | `trusted_proxies` missing | Already in Caddyfile — redeploy to apply |

---

## Related docs

- [mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md) — URL map and env vars
- [hosting-abuse-resilience.md](./hosting-abuse-resilience.md) — why Cloudflare replaces Hostinger
- [deploy/README.md](../../deploy/README.md) — full micro VPS deploy guide
- [disaster-recovery.md](./disaster-recovery.md) — failover and backup
