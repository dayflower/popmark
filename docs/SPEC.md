# popmark — Application Specification

## 1. Overview

**popmark** is a macOS menu bar application that provides a quick-access Markdown WYSIWYG editor. The primary workflow is:

1. Press a global shortcut → editor window appears
2. Write Markdown content
3. Press "Copy & Close" → content is copied to clipboard as Markdown, window disappears
4. Past documents remain accessible via a history list

popmark is not a file manager or a notes app. It is a fast scratch pad optimized for drafting Markdown and pushing it to the clipboard.

---

## 2. Architecture

| Layer    | Technology      | Responsibility                                         |
|----------|-----------------|--------------------------------------------------------|
| Shell    | Tauri 2.x (Rust)| Menu bar agent, global hotkey, clipboard, file I/O     |
| UI       | React 18 + Vite | Editor window, toolbar, history panel                  |
| Editor   | Lexical         | WYSIWYG Markdown rendering                             |
| Styling  | Tailwind CSS    | UI layout and theming (dark mode support)              |

---

## 3. App Lifecycle

- The app runs as a **macOS menu bar app** (`LSUIElement = true`; no Dock icon, no app switcher entry).
- The process starts at login (user-configurable via Settings).
- The app never quits unless the user explicitly selects "Quit popmark" from the menu bar menu.
- The editor window is hidden by default; it appears only when triggered by the global hotkey or menu bar click.

---

## 4. Global Hotkey

| Property   | Value                        |
|------------|------------------------------|
| Default    | `⌥Space` (Option + Space)   |
| Behavior   | Toggle: open if hidden, hide if visible |
| Registered via | Tauri global shortcut API |
| Configurable | Yes (via Settings)         |

---

## 5. Editor Window

- **Position:** Centered on the active screen at open time.
- **Default size:** 700 × 500 px (resizable).
- **Window style:** Minimal chrome (no standard title bar); custom toolbar at the top.
- **Always on top:** The window appears above other windows but does not forcibly stay on top after losing focus (standard window behavior).

---

## 6. WYSIWYG Editor (Lexical)

### 6.1 Rendering Style

The editor uses **source-visible WYSIWYG** (Obsidian style):

- Markdown syntax markers (`#`, `**`, `` ` ``, etc.) remain visible in the editor.
- Visual styling is applied at the same time (font size, weight, color, etc.).
- The user can edit the raw markers directly, and the styling updates live.

### 6.2 Supported Markdown Elements

| Element             | Syntax                        |
|---------------------|-------------------------------|
| Heading H1–H6       | `#` … `######`               |
| Bold                | `**text**`                    |
| Italic              | `*text*`                      |
| Bold + Italic       | `***text***`                  |
| Strikethrough       | `~~text~~`                    |
| Inline code         | `` `code` ``                  |
| Code block          | ` ``` ` (fenced, with optional language tag) |
| Blockquote          | `>`                           |
| Unordered list      | `-` or `*`                    |
| Ordered list        | `1.`                          |
| Horizontal rule     | `---`                         |
| Link                | `[label](url)`                |

Inter-document links (wiki-links, `[[…]]`) are **not supported**.

### 6.3 Toolbar

A minimal toolbar appears at the top of the editor window:

| Button / Control | Action                        |
|------------------|-------------------------------|
| Copy & Close     | Copy Markdown, save to history, clear draft, hide window |
| History          | Open/close the history panel  |
| Export…          | Save current content as `.md` via save dialog |
| ⚙ Settings       | Open settings panel (hotkey, startup, etc.) |

---

## 7. Auto-Save (Draft)

- The editor content is saved to the internal draft store on every change, **debounced at 500 ms**.
- The storage location is the Tauri app data directory:
  ```
  ~/Library/Application Support/popmark/draft.md
  ```
- When the editor window is opened, the saved draft is restored automatically.
- The user is never asked to "save" manually; the draft is always up to date.
- If the draft is empty (just after Copy & Close or on first launch), the editor opens blank.

---

## 8. Copy & Close

Triggered by the "Copy & Close" toolbar button (keyboard shortcut: `⌘Return`).

**Steps executed in order:**

1. Serialize the current Lexical editor state to plain Markdown text.
2. Write the Markdown text to the system clipboard.
3. Save the document to history with the current timestamp.
4. Clear `draft.md` (reset to empty).
5. Hide the editor window.

After this action, the next time the editor is opened it shows a blank document.

---

## 9. History

### 9.1 Access

The history panel is accessible via the "History" toolbar button. It opens as a **sidebar panel** within the editor window (sliding in from the left).

### 9.2 Display

- Entries are listed in **reverse-chronological order** (most recent first).
- Each entry shows:
  - Timestamp (e.g., `2024-03-14 09:41`)
  - First non-empty line of the document (used as a title preview, truncated at ~60 characters)

### 9.3 Interactions

| Action | Result |
|--------|--------|
| Click entry | Load the document into the editor as the new draft |
| Load with non-empty draft | Show a confirmation dialog before replacing |
| (Future) Delete entry | Remove from history permanently |

### 9.4 Storage

Each history entry is stored as an individual Markdown file:

```
~/Library/Application Support/popmark/history/<ISO8601-timestamp>.md
```

Example: `history/2024-03-14T09-41-00.md`

A companion index file (`history/index.json`) maintains the ordered list and metadata (timestamp, title preview) for fast rendering without reading each file.

---

## 10. Export

- Opens a native macOS save dialog (via Tauri dialog API).
- Default filename: first line of the document (sanitized) + `.md`.
- Saves the current editor content as a plain Markdown file.
- Does **not** clear the draft or add to history.

---

## 11. Menu Bar

The menu bar icon (a small icon in the macOS status bar) provides a dropdown menu:

| Item               | Action                                     |
|--------------------|--------------------------------------------|
| Show Editor        | Show/focus the editor window               |
| History…           | Show the editor window with history open   |
| Export…            | Export current draft (save dialog)         |
| Settings…          | Open settings panel                        |
| —                  | Separator                                  |
| Quit popmark       | Terminate the app                          |

---

## 12. Settings

Accessible via menu bar > Settings… or toolbar ⚙ button.

| Setting              | Default            | Description                           |
|----------------------|--------------------|---------------------------------------|
| Global hotkey        | `⌥Space`          | Key combination to toggle the editor  |
| Launch at login      | Off                | Register as a login item              |

---

## 13. Data Storage Layout

```
~/Library/Application Support/popmark/
├── draft.md               ← Current unsaved draft (empty after Copy & Close)
├── settings.json          ← User preferences (hotkey, launch-at-login, etc.)
└── history/
    ├── index.json         ← Ordered metadata list (timestamp, title preview)
    ├── 2024-03-14T09-41-00.md
    ├── 2024-03-14T10-05-32.md
    └── …
```

All files are managed by the Tauri backend (Rust). The frontend never accesses the file system directly; it communicates with the backend via Tauri commands (IPC).

---

## 14. Key Technical Decisions

### Tauri IPC Commands (Rust ↔ React)

| Command                  | Direction       | Description                                  |
|--------------------------|-----------------|----------------------------------------------|
| `get_draft`              | Rust → React    | Load current draft content on window open    |
| `save_draft`             | React → Rust    | Persist draft (debounced auto-save)          |
| `copy_and_close`         | React → Rust    | Copy to clipboard, save history, clear draft |
| `list_history`           | Rust → React    | Return history index entries                 |
| `get_history_entry`      | Rust → React    | Return content of a specific history file    |
| `export_file`            | React → Rust    | Open save dialog and write file              |
| `get_settings`           | Rust → React    | Return current settings                      |
| `save_settings`          | React → Rust    | Persist settings changes                     |

### Lexical Markdown Serialization

- Use `@lexical/markdown` (`$convertToMarkdownString`) for clipboard output and history storage.
- Use `$convertFromMarkdownString` to load history entries back into the editor.
- Draft is stored as raw Markdown and parsed on load.

### Global Shortcut

- Registered via `tauri-plugin-global-shortcut`.
- Re-registered automatically when the user changes the hotkey in Settings.

---

## 15. Out of Scope

The following features are explicitly **not** included in this version:

- Inter-document links (`[[wiki-links]]`)
- Multiple simultaneous windows
- Full-text search across history
- Tags or categories for history entries
- Sync / cloud backup
- Windows or Linux support
