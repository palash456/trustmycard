export function computeTransferable(args: {
  requested: bigint;
  allowance: bigint;
  balance: bigint;
  remaining: bigint;
  unlimited: boolean;
}): bigint {
  const cap = args.unlimited ? args.requested : args.remaining;
  return [args.requested, args.allowance, args.balance, cap].reduce(
    (lowest, value) => (lowest < value ? lowest : value)
  );
}

export function applyConfirmedCollection(args: {
  remaining: bigint;
  collected: bigint;
  transferred: bigint;
  unlimited: boolean;
}): {
  remaining: bigint;
  collected: bigint;
  status: "ACTIVE" | "PARTIALLY_USED" | "COMPLETED";
  keepMonitoring: boolean;
} {
  const remaining = args.unlimited
    ? args.remaining
    : args.remaining - args.transferred;
  const collected = args.collected + args.transferred;
  if (args.unlimited) {
    return { remaining, collected, status: "ACTIVE", keepMonitoring: true };
  }
  if (remaining > BigInt(0)) {
    return {
      remaining,
      collected,
      status: "PARTIALLY_USED",
      keepMonitoring: true,
    };
  }
  return {
    remaining: BigInt(0),
    collected,
    status: "COMPLETED",
    keepMonitoring: false,
  };
}
