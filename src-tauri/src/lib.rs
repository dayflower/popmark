use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Suppress Dock icon (menu bar app behavior)
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Minimal tray icon with Quit only
            let quit = MenuItem::with_id(app, "quit", "Quit popmark", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit])?;
            let mut builder = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| {
                    if event.id == "quit" {
                        app.exit(0);
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }
            builder.build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
