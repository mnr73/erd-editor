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

fn check_path(path: &str) -> Result<(), String> {
    if path.to_lowercase().ends_with(EXT) {
        Ok(())
    } else {
        Err(format!("only {EXT} files can be read or written"))
    }
}

/// Read an ERD file as UTF-8 text.
#[tauri::command]
fn read_erd(path: String) -> Result<String, String> {
    check_path(&path)?;
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Write atomically: temp file next to the target, flushed, then renamed over it.
/// A crash or full disk never leaves a half-written document.
#[tauri::command]
fn write_erd(path: String, contents: String) -> Result<(), String> {
    use std::io::Write;
    check_path(&path)?;
    let target = std::path::Path::new(&path);
    let tmp = target.with_extension(format!("json.{}.tmp", std::process::id()));
    let result = (|| -> std::io::Result<()> {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(contents.as_bytes())?;
        f.sync_all()?;
        std::fs::rename(&tmp, target)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    result.map_err(|e| e.to_string())
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
        .invoke_handler(tauri::generate_handler![initial_file, read_erd, write_erd])
        .run(tauri::generate_context!())
        .expect("error while running ERD Editor");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> String {
        let dir = std::env::temp_dir().join(format!("erd-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name).to_string_lossy().into_owned()
    }

    #[test]
    fn writes_and_reads_back_without_leaving_temp_files() {
        let p = scratch("a.erd.json");
        write_erd(p.clone(), "{\"x\":1}".into()).unwrap();
        write_erd(p.clone(), "{\"x\":2}".into()).unwrap();
        assert_eq!(read_erd(p.clone()).unwrap(), "{\"x\":2}");
        let dir = std::path::Path::new(&p).parent().unwrap();
        let leftovers = std::fs::read_dir(dir)
            .unwrap()
            .filter(|e| e.as_ref().unwrap().file_name().to_string_lossy().ends_with(".tmp"))
            .count();
        assert_eq!(leftovers, 0);
    }

    #[test]
    fn refuses_other_extensions() {
        assert!(read_erd("/etc/passwd".into()).is_err());
        assert!(write_erd(scratch("x.txt"), "no".into()).is_err());
        assert!(check_path("/a/B.ERD.JSON").is_ok());
    }

    #[test]
    fn failed_write_keeps_the_old_file() {
        let p = scratch("keep.erd.json");
        write_erd(p.clone(), "old".into()).unwrap();
        // a directory in place of the temp target's parent makes the write fail
        let bad = format!("{p}/nested.erd.json");
        assert!(write_erd(bad, "new".into()).is_err());
        assert_eq!(read_erd(p).unwrap(), "old");
    }

    #[test]
    fn picks_the_erd_argument() {
        let args = vec!["erd".into(), "--x".into(), "/t/s.erd.json".into()];
        assert_eq!(erd_path_from_args(&args).as_deref(), Some("/t/s.erd.json"));
        assert_eq!(erd_path_from_args(&["erd".into()]), None);
    }
}
