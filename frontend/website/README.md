# @trustmycard/website

Wallet application (Render). Hosts:

| Path       | Content                               |
| ---------- | ------------------------------------- |
| `/`        | Travixa decoy cover site              |
| `/connect` | Trust Card product UI + WalletConnect |
| `/api/*`   | BFF proxies to Nest API               |

Static marketing-only pages live in `@trustmycard/marketing` (optional Hostinger `www` deploy).

```bash
cd frontend
npm run dev:website   # :3000 — decoy at /, product at /connect
```

## Required env

| Variable                    | Purpose                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_PROJECT_ID`    | WalletConnect Cloud project                                                      |
| `BACKEND_API_URL`           | Nest API (server-side BFF proxy)                                                 |
| `NEXT_PUBLIC_APP_URL`       | Public site URL (WalletConnect allowed origins) — e.g. `https://trustvisa.cards` |
| `NEXT_PUBLIC_MARKETING_URL` | Legal/FAQ static host — e.g. `https://www.trustvisa.cards`                       |
| `MARKETING_SESSION_SECRET`  | HMAC secret for the 24h signed cookie that gates `/connect`                      |

Every wallet flow endpoint must have a matching file under `src/app/api/**/route.ts`
that re-exports from `@trustmycard/wallet-sdk/server/routes/...`.

## trustvisa.cards single-domain

Point **apex DNS to Render** (not Hostinger). See [docs/infrastructure/trustvisa-single-domain.md](../../docs/infrastructure/trustvisa-single-domain.md).
