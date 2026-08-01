mod commands;

use commands::{AppState, MenuState, ShortcutState};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{AboutMetadata, CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition,
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
            shortcut: Mutex::new(ShortcutState {
                shortcut: None,
                hotkey_str: String::new(),
            }),
            menu: Mutex::new(MenuState {
                history_item: None,
                editor_mode_rich: None,
                editor_mode_plain: None,
                copy_format_rich: None,
                copy_format_markdown: None,
                tray_copy_format_rich: None,
                tray_copy_format_markdown: None,
                recall_last: None,
            }),
        })
        .setup(|app| {
            let handle = app.handle();

            #[cfg(target_os = "macos")]
            setup_macos_menu(handle)?;

            setup_tray(handle)?;

            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{
                    apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState,
                };
                for label in ["main", "settings"] {
                    if let Some(window) = handle.get_webview_window(label) {
                        apply_vibrancy(
                            &window,
                            NSVisualEffectMaterial::HeaderView,
                            Some(NSVisualEffectState::Active),
                            None,
                        )
                        .unwrap_or_else(|_| panic!("apply_vibrancy failed for {label} window"));
                    }
                }
            }

            // Read saved settings and register global shortcut
            let settings = commands::get_settings(handle.clone()).unwrap_or_default();
            commands::re_register_shortcut(handle, &settings.hotkey)?;
            #[cfg(target_os = "macos")]
            commands::apply_dock_icon_policy(settings.show_dock_icon);

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
            commands::save_copy_as_rich_text,
            commands::list_fonts,
            commands::set_history_panel_open,
            commands::set_editor_mode_menu,
            commands::set_copy_format_menu,
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
                        .shortcut
                        .lock()
                        .expect("mutex poisoned: shortcut")
                        .hotkey_str
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
                    show_and_focus_main_window(app_handle);
                }
            }
        });
}

#[cfg(target_os = "macos")]
fn setup_macos_menu(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let menu_toggle_history_item = CheckMenuItem::with_id(
        app,
        "menu-toggle-history",
        "History",
        true,
        false,
        Some("cmd+h"),
    )?;
    let saved_settings = commands::get_settings(app.clone()).unwrap_or_default();
    let is_rich = saved_settings.editor_mode != "plain";
    // Copy format is forced to markdown in plain mode; only reflect the saved
    // rich preference when actually in rich mode.
    let copy_as_rich = saved_settings.copy_as_rich_text && is_rich;
    let menu_editor_mode_rich_item = CheckMenuItem::with_id(
        app,
        "menu-set-editor-mode-rich",
        "Rich text",
        true,
        is_rich,
        Some("cmd+shift+r"),
    )?;
    let menu_editor_mode_plain_item = CheckMenuItem::with_id(
        app,
        "menu-set-editor-mode-plain",
        "Plain text",
        true,
        !is_rich,
        Some("cmd+shift+p"),
    )?;
    let menu_editor_mode_submenu = Submenu::with_items(
        app,
        "Editor Mode",
        true,
        &[&menu_editor_mode_rich_item, &menu_editor_mode_plain_item],
    )?;
    let menu_copy_format_rich_item = CheckMenuItem::with_id(
        app,
        "menu-set-copy-format-rich",
        "Rich text",
        is_rich,
        copy_as_rich,
        Some("cmd+shift+m"),
    )?;
    let menu_copy_format_markdown_item = CheckMenuItem::with_id(
        app,
        "menu-set-copy-format-markdown",
        "Markdown",
        is_rich,
        !copy_as_rich,
        None::<&str>,
    )?;
    let menu_copy_format_submenu = Submenu::with_items(
        app,
        "Copy Format",
        true,
        &[&menu_copy_format_rich_item, &menu_copy_format_markdown_item],
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
    let menu_export_item =
        MenuItem::with_id(app, "menu-export", "Export\u{2026}", true, Some("cmd+s"))?;
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
        None::<&str>,
    )?;
    let menu_move_to_center_item = MenuItem::with_id(
        app,
        "menu-move-to-center",
        "Move to Center",
        true,
        None::<&str>,
    )?;
    let menu_help_item = MenuItem::with_id(app, "menu-help", "Popmark Help", true, Some("cmd+?"))?;
    #[cfg(debug_assertions)]
    let menu_devtools_item =
        MenuItem::with_id(app, "menu-devtools", "Developer Tools", true, None::<&str>)?;
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
    let menu_recall_last_item =
        MenuItem::with_id(app, "menu-recall-last", "Recall Last", false, Some("cmd+r"))?;
    app.state::<AppState>()
        .menu
        .lock()
        .expect("mutex poisoned: menu")
        .recall_last = Some(menu_recall_last_item.clone());
    let menu_clear_all_item = MenuItem::with_id(
        app,
        "menu-clear-all",
        "Clear All",
        true,
        Some("cmd+shift+backspace"),
    )?;
    #[cfg(debug_assertions)]
    let help_submenu = Submenu::with_items(
        app,
        "Help",
        true,
        &[
            &menu_help_item,
            &PredefinedMenuItem::separator(app)?,
            &menu_devtools_item,
        ],
    )?;
    #[cfg(not(debug_assertions))]
    let help_submenu = Submenu::with_items(app, "Help", true, &[&menu_help_item])?;
    let menu = Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                "Popmark",
                true,
                &[
                    &PredefinedMenuItem::about(
                        app,
                        None,
                        Some(AboutMetadata {
                            icon: Image::from_bytes(include_bytes!("../icons/icon.png")).ok(),
                            ..Default::default()
                        }),
                    )?,
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
                    &menu_copy_format_submenu,
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
                    &menu_paste_and_match_style_item,
                    &menu_paste_from_markdown_item,
                    &PredefinedMenuItem::select_all(app, None)?,
                    &menu_clear_all_item,
                    &PredefinedMenuItem::separator(app)?,
                    &menu_recall_last_item,
                ],
            )?,
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
                    &menu_move_to_center_item,
                ],
            )?,
            &help_submenu,
        ],
    )?;
    app.set_menu(menu)?;
    {
        let app_state = app.state::<AppState>();
        let mut menu_state = app_state.menu.lock().expect("mutex poisoned: menu");
        menu_state.history_item = Some(menu_toggle_history_item);
        menu_state.editor_mode_rich = Some(menu_editor_mode_rich_item);
        menu_state.editor_mode_plain = Some(menu_editor_mode_plain_item);
        menu_state.copy_format_rich = Some(menu_copy_format_rich_item);
        menu_state.copy_format_markdown = Some(menu_copy_format_markdown_item);
    }
    app.on_menu_event(|app, event| match event.id().as_ref() {
        "menu-toggle-history" => {
            emit_to_main_window(app, "menu-toggle-history", ());
        }
        "menu-settings" => {
            let _ = commands::show_settings_window(app.clone());
        }
        "menu-new-document" => {
            emit_to_main_window(app, "menu-new-document", ());
        }
        "menu-export" => {
            emit_to_main_window(app, "menu-export", ());
        }
        "menu-show-history-folder" => {
            commands::open_history_folder(app.clone());
        }
        "menu-send-to-clipboard" => {
            emit_to_main_window(app, "menu-send-to-clipboard", ());
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
                        + (work_area.size.height as i32 - window_size.height as i32) / 2;
                    let _ = window.set_position(PhysicalPosition::new(x, y));
                }
            }
        }
        "menu-set-editor-mode-rich" => {
            // Immediately correct checkmarks; macOS auto-toggles on click
            {
                let app_state = app.state::<AppState>();
                let menu = app_state.menu.lock().expect("mutex poisoned: menu");
                if let Some(item) = menu.editor_mode_rich.as_ref() {
                    let _ = item.set_checked(true);
                }
                if let Some(item) = menu.editor_mode_plain.as_ref() {
                    let _ = item.set_checked(false);
                }
            }
            emit_to_main_window(app, "menu-set-editor-mode", "rich");
        }
        "menu-set-editor-mode-plain" => {
            // Immediately correct checkmarks; macOS auto-toggles on click
            {
                let app_state = app.state::<AppState>();
                let menu = app_state.menu.lock().expect("mutex poisoned: menu");
                if let Some(item) = menu.editor_mode_rich.as_ref() {
                    let _ = item.set_checked(false);
                }
                if let Some(item) = menu.editor_mode_plain.as_ref() {
                    let _ = item.set_checked(true);
                }
            }
            emit_to_main_window(app, "menu-set-editor-mode", "plain");
        }
        "menu-set-copy-format-rich" => {
            set_copy_format_checks(app, true);
            emit_to_main_window(app, "menu-set-copy-format", "rich");
        }
        "menu-set-copy-format-markdown" => {
            set_copy_format_checks(app, false);
            emit_to_main_window(app, "menu-set-copy-format", "markdown");
        }
        "menu-clear-history" => {
            emit_to_main_window(app, "menu-clear-history", ());
        }
        "menu-paste-and-match-style" => {
            emit_to_main_window(app, "menu-paste-and-match-style", ());
        }
        "menu-paste-from-markdown" => {
            emit_to_main_window(app, "menu-paste-from-markdown", ());
        }
        "menu-recall-last" => {
            emit_to_main_window(app, "menu-recall-last", ());
        }
        "menu-clear-all" => {
            emit_to_main_window(app, "menu-clear-all", ());
        }
        "menu-help" => {
            let _ =
                tauri_plugin_opener::open_url("https://github.com/dayflower/popmark", None::<&str>);
        }
        #[cfg(debug_assertions)]
        "menu-devtools" => {
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }
        }
        _ => {}
    });
    Ok(())
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show-editor", "Show Editor", true, None::<&str>)?;
    let history_item =
        MenuItem::with_id(app, "open-history", "History\u{2026}", true, None::<&str>)?;
    let settings_item =
        MenuItem::with_id(app, "open-settings", "Settings\u{2026}", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit-popmark", "Quit Popmark", true, None::<&str>)?;
    let saved_settings = commands::get_settings(app.clone()).unwrap_or_default();
    let is_rich = saved_settings.editor_mode != "plain";
    let copy_as_rich = saved_settings.copy_as_rich_text && is_rich;
    let tray_copy_format_rich_item = CheckMenuItem::with_id(
        app,
        "tray-set-copy-format-rich",
        "Rich text",
        is_rich,
        copy_as_rich,
        None::<&str>,
    )?;
    let tray_copy_format_markdown_item = CheckMenuItem::with_id(
        app,
        "tray-set-copy-format-markdown",
        "Markdown",
        is_rich,
        !copy_as_rich,
        None::<&str>,
    )?;
    let tray_copy_format_submenu = Submenu::with_items(
        app,
        "Copy Format",
        true,
        &[&tray_copy_format_rich_item, &tray_copy_format_markdown_item],
    )?;
    let tray_menu = Menu::with_items(
        app,
        &[
            &show_item,
            &history_item,
            &settings_item,
            &PredefinedMenuItem::separator(app)?,
            &tray_copy_format_submenu,
            &PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )?;
    {
        let app_state = app.state::<AppState>();
        let mut menu_state = app_state.menu.lock().expect("mutex poisoned: menu");
        menu_state.tray_copy_format_rich = Some(tray_copy_format_rich_item);
        menu_state.tray_copy_format_markdown = Some(tray_copy_format_markdown_item);
    }
    let mut builder =
        TrayIconBuilder::new()
            .menu(&tray_menu)
            .on_menu_event(|app, event| match event.id().as_ref() {
                "show-editor" => {
                    show_and_focus_main_window(app);
                }
                "open-history" => {
                    show_and_focus_main_window(app);
                    emit_to_main_window(app, "open-history-panel", ());
                }
                "open-settings" => {
                    let _ = commands::show_settings_window(app.clone());
                }
                "tray-set-copy-format-rich" => {
                    set_copy_format_checks(app, true);
                    emit_to_main_window(app, "menu-set-copy-format", "rich");
                }
                "tray-set-copy-format-markdown" => {
                    set_copy_format_checks(app, false);
                    emit_to_main_window(app, "menu-set-copy-format", "markdown");
                }
                "quit-popmark" => {
                    app.exit(0);
                }
                _ => {}
            });
    #[cfg(target_os = "macos")]
    {
        const TRAY_ICON_PNG: &[u8] = include_bytes!("../icons/tray-icon.png");
        let img = image::load_from_memory(TRAY_ICON_PNG)
            .map_err(|e| e.to_string())?
            .into_rgba8();
        let (width, height) = image::GenericImageView::dimensions(&img);
        let icon = tauri::image::Image::new_owned(img.into_raw(), width, height);
        builder = builder.icon(icon).icon_as_template(true);
    }
    #[cfg(not(target_os = "macos"))]
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

// Immediately correct the Copy Format checkmarks (app menu + tray); macOS
// auto-toggles on click. The frontend re-syncs via set_copy_format_menu.
fn set_copy_format_checks(app: &AppHandle, rich: bool) {
    let app_state = app.state::<AppState>();
    let menu = app_state.menu.lock().expect("mutex poisoned: menu");
    for (rich_item, md_item) in [
        (&menu.copy_format_rich, &menu.copy_format_markdown),
        (&menu.tray_copy_format_rich, &menu.tray_copy_format_markdown),
    ] {
        if let Some(item) = rich_item.as_ref() {
            let _ = item.set_checked(rich);
        }
        if let Some(item) = md_item.as_ref() {
            let _ = item.set_checked(!rich);
        }
    }
}

fn emit_to_main_window(app: &AppHandle, event: &str, payload: impl Serialize + Clone) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit(event, payload);
    }
}

fn show_and_focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("window-shown", ());
    }
}
