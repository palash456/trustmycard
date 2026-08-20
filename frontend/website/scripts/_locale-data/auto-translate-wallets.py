#!/usr/bin/env python3
"""Generate wallet-*.mjs locale files from EN_WALLET via Google Translate."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parent

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


def translate_value(translator: GoogleTranslator, value: object) -> object:
    if isinstance(value, str):
        if value in {"Tron", "Ethereum", "Polygon", "BNB Chain", "Avalanche", "Arbitrum", "Base", "Solana", "WalletConnect", "USDT", "USDC"}:
            return value
        ptext, ph = protect_placeholders(value)
        try:
            translated = translator.translate(ptext)
        except Exception:
            return value
        return restore_placeholders(translated, ph)
    if isinstance(value, list):
        return [translate_value(translator, item) for item in value]
    return value


def load_en_wallet() -> dict:
    en_path = ROOT / "en-wallet-export.json"
    if not en_path.exists():
        raise SystemExit("Run export-en-wallet.mjs first")
    with open(en_path, encoding="utf-8") as f:
        return json.load(f)


def to_mjs_export(code: str, wallet: dict) -> str:
    body = json.dumps(wallet, ensure_ascii=False, indent=2)
    const_name = f"WALLET_{code.upper()}"
    return f"export const {const_name} = {body};\n"


def main() -> None:
    en_wallet = load_en_wallet()

    for code, google_code in LOCALE_TARGETS.items():
        print(f"Translating wallet {code}...")
        translator = GoogleTranslator(source="en", target=google_code)
        translated: dict = {}
        for key, value in en_wallet.items():
            translated[key] = translate_value(translator, value)
            time.sleep(0.05)

        out_path = ROOT / f"wallet-{code}.mjs"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(to_mjs_export(code, translated))
        print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
