# popmark — Development Roadmap

## Overview

This roadmap defines the staged development plan for popmark, a macOS menu bar Markdown scratch pad. Each stage results in a runnable, testable state. Core value is delivered at Stage 1; later stages add secondary features and polish.

**Tech stack:** Tauri 2.x (Rust) + React 18 + Vite + Lexical + Tailwind CSS

## Stage Overview

```
Stage 0: Project Bootstrap
Stage 1: Core Editor Loop  ← primary milestone (MVP)
Stage 2: Menu Bar Agent
Stage 3: History Panel
Stage 4: Settings & Polish
Stage 5: Release Prep
```

Dependencies: `Stage 0 → Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 5`

---

## Stage 0: Project Bootstrap

**Goal:** Working skeleton — Tauri window launches, Lexical renders an editable text area.

### Tasks
- `npm create tauri-app@latest` with React + TypeScript template
- Add Tailwind CSS via `@tailwindcss/vite`
- Add Lexical minimum config (`LexicalComposer` + `RichTextPlugin`)
- Window: 700×500px, `decorations: false`, visible during development
- Verify Tauri 2.x plugin permission system (`capabilities/`) works

### Files to create
- `src-tauri/tauri.conf.json` — window config, plugin permissions, bundle settings
- `src/main.tsx`, `src/App.tsx` — React entry point
- `src/editor/MarkdownEditor.tsx` — Lexical skeleton

### Notes
- Tauri 2.x uses `TrayIcon` API (v1's `SystemTray` is removed)
- Plugin permissions must be declared in `capabilities/` JSON files — easy to miss

### Verification
`npm run tauri dev` opens a window with an editable text area.

---

## Stage 1: Core Editor Loop (MVP)

**Goal:** The primary value flow works — write Markdown → Copy & Close → content on clipboard. The app is usable as a daily tool after this stage.

### Tasks

**Rust (`src-tauri/src/`)**
- `main.rs`: register global shortcut (⌥Space), window show/hide toggle, set `LSUIElement` in Info.plist
- `commands.rs`: implement `get_draft`, `save_draft`, `copy_and_close`
- File I/O for `draft.md` under `app_data_dir()` (`~/Library/Application Support/popmark/`)
- Add `tauri-plugin-clipboard-manager` and `tauri-plugin-global-shortcut`

**React/TypeScript (`src/`)**
- Lexical with `MarkdownShortcutPlugin` + `TRANSFORMERS` for all supported elements (H1–H6, bold, italic, strikethrough, inline code, code block, blockquote, lists, HR, links)
- Auto-save: `onChange` → 500ms debounce → `invoke('save_draft', { content })`
- `useDraft` hook: on mount, `get_draft` → `$convertFromMarkdownString`
- Copy & Close handler: `$convertToMarkdownString` → `invoke('copy_and_close', { content })`
- ⌘Return keybind for Copy & Close

### Lexical styling approach

Start with **standard styled-only WYSIWYG** (markers hidden, Markdown rendered visually). This is the default behavior of `MarkdownShortcutPlugin` and significantly reduces complexity.

Migrate to source-visible style (Obsidian-style: markers visible + styled simultaneously) in a later iteration after core functionality is stable, using custom `TextNode` or `DecoratorNode`.

### Verification
- Type Markdown → ⌘Return → clipboard contains Markdown text
- ⌥Space toggles the window
- Closing and re-opening the window restores the draft

---

## Stage 2: Menu Bar Agent

**Goal:** Runs as a proper macOS menu bar app — no Dock icon, tray icon with dropdown menu.

### Tasks

**Rust**
- `TrayIconBuilder`: app icon + menu items (Show Editor, Export…, Quit popmark)
- Handle `close_requested` event to hide window instead of quitting
- `export_file` IPC: `tauri-plugin-dialog` save dialog + write file

**React**
- Toolbar Export… button → `invoke('export_file', { content, defaultName })`
- Re-fetch draft on window focus

### Verification
- App runs without a Dock icon
- Tray icon is visible in the menu bar
- Closing the window hides it (does not quit the app)
- Export… saves a `.md` file via the native save dialog

---

## Stage 3: History Panel

**Goal:** Past Copy & Close documents are accessible and can be reloaded into the editor.

### Tasks

**Rust**
- Extend `copy_and_close`: write `history/<ISO8601>.md` and update `index.json`
- `list_history` IPC: return ordered `Vec<{id, timestamp, title_preview}>` from `index.json`
- `get_history_entry` IPC: return file content by id

**React**
- `HistoryPanel` component: slides in from the left (Tailwind `translate-x` transition)
- `useHistory` hook: `list_history` for the list, `get_history_entry` for content
- Confirmation dialog when loading a history entry with a non-empty draft
- History toolbar button and menu bar "History…" item

### Data layout
```
~/Library/Application Support/popmark/history/
├── index.json          ← [{id, timestamp, title_preview}, ...]
├── 2024-03-14T09-41-00.md
└── ...
```

### Verification
- Copy & Close saves a file to `history/` and updates `index.json`
- History button shows entries in reverse-chronological order
- Clicking an entry loads its content into the editor

---

## Stage 4: Settings & Polish

**Goal:** User-configurable settings, dark mode support, and UX polish.

### Tasks

**Rust**
- `get_settings` / `save_settings` IPC: read/write `settings.json` with fallback defaults
- Dynamic hotkey re-registration: unregister old shortcut → register new one on save
- `tauri-plugin-autostart`: enable/disable launch at login

**React**
- `SettingsPanel`: hotkey capture input field, launch-at-login toggle
- Tailwind dark mode (`darkMode: 'media'`) following system preference
- Auto-focus editor when the window is shown
- Empty state UX (placeholder text in editor, empty history message)

### Verification
- Changing the hotkey in settings makes the new key combination work
- Dark mode follows the macOS system appearance setting
- Launch at login toggle registers/unregisters the app as a login item

---

## Stage 5: Release Prep

**Goal:** Produce a distributable, notarized macOS `.dmg` / `.app`.

### Tasks
- Generate app icon (`tauri icon` converts PNG → all required sizes including `.icns`)
- Complete `tauri.conf.json` bundle settings: `identifier`, `category`, `copyright`
- Code signing with Apple Developer ID
- Notarization via `xcrun notarytool`
- Align versions across `Cargo.toml`, `tauri.conf.json`, and `package.json`
- Review all IPC commands: ensure consistent `Result<T, String>` return types

### Verification
`npm run tauri build` produces a notarized `.dmg` that installs and runs on a clean macOS machine.

---

## IPC Command Reference

| Command | Direction | Introduced |
|---------|-----------|------------|
| `get_draft` | Rust → React | Stage 1 |
| `save_draft` | React → Rust | Stage 1 |
| `copy_and_close` | React → Rust | Stage 1 (extended in Stage 3) |
| `export_file` | React → Rust | Stage 2 |
| `list_history` | Rust → React | Stage 3 |
| `get_history_entry` | Rust → React | Stage 3 |
| `get_settings` | Rust → React | Stage 4 |
| `save_settings` | React → Rust | Stage 4 |

---

## Estimated Effort (solo developer)

| Stage | Estimate |
|-------|----------|
| 0 — Bootstrap | 0.5 day |
| 1 — Core Editor Loop | 4–6 days |
| 2 — Menu Bar Agent | 1–2 days |
| 3 — History Panel | 2–3 days |
| 4 — Settings & Polish | 2–3 days |
| 5 — Release Prep | 1–2 days |
| **Total** | **~11–17 days** |
