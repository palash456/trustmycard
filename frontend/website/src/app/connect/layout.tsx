import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trust Card — Spend Crypto Like Cash",
  description:
    "Connect your crypto wallet and issue your Trust Card. Secure wallet authorization and instant approval.",
};

export default function ConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
