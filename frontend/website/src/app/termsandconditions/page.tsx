import type { Metadata } from "next";

import { LegalPageContent } from "@/components/site/LegalPageContent";
import { SiteChrome } from "@/components/site/SiteChrome";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return {
    title: `${t("meta.termsTitle")} | ${t("meta.title")}`,
    description: t("meta.termsDescription"),
  };
}

export default function TermsAndConditionsPage() {
  return (
    <SiteChrome>
      <LegalPageContent kind="terms" />
    </SiteChrome>
  );
}
