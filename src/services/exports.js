import { useToast } from "@/composables/useToast";
import { i18n } from "@/i18n";
import { toAgentMarkdown } from "@/model/export/agent";
import { toDbml } from "@/model/export/dbml";
import { SQL_DIALECTS, toSql } from "@/model/export/sql";
import { pngSize, toSvg } from "@/model/export/svg";
import { useDocumentStore } from "@/stores/document";
import {
    isTauri,
    pickExportPath,
    writeExport,
    writeExportBytes,
} from "@/tauri";
import { baseName } from "@/utils/path";

/**
 * Export actions: build the text / image from the document (pure modules in src/model/export),
 * then copy it, or save it through the native dialog (Tauri) or a browser download (dev browser).
 */
const t = (key, params) => i18n.global.t(key, params);

export const EXPORT_FORMATS = [
    { id: "sql", ext: "sql", mime: "text/plain", text: true },
    { id: "dbml", ext: "dbml", mime: "text/plain", text: true },
    { id: "agent", ext: "md", mime: "text/markdown", text: true },
    { id: "svg", ext: "svg", mime: "image/svg+xml", text: true },
    { id: "png", ext: "png", mime: "image/png", text: false },
];
export { SQL_DIALECTS };

/** `{ text, warnings }` for a text format. `options`: { dialect, theme, guide }. */
export function buildText(doc, format, options = {}) {
    switch (format) {
        case "sql": {
            const r = toSql(doc, options.dialect ?? doc.meta.dbType);
            return { text: r.sql, warnings: r.warnings };
        }
        case "dbml":
            return toDbml(doc);
        case "agent":
            return toAgentMarkdown(doc, { guide: options.guide !== false });
        case "svg":
            return {
                text: toSvg(doc, { theme: options.theme }).svg,
                warnings: [],
            };
        default:
            throw new Error(`not a text format: ${format}`);
    }
}

/** Renders the diagram to PNG bytes (Uint8Array) through an offscreen canvas. */
export async function renderPng(doc, { theme = "dark", scale = 2 } = {}) {
    const { svg, width, height } = toSvg(doc, { theme });
    const size = pngSize(width, height, scale);
    const url = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    try {
        const img = new Image();
        img.decoding = "async";
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error("could not render the image"));
            img.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size.width, size.height);
        const blob = await new Promise((resolve, reject) =>
            canvas.toBlob(
                (b) =>
                    b ? resolve(b) : reject(new Error("PNG encoding failed")),
                "image/png",
            ),
        );
        return { bytes: new Uint8Array(await blob.arrayBuffer()), ...size };
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function copyText(text) {
    const toast = useToast();
    try {
        await navigator.clipboard.writeText(text);
        toast.push({
            kind: "success",
            timeout: 1600,
            text: t("export.copied"),
        });
        return true;
    } catch {
        toast.push({ kind: "error", text: t("export.copyFailed") });
        return false;
    }
}

function browserDownload(name, data, mime) {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Default file name: the board's name, else the file's, else "diagram". */
export function exportBaseName() {
    const doc = useDocumentStore();
    return (
        doc.doc.meta.name ||
        (doc.path ? baseName(doc.path) : "") ||
        "diagram"
    ).replace(/[\\/:*?"<>|]+/g, "_");
}

/**
 * Save an export. `payload` is a string, or a Uint8Array for PNG. Returns the path / file name when
 * saved, null when the user cancelled.
 */
export async function saveExport(format, payload) {
    const toast = useToast();
    const fmt = EXPORT_FORMATS.find((f) => f.id === format);
    const base = exportBaseName();
    try {
        if (!isTauri()) {
            browserDownload(`${base}.${fmt.ext}`, payload, fmt.mime);
            toast.push({
                kind: "success",
                timeout: 1800,
                text: t("export.downloaded", { name: `${base}.${fmt.ext}` }),
            });
            return `${base}.${fmt.ext}`;
        }
        const path = await pickExportPath(base, fmt.ext);
        if (!path) return null;
        if (typeof payload === "string") await writeExport(path, payload);
        else await writeExportBytes(path, payload);
        toast.push({
            kind: "success",
            timeout: 2200,
            text: t("export.saved", { name: baseName(path) || path }),
        });
        return path;
    } catch (e) {
        toast.push({
            kind: "error",
            timeout: 0,
            text: t("export.failed", { reason: e }),
        });
        return null;
    }
}
