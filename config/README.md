# Platform config templates

| Location                 | Purpose                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `config/platform.env`    | **Single source** for platform-wide config (wallets, collector, chains, Meta Pixel) |
| `env/profiles/$TMC_ENV/` | Per-app infra only (`backend`, `website`, `admin`)                                  |
| `config/load-env.mjs`    | Shared loader (reads `config/platform.env` + profile app env)                       |
| `config/website-domain.mjs` | Resolves `WEBSITE_DOMAIN` and `https://api.<domain>` from runtime config or env |

Run `npm run setup` from repo root to create `config/platform.env` from `platform.env.example` and apply secrets from `env/vault/` when present. Export/push password-protected `env/vault*.zip` for new machines via `npm run setup:export:all`. Never commit live `config/platform.env` or the `env/vault/` folder.

Production `WEBSITE_DOMAIN` / `META_PIXEL_ID` live in `deploy/runtime-config/production.json`. `load-env.mjs` hydrates empty env placeholders from that file.

**Eligibility minimum balances** (`NEXT_PUBLIC_*_MIN_*_BALANCE`) live in `platform.env` — currently all `0`. Mirror in `env/vault/config/platform.env` for production vault sync.

Per-profile app secrets: copy each profile's `*.example` → live name inside `env/profiles/development/` or `env/profiles/production/`.
