#!/bin/bash
# NOTE: This script requires macOS (uses sips and iconutil).
set -euo pipefail

SRC="$1"
DST="$2"

ICONSET="$(mktemp -d)/popmark.iconset"
mkdir -p "$ICONSET"

# Generate each unique size once (7 sips calls)
sips --resampleHeightWidth 16   16   "$SRC" --out "$ICONSET/icon_16x16.png"      > /dev/null
sips --resampleHeightWidth 32   32   "$SRC" --out "$ICONSET/icon_16x16@2x.png"   > /dev/null
sips --resampleHeightWidth 64   64   "$SRC" --out "$ICONSET/icon_32x32@2x.png"   > /dev/null
sips --resampleHeightWidth 128  128  "$SRC" --out "$ICONSET/icon_128x128.png"    > /dev/null
sips --resampleHeightWidth 256  256  "$SRC" --out "$ICONSET/icon_128x128@2x.png" > /dev/null
sips --resampleHeightWidth 512  512  "$SRC" --out "$ICONSET/icon_256x256@2x.png" > /dev/null
sips --resampleHeightWidth 1024 1024 "$SRC" --out "$ICONSET/icon_512x512@2x.png" > /dev/null

# Reuse duplicate sizes
cp "$ICONSET/icon_16x16@2x.png"   "$ICONSET/icon_32x32.png"
cp "$ICONSET/icon_128x128@2x.png" "$ICONSET/icon_256x256.png"
cp "$ICONSET/icon_256x256@2x.png" "$ICONSET/icon_512x512.png"

iconutil -c icns "$ICONSET" -o "$DST"
rm -rf "$(dirname "$ICONSET")"
