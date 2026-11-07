import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, open, save } from "@tauri-apps/plugin-dialog";

/** True when running inside the Tauri shell (false in a plain browser, e.g. `npm run dev`). */
export const isTauri = () => "__TAURI_INTERNALS__" in window;

const FILTERS = [{ name: "ERD", extensions: ["erd.json", "json"] }];
const EXT = ".erd.json";

/** Path of the .erd.json the app was launched with (Open with), or null. */
export async function readInitialFile() {
    if (!isTauri()) return null;
    return invoke("initial_file");
}

/** Called when a second launch forwards another file to the running instance. */
export async function listenOpenFile(handler) {
    if (!isTauri()) return () => {};
    return listen("open-file", (e) => handler(e.payload));
}

/**
 * Files dragged onto the window. `onHover(bool)` tells when a file is over the window,
 * `onDrop(entries)` gets `[{ name, path }]` in the desktop app (the webview reports real paths)
 * and `[{ name, file }]` in a browser (`npm run dev`). Returns the unlisten function.
 */
export async function listenFileDrop({ onHover, onDrop }) {
    if (isTauri()) {
        return getCurrentWebview().onDragDropEvent((e) => {
            const p = e.payload;
            if (p.type === "enter") onHover(true);
            else if (p.type === "leave") onHover(false);
            else if (p.type === "drop") {
                onHover(false);
                onDrop(p.paths.map((path) => ({ name: baseFile(path), path })));
            }
        });
    }
    const hasFiles = (e) => e.dataTransfer?.types?.includes("Files");
    const over = (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        onHover(true);
    };
    const leave = (e) => {
        // leaving the window, not moving between child elements
        if (!e.relatedTarget) onHover(false);
    };
    const drop = (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        onHover(false);
        onDrop(
            [...e.dataTransfer.files].map((file) => ({
                name: file.name,
                file,
            })),
        );
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
        window.removeEventListener("dragover", over);
        window.removeEventListener("dragleave", leave);
        window.removeEventListener("drop", drop);
    };
}

const baseFile = (path) =>
    path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

/** Native "open" dialog (multiple files allowed). Returns an array of paths ([] if cancelled). */
export async function pickFiles() {
    if (!isTauri()) return [];
    const r = await open({
        multiple: true,
        directory: false,
        filters: FILTERS,
    });
    return r ? [r].flat() : [];
}

/** Native "save as" dialog. The extension is forced to `.erd.json`. Returns a path or null. */
export async function pickSavePath(defaultName = "diagram") {
    if (!isTauri()) return null;
    const r = await save({
        filters: FILTERS,
        defaultPath: ensureExt(defaultName),
    });
    return r ? ensureExt(r) : null;
}

export function ensureExt(path) {
    return path.toLowerCase().endsWith(EXT)
        ? path
        : `${path.replace(/\.json$/i, "").replace(/\.erd$/i, "")}${EXT}`;
}

export const readFile = (path) => invoke("read_erd", { path });
export const writeFile = (path, contents) =>
    invoke("write_erd", { path, contents });

/** Native yes/no confirmation (falls back to window.confirm in a browser). */
export async function confirmDialog(message, { okLabel, cancelLabel } = {}) {
    if (!isTauri()) return window.confirm(message);
    return ask(message, { kind: "warning", okLabel, cancelLabel });
}

/** Intercept the window close button. `handler()` returns true to allow closing. */
export async function onWindowCloseRequested(handler) {
    if (!isTauri()) return () => {};
    const win = getCurrentWindow();
    return win.onCloseRequested(async (event) => {
        event.preventDefault();
        if (await handler()) await win.destroy();
    });
}

/** Native "save" dialog for an export. `ext` is one of sql | dbml | md | svg | png. */
export async function pickExportPath(defaultName, ext) {
    if (!isTauri()) return null;
    const names = {
        sql: "SQL",
        dbml: "DBML",
        md: "Markdown",
        svg: "SVG",
        png: "PNG",
    };
    const r = await save({
        filters: [{ name: names[ext] ?? ext, extensions: [ext] }],
        defaultPath: `${defaultName}.${ext}`,
    });
    if (!r) return null;
    return r.toLowerCase().endsWith(`.${ext}`) ? r : `${r}.${ext}`;
}

/** Native "open" dialog for a SQL file to import. Returns a path or null. */
export async function pickImportPath() {
    if (!isTauri()) return null;
    const r = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "SQL", extensions: ["sql", "ddl", "txt"] }],
    });
    return r ? [r].flat()[0] : null;
}

export const writeExport = (path, contents) =>
    invoke("write_export", { path, contents });
/** `bytes`: Uint8Array. Sent as a raw body (not a JSON number array); the path goes in a header. */
export const writeExportBytes = (path, bytes) =>
    invoke("write_export_bytes", bytes, {
        headers: { path: encodeURIComponent(path) },
    });
export const readImport = (path) => invoke("read_import", { path });
