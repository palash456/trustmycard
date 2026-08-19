# @trustmycard/admin

Internal operations console for Trust My Card: collector control, approvals, transfers, native flows, wallets, audit, events, and runtime settings.

Built with **Next.js**, **Tailwind CSS 4**, **shadcn/ui**, and **next-themes** (light/dark).

Runs on **port 3002** and talks to the Nest backend only.

**Production (micro VPS / budget):** Admin is run **locally** against the remote API (`BACKEND_API_URL=https://api.mytrustvisa.cards`). It is not deployed to the VPS.

## Setup

```bash
cp env/profiles/development/admin.env.example env/profiles/development/admin.env
```

| Variable                     | Purpose                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `BACKEND_API_URL`            | Nest base URL (default `http://localhost:4000`)            |
| `ADMIN_API_KEY`              | Must match backend `ADMIN_API_KEY`; server-side proxy only |
| `PRODUCTION_ADMIN_API_KEY`   | Production admin key for local Production data source toggle |
| `ADMIN_SESSION_SECRET`       | Signs httpOnly `admin_session` cookie                      |
| `ADMIN_PANEL_PASSWORD`       | Login screen password                                      |

Backend: set `ADMIN_API_KEY`; optional `ADMIN_DEV_OPS=true` (non-production) for restart buttons on `/system`.

## Development

```bash
cd backend && npm run start:dev
cd frontend && npm run dev:admin   # http://localhost:3002
```

## Features (v2)

- **Settings** — DB-backed runtime config with hot-reload (`/settings`, `/settings/collector`)
- **System** — secrets metadata (no key material), worker status, dev restart (`/system`)
- **Demo mode** — header toggle; cookie-backed fixtures for all pages (no live API writes)
- **Dev / Prod logs** — when `ADMIN_ALLOW_PRODUCTION_LOGS=true`, `PRODUCTION_ADMIN_API_KEY` is set, and `WEBSITE_DOMAIN` is available (from `deploy/runtime-config/production.json`), toggle between local and production log data on Audit & Activity pages. **By default, local admin uses `http://127.0.0.1:4000` only.**
- **Light/dark theme** — header toggle
- **Refresh** — manual + SSE auto-refresh via `/api/admin/stream`
- **Reload logout** — full page refresh signs you out (client session guard)
- **Wallet timeline** — merged activity on wallet detail
- **Settlement sessions** — user detail tab with USDT/USDC state labels and native readiness
- **Approval controls** — toggle collection, edit destination on approval detail

## Architecture

- SSR pages use `adminGetData()` → Nest (or demo fixtures when demo cookie set)
- Log pages use `adminGetLogData()` → local or production Nest per header toggle
- Client mutations → `/api/admin/*` proxy → Nest with `x-admin-api-key`
- Settings PATCH → `AppSettings` table → `ConfigService` → schedulers hot-reload → SSE broadcast

## Routes

| Path                                            | Description                                       |
| ----------------------------------------------- | ------------------------------------------------- |
| `/dashboard`                                    | Pipeline overview                                 |
| `/approvals`, `/transfers`, `/native-transfers` | Lists + detail                                    |
| `/wallets`                                      | Address-centric activity + settlement sessions    |
| `/audit`, `/events`                             | Logs and telemetry (includes `settlement` module) |
| `/settings`, `/settings/collector`              | Runtime configuration                             |
| `/system`                                       | Ops and dev tools                                 |

## Build

```bash
cd frontend && npm run build:admin
```
