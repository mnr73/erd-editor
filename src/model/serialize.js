/**
 * Deterministic writer for `.erd.json`: fixed key order, 2-space indent, defaults omitted,
 * unknown keys kept (sorted, after the known ones). See docs/FORMAT.md.
 */

// key order + default (a key whose value equals its default is omitted; no entry = always written)
const SPEC = {
    doc: {
        order: [
            "format",
            "version",
            "meta",
            "palette",
            "tables",
            "refs",
            "groups",
            "notes",
            "enums",
            "view",
        ],
        omit: { palette: [], refs: [], groups: [], notes: [], enums: [] },
    },
    meta: {
        order: ["name", "dbType", "note"],
        omit: { name: "", dbType: "generic", note: "" },
    },
    table: {
        order: [
            "id",
            "name",
            "schema",
            "color",
            "note",
            "noteVisible",
            "x",
            "y",
            "collapsed",
            "columns",
            "indexes",
        ],
        omit: {
            schema: "",
            color: null,
            note: "",
            noteVisible: false,
            collapsed: false,
            indexes: [],
        },
    },
    column: {
        order: [
            "id",
            "name",
            "type",
            "pk",
            "unique",
            "notNull",
            "increment",
            "default",
            "note",
        ],
        omit: {
            type: "",
            pk: false,
            unique: false,
            notNull: false,
            increment: false,
            default: "",
            note: "",
        },
    },
    index: {
        order: ["id", "name", "columns", "unique", "type"],
        omit: { name: "", unique: false, type: null },
    },
    ref: {
        order: ["id", "label", "from", "to", "onDelete", "onUpdate", "note"],
        omit: { label: "", onDelete: null, onUpdate: null, note: "" },
    },
    refEnd: { order: ["table", "columns", "cardinality"], omit: {} },
    group: {
        order: [
            "id",
            "name",
            "color",
            "note",
            "noteVisible",
            "x",
            "y",
            "w",
            "h",
            "collapsed",
        ],
        omit: { color: null, note: "", noteVisible: false, collapsed: false },
    },
    note: {
        order: ["id", "text", "color", "x", "y", "w", "h"],
        omit: { text: "", color: null },
    },
    enum: { order: ["id", "name", "note", "values"], omit: { note: "" } },
    enumValue: { order: ["name", "note"], omit: { note: "" } },
    view: { order: ["x", "y", "zoom"], omit: {} },
};

const same = (a, b) =>
    b !== null && typeof b === "object"
        ? JSON.stringify(a) === JSON.stringify(b)
        : a === b;

function write(obj, spec, children = {}) {
    const out = {};
    for (const key of spec.order) {
        if (!(key in obj) || obj[key] === undefined) continue;
        if (key in spec.omit && same(obj[key], spec.omit[key])) continue;
        out[key] = key in children ? children[key](obj[key]) : obj[key];
    }
    for (const key of Object.keys(obj).sort()) {
        if (!spec.order.includes(key) && obj[key] !== undefined)
            out[key] = obj[key];
    }
    return out;
}

const many = (fn) => (arr) => arr.map(fn);

export function toPlain(doc) {
    const tableOut = (t) =>
        write(t, SPEC.table, {
            columns: many((c) => write(c, SPEC.column)),
            indexes: many((i) => write(i, SPEC.index)),
        });
    const refOut = (r) =>
        write(r, SPEC.ref, {
            from: (e) => write(e, SPEC.refEnd),
            to: (e) => write(e, SPEC.refEnd),
        });
    return write(doc, SPEC.doc, {
        meta: (m) => write(m, SPEC.meta),
        tables: many(tableOut),
        refs: many(refOut),
        groups: many((g) => write(g, SPEC.group)),
        notes: many((n) => write(n, SPEC.note)),
        enums: many((e) =>
            write(e, SPEC.enum, {
                values: many((v) => write(v, SPEC.enumValue)),
            }),
        ),
        view: (v) => write(v, SPEC.view),
    });
}

export function serializeErd(doc) {
    return JSON.stringify(toPlain(doc), null, 2) + "\n";
}

/** Same as serializeErd but without `view` (pan/zoom): used for dirty-checking and undo snapshots. */
export function snapshotErd(doc) {
    const rest = { ...doc };
    delete rest.view;
    return JSON.stringify(toPlain(rest));
}
