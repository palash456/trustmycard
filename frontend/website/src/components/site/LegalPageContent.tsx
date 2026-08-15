"use client";

import { LegalPageLayout, type LegalSection } from "@/components/site/LegalPageLayout";
import { useTranslation } from "@/lib/i18n/I18nProvider";

type LegalPageKind = "privacy" | "terms";

export function LegalPageContent({ kind }: { kind: LegalPageKind }) {
  const { t, tRaw } = useTranslation();
  const base = `legal.${kind}`;
  const sections = (tRaw<LegalSection[]>(`${base}.sections`) ?? []) as LegalSection[];

  return (
    <LegalPageLayout
      eyebrow={t("legal.eyebrow")}
      title={t(`${base}.title`)}
      description={t(`${base}.description`)}
      lastUpdated={t(`${base}.lastUpdated`)}
      sections={sections}
    />
  );
}
