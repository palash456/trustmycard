# @trustmycard/website

Wallet + marketing homepage (single public site).

| Path | Content |
|------|---------|
| `/` | Trust Card homepage + WalletConnect |
| `/frequentlyaskedquestions` | FAQ |
| `/privacypolicy` | Privacy policy |
| `/termsandconditions` | Terms |
| `/api/*` | BFF proxies to Nest API |

```bash
cd frontend
npm run dev:website   # :3000
```

## Required env

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PROJECT_ID` | WalletConnect Cloud project |
| `BACKEND_API_URL` | Nest API (server-side BFF proxy) |
| `NEXT_PUBLIC_APP_URL` | Public site URL (WalletConnect allowed origins) |

Meta Pixel (`META_PIXEL_ID` + `META_PIXEL_APP_URL` in `config/platform.env`) loads when `TMC_ENV=production`, the ID is set, and `NEXT_PUBLIC_APP_URL` matches the canonical origin.

Every wallet flow endpoint must have a matching file under `src/app/api/**/route.ts` that re-exports from `@trustmycard/wallet-sdk/server/routes/...`.
