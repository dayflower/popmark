use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri::menu::{CheckMenuItem, MenuItem};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

// ---------------------------------------------------------------------------
// App state: tracks the currently registered global shortcut and menu items
// ---------------------------------------------------------------------------

pub struct AppState {
    pub current_shortcut: Mutex<Option<Shortcut>>,
    pub current_hotkey_str: Mutex<String>,
    pub history_menu_item: Mutex<Option<CheckMenuItem<tauri::Wry>>>,
    pub editor_mode_rich_item: Mutex<Option<CheckMenuItem<tauri::Wry>>>,
    pub editor_mode_plain_item: Mutex<Option<CheckMenuItem<tauri::Wry>>>,
    pub recall_last_item: Mutex<Option<MenuItem<tauri::Wry>>>,
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub hotkey: String,
    pub launch_at_login: bool,
    #[serde(default = "default_editor_mode")]
    pub editor_mode: String,
    #[serde(default)]
    pub copy_as_rich_text: bool,
    #[serde(default)]
    pub max_history_entries: Option<u32>,
    #[serde(default)]
    pub rich_font_family: Option<String>,
    #[serde(default)]
    pub rich_font_size: Option<f32>,
    #[serde(default)]
    pub plain_font_family: Option<String>,
    #[serde(default)]
    pub plain_font_size: Option<f32>,
    #[serde(default = "default_font_fallback")]
    pub rich_font_fallback: bool,
    #[serde(default = "default_font_fallback")]
    pub plain_font_fallback: bool,
}

fn default_editor_mode() -> String {
    "rich".to_string()
}

fn default_font_fallback() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            hotkey: "alt+m".to_string(),
            launch_at_login: false,
            editor_mode: "rich".to_string(),
            copy_as_rich_text: false,
            max_history_entries: None,
            rich_font_family: None,
            rich_font_size: None,
            plain_font_family: None,
            plain_font_size: None,
            rich_font_fallback: true,
            plain_font_fallback: true,
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
/// that shows the window (show-only; ignores the hotkey when already visible).
/// Persists the active shortcut and hotkey string in AppState.
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
                    let _ = window.show();
                    let _ = window.set_focus();
                    #[cfg(target_os = "macos")]
                    {
                        use objc2_app_kit::NSApplication;
                        use objc2_foundation::MainThreadMarker;
                        unsafe {
                            let mtm = MainThreadMarker::new_unchecked();
                            let ns_app = NSApplication::sharedApplication(mtm);
                            ns_app.activate();
                        }
                    }
                    let _ = window.emit("window-shown", ());
                }
            }
        })
        .map_err(|e| e.to_string())?;

    *current = Some(shortcut);
    // Save hotkey string for re-registration after Settings panel closes
    *app.state::<AppState>().current_hotkey_str.lock().unwrap() = hotkey.to_string();
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
pub fn save_settings(app: AppHandle, mut settings: Settings) -> Result<(), String> {
    // Persist to disk
    let path = settings_path(&app)?;
    // Preserve the current editor_mode — managed exclusively via save_editor_mode
    if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if let Ok(current) = serde_json::from_str::<Settings>(&data) {
            settings.editor_mode = current.editor_mode;
        }
    }
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

    // Notify main window that settings changed
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit("settings-changed", &settings);
    }

    Ok(())
}

#[tauri::command]
pub fn list_fonts() -> Result<Vec<String>, String> {
    let collection = font_enumeration::Collection::new()
        .map_err(|e| e.to_string())?;
    let mut families: Vec<String> = collection
        .all()
        .map(|f| f.family_name.clone())
        .collect();
    families.sort_unstable();
    families.dedup();
    Ok(families)
}

#[tauri::command]
pub fn save_editor_mode(app: AppHandle, mode: String) -> Result<(), String> {
    let path = settings_path(&app)?;
    let mut settings: Settings = if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())?
    } else {
        Settings::default()
    };
    settings.editor_mode = mode;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// History save helper
// ---------------------------------------------------------------------------

fn save_history_entry(app: &AppHandle, content: &str) -> Result<(), String> {
    if content.trim().is_empty() {
        return Ok(());
    }
    let now = Local::now();
    let id = now.format("%Y-%m-%dT%H-%M-%S").to_string();
    let timestamp = now.format("%Y-%m-%dT%H:%M:%S").to_string();
    let title_preview = extract_title_preview(content);

    let history = history_dir(app)?;
    let file_path = history.join(format!("{}.md", id));
    fs::write(&file_path, content).map_err(|e| e.to_string())?;

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

    // Apply retention limit
    let settings = get_settings(app.clone())?;
    if let Some(limit) = settings.max_history_entries {
        if limit > 0 {
            let limit = limit as usize;
            while entries.len() > limit {
                if let Some(removed) = entries.pop() {
                    let _ = fs::remove_file(history.join(format!("{}.md", removed.id)));
                }
            }
        }
    }

    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&index_path, json).map_err(|e| e.to_string())?;

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
pub fn read_clipboard_text(app: AppHandle) -> Result<String, String> {
    app.clipboard().read_text().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_to_clipboard(
    app: AppHandle,
    content: String,
    html_content: Option<String>,
) -> Result<(), String> {
    // 1. Copy to clipboard
    if let Some(html) = html_content {
        app.clipboard()
            .write_html(html, Some(content.clone()))
            .map_err(|e| e.to_string())?;
    } else {
        app.clipboard()
            .write_text(content.clone())
            .map_err(|e| e.to_string())?;
    }

    // 2. Save to history
    save_history_entry(&app, &content)?;

    // 3. Clear draft
    let draft = draft_path(&app)?;
    fs::write(&draft, "").map_err(|e| e.to_string())?;

    // 5. Hide window
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e: tauri::Error| e.to_string())?;
    }

    // 6. Notify user (best-effort; silently ignored if permission denied or DND)
    let _ = app.notification()
        .builder()
        .title("Popmark")
        .body("Copied to clipboard")
        .show();

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
        save_history_entry(&app, &content)?;
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

#[tauri::command]
pub fn delete_history_entry(app: AppHandle, id: String) -> Result<(), String> {
    let history = history_dir(&app)?;
    let index_path = history.join("index.json");

    let mut entries: Vec<HistoryEntry> = if index_path.exists() {
        let data = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    };
    entries.retain(|e| e.id != id);
    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&index_path, json).map_err(|e| e.to_string())?;

    let _ = fs::remove_file(history.join(format!("{}.md", id)));

    Ok(())
}

#[tauri::command]
pub fn clear_history(app: AppHandle) -> Result<(), String> {
    let history = history_dir(&app)?;
    let index_path = history.join("index.json");

    if index_path.exists() {
        let data = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        let entries: Vec<HistoryEntry> = serde_json::from_str(&data).unwrap_or_default();
        for entry in &entries {
            let _ = fs::remove_file(history.join(format!("{}.md", entry.id)));
        }
    }

    fs::write(&index_path, "[]").map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------------------
// IPC commands: recall last history
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn recall_last_history(app: AppHandle) -> Result<String, String> {
    let history = history_dir(&app)?;
    let index_path = history.join("index.json");
    if !index_path.exists() {
        return Err("No history entries".to_string());
    }
    let data = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
    let entries: Vec<HistoryEntry> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    if entries.is_empty() {
        return Err("No history entries".to_string());
    }
    get_history_entry(app, entries[0].id.clone())
}

#[tauri::command]
pub fn set_recall_last_enabled(state: tauri::State<'_, AppState>, enabled: bool) {
    if let Some(item) = state.recall_last_item.lock().unwrap().as_ref() {
        let _ = item.set_enabled(enabled);
    }
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
pub fn set_editor_mode_menu(state: tauri::State<'_, AppState>, mode: String) {
    let is_rich = mode == "rich";
    if let Some(item) = state.editor_mode_rich_item.lock().unwrap().as_ref() {
        let _ = item.set_checked(is_rich);
    }
    if let Some(item) = state.editor_mode_plain_item.lock().unwrap().as_ref() {
        let _ = item.set_checked(!is_rich);
    }
}

#[tauri::command]
pub fn set_history_panel_open(state: tauri::State<'_, AppState>, open: bool) {
    if let Some(item) = state.history_menu_item.lock().unwrap().as_ref() {
        let _ = item.set_checked(open);
    }
}

#[tauri::command]
pub fn show_settings_window(app: AppHandle) -> Result<(), String> {
    // Unregister global shortcut while settings window is open
    let state = app.state::<AppState>();
    let mut current = state.current_shortcut.lock().unwrap();
    if let Some(old) = current.take() {
        let _ = app.global_shortcut().unregister(old);
    }

    if let Some(window) = app.get_webview_window("settings") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        let _ = window.emit("settings-window-shown", ());
    }
    Ok(())
}

#[tauri::command]
pub fn hide_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        window.hide().map_err(|e| e.to_string())?;
    }
    // Re-register global shortcut
    let hotkey = app
        .state::<AppState>()
        .current_hotkey_str
        .lock()
        .unwrap()
        .clone();
    if !hotkey.is_empty() {
        re_register_shortcut(&app, &hotkey)?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_hotkey_capture_active(app: AppHandle, active: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    if active {
        // Unregister while user is capturing a new hotkey
        let mut current = state.current_shortcut.lock().unwrap();
        if let Some(old) = current.take() {
            let _ = app.global_shortcut().unregister(old);
        }
    } else {
        // Re-register with the stored hotkey
        let hotkey = state.current_hotkey_str.lock().unwrap().clone();
        if !hotkey.is_empty() {
            re_register_shortcut(&app, &hotkey)?;
        }
    }
    Ok(())
}
