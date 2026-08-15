#!/usr/bin/env python3
"""Re-translate strings that still match English in translation arrays."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "translation-arrays"

LOCALE_TARGETS = {
    "ar": "ar",
    "ru": "ru",
    "uk": "uk",
    "tr": "tr",
    "ja": "ja",
    "zh": "zh-CN",
    "pt": "pt",
    "hi": "hi",
}

PLACEHOLDER_RE = re.compile(r"(\{[a-zA-Z_]+\}|%s)")

SKIP_TRANSLATE = {
    "Apple",
    "Android",
    "Apple Pay",
    "Google Pay",
    "BSC",
    "Tron",
    "Ethereum",
    "Polygon",
    "BNB Chain",
    "Avalanche",
    "Arbitrum",
    "Base",
    "Solana",
    "WalletConnect",
    "USDT",
    "USDC",
    "BTC",
    "ETH",
    "Visa",
    "Mastercard",
    "FDIC",
    "SIPC",
    "ISO 27001",
    "ISO 27701",
    "AML",
    "KYC",
    "APK",
    "iOS",
    "DNB",
    "EMI",
    "Tether",
    "Coinbase",
    "DeFi",
    "EVM",
    "L2",
    "dApps",
    "#",
    "1%",
    "2%",
    "3%",
    "Cancel",
    "Continue",
    "Close",
    "Premium",
    "Black",
    "Silver",
    "Metal",
}


def protect_placeholders(text: str) -> tuple[str, list[str]]:
    placeholders: list[str] = []

    def repl(match: re.Match[str]) -> str:
        placeholders.append(match.group(0))
        return f"__PH{len(placeholders) - 1}__"

    return PLACEHOLDER_RE.sub(repl, text), placeholders


def restore_placeholders(text: str, placeholders: list[str]) -> str:
    for index, ph in enumerate(placeholders):
        text = text.replace(f"__PH{index}__", ph)
    return text


def should_skip(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    if stripped in SKIP_TRANSLATE:
        return True
    if stripped.startswith("/") or stripped.startswith("http"):
        return True
    if re.fullmatch(r"[\d\s\.\,\%\#\·\-]+", stripped):
        return True
    return False


def main() -> None:
    with open(ROOT / "translatable-strings.json", encoding="utf-8") as f:
        source = json.load(f)

    for code, google_code in LOCALE_TARGETS.items():
        path = OUT / f"{code}.json"
        with open(path, encoding="utf-8") as f:
            arr = json.load(f)

        translator = GoogleTranslator(source="en", target=google_code)
        fixed = 0

        for i, (en_text, current) in enumerate(zip(source, arr)):
            if en_text != current:
                continue
            if should_skip(en_text):
                continue
            ptext, ph = protect_placeholders(en_text)
            try:
                translated = translator.translate(ptext)
                translated = restore_placeholders(translated, ph)
                if translated and translated != en_text:
                    arr[i] = translated
                    fixed += 1
            except Exception:
                pass
            time.sleep(0.08)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(arr, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{code}: fixed {fixed} strings")


if __name__ == "__main__":
    main()
