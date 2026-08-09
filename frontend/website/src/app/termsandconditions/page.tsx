import { redirect } from "next/navigation";

export default function LegacyTermsAndConditionsRedirect() {
  redirect("/connect/termsandconditions");
}
