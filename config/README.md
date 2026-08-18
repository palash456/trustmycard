# Platform config templates

| Location                 | Purpose                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `config/platform.env`    | **Single source** for platform-wide config (wallets, collector, chains, Meta Pixel) |
| `env/profiles/$TMC_ENV/` | Per-app infra only (`backend`, `website`, `admin`)                                  |
| `config/load-env.mjs`    | Shared loader (reads `config/platform.env` + profile app env)                       |

Copy `config/platform.env.example` → `config/platform.env` and fill secrets. Never commit live `config/platform.env`.

Per-profile app secrets: copy each profile's `*.example` → live name inside `env/profiles/development/` or `env/profiles/production/`.

See [docs/infrastructure/environments.md](../docs/infrastructure/environments.md).
