/**
 * Feature list of the app for the "About" tab. Each entry is an i18n key under `help.f.*`
 * (`<id>.title` + `<id>.text`) and an icon name from src/icons.js, resolved by the dialog.
 */
export const FEATURE_GROUPS = [
    {
        id: "draw",
        items: ["tables", "columns", "types", "relations", "indexes"],
    },
    {
        id: "organize",
        items: ["sections", "notes", "inspector", "search", "tabs"],
    },
    {
        id: "share",
        items: [
            "file",
            "exportSql",
            "exportDbml",
            "exportImage",
            "exportAgent",
            "importSql",
        ],
    },
];

/** Tips shown under the features: little things that are easy to miss. */
export const TIPS = [
    "alt",
    "dblclick",
    "tab",
    "selection",
    "dots",
    "color",
    "undo",
    "persian",
];
