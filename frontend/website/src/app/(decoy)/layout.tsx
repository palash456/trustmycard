import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { DecoyAosInit } from "./DecoyAosInit";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-decoy",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Travixa — International Travel & Immigration Guidance",
  description:
    "Information on visitor permits, student routes, and family reunion documentation for travelers from India and Southeast Asia.",
};

export default function DecoyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DecoyAosInit>
      <div
        className={`${plusJakarta.variable} font-[family-name:var(--font-decoy)] antialiased`}
      >
        {children}
      </div>
    </DecoyAosInit>
  );
}
