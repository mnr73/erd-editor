import { useToast } from "@/composables/useToast";
import { i18n } from "@/i18n";
import { detectDialect, importSql } from "@/model/import/sql";
import { useDocumentStore } from "@/stores/document";
import { isTauri, pickImportPath, readImport } from "@/tauri";
import { baseName } from "@/utils/path";

const t = (key, params) => i18n.global.t(key, params);

/** Import steps live here so the dialog stays presentational. */
export { detectDialect, importSql };

/** Reads a SQL file through the native dialog. Returns { text, name } or null when cancelled / failed. */
export async function pickSqlFile() {
    if (!isTauri()) return null;
    const toast = useToast();
    const path = await pickImportPath();
    if (!path) return null;
    try {
        return {
            text: await readImport(path),
            name: baseName(path).replace(/\.(sql|ddl|txt)$/i, ""),
        };
    } catch (e) {
        toast.push({
            kind: "error",
            timeout: 0,
            text: t("import.readFailed", { reason: e }),
        });
        return null;
    }
}

/**
 * Open the imported document as a NEW tab (never touches the current board), unsaved: the user
 * decides where to save it. Returns the tab id.
 */
export function openImported(doc) {
    return useDocumentStore().openDocument(doc);
}
