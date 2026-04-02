# Popmark — Application Specification

## 1. Overview

**Popmark** is an application with a tray icon and standard menu bar that provides a quick-access Markdown WYSIWYG editor. The primary workflow is:

1. Press a global shortcut → editor window appears
2. Write Markdown content
3. Press "Send to Clipboard" → content is copied to clipboard as Markdown, window disappears
4. Past documents remain accessible via a history list

Popmark is not a file manager or a notes app. It is a fast scratch pad optimized for drafting Markdown and pushing it to the clipboard.

---

## 2. Architecture

| Layer    | Technology      | Responsibility                                         |
|----------|-----------------|--------------------------------------------------------|
| Shell    | Tauri 2.x (Rust)| Menu bar agent, global hotkey, clipboard, file I/O     |
| UI       | React 19 + Vite | Editor window, toolbar, history panel                  |
| Editor   | Lexical         | WYSIWYG Markdown rendering                             |
| Styling  | Tailwind CSS    | UI layout and theming (dark mode support)              |

---

## 3. App Lifecycle

- The app runs as a standard application: Dock icon is visible, appears in Cmd+Tab, and the standard menu bar is active when the editor window is focused.
- A tray icon also appears in the status bar for quick access.
- The process starts at login (user-configurable via Settings).
- The app never quits unless the user explicitly selects "Quit Popmark" from the tray menu or presses Cmd+Q.
- Clicking the Dock icon when the editor window is hidden shows and focuses the editor window.
- The editor window is hidden by default; it appears only when triggered by the global hotkey or tray menu.

---

## 4. Global Hotkey

| Property   | Value                        |
|------------|------------------------------|
| Default    | `⌥M` (Option + M)           |
| Behavior   | Show/raise: open if hidden, bring to front if visible but not focused |
| Registered via | Tauri global shortcut API |
| Configurable | Yes (via Settings)         |

---

## 5. Editor Window

- **Position:** Centered on the active screen at open time.
- **Default size:** 700 × 500 px (resizable).
- **Window style:** Standard window with native title bar. The window can be moved by dragging the title bar. A custom toolbar with action buttons appears below the title bar.
- **Always on top:** The window appears above other windows but does not forcibly stay on top after losing focus (standard window behavior).
- **Keyboard shortcut:** `Esc` hides the editor window (regardless of whether a panel is open).

---

## 6. WYSIWYG Editor (Lexical)

### 6.1 Rendering Style

The editor supports two modes, toggled via the toolbar button or **⌘⇧M**:

- **Rich mode** (default): **source-visible WYSIWYG** (Obsidian style) — Markdown syntax markers (`#`, `**`, `` ` ``, etc.) remain visible in the editor while visual styling is applied at the same time (font size, weight, color, etc.). The user can edit the raw markers directly, and the styling updates live.
- **Plain text mode**: a plain `<textarea>` displays the raw Markdown source. `spellCheck` is disabled and all Lexical formatting plugins are inactive.

Switching **rich → plain** converts the Lexical state to Markdown via `$convertToMarkdownString(CUSTOM_TRANSFORMERS)` and loads it into the textarea. Switching **plain → rich** parses the textarea content back via `$convertFromMarkdownString`. The selected mode is persisted in `settings.json` as `editor_mode` and restored on next launch.

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
| Checkbox list       | `- [ ] task` / `- [x] done`  |
| Horizontal rule     | `---`                         |
| Link                | `[label](url)`                |

Inter-document links (wiki-links, `[[…]]`) are **not supported**.

**List exit behavior:** Pressing Enter on a blank list item exits the list and inserts a regular paragraph.

### 6.3 Toolbar

A minimal toolbar appears at the top of the editor window:

| Button / Control  | Action                        |
|-------------------|-------------------------------|
| History           | Open/close the history panel (leftmost; shows pressed state when panel is open) |
| New               | Auto-save draft to history (if non-empty), clear draft, start new document |
| Rich / Plain      | Dual-button toggle group at the far right: clicking the inactive button switches the editor mode (also **⌘⇧M**); clicking the already-active button is a no-op |

Buttons are icon-only (lucide-react icons). The Rich/Plain toggle group uses text labels. Export is not available in the toolbar; it is accessible via the File menu (⌘S).

### 6.4 Send to Clipboard Button

A prominent primary-action button is anchored to the **bottom-right of the editor pane** (inside the `<LexicalComposer>` context, outside the `ContentEditable`):

- **Label:** `Send to clipboard (⌘↵)`
- **Position:** `absolute bottom-4 right-4` within the `relative`-positioned editor container
- **Style:** `bg-blue-500 text-white rounded hover:bg-blue-600 active:bg-blue-700 px-3 py-1.5 text-sm`
- **Behavior:** same as the keyboard shortcut `⌘Return` — copy Markdown (and optionally HTML) to clipboard, save to history, clear draft, hide window
- The scrollable editor area has bottom padding (`pb-16`) to prevent content from being obscured by the button when scrolled to the bottom

---

## 7. Auto-Save (Draft)

- The editor content is saved to the internal draft store on every change, **debounced at 500 ms**.
- The storage location is the Tauri app data directory:
  ```
  ~/Library/Application Support/popmark/draft.md
  ```
- When the editor window is opened, the saved draft is restored automatically.
- The user is never asked to "save" manually; the draft is always up to date.
- If the draft is empty (just after Send to Clipboard or on first launch), the editor opens blank.

---

## 8. Send to Clipboard

Triggered by the "Send to clipboard (⌘↵)" button anchored to the bottom-right of the editor pane (keyboard shortcut: `⌘Return`).

**Steps executed in order:**

1. Serialize the current Lexical editor state to plain Markdown text. If "Copy as Rich Text" is enabled in Settings (Rich mode only), also generate HTML from the Lexical state via `@lexical/html`.
2. Write the Markdown text to the system clipboard. If "Copy as Rich Text" is enabled, write both HTML and plain Markdown via `write_html(html, fallback_text)` so that apps supporting rich paste receive formatted content.
3. Save the document to history with the current timestamp (skipped if the content is empty or whitespace-only).
4. Clear `draft.md` (reset to empty).
5. Hide the editor window.
6. Send an OS notification via `tauri-plugin-notification` with title "Popmark" and body "Copied to clipboard". This is best-effort: the call is fire-and-forget (errors ignored). macOS will prompt the user for notification permission on first use; notifications are silenced during Focus / Do Not Disturb.

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
| Hover entry | Reveals a trash icon on the right side of the entry |
| First trash icon click | Icon turns red (pending-delete state) |
| Second trash icon click | Entry is deleted from index.json and disk; panel updates immediately |
| Click outside panel (while pending) | Pending-delete state is cancelled |
| View > Clear History… | Confirmation dialog; on confirm, all entries are deleted and index.json is reset |


### 9.4 Storage

Each history entry is stored as an individual Markdown file:

```
~/Library/Application Support/popmark/history/<ISO8601-timestamp>.md
```

Example: `history/2024-03-14T09-41-00.md`

A companion index file (`history/index.json`) maintains the ordered list and metadata (timestamp, title preview) for fast rendering without reading each file.

---

## 10. Export

- Opens a native save dialog (via Tauri dialog API).
- Default filename: first line of the document (sanitized) + `.md`.
- Saves the current editor content as a plain Markdown file.
- Does **not** clear the draft or add to history.

---

## 11. Tray Icon

A small icon in the status bar provides a dropdown menu for quick access:

| Item               | Action                                     |
|--------------------|--------------------------------------------|
| Show Editor        | Show/focus the editor window               |
| History…           | Show the editor window with history open   |
| Settings…          | Open settings panel                        |
| —                  | Separator                                  |
| Quit Popmark       | Terminate the app                          |

---

## 11a. System Menu Bar

The standard menu bar is active when the editor window is focused. It provides:

**Popmark menu**

| Item           | Shortcut | Action                        |
|----------------|----------|-------------------------------|
| About Popmark  |          | Show the About dialog         |
| —              |          | Separator                     |
| Settings…      | ⌘,       | Open settings panel           |
| —              |          | Separator                     |
| Quit Popmark   | ⌘Q       | Terminate the app             |

**File menu**

| Item               | Shortcut | Action                        |
|--------------------|----------|-------------------------------|
| New Document       | ⌘N       | Auto-save draft to history (if non-empty), clear draft, start new |
| —                  |          | Separator                     |
| Export…            | ⌘S       | Save current content as `.md` via save dialog |
| —                  |          | Separator                     |
| Send to Clipboard  | ⌘Return  | Copy to clipboard, save to history, clear draft, hide window |

**View menu**

| Item                | Shortcut | Action                                              |
|---------------------|----------|-----------------------------------------------------|
| History             | ⌘H       | Toggle the history panel (checkmark reflects state) |
| Editor Mode ▶       |          | Submenu to select the active editor mode            |
| — Rich text         | ⌘⇧M      | Switch to Rich WYSIWYG mode (checkmark = active)    |
| — Plain text        |          | Switch to Plain text mode (checkmark = active)      |
| —                   |          | Separator                                           |
| Clear History…      |          | Delete all history entries (confirmation required)  |

**Edit menu**

| Item         | Shortcut    | Action           |
|--------------|-------------|------------------|
| Undo                  | ⌘Z       | Undo last edit                                                  |
| Redo                  | ⌘⇧Z      | Redo last edit                                                  |
| —                     |           | Separator                                                       |
| Cut                   | ⌘X       | Cut selection                                                   |
| Copy                  | ⌘C       | Copy selection                                                  |
| Paste                 | ⌘V       | Paste                                                           |
| Paste and Match Style | ⌥⇧⌘V    | Paste clipboard content as plain text (strip formatting)        |
| Paste from Markdown   |           | Parse clipboard content as Markdown and insert with formatting  |
| Select All            | ⌘A       | Select all text                                                 |

**Window menu**

| Item              | Shortcut | Action                                          |
|-------------------|----------|-------------------------------------------------|
| Minimize          | ⌘M       | Minimize the editor window                      |
| Zoom              |          | Toggle window zoom                              |
| Enter Full Screen | ⌃⌘F      | Expand the editor window to fill the screen     |
| —                 |          | Separator                                       |
| Move to Center    |          | Center the editor window on the active screen   |
| —                 |          | Separator                                       |
| Bring All to Front|          | Bring all Popmark windows to the front          |

**Help menu**

| Item          | Shortcut | Action                        |
|---------------|----------|-------------------------------|
| Popmark Help  | ⌘?       | Open help documentation       |

---

## 12. Settings

Accessible via menu bar > Settings… or tray > Settings….

Settings opens as a **standalone OS-level window** (label: `settings`, 360×460, always-on-top). The window is created hidden at app startup and shown/hidden on demand (`show_settings_window` / `hide_settings_window`). This eliminates focus-management complexity and global-shortcut interference that existed with the former in-window modal approach.

After the user saves, the backend emits a `settings-changed` event to the main window so it can update `copy_as_rich_text` and `editor_mode` without requiring a reload.

| Setting              | Default            | Description                           |
|----------------------|--------------------|---------------------------------------|
| Global hotkey        | `⌥M`              | Key combination to toggle the editor  |
| Launch at login      | Off                | Register as a login item              |
| Editor mode          | `rich`             | `rich` = source-visible WYSIWYG; `plain` = raw Markdown textarea |
| Copy as Rich Text    | Off                | When enabled (Rich mode only), "Send to Clipboard" copies HTML + plain Markdown so rich formatting is preserved in apps that support it |
| Max history entries  | 0 (unlimited)      | Maximum number of history entries to retain; oldest are auto-deleted when a new entry exceeds the limit |

---

## 13. Data Storage Layout

```
~/Library/Application Support/popmark/
├── draft.md               ← Current unsaved draft (empty after Send to Clipboard)
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
| `copy_to_clipboard`      | React → Rust    | Copy to clipboard (plain Markdown + optional HTML when Copy as Rich Text is enabled), save history, clear draft |
| `read_clipboard_text`    | React → Rust    | Read plain text from clipboard (used by Paste and Match Style) |
| `list_history`           | Rust → React    | Return history index entries                 |
| `get_history_entry`      | Rust → React    | Return content of a specific history file    |
| `export_file`            | React → Rust    | Open save dialog and write file              |
| `get_settings`           | Rust → React    | Return current settings                      |
| `save_settings`          | React → Rust    | Persist settings changes; emits `settings-changed` event to the main window |
| `new_document`           | React → Rust    | Auto-save current draft to history (if non-empty), then clear draft |
| `save_editor_mode`       | React → Rust    | Persist the selected editor mode (`rich` or `plain`) to settings.json |
| `set_editor_mode_menu`   | React → Rust    | Sync the View > Editor Mode submenu checkmarks to the current mode |
| `show_settings_window`   | React → Rust    | Show the settings window and unregister the global shortcut |
| `hide_settings_window`   | React → Rust    | Hide the settings window and re-register the global shortcut |
| `set_hotkey_capture_active` | React → Rust | Unregister (active=true) or re-register (active=false) the global shortcut during hotkey capture |
| `delete_history_entry`   | React → Rust    | Remove a single history entry from index.json and delete its `.md` file |
| `clear_history`          | React → Rust    | Delete all history `.md` files and reset index.json to an empty array |

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


The following are deferred to a future version:

- Drag-and-drop reordering of list items in the editor
- Shift+Arrow keys to move selected nodes (list items, paragraphs) up or down
