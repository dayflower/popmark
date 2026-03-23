#!/bin/bash
# NOTE: This script requires macOS (uses sips and iconutil).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/icon/popmark.png"
OUT="$ROOT/src-tauri/icons"

[ -f "$SRC" ] || { echo "Error: $SRC not found"; exit 1; }
mkdir -p "$OUT"

echo "Generating PNG files..."
sips --resampleHeightWidth 512 512   "$SRC" --out "$OUT/icon.png"              > /dev/null
sips --resampleHeightWidth 32  32    "$SRC" --out "$OUT/32x32.png"             > /dev/null
sips --resampleHeightWidth 256 256   "$SRC" --out "$OUT/128x128@2x.png"        > /dev/null
sips --resampleHeightWidth 128 128   "$SRC" --out "$OUT/128x128.png"           > /dev/null
sips --resampleHeightWidth 30  30    "$SRC" --out "$OUT/Square30x30Logo.png"   > /dev/null
sips --resampleHeightWidth 44  44    "$SRC" --out "$OUT/Square44x44Logo.png"   > /dev/null
sips --resampleHeightWidth 71  71    "$SRC" --out "$OUT/Square71x71Logo.png"   > /dev/null
sips --resampleHeightWidth 89  89    "$SRC" --out "$OUT/Square89x89Logo.png"   > /dev/null
sips --resampleHeightWidth 107 107   "$SRC" --out "$OUT/Square107x107Logo.png" > /dev/null
sips --resampleHeightWidth 142 142   "$SRC" --out "$OUT/Square142x142Logo.png" > /dev/null
sips --resampleHeightWidth 150 150   "$SRC" --out "$OUT/Square150x150Logo.png" > /dev/null
sips --resampleHeightWidth 284 284   "$SRC" --out "$OUT/Square284x284Logo.png" > /dev/null
sips --resampleHeightWidth 310 310   "$SRC" --out "$OUT/Square310x310Logo.png" > /dev/null
sips --resampleHeightWidth 50  50    "$SRC" --out "$OUT/StoreLogo.png"         > /dev/null

echo "Generating ICNS..."
bash "$(dirname "$0")/gen-icons-icns.sh" "$SRC" "$OUT/icon.icns"

echo "Generating ICO..."
python3 "$(dirname "$0")/gen-icons-ico.py" "$SRC" "$OUT/icon.ico"

echo "Done."
