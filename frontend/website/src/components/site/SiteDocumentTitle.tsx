"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

import { useTranslation } from "@/lib/i18n/I18nProvider";

function resolvePageTitleKey(pathname: string): string | null {
  if (pathname.includes("/frequentlyaskedquestions")) return "meta.faqTitle";
  if (pathname.includes("/privacypolicy")) return "meta.privacyTitle";
  if (pathname.includes("/termsandconditions")) return "meta.termsTitle";
  return null;
}

export function SiteDocumentTitle() {
  const pathname = usePathname();
  const { locale, t } = useTranslation();

  useLayoutEffect(() => {
    const pageKey = resolvePageTitleKey(pathname);
    document.title = pageKey
      ? `${t(pageKey)} | ${t("meta.title")}`
      : t("meta.title");
  }, [locale, pathname, t]);

  return null;
}
