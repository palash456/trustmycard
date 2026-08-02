import type { Metadata } from "next";

import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export const metadata: Metadata = {
    title: "Premium",
    description: "Premium card benefits and exclusive perks.",
};

export default function PremiumPage() {
    return (
        <Section>
            <Container>
                <h1 className="text-4xl font-bold tracking-tight">Premium</h1>

                <p className="mt-4 max-w-2xl text-neutral-600">
                    Unlock premium features designed for power users.
                </p>
            </Container>
        </Section>
    );
}