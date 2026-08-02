import Button from "@/components/ui/Button";
import { hero } from "@/data/hero";

export default function HeroActions() {
    return (
        <div className="mt-10 flex flex-wrap gap-4">
            <Button size="lg">
                {hero.primaryAction}
            </Button>

            <Button
                size="lg"
                variant="outline"
            >
                {hero.secondaryAction}
            </Button>
        </div>
    );
}
