#!/usr/bin/env python3
"""Generate partial-translations.mjs from embedded locale maps."""
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "_locale-data")
with open(os.path.join(DATA, "en-strings.json")) as f:
    EN_STRINGS = json.load(f)
with open(os.path.join(DATA, "translatable-strings.json")) as f:
    TRANSLATABLE = json.load(f)

# Import locale maps from generated data file
from translation_maps import MAPS  # noqa: E402

PARTIAL = {}
for code, mapping in MAPS.items():
    PARTIAL[code] = {s: mapping.get(s, s) for s in EN_STRINGS}

out = os.path.join(DATA, "partial-translations.mjs")
with open(out, "w", encoding="utf-8") as f:
    f.write("export const PARTIAL = ")
    json.dump(PARTIAL, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print(f"Wrote {out} ({len(PARTIAL)} locales)")
