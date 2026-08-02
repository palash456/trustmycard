"use client";

import { useState } from "react";

import type { FAQItemProps } from "@/types/faq";

export default function FAQItem({
    question,
    answer,
    defaultOpen = false,
}: FAQItemProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="rounded-2xl border border-neutral-200 bg-white">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between p-6 text-left"
            >
                <span className="text-lg font-semibold">{question}</span>

                <span
                    aria-hidden="true"
                    className={`text-xl transition-transform ${isOpen ? "rotate-45" : ""
                        }`}
                >
                    +
                </span>
            </button>

            {isOpen && (
                <div className="border-t border-neutral-200 px-6 py-5">
                    <p className="leading-7 text-neutral-600">{answer}</p>
                </div>
            )}
        </div>
    );
}
