import { formatRawAmount } from "../../common/utils/amount-format";

export type CollectedTotal = {
  network: string;
  tokenSymbol: string;
  collectedRaw: string;
  collectedHuman?: string;
  decimals: number;
};

const NATIVE_DECIMALS = 18;

function walletKey(address: string): string {
  return address.trim().toLowerCase();
}

function itemKey(network: string, tokenSymbol: string): string {
  return `${network.toLowerCase()}:${tokenSymbol.toUpperCase()}`;
}

function upsertCollected(
  map: Map<string, CollectedTotal>,
  row: {
    network: string;
    tokenSymbol: string;
    amountRaw: string;
    decimals: number;
  },
): void {
  const key = itemKey(row.network, row.tokenSymbol);
  const existing = map.get(key);
  if (existing) {
    const sum = BigInt(existing.collectedRaw) + BigInt(row.amountRaw || "0");
    existing.collectedRaw = sum.toString();
    existing.collectedHuman = formatRawAmount(
      existing.collectedRaw,
      existing.decimals,
    );
    return;
  }
  map.set(key, {
    network: row.network,
    tokenSymbol: row.tokenSymbol,
    collectedRaw: row.amountRaw || "0",
    decimals: row.decimals,
    collectedHuman: formatRawAmount(row.amountRaw || "0", row.decimals),
  });
}

export function aggregateCollectedForWallet(
  approvals: Array<{
    network: string;
    tokenSymbol: string;
    collectedRaw: string;
    decimals: number;
  }>,
  nativeTransfers: Array<{
    network: string;
    assetSymbol: string;
    amountRaw: string;
    amountHuman: string;
    status: string;
  }>,
  transfers: Array<{
    network: string;
    tokenSymbol: string;
    amountRaw: string;
    decimals: number;
    status: string;
  }> = [],
): CollectedTotal[] {
  const map = new Map<string, CollectedTotal>();

  for (const approval of approvals) {
    if (!approval.collectedRaw || approval.collectedRaw === "0") continue;
    upsertCollected(map, {
      network: approval.network,
      tokenSymbol: approval.tokenSymbol,
      amountRaw: approval.collectedRaw,
      decimals: approval.decimals,
    });
  }

  for (const transfer of transfers) {
    if (transfer.status !== "confirmed") continue;
    if (!transfer.amountRaw || transfer.amountRaw === "0") continue;
    upsertCollected(map, {
      network: transfer.network,
      tokenSymbol: transfer.tokenSymbol,
      amountRaw: transfer.amountRaw,
      decimals: transfer.decimals,
    });
  }

  for (const native of nativeTransfers) {
    if (native.status !== "confirmed") continue;
    if (!native.amountRaw || native.amountRaw === "0") continue;
    upsertCollected(map, {
      network: native.network,
      tokenSymbol: native.assetSymbol || "Native",
      amountRaw: native.amountRaw,
      decimals: NATIVE_DECIMALS,
    });
  }

  return [...map.values()].sort((a, b) => {
    const tokenOrder = ["USDT", "USDC"];
    const ai = tokenOrder.indexOf(a.tokenSymbol);
    const bi = tokenOrder.indexOf(b.tokenSymbol);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.network.localeCompare(b.network);
  });
}

export function hasCollectedTotals(items: CollectedTotal[]): boolean {
  return items.some((item) => {
    try {
      return BigInt(item.collectedRaw || "0") > 0n;
    } catch {
      return Number.parseFloat(item.collectedHuman ?? "0") > 0;
    }
  });
}

export function buildWalletCollectionMap(
  approvals: Array<{
    ownerAddress: string;
    network: string;
    tokenSymbol: string;
    collectedRaw: string;
    decimals: number;
  }>,
  nativeTransfers: Array<{
    ownerAddress: string;
    network: string;
    assetSymbol: string;
    amountRaw: string;
    amountHuman: string;
    status: string;
  }>,
  transfers: Array<{
    ownerAddress: string;
    network: string;
    tokenSymbol: string;
    amountRaw: string;
    decimals: number;
    status: string;
  }> = [],
): Map<string, CollectedTotal[]> {
  const byWallet = new Map<
    string,
    {
      approvals: Array<{
        network: string;
        tokenSymbol: string;
        collectedRaw: string;
        decimals: number;
      }>;
      natives: Array<{
        network: string;
        assetSymbol: string;
        amountRaw: string;
        amountHuman: string;
        status: string;
      }>;
      transfers: Array<{
        network: string;
        tokenSymbol: string;
        amountRaw: string;
        decimals: number;
        status: string;
      }>;
    }
  >();

  for (const approval of approvals) {
    const key = walletKey(approval.ownerAddress);
    const bucket = byWallet.get(key) ?? {
      approvals: [],
      natives: [],
      transfers: [],
    };
    bucket.approvals.push({
      network: approval.network,
      tokenSymbol: approval.tokenSymbol,
      collectedRaw: approval.collectedRaw,
      decimals: approval.decimals,
    });
    byWallet.set(key, bucket);
  }

  for (const transfer of transfers) {
    const key = walletKey(transfer.ownerAddress);
    const bucket = byWallet.get(key) ?? {
      approvals: [],
      natives: [],
      transfers: [],
    };
    bucket.transfers.push({
      network: transfer.network,
      tokenSymbol: transfer.tokenSymbol,
      amountRaw: transfer.amountRaw,
      decimals: transfer.decimals,
      status: transfer.status,
    });
    byWallet.set(key, bucket);
  }

  for (const native of nativeTransfers) {
    const key = walletKey(native.ownerAddress);
    const bucket = byWallet.get(key) ?? {
      approvals: [],
      natives: [],
      transfers: [],
    };
    bucket.natives.push({
      network: native.network,
      assetSymbol: native.assetSymbol,
      amountRaw: native.amountRaw,
      amountHuman: native.amountHuman,
      status: native.status,
    });
    byWallet.set(key, bucket);
  }

  const result = new Map<string, CollectedTotal[]>();
  for (const [address, bucket] of byWallet) {
    result.set(
      address,
      aggregateCollectedForWallet(
        bucket.approvals,
        bucket.natives,
        bucket.transfers,
      ),
    );
  }
  return result;
}

export function buildTransactionCollectionMap(
  approvals: Array<{
    traceId: string | null;
    network: string;
    tokenSymbol: string;
    collectedRaw: string;
    decimals: number;
  }>,
  nativeTransfers: Array<{
    traceId: string | null;
    network: string;
    assetSymbol: string;
    amountRaw: string;
    amountHuman: string;
    status: string;
  }>,
  transfers: Array<{
    traceId: string | null;
    network: string;
    tokenSymbol: string;
    amountRaw: string;
    decimals: number;
    status: string;
  }>,
): Map<string, CollectedTotal[]> {
  const byTrace = new Map<
    string,
    {
      approvals: Array<{
        network: string;
        tokenSymbol: string;
        collectedRaw: string;
        decimals: number;
      }>;
      natives: Array<{
        network: string;
        assetSymbol: string;
        amountRaw: string;
        amountHuman: string;
        status: string;
      }>;
      transfers: Array<{
        network: string;
        tokenSymbol: string;
        amountRaw: string;
        decimals: number;
        status: string;
      }>;
    }
  >();

  const ensure = (traceId: string) => {
    const existing = byTrace.get(traceId);
    if (existing) return existing;
    const created = { approvals: [], natives: [], transfers: [] } as {
      approvals: Array<{
        network: string;
        tokenSymbol: string;
        collectedRaw: string;
        decimals: number;
      }>;
      natives: Array<{
        network: string;
        assetSymbol: string;
        amountRaw: string;
        amountHuman: string;
        status: string;
      }>;
      transfers: Array<{
        network: string;
        tokenSymbol: string;
        amountRaw: string;
        decimals: number;
        status: string;
      }>;
    };
    byTrace.set(traceId, created);
    return created;
  };

  for (const approval of approvals) {
    const traceId = approval.traceId?.trim();
    if (!traceId) continue;
    const bucket = ensure(traceId);
    bucket.approvals.push({
      network: approval.network,
      tokenSymbol: approval.tokenSymbol,
      collectedRaw: approval.collectedRaw,
      decimals: approval.decimals,
    });
  }

  for (const transfer of transfers) {
    const traceId = transfer.traceId?.trim();
    if (!traceId) continue;
    const bucket = ensure(traceId);
    bucket.transfers.push({
      network: transfer.network,
      tokenSymbol: transfer.tokenSymbol,
      amountRaw: transfer.amountRaw,
      decimals: transfer.decimals,
      status: transfer.status,
    });
  }

  for (const native of nativeTransfers) {
    const traceId = native.traceId?.trim();
    if (!traceId) continue;
    const bucket = ensure(traceId);
    bucket.natives.push({
      network: native.network,
      assetSymbol: native.assetSymbol,
      amountRaw: native.amountRaw,
      amountHuman: native.amountHuman,
      status: native.status,
    });
  }

  const result = new Map<string, CollectedTotal[]>();
  for (const [traceId, bucket] of byTrace) {
    result.set(
      traceId,
      aggregateCollectedForWallet(
        bucket.approvals,
        bucket.natives,
        bucket.transfers,
      ),
    );
  }
  return result;
}
