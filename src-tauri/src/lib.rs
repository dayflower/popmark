mod commands;

use commands::AppState;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Emitter, Manager,
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
        .manage(AppState {
            current_shortcut: Mutex::new(None),
        })
        .setup(|app| {
            // macOS system menu bar: popmark menu + File menu + View menu + Edit menu
            #[cfg(target_os = "macos")]
            {
                let menu_toggle_history_item = MenuItem::with_id(
                    app,
                    "menu-toggle-history",
                    "History",
                    true,
                    Some("cmd+h"),
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
                let menu_copy_close_item = MenuItem::with_id(
                    app,
                    "menu-copy-and-close",
                    "Copy & Close",
                    true,
                    Some("cmd+return"),
                )?;
                let menu = Menu::with_items(
                    app,
                    &[
                        &Submenu::with_items(
                            app,
                            "popmark",
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
                                &menu_copy_close_item,
                            ],
                        )?,
                        &Submenu::with_items(
                            app,
                            "View",
                            true,
                            &[&menu_toggle_history_item],
                        )?,
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
                                &PredefinedMenuItem::select_all(app, None)?,
                            ],
                        )?,
                    ],
                )?;
                app.set_menu(menu)?;
                app.on_menu_event(|app, event| match event.id().as_ref() {
                    "menu-toggle-history" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-toggle-history", ());
                        }
                    }
                    "menu-settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("window-shown", ());
                            let _ = window.emit("open-settings-panel", ());
                        }
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
                    "menu-copy-and-close" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("menu-copy-and-close", ());
                        }
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
                MenuItem::with_id(app, "quit-popmark", "Quit popmark", true, None::<&str>)?;
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
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("window-shown", ());
                            let _ = window.emit("open-settings-panel", ());
                        }
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
            commands::copy_and_close,
            commands::new_document,
            commands::export_file,
            commands::list_history,
            commands::get_history_entry,
            commands::get_settings,
            commands::save_settings,
        ])
        .on_window_event(|window, event| {
            // Intercept close request → hide instead of quitting
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
