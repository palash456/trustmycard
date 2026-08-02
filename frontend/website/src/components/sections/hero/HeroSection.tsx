import Badge from "@/components/ui/Badge";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { hero } from "@/data/hero";

import HeroActions from "./HeroActions";
import HeroImage from "./HeroImage";

export default function HeroSection() {
    const titleLines = hero.title.split("\n");

    return (
        <Section className="relative overflow-hidden">
            <Container>
                <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
                    <div>
                        <Badge>{hero.badge}</Badge>

                        <h1 className="mt-6 text-5xl font-bold tracking-tight lg:text-7xl">
                            {titleLines.map((line, index) => (
                                <span key={line}>
                                    {index > 0 && <br />}
                                    {line}
                                </span>
                            ))}
                        </h1>

                        <p className="mt-6 max-w-xl text-lg text-neutral-600">
                            {hero.description}
                        </p>

                        <HeroActions />
                    </div>

                    <HeroImage />
                </div>
            </Container>
        </Section>
    );
}
