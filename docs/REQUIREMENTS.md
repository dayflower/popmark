# popmark — Requirements

## 1. Purpose

popmark is a macOS application with a tray icon and standard menu bar, providing a quick-access Markdown scratch pad. The primary goal is to let users draft Markdown text rapidly and push it to the clipboard — not to manage files or organize documents.

---

## 2. Core Workflow

1. Press a global shortcut → editor window appears, centered on the active screen.
2. Write Markdown content.
3. Press "Copy & Close" → content is copied to the clipboard as plain Markdown text; window disappears.
4. Past documents remain accessible via a history list.

---

## 3. Editor

- The editor uses **source-visible WYSIWYG** (Obsidian-style):
  - Markdown syntax markers (`#`, `**`, `` ` ``, etc.) remain visible.
  - Visual styling (font size, weight, color, etc.) is applied at the same time.
  - Users can edit the raw markers directly; styling updates live.
- Supported Markdown elements: headings H1–H6, bold, italic, bold+italic, strikethrough, inline code, fenced code blocks (with optional language tag), blockquotes, unordered and ordered lists, horizontal rules, and links.
- Standard Markdown syntax is used (`#` for H1, `##` for H2, etc.).

---

## 4. Draft & Auto-Save

- Editor content is saved automatically and continuously; users never need to save manually.
- If the app is closed or the window is dismissed unexpectedly, reopening the window restores the previous content exactly.
- The storage location is internal to the app; users do not need to know where or under what filename the draft is kept.

---

## 5. Copy & Close

Triggered by the "Copy & Close" button (also available via keyboard shortcut):

1. Current editor content is serialized to plain Markdown and written to the system clipboard.
2. The document is saved to history with a timestamp.
3. The draft is cleared.
4. The editor window is hidden.

The next time the editor is opened it shows a blank document.

---

## 6. History

- Every document saved via Copy & Close is retained in history (documents are never automatically deleted).
- The history panel lists entries in reverse-chronological order (most recent first).
- Each entry shows a timestamp and a preview of the first line.
- Clicking an entry loads its content into the editor as the new draft.
  - If the current draft is non-empty, a confirmation is required before replacing it.

---

## 7. Export

- Users can save the current editor content as a `.md` file via a native macOS save dialog.
- Export does not clear the draft and does not add an entry to history.
- Export is an optional convenience; it is not the primary workflow.

---

## 8. App Lifecycle & Menu Bar

- The app runs as a standard macOS application: a Dock icon is visible, and the standard macOS menu bar (including an Edit menu) is available when the editor window is focused. A tray icon also appears in the macOS status bar for quick access.
- The app starts at login (user-configurable).
- The app **never quits** unless the user explicitly selects "Quit" from the tray menu or presses Cmd+Q. Closing the editor window hides it; it does not terminate the process.
- The editor window is hidden by default and appears only when triggered by the global hotkey or via the tray menu.

---

## 9. Settings

| Setting | Description |
|---------|-------------|
| Global hotkey | Key combination to show/hide the editor window (configurable by the user) |
| Launch at login | Whether the app starts automatically when the user logs in |

---

## 10. Out of Scope

The following are explicitly **not** required:

- Inter-document links (`[[wiki-links]]`)
- File management or note organization
- Full-text search across history
- Tags or categories for history entries
- Multiple simultaneous editor windows
- Sync or cloud backup
- Windows or Linux support

---

## 11. Technical Constraints

These technology choices are fixed:

| Layer | Technology |
|-------|-----------|
| Native shell | Tauri 2.x (Rust) |
| Frontend | React 18 + Vite |
| Rich text engine | Lexical |
