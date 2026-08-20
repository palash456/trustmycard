# Trustvisa.cards — single-domain deploy (legacy)

> **Deprecated (2026):** This document describes the old decoy + gated `/connect` layout. The product now lives at `/` on `exampleUrl.com`. Archive: [trustmycard-marketing-gate-archive](https://github.com/palash456/trustmycard-marketing-gate-archive). See [mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md) for current production.

Your **old** desired setup:

| URL                                                        | What                                           |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `https://trustvisa.cards/`                                 | Travixa **decoy**                              |
| `https://trustvisa.cards/connect`                          | Trust Card **product** (wallet + marketing UI) |
| `https://trustvisa.cards/connect/frequentlyaskedquestions` | FAQ                                            |
| `https://trustvisa.cards/connect/privacypolicy`            | Privacy Policy                                 |
| `https://trustvisa.cards/connect/termsandconditions`       | Terms & Conditions                             |

This is implemented in **`frontend/website`** (`(decoy)/` + `/connect`), **not** in the Hostinger static marketing zip.

---

## Why Hostinger shows the wrong site

You uploaded **`frontend/marketing/out`** to Hostinger and pointed **`trustvisa.cards`** there.

That package is a **static marketing-only** site. It has no decoy and no `/connect` route.

The decoy and wallet flow require the **Next.js wallet app** on a Node host (Render).

---

## Correct DNS layout

| Host                                 | Points to                         | Serves                                        |
| ------------------------------------ | --------------------------------- | --------------------------------------------- |
| **`trustvisa.cards`** (apex)         | **Render** `tmc-wallet-app`       | Decoy `/` + product `/connect` + `/api/*` BFF |
| **`www.trustvisa.cards`** (optional) | Redirect to apex **or** Hostinger | Prefer apex `/connect/*` legal pages          |
| **`api.trustvisa.cards`**            | Render `tmc-api`                  | Nest API                                      |
| **`admin.trustvisa.cards`**          | Render `tmc-admin`                | Admin                                         |

### Step 1 — Deploy Render (if not done)

1. Create **Neon** Postgres + **Upstash** Redis (free tiers) — see [render-budget-production.md](./render-budget-production.md).
2. Render → **New Blueprint** → use **`render-budget.yaml`** (~$14/mo) or `render.yaml` (full ~$60/mo).
3. Set secrets on `tmc-backend` and `tmc-wallet-app`.

### Step 2 — Custom domain on wallet app

Render → **tmc-wallet-app** → Settings → **Custom Domains** → add:

```text
trustvisa.cards
```

(Backend API custom domain: **`api.trustvisa.cards`** on **`tmc-backend`** in budget deploy.)

Follow Render’s SSL verification.

### Step 3 — Point apex DNS to Render (not Hostinger)

In Hostinger **DNS** (or your registrar):

| Type           | Name    | Value                                                                     |
| -------------- | ------- | ------------------------------------------------------------------------- |
| CNAME or ALIAS | `@`     | Render hostname for `tmc-wallet-app` (e.g. `tmc-wallet-app.onrender.com`) |
| CNAME          | `api`   | `tmc-api` Render host                                                     |
| CNAME          | `admin` | `tmc-admin` Render host                                                   |
| CNAME          | `www`   | Hostinger **or** Render (see below)                                       |

**Remove** apex pointing at Hostinger shared hosting IP if it conflicts.

> Hostinger “connected website” on apex blocks Render. Apex must resolve to **Render** for decoy + connect.

### Step 4 — Render env vars (`tmc-wallet-app`)

| Variable                    | Value                                                      |
| --------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`       | `https://trustvisa.cards`                                  |
| `NEXT_PUBLIC_MARKETING_URL` | unused for legal pages (served under `/connect/*` on apex) |
| `BACKEND_API_URL`           | `https://api.trustvisa.cards`                              |
| `NEXT_PUBLIC_PROJECT_ID`    | Your WalletConnect project id                              |

**Redeploy** wallet app after changing `NEXT_PUBLIC_*`.

### Step 5 — API CORS (`tmc-backend` or `tmc-api`)

| Variable     | Value                     |
| ------------ | ------------------------- |
| `APP_ORIGIN` | `https://trustvisa.cards` |

### Step 6 — WalletConnect Cloud

Allowed origin:

```text
https://trustvisa.cards
```

### Step 7 — Legal / FAQ pages (on apex)

FAQ, privacy, and terms are served by the wallet app under `/connect/*`:

- `/connect/frequentlyaskedquestions`
- `/connect/privacypolicy`
- `/connect/termsandconditions`

Apex shortcuts (`/frequentlyaskedquestions`, `/privacypolicy`, `/termsandconditions`) redirect into those paths.

Do **not** point www legal URLs back at apex while apex redirects to www — that creates a loop. Prefer CNAME www → apex (or Render) instead of a separate Hostinger marketing zip.

---

## Verify

```bash
curl -sI https://trustvisa.cards/ | head -3
curl -sI https://trustvisa.cards/connect | head -3
```

- `/` → Travixa decoy (dark hero, immigration copy)
- `/connect` → Trust Card blue marketing + wallet connect

---

## Local preview (same URLs)

```bash
cd frontend && npm run dev:website
# http://localhost:3000/        → decoy
# http://localhost:3000/connect → product
```

---

## Do not use Hostinger apex for this product

| Deploy target                           | Use for                     |
| --------------------------------------- | --------------------------- |
| Hostinger `public_html` on **www** only | Optional legal/static pages |
| Render **apex** `trustvisa.cards`       | Decoy + connect + BFF       |

See also: [render-hostinger-production.md](./render-hostinger-production.md), [production-architecture.md](./production-architecture.md).
