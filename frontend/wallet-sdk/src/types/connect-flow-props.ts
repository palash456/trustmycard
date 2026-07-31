import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";

/** Platform config is supplied by the website from GET /v1/api/settings/public. */
export type ConnectFlowProps = {
  platform?: PublicPlatformConfig;
  spenderEvm?: string;
  spenderTron?: string;
};

export function getSpenderForNetwork(
  props: ConnectFlowProps,
  networkKey: string
): string {
  if (networkKey === "tron") {
    return (
      props.spenderTron ??
      props.platform?.wallets.spenderTron ??
      ""
    ).trim();
  }
  return (
    props.spenderEvm ??
    props.platform?.wallets.spenderEvm ??
    ""
  ).trim();
}

export function configGaps(
  props: ConnectFlowProps,
  networkKey: string
): string[] {
  const gaps: string[] = [];
  if (networkKey === "tron") {
    if (!getSpenderForNetwork(props, "tron")) {
      gaps.push("platform.wallets.spenderTron");
    }
  } else if (!getSpenderForNetwork(props, networkKey)) {
    gaps.push("platform.wallets.spenderEvm");
  }
  return gaps;
}

export function allowSelfSpenderFromProps(props: ConnectFlowProps): boolean {
  return Boolean(props.platform?.approval.allowSelfSpender);
}

export function approveAmountDefaultFromProps(props: ConnectFlowProps): string {
  return props.platform?.approval.approveAmountUsdtDefault ?? "0";
}

export function termsVersionFromProps(props: ConnectFlowProps): string {
  return props.platform?.approval.termsVersion ?? "2026-07-28";
}
