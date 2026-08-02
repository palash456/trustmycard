import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export default function MetalCardSection() {
    return (
        <Section>
            <Container>
                <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                    <div>
                        <h2 className="text-4xl font-bold">
                            Premium Metal Card
                        </h2>

                        <p className="mt-4 text-neutral-600">
                            Designed with premium materials and built for everyday spending.
                        </p>
                    </div>

                    <div className="aspect-video rounded-3xl border bg-neutral-100" />
                </div>
            </Container>
        </Section>
    );
}