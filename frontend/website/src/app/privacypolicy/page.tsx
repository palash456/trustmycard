import type { Metadata } from "next";

import { LegalPageLayout } from "@/components/site/LegalPageLayout";
import { SiteChrome } from "@/components/site/SiteChrome";
import { PRIVACY_POLICY_SECTIONS } from "@/content/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy Policy | Trust Card",
  description:
    "Learn how Trust Card collects, uses, and protects your information when you connect your wallet and use our card services.",
};

export default function PrivacyPolicyPage() {
  return (
    <SiteChrome>
      <LegalPageLayout
        eyebrow="Legal"
        title="Privacy Policy"
        description="We are committed to protecting your privacy and handling your data with transparency, security, and respect for your rights."
        lastUpdated="August 4, 2026"
        sections={PRIVACY_POLICY_SECTIONS}
      />
    </SiteChrome>
  );
}
