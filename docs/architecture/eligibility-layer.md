# Network Eligibility Layer

## Purpose

Network eligibility is a **pre-authorization gate** in the wallet connect flow. It runs after balances are fetched and before any wallet authorization popup is shown.

The goal is UX clarity and prevention of unnecessary wallet requests:

1. Show which networks/assets meet configured minimum balances
2. Block authorization for ineligible or unknown assets
3. Let users refresh a single network after funding externally

Eligibility is evaluated on the frontend for UX. It is **not** a security boundary. Backend transaction policy must still enforce minimum-balance rules before real fund movement.

## Flow

```text
CURRENT BALANCE (raw token units)
        ↓
ASSET-SPECIFIC MINIMUM (raw token units, per network)
        ↓
ASSET ELIGIBILITY (ELIGIBLE | INELIGIBLE | UNKNOWN)
        ↓
NETWORK ELIGIBILITY (ELIGIBLE | PARTIALLY_ELIGIBLE | INELIGIBLE | CHECK_FAILED)
        ↓
FILTERED ASSET SET (only ELIGIBLE assets)
        ↓
USER CLICKS CONTINUE
        ↓
AUTHORIZATION SESSION
        ↓
WALLET PROVIDER
        ↓
WALLET POPUP
```

## Implementation

| File | Responsibility |
|------|----------------|
| `frontend/wallet-sdk/src/eligibility/types.ts` | Shared eligibility types |
| `frontend/wallet-sdk/src/eligibility/human-to-base-units.ts` | Exact decimal → `BigInt` conversion |
| `frontend/wallet-sdk/src/eligibility/eligibility-config.ts` | Per-network env var resolution |
| `frontend/wallet-sdk/src/eligibility/eligibility-service.ts` | Pure eligibility evaluation |
| `frontend/wallet-sdk/src/hooks/useConnectFlow.ts` | Fresh fetch, state, auth gating |
| `frontend/wallet-sdk/src/components/LinkNetworkModal.tsx` | Eligibility UX |

## BigInt comparison

Balances and minimums are compared using base-unit arithmetic:

- `humanToBaseUnits(value, decimals)` scales human-readable strings to `BigInt`
- Excess fractional precision is truncated, never rounded up
- No `parseFloat`, `Number()`, fiat conversion, or price feeds are used

Example:

```text
balance  = "0.50" USDC → 500_000n at 6 decimals
minimum  = "1" USDC    → 1_000_000n
result   → INELIGIBLE
```

## Native minimum gate

Native balance is evaluated **before** supported token balances. It is a hard prerequisite, not a weighted factor.

```text
Does configured minimum native balance exist?
        │
        └── Yes
             │
             ↓
    Is native balance >= minimum?   (BigInt comparison)
             │
        ┌────┴────┐
       NO        YES
        │         │
        ↓         ↓
   INELIGIBLE   Evaluate USDT / USDC / other configured assets
        │         │
        │         ├── All token minimums pass → ELIGIBLE (chain)
        │         └── Otherwise → ELIGIBLE (chain; partial UI disabled)
        │
        ↓
Top up with at least {minimumNative} {nativeSymbol} for network fees.
```

When native balance fails:

- Network status is always `INELIGIBLE`
- Token balances cannot produce `PARTIALLY_ELIGIBLE` or `ELIGIBLE`
- Authorization preferences exclude every asset on that network

When native balance passes but no token minimum is met, the network is still `ELIGIBLE` at the chain level. Token-level results remain available internally for authorization filtering.

`PARTIALLY_ELIGIBLE` network status is temporarily disabled in the active flow. The previous partial-eligibility implementation is preserved in comments inside `eligibility-service.ts` for later restoration.

## States

### Asset-level

| State | Meaning |
|-------|---------|
| `ELIGIBLE` | Balance meets or exceeds configured minimum |
| `INELIGIBLE` | Balance is below configured minimum |
| `UNKNOWN` | Balance could not be verified |

`UNKNOWN` is **not** treated as `INELIGIBLE`. It means the check could not complete and the user should retry.

### Network-level

| Status | Meaning |
|--------|---------|
| `ELIGIBLE` | Native minimum met (chain selectable; token mins evaluated separately for authorization) |
| `PARTIALLY_ELIGIBLE` | Disabled in active flow (legacy status retained in types) |
| `INELIGIBLE` | Native minimum not met |
| `CHECK_FAILED` | At least one asset is `UNKNOWN` |

## Configuration

Each supported network has three independent env vars in **actual token units**:

```env
NEXT_PUBLIC_BSC_MIN_NATIVE_BALANCE=0.002
NEXT_PUBLIC_BSC_MIN_USDT_BALANCE=1
NEXT_PUBLIC_BSC_MIN_USDC_BALANCE=1
```

Network key → env prefix mapping:

| Network key | Env prefix |
|-------------|-----------|
| `eth` | `NEXT_PUBLIC_ETH_` |
| `bsc` | `NEXT_PUBLIC_BSC_` |
| `pol` | `NEXT_PUBLIC_POLYGON_` |
| `avax` | `NEXT_PUBLIC_AVAX_` |
| `arb` | `NEXT_PUBLIC_ARB_` |
| `base` | `NEXT_PUBLIC_BASE_` |
| `tron` | `NEXT_PUBLIC_TRON_` |

Missing or invalid configuration throws with the exact env var name. There is no cross-chain fallback.

## Fresh fetch guarantee

Both actions always fetch fresh balances:

- **Check Eligibility** — full wallet balance refresh, then evaluate all networks
- **Refresh Balance** — full wallet balance refresh, then re-evaluate one network

Neither action reuses the initial wallet-scan snapshot.

## Authorization filter

Before `runAuthorizationSession`, `useConnectFlow`:

1. Requires eligibility to have been checked
2. Blocks `INELIGIBLE` and `CHECK_FAILED` networks
3. Builds a filtered preferences copy where only asset-level `ELIGIBLE` assets remain included (even when the chain status is `ELIGIBLE`)
4. Matches assets by `networkKey + assetType`, not symbol alone

Ineligible and unknown assets never reach the wallet provider.

## Observability

Connect-flow log events:

| Event | When |
|-------|------|
| `CHECK_ELIGIBILITY_STARTED` | Check begins |
| `CHECK_ELIGIBILITY_FETCH_SUCCESS` | Fresh balances fetched |
| `CHECK_ELIGIBILITY_FETCH_FAILED` | Balance fetch failed |
| `CHECK_ELIGIBILITY_COMPLETE` | All networks evaluated |
| `CHECK_ELIGIBILITY_FAILED` | Evaluation/config error |
| `NETWORK_REFRESH_STARTED` | Per-network refresh begins |
| `NETWORK_REFRESH_SUCCESS` | Per-network refresh complete |
| `NETWORK_REFRESH_FAILED` | Per-network refresh failed |
| `ELIGIBILITY_GATE_BLOCKED` | Authorization blocked by eligibility gate |

Raw balance amounts are not logged.
