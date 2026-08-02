import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export default function CTASection() {
    return (
        <Section className="bg-black text-white">
            <Container>
                <div className="space-y-6 text-center">
                    <h2 className="text-5xl font-bold">
                        Ready to get started?
                    </h2>

                    <p className="mx-auto max-w-2xl text-neutral-300">
                        Join thousands of users already spending crypto like cash.
                    </p>

                    <Button variant="secondary">
                        Join Waitlist
                    </Button>
                </div>
            </Container>
        </Section>
    );
}