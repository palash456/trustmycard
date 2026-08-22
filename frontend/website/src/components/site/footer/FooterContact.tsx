"use client";

import { useTranslation } from "@/lib/i18n/I18nProvider";

/** Reads NEXT_PUBLIC_* env vars baked at build time — safe in a client component. */
function contactConfig() {
  return {
    legalName: process.env.NEXT_PUBLIC_LEGAL_NAME?.trim() ?? "",
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "",
  };
}

export function FooterContact() {
  const { t } = useTranslation();
  const { legalName, supportEmail } = contactConfig();

  if (!legalName && !supportEmail) return null;

  return (
    <div className="min-w-0 lg:flex-1">
      <h3 className="text-sm font-semibold text-[#131520]">
        {t("footer.contact.title")}
      </h3>
      <ul className="mt-4 space-y-3 text-sm text-[#6A6D81]">
        {legalName ? (
          <li>
            <span className="font-medium text-[#131520]">
              {t("footer.contact.legalEntity")}
            </span>
            <p className="mt-1 leading-relaxed">{legalName}</p>
          </li>
        ) : null}
        {supportEmail ? (
          <li>
            <span className="font-medium text-[#131520]">
              {t("footer.contact.support")}
            </span>
            <p className="mt-1">
              <a
                href={`mailto:${supportEmail}`}
                className="text-[#0400FF] underline-offset-2 hover:underline"
              >
                {supportEmail}
              </a>
            </p>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
