import type { Metadata } from "next";
import { Geist } from "next/font/google";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Get Your Trust Card — Black Card",
  description:
    "Connect your wallet and issue your Black Card. Spend crypto at millions of merchants with bank-grade security and instant approval.",
  applicationName: "Trust Card",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
  },
  openGraph: {
    title: "Trust Card",
    description:
      "Connect your wallet and issue your Trust Card. Spend crypto at millions of merchants.",
    siteName: "Trust Card",
    type: "website",
    images: [{ url: "/images/hero-img-one.png", alt: "Trust Card" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trust Card",
    description:
      "Connect your wallet and issue your Trust Card. Spend crypto at millions of merchants.",
    images: ["/images/hero-img-one.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} font-sans`}
      suppressHydrationWarning
    >
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
