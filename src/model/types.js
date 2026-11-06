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
