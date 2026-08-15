"use client";

import {
  SiteConnectProvider,
  useSiteConnect,
} from "./connect/SiteConnectProvider";
import { SiteDocumentTitle } from "./SiteDocumentTitle";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { useTranslation } from "@/lib/i18n/I18nProvider";

function SiteChromeInner({ children }: { children: React.ReactNode }) {
  const { renderConnectButton } = useSiteConnect();
  const { t } = useTranslation();

  return (
    <>
      <SiteHeader
        getStartedButton={renderConnectButton(
          "header",
          t("nav.getStarted"),
          "header",
        )}
      />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <SiteConnectProvider>
      <SiteDocumentTitle />
      <SiteChromeInner>{children}</SiteChromeInner>
    </SiteConnectProvider>
  );
}
