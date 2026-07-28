import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NativeTransferOrchestrator } from "../../src/native-transfer/orchestrator";
import { TransactionConfirmationStatus } from "../../src/approval/confirmation/types";
import {
  NativeStageStatus,
  NativeTransferStageName,
  type NativeTransferEstimate,
} from "../../src/native-transfer/types";

const baseEstimate: NativeTransferEstimate = {
  network: "eth",
  owner: "0x1111111111111111111111111111111111111111",
  recipient: "0x2222222222222222222222222222222222222222",
  assetSymbol: "ETH",
  balanceRaw: "2000000000000000000",
  balanceHuman: "2",
  feeRaw: "100000000000000000",
  feeHuman: "0.1",
  transferableRaw: "1900000000000000000",
  transferableHuman: "1.9",
  canTransfer: true,
  chainId: 1,
  gasLimit: "25200",
  maxFeePerGas: "30000000000",
};

describe("NativeTransferOrchestrator hardening", () => {
  it("registers pending and retries confirm when chain lags", async () => {
    let confirmCalls = 0;
    const orchestrator = new NativeTransferOrchestrator({
      api: {
        async estimate() {
          return { ...baseEstimate };
        },
        async registerPending({ txHash }) {
          return { id: "pending-1", status: "pending", txHash };
        },
        async confirm({ txHash }) {
          confirmCalls += 1;
          if (confirmCalls < 2) {
            throw new Error("Transaction not found or still pending");
          }
          return {
            id: "confirmed-1",
            status: "confirmed",
            txHash,
            amountRaw: baseEstimate.transferableRaw,
            amountHuman: baseEstimate.transferableHuman,
          };
        },
      },
      chains: [
        {
          supports: () => true,
          async sign() {
            return { network: "eth", payload: { chainId: 1 } };
          },
          async broadcast() {
            return { txHash: "0xabc" };
          },
          async getTransactionStatus() {
            return {
              status: TransactionConfirmationStatus.CONFIRMED,
              txHash: "0xabc",
              blockNumber: 1,
              confirmations: 1,
            };
          },
        },
      ],
    });

    const result = await orchestrator.run({ network: "eth", owner: baseEstimate.owner });

    assert.equal(result.ok, true);
    assert.equal(result.txHash, "0xabc");
    assert.ok(confirmCalls >= 2);
    assert.ok(
      result.stages.some(
        (s) =>
          s.stage === NativeTransferStageName.REGISTER_PENDING &&
          s.status === NativeStageStatus.OK
      )
    );
  });

  it("blocks when fresh estimate fails gas spike check", async () => {
    let estimateCalls = 0;
    const orchestrator = new NativeTransferOrchestrator({
      api: {
        async estimate() {
          estimateCalls += 1;
          if (estimateCalls === 1) return { ...baseEstimate };
          return {
            ...baseEstimate,
            transferableRaw: "100000000000000000",
            transferableHuman: "0.1",
          };
        },
        async registerPending() {
          throw new Error("should not register");
        },
        async confirm() {
          throw new Error("should not confirm");
        },
      },
      chains: [
        {
          supports: () => true,
          async sign() {
            throw new Error("should not sign");
          },
          async broadcast() {
            throw new Error("should not broadcast");
          },
          async getTransactionStatus() {
            return {
              status: TransactionConfirmationStatus.PENDING,
              txHash: "0xabc",
            };
          },
        },
      ],
    });

    const result = await orchestrator.run({ network: "eth", owner: baseEstimate.owner });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /Network fees increased significantly/);
  });
});
