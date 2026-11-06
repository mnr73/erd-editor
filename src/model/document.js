import {
    DEFAULT_FROM_CARDINALITY,
    DEFAULT_TO_CARDINALITY,
    FORMAT,
    VERSION,
} from "./constants";
import { ID_PREFIX, newId } from "./ids";
import { nextName } from "./names";

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

/** A new table the way a user expects it: one `id` primary key column, ready to be named. */
export function createDefaultTable(doc, { x = 0, y = 0 } = {}) {
    const names = doc.tables.map((t) => t.name);
    return createTable({
        name: nextName(names, "table"),
        x,
        y,
        columns: [
            createColumn({
                name: "id",
                type: "bigint",
                pk: true,
                increment: true,
                notNull: true,
            }),
        ],
    });
}

/** Deep copy of plain JSON data (also works on Vue reactive proxies, unlike structuredClone). */
const plain = (v) => JSON.parse(JSON.stringify(v));

const withoutId = ({ id: _id, ...rest }) => rest;

/** Deep copy of a table with fresh ids (columns, indexes remapped); positioned by the caller. */
export function cloneTable(table, name) {
    const columnIds = new Map();
    const columns = table.columns.map((c) => {
        const copy = createColumn(withoutId(plain(c)));
        columnIds.set(c.id, copy.id);
        return copy;
    });
    const indexes = table.indexes.map((ix) =>
        createIndex({
            ...withoutId(plain(ix)),
            columns: ix.columns.map((c) => columnIds.get(c) ?? c),
        }),
    );
    return createTable({
        ...withoutId(plain(table)),
        name,
        columns,
        indexes,
    });
}
