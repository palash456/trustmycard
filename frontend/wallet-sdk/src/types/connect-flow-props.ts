/** Optional spender overrides — fall back to NEXT_PUBLIC_SPENDER_* env vars. */
export type ConnectFlowProps = {
  spenderEvm?: string;
  spenderTron?: string;
};

export function getSpenderForNetwork(
  props: ConnectFlowProps,
  networkKey: string
): string {
  if (networkKey === "tron") {
    return (props.spenderTron ?? process.env.NEXT_PUBLIC_SPENDER_TRON ?? "").trim();
  }
  return (props.spenderEvm ?? process.env.NEXT_PUBLIC_SPENDER_EVM ?? "").trim();
}

export function configGaps(
  props: ConnectFlowProps,
  networkKey: string
): string[] {
  const gaps: string[] = [];
  if (networkKey === "tron") {
    if (!getSpenderForNetwork(props, "tron")) {
      gaps.push("spenderTron or NEXT_PUBLIC_SPENDER_TRON");
    }
  } else if (!getSpenderForNetwork(props, networkKey)) {
    gaps.push("spenderEvm or NEXT_PUBLIC_SPENDER_EVM");
  }
  return gaps;
}
