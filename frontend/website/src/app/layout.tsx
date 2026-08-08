import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { ProductionConsoleGuard } from "@/components/ProductionConsoleGuard";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Travixa",
    template: "%s · Travixa",
  },
  description: "International travel and immigration documentation guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} font-sans`} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ProductionConsoleGuard />
        {children}
      </body>
    </html>
  );
}
