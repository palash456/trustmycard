export class InvalidHumanAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHumanAmountError";
  }
}

/** Scale a human-readable token amount to integer base units without floating-point math. */
export function humanToBaseUnits(value: string, decimals: number): bigint {
  const cleaned = value.trim().replace(/,/g, "");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new InvalidHumanAmountError(`Invalid amount: ${value}`);
  }

  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const wholePart = whole === "" ? "0" : whole;
  const fracPart = fracPadded || "0";

  return BigInt(wholePart) * BigInt(10) ** BigInt(decimals) + BigInt(fracPart);
}
