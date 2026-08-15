"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LOCALE_DEFINITIONS } from "@/lib/i18n/config";
import { writeLocaleCookie } from "@/lib/i18n/cookie";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { languageLabel } from "@/lib/i18n/language-label";
import type { Locale } from "@/lib/i18n/types";

export function LanguageSelector({ className }: { className?: string }) {
  const { locale, dir, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentDef =
    LOCALE_DEFINITIONS.find((entry) => entry.code === locale) ??
    LOCALE_DEFINITIONS[0];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        close();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  function selectLocale(code: Locale) {
    close();
    if (code === locale) return;
    writeLocaleCookie(code);
    window.location.reload();
  }

  return (
    <div
      ref={rootRef}
      dir={dir}
      className={`relative inline-flex ${className ?? ""}`}
    >
      <button
        type="button"
        aria-label={t("nav.languageAria")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E3E3E8] bg-white py-2.5 ps-4 pe-3 text-sm font-semibold text-zinc-700 outline-none transition-colors hover:bg-neutral-50"
      >
        <span className="text-base leading-none" aria-hidden>
          {currentDef.flag}
        </span>
        <span className="max-w-[7rem] truncate sm:max-w-none">
          {languageLabel(t, locale)}
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2.5"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t("nav.languageAria")}
          className="absolute end-0 top-[calc(100%+0.5rem)] z-[60] min-w-[12.5rem] overflow-hidden rounded-2xl border border-[#ECECEF] bg-white py-1 shadow-[0_12px_40px_rgba(19,21,32,0.12)]"
        >
          {LOCALE_DEFINITIONS.map((entry) => {
            const selected = entry.code === locale;
            return (
              <li key={entry.code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => selectLocale(entry.code)}
                  className={[
                    "flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm transition-colors",
                    selected
                      ? "bg-[#0400FF]/5 font-semibold text-[#0400FF]"
                      : "font-medium text-zinc-700 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {entry.flag}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {languageLabel(t, entry.code)}
                  </span>
                  {selected ? (
                    <svg
                      className="h-4 w-4 shrink-0 text-[#0400FF]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
