import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { ProductionConsoleGuard } from "@/components/ProductionConsoleGuard";
import { MetaPixel } from "@/components/MetaPixel";
import { localeDefinition } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getServerLocale, getServerTranslator } from "@/lib/i18n/server";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  const title = t("meta.title");
  const description = t("meta.description");
  return {
    title: {
      default: title,
      template: t("meta.titleTemplate"),
    },
    description,
    applicationName: "Trust Card",
    icons: {
      icon: [{ url: "/icon.png", type: "image/png" }],
      apple: [{ url: "/apple-icon.png", type: "image/png" }],
      shortcut: "/icon.png",
    },
    openGraph: {
      title,
      description,
      siteName: "Trust Card",
      type: "website",
      images: [
        {
          url: "/images/hero-img-one.png",
          alt: "Trust Card",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/hero-img-one.png"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();
  const { dir } = localeDefinition(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geist.variable} font-sans`}
      suppressHydrationWarning
    >
      <head>
        <MetaPixel />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <I18nProvider initialLocale={locale}>
          <ProductionConsoleGuard />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
