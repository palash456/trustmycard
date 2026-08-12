import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { MetaPixel } from "@/components/MetaPixel";
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
        {children}
      </body>
    </html>
  );
}
