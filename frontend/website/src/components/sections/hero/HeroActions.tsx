import Button from "@/components/ui/Button";
import ConnectWalletButton from "@/app/ConnectFlowClient";

import { hero } from "@/data/hero";

export default function HeroActions() {
  return (
    <div className="mt-10 flex flex-wrap gap-4">
      <ConnectWalletButton />

      <Button
        size="lg"
        variant="outline"
      >
        {hero.secondaryAction}
      </Button>
    </div>
  );
}