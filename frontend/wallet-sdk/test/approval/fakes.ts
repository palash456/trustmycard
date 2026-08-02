import type { ResourceResult } from "../../src/core/resource-sponsor-client";
import { ResourceStatus } from "../../src/core/resource-sponsor-client";
import type { ApprovalApiPort, ApprovalChainPort } from "../../src/approval/ports";
import {
  TransactionConfirmationStatus,
  type TransactionStatusSnapshot,
} from "../../src/approval/confirmation/types";
import type {
  PersistApprovalResult,
  PreparedApproval,
  PostApprovalResult,
  SignedApproval,
  VerifyApprovalResult,
} from "../../src/approval/types";

export function fakePrepared(
  overrides: Partial<PreparedApproval> = {}
): PreparedApproval {
  return {
    network: "tron",
    owner: "TOwner",
    spender: "TSpender",
    token: "USDT",
    tokenAddress: "TToken",
    amountRaw: "1000000",
    amountHuman: "1",
    unlimited: false,
    payload: { transaction: { txID: "prep-tx" } },
    feeLimit: 150_000_000,
    preparedTxId: "prep-tx",
    ...overrides,
  };
}

export function resourceResult(
  status: ResourceResult["status"],
  overrides: Partial<ResourceResult> = {}
): ResourceResult {
  return {
    status,
    network: "tron",
    address: "TOwner",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export type FakeApiState = {
  prepareCalls: number;
  acquireCalls: number;
  verifyCalls: number;
  verifyAllowanceCalls: number;
  persistCalls: number;
  confirmCalls: number;
  postCalls: number;
  acquireSequence: ResourceResult[];
  verifySequence: ResourceResult[];
  verifyAllowanceSequence: VerifyApprovalResult[];
  confirmHasAllowance: boolean;
  failPrepare?: boolean;
  failVerifyAllowance?: boolean;
  failPersist?: boolean;
  failConfirm?: boolean;
};

export function createFakeApi(
  state: FakeApiState = {
    prepareCalls: 0,
    acquireCalls: 0,
    verifyCalls: 0,
    verifyAllowanceCalls: 0,
    persistCalls: 0,
    confirmCalls: 0,
    postCalls: 0,
    acquireSequence: [resourceResult(ResourceStatus.READY)],
    verifySequence: [resourceResult(ResourceStatus.READY)],
    verifyAllowanceSequence: [{ hasAllowance: true, allowance: "1000000" }],
    confirmHasAllowance: true,
  }
): ApprovalApiPort & { state: FakeApiState } {
  const api: ApprovalApiPort & { state: FakeApiState } = {
    state,
    async prepare({ request }) {
      state.prepareCalls += 1;
      if (state.failPrepare) throw new Error("prepare boom");
      return fakePrepared({
        network: request.network,
        owner: request.owner,
        token: request.token,
        unlimited: request.unlimited ?? false,
        amountHuman: request.amountHuman ?? "1",
      });
    },
    async acquireResources() {
      state.acquireCalls += 1;
      const idx = Math.min(state.acquireCalls - 1, state.acquireSequence.length - 1);
      return state.acquireSequence[idx]!;
    },
    async verifyResources() {
      state.verifyCalls += 1;
      const idx = Math.min(state.verifyCalls - 1, state.verifySequence.length - 1);
      return state.verifySequence[idx]!;
    },
    async verifyAllowance() {
      state.verifyAllowanceCalls += 1;
      if (state.failVerifyAllowance) throw new Error("verify allowance boom");
      const idx = Math.min(
        state.verifyAllowanceCalls - 1,
        state.verifyAllowanceSequence.length - 1
      );
      const result = state.verifyAllowanceSequence[idx]!;
      if (!state.confirmHasAllowance) {
        return { hasAllowance: false, allowance: "0" };
      }
      return result;
    },
    async persistApproval({ verified }) {
      state.persistCalls += 1;
      if (state.failPersist) throw new Error("persist boom");
      const result: PersistApprovalResult = {
        approvalId: "appr_1",
        status: "CONFIRMED",
        hasAllowance: verified.hasAllowance,
        allowance: verified.allowance,
        transferTxHash: null,
        transferredRaw: null,
        transferSkippedReason: "skipped in fake",
      };
      return result;
    },
    async confirmApproval() {
      state.confirmCalls += 1;
      if (state.failConfirm) throw new Error("confirm boom");
      const verified: VerifyApprovalResult = {
        hasAllowance: state.confirmHasAllowance,
        allowance: state.confirmHasAllowance ? "1000000" : "0",
      };
      const persisted: PersistApprovalResult = {
        approvalId: "appr_1",
        status: "CONFIRMED",
        hasAllowance: verified.hasAllowance,
        allowance: verified.allowance,
        transferTxHash: null,
        transferredRaw: null,
        transferSkippedReason: "skipped in fake",
      };
      return { ...persisted, ...verified };
    },
    async postApprovalLog(): Promise<PostApprovalResult> {
      state.postCalls += 1;
      return { logged: true };
    },
  };
  return api;
}

export function createFakeChain(
  network = "tron",
  opts: {
    failSign?: boolean;
    userReject?: boolean;
    failBroadcast?: boolean;
    txHash?: string;
    confirmationSequence?: TransactionStatusSnapshot[];
  } = {}
): ApprovalChainPort {
  let confirmationPolls = 0;
  return {
    networks: [network],
    supports: (n) => n === network,
    async sign({ prepared, owner }): Promise<SignedApproval> {
      if (opts.userReject) {
        throw new Error("User rejected the request");
      }
      if (opts.failSign) throw new Error("sign boom");
      return {
        network: prepared.network,
        payload: { signed: true, owner },
      };
    },
    async broadcast() {
      if (opts.failBroadcast) throw new Error("broadcast boom");
      return { txHash: opts.txHash ?? "0xabc" };
    },
    async getTransactionStatus({ txHash }) {
      confirmationPolls += 1;
      if (opts.confirmationSequence?.length) {
        const idx = Math.min(
          confirmationPolls - 1,
          opts.confirmationSequence.length - 1
        );
        return opts.confirmationSequence[idx]!;
      }
      return {
        status: TransactionConfirmationStatus.CONFIRMED,
        txHash,
        blockNumber: 123,
        confirmations: 1,
      };
    },
  };
}
