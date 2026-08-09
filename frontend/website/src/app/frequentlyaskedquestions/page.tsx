import { redirect } from "next/navigation";

export default function LegacyFaqRedirect() {
  redirect("/connect/frequentlyaskedquestions");
}
