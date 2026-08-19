"use client";

import Image from "next/image";
import { useTranslation } from "@/lib/i18n/I18nProvider";

const DOWNLOAD_ICONS = [
  "/icons/download/apple.svg",
  "/icons/download/chrome.svg",
  "/icons/download/android.svg",
  "/icons/download/google-play.png",
] as const;

export function DownloadChips() {
  const { t, tRaw } = useTranslation();
  const items =
    tRaw<Array<{ label: string; iconAlt: string }>>("footer.download.items") ??
    [];

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-[#131520]">
        {t("footer.download.title")}
      </h3>
      <div className="mt-3 flex flex-col gap-2.5">
      {items.map(({ label, iconAlt }, index) => (
        <button
          key={label}
          type="button"
          className="group inline-flex w-full items-center justify-start gap-2.5 rounded-full border border-[#ECECEF] bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#131520] shadow-[0_1px_2px_rgba(19,21,32,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0400FF]/25 hover:bg-[#0400FF]/[0.03] hover:text-[#0400FF] hover:shadow-[0_8px_20px_rgba(4,0,255,0.1)]"
        >
          <Image
            src={DOWNLOAD_ICONS[index] ?? DOWNLOAD_ICONS[0]}
            alt={iconAlt}
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 object-contain transition-transform duration-200 group-hover:scale-110"
          />
          <span>{label}</span>
        </button>
      ))}
      </div>
    </div>
  );
}
