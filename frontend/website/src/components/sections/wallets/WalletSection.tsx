import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

import { wallets } from "@/data/wallets";

import WalletLogo from "./WalletLogo";

export default function WalletSection() {
  return (
    <Section className="border-y bg-neutral-50">
      <Container>
        <div className="space-y-10">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-neutral-500">
              Compatible Wallets
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {wallets.map((wallet) => (
              <WalletLogo key={wallet.name} name={wallet.name} />
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
