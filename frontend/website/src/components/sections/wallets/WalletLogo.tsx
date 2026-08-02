import { cn } from "@/lib/utils";

interface WalletLogoProps {
    name: string;
    className?: string;
}

export default function WalletLogo({
    name,
    className,
}: WalletLogoProps) {
    return (
        <div
            className={cn(
                "flex h-12 items-center justify-center rounded-xl border border-neutral-200 bg-white px-6",
                className
            )}
        >
            <span className="text-sm font-medium text-neutral-600">
                {name}
            </span>
        </div>
    );
}