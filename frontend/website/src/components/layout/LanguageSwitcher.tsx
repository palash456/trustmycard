"use client";

const languages = [
  { code: "en", label: "English" },
];

export default function LanguageSwitcher() {
  return (
    <select className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium">
      {languages.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </select>
  );
}