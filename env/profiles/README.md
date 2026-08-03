# Trust My Card environment profiles

## File layout (same for every profile)

```
env/profiles/
  development/           TMC_ENV=development
  production-preview/    TMC_ENV=production-preview
  production/            TMC_ENV=production
    platform.env.example   → copy to platform.env   (wallets, collector, chains)
    backend.env.example    → copy to backend.env    (DATABASE_URL, REDIS_URL, ADMIN_API_KEY)
    website.env.example    → copy to website.env    (BACKEND_API_URL, NEXT_PUBLIC_*)
    admin.env.example      → copy to admin.env      (BACKEND_API_URL, admin login secrets)
```

**Wallet SDK** has no separate env file. It runs inside the website and uses `website.env` + `platform.env`.

## Database URLs (set in `backend.env`)

| Profile | DATABASE_URL |
|---------|--------------|
| development | `postgresql://postgres:password@localhost:5432/trustmycard?schema=public` |
| production-preview | `postgresql://postgres:password@localhost:5432/trustmycard_preview?schema=public` |
| production | `postgresql://trustmycard:YOUR_PASSWORD@127.0.0.1:5432/trustmycard?schema=public` |

## Setup

```bash
PROFILE=development   # or production-preview, production

cp env/profiles/$PROFILE/platform.env.example env/profiles/$PROFILE/platform.env
cp env/profiles/$PROFILE/backend.env.example   env/profiles/$PROFILE/backend.env
cp env/profiles/$PROFILE/website.env.example   env/profiles/$PROFILE/website.env
cp env/profiles/$PROFILE/admin.env.example     env/profiles/$PROFILE/admin.env
# Edit live files — never commit them
```

## Switch environments

Run the matching npm script (sets `TMC_ENV` automatically):

| Goal | Commands |
|------|----------|
| Development | `npm run start:dev`, `npm run dev:website`, `npm run dev:admin` |
| Production preview | `npm run preview`, `npm run preview:website`, `npm run preview:admin` |
| Production (VPS) | PM2 + `ecosystem.config.cjs` |

Loader: [`config/load-env.mjs`](../../config/load-env.mjs). Legacy `config/platform.env` and `*/.env.local` still work; profile files override matching keys.

See [docs/infrastructure/environments.md](../../docs/infrastructure/environments.md).
