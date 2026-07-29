# Development Guide

## Prerequisites

- [Node.js](https://nodejs.org/) LTS
- [Rust](https://rustup.rs/) stable (via rustup)
- Xcode Command Line Tools (`xcode-select --install`)
- [GitHub CLI](https://cli.github.com/) (`gh`) — required for the release script

## Local Development

```sh
# Install frontend dependencies
npm ci

# Start dev server (Rust + Vite HMR)
npm run tauri dev
```

## CI/CD Overview

| Trigger | Workflow | What it does |
|---------|----------|--------------|
| PR to `main`, push to `main` | CI | Lint, type-check, build (frontend + Rust) via the reusable `check.yml` |
| push to `main` | Release | If the version was bumped, build, sign and notarize the macOS app, publish a GitHub Release with `.zip` and `.dmg`, and open a PR against [dayflower/homebrew-tap](https://github.com/dayflower/homebrew-tap) |

The Release workflow first runs a cheap `check-version` job on Linux: it verifies that all three version files (`package.json`, `Cargo.toml`, `tauri.conf.json`) agree, and checks whether the tag `vX.Y.Z` already exists. The macOS build job only starts when the tag is missing, so ordinary pushes to `main` cost nothing.

The tag itself is created last, as a side effect of `gh release create --target`. A run that fails part-way through — a rejected notarization, for instance — therefore leaves no tag behind, and pushing a fix to `main` retries the whole release. Because nothing has to be chained across workflows, the default `GITHUB_TOKEN` is sufficient; no PAT is involved.

## Code Signing and Notarization

Release builds are signed with a Developer ID Application certificate and notarized by Apple, so the distributed `.app` and `.dmg` open without a Gatekeeper override. Tauri's bundler signs the `.app` with the hardened runtime (`bundle.macOS.hardenedRuntime` defaults to `true`), notarizes it and staples the ticket; it only *signs* the `.dmg`, so `scripts/notarize-dmg.sh` notarizes and staples the disk image separately.

Tauri warns and continues when the notarization credentials are missing, rather than failing. The workflow's "Verify signature and notarization" step (`codesign --verify`, `xcrun stapler validate`, `spctl --assess`) is what actually prevents an unsigned or unnotarized build from being published.

### Required repository secrets

| Secret | Contents |
|--------|----------|
| `MACOS_CERTIFICATE_P12` | base64 of the Developer ID Application `.p12` |
| `MACOS_CERTIFICATE_PASSWORD` | Password of that `.p12` |
| `APPLE_API_KEY_ID` | App Store Connect API key ID |
| `APPLE_API_ISSUER_ID` | App Store Connect issuer ID |
| `APPLE_API_KEY_P8` | base64 of the `AuthKey_*.p8` private key |
| `HOMEBREW_GITHUB_API_TOKEN` | Token used to open the PR against the tap repository |

The certificate's common name is never stored: the workflow resolves the identity from the imported keychain by its SHA-1 hash (`security find-identity -v -p codesigning`).

### Preparing the secrets

Export the Developer ID Application certificate together with its private key from Keychain Access as a `.p12`, then:

```sh
base64 -i DeveloperID.p12 | pbcopy
```

Create an App Store Connect API key with the *Developer* role at [App Store Connect → Users and Access → Integrations](https://appstoreconnect.apple.com/access/integrations/api), note its Key ID and Issuer ID, download the `AuthKey_*.p8` (downloadable only once), and:

```sh
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
```

### Debugging a failed notarization

`xcrun notarytool submit --wait` prints a submission ID on rejection. Feed it back to the log command with the same credentials:

```sh
xcrun notarytool log <submission-id> \
  --key ~/.appstoreconnect/private_keys/AuthKey_<key-id>.p8 \
  --key-id <key-id> --issuer <issuer-id>
```

## Release Procedure

### 1. Bump version

Run the version bump script from the `main` branch with a clean working tree:

```sh
scripts/bump-version.sh patch   # 0.1.2 → 0.1.3
scripts/bump-version.sh minor   # 0.1.2 → 0.2.0
scripts/bump-version.sh major   # 0.1.2 → 1.0.0
```

This script:
- Updates the version in `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`, and `tauri.conf.json`
- Creates a `release/vX.Y.Z` branch, commits, and pushes it
- Opens a PR with auto-merge enabled (squash)

### 2. Wait for the version bump PR to merge

CI must pass for auto-merge to proceed. Once the PR merges to `main`, the Release
workflow notices the new version and runs the whole release end to end. No manual
tagging is required — the `vX.Y.Z` tag is created at the very end, together with
the release.

The resulting GitHub Release includes:
- `popmark-X.Y.Z-macos.zip` — `.app` bundle (for Homebrew)
- `popmark-X.Y.Z-macos.dmg` — disk image (for direct download)

Notarization adds several minutes to the run, and Apple's notary service can be
slow or reject a submission. If the run fails, no tag is left behind: fix the
problem, push to `main`, and the release is attempted again for the same version.

### 3. Verify release artifacts

- Confirm the GitHub Release is created with both assets attached.
- The same job opens a PR against `dayflower/homebrew-tap` — review and merge it.
- Optionally re-check the published artifacts locally:

  ```sh
  spctl --assess --type execute --verbose=4 /Applications/Popmark.app
  ```
