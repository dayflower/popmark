#!/usr/bin/env python3
"""Generate icon.ico from a source PNG using only stdlib (no Pillow).
NOTE: Requires sips (macOS).
"""

import struct
import subprocess
import sys
import tempfile
import os

ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]


def resize_png(src: str, size: int) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        tmp = f.name
    try:
        subprocess.run(
            ["sips", "--resampleHeightWidth", str(size), str(size), src, "--out", tmp],
            check=True,
            capture_output=True,
        )
        with open(tmp, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp)


def build_ico(images: list[tuple[int, bytes]]) -> bytes:
    n = len(images)
    header = struct.pack("<HHH", 0, 1, n)
    dir_size = 6 + 16 * n
    offset = dir_size
    entries = []
    for size, data in images:
        entries.append((size, data, offset))
        offset += len(data)
    directory = b""
    for size, data, off in entries:
        w = h = 0 if size >= 256 else size
        directory += struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(data), off)
    return header + directory + b"".join(data for _, data, _ in entries)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    images = [(s, resize_png(src, s)) for s in ICO_SIZES]
    with open(dst, "wb") as f:
        f.write(build_ico(images))


if __name__ == "__main__":
    main()
