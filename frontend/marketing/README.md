# @trustmycard/marketing

Static marketing site for Hostinger (or any static host). No wallet SDK, no API routes, no secrets.

Wallet connect lives on the wallet app (`app.*` / `@trustmycard/website` on Render).

## Local development

For day-to-day dev, run the wallet app only — the full marketing homepage lives at `/connect`:

```bash
cd frontend
npm run dev:website     # http://localhost:3000/connect — marketing + wallet connect
```

Optional: preview the static Hostinger export separately:

```bash
npm run dev:marketing   # http://localhost:3001 — static marketing package only
```

Copy env once:

```bash
cp env/profiles/development/marketing.env.example env/profiles/development/marketing.env
```

## Production build

```bash
TMC_ENV=production npm run build:marketing
# Upload frontend/marketing/out/ to Hostinger public_html
```

## Env

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Wallet app base URL for all CTAs (dev: `http://localhost:3000`, prod: `https://app.trustmycard.com`) |

Profiles: `env/profiles/development/marketing.env`, `env/profiles/production/marketing.env`
