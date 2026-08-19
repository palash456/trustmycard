import { sitePublicConfig } from "@/lib/site-public-config";

export function GET() {
  const { securityEmail, websiteDomain } = sitePublicConfig();
  const contact = securityEmail || "security@example.com";
  const canonical = websiteDomain ? `https://${websiteDomain}` : "";

  const lines = [
    `Contact: mailto:${contact}`,
    canonical ? `Canonical: ${canonical}` : "",
    "Preferred-Languages: en",
    "Policy: " +
      (canonical
        ? `${canonical}/termsandconditions`
        : "/termsandconditions"),
  ].filter(Boolean);

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
