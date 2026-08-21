# Hosting abuse resilience — avoid phishing suspensions

**Problem:** Hostinger (and similar shared hosts) auto-flag crypto wallet sites — especially domains with financial-brand keywords, WalletConnect flows, and token-approval UX. A suspension can take down DNS, hosting, and the whole account.

**Goal:** Architecture where a Hostinger ban does **not** kill production, and where automated scanners see a legitimate fintech site instead of a drainer pattern.

---

## Why you were flagged (likely triggers)

| Signal | Why scanners care |
| ------ | ----------------- |
| Domain names like `*visa*` / `*trust*card*` | Brand impersonation (Visa, card issuers) |
| WalletConnect + USDT `approve` to a platform spender | Same UX as crypto drainers |
| Meta ads → wallet connect landing page | Common phishing funnel |
| **Decoy homepage** hiding product (legacy Travixa gate) | Classic phishing technique — removed in 2026 |
| Files on **Hostinger shared hosting** (`public_html`) | Aggressive scanning; crypto content = fast suspension |
| Apex DNS → VPS **and** Hostinger "connected website" on same domain | Conflicting origins; scanners crawl both |

Repeated bans usually mean the **account** is flagged, not just one domain. Moving the same product to a fourth domain on Hostinger often fails again.

---

## Solid architecture (current recommendation)

```text
Registrar/DNS:  Cloudflare (or Namecheap DNS) — NOT Hostinger hosting
Edge (optional): Cloudflare proxy → VPS (WAF, DDoS, redirect rules)
App host:        FlokiNET VPS (512 MB micro topology)
TLS:             Caddy + Let's Encrypt (deploy/caddy/Caddyfile)
Database:        Neon Postgres
Queue:           Upstash Redis
Marketing:       Same wallet app at apex `/` — NO separate Hostinger static zip
Admin:           Local or separate locked-down host
```

**Rule:** Hostinger is **never** used for hosting or DNS in production. If you still own domains there, transfer DNS to Cloudflare and cancel web hosting plans.

### DNS records (example)

| Type | Name | Value | Notes |
| ---- | ---- | ----- | ----- |
| A | `@` | VPS IP | Apex → Caddy → wallet |
| A | `api` | VPS IP | API subdomain |
| A | `www` | VPS IP | Caddy 308 → apex |

Do **not** use Hostinger's "Connect website" or point apex at Hostinger shared-hosting IPs.

---

## Step-by-step recovery after a ban

### 1. Keep production alive (DNS is the critical path)

1. Identify where DNS is managed (Hostinger panel vs Cloudflare).
2. If Hostinger locked DNS, **transfer the domain** to Cloudflare Registrar or Namecheap (support ticket + ICANN transfer if needed).
3. Point `@`, `api`, and `www` A records to the VPS IP (`185.246.190.34` — see `deploy/provider.credentials.env` → `VPS_HOST`).
4. Redeploy if you changed `WEBSITE_DOMAIN` in `config/platform.env`:

   ```bash
   # Set WEBSITE_DOMAIN in config/platform.env, then:
   npm run domain:migrate   # dry-run / compile check
   ./deploy.sh production --provider=docker-vps
   ```

5. Smoke test:

   ```bash
   curl -sI https://www.YOUR_DOMAIN/ | head -5    # 308 → apex
   curl -s https://api.YOUR_DOMAIN/v1/api/settings/public | head
   curl -s https://YOUR_DOMAIN/api/settings/public | head
   ```

### 2. Stop using Hostinger hosting entirely

- Delete or disconnect any site from **Websites → public_html**.
- Cancel **Web Hosting** plans (keep domain registration elsewhere).
- Never upload `frontend/marketing/out` to Hostinger again — the wallet app **is** the marketing site at `/`.

### 3. Pick a domain that won't auto-flag

Avoid:

- `*visa*`, `*mastercard*`, `*paypal*`, `*bank*`
- Typosquats of major brands
- `.cards` TLD if combined with brand-like names (higher scrutiny)

Prefer:

- Your registered company name
- Clear product name without impersonating issuers
- `.com` or `.io` with established WHOIS (real org, address, email)

Update `WEBSITE_DOMAIN` in `config/platform.env` and run domain migration (see [domain-migration.md](./domain-migration.md)).

### 4. Prove legitimacy (for appeals and long-term)

Prepare a **business packet** (PDF) you can send to any host/registrar:

- Company registration / trade license
- Director ID (if required)
- Clear description: "Self-custodial wallet card product; users sign token approvals on-chain to their own card balance"
- Link to live Terms, Privacy, FAQ on the **same domain**
- Support email on the same domain (e.g. `support@yourdomain.com`)
- WalletConnect Cloud project listing with verified domain
- Meta Business Manager verification (if running ads)

**Appeal email tips:**

- State you removed decoy/gated pages (if applicable)
- State apex serves one transparent product (no hidden `/connect` gate)
- Offer to add clearer in-app disclosure before `approve` transactions
- Do not mention "ads" or "cloaking" in abuse tickets

### 5. Product signals that reduce false positives

Already in repo (keep maintained):

- Public legal pages: `/privacypolicy`, `/termsandconditions`, `/frequentlyaskedquestions`
- No `noindex` on the main product page
- Meta Pixel only in app code (not duplicated on static hosts)
- Decoy / marketing-session gate **removed** (2026)

Consider adding:

- Visible company name and support contact in footer
- Pre-approval modal explaining spender address and what approval allows
- `/.well-known/security.txt` with security contact

### 6. Failover without Hostinger

| Asset | Primary | Failover |
| ----- | ------- | -------- |
| DNS | Cloudflare | Secondary Cloudflare account / Namecheap |
| App | FlokiNET VPS | New VPS + `./deploy.sh production --fresh --provider=docker-vps` |
| Static marketing | Wallet app at `/` | Cloudflare Pages (same `out/` if needed) |
| Domain | Cloudflare Registrar | Pre-register backup domain, cold standby |

See [disaster-recovery.md](./disaster-recovery.md).

---

## What NOT to do

| Action | Risk |
| ------ | ---- |
| Re-register same product on Hostinger with a new `*visa*` domain | Account-level ban loop |
| Upload wallet app or marketing to `public_html` | Automated crypto/phishing scan |
| Run decoy page + hidden wallet product | Definite phishing classification |
| Point ads to obscure paths while homepage shows different content | Platform + host abuse |
| Rely on Hostinger for DNS only without backup export | Ban locks DNS during transfer |

---

## Checklist before every production deploy

- [ ] `WEBSITE_DOMAIN` in `config/platform.env` matches live DNS apex
- [ ] No Hostinger website attached to this domain
- [ ] DNS A records → VPS only (not Hostinger shared IP)
- [ ] `www` → apex redirect at Caddy (or Cloudflare), not separate static host
- [ ] WalletConnect allowed origin = `https://{WEBSITE_DOMAIN}`
- [ ] `APP_ORIGIN` / `NEXT_PUBLIC_APP_URL` match apex
- [ ] Legal pages load on production domain
- [ ] `./deploy.sh` verify step passes
- [ ] Abuse packet PDF updated if domain or company details changed

---

## Related docs

- [deploy/README.md](../../deploy/README.md) — micro VPS deploy
- [mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md) — URL map and env vars
- [domain-migration.md](./domain-migration.md) — change production domain
- [cloudflare-edge.md](./cloudflare-edge.md) — superseded by [cloudflare-setup.md](./cloudflare-setup.md)
