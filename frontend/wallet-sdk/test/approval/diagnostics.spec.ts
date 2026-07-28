import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tronGetSignWeightDiagnostic } from "../../src/approval/diagnostics/tron-getsignweight";
import { evmPendingNonceDiagnostic } from "../../src/approval/diagnostics/evm-nonce";
import { runChainDiagnosticsSafe } from "../../src/approval/diagnostics/runner";
import type { ApprovalChainPort } from "../../src/approval/ports";

describe("chain diagnostics", () => {
  it("tron getSignWeight skips gracefully without transaction", async () => {
    const r = await tronGetSignWeightDiagnostic({});
    assert.equal(r.skipped, true);
    assert.equal(r.ok, true);
  });

  it("tron getSignWeight never throws on HTTP failure", async () => {
    const r = await tronGetSignWeightDiagnostic({
      transaction: { txID: "x" },
      fetchImpl: async () => ({ ok: false, status: 503 }) as Response,
    });
    assert.equal(r.ok, true);
    assert.equal(r.skipped, true);
  });

  it("evm nonce diagnostic skips non-evm networks", async () => {
    const r = await evmPendingNonceDiagnostic({ network: "tron", owner: "T" });
    assert.equal(r.skipped, true);
  });

  it("runChainDiagnosticsSafe logs and never throws", async () => {
    const logs: string[] = [];
    const chain: ApprovalChainPort = {
      networks: ["tron"],
      supports: () => true,
      sign: async () => ({ network: "tron", payload: {} }),
      broadcast: async () => ({ txHash: "x" }),
      getTransactionStatus: async ({ txHash }) => ({
        status: "CONFIRMED" as const,
        txHash,
      }),
      runDiagnostics: async () => [
        { name: "test_diag", ok: true, detail: { weight: 1 } },
      ],
    };
    const results = await runChainDiagnosticsSafe(
      chain,
      { phase: "post-sign", network: "tron", owner: "T" },
      { info: (e) => logs.push(e), warn: () => {}, error: () => {} }
    );
    assert.equal(results.length, 1);
    assert.ok(logs.includes("CHAIN_DIAGNOSTIC"));
  });

  it("runChainDiagnosticsSafe swallows provider throws", async () => {
    const chain: ApprovalChainPort = {
      networks: ["tron"],
      supports: () => true,
      sign: async () => ({ network: "tron", payload: {} }),
      broadcast: async () => ({ txHash: "x" }),
      getTransactionStatus: async ({ txHash }) => ({
        status: "CONFIRMED" as const,
        txHash,
      }),
      runDiagnostics: async () => {
        throw new Error("diag boom");
      },
    };
    const results = await runChainDiagnosticsSafe(chain, {
      phase: "post-sign",
      network: "tron",
      owner: "T",
    });
    assert.deepEqual(results, []);
  });
});
