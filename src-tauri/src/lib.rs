use tauri::{Emitter, Manager};

const EXT: &str = ".erd.json";

/// First CLI argument that looks like an ERD file (used by "Open with").
fn erd_path_from_args(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|a| a.to_lowercase().ends_with(EXT))
        .cloned()
}

/// File passed on the command line when the app was launched.
#[tauri::command]
fn initial_file() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    erd_path_from_args(&args)
}

pub fn run() {
    tauri::Builder::default()
        // A second launch (Open with while the app is running) forwards its file here.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            if let Some(path) = erd_path_from_args(&args) {
                let _ = app.emit("open-file", path);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![initial_file])
        .run(tauri::generate_context!())
        .expect("error while running ERD Editor");
}
