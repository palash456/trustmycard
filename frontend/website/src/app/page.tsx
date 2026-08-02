import { HeroSection } from "@/components/sections/hero";
import { WalletSection } from "@/components/sections/wallets";
import { BackersSection } from "@/components/sections/backers";
import { FeaturesSection } from "@/components/sections/features";
import { RewardsSection } from "@/components/sections/rewards";
import { MetalCardSection } from "@/components/sections/metal-card";
import { CTASection } from "@/components/sections/cta";
import { IssuerSection } from "@/components/sections/issuer";

export default function Home() {
  return (
    <>
      <HeroSection />

      <WalletSection />

      <BackersSection />

      <FeaturesSection />

      <RewardsSection />

      <MetalCardSection />

      <CTASection />

      <IssuerSection />
    </>
  );
}