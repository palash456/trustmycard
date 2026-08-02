import type { Metadata } from "next";

import { FAQSection } from "@/components/sections/faq";

export const metadata: Metadata = {
    title: "FAQ",
    description: "Frequently asked questions about TrustMyCard.",
};

export default function FAQPage() {
    return <FAQSection />;
}
