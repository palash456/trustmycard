import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

import ConnectWalletButton from "@/app/ConnectFlowClient";

export default function CTASection() {
  return (
    <Section className="bg-zinc-950 text-white">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold">
            Ready to start?
          </h2>

          <p className="mt-6 text-lg text-zinc-300">
            Join thousands of users already using TrustMyCard.
          </p>

          <div className="mt-10 flex justify-center">
            <ConnectWalletButton />
          </div>
        </div>
      </Container>
    </Section>
  );
}