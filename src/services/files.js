import { askChoice } from "@/composables/useAsk";
import { useToast } from "@/composables/useToast";
import { i18n } from "@/i18n";
import { useDocumentStore } from "@/stores/document";
import {
    ensureExt,
    isTauri,
    pickFiles,
    pickSavePath,
    readFile,
    writeFile,
} from "@/tauri";
import { baseName } from "@/utils/path";

/**
 * File actions shared by the title bar, tab bar, start page and shortcuts.
 * Everything that touches disk lives here so components stay presentational.
 */
const t = (key, params) => i18n.global.t(key, params);

function toastIssues(issues, name) {
    const toast = useToast();
    const fatal = issues.find((i) => i.level === "fatal");
    if (fatal)
        toast.push({
            kind: "error",
            timeout: 0,
            text: t("file.openFailed", { name, reason: fatal.code }),
        });
    else if (issues.length)
        toast.push({
            kind: "warn",
            text: t("file.openedWithWarnings", { name, n: issues.length }),
        });
}

/** Open files (array of paths) in tabs; an already open path is just activated. */
export async function openPaths(paths) {
    const doc = useDocumentStore();
    const toast = useToast();
    for (const path of paths) {
        try {
            const text = await readFile(path);
            const { id, issues } = doc.openText(text, path);
            if (!id) toastIssues(issues, baseName(path));
            else if (issues.length) toastIssues(issues, baseName(path));
        } catch (e) {
            toast.push({
                kind: "error",
                timeout: 0,
                text: t("file.openFailed", { name: baseName(path), reason: e }),
            });
        }
    }
}

export async function openWithDialog() {
    const paths = await pickFiles();
    if (paths.length) await openPaths(paths);
}

export function newBoard() {
    useDocumentStore().newTab();
}

/** Save the active tab; asks for a path when it has none. Returns true when saved. */
export async function saveActive({ forceDialog = false } = {}) {
    const doc = useDocumentStore();
    const toast = useToast();
    let path = doc.path;
    if (!path || forceDialog) {
        path = await pickSavePath(doc.doc.meta.name || "diagram");
        if (!path) return false;
    }
    try {
        const text = doc.serialize();
        await writeFile(path, text);
        doc.markSaved(path);
        toast.push({
            kind: "success",
            timeout: 1800,
            text: t("file.saved", { name: baseName(path) }),
        });
        return true;
    } catch (e) {
        toast.push({
            kind: "error",
            timeout: 0,
            text: t("file.saveFailed", { reason: e }),
        });
        return false;
    }
}

/** Ask what to do with unsaved changes of one tab. Returns true when it is safe to discard/close it. */
export async function resolveUnsaved(tabId) {
    const doc = useDocumentStore();
    const tab = doc.tabList.find((x) => x.id === tabId);
    if (!tab?.dirty) return true;
    const was = doc.activeId;
    doc.activateTab(tabId);
    const name = tab.path ? baseName(tab.path) : t("title.untitled");
    const answer = await askChoice({
        title: t("file.unsavedTitle", { name }),
        message: t("file.unsavedMessage"),
        choices: [
            { id: "discard", label: t("file.dontSave"), variant: "danger" },
            { id: "cancel", label: t("common.cancel") },
            { id: "save", label: t("file.save"), variant: "primary" },
        ],
    });
    if (answer === "save") {
        if (await saveActive()) return true;
    } else if (answer === "discard") return true;
    if (was !== tabId) doc.activateTab(was);
    return false;
}

export async function closeTabWithConfirm(tabId) {
    if (!(await resolveUnsaved(tabId))) return false;
    useDocumentStore().closeTab(tabId);
    return true;
}

/** Window close: walk through every dirty tab. */
export async function confirmCloseAll() {
    const doc = useDocumentStore();
    for (const tab of [...doc.tabList]) {
        if (!(await resolveUnsaved(tab.id))) return false;
    }
    return true;
}

export { ensureExt, isTauri };
