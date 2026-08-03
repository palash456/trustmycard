# Platform config templates

| Location | Purpose |
|----------|---------|
| `env/profiles/development/` | Local development templates |
| `env/profiles/production-preview/` | Pre-deploy local verification |
| `env/profiles/production/` | VPS production templates |
| `config/load-env.mjs` | Shared loader (reads profile by `TMC_ENV`) |

Live secrets: copy each profile's `*.example` → live name (e.g. `platform.env`) inside that profile folder. Never commit live files.

**Legacy + profiles:** the loader always reads legacy files first, then overlays the active profile. Existing `config/platform.env` and `*/.env.local` keep working; profile files override matching keys for isolation.

See [docs/infrastructure/environments.md](../docs/infrastructure/environments.md).
