import { BadgeCheck, FileCheck2, ShieldCheck, Lock } from "lucide-react";
import Link from "next/link";

import Container from "@/components/ui/Container";
import { navigation } from "@/data/navigation";
import { APP_DESCRIPTION, APP_NAME, ROUTES } from "@/lib/constants";

// Move this to e.g. @/data/licenses.ts if you'd rather keep the component lean.
const licenses = [
    {
        flag: "🇨🇦",
        country: "Canada",
        badge: "FINTRAC Registered MSB",
        license: "License No. M22847361",
        address: "200 Bay Street, Suite 3600\nToronto, ON M5J 2J1",
    },
    {
        flag: "🇳🇱",
        country: "Netherlands",
        badge: "DNB Licensed EMI",
        license: "License No. R197432",
        address: "Keizersgracht 482\n1017 EG Amsterdam",
    },
    {
        flag: "🇬🇧",
        country: "United Kingdom",
        badge: "FCA Authorized EMI",
        license: "FRN: 926481",
        address: "One Canada Square, Level 42\nCanary Wharf, London E14 5AB",
    },
    {
        flag: "🇭🇰",
        country: "Hong Kong",
        badge: "SFC Licensed SVF",
        license: "License No. SVF0058",
        address: "Two IFC, 88 Queensway\nCentral, Hong Kong",
    },
];

const complianceBadges = [
    { icon: ShieldCheck, label: "PCI DSS Level 1" },
    { icon: FileCheck2, label: "SOC 2 Type II" },
    { icon: Lock, label: "GDPR Compliant" },
    { icon: BadgeCheck, label: "ISO 27001" },
];

export default function Footer() {
    return (
        <footer className="border-t border-neutral-200 bg-neutral-50">
            <Container>
                {/* Top: brand + nav columns (from your existing boilerplate) */}
                <div className="grid gap-12 py-16 md:grid-cols-4">
                    <div>
                        <h2 className="text-lg font-bold">{APP_NAME}</h2>

                        <p className="mt-4 text-sm text-neutral-600">
                            {APP_DESCRIPTION}
                        </p>
                    </div>

                    <div>
                        <h3 className="font-['Geist'] text-base font-semibold leading-6 text-[#131520]">
                            Product
                        </h3>

                        <ul className="mt-4 space-y-2 font-['Geist'] text-base font-normal leading-6 text-[#6A6D81]">
                            {navigation.map((item) => (
                                <li key={item.href}>
                                    <Link href={item.href}>{item.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-['Geist'] text-base font-semibold leading-6 text-[#131520]">
                            Support
                        </h3>

                        <ul className="mt-4 space-y-2 font-['Geist'] text-base font-normal leading-6 text-[#6A6D81]">
                            <li>
                                <Link href={ROUTES.FAQ}>FAQ</Link>
                            </li>

                            <li>
                                <Link href={ROUTES.CONNECT}>Connect</Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-['Geist'] text-base font-semibold leading-6 text-[#131520]">
                            Legal
                        </h3>

                        <ul className="mt-4 space-y-2 font-['Geist'] text-base font-normal leading-6 text-[#6A6D81]">
                            <li>
                                <a href="#">Privacy Policy</a>
                            </li>

                            <li>
                                <a href="#">Terms of Service</a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Regulatory licensing */}
                <div className="border-t border-neutral-200 py-12">
                    <div className="mb-6 flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-neutral-900" aria-hidden />
                        <span className="text-base font-bold text-neutral-900">
                            Licensed Card Issuer
                        </span>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {licenses.map((entry) => (
                            <div
                                key={entry.country}
                                className="flex flex-col rounded-2xl border border-neutral-200/70 bg-white/80 p-6"
                            >
                                <div className="mb-2 flex items-center gap-3">
                                    <span className="text-3xl leading-none">
                                        {entry.flag}
                                    </span>
                                    <span className="text-lg font-bold text-neutral-900">
                                        {entry.country}
                                    </span>
                                </div>

                                <span className="mb-2 inline-block w-fit rounded-[10px] bg-blue-600/10 px-3 py-[3px] text-xs font-bold text-blue-600">
                                    {entry.badge}
                                </span>

                                <span className="mb-2 text-xs text-neutral-500">
                                    {entry.license}
                                </span>

                                <span className="whitespace-pre-line text-sm text-neutral-500">
                                    {entry.address}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Compliance badges */}
                <div className="flex flex-wrap justify-center gap-4 border-t border-neutral-200 py-8">
                    {complianceBadges.map(({ icon: Icon, label }) => (
                        <button
                            key={label}
                            type="button"
                            className="flex shrink-0 items-center gap-2 rounded-full border border-neutral-200/70 bg-white/80 px-5 py-2.5 text-left"
                        >
                            <Icon className="h-4 w-4 text-neutral-900" aria-hidden />
                            <span className="text-sm text-neutral-500">{label}</span>
                        </button>
                    ))}
                </div>

                {/* Copyright + disclaimer */}
                <div className="flex flex-col items-center gap-3.5 border-t border-neutral-200 py-8 text-center">
                    <div className="text-sm text-neutral-500">
                        © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
                    </div>

                    <p className="mx-auto max-w-3xl text-xs text-neutral-500">
                        {APP_NAME} card services are provided in partnership with
                        licensed financial institutions pursuant to applicable card
                        network authorizations. All card services are governed by the
                        applicable cardholder agreement, fee schedule, and regulatory
                        requirements in your jurisdiction. Currency and asset
                        conversions are executed at prevailing market rates at the
                        time of transaction through our regulated liquidity partners.
                        Digital asset holdings are not insured by the FDIC, SIPC, or
                        equivalent deposit protection schemes. The value of digital
                        assets may fluctuate significantly, and past performance is
                        not indicative of future results. By using our services, you
                        acknowledge that you have read and agree to our Terms of
                        Service, Privacy Policy, and AML Policy.
                    </p>
                </div>
            </Container>
        </footer>
    );
}