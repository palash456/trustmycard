# Infrastructure

Deployment guides and environment reference for Trust My Card production.

## Production deploy

| Guide                                                              | Cost        | Description                                              |
| ------------------------------------------------------------------ | ----------- | -------------------------------------------------------- |
| [render-budget-production.md](./render-budget-production.md)       | **~$14/mo** | **Recommended for launch** — 2× Starter + Neon + Upstash |
| [render-hostinger-production.md](./render-hostinger-production.md) | ~$60/mo     | Full split: API, worker, Postgres, Redis, admin          |
| [mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md) | **Current production** — domain, access, env, troubleshooting |
| [trustvisa-single-domain.md](./trustvisa-single-domain.md)         | Legacy **trustvisa.cards** layout |
| [domain-migration.md](./domain-migration.md) | **Generic** domain migration checklist (DNS + Render + verification) |
| [domain-migration-mytrustvisa.md](./domain-migration-mytrustvisa.md) | **mytrustvisa.cards** migration quick reference |
| [marketing-access.md](./marketing-access.md)                       | `/connect` gating — technical implementation |
| [../marketing/meta-ads-setup-guide.md](../marketing/meta-ads-setup-guide.md) | — | **Meta / Instagram ads** — URL, pixel, UTMs (media buyers) |
| [production-architecture.md](./production-architecture.md)         | —           | Blast-radius zones                                       |

## Environments

| Guide                                | Description                                                     |
| ------------------------------------ | --------------------------------------------------------------- |
| [environments.md](./environments.md) | `TMC_ENV` profiles: development, production-preview, production |

| [secrets.md](./secrets.md) | Env var matrix per Render service |
| [cloudflare-edge.md](./cloudflare-edge.md) | WAF and admin SSO (optional) |
| [disaster-recovery.md](./disaster-recovery.md) | Backups and rebuild runbook |

## Repo configs

| Path                                               | Purpose                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [render-budget.yaml](../../render-budget.yaml)     | **Budget** blueprint (~$14/mo)                                                                       |
| [render.yaml](../../render.yaml)                   | Full production blueprint (~$60/mo)                                                                  |
| [ecosystem.config.cjs](../../ecosystem.config.cjs) | PM2 all-in-one for local dev or legacy VPS                                                           |
| [scripts/render-*.sh](../../scripts/)              | Render build and migrate scripts                                                                     |
| [env/profiles/](../../env/profiles/)               | Profile env templates (`platform`, `backend-api`, `backend-worker`, `website`, `marketing`, `admin`) |

Marketing is **not** on Render — static files upload to Hostinger **www** only when using split legal pages. For **mytrustvisa.cards** decoy + `/connect` on apex, see [mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md).
