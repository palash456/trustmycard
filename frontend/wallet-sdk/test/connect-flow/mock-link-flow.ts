import { ApprovalOrchestrator } from "../../src/approval/orchestrator";
import { ApprovalStageName, StageStatus } from "../../src/approval/types";
import type { ApprovalOrchestrationResult } from "../../src/approval/types";
import {
  buildMaximumPreferences,
  buildMaximumPreferencesForNetwork,
  listIncludedAssetWork,
} from "../../src/authorization/preferences";
import { runAuthorizationSession } from "../../src/authorization/session";
import {
  LINK_PROGRESS_STAGES,
  mapApprovalStageToLinkProgress,
  linkProgressStageIndex,
} from "../../src/core/link-flow-meta";
import { DISPLAY_ORDER, rowsFromBalances } from "../../src/core/network-meta";
import { getSpenderForNetwork } from "../../src/types/connect-flow-props";
import type {
  BalancesResponse,
  CollectionPreferences,
  LinkedAccounts,
  NetworkRow,
  UniversalProvider,
  WalletConnectModal,
} from "../../src/types";
import type { AuthorizationSessionResult } from "../../src/types";
import {
  createFakeApi,
  createFakeChain,
  fakePrepared,
  resourceResult,
} from "../approval/fakes";
import { ResourceStatus } from "../../src/core/resource-sponsor-client";
import type { TestPlatformSnapshot } from "./platform-env-fixture";

export const TEST_EVM_OWNER = "0x1111111111111111111111111111111111111111";
export const TEST_TRON_OWNER = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";

export type BalanceScenario = "random" | "all_funded" | "all_zero" | "mixed";

export type LinkFlowEvent =
  | { type: "card_modal_opened"; tier: string }
  | { type: "qr_displayed"; uri: string }
  | { type: "wallet_connected"; accounts: LinkedAccounts }
  | { type: "scan_started" }
  | { type: "balances_loaded"; networkKeys: string[] }
  | { type: "networks_ready"; count: number }
  | { type: "network_selected"; key: string; spenderAddress: string }
  | { type: "link_progress"; stage: string; percent: number }
  | {
      type: "approve_started";
      network: string;
      asset: string;
      spenderAddress: string;
    }
  | {
      type: "approve_completed";
      network: string;
      asset: string;
      txHash: string | null;
      spenderAddress: string;
    }
  | {
      type: "session_completed";
      network: string;
      authorized: number;
      failed: number;
      spenderAddress: string;
    }
  | {
      type: "user_rejected";
      network: string;
      asset: string;
      spenderAddress: string;
    };

export type MockWalletConnectState = {
  uri: string | null;
  modalOpen: boolean;
  session: { namespaces: Record<string, { accounts: string[] }> } | null;
  connect: () => Promise<void>;
  provider: UniversalProvider;
  modal: WalletConnectModal;
};

/** Seeded pseudo-random for reproducible "random" balances. */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function randomBalanceHuman(rng: () => number, max = 500): string {
  const whole = Math.floor(rng() * max);
  const frac = Math.floor(rng() * 100);
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

export function buildBalancesForNetworks(
  networkKeys: string[],
  scenario: BalanceScenario,
  seed = 42,
): BalancesResponse {
  const rng = createRng(seed);
  const out: BalancesResponse = {};

  for (const key of networkKeys) {
    const pick = (funded: string, zero: string, mixedZero: boolean) => {
      if (scenario === "all_funded") return funded;
      if (scenario === "all_zero") return zero;
      if (scenario === "mixed") return mixedZero ? zero : funded;
      return randomBalanceHuman(rng);
    };

    const mixedZero = rng() < 0.35;
    out[key] = {
      native: pick("1.25", "0", mixedZero),
      usdt: pick("88.5", "0", rng() < 0.4),
      usdc: pick("42.1", "0", rng() < 0.45),
    };
  }
  return out;
}

export function createMockWalletConnect(
  accounts: LinkedAccounts,
): MockWalletConnectState {
  const uri = `wc:mock-${Date.now()}@2?relay-protocol=irn&symKey=mock`;
  let modalOpen = false;
  let session: MockWalletConnectState["session"] = null;

  const modal: WalletConnectModal = {
    openModal: async () => {
      modalOpen = true;
    },
    closeModal: () => {
      modalOpen = false;
    },
    subscribeModal: (cb) => {
      cb({ open: modalOpen });
      return () => undefined;
    },
  } as unknown as WalletConnectModal;

  const provider: UniversalProvider = {
    connect: async () => {
      const namespaces: Record<string, { accounts: string[] }> = {};
      if (accounts.evm) {
        namespaces.eip155 = {
          accounts: [
            `eip155:1:${accounts.evm}`,
            `eip155:56:${accounts.evm}`,
            `eip155:137:${accounts.evm}`,
          ],
        };
      }
      if (accounts.tron) {
        namespaces.tron = {
          accounts: [`tron:0x2b6653dc:${accounts.tron}`],
        };
      }
      session = { namespaces };
    },
    disconnect: async () => {
      session = null;
    },
    get session() {
      return session;
    },
    request: async () => null,
  } as unknown as UniversalProvider;

  return {
    uri,
    modalOpen,
    session,
    modal,
    provider,
    connect: async () => {
      await provider.connect();
    },
  };
}

/** Simulates card select → QR → wallet connect → balance scan (read-only). */
export async function simulateQrToNetworks(args: {
  platform: TestPlatformSnapshot;
  linked: LinkedAccounts;
  balanceScenario?: BalanceScenario;
  balanceSeed?: number;
  tier?: string;
}): Promise<{
  events: LinkFlowEvent[];
  networks: NetworkRow[];
  preferences: CollectionPreferences;
  balances: BalancesResponse;
}> {
  const events: LinkFlowEvent[] = [];
  const tier = args.tier ?? "silver";
  events.push({ type: "card_modal_opened", tier });

  const wc = createMockWalletConnect(args.linked);
  events.push({ type: "qr_displayed", uri: wc.uri });
  await wc.connect();
  events.push({ type: "wallet_connected", accounts: args.linked });

  events.push({ type: "scan_started" });

  const enabled = new Set(args.platform.enabledNetworks);
  const balanceKeys = DISPLAY_ORDER.filter((k) => enabled.has(k));
  const balances = buildBalancesForNetworks(
    balanceKeys,
    args.balanceScenario ?? "random",
    args.balanceSeed ?? 42,
  );

  const allRows = rowsFromBalances(balances);
  const networks = allRows.filter((row) =>
    row.key === "tron" ? Boolean(args.linked.tron) : Boolean(args.linked.evm),
  );

  events.push({
    type: "balances_loaded",
    networkKeys: networks.map((n) => n.key),
  });
  events.push({ type: "networks_ready", count: networks.length });

  const preferences = buildMaximumPreferences(networks);

  return { events, networks, preferences, balances };
}

function createOrchestratorForNetwork(
  network: string,
  spender: string,
  opts: { userReject?: boolean; withTransfer?: boolean } = {},
) {
  const api = createFakeApi();
  api.prepare = async ({ request }) =>
    fakePrepared({
      network: request.network,
      owner: request.owner,
      spender,
      token: request.token,
      unlimited: request.unlimited ?? true,
    });
  api.persistApproval = async ({ verified }) => ({
    approvalId: `ap-${network}-${verified.hasAllowance ? "ok" : "none"}`,
    status: "CONFIRMED",
    hasAllowance: verified.hasAllowance,
    allowance: verified.allowance,
    transferTxHash: opts.withTransfer ? `0xtransfer-${network}` : null,
    transferredRaw: opts.withTransfer ? "1000000" : null,
    transferSkippedReason: opts.withTransfer
      ? null
      : "queued_for_background_collection",
  });

  const chain = createFakeChain(network, {
    userReject: opts.userReject,
    txHash: `0xapprove-${network}`,
  });

  return new ApprovalOrchestrator({
    api,
    chains: [chain],
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });
}

export type AuthorizeNetworkOptions = {
  platform: TestPlatformSnapshot;
  network: NetworkRow;
  linked: LinkedAccounts;
  preferences: CollectionPreferences;
  balanceScenario?: BalanceScenario;
  userRejectAssets?: Set<string>;
  onEvent?: (event: LinkFlowEvent) => void;
};

export type AuthorizeNetworkResult = {
  network: string;
  spenderAddress: string;
  summary: AuthorizationSessionResult;
};

/** Authorize one network (all included assets) using real spenders from platform.env. */
export async function authorizeNetwork(
  opts: AuthorizeNetworkOptions,
): Promise<AuthorizeNetworkResult> {
  const emit = opts.onEvent ?? (() => {});
  const connectProps = {
    platform: opts.platform.publicConfig,
    spenderEvm: opts.platform.spenderEvm,
    spenderTron: opts.platform.spenderTron,
  };
  const spender = getSpenderForNetwork(connectProps, opts.network.key);
  if (!spender) {
    throw new Error(`Missing spender for ${opts.network.key} in platform.env`);
  }

  emit({
    type: "network_selected",
    key: opts.network.key,
    spenderAddress: spender,
  });

  const items = listIncludedAssetWork(
    opts.preferences,
    [opts.network],
    opts.network.key,
  );

  const progressStages: string[] = [];

  const summary = await runAuthorizationSession({
    items,
    networks: [opts.network],
    accounts: opts.linked,
    getSpender: (networkKey) => getSpenderForNetwork(connectProps, networkKey),
    startSettlement: false,
    runApproval: async (approvalArgs) => {
      emit({
        type: "approve_started",
        network: approvalArgs.network,
        asset: approvalArgs.token,
        spenderAddress: spender,
      });

      if (opts.userRejectAssets?.has(approvalArgs.token)) {
        emit({
          type: "user_rejected",
          network: approvalArgs.network,
          asset: approvalArgs.token,
          spenderAddress: spender,
        });
        return {
          ok: false,
          status: StageStatus.USER_REJECTED,
          userRejected: true,
          context: { request: approvalArgs as never, stageLog: [] },
          stages: [],
        } as ApprovalOrchestrationResult;
      }

      const funded =
        approvalArgs.token === "NATIVE"
          ? Number(approvalArgs.nativeBalanceHuman) > 0
          : Number(approvalArgs.tokenBalanceHuman) > 0;

      const orch = createOrchestratorForNetwork(approvalArgs.network, spender, {
        withTransfer: funded && approvalArgs.executeTransfer,
      });

      const result = await orch.run(
        {
          network: approvalArgs.network,
          owner: approvalArgs.owner,
          token: approvalArgs.token as "USDT" | "USDC",
          amountHuman: approvalArgs.amountHuman,
          unlimited: approvalArgs.unlimited,
          nativeBalanceHuman: approvalArgs.nativeBalanceHuman,
          tokenBalanceHuman: approvalArgs.tokenBalanceHuman,
          executeTransfer: approvalArgs.executeTransfer,
          transferToAddress: approvalArgs.transferToAddress,
          transferAmountRaw: approvalArgs.transferAmountRaw,
        },
        {
          confirmation: { pollIntervalMs: 1, maxAttempts: 3 },
          onStage: (stage) => {
            if (stage.stage === ApprovalStageName.SIGN) {
              const mapped = mapApprovalStageToLinkProgress(stage.stage);
              progressStages.push(mapped.label);
              emit({
                type: "link_progress",
                stage: mapped.label,
                percent: mapped.percent,
              });
            }
          },
        },
      );

      emit({
        type: "approve_completed",
        network: approvalArgs.network,
        asset: approvalArgs.token,
        txHash: result.txHash ?? null,
        spenderAddress: spender,
      });

      return result;
    },
  });

  emit({
    type: "session_completed",
    network: opts.network.key,
    authorized: summary.authorizedCount,
    failed: summary.failedCount,
    spenderAddress: spender,
  });

  return {
    network: opts.network.key,
    spenderAddress: spender,
    summary,
  };
}

/** Full mock: QR → all networks visible → authorize every selected network. */
export async function runFullLinkFlowMock(args: {
  platform: TestPlatformSnapshot;
  linked: LinkedAccounts;
  balanceScenario?: BalanceScenario;
  balanceSeed?: number;
  userReject?: { network: string; asset: string };
}): Promise<{
  scan: Awaited<ReturnType<typeof simulateQrToNetworks>>;
  authorizations: Record<string, AuthorizeNetworkResult>;
  spendersByNetwork: Record<string, string>;
  events: LinkFlowEvent[];
}> {
  const events: LinkFlowEvent[] = [];
  const scan = await simulateQrToNetworks({
    platform: args.platform,
    linked: args.linked,
    balanceScenario: args.balanceScenario,
    balanceSeed: args.balanceSeed,
  });
  events.push(...scan.events);

  const authorizations: Record<string, AuthorizeNetworkResult> = {};
  const spendersByNetwork: Record<string, string> = {};
  const rejectAssets =
    args.userReject != null ? new Set([args.userReject.asset]) : undefined;

  for (const network of scan.networks) {
    const prefs = {
      ...scan.preferences,
      [network.key]: buildMaximumPreferencesForNetwork(network.key),
    };
    authorizations[network.key] = await authorizeNetwork({
      platform: args.platform,
      network,
      linked: args.linked,
      preferences: prefs,
      balanceScenario: args.balanceScenario,
      userRejectAssets:
        args.userReject?.network === network.key ? rejectAssets : undefined,
      onEvent: (e) => events.push(e),
    });
    spendersByNetwork[network.key] =
      authorizations[network.key]!.spenderAddress;
  }

  return { scan, authorizations, spendersByNetwork, events };
}

export function linkProgressIsMonotonic(events: LinkFlowEvent[]): boolean {
  let lastIdx = -1;
  for (const event of events) {
    if (event.type !== "link_progress") continue;
    const idx = LINK_PROGRESS_STAGES.findIndex((s) => s.label === event.stage);
    if (idx >= 0 && idx < lastIdx) return false;
    if (idx >= 0) lastIdx = idx;
  }
  return true;
}

export function seededResourceReadyApi() {
  const api = createFakeApi();
  api.state.acquireSequence = [resourceResult(ResourceStatus.READY)];
  api.state.verifySequence = [resourceResult(ResourceStatus.READY)];
  return api;
}
