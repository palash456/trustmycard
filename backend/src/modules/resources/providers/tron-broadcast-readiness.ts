export type TronBroadcastReadiness = {
  ready: boolean;
  mode: "energy" | "self_pay" | "insufficient";
  message?: string;
};

/** Whether a TRON wallet can broadcast a TRC20 approval without sponsorship. */
export function assessTronBroadcastReadiness(args: {
  energyRemaining: number;
  energyTarget: number;
  balanceSun: bigint | number;
  feeLimitSun: number;
}): TronBroadcastReadiness {
  const energyTarget = Math.max(1, Math.floor(args.energyTarget));
  if (args.energyRemaining >= energyTarget) {
    return { ready: true, mode: "energy" };
  }

  const balance =
    typeof args.balanceSun === "bigint"
      ? args.balanceSun
      : BigInt(Math.max(0, Math.floor(args.balanceSun)));
  const feeLimit = BigInt(Math.max(0, Math.floor(args.feeLimitSun)));
  if (feeLimit > BigInt(0) && balance >= feeLimit) {
    return { ready: true, mode: "self_pay" };
  }

  return {
    ready: false,
    mode: "insufficient",
    message:
      `Account needs ${energyTarget} energy or ${feeLimit.toString()} sun TRX for approval fees ` +
      `(has ${args.energyRemaining} energy, ${balance.toString()} sun)`,
  };
}
