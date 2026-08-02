import { ROUTES } from "@/lib/constants";
import type { NavigationItem } from "@/types/navigation";

export const navigation: NavigationItem[] = [
    {
        label: "Pricing",
        href: ROUTES.PRICING,
    },
    {
        label: "Rewards",
        href: ROUTES.REWARDS,
    },
    {
        label: "Premium",
        href: ROUTES.PREMIUM,
    },
    {
        label: "FAQ",
        href: ROUTES.FAQ,
    },
];

export const languages = ["en", "es", "fr"] as const;
