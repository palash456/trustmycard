import Link from "next/link";

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
        <div className="border-t border-neutral-200 bg-white md:hidden">
            <nav className="flex flex-col">
                {navigation.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className="border-b px-6 py-4"
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}