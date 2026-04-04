mod commands;

use commands::AppState;
use std::sync::Mutex;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Emitter, Manager, PhysicalPosition,
};
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            current_shortcut: Mutex::new(None),
            current_hotkey_str: Mutex::new(String::new()),
            history_menu_item: Mutex::new(None),
            editor_mode_rich_item: Mutex::new(None),
            editor_mode_plain_item: Mutex::new(None),
            recall_last_item: Mutex::new(None),
        })
        .setup(|app| {
            // macOS system menu bar: popmark menu + File menu + View menu + Edit menu
            #[cfg(target_os = "macos")]
            {
                let menu_toggle_history_item = CheckMenuItem::with_id(
                    app,
                    "menu-toggle-history",
                    "History",
                    true,
                    false,
                    Some("cmd+h"),
                )?;
                let saved_mode = commands::get_settings(app.handle().clone())
                    .unwrap_or_default()
                    .editor_mode;
                let is_rich = saved_mode != "plain";
                let menu_editor_mode_rich_item = CheckMenuItem::with_id(
                    app,
                    "menu-set-editor-mode-rich",
                    "Rich text",
                    true,
                    is_rich,
                    Some("cmd+shift+m"),
                )?;
                let menu_editor_mode_plain_item = CheckMenuItem::with_id(
                    app,
                    "menu-set-editor-mode-plain",
                    "Plain text",
                    true,
                    !is_rich,
                    None::<&str>,
                )?;
                let menu_editor_mode_submenu = Submenu::with_items(
                    app,
                    "Editor Mode",
                    true,
                    &[&menu_editor_mode_rich_item, &menu_editor_mode_plain_item],
                )?;
                let menu_clear_history_item = MenuItem::with_id(
                    app,
                    "menu-clear-history",
                    "Clear History\u{2026}",
                    true,
                    None::<&str>,
                )?;
                let menu_settings_item = MenuItem::with_id(
                    app,
                    "menu-settings",
                    "Settings\u{2026}",
                    true,
                    Some("cmd+,"),
                )?;
                let menu_new_item = MenuItem::with_id(
                    app,
                    "menu-new-document",
                    "New Document",
                    true,
                    Some("cmd+n"),
                )?;
                let menu_export_item = MenuItem::with_id(
                    app,
                    "menu-export",
                    "Export\u{2026}",
                    true,
                    Some("cmd+s"),
                )?;
                let menu_show_history_folder_item = MenuItem::with_id(
                    app,
                    "menu-show-history-folder",
                    "Show History Folder in Finder",
                    true,
                    None::<&str>,
                )?;
                let menu_send_to_clipboard_item = MenuItem::with_id(
                    app,
                    "menu-send-to-clipboard",
                    "Send to Clipboard",
                    true,
                    Some("cmd+return"),
                )?;
                let menu_move_to_center_item = MenuItem::with_id(
                    app,
                    "menu-move-to-center",
                    "Move to Center",
                    true,
                    None::<&str>,
                )?;
                let menu_help_item = MenuItem::with_id(
                    app,
                    "menu-help",
                    "Popmark Help",
                    true,
                    Some("cmd+?"),
                )?;
                let menu = Menu::with_items(
                    app,
                    &[
                        &Submenu::with_items(
                            app,
                            "Popmark",
                            true,
                            &[
                                &PredefinedMenuItem::about(app, None, None)?,
                                &PredefinedMenuItem::separator(app)?,
                                &menu_settings_item,
                                &PredefinedMenuItem::separator(app)?,
                                &PredefinedMenuItem::quit(app, None)?,
                            ],
                        )?,
                        &Submenu::with_items(
                            app,
                            "File",
                            true,
                            &[
                                &menu_new_item,
                                &PredefinedMenuItem::separator(app)?,
                                &menu_export_item,
                                &menu_show_history_folder_item,
                                &PredefinedMenuItem::separator(app)?,
                                &menu_send_to_clipboard_item,
                            ],
                        )?,
                        {
                            let menu_paste_and_match_style_item = MenuItem::with_id(
                                app,
                                "menu-paste-and-match-style",
                                "Paste and Match Style",
                                true,
                                Some("alt+shift+cmd+v"),
                            )?;
                            let menu_paste_from_markdown_item = MenuItem::with_id(
                                app,
                                "menu-paste-from-markdown",
                                "Paste from Markdown",
                                true,
                                None::<&str>,
                            )?;
                            let menu_recall_last_item = MenuItem::with_id(
                                app,
                                "menu-recall-last",
                                "Recall Last",
                                false,
                                Some("cmd+r"),
                            )?;
                            *app.state::<AppState>().recall_last_item.lock().unwrap() =
                                Some(menu_recall_last_item.clone());
                            &Submenu::with_items(
                                app,
                                "Edit",
                                true,
                                &[
                                    &PredefinedMenuItem::undo(app, None)?,
                                    &PredefinedMenuItem::redo(app, None)?,
                                    &PredefinedMenuItem::separator(app)?,
                                    &PredefinedMenuItem::cut(app, None)?,
                                    &PredefinedMenuItem::copy(app, None)?,
                                    &PredefinedMenuItem::paste(app, None)?,
                                    &menu_paste_and_match_style_item,
                                    &menu_paste_from_markdown_item,
                                    &PredefinedMenuItem::select_all(app, None)?,
                                    &PredefinedMenuItem::separator(app)?,
                                    &menu_recall_last_item,
                                ],
                            )?
                        },
                        &Submenu::with_items(
                            app,
                            "View",
                            true,
                            &[
                                &menu_toggle_history_item,
                                &menu_editor_mode_submenu,
                                &PredefinedMenuItem::separator(app)?,
                                &menu_clear_history_item,
                            ],
                        )?,
                        &Submenu::with_items(
                            app,
                            "Window",
                            true,
                            &[
                                &PredefinedMenuItem::minimize(app, None)?,
                                &PredefinedMenuItem::maximize(app, None)?,
                                &PredefinedMenuItem::fullscreen(app, None)?,
                                &PredefinedMenuItem::separator(app)?,
                                &menu_move_to_center_item,
                            ],
                        )?,
                        &Submenu::with_items(
                            app,
                            "Help",
                            true,
                            &[&menu_help_item],
                        )?,
                    ],
                )?;
                app.set_menu(menu)?;
                *app.state::<AppState>().history_menu_item.lock().unwrap() =
                    Some(menu_toggle_history_item);
                *app.state::<AppState>().editor_mode_rich_item.lock().unwrap() =
                    Some(menu_editor_mode_rich_item);
                *app.state::<AppState>().editor_mode_plain_item.lock().unwrap() =
                    Some(menu_editor_mode_plain_item);
                app.on_menu_event(|app, event| match event.id().as_ref() {
                    "menu-toggle-history" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-toggle-history", ());
                        }
                    }
                    "menu-settings" => {
                        let _ = commands::show_settings_window(app.clone());
                    }
                    "menu-new-document" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-new-document", ());
                        }
                    }
                    "menu-export" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-export", ());
                        }
                    }
                    "menu-show-history-folder" => {
                        commands::open_history_folder(app.clone());
                    }
                    "menu-send-to-clipboard" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-send-to-clipboard", ());
                        }
                    }
                    "menu-move-to-center" => {
                        if let Some(window) = app.get_webview_window("main") {
                            // Do NOT use window.center() here. It delegates to NSWindow.center(),
                            // which per Apple HIG places the window at an "alert position" in the
                            // upper half of the screen — not the geometric center. Instead,
                            // manually compute the center of the work area (menu bar + Dock excluded).
                            if let (Ok(Some(monitor)), Ok(window_size)) =
                                (window.current_monitor(), window.outer_size())
                            {
                                let work_area = monitor.work_area();
                                let x = work_area.position.x
                                    + (work_area.size.width as i32 - window_size.width as i32) / 2;
                                let y = work_area.position.y
                                    + (work_area.size.height as i32 - window_size.height as i32)
                                        / 2;
                                let _ = window.set_position(PhysicalPosition::new(x, y));
                            }
                        }
                    }
                    "menu-set-editor-mode-rich" => {
                        // Immediately correct checkmarks; macOS auto-toggles on click
                        let state = app.state::<AppState>();
                        if let Some(item) = state.editor_mode_rich_item.lock().unwrap().as_ref() {
                            let _ = item.set_checked(true);
                        }
                        if let Some(item) = state.editor_mode_plain_item.lock().unwrap().as_ref() {
                            let _ = item.set_checked(false);
                        }
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-set-editor-mode", "rich");
                        }
                    }
                    "menu-set-editor-mode-plain" => {
                        // Immediately correct checkmarks; macOS auto-toggles on click
                        let state = app.state::<AppState>();
                        if let Some(item) = state.editor_mode_rich_item.lock().unwrap().as_ref() {
                            let _ = item.set_checked(false);
                        }
                        if let Some(item) = state.editor_mode_plain_item.lock().unwrap().as_ref() {
                            let _ = item.set_checked(true);
                        }
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-set-editor-mode", "plain");
                        }
                    }
                    "menu-clear-history" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-clear-history", ());
                        }
                    }
                    "menu-paste-and-match-style" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-paste-and-match-style", ());
                        }
                    }
                    "menu-paste-from-markdown" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-paste-from-markdown", ());
                        }
                    }
                    "menu-recall-last" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-recall-last", ());
                        }
                    }
                    "menu-help" => {
                        // stub: no help documentation yet
                    }
                    _ => {}
                });
            }

            // Tray icon menu: Show Editor + History… + Settings… + Quit
            let show_item =
                MenuItem::with_id(app, "show-editor", "Show Editor", true, None::<&str>)?;
            let history_item =
                MenuItem::with_id(app, "open-history", "History\u{2026}", true, None::<&str>)?;
            let settings_item =
                MenuItem::with_id(app, "open-settings", "Settings\u{2026}", true, None::<&str>)?;
            let quit_item =
                MenuItem::with_id(app, "quit-popmark", "Quit Popmark", true, None::<&str>)?;
            let tray_menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &history_item,
                    &settings_item,
                    &PredefinedMenuItem::separator(app)?,
                    &quit_item,
                ],
            )?;
            let mut builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show-editor" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("window-shown", ());
                        }
                    }
                    "open-history" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("window-shown", ());
                            let _ = window.emit("open-history-panel", ());
                        }
                    }
                    "open-settings" => {
                        let _ = commands::show_settings_window(app.clone());
                    }
                    "quit-popmark" => {
                        app.exit(0);
                    }
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }
            builder.build(app)?;

            // Read saved hotkey from settings and register global shortcut
            let hotkey = commands::get_settings(app.handle().clone())
                .unwrap_or_default()
                .hotkey;
            commands::re_register_shortcut(app.handle(), &hotkey)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_draft,
            commands::save_draft,
            commands::copy_to_clipboard,
            commands::read_clipboard_text,
            commands::new_document,
            commands::export_file,
            commands::list_history,
            commands::get_history_entry,
            commands::get_settings,
            commands::save_settings,
            commands::save_editor_mode,
            commands::list_fonts,
            commands::set_history_panel_open,
            commands::set_editor_mode_menu,
            commands::show_settings_window,
            commands::hide_settings_window,
            commands::set_hotkey_capture_active,
            commands::delete_history_entry,
            commands::clear_history,
            commands::recall_last_history,
            commands::set_recall_last_enabled,
        ])
        .on_window_event(|window, event| {
            // Intercept close request → hide instead of quitting
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                // Re-register global shortcut when settings window is closed
                if window.label() == "settings" {
                    let app = window.app_handle();
                    let hotkey = app
                        .state::<AppState>()
                        .current_hotkey_str
                        .lock()
                        .unwrap()
                        .clone();
                    if !hotkey.is_empty() {
                        let _ = commands::re_register_shortcut(app, &hotkey);
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } = event
            {
                if !has_visible_windows {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("window-shown", ());
                    }
                }
            }
        });
}
