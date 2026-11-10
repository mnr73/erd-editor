import { setDiskWarning } from "@/composables/useDiskWatch";
import { useToast } from "@/composables/useToast";
import { i18n } from "@/i18n";
import { ACTION, DISK, decide, diskState } from "@/model/external";
import { reloadTab } from "@/services/files";
import { useDocumentStore } from "@/stores/document";
import { isTauri, statFile } from "@/tauri";
import { baseName } from "@/utils/path";

/**
 * Notice when the file of a tab is changed or deleted by something else (an AI agent, git, another
 * editor). Only the ACTIVE tab is checked, every `POLL_MS` and whenever the window gets focus: one
 * `stat` is nearly free, and a hidden tab is checked the moment it is shown.
 *
 * - tab without unsaved changes: reloaded quietly, with a toast (Ctrl+Z undoes it)
 * - tab with unsaved changes: a banner asks, nothing is overwritten
 * - file deleted or moved: a banner says so; saving writes it again
 */
export const POLL_MS = 2000;
const t = (key, params) => i18n.global.t(key, params);

let busy = false;

export async function checkActiveTab() {
    if (busy) return;
    const doc = useDocumentStore();
    const tab = doc.tabById(doc.activeId);
    if (!tab?.path || !tab.stamp) return;
    busy = true;
    try {
        const now = await statFile(tab.path);
        // the tab may have been saved, switched or closed while we were waiting for the disk
        const live = doc.tabById(tab.id);
        if (!live || live.path !== tab.path) return;
        const state = diskState(live.stamp, now);
        const dirty = doc.tabList.find((x) => x.id === live.id)?.dirty ?? false;
        const action = decide({
            state,
            dirty,
            now,
            dismissed: live.dismissed,
        });
        if (state === DISK.SAME) setDiskWarning(live.id, null);
        if (action === ACTION.RELOAD) {
            setDiskWarning(live.id, null);
            if (await reloadTab(live.id, { quiet: true }))
                useToast().push({
                    kind: "info",
                    text: t("disk.reloaded", { name: baseName(live.path) }),
                });
            // else: unreadable or not valid yet (an agent is mid-write). The stamp is unchanged, so the
            // next tick tries again, and the first valid version is loaded. Nothing is shown meanwhile.
        } else if (action === ACTION.ASK) setDiskWarning(live.id, DISK.CHANGED);
        else if (action === ACTION.GONE) setDiskWarning(live.id, DISK.GONE);
    } catch {
        // a hiccup (network drive, permissions): try again at the next tick
    } finally {
        busy = false;
    }
}

/** Keep my version: stop asking about this disk state. The tab stays unsaved; saving asks again. */
export async function keepMine(tabId) {
    const doc = useDocumentStore();
    const tab = doc.tabById(tabId);
    if (!tab?.path) return;
    let now = null;
    try {
        now = await statFile(tab.path);
    } catch {
        // gone or unreadable: remembered as "gone"
    }
    doc.dismissDisk(tabId, now ?? "gone");
    setDiskWarning(tabId, null);
}

/** Start watching; returns the cleanup. Does nothing outside the desktop app (no files there). */
export function watchDisk() {
    if (!isTauri()) return () => {};
    const timer = setInterval(checkActiveTab, POLL_MS);
    const onFocus = () => checkActiveTab();
    window.addEventListener("focus", onFocus);
    return () => {
        clearInterval(timer);
        window.removeEventListener("focus", onFocus);
    };
}
