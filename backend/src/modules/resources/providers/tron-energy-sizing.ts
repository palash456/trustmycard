/** Buffer added on top of computed delegation (1 TRX in sun). */
export const TRON_DELEGATION_SUN_BUFFER = 1_000_000;

export type NetworkEnergyWeights = {
  totalEnergyLimit: number;
  totalEnergyWeight: number;
};

export function parseNetworkEnergyWeights(resourceJson: {
  TotalEnergyLimit?: number;
  TotalEnergyWeight?: number;
}): NetworkEnergyWeights {
  return {
    totalEnergyLimit: Number(resourceJson.TotalEnergyLimit ?? 0),
    totalEnergyWeight: Number(resourceJson.TotalEnergyWeight ?? 0),
  };
}

/** Convert desired energy units to frozen-TRX sun for delegateResource (Stake 2.0). */
export function energyTargetToDelegateSun(
  energyTarget: number,
  totalEnergyLimit: number,
  totalEnergyWeight: number,
  sunBuffer = TRON_DELEGATION_SUN_BUFFER,
): number {
  if (totalEnergyLimit <= 0 || totalEnergyWeight <= 0) {
    throw new Error(
      "Unable to read network energy weights; cannot size delegation",
    );
  }
  const target = BigInt(Math.max(1, Math.floor(energyTarget)));
  const weight = BigInt(Math.floor(totalEnergyWeight));
  const limit = BigInt(Math.floor(totalEnergyLimit));
  const sun = (target * weight + limit - BigInt(1)) / limit + BigInt(sunBuffer);
  const result = Number(sun);
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new Error("Computed delegation amount is out of range");
  }
  return result;
}
