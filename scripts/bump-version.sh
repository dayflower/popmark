#!/usr/bin/env bash
set -euo pipefail

LEVEL="${1:-}"

# --- Validate argument ---
if [[ "$LEVEL" != "major" && "$LEVEL" != "minor" && "$LEVEL" != "patch" ]]; then
  echo "Usage: $0 major|minor|patch" >&2
  exit 1
fi

# --- Must be on main branch ---
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: must be on main branch (currently on '$CURRENT_BRANCH')" >&2
  exit 1
fi

# --- Working tree must be clean ---
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes" >&2
  exit 1
fi

# Pull latest main
git pull --ff-only origin main

# --- Bump package.json + package-lock.json ---
npm version "$LEVEL" --no-git-tag-version

NEW_VERSION="$(jq -r '.version' package.json)"
echo "Bumping to v${NEW_VERSION} ..."

# --- Update src-tauri/Cargo.toml ---
# Replace the `version = "..."` line in the [package] block only
# (dependency versions use inline `{ version = "..." }` syntax, not standalone lines)
sed -i '' "s/^version = \".*\"/version = \"${NEW_VERSION}\"/" src-tauri/Cargo.toml

# --- Update src-tauri/tauri.conf.json ---
jq --arg v "$NEW_VERSION" '.version = $v' src-tauri/tauri.conf.json \
  > src-tauri/tauri.conf.json.tmp \
  && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json

# --- Verify all three match ---
CARGO_VERSION="$(grep '^version = ' src-tauri/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')"
TAURI_VERSION="$(jq -r '.version' src-tauri/tauri.conf.json)"

if [[ "$CARGO_VERSION" != "$NEW_VERSION" || "$TAURI_VERSION" != "$NEW_VERSION" ]]; then
  echo "Error: version mismatch after update!" >&2
  echo "  package.json:           $NEW_VERSION" >&2
  echo "  Cargo.toml:             $CARGO_VERSION" >&2
  echo "  tauri.conf.json:        $TAURI_VERSION" >&2
  exit 1
fi

# --- Create branch, commit, push ---
BRANCH="release/v${NEW_VERSION}"
git checkout -b "$BRANCH"

git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump version to ${NEW_VERSION}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push -u origin "$BRANCH"

# --- Create PR with auto-merge ---
PR_URL="$(gh pr create \
  --title "chore: bump version to v${NEW_VERSION}" \
  --body "$(cat <<EOF
## Version bump: v${NEW_VERSION}

Automated version bump via \`scripts/bump-version.sh ${LEVEL}\`.

### Changed files
- \`package.json\`
- \`package-lock.json\`
- \`src-tauri/Cargo.toml\`
- \`src-tauri/tauri.conf.json\`

### Next step

After this PR is merged, create and push the release tag:

\`\`\`sh
git checkout main && git pull
git tag v${NEW_VERSION}
git push origin v${NEW_VERSION}
\`\`\`
EOF
)")"

echo "PR created: $PR_URL"

# Enable auto-merge (squash) — requires auto-merge to be enabled in repo settings
gh pr merge --auto --squash "$PR_URL"

echo ""
echo "Done! Auto-merge enabled on $PR_URL"
echo "The PR will be merged automatically once CI passes."
