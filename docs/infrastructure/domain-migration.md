# Domain migration (generic guide)

Checklist to move production from an **old domain** to a **new domain** using DNS (e.g. Hostinger) + Render (app hosting).

Throughout this guide, placeholders show the relationship between hosts:

| Role               | Example placeholder        |
| ------------------ | -------------------------- |
| Old (legacy) apex  | `old-domain.example`       |
| New (current) apex | `new-domain.example`       |
| Old API            | `api.old-domain.example`   |
| New API            | `api.new-domain.example`   |
| Old www            | `www.old-domain.example`   |
| New www            | `www.new-domain.example`   |
| Old admin          | `admin.old-domain.example` |
| New admin          | `admin.new-domain.example` |

Replace these with your real hostnames when executing the migration.

**Current production example:** `mytrustvisa.cards` — see [domain-migration-mytrustvisa.md](./domain-migration-mytrustvisa.md) and [mytrustvisa-domain-security.md](./mytrustvisa-domain-security.md).

**Time needed:** ~30–60 minutes (+ DNS propagation up to 24–48 hours, often faster).

---

## What you are changing

| Old                                          | New                                |
| -------------------------------------------- | ---------------------------------- |
| `https://old-domain.example`                 | `https://new-domain.example`       |
| `https://api.old-domain.example`             | `https://api.new-domain.example`   |
| `https://www.old-domain.example` (optional)  | `https://www.new-domain.example`   |
| `https://admin.old-domain.example` (if used) | `https://admin.new-domain.example` |

**Unchanged:** product at `/`, legal pages at root paths, legacy `/connect` redirects to `/`.

> **Historical:** The decoy homepage and marketing-session gate were removed in 2026. Archive: [trustmycard-marketing-gate-archive](https://github.com/palash456/trustmycard-marketing-gate-archive).

---

## Before you start

- [ ] **New domain** (e.g. `new-domain.example`) is in your DNS registrar account
- [ ] You can log in to **DNS** and **Render** (services)
- [ ] You have access to **WalletConnect Cloud** (project settings)
- [ ] Ads/marketing contact is ready to update destination URL after go-live

**Important:** The wallet app runs on **Render**, not shared hosting. DNS is only for records — do **not** connect the new apex to a static “Website” builder if Render serves the apex.

---

## Step 1 — Add custom domains on Render

### `tmc-wallet-app` (wallet app)

1. Render → **tmc-wallet-app** → **Settings** → **Custom Domains**
2. **Add:**
   - `new-domain.example`
   - `www.new-domain.example` (optional but recommended)
3. Render shows DNS records to add — **keep this tab open**

### `tmc-backend` (API)

1. Render → **tmc-backend** → **Settings** → **Custom Domains**
2. **Add:** `api.new-domain.example`
3. Note the CNAME target Render gives you

---

## Step 2 — DNS

1. DNS panel → **new-domain.example** → DNS Zone
2. **Remove or disable** apex `@` records pointing to shared hosting IP (if present)
3. **Add/update** records as Render instructs:

| Type                   | Name  | Value                                       | Notes             |
| ---------------------- | ----- | ------------------------------------------- | ----------------- |
| **CNAME** or **ALIAS** | `@`   | Render hostname for `tmc-wallet-app`        | Apex → wallet app |
| **CNAME**              | `www` | `new-domain.example` or Render `www` target | www → apex        |
| **CNAME**              | `api` | Render hostname for `tmc-backend`           | API subdomain     |

4. Save DNS. SSL on Render turns **green** after propagation (often 15 min–2 hours).

### Do not

- Point apex `@` to registrar parking / shared hosting for the product site
- Upload a static marketing zip to apex `public_html` if Render serves the apex

---

## Step 3 — Update Render environment variables

### `tmc-wallet-app`

| Variable                    | New value                        |
| --------------------------- | -------------------------------- |
| `NEXT_PUBLIC_APP_URL`       | `https://new-domain.example`     |
| `NEXT_PUBLIC_MARKETING_URL` | `https://www.new-domain.example` |
| `BACKEND_API_URL`           | `https://api.new-domain.example` |

**Keep unchanged:** `NEXT_PUBLIC_PROJECT_ID`.

**Removed (legacy gate):** `MARKETING_SESSION_*`, `MARKETING_TEST_SECRET`, `GOOGLE_ADS_*`

Click **Save, rebuild, and deploy** (`NEXT_PUBLIC_*` are baked at build time).

### `tmc-backend`

| Variable       | New value                                              |
| -------------- | ------------------------------------------------------ |
| `APP_ORIGIN`   | `https://new-domain.example`                           |
| `ADMIN_ORIGIN` | `https://admin.new-domain.example` (or your admin URL) |

Redeploy backend after saving.

---

## Step 4 — WalletConnect Cloud

1. WalletConnect Cloud → your project → **Allowed origins** — add:
   ```text
   https://new-domain.example
   ```
2. Remove old `https://old-domain.example` after verification

---

## Step 5 — Ads / marketing destination URL

|         | URL                           |
| ------- | ----------------------------- |
| **Old** | `https://old-domain.example/` |
| **New** | `https://new-domain.example/` |

Destination must be the **homepage** (`/`), not `/connect`.

---

## Step 6 — Local env files (optional)

```env
NEXT_PUBLIC_APP_URL=https://new-domain.example
NEXT_PUBLIC_MARKETING_URL=https://www.new-domain.example
BACKEND_API_URL=https://api.new-domain.example
APP_ORIGIN=https://new-domain.example
```

---

## Step 7 — Quick verify (smoke tests)

```bash
curl -sI https://new-domain.example/ | head -3
curl -sI https://new-domain.example/connect | head -3
curl -s https://new-domain.example/robots.txt | grep -E 'connect|marketing'
curl -sI https://new-domain.example/connect | grep -i x-robots-tag
curl -s https://api.new-domain.example/v1/api/settings/public | head
```

| Test             | URL                                                               | Expected                                             |
| ---------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Decoy            | `https://new-domain.example/`                                     | Cover/decoy site                                     |
| Blocked connect  | `https://new-domain.example/connect`                              | Redirect to `/`                                      |
| Developer test   | `https://new-domain.example/api/marketing-test?token=YOUR_SECRET` | Lands on `/connect`                                  |
| Ad flow          | `https://new-domain.example/?fbclid=...`                          | Redirect to `/connect`                               |
| Search exclusion | `robots.txt` + `X-Robots-Tag` on `/connect`                       | `/connect` and marketing APIs disallowed / `noindex` |

---

## Step 8 — Old domain (`old-domain.example`) (optional)

**Option A — Redirect (recommended)**  
Point `old-domain.example` DNS to redirect to `new-domain.example`.

**Option B — Let expire**  
Update all ads/links; old domain stops when registration lapses.

**Option C — Run both temporarily**  
Add old domain as second Render custom domain; CORS must allow both origins (not default).

---

## Step 9 — Full migration test suite (required)

Use the **Run migration test suite** button in Admin → Documentation → Domain Migration (Step 9).

1. Enter **old domain** (e.g. `old-domain.example`) — hostname only, no `https://`
2. Enter **new domain** (e.g. `new-domain.example`)
3. Paste `MARKETING_TEST_SECRET` from Render → `tmc-wallet-app`
4. Click **Run automated tests**

The admin server runs 13 automated checks (redirects, session, API, CORS). Steps **B8** (WalletConnect UI) and **B11** (Render SSL dashboard) need a quick manual confirm.

### Phase A — Old domain

Tests hit `https://old-domain.example`, `https://api.old-domain.example`, etc. (derived from your input).

### Phase B — New domain

Tests hit `https://new-domain.example`, `https://api.new-domain.example`, etc.

**Migration is complete** when all automated checks pass, ads point to `https://new-domain.example/`, and the old domain is retired per Step 8.

---

## Order of operations (recommended)

```text
1. Add new-domain.example + api.new-domain.example on Render
2. Set DNS for new-domain.example
3. Wait for Render SSL ✓
4. Update Render env vars → redeploy wallet + backend
5. Update WalletConnect allowed origin
6. Run Step 7 smoke tests
7. Run Step 9 automated test suite (enter old + new domains)
8. Update ad destination URL
9. (Optional) Redirect or retire old-domain.example
```

---

## Troubleshooting

| Problem                            | Fix                                                                |
| ---------------------------------- | ------------------------------------------------------------------ |
| Registrar parking / wrong page     | Apex `@` still points to shared hosting — point to Render          |
| SSL pending on Render              | Wait for DNS; confirm CNAME matches Render exactly                 |
| WalletConnect “origin not allowed” | Add `https://new-domain.example` in WalletConnect Cloud            |
| API / CORS errors                  | `APP_ORIGIN=https://new-domain.example` on `tmc-backend`, redeploy |
| `/connect` broken after migration  | Redeploy wallet app after `NEXT_PUBLIC_APP_URL` change             |
| Ads still use old URL              | Update destination to `https://new-domain.example/`                |

---

## Checklist summary

- [ ] Render: `new-domain.example` on `tmc-wallet-app`
- [ ] Render: `api.new-domain.example` on `tmc-backend`
- [ ] DNS: apex + api → Render
- [ ] Render env updated; wallet + backend redeployed
- [ ] WalletConnect origin updated
- [ ] Step 9 automated test suite — all checks pass
- [ ] Ad URL updated to `https://new-domain.example/`

---

## Related docs

- [marketing-access.md](./marketing-access.md) — `/connect` gating
- [meta-ads-setup-guide.md](../marketing/meta-ads-setup-guide.md) — ad URLs
- [render-budget-production.md](./render-budget-production.md) — Render services
