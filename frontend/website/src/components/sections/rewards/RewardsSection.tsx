import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { rewards } from "@/data/rewards";

import RewardCard from "./RewardCard";

export default function RewardsSection() {
    return (
        <Section className="bg-neutral-50">
            <Container>
                <div className="space-y-12">
                    <div className="text-center">
                        <h2 className="text-4xl font-bold">
                            Rewards
                        </h2>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        {rewards.map((reward) => (
                            <RewardCard
                                key={reward.title}
                                {...reward}
                            />
                        ))}
                    </div>
                </div>
            </Container>
        </Section>
    );
}
