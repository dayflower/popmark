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
| push / PR to `main` | CI | Lint, type-check, build (frontend + Rust) |
| push of `vX.Y.Z` tag | Release | Build macOS app, publish GitHub Release with `.zip` and `.dmg` |
| GitHub Release published | Update Homebrew tap | Opens a PR against [dayflower/homebrew-tap](https://github.com/dayflower/homebrew-tap) |

The release workflow verifies that all three version files (`package.json`, `Cargo.toml`, `tauri.conf.json`) match the tag before building. If any mismatch is detected, the build fails.

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

CI must pass for auto-merge to proceed. Once merged, sync `main`:

```sh
git checkout main && git pull
```

### 3. Push the release tag

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
```

Pushing the tag triggers the Release workflow. The resulting GitHub Release includes:
- `popmark-X.Y.Z-macos.zip` — `.app` bundle (for Homebrew)
- `popmark-X.Y.Z-macos.dmg` — disk image (for direct download)

### 4. Verify release artifacts

- Confirm the GitHub Release is created with both assets attached.
- The Homebrew tap workflow opens a PR against `dayflower/homebrew-tap` automatically — review and merge it.
