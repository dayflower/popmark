use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri::menu::CheckMenuItem;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

// ---------------------------------------------------------------------------
// App state: tracks the currently registered global shortcut and menu items
// ---------------------------------------------------------------------------

pub struct AppState {
    pub current_shortcut: Mutex<Option<Shortcut>>,
    pub history_menu_item: Mutex<Option<CheckMenuItem<tauri::Wry>>>,
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub hotkey: String,
    pub launch_at_login: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            hotkey: "alt+m".to_string(),
            launch_at_login: false,
        }
    }
}

// ---------------------------------------------------------------------------
// History entry
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub title_preview: String,
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e: std::io::Error| e.to_string())?;
    Ok(dir)
}

fn draft_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("draft.md"))
}

fn history_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("history");
    fs::create_dir_all(&dir).map_err(|e: std::io::Error| e.to_string())?;
    Ok(dir)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

fn extract_title_preview(content: &str) -> String {
    let first_line = content
        .lines()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("");
    // Strip leading Markdown heading markers
    let stripped = first_line.trim_start_matches('#').trim();
    if stripped.is_empty() {
        return "(empty)".to_string();
    }
    if stripped.chars().count() > 60 {
        stripped.chars().take(60).collect::<String>() + "…"
    } else {
        stripped.to_string()
    }
}

// ---------------------------------------------------------------------------
// Shortcut registration helper
// ---------------------------------------------------------------------------

/// Unregister the previous global shortcut (if any) and register a new one
/// that toggles window visibility. Persists the active shortcut in AppState.
pub fn re_register_shortcut(app: &AppHandle, hotkey: &str) -> Result<(), String> {
    let shortcut: Shortcut = hotkey
        .parse()
        .map_err(|e| format!("Invalid hotkey '{hotkey}': {e}"))?;

    let state = app.state::<AppState>();
    let mut current = state.current_shortcut.lock().unwrap();
    if let Some(old) = current.take() {
        let _ = app.global_shortcut().unregister(old);
    }

    app.global_shortcut()
        .on_shortcut(shortcut.clone(), move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("window-shown", ());
                    }
                }
            }
        })
        .map_err(|e| e.to_string())?;

    *current = Some(shortcut);
    Ok(())
}

// ---------------------------------------------------------------------------
// IPC commands: settings
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let path = settings_path(&app)?;
    if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())
    } else {
        Ok(Settings::default())
    }
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    // Persist to disk
    let path = settings_path(&app)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    // Re-register global shortcut with new hotkey
    re_register_shortcut(&app, &settings.hotkey)?;

    // Toggle launch-at-login
    use tauri_plugin_autostart::ManagerExt;
    if settings.launch_at_login {
        app.autolaunch().enable().map_err(|e| e.to_string())?;
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// IPC commands: draft
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_draft(app: AppHandle) -> Result<String, String> {
    let path = draft_path(&app)?;
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok(String::new())
    }
}

#[tauri::command]
pub fn save_draft(app: AppHandle, content: String) -> Result<(), String> {
    let path = draft_path(&app)?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_to_clipboard(app: AppHandle, content: String) -> Result<(), String> {
    // 1. Copy to clipboard
    app.clipboard()
        .write_text(content.clone())
        .map_err(|e| e.to_string())?;

    // 2. Save to history
    let now = Local::now();
    let id = now.format("%Y-%m-%dT%H-%M-%S").to_string();
    let timestamp = now.format("%Y-%m-%dT%H:%M:%S").to_string();
    let title_preview = extract_title_preview(&content);

    let history = history_dir(&app)?;
    let file_path = history.join(format!("{}.md", id));
    fs::write(&file_path, &content).map_err(|e| e.to_string())?;

    // 3. Update index.json (prepend new entry to maintain reverse-chronological order)
    let index_path = history.join("index.json");
    let mut entries: Vec<HistoryEntry> = if index_path.exists() {
        let data = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    };
    entries.insert(
        0,
        HistoryEntry {
            id,
            timestamp,
            title_preview,
        },
    );
    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&index_path, json).map_err(|e| e.to_string())?;

    // 4. Clear draft
    let draft = draft_path(&app)?;
    fs::write(&draft, "").map_err(|e| e.to_string())?;

    // 5. Hide window
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e: tauri::Error| e.to_string())?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// IPC commands: new document
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn new_document(app: AppHandle) -> Result<(), String> {
    // Save current draft to history if non-empty
    let content = get_draft(app.clone())?;
    if !content.trim().is_empty() {
        let now = Local::now();
        let id = now.format("%Y-%m-%dT%H-%M-%S").to_string();
        let timestamp = now.format("%Y-%m-%dT%H:%M:%S").to_string();
        let title_preview = extract_title_preview(&content);

        let history = history_dir(&app)?;
        let file_path = history.join(format!("{}.md", id));
        fs::write(&file_path, &content).map_err(|e| e.to_string())?;

        let index_path = history.join("index.json");
        let mut entries: Vec<HistoryEntry> = if index_path.exists() {
            let data = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            Vec::new()
        };
        entries.insert(
            0,
            HistoryEntry {
                id,
                timestamp,
                title_preview,
            },
        );
        let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
        fs::write(&index_path, json).map_err(|e| e.to_string())?;
    }

    // Clear draft
    let draft = draft_path(&app)?;
    fs::write(&draft, "").map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------------------
// IPC commands: history
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_history(app: AppHandle) -> Result<Vec<HistoryEntry>, String> {
    let history = history_dir(&app)?;
    let index_path = history.join("index.json");
    if !index_path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_history_entry(app: AppHandle, id: String) -> Result<String, String> {
    let history = history_dir(&app)?;
    let file_path = history.join(format!("{}.md", id));
    if !file_path.exists() {
        return Err(format!("History entry not found: {}", id));
    }
    fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// IPC commands: export
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn export_file(
    app: AppHandle,
    content: String,
    default_name: String,
) -> Result<(), String> {
    let path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("Markdown", &["md"])
        .blocking_save_file();

    match path {
        Some(FilePath::Path(p)) => fs::write(&p, content).map_err(|e| e.to_string()),
        Some(_) => Err("Unsupported file path type".to_string()),
        None => Ok(()), // user cancelled
    }
}

// ---------------------------------------------------------------------------
// Menu state sync
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn set_history_panel_open(state: tauri::State<'_, AppState>, open: bool) {
    if let Some(item) = state.history_menu_item.lock().unwrap().as_ref() {
        let _ = item.set_checked(open);
    }
}
