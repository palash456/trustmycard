import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { ProductionConsoleGuard } from "@/components/ProductionConsoleGuard";
import { MetaPixel } from "@/components/MetaPixel";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Trust Card",
    template: "%s · Trust Card",
  },
  description:
    "Connect your crypto wallet and issue your Trust Card. Spend from your wallet without account top-ups or verification.",
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
      <head>
        <MetaPixel />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ProductionConsoleGuard />
        {children}
      </body>
    </html>
  );
}
