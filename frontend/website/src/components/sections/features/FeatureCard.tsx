import Card from "@/components/ui/Card";
import type { Feature } from "@/types/feature";

export default function FeatureCard({
    title,
    description,
}: Feature) {
    return (
        <Card hoverable className="p-6">
            <div className="space-y-3">
                <div className="h-12 w-12 rounded-xl bg-neutral-100" />

                <h3 className="text-xl font-semibold">
                    {title}
                </h3>

                <p className="text-neutral-600">
                    {description}
                </p>
            </div>
        </Card>
    );
}
