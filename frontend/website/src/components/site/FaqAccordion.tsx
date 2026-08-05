"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Reveal } from "./Reveal";

export type FaqItem = {
  question: string;
  answer: string;
};

export type FaqCategory = {
  title: string;
  items: FaqItem[];
};

function FaqAccordionItem({
  item,
  open,
  onToggle,
}: {
  item: FaqItem;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();

  return (
    <div className="card-surface overflow-hidden rounded-2xl transition-shadow duration-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left sm:px-6 sm:py-6"
      >
        <span className="text-base font-semibold text-[#131520] sm:text-lg">
          {item.question}
        </span>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-[#0400FF] transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-relaxed text-[#6A6D81] sm:px-6 sm:pb-6 sm:text-base">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FaqAccordion({ categories }: { categories: FaqCategory[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="space-y-12 sm:space-y-16">
      {categories.map((category, categoryIndex) => (
        <Reveal key={category.title} delay={categoryIndex * 60}>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#131520] sm:text-2xl">
              {category.title}
            </h2>
            <div className="mt-5 space-y-3 sm:mt-6 sm:space-y-4">
              {category.items.map((item, itemIndex) => {
                const key = `${category.title}-${itemIndex}`;
                return (
                  <FaqAccordionItem
                    key={key}
                    item={item}
                    open={openKey === key}
                    onToggle={() =>
                      setOpenKey((current) => (current === key ? null : key))
                    }
                  />
                );
              })}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
