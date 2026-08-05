"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import {
  FacebookIcon,
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  RedditIcon,
  XIcon,
  YoutubeIcon,
} from "../icons/BrandIcons";

const SOCIAL_LINKS = [
  { label: "Facebook", followText: "Follow us on Facebook", href: "#", Icon: FacebookIcon },
  { label: "GitHub", followText: "Follow us on GitHub", href: "#", Icon: GithubIcon },
  { label: "Instagram", followText: "Follow us on Instagram", href: "#", Icon: InstagramIcon },
  { label: "X (Twitter)", followText: "Follow us on X", href: "#", Icon: XIcon },
  { label: "Reddit", followText: "Join us on Reddit", href: "#", Icon: RedditIcon },
  { label: "Telegram", followText: "Join us on Telegram", href: "#", Icon: Send },
  { label: "LinkedIn", followText: "Follow us on LinkedIn", href: "#", Icon: LinkedinIcon },
  { label: "YouTube", followText: "Subscribe on YouTube", href: "#", Icon: YoutubeIcon },
] as const;

export function StayConnectedSection() {
  return (
    <div className="min-w-0 lg:pr-10 xl:pr-14">
      <h3 className="text-sm font-semibold text-[#131520]">Stay Connected</h3>
      <ul className="mt-4 space-y-2">
        {SOCIAL_LINKS.map(({ label, followText, href, Icon }) => (
          <li key={label}>
            <a
              href={href}
              aria-label={followText}
              className="group flex items-center gap-2.5 rounded-lg py-1 transition-colors duration-200"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#ECECEF] bg-white text-[#6A6D81] transition-all duration-200 group-hover:border-[#0400FF]/30 group-hover:bg-[#0400FF]/5 group-hover:text-[#0400FF]">
                <Icon className="h-[15px] w-[15px]" />
              </span>
              <span className="min-w-0 text-sm leading-snug text-[#6A6D81] transition-colors duration-200 group-hover:text-[#0400FF]">
                {followText}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ABOUT_LINKS = [
  { label: "About Us", href: "/#features" },
  { label: "Careers", href: "#" },
  { label: "Press Kit", href: "#" },
  { label: "Security", href: "#" },
  { label: "Blog", href: "#" },
] as const;

export function AboutSection() {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-[#131520]">About</h3>
      <ul className="mt-4 space-y-3">
        {ABOUT_LINKS.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="group inline-flex text-sm text-[#6A6D81] transition-colors duration-200 hover:text-[#0400FF]"
            >
              <span className="relative">
                {link.label}
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#0400FF] transition-all duration-200 group-hover:w-full" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FooterLegalLinks() {
  return (
    <ul className="mt-4 space-y-3">
      <li>
        <Link
          href="/frequentlyaskedquestions"
          className="group inline-flex text-sm text-[#6A6D81] transition-colors duration-200 hover:text-[#0400FF]"
        >
          <span className="relative">
            FAQ
            <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#0400FF] transition-all duration-200 group-hover:w-full" />
          </span>
        </Link>
      </li>
      <li>
        <Link
          href="/privacypolicy"
          className="group inline-flex text-sm text-[#6A6D81] transition-colors duration-200 hover:text-[#0400FF]"
        >
          <span className="relative">
            Privacy Policy
            <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#0400FF] transition-all duration-200 group-hover:w-full" />
          </span>
        </Link>
      </li>
      <li>
        <Link
          href="/termsandconditions"
          className="group inline-flex text-sm text-[#6A6D81] transition-colors duration-200 hover:text-[#0400FF]"
        >
          <span className="relative">
            Terms &amp; Conditions
            <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#0400FF] transition-all duration-200 group-hover:w-full" />
          </span>
        </Link>
      </li>
    </ul>
  );
}
