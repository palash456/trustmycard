import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export default function IssuerSection() {
    return (
        <Section>
            <Container>
                <div className="rounded-3xl border bg-neutral-50 p-12 text-center">
                    <h2 className="text-3xl font-bold">
                        Trusted Issuing Partners
                    </h2>

                    <p className="mt-4 text-neutral-600">
                        Built on secure infrastructure with globally recognized financial
                        partners.
                    </p>
                </div>
            </Container>
        </Section>
    );
}