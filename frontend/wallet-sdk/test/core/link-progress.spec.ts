import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLinkProgressStage,
  INITIAL_LINK_PROGRESS_STAGE,
  LINK_PROGRESS_STAGE_IDS,
  LINK_PROGRESS_STAGES,
  mapSettlementProgressStageId,
  mapWalletApprovalStageId,
} from "../../src/core/link-progress";

test("priority guard: generic settlement cannot replace specific on-chain stage", () => {
  const current = LINK_PROGRESS_STAGES.confirming_usdc_onchain;
  const applied = applyLinkProgressStage(
    current,
    LINK_PROGRESS_STAGE_IDS.processing_settlement,
  );
  assert.equal(applied.id, "confirming_usdc_onchain");
});

test("priority guard: forward progress accepts higher-priority stage", () => {
  const current = LINK_PROGRESS_STAGES.processing_settlement;
  const applied = applyLinkProgressStage(
    current,
    LINK_PROGRESS_STAGE_IDS.confirming_usdc_onchain,
  );
  assert.equal(applied.id, "confirming_usdc_onchain");
  assert.equal(applied.percent, 90);
});

test("BROADCAST maps USDT wallet stage, not native", () => {
  const stageId = mapWalletApprovalStageId("BROADCAST", { token: "USDT" });
  assert.equal(stageId, LINK_PROGRESS_STAGE_IDS.confirm_usdt_wallet);
});

test("EIP-5792 batch wallet stage is distinct from sequential USDT/USDC", () => {
  const batch = LINK_PROGRESS_STAGES.confirm_usdt_usdc_batch_wallet;
  assert.equal(batch.interactionKind, "wallet_action");
  assert.match(batch.label, /USDT and USDC/i);
});

test("100% is reserved for complete stage only", () => {
  assert.equal(LINK_PROGRESS_STAGES.complete.percent, 100);
  assert.equal(LINK_PROGRESS_STAGES.authorization_complete.percent, 75);
  for (const stage of Object.values(LINK_PROGRESS_STAGES)) {
    if (stage.id !== LINK_PROGRESS_STAGE_IDS.complete) {
      assert.ok(stage.percent < 100, `${stage.id} must not show 100%`);
    }
  }
});

test("wallet stages use wallet_action; on-chain confirm uses waiting", () => {
  assert.equal(
    LINK_PROGRESS_STAGES.confirm_usdt_wallet.interactionKind,
    "wallet_action",
  );
  assert.equal(
    LINK_PROGRESS_STAGES.confirming_usdt_onchain.interactionKind,
    "waiting",
  );
});

test("settlement finalizing_approval maps token-specific on-chain stages", () => {
  assert.equal(
    mapSettlementProgressStageId({
      network: "avax",
      stage: "finalizing_approval",
      token: "USDC",
    }),
    LINK_PROGRESS_STAGE_IDS.confirming_usdc_onchain,
  );
});

test("force option allows regression for reset flows", () => {
  const current = LINK_PROGRESS_STAGES.complete;
  const applied = applyLinkProgressStage(
    current,
    LINK_PROGRESS_STAGE_IDS.connecting,
    { force: true },
  );
  assert.equal(applied.id, "connecting");
  assert.equal(applied, INITIAL_LINK_PROGRESS_STAGE);
});
