# Structured Logs Analysis — 2026-08-12

> Generated from `structured-logs-2026-08-12T17-10-06-689Z.json` (**Last 24 hours**)

> Previous version used `structured-logs-2026-08-12T17-04-49-450Z.json` (**Last 6 hours**, 214 events). This report supersedes it with the full 24-hour window.

## Export metadata

| Field                        | Value                                                   |
| ---------------------------- | ------------------------------------------------------- |
| Exported at                  | `2026-08-12T17:10:06.689Z`                              |
| Range                        | **Last 24 hours**                                       |
| Window                       | `2026-08-11T17:10:04.413Z` → `2026-08-12T17:10:04.413Z` |
| Total events                 | **1807**                                                |
| Journeys (`flow-*`)          | **16**                                                  |
| Pre-journey sessions (`n/a`) | **18** connect attempts                                 |

## Executive summary — all journeys

| #   | Transaction ID                | Time (UTC)       | Duration  | Wallet (EVM / TRON)           | Chains    | Wallet phase    | Verdict                                              |
| --- | ----------------------------- | ---------------- | --------- | ----------------------------- | --------- | --------------- | ---------------------------------------------------- |
| 1   | `flow-20260812-003127-9WGYRB` | 2026-08-11 19:01 | ~5m 32s   | `0x1fa5…Bf96` / `TJHRzp…GYRB` | AVAX, BSC | 3 auth / 0 fail | **Partial** — approvals OK, native/settlement failed |
| 2   | `flow-20260812-013642-9WGYRB` | 2026-08-11 20:06 | ~2m 41s   | `0x1fa5…Bf96` / `TJHRzp…GYRB` | AVAX, BSC | 2 auth / 1 fail | **Mixed** — 4 unique failures                        |
| 3   | `flow-20260812-015651-9WGYRB` | 2026-08-11 20:26 | ~2m 29s   | `0x1fa5…bf96` / `TJHRzp…GYRB` | AVAX      | 3 auth / 0 fail | **Success** — 3 authorized                           |
| 4   | `flow-20260812-020034-9WGYRB` | 2026-08-11 20:30 | ~1m 56s   | `0x1fa5…bf96` / `TJHRzp…GYRB` | BSC       | 2 auth / 1 fail | **Mixed** — 1 unique failures                        |
| 5   | `flow-20260812-020808-9WGYRB` | 2026-08-11 20:38 | ~34s      | `0x1fa5…bf96` / `TJHRzp…GYRB` | BSC       | 2 auth / 1 fail | **Mixed** — 2 unique failures                        |
| 6   | `flow-20260812-022340-9WGYRB` | 2026-08-11 20:53 | ~57s      | `0x1fa5…bf96` / `TJHRzp…GYRB` | BSC       | 2 auth / 1 fail | **Mixed** — 2 unique failures                        |
| 7   | `flow-20260812-003818-9WGYRB` | 2026-08-11 19:08 | ~205m 22s | `0x1fa5…Bf96` / `TJHRzp…GYRB` | TRON      | —               | **Mixed** — 1 unique failures                        |
| 8   | `flow-20260812-040342-TKN3PR` | 2026-08-11 22:33 | ~18s      | `0x0168…0Afd` / `TSv1QC…n3pr` | —         | —               | **Completed** — no failures                          |
| 9   | `flow-20260812-040402-9WGYRB` | 2026-08-11 22:34 | ~57s      | `0x1fa5…Bf96` / `TJHRzp…GYRB` | AVAX      | 3 auth / 0 fail | **Mixed** — 1 unique failures                        |
| 10  | `flow-20260812-041001-9WGYRB` | 2026-08-11 22:40 | ~42s      | `0x1fa5…Bf96` / `TJHRzp…GYRB` | AVAX      | 3 auth / 0 fail | **Mixed** — 1 unique failures                        |
| 11  | `flow-20260812-151415-VSDAW9` | 2026-08-12 09:44 | ~13s      | `0x68a2…b9D6` / `TXikey…DaW9` | TRON      | 0 auth / 2 fail | **Failed** — TRON delegator not activated            |
| 12  | `flow-20260812-151741-VSDAW9` | 2026-08-12 09:47 | ~1m 15s   | `0x68a2…b9D6` / `TXikey…DaW9` | TRON      | 0 auth / 2 fail | **Failed** — TRON delegator not activated            |
| 13  | `flow-20260812-152558-VSDAW9` | 2026-08-12 09:55 | ~27s      | `0x68a2…b9D6` / `TXikey…DaW9` | TRON      | 0 auth / 2 fail | **Failed** — TRON delegator not activated            |
| 14  | `flow-20260812-154610-VSDAW9` | 2026-08-12 10:16 | ~28s      | `0x68a2…b9D6` / `TXikey…DaW9` | TRON      | 0 auth / 2 fail | **Failed** — TRON energy (2 failed)                  |
| 15  | `flow-20260812-195912-9WGYRB` | 2026-08-12 14:29 | ~2m 35s   | `0x1fa5…Bf96` / `TJHRzp…GYRB` | BSC, ETH  | 3 auth / 0 fail | **Partial** — approvals OK, native/settlement failed |
| 16  | `flow-20260812-221942-6G7SFG` | 2026-08-12 16:49 | ~3m 56s   | `0x6355…88B6` / `TXY1ka…7Sfg` | TRON      | 0 auth / 2 fail | **Failed** — TRON energy (2 failed)                  |

### Wallets seen in 24h

| Role | Address                                      | Journeys |
| ---- | -------------------------------------------- | -------- |
| EVM  | `0x0168940Da7Dde4232A69E154ad103fFcb5080Afd` | 1        |
| EVM  | `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96` | 6        |
| EVM  | `0x1fa5387f129abf611d942798e925a51a2dc2bf96` | 4        |
| EVM  | `0x6355a9d16AdcF4D368337f40B0859fB4CFb088B6` | 1        |
| EVM  | `0x68a231ACF41db696E68D874597A84F2bf972b9D6` | 4        |
| TRON | `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`         | 10       |
| TRON | `TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr`         | 1        |
| TRON | `TXY1kamcXqJu4eVpq3FWacpYEZ416g7Sfg`         | 1        |
| TRON | `TXikeySPuo2TtRaewgtJByQn31GnVSDaW9`         | 4        |

## Failure reasons rollup (24 hours)

| Occurrences | Classification                      | Affected journeys                         | Error                                                                                                                               |
| ----------- | ----------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 9           | **Infrastructure (TRON delegator)** | `VSDAW9` (×3 journeys)                    | Energy delegator `TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr` is not activated on TRON; fund the wallet and freeze TRX for ENERGY           |
| 6           | **Code / timing (nonce)**           | `9WGYRB`, `9WGYRB`, `9WGYRB`, `9WGYRB` +2 | Previous approval transaction is still pending — nonce did not advance in time                                                      |
| 6           | **Infrastructure (TRON energy)**    | `VSDAW9`, `6G7SFG`                        | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 balance                            |
| 4           | **Infrastructure (collector gas)**  | `9WGYRB` (×2 journeys)                    | Collector wallet has insufficient native gas for `transferFrom`. Fund `0x0168940Da7Dde4232A69E154ad103fFcb5080Afd` with native coin |
| 4           | **Wallet / RPC (iOS?)**             | `9WGYRB`, `9WGYRB`                        | The data couldn’t be read because it is missing.                                                                                    |
| 3           | **Wallet / compatibility**          | `9WGYRB`, `9WGYRB`, `9WGYRB`              | Unknown method(s) requested                                                                                                         |
| 3           | **Wallet / RPC**                    | `9WGYRB`                                  | Load failed                                                                                                                         |
| 2           | **Wallet / user**                   | `9WGYRB`                                  | Permission denied by user                                                                                                           |
| 1           | **Wallet / timing**                 | n/a                                       | Proposal expired                                                                                                                    |
| 1           | **Wallet / RPC (iOS?)**             | `9WGYRB`                                  | Missing or invalid. request() method: tron_signMessageV2                                                                            |
| 1           | **Wallet / user**                   | `9WGYRB`                                  | User canceled                                                                                                                       |

### Issue classification legend

| Category                            | Meaning                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| **Wallet / user**                   | User rejected, canceled, or wallet denied                     |
| **Wallet / RPC**                    | Generic load/provider failure                                 |
| **Wallet / compatibility**          | Unsupported wallet method (e.g. `tron_signMessageV2`)         |
| **Infrastructure (TRON energy)**    | Insufficient delegated FreezeEnergyV2                         |
| **Infrastructure (TRON delegator)** | Energy delegator wallet not activated / unfunded              |
| **Infrastructure (collector gas)**  | Platform collector lacks native gas for `transferFrom`        |
| **Code / timing (nonce)**           | Approval still pending when native sign attempted             |
| **Logging / code**                  | Misleading status, null `errorMessage`, duplicate module logs |

---

## Pre-journey connect sessions (`n/a`)

**18** connect attempts before a `flow-*` ID was assigned. These are funnel telemetry, not transaction failures.

| Session | Time (UTC)              | EVM wallet                                   | TRON wallet                          | Became journey                |
| ------- | ----------------------- | -------------------------------------------- | ------------------------------------ | ----------------------------- |
| 1       | 2026-08-11 19:01:19 UTC | `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96` | `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB` | —                             |
| 2       | 2026-08-11 19:08:11 UTC | `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96` | `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB` | —                             |
| 3       | 2026-08-11 20:04:25 UTC | —                                            | —                                    | `flow-20260812-013642-9WGYRB` |
| 4       | 2026-08-11 20:06:35 UTC | `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96` | `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB` | `flow-20260812-013642-9WGYRB` |
| 5       | 2026-08-11 20:26:41 UTC | `0x1fa5387f129abf611d942798e925a51a2dc2bf96` | `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB` | `flow-20260812-015651-9WGYRB` |
| 6       | 2026-08-11 20:30:23 UTC | `0x1fa5387f129abf611d942798e925a51a2dc2bf96` | `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB` | `flow-20260812-020034-9WGYRB` |
| 7       | 2026-08-11 20:37:44 UTC | `0x1fa5387f129abf611d942798e925a51a2dc2bf96` | `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB` | `flow-20260812-020808-9WGYRB` |
| 8       | 2026-08-11 20:53:29 UTC | `0x1fa5387f129abf611d942798e925a51a2dc2bf96` | `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB` | `flow-20260812-022340-9WGYRB` |
| 9       | 2026-08-11 22:39:52 UTC | `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96` | `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB` | `flow-20260812-041001-9WGYRB` |
| 10      | 2026-08-11 23:29:10 UTC | —                                            | —                                    | —                             |
| 11      | 2026-08-12 01:12:53 UTC | —                                            | —                                    | —                             |
| 12      | 2026-08-12 01:14:05 UTC | —                                            | —                                    | —                             |
| 13      | 2026-08-12 09:43:47 UTC | `0x68a231ACF41db696E68D874597A84F2bf972b9D6` | `TXikeySPuo2TtRaewgtJByQn31GnVSDaW9` | `flow-20260812-151415-VSDAW9` |
| 14      | 2026-08-12 09:47:13 UTC | `0x68a231ACF41db696E68D874597A84F2bf972b9D6` | `TXikeySPuo2TtRaewgtJByQn31GnVSDaW9` | `flow-20260812-151741-VSDAW9` |
| 15      | 2026-08-12 09:55:42 UTC | `0x68a231ACF41db696E68D874597A84F2bf972b9D6` | `TXikeySPuo2TtRaewgtJByQn31GnVSDaW9` | `flow-20260812-152558-VSDAW9` |
| 16      | 2026-08-12 10:15:26 UTC | `0x68a231ACF41db696E68D874597A84F2bf972b9D6` | `TXikeySPuo2TtRaewgtJByQn31GnVSDaW9` | `flow-20260812-154610-VSDAW9` |
| 17      | 2026-08-12 14:28:51 UTC | `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96` | `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB` | `flow-20260812-195912-9WGYRB` |
| 18      | 2026-08-12 16:49:09 UTC | `0x6355a9d16AdcF4D368337f40B0859fB4CFb088B6` | `TXY1kamcXqJu4eVpq3FWacpYEZ416g7Sfg` | `flow-20260812-221942-6G7SFG` |

### Pre-journey failures

- **2026-08-11 23:34:14 UTC** — `transaction_failed`: Proposal expired (Wallet / timing)

---

## Journey 1 — `flow-20260812-003127-9WGYRB`

**Verdict:** **Partial** — approvals OK, native/settlement failed

**Time span:** 2026-08-11 19:01:28 UTC → 2026-08-11 19:07:01 UTC (~5m 32s, 409 events)

**EVM wallet:** `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96`

**TRON wallet:** `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`

**Networks:** AVAX, BSC

**Tokens touched:** USDC, USDT

**Wallet phase:** 3 authorized · 0 failed · 0 skipped · 0 rejected

**Balances at connect:**

| Network | USDT     | USDC                 | Native               |
| ------- | -------- | -------------------- | -------------------- |
| TRON    | 0        | 0                    | 11.229258            |
| ETH     | 2.043577 | 1.019035             | 0.000567154925359245 |
| BSC     | 0        | 0.997153927108410325 | 0.003726153546569533 |
| POL     | 0        | 0                    | 0                    |
| AVAX    | 2.967621 | 2.092269             | 0.100003774462330627 |
| ARB     | 0        | 0                    | 0                    |
| BASE    | 0        | 0                    | 0                    |

### Summary

**What went wrong:**

- [19:06:47] **BSC** —: Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232A69E154ad103fFcb5080Afd with native coin, then retry collection. → _Infrastructure (collector gas)_
- [19:06:47] **BSC** —: Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232A69E154ad103fFcb5080Afd with native coin, then retry collection. → _Infrastructure (collector gas)_
- [19:07:01] **BSC** —: The data couldn’t be read because it is missing. → _Wallet / RPC (iOS?)_
- [19:07:01] **—** —: The data couldn’t be read because it is missing. → _Wallet / RPC (iOS?)_
- [19:07:01] **BSC** —: The data couldn’t be read because it is missing. → _Wallet / RPC (iOS?)_

- **What went right:** Wallet phase completed with **3** authorization(s).

### Settlement breakdown

#### AVAX — 2026-08-11 19:02:30 UTC (`ok: True`)

| Token  | Outcome     | Message                   |
| ------ | ----------- | ------------------------- |
| USDT   | `collected` | Success                   |
| USDC   | `collected` | Success                   |
| NATIVE | `collected` | Native transfer confirmed |

#### BSC — 2026-08-11 19:07:01 UTC (`ok: False`)

| Token  | Outcome  | Message                                          |
| ------ | -------- | ------------------------------------------------ |
| NATIVE | `failed` | The data couldn’t be read because it is missing. |

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                | Error                                                                                                | Classification                     |
| ----------------------- | ------- | ----- | ------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-08-11 19:06:47 UTC | bsc     | —     | `transaction_failed`     | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 | **Infrastructure (collector gas)** |
| 2026-08-11 19:06:47 UTC | bsc     | —     | `settlement_failed`      | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 | **Infrastructure (collector gas)** |
| 2026-08-11 19:07:01 UTC | bsc     | —     | `transaction_failed`     | The data couldn’t be read because it is missing.                                                     | **Wallet / RPC (iOS?)**            |
| 2026-08-11 19:07:01 UTC | —       | —     | `native_transfer_failed` | The data couldn’t be read because it is missing.                                                     | **Wallet / RPC (iOS?)**            |
| 2026-08-11 19:07:01 UTC | bsc     | —     | `settlement_failed`      | The data couldn’t be read because it is missing.                                                     | **Wallet / RPC (iOS?)**            |

### Event timeline

| #   | Time     | Lvl  | Status      | Net  | Token | Module     | Operation                                       | Notes                                                                                                |
| --- | -------- | ---- | ----------- | ---- | ----- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 19:01:28 | info | success     | —    | —     | connect    | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                               |
| 2   | 19:01:28 | info | success     | —    | —     | connect    | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                        |
| 3   | 19:01:38 | info | in_progress | avax | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 4   | 19:01:39 | info | in_progress | avax | —     | connect    | `balances_refreshed_before_authorize`           | BALANCES REFRESHED BEFORE AUTHORIZE                                                                  |
| 5   | 19:01:39 | info | in_progress | —    | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 6   | 19:01:46 | info | in_progress | avax | —     | connect    | `eip5792_batch_unsupported`                     | EIP5792_BATCH_UNSUPPORTED                                                                            |
| 7   | 19:01:48 | info | in_progress | avax | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 8   | 19:01:48 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 9   | 19:01:55 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 10  | 19:01:55 | info | success     | avax | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 11  | 19:01:57 | info | in_progress | avax | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 12  | 19:01:57 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 13  | 19:02:03 | info | success     | avax | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 14  | 19:02:03 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 15  | 19:02:03 | info | in_progress | avax | —     | connect    | `native_deferred_to_settlement`                 | NATIVE DEFERRED TO SETTLEMENT                                                                        |
| 16  | 19:02:03 | info | success     | —    | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 17  | 19:02:03 | info | success     | —    | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 18  | 19:02:04 | info | in_progress | avax | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 19  | 19:02:04 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 20  | 19:02:04 | info | in_progress | avax | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 21  | 19:02:04 | info | in_progress | avax | USDT  | connect    | `settlement_progress`                           | Finalizing USDT approval · finalizing_approval                                                       |
| 22  | 19:02:11 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 23  | 19:02:11 | info | in_progress | avax | USDC  | connect    | `settlement_progress`                           | Finalizing USDC approval · finalizing_approval                                                       |
| 24  | 19:02:11 | info | in_progress | avax | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 25  | 19:02:11 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 26  | 19:02:11 | info | success     | avax | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 27  | 19:02:18 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token             |
| 28  | 19:02:18 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 29  | 19:02:18 | info | success     | avax | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 30  | 19:02:19 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Executing EVM native transfer (eth_sendTransaction) · executing_native                               |
| 31  | 19:02:19 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | No active token collection — proceeding with native · native_ready                                   |
| 32  | 19:02:30 | info | success     | avax | —     | settlement | `state_transition`                              | Settlement complete                                                                                  |
| 33  | 19:02:30 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Settlement complete · completed                                                                      |
| 34  | 19:02:30 | info | success     | avax | —     | connect    | `transaction_success`                           | TRANSACTION_SUCCESS                                                                                  |
| 35  | 19:02:30 | info | success     | avax | —     | connect    | `settlement_complete`                           | Background settlement complete on AVAX                                                               |
| 36  | 19:02:30 | info | success     | avax | —     | connect    | `settlement_complete`                           | Background settlement complete on AVAX                                                               |
| 37  | 19:06:09 | info | in_progress | bsc  | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 38  | 19:06:10 | info | in_progress | bsc  | —     | connect    | `balances_refreshed_before_authorize`           | BALANCES REFRESHED BEFORE AUTHORIZE                                                                  |
| 39  | 19:06:10 | info | in_progress | —    | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 40  | 19:06:19 | info | in_progress | bsc  | —     | connect    | `eip5792_batch_unsupported`                     | EIP5792_BATCH_UNSUPPORTED                                                                            |
| 41  | 19:06:20 | info | in_progress | bsc  | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 42  | 19:06:20 | info | in_progress | bsc  | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 43  | 19:06:27 | info | success     | bsc  | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 44  | 19:06:27 | info | in_progress | bsc  | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 45  | 19:06:29 | info | in_progress | bsc  | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 46  | 19:06:29 | info | in_progress | bsc  | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 47  | 19:06:35 | info | in_progress | bsc  | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 48  | 19:06:35 | info | success     | bsc  | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 49  | 19:06:35 | info | in_progress | bsc  | —     | connect    | `native_deferred_to_settlement`                 | NATIVE DEFERRED TO SETTLEMENT                                                                        |
| 50  | 19:06:35 | info | success     | —    | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 51  | 19:06:35 | info | success     | —    | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 52  | 19:06:35 | info | in_progress | bsc  | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 53  | 19:06:35 | info | in_progress | bsc  | USDT  | connect    | `settlement_progress`                           | Finalizing USDT approval · finalizing_approval                                                       |
| 54  | 19:06:35 | info | in_progress | bsc  | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 55  | 19:06:35 | info | in_progress | bsc  | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 56  | 19:06:38 | info | in_progress | bsc  | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 57  | 19:06:38 | info | in_progress | bsc  | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 58  | 19:06:38 | info | success     | bsc  | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 59  | 19:06:38 | info | in_progress | bsc  | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 60  | 19:06:38 | info | in_progress | bsc  | USDC  | connect    | `settlement_progress`                           | Finalizing USDC approval · finalizing_approval                                                       |
| 61  | 19:06:43 | info | success     | bsc  | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 62  | 19:06:43 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token             |
| 63  | 19:06:43 | info | in_progress | bsc  | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 64  | 19:06:47 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 |
| 65  | 19:06:47 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 |
| 66  | 19:06:47 | warn | failure     | bsc  | —     | connect    | `transaction_failed`                            | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 |
| 67  | 19:06:47 | info | success     | bsc  | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                                |
| 68  | 19:06:47 | warn | failure     | bsc  | —     | connect    | `settlement_failed`                             | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 |
| 69  | 19:06:47 | info | success     | bsc  | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                                |
| 70  | 19:06:52 | info | in_progress | bsc  | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 71  | 19:06:53 | info | in_progress | bsc  | —     | connect    | `balances_refreshed_before_authorize`           | BALANCES REFRESHED BEFORE AUTHORIZE                                                                  |
| 72  | 19:06:53 | info | in_progress | —    | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 73  | 19:06:54 | info | in_progress | bsc  | USDT  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                                |
| 74  | 19:06:57 | info | in_progress | bsc  | USDC  | connect    | `eip5792_batch_collect_existing_allowance`      | EIP5792_BATCH_COLLECT_EXISTING_ALLOWANCE                                                             |
| 75  | 19:06:57 | info | success     | —    | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 76  | 19:06:57 | info | in_progress | bsc  | —     | connect    | `native_deferred_to_settlement`                 | NATIVE DEFERRED TO SETTLEMENT                                                                        |
| 77  | 19:06:57 | info | success     | —    | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 78  | 19:06:58 | info | in_progress | bsc  | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 79  | 19:06:58 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token             |
| 80  | 19:06:59 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Executing EVM native transfer (eth_sendTransaction) · executing_native                               |
| 81  | 19:06:59 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | No active token collection — proceeding with native · native_ready                                   |
| 82  | 19:07:01 | warn | failure     | bsc  | —     | connect    | `transaction_failed`                            | The data couldn’t be read because it is missing.                                                     |
| 83  | 19:07:01 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | The data couldn’t be read because it is missing. · failed                                            |
| 84  | 19:07:01 | info | success     | bsc  | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                                |
| 85  | 19:07:01 | warn | failure     | —    | —     | connect    | `native_transfer_failed`                        | The data couldn’t be read because it is missing. · userRejected=False · BROADCAST                    |
| 86  | 19:07:01 | warn | failure     | bsc  | —     | connect    | `settlement_failed`                             | The data couldn’t be read because it is missing.                                                     |
| 87  | 19:07:01 | info | success     | bsc  | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                                |

---

## Journey 2 — `flow-20260812-013642-9WGYRB`

**Verdict:** **Mixed** — 4 unique failures

**Time span:** 2026-08-11 20:06:43 UTC → 2026-08-11 20:09:24 UTC (~2m 41s, 412 events)

**EVM wallet:** `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96`

**TRON wallet:** `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`

**Networks:** AVAX, BSC

**Tokens touched:** USDC, USDT

**Wallet phase:** 2 authorized · 1 failed · 0 skipped · 0 rejected

**Balances at connect:**

| Network | USDT     | USDC                 | Native               |
| ------- | -------- | -------------------- | -------------------- |
| TRON    | 0        | 0                    | 0.000058             |
| ETH     | 2.043577 | 1.019035             | 0.000567154925359245 |
| BSC     | 0        | 0.997153927108410325 | 0.003708985346569533 |
| POL     | 0        | 0                    | 0                    |
| AVAX    | 2.967621 | 2.092269             | 0.10000354165911633  |
| ARB     | 0        | 0                    | 0                    |
| BASE    | 0        | 0                    | 0                    |

### Summary

**What went wrong:**

- [20:08:27] **—** —: The data couldn’t be read because it is missing. → _Wallet / RPC (iOS?)_
- [20:08:39] **BSC** —: Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232A69E154ad103fFcb5080Afd with native coin, then retry collection. → _Infrastructure (collector gas)_
- [20:08:39] **BSC** —: Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232A69E154ad103fFcb5080Afd with native coin, then retry collection. → _Infrastructure (collector gas)_
- [20:09:22] **BSC** —: Previous approval transaction is still pending — nonce did not advance in time → _Code / timing (nonce)_

- **What went right:** Wallet phase completed with **2** authorization(s).

### Settlement breakdown

#### AVAX — 2026-08-11 20:07:41 UTC (`ok: True`)

| Token  | Outcome     | Message                   |
| ------ | ----------- | ------------------------- |
| USDT   | `collected` | Success                   |
| USDC   | `collected` | Success                   |
| NATIVE | `collected` | Native transfer confirmed |

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                           | Error                                                                                                | Classification                     |
| ----------------------- | ------- | ----- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-08-11 20:08:27 UTC | —       | —     | `native_transfer_failed`            | The data couldn’t be read because it is missing.                                                     | **Wallet / RPC (iOS?)**            |
| 2026-08-11 20:08:39 UTC | bsc     | —     | `transaction_failed`                | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 | **Infrastructure (collector gas)** |
| 2026-08-11 20:08:39 UTC | bsc     | —     | `settlement_failed`                 | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 | **Infrastructure (collector gas)** |
| 2026-08-11 20:09:22 UTC | bsc     | —     | `evm_native_sign_nonce_wait_failed` | Previous approval transaction is still pending — nonce did not advance in time                       | **Code / timing (nonce)**          |

### Event timeline

| #   | Time     | Lvl  | Status      | Net  | Token | Module     | Operation                                       | Notes                                                                                                |
| --- | -------- | ---- | ----------- | ---- | ----- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 20:06:43 | info | success     | —    | —     | connect    | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                        |
| 2   | 20:06:43 | info | success     | —    | —     | connect    | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                               |
| 3   | 20:06:45 | info | in_progress | avax | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 4   | 20:06:45 | info | in_progress | —    | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 5   | 20:06:53 | info | in_progress | avax | —     | connect    | `eip5792_batch_unsupported`                     | EIP5792_BATCH_UNSUPPORTED                                                                            |
| 6   | 20:06:55 | info | in_progress | avax | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 7   | 20:06:55 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 8   | 20:07:02 | info | success     | avax | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 9   | 20:07:02 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 10  | 20:07:04 | info | in_progress | avax | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 11  | 20:07:04 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 12  | 20:07:10 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 13  | 20:07:10 | info | success     | avax | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 14  | 20:07:10 | info | in_progress | avax | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                           |
| 15  | 20:07:17 | info | success     | —    | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 16  | 20:07:17 | info | success     | —    | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 17  | 20:07:17 | info | in_progress | avax | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 18  | 20:07:17 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                       |
| 19  | 20:07:18 | info | in_progress | avax | —     | settlement | `state_transition`                              | EVM native authorization registered for deferred broadcast                                           |
| 20  | 20:07:18 | info | in_progress | avax | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 21  | 20:07:18 | info | in_progress | avax | USDT  | connect    | `settlement_progress`                           | Finalizing USDT approval · finalizing_approval                                                       |
| 22  | 20:07:18 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 23  | 20:07:25 | info | success     | avax | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 24  | 20:07:25 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 25  | 20:07:25 | info | in_progress | avax | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 26  | 20:07:25 | info | in_progress | avax | USDC  | connect    | `settlement_progress`                           | Finalizing USDC approval · finalizing_approval                                                       |
| 27  | 20:07:25 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 28  | 20:07:31 | info | success     | avax | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 29  | 20:07:31 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 30  | 20:07:31 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token             |
| 31  | 20:07:33 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | No active token collection — proceeding with native · native_ready                                   |
| 32  | 20:07:33 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Broadcasting deferred EVM native transfer · executing_native                                         |
| 33  | 20:07:41 | info | success     | avax | —     | settlement | `state_transition`                              | Settlement complete                                                                                  |
| 34  | 20:07:41 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Settlement complete · completed                                                                      |
| 35  | 20:07:41 | info | success     | avax | —     | connect    | `settlement_complete`                           | Background settlement complete on AVAX                                                               |
| 36  | 20:07:41 | info | success     | avax | —     | connect    | `transaction_success`                           | TRANSACTION_SUCCESS                                                                                  |
| 37  | 20:07:41 | info | success     | avax | —     | connect    | `settlement_complete`                           | Background settlement complete on AVAX                                                               |
| 38  | 20:08:01 | info | in_progress | bsc  | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 39  | 20:08:02 | info | in_progress | —    | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 40  | 20:08:02 | info | in_progress | bsc  | —     | connect    | `balances_refreshed_before_authorize`           | BALANCES REFRESHED BEFORE AUTHORIZE                                                                  |
| 41  | 20:08:10 | info | in_progress | bsc  | —     | connect    | `eip5792_batch_unsupported`                     | EIP5792_BATCH_UNSUPPORTED                                                                            |
| 42  | 20:08:11 | info | in_progress | bsc  | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 43  | 20:08:11 | info | in_progress | bsc  | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 44  | 20:08:17 | info | success     | bsc  | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 45  | 20:08:17 | info | in_progress | bsc  | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 46  | 20:08:18 | info | in_progress | bsc  | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 47  | 20:08:18 | info | in_progress | bsc  | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 48  | 20:08:24 | info | success     | bsc  | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 49  | 20:08:24 | info | in_progress | bsc  | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 50  | 20:08:24 | info | in_progress | bsc  | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                           |
| 51  | 20:08:27 | warn | failure     | —    | —     | connect    | `native_transfer_failed`                        | The data couldn’t be read because it is missing. · userRejected=False · SIGN                         |
| 52  | 20:08:27 | info | success     | —    | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — 2 authorized, 1 failed (background settlement starting) · auth=2 fail=1      |
| 53  | 20:08:27 | info | success     | —    | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — 2 authorized, 1 failed (background settlement starting) · auth=2 fail=1      |
| 54  | 20:08:28 | info | in_progress | bsc  | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 55  | 20:08:28 | info | in_progress | bsc  | USDT  | connect    | `settlement_progress`                           | Finalizing USDT approval · finalizing_approval                                                       |
| 56  | 20:08:28 | info | in_progress | bsc  | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 57  | 20:08:28 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                       |
| 58  | 20:08:28 | info | in_progress | bsc  | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 59  | 20:08:31 | info | in_progress | bsc  | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 60  | 20:08:31 | info | success     | bsc  | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 61  | 20:08:31 | info | in_progress | bsc  | USDC  | connect    | `settlement_progress`                           | Finalizing USDC approval · finalizing_approval                                                       |
| 62  | 20:08:31 | info | in_progress | bsc  | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 63  | 20:08:31 | info | in_progress | bsc  | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 64  | 20:08:36 | info | success     | bsc  | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 65  | 20:08:36 | info | in_progress | bsc  | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 66  | 20:08:36 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token             |
| 67  | 20:08:39 | warn | failure     | bsc  | —     | connect    | `transaction_failed`                            | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 |
| 68  | 20:08:39 | info | success     | bsc  | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                                |
| 69  | 20:08:39 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 |
| 70  | 20:08:39 | warn | failure     | bsc  | —     | connect    | `settlement_failed`                             | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 |
| 71  | 20:08:39 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Collector wallet has insufficient native gas for transferFrom on BNB Chain. Fund 0x0168940Da7Dde4232 |
| 72  | 20:08:39 | info | success     | bsc  | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                                |
| 73  | 20:08:52 | info | in_progress | bsc  | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 74  | 20:08:53 | info | in_progress | bsc  | —     | connect    | `balances_refreshed_before_authorize`           | BALANCES REFRESHED BEFORE AUTHORIZE                                                                  |
| 75  | 20:08:53 | info | in_progress | —    | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 76  | 20:08:54 | info | in_progress | bsc  | USDT  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                                |
| 77  | 20:08:57 | info | in_progress | bsc  | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                           |
| 78  | 20:08:57 | info | in_progress | bsc  | USDC  | connect    | `eip5792_batch_collect_existing_allowance`      | EIP5792_BATCH_COLLECT_EXISTING_ALLOWANCE                                                             |
| 79  | 20:09:22 | warn | failure     | bsc  | —     | connect    | `evm_native_sign_nonce_wait_failed`             | Previous approval transaction is still pending — nonce did not advance in time                       |
| 80  | 20:09:24 | warn | failure     | —    | —     | connect    | `native_transfer_failed`                        | The data couldn’t be read because it is missing. · userRejected=False · SIGN                         |
| 81  | 20:09:24 | info | success     | —    | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — 2 authorized, 1 failed (background settlement starting) · auth=2 fail=1      |
| 82  | 20:09:24 | info | success     | —    | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — 2 authorized, 1 failed (background settlement starting) · auth=2 fail=1      |
| 83  | 20:09:24 | info | in_progress | bsc  | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 84  | 20:09:24 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                       |
| 85  | 20:09:24 | info | in_progress | bsc  | —     | connect    | `settlement_progress`                           | Token settlement complete · completed                                                                |
| 86  | 20:09:24 | info | success     | bsc  | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                                |
| 87  | 20:09:24 | info | success     | bsc  | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                                |
| 88  | 20:09:24 | info | success     | bsc  | —     | connect    | `transaction_success`                           | TRANSACTION_SUCCESS                                                                                  |

---

## Journey 3 — `flow-20260812-015651-9WGYRB`

**Verdict:** **Success** — 3 authorized

**Time span:** 2026-08-11 20:26:52 UTC → 2026-08-11 20:29:21 UTC (~2m 29s, 194 events)

**EVM wallet:** `0x1fa5387f129abf611d942798e925a51a2dc2bf96`

**TRON wallet:** `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`

**Networks:** AVAX

**Tokens touched:** USDC, USDT

**Wallet phase:** 3 authorized · 0 failed · 0 skipped · 0 rejected

**Balances at connect:**

| Network | USDT     | USDC                 | Native               |
| ------- | -------- | -------------------- | -------------------- |
| TRON    | 0        | 0                    | 0.000058             |
| ETH     | 2.043577 | 1.019035             | 0.000567154925359245 |
| BSC     | 0        | 0.997153927108410325 | 0.002701187946569533 |
| POL     | 0        | 0                    | 0                    |
| AVAX    | 2.967621 | 2.092269             | 0.100005278764462314 |
| ARB     | 0        | 0                    | 0                    |
| BASE    | 0        | 0                    | 0                    |

### Summary

- **No failure-status events** in this journey.

- **What went right:** Wallet phase completed with **3** authorization(s).

### Event timeline

| #   | Time     | Lvl  | Status      | Net  | Token | Module     | Operation                                       | Notes                                                                                                |
| --- | -------- | ---- | ----------- | ---- | ----- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 20:26:52 | info | success     | —    | —     | connect    | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                               |
| 2   | 20:26:52 | info | success     | —    | —     | connect    | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                        |
| 3   | 20:27:01 | info | in_progress | avax | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 4   | 20:27:01 | info | in_progress | —    | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 5   | 20:27:16 | info | in_progress | avax | —     | connect    | `eip5792_batch_unsupported`                     | EIP5792_BATCH_UNSUPPORTED                                                                            |
| 6   | 20:27:17 | info | in_progress | avax | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 7   | 20:27:17 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 8   | 20:27:26 | info | success     | avax | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 9   | 20:27:26 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 10  | 20:27:29 | info | in_progress | avax | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 11  | 20:27:29 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 12  | 20:27:39 | info | success     | avax | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 13  | 20:27:39 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 14  | 20:27:39 | info | in_progress | avax | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                           |
| 15  | 20:27:48 | info | success     | —    | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 16  | 20:27:48 | info | success     | —    | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 17  | 20:27:48 | info | in_progress | avax | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 18  | 20:27:49 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                       |
| 19  | 20:27:49 | info | in_progress | avax | —     | settlement | `state_transition`                              | EVM native authorization registered for deferred broadcast                                           |
| 20  | 20:27:49 | info | in_progress | avax | USDT  | connect    | `settlement_progress`                           | Finalizing USDT approval · finalizing_approval                                                       |
| 21  | 20:27:49 | info | in_progress | avax | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 22  | 20:27:49 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 23  | 20:27:58 | info | success     | avax | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 24  | 20:27:58 | info | in_progress | avax | USDC  | connect    | `settlement_progress`                           | Finalizing USDC approval · finalizing_approval                                                       |
| 25  | 20:27:58 | info | in_progress | avax | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 26  | 20:27:58 | info | in_progress | avax | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 27  | 20:27:58 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 28  | 20:29:19 | info | success     | avax | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 29  | 20:29:19 | info | in_progress | avax | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 30  | 20:29:19 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token             |
| 31  | 20:29:21 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | No active token collection — proceeding with native · native_ready                                   |
| 32  | 20:29:21 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Broadcasting deferred EVM native transfer · executing_native                                         |

---

## Journey 4 — `flow-20260812-020034-9WGYRB`

**Verdict:** **Mixed** — 1 unique failures

**Time span:** 2026-08-11 20:30:35 UTC → 2026-08-11 20:32:31 UTC (~1m 56s, 197 events)

**EVM wallet:** `0x1fa5387f129abf611d942798e925a51a2dc2bf96`

**TRON wallet:** `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`

**Networks:** BSC

**Tokens touched:** USDC, USDT

**Wallet phase:** 2 authorized · 1 failed · 0 skipped · 0 rejected

**Balances at connect:**

| Network | USDT     | USDC                 | Native               |
| ------- | -------- | -------------------- | -------------------- |
| TRON    | 0        | 0                    | 0.000058             |
| ETH     | 2.043577 | 1.019035             | 0.000567154925359245 |
| BSC     | 0        | 0.997153927108410325 | 0.002701187946569533 |
| POL     | 0        | 0                    | 0                    |
| AVAX    | 0        | 0                    | 0.0000396336598728   |
| ARB     | 0        | 0                    | 0                    |
| BASE    | 0        | 0                    | 0                    |

### Summary

**What went wrong:**

- [20:32:18] **—** —: Unknown method(s) requested → _Wallet / compatibility_

- **What went right:** Wallet phase completed with **2** authorization(s).

### Settlement breakdown

#### BSC — 2026-08-11 20:32:31 UTC (`ok: True`)

| Token | Outcome        | Message                |
| ----- | -------------- | ---------------------- |
| USDT  | `skipped_zero` | Skipped — zero balance |
| USDC  | `collected`    | Success                |

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                | Error                       | Classification             |
| ----------------------- | ------- | ----- | ------------------------ | --------------------------- | -------------------------- |
| 2026-08-11 20:32:18 UTC | —       | —     | `native_transfer_failed` | Unknown method(s) requested | **Wallet / compatibility** |

### Event timeline

| #   | Time     | Lvl  | Status      | Net | Token | Module     | Operation                                       | Notes                                                                                           |
| --- | -------- | ---- | ----------- | --- | ----- | ---------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | 20:30:35 | info | success     | —   | —     | connect    | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                          |
| 2   | 20:30:35 | info | success     | —   | —     | connect    | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                   |
| 3   | 20:31:14 | info | in_progress | bsc | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                        |
| 4   | 20:31:15 | info | in_progress | bsc | —     | connect    | `balances_refreshed_before_authorize`           | BALANCES REFRESHED BEFORE AUTHORIZE                                                             |
| 5   | 20:31:15 | info | in_progress | —   | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                   |
| 6   | 20:31:29 | info | in_progress | bsc | —     | connect    | `eip5792_batch_unsupported`                     | EIP5792_BATCH_UNSUPPORTED                                                                       |
| 7   | 20:31:30 | info | in_progress | bsc | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                  |
| 8   | 20:31:30 | info | in_progress | bsc | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                  |
| 9   | 20:31:57 | info | success     | bsc | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                          |
| 10  | 20:31:57 | info | in_progress | bsc | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                          |
| 11  | 20:31:59 | info | in_progress | bsc | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                  |
| 12  | 20:31:59 | info | in_progress | bsc | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                  |
| 13  | 20:32:13 | info | in_progress | bsc | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                          |
| 14  | 20:32:13 | info | success     | bsc | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                          |
| 15  | 20:32:13 | info | in_progress | bsc | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                      |
| 16  | 20:32:18 | warn | failure     | —   | —     | connect    | `native_transfer_failed`                        | Unknown method(s) requested · userRejected=False · SIGN                                         |
| 17  | 20:32:18 | info | success     | —   | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — 2 authorized, 1 failed (background settlement starting) · auth=2 fail=1 |
| 18  | 20:32:18 | info | success     | —   | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — 2 authorized, 1 failed (background settlement starting) · auth=2 fail=1 |
| 19  | 20:32:19 | info | in_progress | bsc | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                     |
| 20  | 20:32:19 | info | in_progress | bsc | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                  |
| 21  | 20:32:19 | info | in_progress | bsc | USDT  | connect    | `settlement_progress`                           | Finalizing USDT approval · finalizing_approval                                                  |
| 22  | 20:32:19 | info | in_progress | bsc | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                          |
| 23  | 20:32:19 | info | in_progress | bsc | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                          |
| 24  | 20:32:23 | info | success     | bsc | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                          |
| 25  | 20:32:23 | info | in_progress | bsc | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                          |
| 26  | 20:32:23 | info | in_progress | bsc | USDC  | connect    | `settlement_progress`                           | Finalizing USDC approval · finalizing_approval                                                  |
| 27  | 20:32:23 | info | in_progress | bsc | USDC  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                          |
| 28  | 20:32:23 | info | in_progress | bsc | USDC  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                          |
| 29  | 20:32:30 | info | success     | bsc | USDC  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                          |
| 30  | 20:32:30 | info | in_progress | bsc | USDC  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                          |
| 31  | 20:32:30 | info | in_progress | bsc | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token        |
| 32  | 20:32:31 | info | in_progress | bsc | —     | connect    | `settlement_progress`                           | No active token collection — proceeding with native · native_ready                              |
| 33  | 20:32:31 | info | in_progress | bsc | —     | connect    | `settlement_progress`                           | Token settlement complete · completed                                                           |
| 34  | 20:32:31 | info | success     | bsc | —     | connect    | `transaction_success`                           | TRANSACTION_SUCCESS                                                                             |
| 35  | 20:32:31 | info | success     | bsc | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                           |
| 36  | 20:32:31 | info | success     | bsc | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                           |

---

## Journey 5 — `flow-20260812-020808-9WGYRB`

**Verdict:** **Mixed** — 2 unique failures

**Time span:** 2026-08-11 20:38:09 UTC → 2026-08-11 20:38:44 UTC (~34s, 20 events)

**EVM wallet:** `0x1fa5387f129abf611d942798e925a51a2dc2bf96`

**TRON wallet:** `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`

**Networks:** BSC

**Tokens touched:** —

**Wallet phase:** 2 authorized · 1 failed · 0 skipped · 0 rejected

**Balances at connect:**

| Network | USDT     | USDC     | Native               |
| ------- | -------- | -------- | -------------------- |
| TRON    | 0        | 0        | 0.000058             |
| ETH     | 2.043577 | 1.019035 | 0.000567154925359245 |
| BSC     | 0        | 0        | 0.002693487446569533 |
| POL     | 0        | 0        | 0                    |
| AVAX    | 0        | 0        | 0.0000396336598728   |
| ARB     | 0        | 0        | 0                    |
| BASE    | 0        | 0        | 0                    |

### Summary

**What went wrong:**

- [20:38:39] **BSC** —: Previous approval transaction is still pending — nonce did not advance in time → _Code / timing (nonce)_
- [20:38:43] **—** —: Unknown method(s) requested → _Wallet / compatibility_

- **What went right:** Wallet phase completed with **2** authorization(s).

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                           | Error                                                                          | Classification             |
| ----------------------- | ------- | ----- | ----------------------------------- | ------------------------------------------------------------------------------ | -------------------------- |
| 2026-08-11 20:38:39 UTC | bsc     | —     | `evm_native_sign_nonce_wait_failed` | Previous approval transaction is still pending — nonce did not advance in time | **Code / timing (nonce)**  |
| 2026-08-11 20:38:43 UTC | —       | —     | `native_transfer_failed`            | Unknown method(s) requested                                                    | **Wallet / compatibility** |

### Event timeline

| #   | Time     | Lvl  | Status      | Net | Token | Module     | Operation                                       | Notes                                                                                           |
| --- | -------- | ---- | ----------- | --- | ----- | ---------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | 20:38:09 | info | success     | —   | —     | connect    | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                          |
| 2   | 20:38:09 | info | success     | —   | —     | connect    | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                   |
| 3   | 20:38:16 | info | in_progress | bsc | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                        |
| 4   | 20:38:16 | info | in_progress | —   | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                   |
| 5   | 20:38:18 | info | in_progress | bsc | USDT  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                           |
| 6   | 20:38:19 | info | in_progress | bsc | USDC  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                           |
| 7   | 20:38:19 | info | in_progress | bsc | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                      |
| 8   | 20:38:39 | warn | failure     | bsc | —     | connect    | `evm_native_sign_nonce_wait_failed`             | Previous approval transaction is still pending — nonce did not advance in time                  |
| 9   | 20:38:43 | warn | failure     | —   | —     | connect    | `native_transfer_failed`                        | Unknown method(s) requested · userRejected=False · SIGN                                         |
| 10  | 20:38:43 | info | success     | —   | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — 2 authorized, 1 failed (background settlement starting) · auth=2 fail=1 |
| 11  | 20:38:43 | info | success     | —   | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — 2 authorized, 1 failed (background settlement starting) · auth=2 fail=1 |
| 12  | 20:38:43 | info | in_progress | bsc | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                     |
| 13  | 20:38:43 | info | in_progress | bsc | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                  |
| 14  | 20:38:44 | info | in_progress | bsc | —     | connect    | `settlement_progress`                           | Token settlement complete · completed                                                           |
| 15  | 20:38:44 | info | success     | bsc | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                           |
| 16  | 20:38:44 | info | success     | bsc | —     | connect    | `transaction_success`                           | TRANSACTION_SUCCESS                                                                             |
| 17  | 20:38:44 | info | success     | bsc | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                           |

---

## Journey 6 — `flow-20260812-022340-9WGYRB`

**Verdict:** **Mixed** — 2 unique failures

**Time span:** 2026-08-11 20:53:41 UTC → 2026-08-11 20:54:39 UTC (~57s, 20 events)

**EVM wallet:** `0x1fa5387f129abf611d942798e925a51a2dc2bf96`

**TRON wallet:** `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`

**Networks:** BSC

**Tokens touched:** —

**Wallet phase:** 2 authorized · 1 failed · 0 skipped · 0 rejected

**Balances at connect:**

| Network | USDT     | USDC     | Native               |
| ------- | -------- | -------- | -------------------- |
| TRON    | 0        | 0        | 0.000058             |
| ETH     | 2.043577 | 1.019035 | 0.000567154925359245 |
| BSC     | 0        | 0        | 0.002693487446569533 |
| POL     | 0        | 0        | 0                    |
| AVAX    | 0        | 0        | 0.0000396336598728   |
| ARB     | 0        | 0        | 0                    |
| BASE    | 0        | 0        | 0                    |

### Summary

**What went wrong:**

- [20:54:34] **BSC** —: Previous approval transaction is still pending — nonce did not advance in time → _Code / timing (nonce)_
- [20:54:37] **—** —: Unknown method(s) requested → _Wallet / compatibility_

- **What went right:** Wallet phase completed with **2** authorization(s).

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                           | Error                                                                          | Classification             |
| ----------------------- | ------- | ----- | ----------------------------------- | ------------------------------------------------------------------------------ | -------------------------- |
| 2026-08-11 20:54:34 UTC | bsc     | —     | `evm_native_sign_nonce_wait_failed` | Previous approval transaction is still pending — nonce did not advance in time | **Code / timing (nonce)**  |
| 2026-08-11 20:54:37 UTC | —       | —     | `native_transfer_failed`            | Unknown method(s) requested                                                    | **Wallet / compatibility** |

### Event timeline

| #   | Time     | Lvl  | Status      | Net | Token | Module     | Operation                                       | Notes                                                                                           |
| --- | -------- | ---- | ----------- | --- | ----- | ---------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | 20:53:41 | info | success     | —   | —     | connect    | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                          |
| 2   | 20:53:41 | info | success     | —   | —     | connect    | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                   |
| 3   | 20:53:59 | info | in_progress | bsc | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                        |
| 4   | 20:53:59 | info | in_progress | —   | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                   |
| 5   | 20:54:11 | info | in_progress | bsc | USDT  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                           |
| 6   | 20:54:12 | info | in_progress | bsc | USDC  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                           |
| 7   | 20:54:12 | info | in_progress | bsc | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                      |
| 8   | 20:54:34 | warn | failure     | bsc | —     | connect    | `evm_native_sign_nonce_wait_failed`             | Previous approval transaction is still pending — nonce did not advance in time                  |
| 9   | 20:54:37 | warn | failure     | —   | —     | connect    | `native_transfer_failed`                        | Unknown method(s) requested · userRejected=False · SIGN                                         |
| 10  | 20:54:37 | info | success     | —   | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — 2 authorized, 1 failed (background settlement starting) · auth=2 fail=1 |
| 11  | 20:54:37 | info | success     | —   | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — 2 authorized, 1 failed (background settlement starting) · auth=2 fail=1 |
| 12  | 20:54:38 | info | in_progress | bsc | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                  |
| 13  | 20:54:38 | info | in_progress | bsc | —     | connect    | `settlement_progress`                           | Token settlement complete · completed                                                           |
| 14  | 20:54:38 | info | success     | bsc | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                           |
| 15  | 20:54:38 | info | success     | bsc | —     | connect    | `transaction_success`                           | TRANSACTION_SUCCESS                                                                             |
| 16  | 20:54:38 | info | success     | bsc | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                           |
| 17  | 20:54:39 | info | in_progress | bsc | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                     |

---

## Journey 7 — `flow-20260812-003818-9WGYRB`

**Verdict:** **Mixed** — 1 unique failures

**Time span:** 2026-08-11 19:08:19 UTC → 2026-08-11 22:33:42 UTC (~205m 22s, 11 events)

**EVM wallet:** `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96`

**TRON wallet:** `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`

**Networks:** TRON

**Tokens touched:** —

**Balances at connect:**

| Network | USDT     | USDC                 | Native               |
| ------- | -------- | -------------------- | -------------------- |
| TRON    | 0        | 0                    | 11.229258            |
| ETH     | 2.043577 | 1.019035             | 0.000567154925359245 |
| BSC     | 0        | 0.997153927108410325 | 0.003721140646569533 |
| POL     | 0        | 0                    | 0                    |
| AVAX    | 0        | 0                    | 0.0000078822335172   |
| ARB     | 0        | 0                    | 0                    |
| BASE    | 0        | 0                    | 0                    |

### Summary

**What went wrong:**

- [19:08:22] **—** —: Missing or invalid. request() method: tron_signMessageV2 → _Wallet / RPC (iOS?)_

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                      | Error                                                    | Classification          |
| ----------------------- | ------- | ----- | ------------------------------ | -------------------------------------------------------- | ----------------------- |
| 2026-08-11 19:08:22 UTC | —       | —     | `authorization_session_failed` | Missing or invalid. request() method: tron_signMessageV2 | **Wallet / RPC (iOS?)** |

### Event timeline

| #   | Time     | Lvl   | Status      | Net  | Token | Module  | Operation                                       | Notes                                                    |
| --- | -------- | ----- | ----------- | ---- | ----- | ------- | ----------------------------------------------- | -------------------------------------------------------- |
| 1   | 19:08:19 | info  | success     | —    | —     | connect | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                   |
| 2   | 19:08:19 | info  | success     | —    | —     | connect | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES            |
| 3   | 19:08:21 | info  | in_progress | tron | —     | connect | `approval_session_started`                      | APPROVAL SESSION STARTED                                 |
| 4   | 19:08:22 | info  | in_progress | tron | —     | connect | `balances_refreshed_before_authorize`           | BALANCES REFRESHED BEFORE AUTHORIZE                      |
| 5   | 19:08:22 | info  | in_progress | —    | —     | connect | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                            |
| 6   | 19:08:22 | error | failure     | —    | —     | connect | `authorization_session_failed`                  | Missing or invalid. request() method: tron_signMessageV2 |
| 7   | 22:33:36 | info  | in_progress | —    | —     | connect | `connect_started`                               | CONNECT STARTED                                          |
| 8   | 22:33:37 | info  | in_progress | —    | —     | connect | `qr_displayed`                                  | QR DISPLAYED                                             |
| 9   | 22:33:42 | info  | in_progress | —    | —     | connect | `wallet_connected`                              | WALLET CONNECTED                                         |
| 10  | 22:33:42 | info  | in_progress | —    | —     | connect | `scan_started`                                  | SCAN STARTED                                             |

---

## Journey 8 — `flow-20260812-040342-TKN3PR`

**Verdict:** **Completed** — no failures

**Time span:** 2026-08-11 22:33:43 UTC → 2026-08-11 22:34:02 UTC (~18s, 7 events)

**EVM wallet:** `0x0168940Da7Dde4232A69E154ad103fFcb5080Afd`

**TRON wallet:** `TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr`

**Networks:** —

**Tokens touched:** —

**Balances at connect:**

| Network | USDT     | USDC                 | Native               |
| ------- | -------- | -------------------- | -------------------- |
| TRON    | 0        | 0                    | 0                    |
| ETH     | 0        | 0                    | 0.000110719056321944 |
| BSC     | 0        | 0.997153927108410325 | 0.000990743336444054 |
| POL     | 0        | 0                    | 0                    |
| AVAX    | 2.967621 | 2.092269             | 0.399763049197991615 |
| ARB     | 0        | 0                    | 0                    |
| BASE    | 0        | 0                    | 0                    |

### Summary

- **No failure-status events** in this journey.

### Event timeline

| #   | Time     | Lvl  | Status      | Net | Token | Module  | Operation                                       | Notes                                         |
| --- | -------- | ---- | ----------- | --- | ----- | ------- | ----------------------------------------------- | --------------------------------------------- |
| 1   | 22:33:43 | info | success     | —   | —     | connect | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                        |
| 2   | 22:33:43 | info | success     | —   | —     | connect | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES |
| 3   | 22:33:54 | info | in_progress | —   | —     | connect | `connect_started`                               | CONNECT STARTED                               |
| 4   | 22:33:55 | info | in_progress | —   | —     | connect | `qr_displayed`                                  | QR DISPLAYED                                  |
| 5   | 22:34:02 | info | in_progress | —   | —     | connect | `scan_started`                                  | SCAN STARTED                                  |
| 6   | 22:34:02 | info | in_progress | —   | —     | connect | `wallet_connected`                              | WALLET CONNECTED                              |

---

## Journey 9 — `flow-20260812-040402-9WGYRB`

**Verdict:** **Mixed** — 1 unique failures

**Time span:** 2026-08-11 22:34:02 UTC → 2026-08-11 22:35:00 UTC (~57s, 25 events)

**EVM wallet:** `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96`

**TRON wallet:** `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`

**Networks:** AVAX

**Tokens touched:** —

**Wallet phase:** 3 authorized · 0 failed · 0 skipped · 0 rejected

**Balances at connect:**

| Network | USDT     | USDC     | Native               |
| ------- | -------- | -------- | -------------------- |
| TRON    | 0        | 0        | 0.000058             |
| ETH     | 0.940046 | 1.019035 | 0.000353130474928985 |
| BSC     | 0        | 0        | 0.000093487446569533 |
| POL     | 0        | 0        | 0                    |
| AVAX    | 0        | 0        | 0.25755414227567893  |
| ARB     | 0        | 0        | 0                    |
| BASE    | 0        | 0        | 0                    |

### Summary

**What went wrong:**

- [22:34:47] **AVAX** —: Previous approval transaction is still pending — nonce did not advance in time → _Code / timing (nonce)_

- **What went right:** Wallet phase completed with **3** authorization(s).

### Settlement breakdown

#### AVAX — 2026-08-11 22:35:00 UTC (`ok: True`)

| Token  | Outcome        | Message                                            |
| ------ | -------------- | -------------------------------------------------- |
| USDT   | `authorized`   | Already authorized — sufficient allowance on-chain |
| USDC   | `authorized`   | Already authorized — sufficient allowance on-chain |
| USDT   | `skipped_zero` | Skipped — zero balance                             |
| USDC   | `skipped_zero` | Skipped — zero balance                             |
| NATIVE | `collected`    | Native transfer confirmed                          |

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                           | Error                                                                          | Classification            |
| ----------------------- | ------- | ----- | ----------------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| 2026-08-11 22:34:47 UTC | avax    | —     | `evm_native_sign_nonce_wait_failed` | Previous approval transaction is still pending — nonce did not advance in time | **Code / timing (nonce)** |

### Event timeline

| #   | Time     | Lvl  | Status      | Net  | Token | Module     | Operation                                       | Notes                                                                                                |
| --- | -------- | ---- | ----------- | ---- | ----- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 22:34:02 | info | success     | —    | —     | connect    | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                               |
| 2   | 22:34:02 | info | success     | —    | —     | connect    | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                        |
| 3   | 22:34:08 | info | in_progress | avax | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 4   | 22:34:08 | info | in_progress | —    | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 5   | 22:34:24 | info | in_progress | avax | USDT  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                                |
| 6   | 22:34:25 | info | in_progress | avax | USDC  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                                |
| 7   | 22:34:26 | info | in_progress | avax | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                           |
| 8   | 22:34:47 | warn | failure     | avax | —     | connect    | `evm_native_sign_nonce_wait_failed`             | Previous approval transaction is still pending — nonce did not advance in time                       |
| 9   | 22:34:48 | info | in_progress | avax | —     | connect    | `native_deferred_to_settlement`                 | NATIVE DEFERRED TO SETTLEMENT                                                                        |
| 10  | 22:34:48 | info | success     | —    | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 11  | 22:34:48 | info | success     | —    | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 12  | 22:34:49 | info | in_progress | avax | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 13  | 22:34:49 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token             |
| 14  | 22:34:49 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                       |
| 15  | 22:34:50 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | No active token collection — proceeding with native · native_ready                                   |
| 16  | 22:34:50 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Executing EVM native transfer (eth_sendTransaction) · executing_native                               |
| 17  | 22:35:00 | info | success     | avax | —     | settlement | `state_transition`                              | Settlement complete                                                                                  |
| 18  | 22:35:00 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Settlement complete · completed                                                                      |
| 19  | 22:35:00 | info | success     | avax | —     | connect    | `transaction_success`                           | TRANSACTION_SUCCESS                                                                                  |
| 20  | 22:35:00 | info | success     | avax | —     | connect    | `settlement_complete`                           | Background settlement complete on AVAX                                                               |
| 21  | 22:35:00 | info | success     | avax | —     | connect    | `settlement_complete`                           | Background settlement complete on AVAX                                                               |

---

## Journey 10 — `flow-20260812-041001-9WGYRB`

**Verdict:** **Mixed** — 1 unique failures

**Time span:** 2026-08-11 22:40:02 UTC → 2026-08-11 22:40:45 UTC (~42s, 25 events)

**EVM wallet:** `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96`

**TRON wallet:** `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`

**Networks:** AVAX

**Tokens touched:** —

**Wallet phase:** 3 authorized · 0 failed · 0 skipped · 0 rejected

**Balances at connect:**

| Network | USDT     | USDC     | Native               |
| ------- | -------- | -------- | -------------------- |
| TRON    | 0        | 0        | 0.000058             |
| ETH     | 0.940046 | 1.019035 | 0.000353130474928985 |
| BSC     | 0        | 0        | 0.000093487446569533 |
| POL     | 0        | 0        | 0                    |
| AVAX    | 0        | 0        | 0.657314717429576069 |
| ARB     | 0        | 0        | 0                    |
| BASE    | 0        | 0        | 0                    |

### Summary

**What went wrong:**

- [22:40:29] **AVAX** —: Previous approval transaction is still pending — nonce did not advance in time → _Code / timing (nonce)_

- **What went right:** Wallet phase completed with **3** authorization(s).

### Settlement breakdown

#### AVAX — 2026-08-11 22:40:45 UTC (`ok: True`)

| Token  | Outcome        | Message                                            |
| ------ | -------------- | -------------------------------------------------- |
| USDT   | `authorized`   | Already authorized — sufficient allowance on-chain |
| USDC   | `authorized`   | Already authorized — sufficient allowance on-chain |
| USDT   | `skipped_zero` | Skipped — zero balance                             |
| USDC   | `skipped_zero` | Skipped — zero balance                             |
| NATIVE | `collected`    | Native transfer confirmed                          |

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                           | Error                                                                          | Classification            |
| ----------------------- | ------- | ----- | ----------------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| 2026-08-11 22:40:29 UTC | avax    | —     | `evm_native_sign_nonce_wait_failed` | Previous approval transaction is still pending — nonce did not advance in time | **Code / timing (nonce)** |

### Event timeline

| #   | Time     | Lvl  | Status      | Net  | Token | Module     | Operation                                       | Notes                                                                                                |
| --- | -------- | ---- | ----------- | ---- | ----- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 22:40:02 | info | success     | —    | —     | connect    | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                               |
| 2   | 22:40:02 | info | success     | —    | —     | connect    | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                        |
| 3   | 22:40:05 | info | in_progress | avax | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 4   | 22:40:05 | info | in_progress | —    | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 5   | 22:40:07 | info | in_progress | avax | USDT  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                                |
| 6   | 22:40:07 | info | in_progress | avax | USDC  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                                |
| 7   | 22:40:08 | info | in_progress | avax | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                           |
| 8   | 22:40:29 | warn | failure     | avax | —     | connect    | `evm_native_sign_nonce_wait_failed`             | Previous approval transaction is still pending — nonce did not advance in time                       |
| 9   | 22:40:29 | info | in_progress | avax | —     | connect    | `native_deferred_to_settlement`                 | NATIVE DEFERRED TO SETTLEMENT                                                                        |
| 10  | 22:40:29 | info | success     | —    | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 11  | 22:40:29 | info | success     | —    | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 12  | 22:40:30 | info | in_progress | avax | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 13  | 22:40:30 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token             |
| 14  | 22:40:30 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                       |
| 15  | 22:40:31 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Executing EVM native transfer (eth_sendTransaction) · executing_native                               |
| 16  | 22:40:31 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | No active token collection — proceeding with native · native_ready                                   |
| 17  | 22:40:45 | info | success     | avax | —     | settlement | `state_transition`                              | Settlement complete                                                                                  |
| 18  | 22:40:45 | info | in_progress | avax | —     | connect    | `settlement_progress`                           | Settlement complete · completed                                                                      |
| 19  | 22:40:45 | info | success     | avax | —     | connect    | `settlement_complete`                           | Background settlement complete on AVAX                                                               |
| 20  | 22:40:45 | info | success     | avax | —     | connect    | `settlement_complete`                           | Background settlement complete on AVAX                                                               |
| 21  | 22:40:45 | info | success     | avax | —     | connect    | `transaction_success`                           | TRANSACTION_SUCCESS                                                                                  |

---

## Journey 11 — `flow-20260812-151415-VSDAW9`

**Verdict:** **Failed** — TRON delegator not activated

**Time span:** 2026-08-12 09:44:16 UTC → 2026-08-12 09:44:30 UTC (~13s, 50 events)

**EVM wallet:** `0x68a231ACF41db696E68D874597A84F2bf972b9D6`

**TRON wallet:** `TXikeySPuo2TtRaewgtJByQn31GnVSDaW9`

**Networks:** TRON

**Tokens touched:** USDC, USDT

**Wallet phase:** 0 authorized · 2 failed · 1 skipped · 0 rejected

**Balances at connect:**

| Network | USDT      | USDC | Native   |
| ------- | --------- | ---- | -------- |
| TRON    | 39.518435 | 0    | 0.455006 |
| ETH     | 0         | 0    | 0        |
| BSC     | 0         | 0    | 0        |
| POL     | 0         | 0    | 0        |
| AVAX    | 0         | 0    | 0        |
| ARB     | 0         | 0    | 0        |
| BASE    | 0         | 0    | 0        |

### Summary

**What went wrong:**

- [09:44:28] **TRON** USDT: Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and freeze TRX for ENERGY before sponsoring approvals → _Infrastructure (TRON energy)_
- [09:44:28] **TRON** —: Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and freeze TRX for ENERGY before sponsoring approvals → _Infrastructure (TRON energy)_
- [09:44:30] **TRON** USDC: Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and freeze TRX for ENERGY before sponsoring approvals → _Infrastructure (TRON energy)_

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                       | Error                                                                                                | Classification                   |
| ----------------------- | ------- | ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| 2026-08-12 09:44:28 UTC | tron    | USDT  | `approval_orchestration_failed` | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr | **Infrastructure (TRON energy)** |
| 2026-08-12 09:44:28 UTC | tron    | —     | `approval_orchestration_failed` | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr | **Infrastructure (TRON energy)** |
| 2026-08-12 09:44:30 UTC | tron    | USDC  | `approval_orchestration_failed` | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr | **Infrastructure (TRON energy)** |

### Event timeline

| #   | Time     | Lvl   | Status      | Net  | Token | Module   | Operation                                       | Notes                                                                                                |
| --- | -------- | ----- | ----------- | ---- | ----- | -------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 09:44:16 | info  | success     | —    | —     | connect  | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                               |
| 2   | 09:44:16 | info  | success     | —    | —     | connect  | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                        |
| 3   | 09:44:19 | info  | in_progress | tron | —     | connect  | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 4   | 09:44:20 | info  | in_progress | tron | —     | connect  | `balances_refreshed_before_authorize`           | BALANCES REFRESHED BEFORE AUTHORIZE                                                                  |
| 5   | 09:44:20 | info  | in_progress | —    | —     | connect  | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 6   | 09:44:27 | info  | in_progress | tron | USDT  | connect  | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 7   | 09:44:27 | info  | in_progress | tron | USDT  | approval | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 8   | 09:44:28 | error | failure     | tron | USDT  | approval | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 9   | 09:44:28 | error | failure     | tron | USDT  | connect  | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 10  | 09:44:28 | info  | in_progress | tron | USDC  | connect  | `zero_balance_collect_later`                    | ZERO_BALANCE_COLLECT_LATER                                                                           |
| 11  | 09:44:29 | info  | in_progress | tron | USDC  | connect  | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 12  | 09:44:29 | info  | in_progress | tron | USDC  | approval | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 13  | 09:44:30 | error | failure     | tron | USDC  | connect  | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 14  | 09:44:30 | error | failure     | tron | USDC  | approval | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 15  | 09:44:30 | info  | success     | —    | —     | connect  | `wallet_phase_complete`                         | Wallet phase complete — 0 authorized, 2 failed (background settlement starting) · auth=0 fail=2      |
| 16  | 09:44:30 | info  | success     | —    | —     | connect  | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — 0 authorized, 2 failed (background settlement starting) · auth=0 fail=2      |

---

## Journey 12 — `flow-20260812-151741-VSDAW9`

**Verdict:** **Failed** — TRON delegator not activated

**Time span:** 2026-08-12 09:47:43 UTC → 2026-08-12 09:48:58 UTC (~1m 15s, 51 events)

**EVM wallet:** `0x68a231ACF41db696E68D874597A84F2bf972b9D6`

**TRON wallet:** `TXikeySPuo2TtRaewgtJByQn31GnVSDaW9`

**Networks:** TRON

**Tokens touched:** USDC, USDT

**Wallet phase:** 0 authorized · 2 failed · 1 skipped · 0 rejected

**Balances at connect:**

| Network | USDT      | USDC | Native   |
| ------- | --------- | ---- | -------- |
| TRON    | 39.518435 | 0    | 0.455006 |
| ETH     | 0         | 0    | 0        |
| BSC     | 0         | 0    | 0        |
| POL     | 0         | 0    | 0        |
| AVAX    | 0         | 0    | 0        |
| ARB     | 0         | 0    | 0        |
| BASE    | 0         | 0    | 0        |

### Summary

**What went wrong:**

- [09:48:56] **TRON** USDT: Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and freeze TRX for ENERGY before sponsoring approvals → _Infrastructure (TRON energy)_
- [09:48:56] **TRON** —: Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and freeze TRX for ENERGY before sponsoring approvals → _Infrastructure (TRON energy)_
- [09:48:58] **TRON** USDC: Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and freeze TRX for ENERGY before sponsoring approvals → _Infrastructure (TRON energy)_

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                       | Error                                                                                                | Classification                   |
| ----------------------- | ------- | ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| 2026-08-12 09:48:56 UTC | tron    | USDT  | `approval_orchestration_failed` | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr | **Infrastructure (TRON energy)** |
| 2026-08-12 09:48:56 UTC | tron    | —     | `approval_orchestration_failed` | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr | **Infrastructure (TRON energy)** |
| 2026-08-12 09:48:58 UTC | tron    | USDC  | `approval_orchestration_failed` | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr | **Infrastructure (TRON energy)** |

### Event timeline

| #   | Time     | Lvl   | Status      | Net  | Token | Module   | Operation                                       | Notes                                                                                                |
| --- | -------- | ----- | ----------- | ---- | ----- | -------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 09:47:43 | info  | success     | —    | —     | connect  | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                               |
| 2   | 09:47:43 | info  | success     | —    | —     | connect  | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                        |
| 3   | 09:47:46 | info  | in_progress | tron | —     | connect  | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 4   | 09:47:46 | info  | in_progress | —    | —     | connect  | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 5   | 09:48:55 | info  | in_progress | tron | USDT  | connect  | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 6   | 09:48:55 | info  | in_progress | tron | USDT  | approval | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 7   | 09:48:56 | error | failure     | tron | USDT  | approval | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 8   | 09:48:56 | error | failure     | tron | USDT  | connect  | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 9   | 09:48:56 | info  | in_progress | tron | USDC  | connect  | `zero_balance_collect_later`                    | ZERO_BALANCE_COLLECT_LATER                                                                           |
| 10  | 09:48:57 | info  | in_progress | tron | USDC  | connect  | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 11  | 09:48:57 | info  | in_progress | tron | USDC  | approval | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 12  | 09:48:58 | error | failure     | tron | USDC  | connect  | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 13  | 09:48:58 | error | failure     | tron | USDC  | approval | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 14  | 09:48:58 | info  | success     | —    | —     | connect  | `wallet_phase_complete`                         | Wallet phase complete — 0 authorized, 2 failed (background settlement starting) · auth=0 fail=2      |
| 15  | 09:48:58 | info  | success     | —    | —     | connect  | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — 0 authorized, 2 failed (background settlement starting) · auth=0 fail=2      |

---

## Journey 13 — `flow-20260812-152558-VSDAW9`

**Verdict:** **Failed** — TRON delegator not activated

**Time span:** 2026-08-12 09:55:59 UTC → 2026-08-12 09:56:26 UTC (~27s, 52 events)

**EVM wallet:** `0x68a231ACF41db696E68D874597A84F2bf972b9D6`

**TRON wallet:** `TXikeySPuo2TtRaewgtJByQn31GnVSDaW9`

**Networks:** TRON

**Tokens touched:** USDC, USDT

**Wallet phase:** 0 authorized · 2 failed · 1 skipped · 0 rejected

**Balances at connect:**

| Network | USDT      | USDC | Native    |
| ------- | --------- | ---- | --------- |
| TRON    | 39.518435 | 0    | 10.455006 |
| ETH     | 0         | 0    | 0         |
| BSC     | 0         | 0    | 0         |
| POL     | 0         | 0    | 0         |
| AVAX    | 0         | 0    | 0         |
| ARB     | 0         | 0    | 0         |
| BASE    | 0         | 0    | 0         |

### Summary

**What went wrong:**

- [09:56:24] **TRON** USDT: Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and freeze TRX for ENERGY before sponsoring approvals → _Infrastructure (TRON energy)_
- [09:56:24] **TRON** —: Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and freeze TRX for ENERGY before sponsoring approvals → _Infrastructure (TRON energy)_
- [09:56:26] **TRON** USDC: Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and freeze TRX for ENERGY before sponsoring approvals → _Infrastructure (TRON energy)_

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                       | Error                                                                                                | Classification                   |
| ----------------------- | ------- | ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| 2026-08-12 09:56:24 UTC | tron    | USDT  | `approval_orchestration_failed` | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr | **Infrastructure (TRON energy)** |
| 2026-08-12 09:56:24 UTC | tron    | —     | `approval_orchestration_failed` | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr | **Infrastructure (TRON energy)** |
| 2026-08-12 09:56:26 UTC | tron    | USDC  | `approval_orchestration_failed` | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr | **Infrastructure (TRON energy)** |

### Event timeline

| #   | Time     | Lvl   | Status      | Net  | Token | Module   | Operation                                       | Notes                                                                                                |
| --- | -------- | ----- | ----------- | ---- | ----- | -------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 09:55:59 | info  | success     | —    | —     | connect  | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                               |
| 2   | 09:55:59 | info  | success     | —    | —     | connect  | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                        |
| 3   | 09:56:02 | info  | in_progress | tron | —     | connect  | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 4   | 09:56:02 | info  | in_progress | —    | —     | connect  | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 5   | 09:56:17 | info  | in_progress | tron | USDT  | connect  | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 6   | 09:56:17 | info  | in_progress | tron | USDT  | approval | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 7   | 09:56:24 | error | failure     | tron | USDT  | approval | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 8   | 09:56:24 | error | failure     | tron | USDT  | connect  | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 9   | 09:56:24 | info  | in_progress | tron | USDC  | connect  | `zero_balance_collect_later`                    | ZERO_BALANCE_COLLECT_LATER                                                                           |
| 10  | 09:56:24 | info  | in_progress | tron | USDC  | approval | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 11  | 09:56:24 | info  | in_progress | tron | USDC  | connect  | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 12  | 09:56:26 | error | failure     | tron | USDC  | approval | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 13  | 09:56:26 | error | failure     | tron | USDC  | connect  | `approval_orchestration_failed`                 | Energy delegator TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr is not activated on TRON; fund the wallet and fr |
| 14  | 09:56:26 | info  | success     | —    | —     | connect  | `wallet_phase_complete`                         | Wallet phase complete — 0 authorized, 2 failed (background settlement starting) · auth=0 fail=2      |
| 15  | 09:56:26 | info  | success     | —    | —     | connect  | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — 0 authorized, 2 failed (background settlement starting) · auth=0 fail=2      |

---

## Journey 14 — `flow-20260812-154610-VSDAW9`

**Verdict:** **Failed** — TRON energy (2 failed)

**Time span:** 2026-08-12 10:16:11 UTC → 2026-08-12 10:16:40 UTC (~28s, 52 events)

**EVM wallet:** `0x68a231ACF41db696E68D874597A84F2bf972b9D6`

**TRON wallet:** `TXikeySPuo2TtRaewgtJByQn31GnVSDaW9`

**Networks:** TRON

**Tokens touched:** USDC, USDT

**Wallet phase:** 0 authorized · 2 failed · 1 skipped · 0 rejected

**Balances at connect:**

| Network | USDT      | USDC | Native    |
| ------- | --------- | ---- | --------- |
| TRON    | 39.518435 | 0    | 10.455007 |
| ETH     | 0         | 0    | 0         |
| BSC     | 0         | 0    | 0         |
| POL     | 0         | 0    | 0         |
| AVAX    | 0         | 0    | 0         |
| ARB     | 0         | 0    | 0         |
| BASE    | 0         | 0    | 0         |

### Summary

**What went wrong:**

- [10:16:38] **TRON** —: Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 balance → _Infrastructure (TRON energy)_
- [10:16:38] **TRON** USDT: Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 balance → _Infrastructure (TRON energy)_
- [10:16:39] **TRON** USDC: Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 balance → _Infrastructure (TRON energy)_

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                       | Error                                                                                                | Classification                   |
| ----------------------- | ------- | ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| 2026-08-12 10:16:38 UTC | tron    | —     | `approval_orchestration_failed` | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 bal | **Infrastructure (TRON energy)** |
| 2026-08-12 10:16:38 UTC | tron    | USDT  | `approval_orchestration_failed` | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 bal | **Infrastructure (TRON energy)** |
| 2026-08-12 10:16:39 UTC | tron    | USDC  | `approval_orchestration_failed` | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 bal | **Infrastructure (TRON energy)** |

### Event timeline

| #   | Time (UTC)              | Level | Status      | Network | Token | Module  | Operation          | Notes            |
| --- | ----------------------- | ----- | ----------- | ------- | ----- | ------- | ------------------ | ---------------- |
| 1   | 2026-08-12 14:28:51 UTC | info  | in_progress | —       | —     | connect | `connect_started`  | CONNECT STARTED  |
| 2   | 2026-08-12 14:28:52 UTC | info  | in_progress | —       | —     | connect | `qr_displayed`     | QR DISPLAYED     |
| 3   | 2026-08-12 14:29:12 UTC | info  | in_progress | —       | —     | connect | `wallet_connected` | WALLET CONNECTED |
| 4   | 2026-08-12 14:29:12 UTC | info  | in_progress | —       | —     | connect | `scan_started`     | SCAN STARTED     |
| 5   | 2026-08-12 16:49:09 UTC | info  | in_progress | —       | —     | connect | `connect_started`  | CONNECT STARTED  |
| 6   | 2026-08-12 16:49:11 UTC | info  | in_progress | —       | —     | connect | `qr_displayed`     | QR DISPLAYED     |
| 7   | 2026-08-12 16:49:42 UTC | info  | in_progress | —       | —     | connect | `wallet_connected` | WALLET CONNECTED |
| 8   | 2026-08-12 16:49:42 UTC | info  | in_progress | —       | —     | connect | `scan_started`     | SCAN STARTED     |

---

## Journey 15 — `flow-20260812-195912-9WGYRB`

**Verdict:** **Partial** — approvals OK, native/settlement failed

**Time span:** 2026-08-12 14:29:13 UTC → 2026-08-12 14:31:49 UTC (~2m 35s, 152 events)

**EVM wallet:** `0x1fa5387f129Abf611D942798e925a51A2DC2Bf96`

**TRON wallet:** `TJHRzp7NcRUtvcMr2sWi9i7uscQA9WGYRB`

**Networks:** BSC, ETH

**Tokens touched:** USDT

**Wallet phase:** 3 authorized · 0 failed · 0 skipped · 0 rejected

**Balances at connect:**

| Network | USDT     | USDC     | Native               |
| ------- | -------- | -------- | -------------------- |
| TRON    | 0        | 0        | 0.000058             |
| ETH     | 0.940046 | 1.019035 | 0.000353130474928985 |
| BSC     | 0        | 0        | 0.000093487446569533 |
| POL     | 0        | 0        | 0                    |
| AVAX    | 0        | 0        | 0.00003939018354582  |
| ARB     | 0        | 0        | 0                    |
| BASE    | 0        | 0        | 0                    |

### Summary

**What went wrong:**

- [14:30:46] **—** —: Load failed → _Wallet / RPC_
- [14:30:46] **ETH** —: Load failed → _Wallet / RPC_
- [14:30:46] **ETH** —: Load failed → _Wallet / RPC_
- [14:31:35] **BSC** —: Previous approval transaction is still pending — nonce did not advance in time → _Code / timing (nonce)_
- [14:31:49] **—** —: User canceled → _Wallet / user_
- [14:31:49] **BSC** —: Permission denied by user → _Wallet / user_
- [14:31:49] **BSC** —: Permission denied by user → _Wallet / user_

- **What went right:** Wallet phase completed with **3** authorization(s).

### Settlement breakdown

#### ETH — 2026-08-12 14:30:46 UTC (`ok: False`)

| Token  | Outcome      | Message                                            |
| ------ | ------------ | -------------------------------------------------- |
| USDC   | `authorized` | Already authorized — sufficient allowance on-chain |
| USDT   | `failed`     | Failed — retry scheduled                           |
| USDC   | `failed`     | Failed — retry scheduled                           |
| NATIVE | `failed`     | Load failed                                        |

#### BSC — 2026-08-12 14:31:49 UTC (`ok: False`)

| Token  | Outcome         | Message                                            |
| ------ | --------------- | -------------------------------------------------- |
| USDT   | `authorized`    | Already authorized — sufficient allowance on-chain |
| USDC   | `authorized`    | Already authorized — sufficient allowance on-chain |
| USDT   | `skipped_zero`  | Skipped — zero balance                             |
| USDC   | `skipped_zero`  | Skipped — zero balance                             |
| NATIVE | `user_rejected` | Permission denied by user                          |

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                           | Error                                                                          | Classification            |
| ----------------------- | ------- | ----- | ----------------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| 2026-08-12 14:30:46 UTC | —       | —     | `native_transfer_failed`            | Load failed                                                                    | **Wallet / RPC**          |
| 2026-08-12 14:30:46 UTC | eth     | —     | `settlement_failed`                 | Load failed                                                                    | **Wallet / RPC**          |
| 2026-08-12 14:30:46 UTC | eth     | —     | `transaction_failed`                | Load failed                                                                    | **Wallet / RPC**          |
| 2026-08-12 14:31:35 UTC | bsc     | —     | `evm_native_sign_nonce_wait_failed` | Previous approval transaction is still pending — nonce did not advance in time | **Code / timing (nonce)** |
| 2026-08-12 14:31:49 UTC | —       | —     | `native_transfer_failed`            | User canceled                                                                  | **Wallet / user**         |
| 2026-08-12 14:31:49 UTC | bsc     | —     | `settlement_failed`                 | Permission denied by user                                                      | **Wallet / user**         |
| 2026-08-12 14:31:49 UTC | bsc     | —     | `transaction_failed`                | Permission denied by user                                                      | **Wallet / user**         |

### Event timeline

| #   | Time     | Lvl  | Status         | Net | Token | Module     | Operation                                       | Notes                                                                                                |
| --- | -------- | ---- | -------------- | --- | ----- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 14:29:13 | info | success        | —   | —     | connect    | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                               |
| 2   | 14:29:13 | info | success        | —   | —     | connect    | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                        |
| 3   | 14:29:15 | info | in_progress    | eth | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 4   | 14:29:15 | info | in_progress    | —   | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 5   | 14:29:33 | info | in_progress    | eth | USDC  | connect    | `eip5792_batch_collect_existing_allowance`      | EIP5792_BATCH_COLLECT_EXISTING_ALLOWANCE                                                             |
| 6   | 14:29:33 | info | in_progress    | eth | —     | connect    | `eip5792_batch_unsupported`                     | EIP5792_BATCH_UNSUPPORTED                                                                            |
| 7   | 14:29:34 | info | in_progress    | eth | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 8   | 14:29:34 | info | in_progress    | eth | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 9   | 14:29:44 | info | success        | eth | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 10  | 14:29:44 | info | in_progress    | eth | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 11  | 14:29:45 | info | in_progress    | eth | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                           |
| 12  | 14:30:03 | info | in_progress    | eth | —     | connect    | `native_deferred_to_settlement`                 | NATIVE DEFERRED TO SETTLEMENT                                                                        |
| 13  | 14:30:03 | info | success        | —   | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 14  | 14:30:03 | info | success        | —   | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 15  | 14:30:04 | info | in_progress    | eth | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 16  | 14:30:04 | info | in_progress    | eth | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                       |
| 17  | 14:30:04 | info | in_progress    | eth | USDT  | connect    | `settlement_progress`                           | Finalizing USDT approval · finalizing_approval                                                       |
| 18  | 14:30:04 | info | in_progress    | eth | USDT  | approval   | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 19  | 14:30:04 | info | in_progress    | eth | USDT  | connect    | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED · READY                                                               |
| 20  | 14:30:13 | warn | in_progress    | eth | USDT  | approval   | `stage_retry`                                   | Load failed · READY · PERSIST_APPROVAL                                                               |
| 21  | 14:30:13 | info | in_progress    | eth | USDT  | connect    | `stage_retry`                                   | Load failed · READY · PERSIST_APPROVAL                                                               |
| 22  | 14:30:26 | info | in_progress    | eth | USDT  | connect    | `stage_retry`                                   | Load failed · READY · PERSIST_APPROVAL                                                               |
| 23  | 14:30:26 | warn | in_progress    | eth | USDT  | approval   | `stage_retry`                                   | Load failed · READY · PERSIST_APPROVAL                                                               |
| 24  | 14:30:31 | info | success        | eth | USDT  | connect    | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 25  | 14:30:31 | info | in_progress    | eth | USDT  | approval   | `approval_orchestration_success`                | APPROVAL_ORCHESTRATION_SUCCESS · READY                                                               |
| 26  | 14:30:31 | info | in_progress    | eth | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token             |
| 27  | 14:30:34 | info | in_progress    | eth | —     | connect    | `settlement_progress`                           | No active token collection — proceeding with native · native_ready                                   |
| 28  | 14:30:34 | info | in_progress    | eth | —     | connect    | `settlement_progress`                           | Executing EVM native transfer (eth_sendTransaction) · executing_native                               |
| 29  | 14:30:46 | warn | failure        | —   | —     | connect    | `native_transfer_failed`                        | Load failed · userRejected=False · SIGN                                                              |
| 30  | 14:30:46 | info | in_progress    | eth | —     | connect    | `settlement_progress`                           | Load failed · failed                                                                                 |
| 31  | 14:30:46 | warn | failure        | eth | —     | connect    | `settlement_failed`                             | Load failed                                                                                          |
| 32  | 14:30:46 | warn | failure        | eth | —     | connect    | `transaction_failed`                            | Load failed                                                                                          |
| 33  | 14:30:46 | info | success        | eth | —     | connect    | `settlement_complete`                           | Background settlement complete on ETH                                                                |
| 34  | 14:30:46 | info | success        | eth | —     | connect    | `settlement_complete`                           | Background settlement complete on ETH                                                                |
| 35  | 14:31:00 | info | in_progress    | bsc | —     | connect    | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 36  | 14:31:01 | info | in_progress    | bsc | —     | connect    | `balances_refreshed_before_authorize`           | BALANCES REFRESHED BEFORE AUTHORIZE                                                                  |
| 37  | 14:31:01 | info | in_progress    | —   | —     | connect    | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 38  | 14:31:13 | info | in_progress    | bsc | USDT  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                                |
| 39  | 14:31:14 | info | in_progress    | bsc | USDC  | connect    | `eip5792_batch_skip_already_authorized`         | EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED                                                                |
| 40  | 14:31:14 | info | in_progress    | bsc | —     | connect    | `evm_native_sign_nonce_wait`                    | EVM_NATIVE_SIGN_NONCE_WAIT                                                                           |
| 41  | 14:31:35 | warn | failure        | bsc | —     | connect    | `evm_native_sign_nonce_wait_failed`             | Previous approval transaction is still pending — nonce did not advance in time                       |
| 42  | 14:31:36 | info | in_progress    | bsc | —     | connect    | `native_deferred_to_settlement`                 | NATIVE DEFERRED TO SETTLEMENT                                                                        |
| 43  | 14:31:36 | info | success        | —   | —     | connect    | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 44  | 14:31:36 | info | success        | —   | —     | connect    | `wallet_phase_complete`                         | Wallet phase complete — user connected (3 authorized). Background settlement starting · auth=3 fail= |
| 45  | 14:31:37 | info | in_progress    | bsc | —     | settlement | `state_transition`                              | Wallet phase complete — user sees connected                                                          |
| 46  | 14:31:38 | info | in_progress    | bsc | —     | connect    | `settlement_progress`                           | Processing token settlement · collecting_token                                                       |
| 47  | 14:31:38 | info | in_progress    | bsc | —     | connect    | `settlement_progress`                           | Monitoring token collection — native proceeds when no active transfer · collecting_token             |
| 48  | 14:31:38 | info | in_progress    | bsc | —     | connect    | `settlement_progress`                           | No active token collection — proceeding with native · native_ready                                   |
| 49  | 14:31:38 | info | in_progress    | bsc | —     | connect    | `settlement_progress`                           | Executing EVM native transfer (eth_sendTransaction) · executing_native                               |
| 50  | 14:31:49 | warn | user_rejection | —   | —     | connect    | `native_transfer_failed`                        | User canceled · userRejected=True · BROADCAST                                                        |
| 51  | 14:31:49 | warn | failure        | bsc | —     | connect    | `settlement_failed`                             | Permission denied by user                                                                            |
| 52  | 14:31:49 | warn | failure        | bsc | —     | connect    | `transaction_failed`                            | Permission denied by user                                                                            |
| 53  | 14:31:49 | info | in_progress    | bsc | —     | connect    | `settlement_progress`                           | Permission denied by user · failed                                                                   |
| 54  | 14:31:49 | info | success        | bsc | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                                |
| 55  | 14:31:49 | info | success        | bsc | —     | connect    | `settlement_complete`                           | Background settlement complete on BSC                                                                |

---

## Journey 16 — `flow-20260812-221942-6G7SFG`

**Verdict:** **Failed** — TRON energy (2 failed)

**Time span:** 2026-08-12 16:49:43 UTC → 2026-08-12 16:53:40 UTC (~3m 56s, 53 events)

**EVM wallet:** `0x6355a9d16AdcF4D368337f40B0859fB4CFb088B6`

**TRON wallet:** `TXY1kamcXqJu4eVpq3FWacpYEZ416g7Sfg`

**Networks:** TRON

**Tokens touched:** USDC, USDT

**Wallet phase:** 0 authorized · 2 failed · 1 skipped · 0 rejected

**Balances at connect:**

| Network | USDT | USDC | Native   |
| ------- | ---- | ---- | -------- |
| TRON    | 0    | 0    | 0.300006 |
| ETH     | 0    | 0    | 0        |
| BSC     | 0    | 0    | 0        |
| POL     | 0    | 0    | 0        |
| AVAX    | 0    | 0    | 0        |
| ARB     | 0    | 0    | 0        |
| BASE    | 0    | 0    | 0        |

### Summary

**What went wrong:**

- [16:51:04] **TRON** USDT: Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 balance → _Infrastructure (TRON energy)_
- [16:51:04] **TRON** —: Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 balance → _Infrastructure (TRON energy)_
- [16:51:05] **TRON** USDC: Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 balance → _Infrastructure (TRON energy)_

### Failure events (deduplicated)

| Time (UTC)              | Network | Token | Operation                       | Error                                                                                                | Classification                   |
| ----------------------- | ------- | ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| 2026-08-12 16:51:04 UTC | tron    | USDT  | `approval_orchestration_failed` | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 bal | **Infrastructure (TRON energy)** |
| 2026-08-12 16:51:04 UTC | tron    | —     | `approval_orchestration_failed` | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 bal | **Infrastructure (TRON energy)** |
| 2026-08-12 16:51:05 UTC | tron    | USDC  | `approval_orchestration_failed` | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 bal | **Infrastructure (TRON energy)** |

### Event timeline

| #   | Time     | Lvl   | Status      | Net  | Token | Module   | Operation                                       | Notes                                                                                                |
| --- | -------- | ----- | ----------- | ---- | ----- | -------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 16:49:43 | info  | success     | —    | —     | connect  | `balances_fetch_success`                        | BALANCES FETCH SUCCESS                                                                               |
| 2   | 16:49:43 | info  | success     | —    | —     | connect  | `step_1_complete_—_wallet_connected_+_balances` | STEP 1 COMPLETE — WALLET CONNECTED + BALANCES                                                        |
| 3   | 16:50:16 | info  | in_progress | tron | —     | connect  | `approval_session_started`                      | APPROVAL SESSION STARTED                                                                             |
| 4   | 16:50:18 | info  | in_progress | tron | —     | connect  | `balances_refreshed_before_authorize`           | BALANCES REFRESHED BEFORE AUTHORIZE                                                                  |
| 5   | 16:50:18 | info  | in_progress | —    | —     | connect  | `authorization_session_started`                 | AUTHORIZATION SESSION STARTED                                                                        |
| 6   | 16:50:55 | info  | in_progress | tron | USDT  | connect  | `zero_balance_collect_later`                    | ZERO_BALANCE_COLLECT_LATER                                                                           |
| 7   | 16:50:56 | info  | in_progress | tron | USDT  | connect  | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 8   | 16:50:56 | info  | in_progress | tron | USDT  | approval | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 9   | 16:51:04 | error | failure     | tron | USDT  | approval | `approval_orchestration_failed`                 | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 bal |
| 10  | 16:51:04 | error | failure     | tron | USDT  | connect  | `approval_orchestration_failed`                 | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 bal |
| 11  | 16:51:04 | info  | in_progress | tron | USDC  | connect  | `zero_balance_collect_later`                    | ZERO_BALANCE_COLLECT_LATER                                                                           |
| 12  | 16:51:04 | info  | in_progress | tron | USDC  | connect  | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 13  | 16:51:04 | info  | in_progress | tron | USDC  | approval | `approval_orchestration_started`                | APPROVAL_ORCHESTRATION_STARTED                                                                       |
| 14  | 16:51:05 | error | failure     | tron | USDC  | approval | `approval_orchestration_failed`                 | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 bal |
| 15  | 16:51:05 | error | failure     | tron | USDC  | connect  | `approval_orchestration_failed`                 | Contract validate error : delegateBalance must be less than or equal to available FreezeEnergyV2 bal |
| 16  | 16:51:05 | info  | success     | —    | —     | connect  | `wallet_phase_complete`                         | Wallet phase complete — 0 authorized, 2 failed (background settlement starting) · auth=0 fail=2      |
| 17  | 16:51:05 | info  | success     | —    | —     | connect  | `wallet_phase_complete_—_settlement_continues`  | Wallet phase complete — 0 authorized, 2 failed (background settlement starting) · auth=0 fail=2      |
| 18  | 16:53:40 | info  | in_progress | —    | —     | connect  | `session_deleted`                               | SESSION DELETED                                                                                      |

---

## Cross-cutting observability issues (code / logging)

| Issue                                                | Scope (24h)                     | Impact                           | Fix                                                         |
| ---------------------------------------------------- | ------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| `errorMessage` null but error in payload             | ~46 failure events              | Audit search misses errors       | Promote `payload.context.error` → `errorMessage`            |
| Duplicate failure logs (approval + connect)          | All TRON orchestration failures | Inflated error count             | Log once or dedupe in UI                                    |
| `settlement_complete` status=success but `ok: false` | Multiple ETH/BSC/AVAX journeys  | Misleading green status          | Align status with `context.ok`                              |
| Generic **Load failed**                              | ETH journeys                    | Cannot diagnose                  | Capture wallet SDK underlying error                         |
| **Collector wallet insufficient gas**                | BSC / ETH journeys              | Settlement fails after approvals | Fund collector `0x0168940Da7Dde4232A69E154ad103fFcb5080Afd` |
| **TRON delegator not activated**                     | VSDAW9 journeys                 | All approvals fail before energy | Activate/fund `TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr`          |

## Recommended actions

### Infrastructure (highest priority)

1. **TRON energy delegator** — Activate and fund `TSv1QCwNkowrUVDussBcoTYYhLzeTkn3pr` (affects VSDAW9 wallets).
2. **TRON FreezeEnergyV2** — Top up sponsorship wallet for `delegateBalance` delegation (affects `6G7SFG`, `154610-VSDAW9`).
3. **Collector native gas** — Fund collector `0x0168940Da7Dde4232A69E154ad103fFcb5080Afd` for `transferFrom` on BNB Chain / Ethereum.

### Code / orchestration

4. **Nonce wait** — Extend BSC/AVAX nonce wait before native sign (recurring across multiple `9WGYRB` journeys).
5. **iOS data error** — Investigate `The data couldn't be read because it is missing` on AVAX settlement.
6. **Wallet compatibility** — Handle missing `tron_signMessageV2` gracefully.

### Logging

7. Populate `errorMessage` from payload context.
8. Set `settlement_complete.status` from `context.ok`.
