# Domain migration — mytrustvisa.cards (current production)

**Current production domain:** `mytrustvisa.cards`  
**Previous domain:** `trustvisa.cards`  
**Current host:** 512 MB DigitalOcean VPS (micro topology + Caddy TLS)

For the generic migration checklist, see [domain-migration.md](./domain-migration.md).

For the **complete** access, security, env, and troubleshooting guide, see:

**[mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md)**

Deploy guide: [deploy/README.md](../../deploy/README.md)

---

## Quick reference

| Role | Hostname |
|------|----------|
| Wallet app (product at `/`) | `mytrustvisa.cards` |
| API | `api.mytrustvisa.cards` |
| Optional static marketing | `www.mytrustvisa.cards` |

| Old | New |
|-----|-----|
| `https://trustvisa.cards` | `https://mytrustvisa.cards` |
| `https://api.trustvisa.cards` | `https://api.mytrustvisa.cards` |

## Env (after migration)

**website.env (wallet app):**

```env
NEXT_PUBLIC_APP_URL=https://mytrustvisa.cards
BACKEND_API_URL=https://api.mytrustvisa.cards
NEXT_PUBLIC_PROJECT_ID=<walletconnect>
```

**backend-budget.env:**

```env
APP_ORIGIN=https://mytrustvisa.cards
ADMIN_ORIGIN=http://localhost:3002
DATABASE_URL=<Neon>
REDIS_URL=<Upstash>
```

**Removed (legacy gate):** `MARKETING_SESSION_*`, `MARKETING_TEST_SECRET`, `GOOGLE_ADS_*`

## Admin verification

Use **Documentation → Domain Migration → Run migration test suite** in the admin panel. Enter `trustvisa.cards` as old domain and `mytrustvisa.cards` as new domain.

## DNS reminder

Both apex **and** `api` subdomain must resolve to the VPS IP (A records). Caddy handles TLS. Missing `api` DNS is the most common post-migration failure (wallet app 502).
