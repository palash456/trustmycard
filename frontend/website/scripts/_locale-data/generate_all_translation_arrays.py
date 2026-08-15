#!/usr/bin/env python3
"""Generate translation-arrays/*.json for all non-EN locales."""
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "_locale-data")
OUT = os.path.join(DATA, "translation-arrays")
os.makedirs(OUT, exist_ok=True)

with open(os.path.join(DATA, "translatable-strings.json")) as f:
    T = json.load(f)

# Each locale: list of 243 strings aligned to translatable-strings.json
from locale_arrays import ARRAYS  # noqa: E402

for code, arr in ARRAYS.items():
    if len(arr) != len(T):
        raise SystemExit(f"{code}: expected {len(T)} strings, got {len(arr)}")
    path = os.path.join(OUT, f"{code}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(arr, f, ensure_ascii=False, indent=2)
    print(f"wrote {path}")

# translation-arrays.mjs
imports = "\n".join(
    f'import {code} from "./translation-arrays/{code}.json" assert {{ type: "json" }};'
    for code in ARRAYS
)
exports = "export const TRANSLATION_ARRAYS = {\n" + ",\n".join(
    f"  {code}" for code in ARRAYS
) + ",\n};\n"
with open(os.path.join(DATA, "translation-arrays.mjs"), "w", encoding="utf-8") as f:
    f.write(imports + "\n\n" + exports)
print("wrote translation-arrays.mjs")
