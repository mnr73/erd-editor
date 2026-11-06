import {
    DEFAULT_FROM_CARDINALITY,
    DEFAULT_TO_CARDINALITY,
    FORMAT,
    VERSION,
} from "./constants";
import { ID_PREFIX, newId } from "./ids";

/** Factories always return the full in-memory shape (defaults filled in). */

export function createDocument(name = "") {
    return {
        format: FORMAT,
        version: VERSION,
        meta: { name, dbType: "generic", note: "" },
        palette: [],
        tables: [],
        refs: [],
        groups: [],
        enums: [],
        view: { x: 0, y: 0, zoom: 1 },
    };
}

export function createColumn(partial = {}) {
    return {
        id: newId(ID_PREFIX.column),
        name: "",
        type: "",
        pk: false,
        unique: false,
        notNull: false,
        increment: false,
        default: "",
        note: "",
        ...partial,
    };
}

export function createTable(partial = {}) {
    return {
        id: newId(ID_PREFIX.table),
        name: "",
        schema: "",
        color: null,
        note: "",
        noteVisible: false,
        groupId: null,
        x: 0,
        y: 0,
        collapsed: false,
        columns: [],
        indexes: [],
        ...partial,
    };
}

export function createIndex(partial = {}) {
    return {
        id: newId(ID_PREFIX.index),
        name: "",
        columns: [],
        unique: false,
        type: null,
        ...partial,
    };
}

export function createRefEnd(partial = {}) {
    return {
        table: "",
        columns: [],
        cardinality: DEFAULT_TO_CARDINALITY,
        ...partial,
    };
}

export function createRef(partial = {}) {
    return {
        id: newId(ID_PREFIX.ref),
        label: "",
        from: createRefEnd({ cardinality: DEFAULT_FROM_CARDINALITY }),
        to: createRefEnd(),
        onDelete: null,
        onUpdate: null,
        note: "",
        ...partial,
    };
}

export function createGroup(partial = {}) {
    return {
        id: newId(ID_PREFIX.group),
        name: "",
        color: null,
        note: "",
        x: 0,
        y: 0,
        w: 480,
        h: 320,
        collapsed: false,
        ...partial,
    };
}

export function createEnum(partial = {}) {
    return {
        id: newId(ID_PREFIX.enum),
        name: "",
        note: "",
        values: [],
        ...partial,
    };
}

/**
 * Relationship kind derived from the two cardinalities.
 * `from` is the FK holder: orders(0..*) → users(1) is "N:1".
 */
export function relationKind(ref) {
    const many = (end) => end.cardinality.endsWith("*");
    const a = many(ref.from);
    const b = many(ref.to);
    if (a && b) return "N:M";
    if (a) return "N:1";
    if (b) return "1:N";
    return "1:1";
}

/** Set of `${tableId}.${columnId}` that are the FK side of some ref. */
export function fkColumnKeys(doc) {
    const keys = new Set();
    for (const ref of doc.refs) {
        for (const col of ref.from.columns)
            keys.add(`${ref.from.table}.${col}`);
    }
    return keys;
}
