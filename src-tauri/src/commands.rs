use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::{DialogExt, FilePath};

fn draft_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e: std::io::Error| e.to_string())?;
    Ok(dir.join("draft.md"))
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
    app.clipboard().write_text(content).map_err(|e| e.to_string())?;
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn export_file(app: AppHandle, content: String, default_name: String) -> Result<(), String> {
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
