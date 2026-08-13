# Domain migration — mytrustvisa.cards (current production)

**Current production domain:** `mytrustvisa.cards`  
**Previous domain:** `trustvisa.cards`

For the generic migration checklist, see [domain-migration.md](./domain-migration.md).

For the **complete** access, security, env, and troubleshooting guide, see:

**[mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md)**

---

## Quick reference

| Role | Hostname |
|------|----------|
| Wallet app (decoy + `/connect`) | `mytrustvisa.cards` |
| API | `api.mytrustvisa.cards` |
| Optional www | `www.mytrustvisa.cards` |

| Old | New |
|-----|-----|
| `https://trustvisa.cards` | `https://mytrustvisa.cards` |
| `https://api.trustvisa.cards` | `https://api.mytrustvisa.cards` |

## Render env (after migration)

**tmc-wallet-app:**

```env
NEXT_PUBLIC_APP_URL=https://mytrustvisa.cards
BACKEND_API_URL=https://api.mytrustvisa.cards
MARKETING_SESSION_TTL_MINUTES=1440
```

**tmc-backend:**

```env
APP_ORIGIN=https://mytrustvisa.cards
```

## Admin verification

Use **Documentation → Domain Migration → Run migration test suite** in the admin panel. Enter `trustvisa.cards` as old domain and `mytrustvisa.cards` as new domain.

## DNS reminder

Both apex **and** `api` subdomain must have CNAME records pointing to Render. Missing `api` DNS is the most common post-migration failure (wallet app 502).
