# Operations

Runbooks, observability standards, and operator checklists for Trust My Card.

**Terminal commands:** [COMMANDS.md](../COMMANDS.md) — local dev, Docker VPS deploy, config/DB/code-only pushes, admin panel, tests.

## Observability

| Doc                                                                    | Description                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| [observability.md](./observability.md)                                 | Logging, metrics, timelines, sampling, and fail-open rules |
| [admin-observability-migration.md](./admin-observability-migration.md) | Admin UI log sources, deep links, and settlement panels    |

## Runbooks

| Doc                                                                      | Description                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| [change-spender-collector-guide.md](./change-spender-collector-guide.md) | Rotate spender/collector wallet addresses and keys         |
| [i18n-locale-sync.md](./i18n-locale-sync.md)                             | Sync website locales from English (`en.mjs` workflow)      |
| [platform-constants-audit.md](./platform-constants-audit.md)             | Point-in-time audit of platform env constants (2026-07-31) |

## Validation checklists

| Doc                                                            | Description                                    |
| -------------------------------------------------------------- | ---------------------------------------------- |
| [admin-pipeline-validation.md](./admin-pipeline-validation.md) | Manual QA after pipeline or settlement deploys |

## Related

- [Infrastructure](../infrastructure/README.md) — production deploy and secrets
- [Architecture](../architecture/README.md) — settlement and collection design
- [Testing](../testing/test-cases.md) — automated test catalog
