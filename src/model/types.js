/** Column type suggestions for the type field. Free text is always allowed; this only helps typing. */

const COMMON = [
    "bigint",
    "int",
    "smallint",
    "tinyint",
    "boolean",
    "varchar(255)",
    "varchar(100)",
    "char(36)",
    "text",
    "longtext",
    "json",
    "uuid",
    "date",
    "time",
    "timestamp",
    "datetime",
    "decimal(12,2)",
    "numeric(12,2)",
    "float",
    "double",
    "blob",
];

const EXTRA = {
    generic: [],
    mysql: [
        "bigint unsigned",
        "int unsigned",
        "mediumtext",
        "enum('a','b')",
        "year",
        "bit",
    ],
    postgres: [
        "jsonb",
        "serial",
        "bigserial",
        "timestamptz",
        "inet",
        "bytea",
        "text[]",
        "interval",
    ],
    sqlite: ["integer", "real"],
    mssql: [
        "nvarchar(255)",
        "nvarchar(max)",
        "uniqueidentifier",
        "datetime2",
        "bit",
        "money",
    ],
};

export function typeList(dbType = "generic") {
    return [...COMMON, ...(EXTRA[dbType] ?? [])];
}

/** Suggestions for what the user typed: prefix matches first, then substring matches. */
export function typeSuggestions(query, dbType = "generic", limit = 8) {
    const list = typeList(dbType);
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, limit);
    const starts = list.filter((t) => t.toLowerCase().startsWith(q));
    const has = list.filter(
        (t) => !starts.includes(t) && t.toLowerCase().includes(q),
    );
    return [...starts, ...has]
        .filter((t) => t.toLowerCase() !== q)
        .slice(0, limit);
}

/* ------------------------------------------------------------------------------------------------
 * Structured types
 *
 * The file keeps a column type as plain text ("decimal(12,2)", "bigint unsigned") so the format,
 * DBML and SQL stay simple. The type picker works on a parsed form of that text:
 *   { base, params: [n | "max" | null ...] | ["a","b"] for enum, unsigned, array }
 * `parseType` returns null for anything the catalog does not understand; the UI then falls back to a
 * free text field, so no existing file ever loses its type.
 * ---------------------------------------------------------------------------------------------- */

const P = {
    length: { key: "length", def: 255, min: 1, max: 65535 },
    precision: { key: "precision", def: 12, min: 1, max: 65 },
    scale: { key: "scale", def: 2, min: 0, max: 30 },
    fsp: { key: "fsp", def: 0, min: 0, max: 6 },
};

const INT_MODS = { unsigned: ["mysql"] };

/** group: numbers | text | datetime | other. `dbs`: limit to these databases (default: all). */
export const TYPE_DEFS = [
    { id: "tinyint", group: "numbers", mods: INT_MODS },
    { id: "smallint", group: "numbers", mods: INT_MODS },
    { id: "mediumint", group: "numbers", dbs: ["mysql"], mods: INT_MODS },
    { id: "int", group: "numbers", mods: INT_MODS },
    { id: "integer", group: "numbers", dbs: ["sqlite", "postgres"] },
    { id: "bigint", group: "numbers", mods: INT_MODS },
    {
        id: "decimal",
        group: "numbers",
        params: [P.precision, P.scale],
    },
    {
        id: "numeric",
        group: "numbers",
        params: [P.precision, P.scale],
    },
    { id: "float", group: "numbers" },
    { id: "double", group: "numbers" },
    { id: "real", group: "numbers", dbs: ["sqlite", "postgres", "mssql"] },
    { id: "money", group: "numbers", dbs: ["mssql", "postgres"] },
    { id: "serial", group: "numbers", dbs: ["postgres"] },
    { id: "bigserial", group: "numbers", dbs: ["postgres"] },
    { id: "boolean", group: "other" },
    { id: "bit", group: "other", dbs: ["mysql", "mssql"] },

    { id: "char", group: "text", params: [{ ...P.length, def: 36 }] },
    { id: "varchar", group: "text", params: [P.length] },
    {
        id: "nvarchar",
        group: "text",
        dbs: ["mssql"],
        params: [{ ...P.length, max: 4000, special: ["max"] }],
    },
    { id: "text", group: "text" },
    { id: "mediumtext", group: "text", dbs: ["mysql"] },
    { id: "longtext", group: "text", dbs: ["mysql"] },

    { id: "date", group: "datetime" },
    { id: "time", group: "datetime", params: [{ ...P.fsp, optional: true }] },
    {
        id: "timestamp",
        group: "datetime",
        params: [{ ...P.fsp, optional: true }],
    },
    {
        id: "datetime",
        group: "datetime",
        params: [{ ...P.fsp, optional: true }],
    },
    {
        id: "datetime2",
        group: "datetime",
        dbs: ["mssql"],
        params: [{ ...P.fsp, max: 7, optional: true }],
    },
    { id: "timestamptz", group: "datetime", dbs: ["postgres"] },
    { id: "year", group: "datetime", dbs: ["mysql"] },
    { id: "interval", group: "datetime", dbs: ["postgres"] },

    { id: "json", group: "other" },
    { id: "jsonb", group: "other", dbs: ["postgres"] },
    { id: "uuid", group: "other", dbs: [null, "postgres", "mysql", "sqlite"] },
    { id: "uniqueidentifier", group: "other", dbs: ["mssql"] },
    { id: "blob", group: "other" },
    { id: "bytea", group: "other", dbs: ["postgres"] },
    { id: "inet", group: "other", dbs: ["postgres"] },
    { id: "enum", group: "other", dbs: ["mysql", "generic"], list: true },
];

export const TYPE_GROUPS = ["numbers", "text", "datetime", "other"];

const byId = new Map(TYPE_DEFS.map((d) => [d.id, d]));
export const typeDef = (id) => byId.get(id) ?? null;

/** Is `def` offered for this database? (`generic` offers everything that is not engine-specific.) */
export function availableFor(def, dbType = "generic") {
    if (!def.dbs) return true;
    if (def.dbs.includes(dbType)) return true;
    return dbType === "generic" && def.dbs.includes(null);
}

/** Grouped list for the type select: [{ group, types: [def] }]. */
export function typeGroups(dbType = "generic", keepId = null) {
    return TYPE_GROUPS.map((group) => ({
        group,
        types: TYPE_DEFS.filter(
            (d) =>
                d.group === group &&
                (availableFor(d, dbType) || d.id === keepId),
        ),
    })).filter((g) => g.types.length);
}

/** Does this database support the `unsigned` modifier on `def`? */
export const supportsUnsigned = (def, dbType) =>
    !!def?.mods?.unsigned?.includes(dbType);
export const supportsArray = (dbType) => dbType === "postgres";

const clampInt = (n, spec) =>
    Math.min(spec.max, Math.max(spec.min, Math.round(n)));

/**
 * Text → structure, or null when the text is not a catalog type (the UI then shows a free text field).
 *   "decimal(12,2)" → { base: "decimal", params: [12, 2], unsigned: false, array: false }
 *   "varchar"       → { base: "varchar", params: [null] }   (a bare name stays bare)
 */
export function parseType(text) {
    const raw = String(text ?? "").trim();
    if (!raw) return null;
    const m =
        /^([a-z][a-z0-9_]*)\s*(?:\(([^)]*)\))?\s*(\[\])?\s*(unsigned)?\s*$/i.exec(
            raw,
        );
    if (!m) return null;
    const def = typeDef(m[1].toLowerCase());
    if (!def) return null;
    const out = {
        base: def.id,
        params: [],
        unsigned: !!m[4],
        array: !!m[3],
    };
    const inner = m[2];
    if (def.list) {
        if (inner === undefined) return out;
        const values = [...inner.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) =>
            x[1].replace(/\\(.)/g, "$1"),
        );
        // anything besides quoted values (or nothing at all) means it is not a plain enum
        const rest = inner
            .replace(/'((?:[^'\\]|\\.)*)'/g, "")
            .replace(/[,\s]/g, "");
        if (rest || (inner.trim() && !values.length)) return null;
        out.params = values;
        return out;
    }
    const specs = def.params ?? [];
    const parts =
        inner === undefined ? [] : inner.split(",").map((x) => x.trim());
    if (parts.length > specs.length) return null;
    if (inner !== undefined && inner.trim() === "") return null;
    out.params = specs.map((spec, i) => {
        const v = parts[i];
        if (v === undefined) return null;
        if (spec.special?.includes(v.toLowerCase())) return v.toLowerCase();
        if (!/^\d+$/.test(v)) return NaN;
        return Number(v);
    });
    if (out.params.some((v) => Number.isNaN(v))) return null;
    if (
        out.params.some(
            (v, i) =>
                typeof v === "number" && (v < specs[i].min || v > specs[i].max),
        )
    )
        return null;
    return out;
}

/** Structure → text. Parameters are written only when the first one is set. */
export function formatType(t) {
    const def = typeDef(t.base);
    let s = t.base;
    if (def?.list) {
        if (t.params.length)
            s += `(${t.params.map((v) => `'${String(v).replace(/'/g, "\\'")}'`).join(",")})`;
    } else if (
        def?.params?.length &&
        t.params.some((v) => v !== null && v !== undefined)
    ) {
        let last = t.params.length - 1;
        while (
            last > 0 &&
            (t.params[last] === null || t.params[last] === undefined)
        )
            last--;
        const vals = def.params
            .slice(0, last + 1)
            .map((spec, i) => t.params[i] ?? spec.def);
        s += `(${vals.join(",")})`;
    }
    if (t.array) s += "[]";
    if (t.unsigned) s += " unsigned";
    return s;
}

/**
 * Switch to another base type: parameters reset to that type's defaults (a length is carried over
 * between char / varchar / nvarchar, precision & scale between decimal / numeric), modifiers the new
 * type or database does not support are dropped.
 */
export function changeBase(t, baseId, dbType = "generic") {
    const def = typeDef(baseId);
    if (!def) return t;
    const old = typeDef(t.base);
    let params = def.list
        ? []
        : (def.params ?? []).map((spec) => (spec.optional ? null : spec.def));
    const sameShape =
        old &&
        old.params &&
        def.params &&
        old.params.length === def.params.length &&
        old.params.every((p, i) => p.key === def.params[i].key);
    if (sameShape)
        params = t.params.map(
            (v, i) => v ?? (def.params[i].optional ? null : def.params[i].def),
        );
    return {
        base: def.id,
        params,
        unsigned: t.unsigned && supportsUnsigned(def, dbType),
        array: t.array && supportsArray(dbType),
    };
}

/**
 * Set parameter `i`. Numbers are clamped to the type's range; an empty value clears an optional
 * parameter; a scale never exceeds the precision (and lowering the precision pulls the scale down).
 */
export function setParam(t, i, value) {
    const def = typeDef(t.base);
    const spec = def?.params?.[i];
    if (!spec) return t;
    const params = [...t.params];
    if (value === "" || value === null || value === undefined) {
        params[i] = spec.optional ? null : spec.def;
    } else if (spec.special?.includes(String(value).toLowerCase())) {
        params[i] = String(value).toLowerCase();
    } else if (Number.isFinite(Number(value))) {
        params[i] = clampInt(Number(value), spec);
    } else return t;
    if (spec.key === "precision" && typeof params[1] === "number")
        params[1] = Math.min(params[1], params[0]);
    if (spec.key === "scale" && typeof params[0] === "number")
        params[i] = Math.min(params[i], params[0]);
    return { ...t, params };
}

/** Text for the enum editor: values joined as a comma-separated list. */
export const parseEnumValues = (text) =>
    String(text)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
