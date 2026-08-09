const TRON_GRID = "https://api.trongrid.io";

export type TronAccountResources = {
  exists: boolean;
  balanceSun: bigint;
  balanceTrx: string;
  freeNetRemaining: number;
  energyRemaining: number;
};

function formatSun(sun: bigint): string {
  const whole = sun / BigInt(1_000_000);
  const frac = (sun % BigInt(1_000_000))
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Read TRX + free bandwidth/energy for pre-flight checks before approve. */
export async function readTronAccountResources(
  address: string,
): Promise<TronAccountResources> {
  const empty: TronAccountResources = {
    exists: false,
    balanceSun: BigInt(0),
    balanceTrx: "0",
    freeNetRemaining: 0,
    energyRemaining: 0,
  };

  try {
    const [acctRes, resRes] = await Promise.all([
      fetch(`${TRON_GRID}/v1/accounts/${address}`, { cache: "no-store" }),
      fetch(`${TRON_GRID}/wallet/getaccountresource`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, visible: true }),
        cache: "no-store",
      }),
    ]);

    const acctJson = (await acctRes.json().catch(() => null)) as {
      data?: Array<{ balance?: number }>;
    } | null;
    const account = acctJson?.data?.[0];
    const balanceSun = BigInt(account?.balance ?? 0);
    const exists = Boolean(account) || balanceSun > BigInt(0);

    const resourceJson = (await resRes.json().catch(() => ({}))) as {
      freeNetLimit?: number;
      freeNetUsed?: number;
      NetLimit?: number;
      NetUsed?: number;
      EnergyLimit?: number;
      EnergyUsed?: number;
    };

    const freeNetLimit = Number(resourceJson.freeNetLimit ?? 0);
    const freeNetUsed = Number(resourceJson.freeNetUsed ?? 0);
    const netLimit = Number(resourceJson.NetLimit ?? 0);
    const netUsed = Number(resourceJson.NetUsed ?? 0);
    const energyLimit = Number(resourceJson.EnergyLimit ?? 0);
    const energyUsed = Number(resourceJson.EnergyUsed ?? 0);

    const freeNetRemaining = Math.max(
      0,
      freeNetLimit - freeNetUsed + (netLimit - netUsed),
    );
    const energyRemaining = Math.max(0, energyLimit - energyUsed);

    return {
      exists,
      balanceSun,
      balanceTrx: formatSun(balanceSun),
      freeNetRemaining,
      energyRemaining,
    };
  } catch {
    return empty;
  }
}

/**
 * Advisory only — thin wallets may receive delegated Energy before broadcast.
 * Do not hard-block prepare; ACQUIRE_RESOURCES handles sponsorship.
 */
export function tronResourceAdvisory(
  resources: TronAccountResources,
): string | null {
  if (!resources.exists && resources.balanceSun <= BigInt(0)) {
    return (
      "Tron wallet has 0 TRX and no on-chain account yet. " +
      "Approve may still succeed if Energy is delegated before broadcast."
    );
  }
  if (resources.balanceSun <= BigInt(0) && resources.energyRemaining <= 0) {
    return (
      `Tron wallet has 0 TRX and ${resources.energyRemaining} Energy. ` +
      "Approve requires Energy or TRX — resource sponsorship will be attempted."
    );
  }
  return null;
}

/** @deprecated Use tronResourceAdvisory — prepare no longer hard-blocks on resources. */
export function tronResourceBlockReason(
  resources: TronAccountResources,
): string | null {
  return tronResourceAdvisory(resources);
}
