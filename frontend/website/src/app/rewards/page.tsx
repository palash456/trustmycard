import type { Metadata } from "next";

import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export const metadata: Metadata = {
    title: "Rewards",
    description: "Discover cashback and crypto rewards.",
};

export default function RewardsPage() {
    return (
        <Section>
            <Container>
                <h1 className="text-4xl font-bold tracking-tight">Rewards</h1>

                <p className="mt-4 max-w-2xl text-neutral-600">
                    Earn rewards every time you spend with your TrustMyCard.
                </p>
            </Container>
        </Section>
    );
}