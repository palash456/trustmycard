#!/usr/bin/env python3
"""Write remaining locale translation arrays (fr, ko, ja, pt, ar, hi, tr, ru, uk, zh)."""
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "translation-arrays")
T = json.load(open(os.path.join(ROOT, "translatable-strings.json")))

def save(code, arr):
    assert len(arr) == len(T), f"{code}: {len(arr)} vs {len(T)}"
    json.dump(arr, open(os.path.join(OUT, f"{code}.json"), "w"), ensure_ascii=False, indent=2)
    print("wrote", code)

# Import locale data from separate module to keep this file manageable
from locale_batch_data import LOCALES  # noqa: E402

for code, arr in LOCALES.items():
    save(code, arr)
