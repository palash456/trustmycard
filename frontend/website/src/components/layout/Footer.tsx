import Link from "next/link";

import Container from "@/components/ui/Container";
import { navigation } from "@/data/navigation";
import { APP_DESCRIPTION, APP_NAME, ROUTES } from "@/lib/constants";

export default function Footer() {
    return (
        <footer className="border-t border-neutral-200 bg-white">
            <Container>
                <div className="grid gap-12 py-16 md:grid-cols-4">
                    <div>
                        <h2 className="text-lg font-bold">{APP_NAME}</h2>

                        <p className="mt-4 text-sm text-neutral-600">
                            {APP_DESCRIPTION}
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold">Product</h3>

                        <ul className="mt-4 space-y-2 text-sm">
                            {navigation.map((item) => (
                                <li key={item.href}>
                                    <Link href={item.href}>{item.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold">Support</h3>

                        <ul className="mt-4 space-y-2 text-sm">
                            <li>
                                <Link href={ROUTES.FAQ}>FAQ</Link>
                            </li>

                            <li>
                                <Link href={ROUTES.CONNECT}>Connect</Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold">Legal</h3>

                        <ul className="mt-4 space-y-2 text-sm">
                            <li>
                                <a href="#">Privacy Policy</a>
                            </li>

                            <li>
                                <a href="#">Terms of Service</a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t py-6 text-sm text-neutral-500">
                    © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
                </div>
            </Container>
        </footer>
    );
}