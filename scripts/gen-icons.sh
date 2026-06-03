#!/usr/bin/env bash
set -euo pipefail

# Generate Tauri app icons from the source images in icon/ and sync them
# into src-tauri/icons/.
#
#   icon/popmark.png   -> full app icon set (via `tauri icon`)
#   icon/tray-icon.png -> src-tauri/icons/tray-icon.png (used by src-tauri/src/lib.rs)

# --- Move to repository root ---
cd "$(dirname "$0")/.."

APP_ICON_SRC="icon/popmark.png"
TRAY_ICON_SRC="icon/tray-icon.png"
TRAY_ICON_DEST="src-tauri/icons/tray-icon.png"

# --- Validate source images ---
if [[ ! -f "$APP_ICON_SRC" ]]; then
  echo "Error: app icon source not found: $APP_ICON_SRC" >&2
  exit 1
fi
if [[ ! -f "$TRAY_ICON_SRC" ]]; then
  echo "Error: tray icon source not found: $TRAY_ICON_SRC" >&2
  exit 1
fi

# --- Generate the app icon set into src-tauri/icons/ ---
echo "Generating app icons from ${APP_ICON_SRC} ..."
npm run tauri -- icon "$APP_ICON_SRC"

# --- Sync the tray icon (not produced by `tauri icon`) ---
echo "Copying tray icon ${TRAY_ICON_SRC} -> ${TRAY_ICON_DEST} ..."
cp "$TRAY_ICON_SRC" "$TRAY_ICON_DEST"

echo ""
echo "Done! Icons updated in src-tauri/icons/"
