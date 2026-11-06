import {
    CARDINALITIES,
    DB_TYPES,
    DEFAULT_FROM_CARDINALITY,
    DEFAULT_TO_CARDINALITY,
    FORMAT,
    HEX_COLOR,
    MIN_GROUP_SIZE,
    REF_ACTIONS,
} from "./constants";
import { ID_PREFIX, newId } from "./ids";
import { ErdFileError, migrate } from "./migrate";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, d = "") =>
    typeof v === "string" ? v : v == null ? d : String(v);
const bool = (v) => v === true;
const num = (v, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/**
 * Validate + migrate + normalize a parsed file.
 * Returns `{ doc, issues }`; `doc` is null when the file is unusable (a `fatal` issue).
 * Unknown keys are preserved on every object.
 * Issue: `{ level: "fatal" | "warn", code, path, ...details }` (UI turns codes into texts).
 */
export function validateErd(raw) {
    if (!isObj(raw)) return fatal("not-object");
    if (raw.format !== FORMAT)
        return fatal("wrong-format", { found: raw.format });

    const issues = [];
    const warn = (code, path, extra = {}) =>
        issues.push({ level: "warn", code, path, ...extra });

    try {
        const src = migrate(raw);
        const doc = {
            ...src,
            meta: meta(src.meta, warn),
            palette: palette(src.palette, warn),
            tables: [],
            refs: [],
            groups: [],
            enums: [],
            view: view(src.view),
        };
        doc.groups = list(src.groups, "groups").map((g, i) =>
            group(g, `groups[${i}]`, warn),
        );
        doc.tables = list(src.tables, "tables").map((t, i) =>
            table(t, `tables[${i}]`, warn),
        );
        doc.refs = list(src.refs, "refs").map((r, i) =>
            ref(r, `refs[${i}]`, warn),
        );
        doc.enums = list(src.enums, "enums").map((e, i) =>
            enumDef(e, `enums[${i}]`, warn),
        );
        uniqueIds(doc.tables, "tables");
        uniqueIds(doc.groups, "groups");
        uniqueIds(doc.refs, "refs");
        uniqueIds(doc.enums, "enums");
        crossCheck(doc, warn);
        return { doc, issues };
    } catch (e) {
        if (e instanceof ErdFileError) return fatal(e.code, e.details);
        throw e;
    }
}

/** Parse JSON text, then validate. Never throws. */
export function parseErd(text) {
    let raw;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        return fatal("invalid-json", { message: e.message });
    }
    return validateErd(raw);
}

function fatal(code, extra = {}) {
    return {
        doc: null,
        issues: [{ level: "fatal", code, path: "", ...extra }],
    };
}

/** Container must be an array (or absent). Non-object items are dropped by the callers. */
function list(v, path) {
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) throw new ErdFileError("bad-container", { path });
    return v;
}

function uniqueIds(items, path) {
    const seen = new Set();
    for (const item of items) {
        if (seen.has(item.id))
            throw new ErdFileError("duplicate-id", { path, id: item.id });
        seen.add(item.id);
    }
}

function withId(r, prefix, path, warn) {
    if (typeof r.id === "string" && r.id) return r.id;
    warn("id-missing", path);
    return newId(prefix);
}

function color(v, path, warn) {
    if (v == null || v === "") return null;
    if (typeof v === "string" && HEX_COLOR.test(v)) return v;
    warn("bad-color", path, { value: v });
    return null;
}

function meta(v, warn) {
    const m = isObj(v) ? v : {};
    let dbType = str(m.dbType, "generic");
    if (!DB_TYPES.includes(dbType)) {
        warn("bad-db-type", "meta.dbType", { value: dbType });
        dbType = "generic";
    }
    return { ...m, name: str(m.name), dbType, note: str(m.note) };
}

function palette(v, warn) {
    if (!Array.isArray(v)) return [];
    return v.filter((c, i) => {
        const ok = typeof c === "string" && HEX_COLOR.test(c);
        if (!ok) warn("bad-color", `palette[${i}]`, { value: c });
        return ok;
    });
}

function view(v) {
    const o = isObj(v) ? v : {};
    const zoom = num(o.zoom, 1);
    return { ...o, x: num(o.x), y: num(o.y), zoom: zoom > 0 ? zoom : 1 };
}

function items(arr, path, warn, fn) {
    const out = [];
    for (const [i, item] of list(arr, path).entries()) {
        if (!isObj(item)) warn("bad-item", `${path}[${i}]`);
        else out.push(fn(item, `${path}[${i}]`));
    }
    return out;
}

function column(r, path, warn) {
    return {
        ...r,
        id: withId(r, ID_PREFIX.column, path, warn),
        name: str(r.name),
        type: str(r.type),
        pk: bool(r.pk),
        unique: bool(r.unique),
        notNull: bool(r.notNull),
        increment: bool(r.increment),
        default: str(r.default),
        note: str(r.note),
    };
}

function indexDef(r, path, warn) {
    return {
        ...r,
        id: withId(r, ID_PREFIX.index, path, warn),
        name: str(r.name),
        columns: Array.isArray(r.columns)
            ? r.columns.filter((c) => typeof c === "string")
            : [],
        unique: bool(r.unique),
        type: r.type === "btree" || r.type === "hash" ? r.type : null,
    };
}

function table(r, path, warn) {
    // `groupId` was removed from the format: membership is derived from geometry (docs/FORMAT.md)
    delete r.groupId;
    const columns = items(r.columns, `${path}.columns`, warn, (c, p) =>
        column(c, p, warn),
    );
    const indexes = items(r.indexes, `${path}.indexes`, warn, (c, p) =>
        indexDef(c, p, warn),
    );
    uniqueIds(columns, `${path}.columns`);
    uniqueIds(indexes, `${path}.indexes`);
    return {
        ...r,
        id: withId(r, ID_PREFIX.table, path, warn),
        name: str(r.name),
        schema: str(r.schema),
        color: color(r.color, `${path}.color`, warn),
        note: str(r.note),
        noteVisible: bool(r.noteVisible),
        x: num(r.x),
        y: num(r.y),
        collapsed: bool(r.collapsed),
        columns,
        indexes,
    };
}

function refEnd(r, side, path, warn) {
    const e = isObj(r) ? r : {};
    const fallback =
        side === "from" ? DEFAULT_FROM_CARDINALITY : DEFAULT_TO_CARDINALITY;
    let cardinality = e.cardinality ?? fallback;
    if (!CARDINALITIES.includes(cardinality)) {
        warn("bad-cardinality", `${path}.cardinality`, { value: cardinality });
        cardinality = fallback;
    }
    return {
        ...e,
        table: str(e.table),
        columns: Array.isArray(e.columns)
            ? e.columns.filter((c) => typeof c === "string")
            : [],
        cardinality,
    };
}

function action(v, path, warn) {
    if (v == null || v === "") return null;
    if (REF_ACTIONS.includes(v)) return v;
    warn("bad-ref-action", path, { value: v });
    return null;
}

function ref(r, path, warn) {
    return {
        ...r,
        id: withId(r, ID_PREFIX.ref, path, warn),
        label: str(r.label),
        from: refEnd(r.from, "from", `${path}.from`, warn),
        to: refEnd(r.to, "to", `${path}.to`, warn),
        onDelete: action(r.onDelete, `${path}.onDelete`, warn),
        onUpdate: action(r.onUpdate, `${path}.onUpdate`, warn),
        note: str(r.note),
    };
}

function group(r, path, warn) {
    return {
        ...r,
        id: withId(r, ID_PREFIX.group, path, warn),
        name: str(r.name),
        color: color(r.color, `${path}.color`, warn),
        note: str(r.note),
        noteVisible: bool(r.noteVisible),
        x: num(r.x),
        y: num(r.y),
        w: Math.max(MIN_GROUP_SIZE, num(r.w, 480)),
        h: Math.max(MIN_GROUP_SIZE, num(r.h, 320)),
        collapsed: bool(r.collapsed),
    };
}

function enumDef(r, path, warn) {
    const values = items(r.values, `${path}.values`, warn, (v) => ({
        ...v,
        name: str(v.name),
        note: str(v.note),
    }));
    return {
        ...r,
        id: withId(r, ID_PREFIX.enum, path, warn),
        name: str(r.name),
        note: str(r.note),
        values,
    };
}

/** References between entities + duplicate names. Problems are reported, never silently fixed. */
function crossCheck(doc, warn) {
    const tables = new Map(doc.tables.map((t) => [t.id, t]));

    doc.tables.forEach((t, ti) => {
        const path = `tables[${ti}]`;
        const colIds = new Set(t.columns.map((c) => c.id));
        t.indexes.forEach((ix, ii) => {
            if (!ix.columns.length)
                warn("index-empty", `${path}.indexes[${ii}]`, {});
            if (new Set(ix.columns).size !== ix.columns.length)
                warn("index-duplicate-column", `${path}.indexes[${ii}]`, {});
            for (const c of ix.columns) {
                if (!colIds.has(c))
                    warn("index-column-missing", `${path}.indexes[${ii}]`, {
                        id: c,
                    });
            }
        });
        const names = new Set();
        for (const c of t.columns) {
            const key = c.name.toLowerCase();
            if (key && names.has(key))
                warn("duplicate-column-name", path, { name: c.name });
            names.add(key);
        }
    });

    const tableNames = new Set();
    for (const t of doc.tables) {
        const key = `${t.schema}.${t.name}`.toLowerCase();
        if (t.name && tableNames.has(key))
            warn("duplicate-table-name", "tables", { name: t.name });
        tableNames.add(key);
    }

    doc.refs.forEach((r, i) => {
        const path = `refs[${i}]`;
        for (const side of ["from", "to"]) {
            const end = r[side];
            const t = tables.get(end.table);
            if (!t) {
                warn("ref-table-missing", `${path}.${side}`, {
                    refId: r.id,
                    id: end.table,
                });
                continue;
            }
            if (!end.columns.length)
                warn("ref-no-columns", `${path}.${side}`, { refId: r.id });
            for (const c of end.columns) {
                if (!t.columns.some((x) => x.id === c)) {
                    warn("ref-column-missing", `${path}.${side}`, {
                        refId: r.id,
                        id: c,
                    });
                }
            }
        }
        if (r.from.columns.length !== r.to.columns.length) {
            warn("ref-columns-mismatch", path, { refId: r.id });
        }
    });
}
