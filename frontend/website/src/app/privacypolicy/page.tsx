import { redirect } from "next/navigation";

function normalizeBase(url: string | undefined, fallback: string): string {
  return (url ?? fallback).replace(/\/$/, "");
}

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).hostname === new URL(b).hostname;
  } catch {
    return false;
  }
}

const appBase = normalizeBase(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000");
const marketingBase = normalizeBase(
  process.env.NEXT_PUBLIC_MARKETING_URL,
  "https://trustmycard.com"
);

export default function LegacyMarketingRedirect() {
  const target = `${marketingBase}/privacypolicy/`;
  if (sameHost(appBase, marketingBase)) {
    redirect("/connect");
  }
  redirect(target);
}
