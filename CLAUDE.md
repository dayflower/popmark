# Project Overview

**popmark** is a Markdown scratch-pad built with Tauri 2.x (Rust) + React 19 + Lexical + Tailwind CSS 4. The intended workflow: open with a global hotkey → write Markdown → "Copy & Close" to copy to clipboard.

# Commands

```sh
# Start Tauri dev server (Rust + Vite HMR)
npm run tauri dev

# Frontend-only dev (Vite, port 1420)
npm run dev

# Production build
npm run build         # TypeScript check + Vite bundle
npm run tauri build   # Full Tauri app bundle

# Lint & format (Biome)
npm run lint          # check + auto-fix
npm run format        # format only
npm run check         # check without fixing (CI: npm run check:ci)
```

No test framework is set up yet.

# Project Structure

```
src/                       React + Lexical frontend
src-tauri/src/             Tauri app
docs/                      Documents
```

- `docs/REQUIREMENTS.md` — Feature scope and user-facing behavior (the "what")
- `docs/SPEC.md` — Technical architecture, IPC commands, data storage layout (the "how")

When implementing a new feature or changing existing behavior:
1. Update `docs/REQUIREMENTS.md` if the user-facing behavior changes
2. Update `docs/SPEC.md` if the technical design changes (IPC commands, storage, etc.)
