import type { Metadata } from "next";

import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export const metadata: Metadata = {
    title: "Connect Wallet",
    description: "Securely connect your wallet to TrustMyCard.",
};

export default function ConnectPage() {
    return (
        <Section>
            <Container>
                <h1 className="text-4xl font-bold tracking-tight">
                    Connect Wallet
                </h1>

                <p className="mt-4 max-w-2xl text-neutral-600">
                    Connect your wallet securely to continue.
                </p>
            </Container>
        </Section>
    );
}