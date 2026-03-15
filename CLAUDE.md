# Project Overview

**popmark** is a macOS menu-bar Markdown scratch-pad built with Tauri 2.x (Rust) + React 19 + Lexical + Tailwind CSS 4. The intended workflow: open with a global hotkey → write Markdown → "Copy & Close" to copy to clipboard. See `docs/REQUIREMENTS.md` for feature scope and `docs/SPEC.md` for technical architecture decisions and planned Tauri IPC API.

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
