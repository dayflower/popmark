#!/usr/bin/env bash
set -euo pipefail

# Submits the built .dmg to Apple's notary service and staples the resulting
# ticket into it, so Gatekeeper accepts the disk image on machines that have
# never seen it and without network access.
#
# Tauri's bundler already signs, notarizes and staples the .app itself, but it
# only *signs* the .dmg — see crates/tauri-bundler/src/bundle/macos/dmg/mod.rs,
# which calls sign() and never notarize(). A signed-but-not-notarized disk image
# is still blocked by Gatekeeper when downloaded, hence this extra step.
#
# The .dmg must already have been produced by `tauri bundle` with a Developer ID
# identity in APPLE_SIGNING_IDENTITY.
#
# Credentials come from an App Store Connect API key:
#   APPLE_API_KEY       Key ID of the key
#   APPLE_API_ISSUER    Issuer ID of the team
#   APPLE_API_KEY_PATH  Path to the AuthKey_*.p8 private key
# These are the same variable names Tauri itself reads, so the bundle step and
# this script share one set of environment variables.

# --- Move to repository root ---
cd "$(dirname "$0")/.."

: "${APPLE_API_KEY:?APPLE_API_KEY is required}"
: "${APPLE_API_ISSUER:?APPLE_API_ISSUER is required}"
: "${APPLE_API_KEY_PATH:?APPLE_API_KEY_PATH is required}"

DMG_DIR="src-tauri/target/release/bundle/dmg"

shopt -s nullglob
dmgs=("$DMG_DIR"/*.dmg)
shopt -u nullglob

if [[ ${#dmgs[@]} -eq 0 ]]; then
  echo "Error: no .dmg found in $DMG_DIR; run \`tauri bundle\` first" >&2
  exit 1
fi
if [[ ${#dmgs[@]} -gt 1 ]]; then
  echo "Error: expected exactly one .dmg in $DMG_DIR, found: ${dmgs[*]}" >&2
  exit 1
fi

dmg="${dmgs[0]}"

# --wait exits non-zero unless the submission comes back Accepted. It prints the
# submission id, so `xcrun notarytool log <id> --key ...` explains a rejection.
xcrun notarytool submit "$dmg" \
  --key "$APPLE_API_KEY_PATH" \
  --key-id "$APPLE_API_KEY" \
  --issuer "$APPLE_API_ISSUER" \
  --wait

xcrun stapler staple "$dmg"
# Confirm Gatekeeper would accept the image from the stapled ticket alone.
xcrun stapler validate "$dmg"

echo "notarized $dmg"
