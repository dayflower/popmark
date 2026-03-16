mod commands;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // macOS system menu bar: App menu + Edit menu
            #[cfg(target_os = "macos")]
            {
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
                                &PredefinedMenuItem::quit(app, None)?,
                            ],
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
            }

            // Tray icon menu: Show Editor + Quit
            let show_item =
                MenuItem::with_id(app, "show-editor", "Show Editor", true, None::<&str>)?;
            let quit_item =
                MenuItem::with_id(app, "quit-popmark", "Quit popmark", true, None::<&str>)?;
            let tray_menu = Menu::with_items(
                app,
                &[
                    &show_item,
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

            // Register ⌥M global shortcut to show/hide the window
            let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::KeyM);
            app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            })?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_draft,
            commands::save_draft,
            commands::copy_and_close,
            commands::export_file,
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
