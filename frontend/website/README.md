# @trustmycard/website

Wallet + marketing homepage (single public site).

| Path | Content |
|------|---------|
| `/` | Trust Card homepage + WalletConnect |
| `/frequentlyaskedquestions` | FAQ |
| `/privacypolicy` | Privacy policy |
| `/termsandconditions` | Terms |
| `/api/*` | BFF proxies to Nest API |

Legacy `/connect` URLs redirect to `/` (see `next.config.ts`).

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
| `NEXT_PUBLIC_MARKETING_URL` | Optional separate static marketing host |

Meta Pixel (`META_PIXEL_ID` in **production** `platform.env` only) loads on the live site when `TMC_ENV=production`. Not used in local dev or preview.

Every wallet flow endpoint must have a matching file under `src/app/api/**/route.ts` that re-exports from `@trustmycard/wallet-sdk/server/routes/...`.
