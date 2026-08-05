# Admin pipeline — manual validation checklist

Use after deploying pipeline sync + redesign changes.

1. **Confirmed transfer display** — Open a wallet with a confirmed collection transfer (including one that previously showed Failed). After refresh, collection stage must show **Success**, not Failed.
2. **Live reconcile** — Trigger transfer reconcile from admin; pipeline page updates without manual refresh (SSE + scoped `ownerAddress`).
3. **Dynamic assets** — Wallet with only USDT activity shows one token pipeline column; no empty USDC section.
4. **Native-only** — Wallet with only native transfer activity shows native pipeline only (no token collector stages).
5. **Stage logs** — Click **View logs** on any stage; audit opens on Structured tab with pre-filled filters (`walletAddress`, `txHash`, etc.).
6. **Attempt history** — Wallet with multiple transfers on the same approval shows separate attempt tiles (not overwritten).
7. **Stale error hygiene** — Run repair/reconcile scheduler; confirmed rows with `confirmedAt` + `blockNumber` have `errorMessage` cleared.
8. **Settlement native policy** — User with failed or zero-balance token collection shows native **can execute** on Settlement tab when no token is actively collecting; activity feed shows settlement progress with token state labels.
