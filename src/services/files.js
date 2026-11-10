import { askChoice } from "@/composables/useAsk";
import { useDiskWarnings } from "@/composables/useDiskWatch";
import { useRecent } from "@/composables/useRecent";
import { useToast } from "@/composables/useToast";
import { i18n } from "@/i18n";
import { buildSampleDocument } from "@/model/sample";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";
import {
    ensureExt,
    isTauri,
    pickFiles,
    pickSavePath,
    readFile,
    writeFile,
} from "@/tauri";
import { baseName, isErdName } from "@/utils/path";

/**
 * File actions shared by the title bar, tab bar, start page and shortcuts.
 * Everything that touches disk lives here so components stay presentational.
 */
const t = (key, params) => i18n.global.t(key, params);

/** Readable reason for a fatal validation code (falls back to the code itself). */
function fatalReason(fatal) {
    const key = `file.fatal.${fatal.code}`;
    return i18n.global.te(key) ? t(key, fatal) : fatal.code;
}

function toastIssues(issues, name) {
    const toast = useToast();
    const fatal = issues.find((i) => i.level === "fatal");
    if (fatal)
        toast.push({
            kind: "error",
            timeout: 0,
            text: t("file.openFailed", { name, reason: fatalReason(fatal) }),
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
    const { remember, forget } = useRecent();
    for (const path of paths) {
        try {
            const { text, stamp } = await readFile(path);
            const { id, issues } = doc.openText(text, path, stamp);
            if (!id) toastIssues(issues, baseName(path));
            else {
                remember(path);
                if (issues.length) toastIssues(issues, baseName(path));
            }
        } catch (e) {
            forget(path); // moved or deleted: stop offering it
            toast.push({
                kind: "error",
                timeout: 0,
                text: t("file.openFailed", { name: baseName(path), reason: e }),
            });
        }
    }
}

/**
 * Open files dropped on the window: `[{ name, path }]` (desktop) or `[{ name, file }]` (browser).
 * Wrong extension and broken structure are reported, nothing is opened.
 */
export async function openDropped(entries) {
    const doc = useDocumentStore();
    const toast = useToast();
    for (const { name, path, file } of entries) {
        if (!isErdName(name)) {
            toast.push({ kind: "error", text: t("file.dropNotErd", { name }) });
            continue;
        }
        try {
            const read = file
                ? { text: await file.text() }
                : await readFile(path);
            const { id, issues } = doc.openText(
                read.text,
                path ?? null,
                read.stamp ?? null,
            );
            if (id && path) useRecent().remember(path);
            if (!id || issues.length) toastIssues(issues, baseName(name));
        } catch (e) {
            toast.push({
                kind: "error",
                timeout: 0,
                text: t("file.openFailed", { name: baseName(name), reason: e }),
            });
        }
    }
}

export async function openWithDialog() {
    const paths = await pickFiles();
    if (paths.length) await openPaths(paths);
}

/** The "new board" button / Ctrl+N: asks which kind (see AppNewBoardDialog). */
export function newBoard() {
    useEditorStore().openNew();
}

/** A blank board in a new tab (or in the empty start tab). */
export function newEmptyBoard() {
    useDocumentStore().newTab();
}

/** The sample board, worded in the UI language. Opens as a new, unsaved tab. */
export function newSampleBoard() {
    const text = Object.fromEntries(
        [
            "name",
            "boardNote",
            "categoriesNote",
            "slugNote",
            "sectionAccounts",
            "sectionContent",
            "sticky",
        ].map((k) => [k, t(`sample.${k}`)]),
    );
    useDocumentStore().openDocument(buildSampleDocument(text));
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
        // overwriting the file this tab was read from: refuse when someone else changed it meanwhile
        const sameFile = !forceDialog && path === doc.path;
        // a deleted file has nothing to compare with: just write it again
        const gone = useDiskWarnings().value[doc.activeId] === "gone";
        let stamp;
        try {
            stamp = await writeFile(path, text, {
                expected: doc.activeStamp,
                force: !sameFile || !doc.activeStamp || gone,
            });
        } catch (e) {
            if (e !== "changed") throw e;
            const answer = await askChoice({
                title: t("disk.saveTitle", { name: baseName(path) }),
                message: t("disk.saveMessage"),
                choices: [
                    { id: "cancel", label: t("common.cancel") },
                    { id: "load", label: t("disk.loadDisk") },
                    {
                        id: "overwrite",
                        label: t("disk.overwrite"),
                        variant: "danger",
                    },
                ],
            });
            if (answer === "load") {
                await reloadTab(doc.activeId);
                return false;
            }
            if (answer !== "overwrite") return false;
            stamp = await writeFile(path, text);
        }
        doc.markSaved(path, stamp);
        useRecent().remember(path);
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

/**
 * Take the file's current content from disk into a tab (the "Reload" action). One undo step, so a
 * wrong reload is a Ctrl+Z away. Returns true when it was reloaded. `quiet` (the automatic check)
 * reports nothing when the file cannot be read or parsed: a half-written file is retried later.
 */
export async function reloadTab(tabId, { quiet = false } = {}) {
    const doc = useDocumentStore();
    const toast = useToast();
    const tab = doc.tabById(tabId);
    if (!tab?.path) return false;
    try {
        const { text, stamp } = await readFile(tab.path);
        if (!doc.replaceFromDisk(tabId, text, stamp)) {
            if (quiet) return false;
            toast.push({
                kind: "error",
                timeout: 0,
                text: t("disk.reloadInvalid", { name: baseName(tab.path) }),
            });
            return false;
        }
        return true;
    } catch (e) {
        if (quiet) return false;
        toast.push({
            kind: "error",
            timeout: 0,
            text: t("file.openFailed", { name: baseName(tab.path), reason: e }),
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
