# Domain migration — exampleUrl.com (current production)

**Current production domain:** `exampleUrl.com`  
**Previous domain:** `trustvisa.cards`  
**Current host:** 512 MB DigitalOcean VPS (micro topology + Caddy TLS)

For the generic migration checklist, see [domain-migration.md](./domain-migration.md).

For the **complete** access, security, env, and troubleshooting guide, see:

**[mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md)**

Deploy guide: [deploy/README.md](../../deploy/README.md)

---

## Quick reference

| Role                        | Hostname                |
| --------------------------- | ----------------------- |
| Wallet app (product at `/`) | `exampleUrl.com`     |
| API                         | `api.exampleUrl.com` |
| Optional static marketing   | `www.exampleUrl.com` |

| Old                           | New                             |
| ----------------------------- | ------------------------------- |
| `https://trustvisa.cards`     | `https://exampleUrl.com`     |
| `https://api.trustvisa.cards` | `https://api.exampleUrl.com` |

## Env (after migration)

**website.env (wallet app):**

```env
NEXT_PUBLIC_APP_URL=https://exampleUrl.com
BACKEND_API_URL=https://api.exampleUrl.com
NEXT_PUBLIC_PROJECT_ID=<walletconnect>
```

**backend.env:**

```env
APP_ORIGIN=https://exampleUrl.com
ADMIN_ORIGIN=http://localhost:3002
DATABASE_URL=<Neon>
REDIS_URL=<Upstash>
```

**Removed (legacy gate):** `MARKETING_SESSION_*`, `MARKETING_TEST_SECRET`, `GOOGLE_ADS_*`

## Admin verification

Use **Documentation → Domain Migration → Run migration test suite** in the admin panel. Enter `trustvisa.cards` as old domain and `exampleUrl.com` as new domain.

## DNS reminder

Both apex **and** `api` subdomain must resolve to the VPS IP (A records). Caddy handles TLS. Missing `api` DNS is the most common post-migration failure (wallet app 502).
