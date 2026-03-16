use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::{DialogExt, FilePath};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub title_preview: String,
}

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
pub fn copy_and_close(app: AppHandle, content: String) -> Result<(), String> {
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
