"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { navigation } from "@/data/navigation";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMenu({
  open,
  onClose,
}: MobileMenuProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-xl lg:hidden">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <h2 className="text-lg font-semibold">
            Menu
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex flex-col">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="border-b px-6 py-4 text-base hover:bg-neutral-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}