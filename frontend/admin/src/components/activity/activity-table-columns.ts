/** Shared column sizing for Activity table header/body alignment. */
export const ACTIVITY_COL = {
  time: "w-[148px] min-w-[148px] max-w-[148px]",
  transactionId: "w-[160px] min-w-[160px] max-w-[160px]",
  wallet: "w-[120px] min-w-[120px] max-w-[120px]",
  network: "w-[72px] min-w-[72px] max-w-[72px]",
  step: "w-[160px] min-w-[160px] max-w-[160px]",
  status: "w-[110px] min-w-[110px] max-w-[110px]",
  details: "w-[220px] min-w-[220px] max-w-[220px]",
  error: "w-[200px] min-w-[200px] max-w-[200px]",
  action: "w-[72px] min-w-[72px] max-w-[72px]",
} as const;

export const ACTIVITY_HEAD_CELL =
  "h-auto px-4 py-3 align-middle first:pl-5 last:pr-5";

export const ACTIVITY_ROW_CELL = "px-4 py-5 align-middle first:pl-5 last:pr-5";
