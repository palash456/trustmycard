#!/usr/bin/env python3
"""Generate translation-arrays/*.json from English via Google Translate."""
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
    "de": "de",
    "es": "es",
    "fr": "fr",
    "hi": "hi",
    "ja": "ja",
    "ko": "ko",
    "pt": "pt",
    "ru": "ru",
    "tr": "tr",
    "uk": "uk",
    "zh": "zh-CN",
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


def translate_batch(translator: GoogleTranslator, texts: list[str]) -> list[str]:
    protected: list[tuple[str, list[str]]] = []
    to_translate: list[str] = []
    indices: list[int] = []

    for i, text in enumerate(texts):
        if should_skip(text):
            protected.append((text, []))
            continue
        ptext, ph = protect_placeholders(text)
        protected.append((ptext, ph))
        to_translate.append(ptext)
        indices.append(i)

    if not to_translate:
        return texts

    translated_map: dict[int, str] = {}
    chunk_size = 40
    for start in range(0, len(to_translate), chunk_size):
        chunk = to_translate[start:start + chunk_size]
        chunk_indices = indices[start:start + chunk_size]
        try:
            result = translator.translate_batch(chunk)
        except Exception:
            for offset, original in enumerate(chunk):
                try:
                    result_one = translator.translate(original)
                except Exception:
                    result_one = texts[chunk_indices[offset]]
                translated_map[chunk_indices[offset]] = result_one
            time.sleep(0.5)
            continue

        for offset, translated in enumerate(result):
            idx = chunk_indices[offset]
            _, ph = protected[idx]
            translated_map[idx] = restore_placeholders(translated, ph)
        time.sleep(0.3)

    out: list[str] = []
    for i, (original, ph) in enumerate(protected):
        if i in translated_map:
            out.append(translated_map[i])
        else:
            out.append(original)
    return out


def main() -> None:
    with open(ROOT / "translatable-strings.json", encoding="utf-8") as f:
        source = json.load(f)

    for code, google_code in LOCALE_TARGETS.items():
        print(f"Translating {code} ({google_code})...")
        translator = GoogleTranslator(source="en", target=google_code)
        translated = translate_batch(translator, source)
        if len(translated) != len(source):
            raise SystemExit(f"{code}: length mismatch")
        path = OUT / f"{code}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(translated, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
