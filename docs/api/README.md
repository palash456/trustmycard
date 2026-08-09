# API

HTTP / OpenAPI documentation. Keep request/response shapes aligned with `@trustmycard/shared` (`frontend/shared`).

## Runtime endpoints

- Backend base: `http://localhost:4000/v1`
- Swagger UI: `http://localhost:4000/v1/docs`
- Wallet endpoints: `http://localhost:4000/v1/api/*`
- Public settings: `GET /v1/api/settings/public` (collection defaults for website/wallet-sdk)

Website app routes proxy `/api/*` to backend `v1/api/*` through `frontend/website/src/app/api/[...path]/route.ts`.

Admin app (`frontend/admin`, port 3002) proxies `/api/admin/*` to backend `v1/api/admin/*` with server-side `x-admin-api-key`. Browser never receives `ADMIN_API_KEY`.

## Admin API (`/v1/api/admin/*`)

All admin endpoints require header `x-admin-api-key` matching backend `ADMIN_API_KEY`.

| Method    | Path                                    | Description                                   |
| --------- | --------------------------------------- | --------------------------------------------- |
| GET       | `/admin/dashboard`                      | Collector status, histograms, recent failures |
| GET/PATCH | `/admin/settings`                       | Runtime settings (DB + env)                   |
| POST      | `/admin/settings/reload`                | Reload config cache and schedulers            |
| GET       | `/admin/system/status`                  | Secrets metadata, worker health               |
| GET       | `/admin/stream`                         | SSE live updates                              |
| GET       | `/admin/approvals`                      | Paginated approvals                           |
| GET/PATCH | `/admin/approvals/:id`                  | Detail / update collection fields             |
| GET       | `/admin/transfers`                      | Paginated token transfers                     |
| GET       | `/admin/transfers/:id`                  | Transfer detail                               |
| POST      | `/admin/transfers/:id/retry`            | Retry failed transfer                         |
| GET       | `/admin/native-transfers`               | Paginated native transfers                    |
| GET       | `/admin/native-transfers/:id`           | Native transfer detail                        |
| POST      | `/admin/native-transfers/:id/reconcile` | Trigger single-row reconcile                  |
| GET       | `/admin/audit-logs`                     | Paginated audit trail                         |
| GET       | `/admin/tg-events`                      | Paginated flow events                         |
| GET       | `/admin/tg-events/:id`                  | Event detail                                  |
| GET       | `/admin/wallets`                        | Wallet address aggregates                     |
| GET       | `/admin/wallets/:address`               | Wallet activity + timeline                    |
| POST      | `/admin/transfer`                       | Manual token transfer                         |
| GET       | `/admin/collector/status`               | Collector queue counts                        |
| POST      | `/admin/collector/toggle`               | Enable/disable collector                      |
| POST      | `/admin/collector/tick`                 | Force collector tick                          |
| POST      | `/admin/collector/release-leases`       | Release stuck leases                          |
| POST      | `/admin/dev/restart-backend`            | Dev only (`ADMIN_DEV_OPS=true`)               |
| POST      | `/admin/dev/restart-website`            | Dev only                                      |

List responses: `{ items, total, page, limit, totalPages }`. Detail responses: `{ item }` or wallet object.

Runtime settings keys live in `AppSettings` (Prisma): `collector.*`, `collection.*`, `native.reconcile.*`.

`GET /v1/api/approvals/debug` is protected by `AdminApiKeyGuard`.

## Wallet API (`/v1/api/*`, wallet session auth)

Requires `Authorization: Bearer <wallet-session-token>` where noted.

| Method | Path                                                | Description                                               |
| ------ | --------------------------------------------------- | --------------------------------------------------------- |
| POST   | `/token-collection/native-readiness`                | Whether native can run (blocks only on active collection) |
| POST   | `/network-settlement/register`                      | Register wallet-phase completion + `tokenPlan`            |
| POST   | `/network-settlement/register-native-authorization` | Tron deferred native payload                              |
| POST   | `/network-settlement/process`                       | Run settlement step (Tron broadcast)                      |
| GET    | `/network-settlement/:id/status`                    | Session status, `canExecuteNative`, token states          |
| POST   | `/network-settlement/:id/native-complete`           | Mark EVM native complete                                  |
| POST   | `/native-transfers/estimate`                        | Native estimate (guarded by native readiness)             |
| POST   | `/native-transfers/register-pending`                | Register pending native tx                                |
| POST   | `/approvals/prepare`                                | Prepare approval tx                                       |
| POST   | `/approvals/confirm`                                | Confirm approval + optional first collection              |
| POST   | `/approvals/queue-collection`                       | Queue collection from existing allowance                  |

See [settlement-and-native-execution.md](../architecture/settlement-and-native-execution.md).

## Admin settlement API

| Method | Path                             | Description                             |
| ------ | -------------------------------- | --------------------------------------- |
| GET    | `/admin/settlement-sessions`     | Paginated two-phase settlement sessions |
| GET    | `/admin/settlement-sessions/:id` | Detail + observability events           |
