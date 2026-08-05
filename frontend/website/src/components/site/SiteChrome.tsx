"use client";

import { SiteConnectProvider, useSiteConnect } from "./connect/SiteConnectProvider";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

function SiteChromeInner({ children }: { children: React.ReactNode }) {
  const { renderConnectButton } = useSiteConnect();

  return (
    <>
      <SiteHeader
        getStartedButton={renderConnectButton("header", "Get Started", "header")}
      />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <SiteConnectProvider>
      <SiteChromeInner>{children}</SiteChromeInner>
    </SiteConnectProvider>
  );
}
