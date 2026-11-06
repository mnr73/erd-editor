/**
 * Default header/group colors (style guide). `id` is the i18n key under `palette.*`.
 * Table header = this color mixed 14% (dark) / 12% (light) into the card surface; see UiColorPalette
 * and the table node. Custom colors live in the document (`doc.palette`).
 */
export const DEFAULT_PALETTE = [
    { id: "blue", hex: "#4C8DFF" },
    { id: "purple", hex: "#8B7CF6" },
    { id: "pink", hex: "#E86BB0" },
    { id: "red", hex: "#EF6461" },
    { id: "orange", hex: "#F08A4B" },
    { id: "amber", hex: "#E0A33A" },
    { id: "green", hex: "#4CB86B" },
    { id: "teal", hex: "#2BB3A8" },
    { id: "sky", hex: "#38B6D9" },
    { id: "gray", hex: "#8792A6" },
];

/** Color of a free note that has none set (palette "amber"). */
export const DEFAULT_NOTE_COLOR = "#E0A33A";

/** Normalise user input ("4c8dff", "#4C8DFF") to lowercase `#rrggbb`, or null if invalid. */
export function normalizeHex(input) {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(String(input).trim());
    return m ? `#${m[1].toLowerCase()}` : null;
}
