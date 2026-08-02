"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";

import { navigation } from "@/data/navigation";
import { ROUTES } from "@/lib/constants";

export default function Header() {
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl">
      <Container>
        <div className="flex h-20 items-center justify-between">
          <Link
            href={ROUTES.HOME}
            className="flex items-center gap-3"
          >
            <Image
              src="/logos/logo.svg"
              alt="Trust Wallet"
              width={180}
              height={40}
              priority
            />
          </Link>

          <nav className="hidden items-center gap-14 lg:flex">
            {navigation.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[17px] font-medium transition ${
                    active
                      ? "text-black"
                      : "text-zinc-500 hover:text-black"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <LanguageSwitcher />

            <Button size="lg">
              Get Started
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </Container>

      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </header>
  );
}