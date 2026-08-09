/** Bump when replacing decoy logo assets in `public/decoy/` (production cache). */
export const DECOY_LOGO_VERSION = "3";

/** Stock images — Unsplash License. Hero video served locally from /public/decoy */
export const DECOY_MEDIA = {
  heroPoster:
    "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1920&q=75",
  logo: "/decoy/travixa-logo.png",
  logoWhite: "/decoy/travixa-logo-white.png",
  icon: "/decoy/travixa-icon.png",
  heroVideo: "/decoy/hero.mp4",
  /** Local — previous Unsplash ID returned 404 */
  appPreview: "/decoy/platform.jpg",
  travel:
    "https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1200&q=80",
  support:
    "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80",
} as const;

export function decoyLogoSrc(version: string = DECOY_LOGO_VERSION) {
  return `${DECOY_MEDIA.logo}?v=${version}`;
}

export function decoyLogoWhiteSrc(version: string = DECOY_LOGO_VERSION) {
  return `${DECOY_MEDIA.logoWhite}?v=${version}`;
}

export function decoyIconSrc(version: string = DECOY_LOGO_VERSION) {
  return `${DECOY_MEDIA.icon}?v=${version}`;
}
