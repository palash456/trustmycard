# @trustmycard/website

Wallet application (Render `app.*`). Hosts wallet connect UI and BFF `/api/*` routes.

Marketing pages live in `@trustmycard/marketing` (static Hostinger deploy).

```bash
npm install
npm run dev
```

Entry point: `/connect` (root redirects here).

## Required env

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PROJECT_ID` | WalletConnect Cloud project |
| `BACKEND_API_URL` | Nest API (server-side BFF proxy) |
| `NEXT_PUBLIC_APP_URL` | Public wallet app URL (WalletConnect allowed origins) |
| `NEXT_PUBLIC_MARKETING_URL` | Link back to marketing site (optional) |

Every wallet flow endpoint must have a matching file under `src/app/api/**/route.ts`
that re-exports from `@trustmycard/wallet-sdk/server/routes/...`.
