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

/// Extensions the export / import commands may touch. They are separate from `.erd.json` so that
/// "export" can never overwrite a document by accident, and neither list allows executables.
const EXPORT_EXTS: [&str; 5] = ["sql", "dbml", "md", "svg", "png"];
const IMPORT_EXTS: [&str; 3] = ["sql", "ddl", "txt"];

fn has_ext(path: &str, allowed: &[&str]) -> bool {
    std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| allowed.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Write atomically: temp file next to the target, flushed, then renamed over it.
fn atomic_write(path: &str, contents: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let target = std::path::Path::new(path);
    let name = target
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let tmp = target.with_file_name(format!(".{name}.{}.tmp", std::process::id()));
    let result = (|| -> std::io::Result<()> {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(contents)?;
        f.sync_all()?;
        std::fs::rename(&tmp, target)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    result.map_err(|e| e.to_string())
}

/// Save exported text (DBML, SQL, Markdown, SVG).
#[tauri::command]
fn write_export(path: String, contents: String) -> Result<(), String> {
    if !has_ext(&path, &EXPORT_EXTS) {
        return Err(format!("export files must end in .{}", EXPORT_EXTS.join(", .")));
    }
    atomic_write(&path, contents.as_bytes())
}

/// Percent-decoding of the path header (a header must be ASCII, a path may be Persian).
fn percent_decode(s: &str) -> Option<String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let hex = std::str::from_utf8(b.get(i + 1..i + 3)?).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Save exported bytes (PNG). The body is the raw file, the target path travels in the `path`
/// header, so a large image is not turned into a JSON array of numbers.
#[tauri::command]
fn write_export_bytes(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err("expected a raw body".into());
    };
    let path = request
        .headers()
        .get("path")
        .and_then(|v| v.to_str().ok())
        .and_then(percent_decode)
        .ok_or("missing path header")?;
    if !has_ext(&path, &EXPORT_EXTS) {
        return Err(format!("export files must end in .{}", EXPORT_EXTS.join(", .")));
    }
    atomic_write(&path, data)
}

/// Read a SQL file chosen for import (at most 20 MB, UTF-8; a UTF-16 / odd encoding is reported).
#[tauri::command]
fn read_import(path: String) -> Result<String, String> {
    if !has_ext(&path, &IMPORT_EXTS) {
        return Err(format!("only .{} files can be imported", IMPORT_EXTS.join(", .")));
    }
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 20 * 1024 * 1024 {
        return Err("file is larger than 20 MB".into());
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|_| "file is not UTF-8 text".to_string())
}

/// What the app remembers about a file on disk, to notice that something else changed it:
/// modification time (ms) and size. A missing file is `None`, not an error.
#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Debug)]
struct Stamp {
    mtime: u64,
    size: u64,
}

fn stamp_of(path: &str) -> Option<Stamp> {
    let meta = std::fs::metadata(path).ok()?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Some(Stamp { mtime, size: meta.len() })
}

#[derive(serde::Serialize, Debug)]
struct ReadResult {
    text: String,
    stamp: Option<Stamp>,
}

/// Read an ERD file as UTF-8 text, together with its stamp. The stamp is taken BEFORE reading, so a
/// write that lands in between shows up as a change on the next check instead of being missed.
#[tauri::command]
fn read_erd(path: String) -> Result<ReadResult, String> {
    check_path(&path)?;
    let stamp = stamp_of(&path);
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(ReadResult { text, stamp })
}

/// Cheap check used for polling: the current stamp, or `None` when the file is gone.
#[tauri::command]
fn stat_erd(path: String) -> Result<Option<Stamp>, String> {
    check_path(&path)?;
    Ok(stamp_of(&path))
}

/// Write the document. With `expected` (the stamp the app last saw) the write is refused with
/// `changed` when the file on disk is no longer that one, so an edit made outside the app is never
/// overwritten without asking. `None` means "no check" (first save, or the user chose to overwrite).
/// Returns the new stamp. A crash or full disk never leaves a half-written document.
#[tauri::command]
fn write_erd(
    path: String,
    contents: String,
    expected: Option<Stamp>,
    check: bool,
) -> Result<Option<Stamp>, String> {
    check_path(&path)?;
    if check && stamp_of(&path) != expected {
        return Err("changed".into());
    }
    atomic_write(&path, contents.as_bytes())?;
    Ok(stamp_of(&path))
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            initial_file,
            read_erd,
            stat_erd,
            write_erd,
            write_export,
            write_export_bytes,
            read_import
        ])
        .run(tauri::generate_context!())
        .expect("error while running ERD Editor");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Tests run in parallel: each file name gets a directory of its own, so one test never sees
    /// another's in-flight temp file.
    fn scratch(name: &str) -> String {
        let dir = std::env::temp_dir()
            .join(format!("erd-test-{}", std::process::id()))
            .join(name.replace('.', "_"));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name).to_string_lossy().into_owned()
    }

    #[test]
    fn writes_and_reads_back_without_leaving_temp_files() {
        let p = scratch("a.erd.json");
        write_erd(p.clone(), "{\"x\":1}".into(), None, false).unwrap();
        write_erd(p.clone(), "{\"x\":2}".into(), None, false).unwrap();
        assert_eq!(read_erd(p.clone()).unwrap().text, "{\"x\":2}");
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
        assert!(write_erd(scratch("x.txt"), "no".into(), None, false).is_err());
        assert!(stat_erd("/etc/passwd".into()).is_err());
        assert!(check_path("/a/B.ERD.JSON").is_ok());
    }

    #[test]
    fn failed_write_keeps_the_old_file() {
        let p = scratch("keep.erd.json");
        write_erd(p.clone(), "old".into(), None, false).unwrap();
        // a directory in place of the temp target's parent makes the write fail
        let bad = format!("{p}/nested.erd.json");
        assert!(write_erd(bad, "new".into(), None, false).is_err());
        assert_eq!(read_erd(p).unwrap().text, "old");
    }

    #[test]
    fn export_writes_only_known_extensions_and_no_temp_files() {
        let p = scratch("out.sql");
        write_export(p.clone(), "CREATE TABLE a (x int);".into()).unwrap();
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "CREATE TABLE a (x int);");
        assert!(write_export(scratch("run.sh"), "x".into()).is_err());
        assert!(write_export(scratch("noext"), "x".into()).is_err());
        assert!(write_export(scratch("a.erd.json"), "x".into()).is_err());
        assert!(write_export(scratch("up.PNG"), "x".into()).is_ok());
        let dir = std::path::Path::new(&p).parent().unwrap();
        let tmp = std::fs::read_dir(dir)
            .unwrap()
            .filter(|e| e.as_ref().unwrap().file_name().to_string_lossy().ends_with(".tmp"))
            .count();
        assert_eq!(tmp, 0);
    }

    #[test]
    fn import_reads_sql_only_and_reports_bad_encoding() {
        let p = scratch("in.sql");
        write_export(p.clone(), "select 1;".into()).unwrap();
        assert_eq!(read_import(p).unwrap(), "select 1;");
        assert!(read_import("/etc/passwd".into()).is_err());
        let bin = scratch("bin.txt");
        atomic_write(&bin, &[0xff, 0xfe, 0x00]).unwrap();
        assert!(read_import(bin).unwrap_err().contains("UTF-8"));
        assert!(read_import(scratch("missing.sql")).is_err());
    }

    #[test]
    fn stamps_follow_the_file_and_a_checked_write_refuses_a_changed_file() {
        let p = scratch("stamp.erd.json");
        assert_eq!(stat_erd(p.clone()).unwrap(), None, "missing file: no stamp, no error");
        // first save: nothing to compare with
        let first = write_erd(p.clone(), "one".into(), None, false).unwrap();
        assert!(first.is_some());
        // the app saw `first`; nobody touched the file: the checked write goes through
        let second = write_erd(p.clone(), "two!".into(), first.clone(), true).unwrap();
        assert_ne!(second, first, "size changed, so the stamp changed");
        // someone else rewrites the file behind our back (different size, so even a coarse mtime shows it)
        std::fs::write(&p, "changed outside the app").unwrap();
        let err = write_erd(p.clone(), "mine".into(), second.clone(), true).unwrap_err();
        assert_eq!(err, "changed");
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "changed outside the app");
        // the user chose to overwrite: unchecked write
        assert!(write_erd(p.clone(), "mine".into(), None, false).is_ok());
        assert_eq!(read_erd(p.clone()).unwrap().text, "mine");
        // deleted behind our back: a checked write is refused too (stamp None != Some)
        let known = stat_erd(p.clone()).unwrap();
        std::fs::remove_file(&p).unwrap();
        assert_eq!(stat_erd(p.clone()).unwrap(), None);
        assert_eq!(write_erd(p, "x".into(), known, true).unwrap_err(), "changed");
    }

    #[test]
    fn read_returns_the_stamp_of_what_it_read() {
        let p = scratch("readstamp.erd.json");
        write_erd(p.clone(), "abc".into(), None, false).unwrap();
        let r = read_erd(p.clone()).unwrap();
        assert_eq!(r.stamp, stat_erd(p).unwrap());
        assert_eq!(r.stamp.unwrap().size, 3);
    }

    #[test]
    fn decodes_the_path_header() {
        assert_eq!(percent_decode("%2Ftmp%2Fa%20b.png").as_deref(), Some("/tmp/a b.png"));
        assert_eq!(percent_decode("%2Ftmp%2F%D9%86.svg").as_deref(), Some("/tmp/ن.svg"));
        assert_eq!(percent_decode("plain").as_deref(), Some("plain"));
        assert_eq!(percent_decode("%zz"), None);
        assert_eq!(percent_decode("%4"), None);
    }

    #[test]
    fn picks_the_erd_argument() {
        let args = vec!["erd".into(), "--x".into(), "/t/s.erd.json".into()];
        assert_eq!(erd_path_from_args(&args).as_deref(), Some("/t/s.erd.json"));
        assert_eq!(erd_path_from_args(&["erd".into()]), None);
    }
}
