import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { wallets } from "@/data/wallets";
import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";

import WalletLogo from "./WalletLogo";

interface WalletSectionProps {
    platform?: PublicPlatformConfig;
}

export default function WalletSection({
    platform,
}: WalletSectionProps) {
    void platform;

    return (
        <Section className="border-y bg-neutral-50">
            <Container>
                <div className="space-y-10">
                    <div className="text-center">
                        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                            Works with your favorite wallets
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                        {wallets.map((wallet) => (
                            <WalletLogo
                                key={wallet.name}
                                name={wallet.name}
                            />
                        ))}
                    </div>
                </div>
            </Container>
        </Section>
    );
}
