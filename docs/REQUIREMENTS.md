# Popmark — Requirements

## 1. Purpose

Popmark is an application with a tray icon and standard menu bar, providing a quick-access Markdown scratch pad. The primary goal is to let users draft Markdown text rapidly and push it to the clipboard — not to manage files or organize documents.

---

## 2. Core Workflow

1. Press a global shortcut → editor window appears, centered on the active screen.
2. Write Markdown content.
3. Press "Send to Clipboard" → content is copied to the clipboard as plain Markdown text; window disappears.
4. Past documents remain accessible via a history list.

---

## 3. Editor

- The editor supports two modes, selected via a **Rich / Plain** dual-button toggle group at the right end of the toolbar (**⌘⇧R** for Rich, **⌘⇧P** for Plain):
  - **Rich mode** (default): **source-visible WYSIWYG** (Obsidian-style) — Markdown syntax markers (`#`, `**`, `` ` ``, etc.) remain visible while visual styling (font size, weight, color, etc.) is applied at the same time. Users can edit the raw markers directly; styling updates live.
  - **Plain text mode**: displays the raw Markdown source in a monospaced textarea; no visual formatting is applied.
- The selected mode is persisted and restored on next launch.
- Supported Markdown elements: headings H1–H6, bold, italic, bold+italic, strikethrough, inline code, fenced code blocks (with optional language tag), blockquotes, unordered and ordered lists, checkbox (task) lists, horizontal rules, and links.
- Bare URLs (e.g. `https://example.com`) typed in rich mode are auto-linked: they are decorated as links in the editor while staying plain text in the Markdown source. In both explicit `[label](url)` links and auto-linked bare URLs, Cmd/Ctrl+click opens the URL in the OS default browser; a plain click places the editing caret.
- Inline syntax markers for inline code (`` ` ``), bold (`**`), italic (`*`), bold+italic (`***`), and strikethrough (`~~`) are rendered in a dimmed, smaller style alongside the formatted text. These markers are CSS-only and do not appear in the clipboard output. Their visibility can be toggled via the **"Show syntax markers"** setting (default: on).
- Checkbox lists use `- [ ]` (unchecked) and `- [x]` (checked) syntax.
- Standard Markdown syntax is used (`#` for H1, `##` for H2, etc.).
- Pressing Enter on a blank list item exits list mode and returns to normal paragraph mode.

---

## 4. Draft & Auto-Save

- Editor content is saved automatically and continuously; users never need to save manually.
- If the app is closed or the window is dismissed unexpectedly, reopening the window restores the previous content exactly.
- The storage location is internal to the app; users do not need to know where or under what filename the draft is kept.

---

## 5. Send to Clipboard

Triggered by the "Send to Clipboard" split button anchored to the bottom-right of the editor pane (also available via keyboard shortcut — configurable in Settings, default `⌘↵`):

1. Current editor content is serialized to plain Markdown and written to the system clipboard. If the copy format is set to **Rich Text** (Rich mode only), the content is also written as HTML so that rich formatting is preserved when pasting into applications that support it.
2. If the content is non-empty, the document is saved to history with a timestamp.
3. The draft is cleared.
4. The editor window is hidden.
5. An OS notification ("Copied to clipboard") is sent as a brief confirmation, if "Notify on copy" is enabled in Settings (default: on). Requires notification permission (one-time system prompt); silenced during Focus / Do Not Disturb.

The next time the editor is opened it shows a blank document.

### Copy format (Rich Text / Markdown)

The copy format is chosen directly at the point of copying rather than buried in Settings:

- The "Send to Clipboard" button is a **split button** (like GitHub's merge button). Its ▾ dropdown lets you pick **Rich text** or **Markdown**; the main button label reflects the current choice ("Send Rich Text to Clipboard" / "Send Markdown to Clipboard").
- The same toggle is available from the **Copy Format** submenu in the app menu bar and the tray (status bar) icon menu, and via the **`⌘⇧M`** keyboard shortcut.
- The chosen format is persisted across launches.
- **Plain mode always copies Markdown.** While in Plain mode the format is forced to Markdown and the toggle is disabled; switching back to Rich mode restores the previously selected format.

---

## 5a. New Document

- Users can create a new document (clear the editor) at any time via the toolbar or system menu bar (⌘N).
- If the current draft is non-empty, it is **automatically saved to history** before clearing (no confirmation required).
- After clearing, the editor opens a blank document.

---

## 5b. Clear All

- Users can clear all editor content instantly via Edit > Clear All (⌘⇧⌫).
- No confirmation dialog is shown.
- The cleared content is **not** saved to history.
- The action **is** undoable via Cmd+Z. After undoing in plain mode, the text is restored with a full selection active (inherent browser limitation of the `execCommand`-based approach).
- If the editor is already empty, the action does nothing (no side effects guaranteed).
- There is no toolbar button for this action.

---

## 6. History

- Every document saved via Send to Clipboard is retained in history.
- The history panel lists entries in reverse-chronological order (most recent first).
- Each entry shows a timestamp and a preview of the first line.
- Clicking an entry loads its content into the editor as the new draft.
  - If the current draft is non-empty, a confirmation is required before replacing it.
- Hovering over an entry reveals a trash icon. Clicking it once turns the icon red (pending state); clicking it a second time deletes the entry permanently. Clicking anywhere else cancels the pending deletion.
- View > Clear History… in the menu bar deletes all history entries at once (confirmation required).
- If a "Max history entries" limit is set in Settings, the oldest entries are automatically deleted whenever a new entry would exceed the limit.

---

## 7. Export

- Users can save the current editor content as a `.md` file via a native save dialog (toolbar button, File menu, or ⌘S).
- Export does not clear the draft and does not add an entry to history.
- Export is an optional convenience; it is not the primary workflow.

---

## 8. App Lifecycle & Menu Bar

- By default, the app runs as a standard application: a Dock icon is visible, and the standard menu bar is available when the editor window is focused. The menu bar provides a File menu (New Document, Export, Show History Folder in Finder, Send to Clipboard, Copy Format), an Edit menu, a Window menu, a Help menu, and access to History and Settings from the app menu. A tray icon also appears in the status bar for quick access (including the Copy Format toggle).
- When the "Show Dock icon" setting is disabled, the app hides from the Dock, Cmd+Tab, and the menu bar (macOS Accessory activation policy). The system tray icon and global hotkey remain the access points in this mode.
- The app starts at login (user-configurable).
- The app **never quits** unless the user explicitly selects "Quit" from the tray menu or presses Cmd+Q. Closing the editor window hides it; it does not terminate the process.
- The editor window is hidden by default and appears only when triggered by the global hotkey or via the tray menu.
- Clicking the Dock icon when the editor window is hidden shows the editor window.
- Pressing Esc hides the editor window.
- Global hotkey is **show/raise**: pressing the hotkey shows the window if hidden, or brings it to the front if visible but not focused. Esc is the sole keyboard method to hide the window.

---

## 9. Settings

| Setting | Description |
|---------|-------------|
| Global hotkey | Key combination to **show or raise** the editor window (configurable by the user). Shows the window if hidden; brings it to the front if visible but not focused. |
| Send to Clipboard shortcut | Key combination to trigger "Send to Clipboard" from inside the editor (default: `⌘↵`). Configurable independently from the global hotkey. |
| Launch at login | Whether the app starts automatically when the user logs in |
| Editor mode | Whether the editor opens in **Rich** (source-visible WYSIWYG) or **Plain** (raw Markdown textarea) mode |
| Max history entries | Maximum number of history entries to retain. Empty or 0 means unlimited. When a new entry is saved and the count exceeds the limit, the oldest entries are deleted automatically. |
| Rich mode font family | Custom font family for the Rich mode editor. When empty, the browser default is used. |
| Rich mode font size | Custom font size (in px) for the Rich mode editor. When empty, the default size is used. |
| Plain mode font family | Custom font family for the Plain mode textarea. When empty, the default monospace font is used. |
| Plain mode font size | Custom font size (in px) for the Plain mode textarea. When empty, the default size is used. |
| Show syntax markers | When enabled (Rich mode only), displays Markdown syntax markers (`**`, `*`, `~~`, `` ` ``, `#`–`######`) as CSS decorations alongside the formatted text (default: on). |
| Show Dock icon | When enabled (default), the app appears in the macOS Dock, Cmd+Tab, and menu bar. When disabled, the app is accessible only via the system tray icon and global hotkey (macOS Accessory activation policy). |

---

## 10. Out of Scope

The following are explicitly **not** required:

- Inter-document links (`[[wiki-links]]`)
- File management or note organization
- Full-text search across history
- Tags or categories for history entries
- Multiple simultaneous editor windows
- Sync or cloud backup


---

## 10a. Future / Nice-to-Have

The following are deferred to a future version:

- Drag-and-drop reordering of list items in the editor
- Shift+Arrow keys to move selected nodes (list items, paragraphs) up or down

---

## 11. Technical Constraints

These technology choices are fixed:

| Layer | Technology |
|-------|-----------|
| Native shell | Tauri 2.x (Rust) |
| Frontend | React 19 + Vite |
| Rich text engine | Lexical (vendored `LexicalMarkdownEditor`, based on `etude-lexical-markdown`) |
