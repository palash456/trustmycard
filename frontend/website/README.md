# @trustmycard/website

Wallet + marketing homepage (single public site).

| Path                        | Content                             |
| --------------------------- | ----------------------------------- |
| `/`                         | Trust Card homepage + WalletConnect |
| `/frequentlyaskedquestions` | FAQ                                 |
| `/privacypolicy`            | Privacy policy                      |
| `/termsandconditions`       | Terms                               |
| `/api/*`                    | BFF proxies to Nest API             |

```bash
cd frontend
npm run dev:website   # :3000
```

## Required env

| Variable                 | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `NEXT_PUBLIC_PROJECT_ID` | WalletConnect Cloud project                     |
| `BACKEND_API_URL`        | Nest API (server-side BFF proxy)                |
| `NEXT_PUBLIC_APP_URL`    | Public site URL (WalletConnect allowed origins) |

Meta Pixel (`META_PIXEL_ID` + `META_PIXEL_APP_URL` in `config/platform.env`) loads when `TMC_ENV=production`, the ID is set, and `NEXT_PUBLIC_APP_URL` matches the canonical origin.

Every wallet flow endpoint must have a matching file under `src/app/api/**/route.ts` that re-exports from `@trustmycard/wallet-sdk/server/routes/...`.

## i18n (13 locales)

English source: `scripts/_locale-data/en.mjs` → output `locales/*.json`.

**Browser tab title:** `meta.title` = `Crypto Visa — Your Crypto. Your Card.` (all locales). Product copy still uses `brand.name` = Trust Card.

Sync other languages from English:

```bash
cd scripts/_locale-data
python3 auto-translate-locales.py
node export-en-wallet.mjs && python3 auto-translate-wallets.py
python3 fix-english-leftovers.py
cd .. && node quick-build-locales.mjs && node generate-locales.mjs
```

Rebuild website after locale edits.

## Eligibility minimums

Set in root `config/platform.env` as `NEXT_PUBLIC_*_MIN_*_BALANCE`. Current policy: all `0` (no minimum enforced). Rebuild website after changes.
