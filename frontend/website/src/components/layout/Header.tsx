"use client";

import Link from "next/link";
import { useState } from "react";

import MobileMenu from "./MobileMenu";
import LanguageSwitcher from "./LanguageSwitcher";

import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { languages, navigation } from "@/data/navigation";
import { APP_NAME, ROUTES } from "@/lib/constants";

export default function Header() {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur">
            <Container>
                <div className="flex h-16 items-center justify-between">
                    {/* Logo */}
                    <Link
                        href={ROUTES.HOME}
                        className="text-xl font-bold tracking-tight"
                    >
                        {APP_NAME}
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden items-center gap-8 md:flex">
                        {navigation.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="text-sm font-medium transition hover:text-blue-600"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Right Side */}
                    <div className="hidden items-center gap-4 md:flex">
                        <LanguageSwitcher
                            value="en"
                            options={[...languages]}
                        />

                        <Button>Get Started</Button>
                    </div>

                    {/* Mobile Button */}
                    <button
                        className="rounded-lg p-2 md:hidden"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle navigation"
                    >
                        ☰
                    </button>
                </div>
            </Container>

            <MobileMenu
                open={mobileOpen}
                onClose={() => setMobileOpen(false)}
            />
        </header>
    );
}