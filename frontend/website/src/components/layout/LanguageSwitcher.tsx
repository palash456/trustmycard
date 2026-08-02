interface LanguageSwitcherProps {
    value: string;
    options: string[];
    onChange?: (value: string) => void;
}

export default function LanguageSwitcher({
    value,
    options,
    onChange,
}: LanguageSwitcherProps) {
    return (
        <select
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
            {options.map((language) => (
                <option key={language} value={language}>
                    {language.toUpperCase()}
                </option>
            ))}
        </select>
    );
}