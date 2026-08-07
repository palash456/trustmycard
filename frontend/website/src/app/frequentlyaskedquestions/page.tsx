import { redirect } from "next/navigation";

const marketingBase = (
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://trustmycard.com"
).replace(/\/$/, "");

export default function LegacyMarketingRedirect() {
  redirect(`${marketingBase}/frequentlyaskedquestions/`);
}
