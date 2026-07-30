# @trustmycard/website

Marketing / public Next.js site.

Wallet integration lives in `@trustmycard/wallet-sdk`. This app only:

1. Builds marketing pages
2. Imports `<ConnectFlow />` (or the connect button) where needed
3. Hosts thin `app/api/*` re-exports from wallet-sdk BFF handlers

Every wallet flow endpoint must have a matching file under `src/app/api/**/route.ts`
that re-exports from `@trustmycard/wallet-sdk/server/routes/...`. Do **not** add a
catch-all proxy to the Nest backend — several routes use in-memory BFF logic, and
observability ingest is at `/v1/client-logs` (not `/v1/api/client-logs`).

```bash
npm install
npm run dev
```

## Required env (`.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PROJECT_ID` | WalletConnect Cloud project |
| `NEXT_PUBLIC_SPENDER_TRON` / `NEXT_PUBLIC_SPENDER_EVM` | Allowance spender addresses |
| `BACKEND_API_URL` | Nest API for confirm, native transfers, resources, client-log proxy (default `http://localhost:4000`) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Optional tg-log notifications |

For single-wallet local testing (owner = spender/collector), set
`ALLOW_SELF_SPENDER=true` in this app's `.env.local` **and** in
`backend/.env.local`, then restart both servers. Default is off.
