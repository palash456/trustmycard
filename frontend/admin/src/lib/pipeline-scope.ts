import type { AssetPipeline, UserPipelineSnapshot } from "@/types/pipeline";
import type { TransactionJourneyDetail } from "@/types/transaction-journey";
import { NATIVE_SYMBOL } from "@/lib/pipeline-flowchart";

export type PipelineAssetScope = {
  network: string;
  token: string;
};

function normalizeNetwork(network: string): string {
  return network.trim().toLowerCase();
}

function normalizeToken(token: string): string {
  return token.trim();
}

function isNativeTokenForNetwork(token: string, network: string): boolean {
  const upper = token.toUpperCase();
  if (upper === "NATIVE") return true;
  const native = NATIVE_SYMBOL[network]?.toUpperCase();
  return Boolean(native && upper === native);
}

export function findPipelineAsset(
  pipeline: UserPipelineSnapshot,
  scope: PipelineAssetScope
): AssetPipeline | null {
  const network = normalizeNetwork(scope.network);
  const token = normalizeToken(scope.token);

  const byKey = pipeline.assets.find(
    (asset) =>
      asset.key === `${network}:${token.toUpperCase()}` ||
      asset.key === `${network}:${token}`
  );
  if (byKey) return byKey;

  if (isNativeTokenForNetwork(token, network)) {
    return (
      pipeline.assets.find(
        (asset) => asset.kind === "native" && normalizeNetwork(asset.network) === network
      ) ?? null
    );
  }

  const tokenUpper = token.toUpperCase();
  return (
    pipeline.assets.find(
      (asset) =>
        normalizeNetwork(asset.network) === network &&
        asset.symbol.toUpperCase() === tokenUpper
    ) ?? null
  );
}

export function scopePipelineToAsset(
  pipeline: UserPipelineSnapshot,
  scope: PipelineAssetScope
): UserPipelineSnapshot | null {
  const asset = findPipelineAsset(pipeline, scope);
  if (!asset) return null;

  const network = normalizeNetwork(scope.network);

  return {
    ...pipeline,
    assets: [asset],
    networkApproved: {
      networks: pipeline.networkApproved.networks.filter(
        (entry) => normalizeNetwork(entry.network) === network
      ),
    },
    settlementSessions: (pipeline.settlementSessions ?? []).filter(
      (session) => normalizeNetwork(session.network) === network
    ),
    metrics: {
      ...pipeline.metrics,
      perAsset: Object.fromEntries(
        Object.entries(pipeline.metrics.perAsset).filter(([key]) => key === asset.key)
      ),
    },
  };
}

const TOKEN_PRIORITY = ["USDT", "USDC", "Native", "ETH", "BNB", "TRX", "MATIC", "POL", "AVAX"];

function sortTokens(tokens: string[]): string[] {
  return [...tokens].sort((a, b) => {
    const ai = TOKEN_PRIORITY.indexOf(a);
    const bi = TOKEN_PRIORITY.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
}

export function tokensForJourneyNetwork(
  journey: Pick<
    TransactionJourneyDetail,
    | "approvals"
    | "transfers"
    | "collectionIntents"
    | "nativeTransfers"
    | "network"
  >,
  network: string | null
): string[] {
  if (!network) return [];
  const net = normalizeNetwork(network);
  const tokens = new Set<string>();

  for (const row of journey.approvals) {
    if (normalizeNetwork(row.network) === net) tokens.add(row.tokenSymbol.toUpperCase());
  }
  for (const row of journey.transfers) {
    if (normalizeNetwork(row.network) === net) tokens.add(row.tokenSymbol.toUpperCase());
  }
  for (const row of journey.collectionIntents) {
    if (normalizeNetwork(row.network) === net) tokens.add(row.tokenSymbol.toUpperCase());
  }
  for (const row of journey.nativeTransfers) {
    if (normalizeNetwork(row.network) === net) {
      const symbol = row.network in NATIVE_SYMBOL ? "Native" : row.network.toUpperCase();
      tokens.add(symbol);
    }
  }

  return sortTokens([...tokens]);
}

export function resolveJourneyPipelineScope(args: {
  journey: Pick<
    TransactionJourneyDetail,
    | "approvals"
    | "transfers"
    | "collectionIntents"
    | "nativeTransfers"
    | "network"
    | "token"
  >;
  tokenOverride?: string | null;
}): PipelineAssetScope | null {
  const network = args.journey.network;
  if (!network) return null;

  const available = tokensForJourneyNetwork(args.journey, network);
  const fromList = args.journey.token
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const candidate =
    args.tokenOverride?.trim() ||
    (available.length === 1 ? available[0] : null) ||
    (fromList?.length === 1 ? fromList[0] : null) ||
    available[0] ||
    fromList?.[0] ||
    null;

  if (!candidate) return null;
  return { network, token: candidate };
}

export function formatPipelineScopeLabel(scope: PipelineAssetScope): string {
  const network = scope.network.toUpperCase();
  const token = scope.token.toUpperCase() === "NATIVE" ? "Native" : scope.token.toUpperCase();
  return `${token} on ${network}`;
}
