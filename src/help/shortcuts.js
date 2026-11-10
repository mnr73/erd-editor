/**
 * Every keyboard shortcut and mouse gesture the app has, grouped for the help dialog. Pure data:
 * `keys` is an array of alternatives, each a list of key caps; `text` is an i18n key under
 * `help.s.*`. A test checks that the key names used here exist and that both languages have a text
 * for every entry, so the help cannot silently fall behind the code.
 */
export const MOD = "Ctrl";

const k = (...caps) => caps; // one chord

export const SHORTCUT_GROUPS = [
    {
        id: "files",
        items: [
            { id: "new", keys: [k(MOD, "N")] },
            { id: "open", keys: [k(MOD, "O")] },
            { id: "save", keys: [k(MOD, "S")] },
            { id: "saveAs", keys: [k(MOD, "Shift", "S")] },
            { id: "closeTab", keys: [k(MOD, "W")] },
            { id: "reload", keys: [k("F5"), k(MOD, "R")] },
            { id: "nextTab", keys: [k(MOD, "Tab"), k(MOD, "Shift", "Tab")] },
            { id: "gotoTab", keys: [k(MOD, "1", "…", "9")] },
            { id: "export", keys: [k(MOD, "E")] },
            { id: "import", keys: [k(MOD, "Shift", "I")] },
        ],
    },
    {
        id: "tools",
        items: [
            { id: "select", keys: [k("V")] },
            { id: "pan", keys: [k("H"), k("Space", "+ drag")] },
            { id: "table", keys: [k("T")] },
            { id: "section", keys: [k("S")] },
            { id: "note", keys: [k("N")] },
            { id: "relation", keys: [k("R")] },
            { id: "cancel", keys: [k("Esc")] },
        ],
    },
    {
        id: "view",
        items: [
            { id: "search", keys: [k(MOD, "K")] },
            { id: "inspector", keys: [k(MOD, "\\")] },
            { id: "help", keys: [k("?"), k("F1")] },
            { id: "zoomIn", keys: [k(MOD, "+")] },
            { id: "zoomOut", keys: [k(MOD, "−")] },
            { id: "zoomReset", keys: [k(MOD, "0")] },
            { id: "fitAll", keys: [k("Shift", "1")] },
            { id: "fitSelection", keys: [k("Shift", "2")] },
            {
                id: "wheel",
                keys: [k("Wheel"), k("Shift", "Wheel"), k(MOD, "Wheel")],
            },
        ],
    },
    {
        id: "edit",
        items: [
            { id: "undo", keys: [k(MOD, "Z")] },
            { id: "redo", keys: [k(MOD, "Y"), k(MOD, "Shift", "Z")] },
            { id: "selectAll", keys: [k(MOD, "A")] },
            { id: "duplicate", keys: [k(MOD, "D")] },
            { id: "delete", keys: [k("Del")] },
            { id: "rename", keys: [k("F2")] },
            { id: "groupTables", keys: [k(MOD, "G")] },
            { id: "indexes", keys: [k(MOD, "I")] },
            { id: "noteOf", keys: [k("N")] },
        ],
    },
    {
        id: "columns",
        items: [
            { id: "colMove", keys: [k("↑"), k("↓")] },
            { id: "colExtend", keys: [k("Shift", "↑"), k("Shift", "↓")] },
            { id: "colReorder", keys: [k("Alt", "↑"), k("Alt", "↓")] },
            {
                id: "colPick",
                keys: [k("Click"), k(MOD, "Click"), k("Shift", "Click")],
            },
            { id: "colDelete", keys: [k("Del")] },
            { id: "colRename", keys: [k("F2"), k("Enter"), k("Double-click")] },
            { id: "colTab", keys: [k("Tab"), k("Shift", "Tab")] },
            {
                id: "colEditor",
                keys: [k("Alt", "↑"), k("Alt", "↓")],
                inEditor: true,
            },
            { id: "colClear", keys: [k("Esc")] },
        ],
    },
    {
        id: "mouse",
        items: [
            { id: "dblCanvas", keys: [k("Double-click")] },
            { id: "marquee", keys: [k("Drag")] },
            { id: "moreSelect", keys: [k("Shift", "Click")] },
            { id: "linkDrag", keys: [k("Drag")] },
            { id: "lineEdit", keys: [k("Double-click")] },
            { id: "middleTab", keys: [k("Middle-click")] },
            { id: "rightClick", keys: [k("Right-click")] },
        ],
    },
];

/** Every key cap name that appears, to check the list against a whitelist in tests. */
export const allCaps = () =>
    new Set(
        SHORTCUT_GROUPS.flatMap((g) => g.items.flatMap((i) => i.keys.flat())),
    );
