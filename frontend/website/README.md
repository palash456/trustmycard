# @trustmycard/website

Marketing / public Next.js site.

Wallet integration lives in `@trustmycard/wallet-sdk`. This app only:

1. Builds marketing pages
2. Imports `<ConnectFlow />` (or the connect button) where needed
3. Hosts thin `app/api/*` re-exports until the Nest backend is ready

```bash
npm install
npm run dev
```

For single-wallet local testing (owner = spender/collector), set
`ALLOW_SELF_SPENDER=true` in this app's `.env.local` **and** in
`backend/.env.local`, then restart both servers. Default is off.
