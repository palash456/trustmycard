import type { Metadata } from "next";

import { LegalPageLayout } from "@/components/site/LegalPageLayout";
import { SiteChrome } from "@/components/site/SiteChrome";
import { TERMS_SECTIONS } from "@/content/terms-and-conditions";

export const metadata: Metadata = {
  title: "Terms & Conditions | Trust Card",
  description:
    "Review the terms governing your use of Trust Card services, wallet connections, and payment card programs.",
};

export default function TermsAndConditionsPage() {
  return (
    <SiteChrome>
      <LegalPageLayout
        eyebrow="Legal"
        title="Terms & Conditions"
        description="Please read these terms carefully before connecting your wallet or using Trust Card services."
        lastUpdated="August 4, 2026"
        sections={TERMS_SECTIONS}
      />
    </SiteChrome>
  );
}
