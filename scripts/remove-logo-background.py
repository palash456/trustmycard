#!/usr/bin/env python3
"""Remove neutral black/dark gray backgrounds from PNG logos (keeps chromatic pixels)."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def remove_neutral_dark_bg(
    im: Image.Image,
    *,
    max_luma: int = 55,
    max_chroma: int = 14,
) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            mx = max(r, g, b)
            chroma = mx - min(r, g, b)
            if mx <= max_luma and chroma <= max_chroma:
                px[x, y] = (r, g, b, 0)
    return im


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path, nargs="?", default=None)
    parser.add_argument("--max-luma", type=int, default=55)
    parser.add_argument("--max-chroma", type=int, default=14)
    args = parser.parse_args()
    out_path = args.output or args.input
    out_path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(args.input)
    result = remove_neutral_dark_bg(
        im,
        max_luma=args.max_luma,
        max_chroma=args.max_chroma,
    )
    result.save(out_path, "PNG")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
