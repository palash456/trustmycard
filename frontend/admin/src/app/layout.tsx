import type { Metadata } from "next";
import "./globals.css";
import { Geist, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const brand = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-brand",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Trust Admin",
  description: "Trust Wallet operations console",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/brand/logo-mark.png" }],
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable, brand.variable)}
    >
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
