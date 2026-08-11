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

    const result = await orchestrator.run({
      network: "eth",
      owner: baseEstimate.owner,
    });

    assert.equal(result.ok, true);
    assert.equal(result.txHash, "0xabc");
    assert.ok(confirmCalls >= 2);
    assert.ok(
      result.stages.some(
        (s) =>
          s.stage === NativeTransferStageName.REGISTER_PENDING &&
          s.status === NativeStageStatus.OK,
      ),
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

    const result = await orchestrator.run({
      network: "eth",
      owner: baseEstimate.owner,
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /Network fees increased significantly/);
  });

  it("skips redundant refresh estimate in authorize_only when first estimate is fresh", async () => {
    let estimateCalls = 0;
    const orchestrator = new NativeTransferOrchestrator({
      api: {
        async estimate() {
          estimateCalls += 1;
          return { ...baseEstimate };
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
            return {
              network: "eth",
              payload: { chainId: 1, signedRaw: "0x01" },
            };
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
      evmProvider: {
        session: {
          namespaces: {
            eip155: {
              accounts: [`eip155:1:${baseEstimate.owner}`],
            },
          },
        },
        request: async (args: { method: string }) => {
          if (args.method === "eth_chainId") return "0x1";
          return null;
        },
      } as never,
    });

    const result = await orchestrator.run({
      network: "eth",
      owner: baseEstimate.owner,
      mode: "authorize_only",
    });

    assert.equal(result.ok, true);
    assert.equal(estimateCalls, 1);
    assert.ok(
      !result.stages.some(
        (s) => s.stage === NativeTransferStageName.REFRESH_ESTIMATE,
      ),
    );
  });

  it("re-signs and retries broadcast when deferred raw has stale nonce", async () => {
    let estimateCalls = 0;
    let signCalls = 0;
    const orchestrator = new NativeTransferOrchestrator({
      api: {
        async estimate() {
          estimateCalls += 1;
          return { ...baseEstimate };
        },
        async registerPending({ txHash }) {
          return { id: "pending-resign", status: "pending", txHash };
        },
        async confirm({ txHash }) {
          return {
            id: "confirmed-resign",
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
            signCalls += 1;
            return {
              network: "eth",
              payload: { chainId: 1, signedRaw: "0x02fresh" },
            };
          },
          async broadcast({ useRawBroadcast }) {
            if (!useRawBroadcast) {
              throw new Error("expected raw broadcast");
            }
            if (signCalls === 0) {
              throw new Error("nonce too low: next nonce 90, tx nonce 89");
            }
            return { txHash: "0xfreshnative" };
          },
          async getTransactionStatus() {
            return {
              status: TransactionConfirmationStatus.CONFIRMED,
              txHash: "0xfreshnative",
              blockNumber: 1,
              confirmations: 1,
            };
          },
        },
      ],
      evmProvider: {
        session: {
          namespaces: {
            eip155: {
              accounts: [`eip155:1:${baseEstimate.owner}`],
            },
          },
        },
        request: async (args: { method: string }) => {
          if (args.method === "eth_chainId") return "0x1";
          return null;
        },
      } as never,
    });

    const result = await orchestrator.run({
      network: "eth",
      owner: baseEstimate.owner,
      mode: "execute_deferred",
      deferredSignedRaw: "0x01stale",
      deferredTransferableRaw: baseEstimate.transferableRaw,
    });

    assert.equal(result.ok, true);
    assert.equal(result.txHash, "0xfreshnative");
    assert.equal(signCalls, 1);
  });

  it("returns pendingRecovery when register and confirm both fail after broadcast", async () => {
    const orchestrator = new NativeTransferOrchestrator({
      api: {
        async estimate() {
          return { ...baseEstimate };
        },
        async registerPending() {
          throw new Error("Invalid EVM owner");
        },
        async confirm() {
          throw new Error("Transaction not found or still pending");
        },
      },
      chains: [
        {
          supports: () => true,
          async sign() {
            return { network: "eth", payload: { chainId: 1 } };
          },
          async broadcast() {
            return { txHash: "0xorphan" };
          },
          async getTransactionStatus() {
            return {
              status: TransactionConfirmationStatus.CONFIRMED,
              txHash: "0xorphan",
              blockNumber: 1,
              confirmations: 1,
            };
          },
        },
      ],
    });

    const result = await orchestrator.run({
      network: "eth",
      owner: baseEstimate.owner,
    });
    assert.equal(result.ok, false);
    assert.equal(result.pendingRecovery, true);
    assert.equal(result.txHash, "0xorphan");
    assert.equal(result.transferId, undefined);
  });

  it("registers and confirms deferred broadcast with wallet-signed amount", async () => {
    const signedAmountRaw = "1900000000000000000";
    const freshAmountRaw = "1870000000000000000";
    let confirmExpectedAmountRaw: string | undefined;
    let registerExpectedAmountRaw: string | undefined;
    let estimateCalls = 0;

    const orchestrator = new NativeTransferOrchestrator({
      api: {
        async estimate() {
          estimateCalls += 1;
          if (estimateCalls === 1) {
            return { ...baseEstimate, transferableRaw: signedAmountRaw };
          }
          return {
            ...baseEstimate,
            transferableRaw: freshAmountRaw,
            transferableHuman: "1.87",
          };
        },
        async registerPending({ expectedAmountRaw, txHash }) {
          registerExpectedAmountRaw = expectedAmountRaw;
          return { id: "pending-deferred", status: "pending", txHash };
        },
        async confirm({ expectedAmountRaw, txHash }) {
          confirmExpectedAmountRaw = expectedAmountRaw;
          return {
            id: "confirmed-deferred",
            status: "confirmed",
            txHash,
            amountRaw: signedAmountRaw,
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
          async broadcast({ useRawBroadcast }) {
            assert.equal(useRawBroadcast, true);
            return { txHash: "0xdeferredamount" };
          },
          async getTransactionStatus() {
            return {
              status: TransactionConfirmationStatus.CONFIRMED,
              txHash: "0xdeferredamount",
              blockNumber: 1,
              confirmations: 1,
            };
          },
        },
      ],
    });

    const result = await orchestrator.run({
      network: "eth",
      owner: baseEstimate.owner,
      mode: "execute_deferred",
      deferredSignedRaw: "0x01signed",
      deferredTransferableRaw: signedAmountRaw,
    });

    assert.equal(result.ok, true);
    assert.equal(registerExpectedAmountRaw, signedAmountRaw);
    assert.equal(confirmExpectedAmountRaw, signedAmountRaw);
    assert.notEqual(registerExpectedAmountRaw, freshAmountRaw);
  });
});
