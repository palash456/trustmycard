import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { backers } from "@/data/backers";

export default function BackersSection() {
    return (
        <Section>
            <Container>
                <div className="space-y-10">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold">
                            Backed by Industry Leaders
                        </h2>

                        <p className="mt-3 text-neutral-600">
                            Trusted by some of the world&apos;s leading investors.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                        {backers.map((backer) => (
                            <div
                                key={backer.name}
                                className="flex h-16 items-center justify-center rounded-xl border bg-white"
                            >
                                {backer.name}
                            </div>
                        ))}
                    </div>
                </div>
            </Container>
        </Section>
    );
}
