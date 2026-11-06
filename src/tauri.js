import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** True when running inside the Tauri shell (false in a plain browser, e.g. `npm run dev`). */
export const isTauri = () => "__TAURI_INTERNALS__" in window;

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
