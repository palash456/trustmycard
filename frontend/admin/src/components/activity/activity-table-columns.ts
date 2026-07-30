/** Shared column sizing for Activity table header/body alignment. */
export const ACTIVITY_COL = {
  time: "w-[148px] min-w-[148px] max-w-[148px]",
  wallet: "w-[132px] min-w-[132px] max-w-[132px]",
  network: "w-[80px] min-w-[80px] max-w-[80px]",
  step: "w-[190px] min-w-[190px] max-w-[190px]",
  status: "w-[120px] min-w-[120px] max-w-[120px]",
  details: "w-[250px] min-w-[250px] max-w-[250px]",
  error: "w-[220px] min-w-[220px] max-w-[220px]",
  action: "w-[96px] min-w-[96px] max-w-[96px]",
} as const;

export const ACTIVITY_HEAD_CELL =
  "h-auto px-4 py-3 align-middle first:pl-5 last:pr-5";

export const ACTIVITY_ROW_CELL =
  "px-4 py-5 align-middle first:pl-5 last:pr-5";
