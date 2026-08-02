import type { Metadata } from "next";

import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export const metadata: Metadata = {
    title: "Pricing",
    description: "Explore TrustMyCard pricing plans.",
};

export default function PricingPage() {
    return (
        <Section>
            <Container>
                <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>

                <p className="mt-4 max-w-2xl text-neutral-600">
                    Compare plans and find the one that best fits your needs.
                </p>
            </Container>
        </Section>
    );
}