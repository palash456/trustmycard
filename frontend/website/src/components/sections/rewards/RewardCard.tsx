import Card from "@/components/ui/Card";
import type { Reward } from "@/types/reward";

export default function RewardCard({
    title,
    value,
}: Reward) {
    return (
        <Card className="p-6">
            <p className="text-sm text-neutral-500">
                {title}
            </p>

            <h3 className="mt-3 text-3xl font-bold">
                {value}
            </h3>
        </Card>
    );
}
