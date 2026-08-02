import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { features } from "@/data/features";

import FeatureCard from "./FeatureCard";

export default function FeaturesSection() {
    return (
        <Section>
            <Container>
                <div className="space-y-12">
                    <div className="text-center">
                        <h2 className="text-4xl font-bold">
                            Features
                        </h2>

                        <p className="mt-4 text-neutral-600">
                            Everything you need in one modern payment experience.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        {features.map((feature) => (
                            <FeatureCard
                                key={feature.title}
                                {...feature}
                            />
                        ))}
                    </div>
                </div>
            </Container>
        </Section>
    );
}
