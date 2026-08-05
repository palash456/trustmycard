"use client";

import Image from "next/image";

const DOWNLOAD_BUTTONS = [
  {
    label: "Download for iOS",
    icon: "/icons/download/apple.svg",
    iconAlt: "Apple",
  },
  {
    label: "Download Extension",
    icon: "/icons/download/chrome.svg",
    iconAlt: "Google Chrome",
  },
  {
    label: "Download APK",
    icon: "/icons/download/android.svg",
    iconAlt: "Android",
  },
  {
    label: "Download for Android",
    icon: "/icons/download/google-play.png",
    iconAlt: "Google Play",
  },
] as const;

export function DownloadChips() {
  return (
    <div className="mt-6 flex flex-col gap-2.5">
      {DOWNLOAD_BUTTONS.map(({ label, icon, iconAlt }) => (
        <button
          key={label}
          type="button"
          className="group inline-flex w-full items-center justify-start gap-2.5 rounded-full border border-[#ECECEF] bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#131520] shadow-[0_1px_2px_rgba(19,21,32,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0400FF]/25 hover:bg-[#0400FF]/[0.03] hover:text-[#0400FF] hover:shadow-[0_8px_20px_rgba(4,0,255,0.1)]"
        >
          <Image
            src={icon}
            alt={iconAlt}
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 object-contain transition-transform duration-200 group-hover:scale-110"
          />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
