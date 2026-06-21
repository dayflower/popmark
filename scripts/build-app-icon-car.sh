#!/usr/bin/env bash
set -euo pipefail

# Pre-compile the Liquid Glass app icon (src-tauri/icons/icon.icon) into an
# Assets.car file (src-tauri/icons/icon.car) by invoking actool ourselves.
#
# TEMPORARY WORKAROUND until tauri-apps/tauri#15315 is fixed upstream.
# Tauri's bundler runs actool internally to turn a `.icon` input into
# Assets.car, but that invocation crashes on some `.icon` files / toolchains
# (Apple FB20183399), failing the macOS bundle step. When the icon list already
# contains a `.car` file, the bundler skips actool entirely and just copies it
# (see create_assets_car_file). So we run actool as a standalone step beforehand
# and point bundle.icon at the resulting `.car`. Once the upstream bug is fixed,
# delete this script and point bundle.icon back at `icons/icon.icon`.
#
# The command below mirrors Tauri's own actool invocation exactly: the input is
# copied to a dir named `Icon.icon` and compiled with `--app-icon Icon`, so the
# generated catalog's icon name is `Icon` and the bundler derives the matching
# CFBundleIconName from it.
#
# Requires a full Xcode (not just Command Line Tools) with actool >= 26.

# --- Move to repository root ---
cd "$(dirname "$0")/.."

ICON_SRC="src-tauri/icons/icon.icon"
OUT_CAR="src-tauri/icons/icon.car"

if [[ ! -d "$ICON_SRC" ]]; then
  echo "Error: icon source not found: $ICON_SRC" >&2
  exit 1
fi

if ! command -v actool >/dev/null 2>&1; then
  echo "Error: actool not found. A full Xcode install is required." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cp -R "$ICON_SRC" "$WORK/Icon.icon"
mkdir -p "$WORK/out"

# actool can intermittently fail via a stale ibtoold helper; clear it first.
killall ibtoold >/dev/null 2>&1 || true

echo "Compiling ${ICON_SRC} -> ${OUT_CAR} via actool ..."
actool "$WORK/Icon.icon" \
  --compile "$WORK/out" \
  --output-format human-readable-text \
  --notices --warnings \
  --output-partial-info-plist "$WORK/out/assetcatalog_generated_info.plist" \
  --app-icon Icon \
  --include-all-app-icons \
  --accent-color AccentColor \
  --enable-on-demand-resources NO \
  --development-region en \
  --target-device mac \
  --minimum-deployment-target 26.0 \
  --platform macosx

if [[ ! -f "$WORK/out/Assets.car" ]]; then
  echo "Error: actool did not generate Assets.car" >&2
  exit 1
fi

cp "$WORK/out/Assets.car" "$OUT_CAR"
echo "Done! Generated ${OUT_CAR}"
