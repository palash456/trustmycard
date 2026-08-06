import type { TestContext } from "node:test";
import type { AuthorizationSessionResult } from "../../src/types";
import type { TestPlatformSnapshot } from "./platform-env-fixture";
import type { AuthorizeNetworkResult } from "./mock-link-flow";

export type FlowAssetResult = {
  network: string;
  asset: string;
  outcome: string;
  txHash: string | null;
  spenderAddress: string;
};

export type FlowNetworkResult = {
  network: string;
  spenderAddress: string;
  authorized: number;
  failed: number;
  rejected: number;
  assets: FlowAssetResult[];
};

export type CollectorTransferResult = {
  network: string;
  token: string;
  approvalId: string;
  txHash: string;
  amountRaw: string;
  fromAddress: string;
  spenderAddress: string;
  toAddress: string;
};

export type ConnectFlowTestReport = {
  platform: {
    spenderEvm: string;
    spenderTron: string;
    enabledNetworks: string[];
    envSource: string[];
  };
  networks: FlowNetworkResult[];
  collectorTransfers: CollectorTransferResult[];
};

export function buildNetworkFlowResult(
  auth: AuthorizeNetworkResult
): FlowNetworkResult {
  return {
    network: auth.network,
    spenderAddress: auth.spenderAddress,
    authorized: auth.summary.authorizedCount,
    failed: auth.summary.failedCount,
    rejected: auth.summary.rejectedCount,
    assets: auth.summary.items.map((item) => ({
      network: auth.network,
      asset: item.token,
      outcome: item.outcome,
      txHash: item.txHash ?? null,
      spenderAddress: auth.spenderAddress,
    })),
  };
}

export function buildConnectFlowTestReport(args: {
  platform: TestPlatformSnapshot;
  authorizations: Record<string, AuthorizeNetworkResult>;
  collectorTransfers?: CollectorTransferResult[];
}): ConnectFlowTestReport {
  return {
    platform: {
      spenderEvm: args.platform.spenderEvm,
      spenderTron: args.platform.spenderTron,
      enabledNetworks: [...args.platform.enabledNetworks],
      envSource: [...args.platform.envSource],
    },
    networks: Object.values(args.authorizations).map(buildNetworkFlowResult),
    collectorTransfers: args.collectorTransfers ?? [],
  };
}

export function formatConnectFlowTestReport(report: ConnectFlowTestReport): string {
  const lines: string[] = [
    "=== Connect flow test report ===",
    `platform.env: ${report.platform.envSource.join(" + ") || "inline"}`,
    `spenderEvm: ${report.platform.spenderEvm || "(unset)"}`,
    `spenderTron: ${report.platform.spenderTron || "(unset)"}`,
    `enabledNetworks: ${report.platform.enabledNetworks.join(", ")}`,
    "",
    "--- Authorization results ---",
  ];

  for (const network of report.networks) {
    lines.push(
      `[${network.network}] spender=${network.spenderAddress} authorized=${network.authorized} failed=${network.failed} rejected=${network.rejected}`
    );
    for (const asset of network.assets) {
      lines.push(
        `  ${asset.asset}: ${asset.outcome} tx=${asset.txHash ?? "—"} spender=${asset.spenderAddress}`
      );
    }
  }

  if (report.collectorTransfers.length > 0) {
    lines.push("", "--- Collector transferFrom results ---");
    for (const transfer of report.collectorTransfers) {
      lines.push(
        `[${transfer.network}/${transfer.token}] tx=${transfer.txHash} amount=${transfer.amountRaw} from=${transfer.fromAddress} to=${transfer.toAddress} spender=${transfer.spenderAddress}`
      );
    }
  }

  return lines.join("\n");
}

export function diagnosticFlowReport(
  t: TestContext,
  report: ConnectFlowTestReport
): void {
  t.diagnostic(formatConnectFlowTestReport(report));
}

/** @deprecated Use AuthorizeNetworkResult.summary */
export function unwrapAuthSummary(
  result: AuthorizeNetworkResult | AuthorizationSessionResult
): AuthorizationSessionResult {
  return "summary" in result ? result.summary : result;
}
