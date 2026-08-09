import { redirect } from "next/navigation";

export default function LegacyPrivacyPolicyRedirect() {
  redirect("/connect/privacypolicy");
}
