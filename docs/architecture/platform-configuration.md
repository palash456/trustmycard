# Platform configuration architecture

## Single source of truth

Platform-wide settings are loaded by [`config/load-env.mjs`](../../config/load-env.mjs) from:

- Platform config: `config/platform.env`

See [environments.md](../infrastructure/environments.md) for `development` and `production`.

## Load flow

```
config/load-env.mjs                (TMC_ENV → profile + legacy overlay)
        ↓
backend/src/config/env.ts          (bootstrap only)
        ↓
platform-config.loader.ts          (sole reader of platform env keys)
        ↓
PlatformConfigService              (validated snapshot at startup)
        ↓
ConfigService                      (platform defaults + AppSettings DB overrides)
        ↓
GET /v1/api/settings/public        (website, wallet-sdk BFF)
Admin APIs / schedulers / services
```

## What belongs where

| Location                                                             | Contents                                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/platform.env`                                                | Platform-wide config (wallets, flags, collector, Meta Pixel)                                                                                |
| `env/profiles/$TMC_ENV/backend.env`                                  | **Infrastructure**: `DATABASE_URL`, `PORT`, `ADMIN_API_KEY`, `REDIS_URL`, `LOG_LEVEL`                                                       |
| `env/profiles/$TMC_ENV/website.env`                                  | **App infra**: `NEXT_PUBLIC_PROJECT_ID`, `BACKEND_API_URL`, Telegram                                                                        |
| `env/profiles/$TMC_ENV/admin.env`                                    | **Admin infra**: session/login secrets, `BACKEND_API_URL`, `ADMIN_API_KEY`                                                                  |
| `AppSettings` (Postgres)                                             | **Runtime admin overrides** of tunable platform keys (collector interval, allow-self-spender, …). Defaults always come from `config/platform.env`. |

## Spender addresses

Derived from private keys at startup — do not duplicate:

- `ADMIN_EVM_PRIVATE_KEY` → `wallets.spenderEvm`
- `ADMIN_TRON_PRIVATE_KEY` → `wallets.spenderTron`

Legacy `NEXT_PUBLIC_SPENDER_*` in `platform.env` are optional; if set they must match derived addresses.

## Frontend rule

Website and wallet-sdk **never own platform config**. They fetch:

```
GET /v1/api/settings/public
```

The response includes `config` (`PublicPlatformConfig`) with wallets, approval defaults, chains, and feature flags.

## Admin panel

- **Settings** page: patches `AppSettings` (runtime overrides). Reloads schedulers in-process.
- **System** page: read-only secrets metadata + live `platform` config snapshot.
- Spender addresses and signing keys are **not** editable in admin UI.

## Key modules

| Module                                          | Role                            |
| ----------------------------------------------- | ------------------------------- |
| `backend/src/config/platform-config.loader.ts`  | Parse + validate platform.env   |
| `backend/src/config/platform-config.service.ts` | Injectable platform snapshot    |
| `backend/src/config/config.service.ts`          | Merged config + admin overrides |
| `frontend/shared/platform-config/types.ts`      | Shared public API types         |

## Restart requirements

| Change                     | Action                    |
| -------------------------- | ------------------------- |
| `platform.env`             | Restart backend + website |
| Admin Settings save        | Hot-reload (no restart)   |
| `backend/.env.local` infra | Restart backend only      |

See also: [change-spender-collector-guide.md](../operations/change-spender-collector-guide.md)
