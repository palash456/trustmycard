export const APP_NAME = "TrustMyCard";

export const APP_DESCRIPTION =
    "A secure platform for digital payment experiences.";

export const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

export const ROUTES = {
    HOME: "/",
    PRICING: "/pricing",
    REWARDS: "/rewards",
    PREMIUM: "/premium",
    FAQ: "/faq",
    CONNECT: "/connect",
} as const;

export const DEFAULT_METADATA = {
    title: APP_NAME,
    description: APP_DESCRIPTION,
};