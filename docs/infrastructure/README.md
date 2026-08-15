# Infrastructure

Deployment guides and environment reference for Trust My Card production.

## Production deploy

| Guide                                                              | Cost        | Description                                              |
| ------------------------------------------------------------------ | ----------- | -------------------------------------------------------- |
| [deploy/README.md](../../deploy/README.md)                           | **~$6/mo**  | **Current** — 512 MB VPS, micro topology, Caddy TLS, Neon + Upstash |
| [render-budget-production.md](./render-budget-production.md)       | **~$14/mo** | Alternative — 2× Render Starter + Neon + Upstash         |
| [render-hostinger-production.md](./render-hostinger-production.md) | ~$60/mo     | Legacy full split: API, worker, Postgres, Redis, admin   |
| [mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md) | — | **Current production** — domain, access, env, troubleshooting |
| [trustvisa-single-domain.md](./trustvisa-single-domain.md)         | — | **Legacy** decoy + `/connect` layout (pre-2026) |
| [domain-migration.md](./domain-migration.md) | — | Generic domain migration checklist |
| [domain-migration-mytrustvisa.md](./domain-migration-mytrustvisa.md) | — | mytrustvisa.cards migration quick reference |
| [marketing-access.md](./marketing-access.md)                       | — | **Deprecated** — old `/connect` gate implementation |
| [../marketing/meta-ads-setup-guide.md](../marketing/meta-ads-setup-guide.md) | — | Meta / Instagram ads (media buyers) |
| [production-architecture.md](./production-architecture.md)         | —           | Blast-radius zones                                       |

## Environments

| Guide                                | Description                                                     |
| ------------------------------------ | --------------------------------------------------------------- |
| [environments.md](./environments.md) | `TMC_ENV` profiles: development, production-preview, production |

| [secrets.md](./secrets.md) | Env var matrix per service |
| [cloudflare-edge.md](./cloudflare-edge.md) | WAF and admin SSO (optional) |
| [disaster-recovery.md](./disaster-recovery.md) | Backups and rebuild runbook |

## Repo configs

| Path                                               | Purpose                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [deploy/](../../deploy/)                           | **Micro VPS** deploy pipeline, Caddy, compose manifests                                              |
| [render-budget.yaml](../../render-budget.yaml)     | Budget Render blueprint (~$14/mo)                                                                    |
| [render.yaml](../../render.yaml)                   | Full production blueprint (~$60/mo)                                                                  |
| [ecosystem.config.cjs](../../ecosystem.config.cjs) | PM2 all-in-one for local dev                                                                         |
| [env/profiles/](../../env/profiles/)               | Profile env templates (`platform`, `backend-budget`, `website`, `marketing`, `admin`)                |

Marketing is **not** on the VPS — optional static files on Hostinger **www** only. The wallet product runs at `/` on `mytrustvisa.cards`. See [mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md).
