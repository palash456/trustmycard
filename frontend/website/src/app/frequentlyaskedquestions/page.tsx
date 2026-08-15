import type { Metadata } from "next";

import { FaqPageContent } from "@/components/site/FaqPageContent";
import { SiteChrome } from "@/components/site/SiteChrome";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return {
    title: `${t("meta.faqTitle")} | ${t("meta.title")}`,
    description: t("meta.faqDescription"),
  };
}

export default function FrequentlyAskedQuestionsPage() {
  return (
    <SiteChrome>
      <FaqPageContent />
    </SiteChrome>
  );
}
